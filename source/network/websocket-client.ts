import type { ConsoleLogger } from '@xf-common/facilities/logging';
import { isString, isUndefined } from '@xf-common/general/type-checking';
import type { Messaging } from '@xf-common/network/messaging';

export class WebSocketClient {
  /**
   * @param wssurl e.g. `wss://${window.location.host}${window.location.pathname}`
   * @param listener Will receive all messages from the server.
   */
  static initialize (config: WebSocketClient.Config): WebSocketClient {
    const client = new WebSocketClient(config);
    client.#connect();
    return client;
  }

  constructor (config: WebSocketClient.Config) {
    this.#config = config;
  }
  readonly #config: WebSocketClient.Config;

  #buffer: Messaging.Message[] | undefined;
  #ws: WebSocket;
  #ready: {
    promise: Promise<unknown>;
    resolve: (value?: unknown) => void;
    reject: (reason?: any) => void;
  };

  async ready (): Promise<void> { await this.#ready.promise; }

  send (message: Messaging.Message): void;
  send (type: string, data?: unknown): void;
  send (message_or_type: string | Messaging.Message, data: unknown = null) {
    const message: Messaging.Message = isString(message_or_type) ? { type: message_or_type, data } : message_or_type;
    if (this.#buffer) {
      this.#buffer.push(message);
    }
    else {
      this.#send(message);
    }
  }
  #send (message: Messaging.Message): void {
    this.#ws.send(JSON.stringify(message));
  }
  #flush () {
    const buffer = this.#buffer;
    if (isUndefined(buffer)) return;
    this.#buffer = undefined;
    for (const message of buffer) {
      this.#send(message);
    }
  }

  #receive (event: MessageEvent) {
    const message: Messaging.Message = JSON.parse(event.data);
    this.#config.listener.receiveMessage(message);
  }

  #connect (wait = 1000) {
    const config = this.#config;
    const { log } = config;
    this.#buffer = [];
    this.#ready = Promise.withResolvers();
    log.working(`Attempting to connect to WebSocket server at ${config.wssurl}...`);
    const ws = new WebSocket(config.wssurl);
    ws.addEventListener('open', () => {
      log.info(`WebSocket connection established.`);
    });
    const self = this;
    ws.addEventListener('message', function initialListener (event: MessageEvent) {
      const message: Messaging.Message = JSON.parse(event.data);
      if (message.type === 'ready') {
        log.good(`Server handshake complete. Default message channel is now active.`);
        ws.removeEventListener('message', initialListener);
        self.#ws = ws;
        ws.addEventListener('message', (event: MessageEvent) => self.#receive(event));
        self.#flush();
        self.#ready.resolve();
        config.listener.connectedToServer?.();
      }
    });
    ws.addEventListener('close', () => {
      log.problem(`The connection to the server was closed. Attempting to reconnect...`);
      config.listener.disconnectedFromServer?.();
      this.#scheduleReconnect(wait);
    });
    ws.addEventListener('error', () => {
      log.critical(`Failed to connect to the server. Retrying in ${wait}ms.`);
      this.#scheduleReconnect(wait);
    });
  }

  #reconnectScheduled = false;
  #scheduleReconnect (wait: number): void {
    if (this.#reconnectScheduled) return;
    this.#reconnectScheduled = true;
    setTimeout(() => {
      this.#reconnectScheduled = false;
      this.#connect(Math.min(wait * 1.25, WebSocketClient.maxWait));
    }, wait);
  }

  static maxWait = 10000;
}
export namespace WebSocketClient {
  export interface Config {
    /**
     * e.g. `wss://${window.location.host}${window.location.pathname}`
     */
    readonly wssurl: string;
    /**
     * Will receive all messages from the server.
     */
    readonly listener: WebSocketClient.Listener;
    readonly log: ConsoleLogger;
  }
  export interface Listener {
    receiveMessage (message: Messaging.Message): void;
    disconnectedFromServer? (): void;
    connectedToServer? (): void;
  }
}
