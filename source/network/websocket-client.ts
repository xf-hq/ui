import { isString, isUndefined } from '@xf-common/general/type-checking';
import type { Messaging } from '@xf-common/network/messaging';

export class WebSocketClient {
  /**
   * @param wssurl e.g. `wss://${window.location.host}${window.location.pathname}`
   * @param listener Will receive all messages from the server.
   */
  static initialize (wssurl: string, listener: WebSocketClient.Listener): WebSocketClient {
    const client = new WebSocketClient(wssurl, listener);
    client.#connect();
    return client;
  }

  constructor (wssurl: string/* , ws: WebSocket */, listener: WebSocketClient.Listener) {
    this.#wssurl = wssurl;
    this.#listener = listener;
  }
  readonly #wssurl: string;
  readonly #listener: WebSocketClient.Listener;

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
    this.#listener.receiveMessage(message);
  }

  #connect (wait = 1000) {
    this.#buffer = [];
    this.#ready = Promise.withResolvers();
    const wssurl = this.#wssurl;
    console.debug(`Attempting to connect to WebSocket server at ${wssurl}...`);
    const ws = new WebSocket(wssurl);
    ws.addEventListener('open', () => {
      console.debug(`WebSocket connection established.`);
    });
    const self = this;
    ws.addEventListener('message', function initialListener (event: MessageEvent) {
      const message: Messaging.Message = JSON.parse(event.data);
      if (message.type === 'ready') {
        console.info(`Connected to the server.`);
        ws.removeEventListener('message', initialListener);
        self.#ws = ws;
        ws.addEventListener('message', (event: MessageEvent) => self.#receive(event));
        self.#flush();
        self.#ready.resolve();
        self.#listener.connectedToServer?.();
      }
    });
    ws.addEventListener('close', () => {
      console.warn(`The connection to the server was closed. Attempting to reconnect...`);
      self.#listener.disconnectedFromServer?.();
      this.#scheduleReconnect(wait);
    });
    ws.addEventListener('error', () => {
      console.error(`Failed to connect to the server. Retrying in ${wait}ms.`);
      this.#scheduleReconnect(wait);
    });
  }

  #reconnectScheduled = false;
  #scheduleReconnect (wait: number): void {
    if (this.#reconnectScheduled) return;
    this.#reconnectScheduled = true;
    setTimeout(() => this.#connect(Math.min(wait * 1.25, WebSocketClient.maxWait)), wait);
  }

  static maxWait = 10000;
}
export namespace WebSocketClient {
  export interface Listener {
    receiveMessage (message: Messaging.Message): void;
    disconnectedFromServer? (): void;
    connectedToServer? (): void;
  }
}
