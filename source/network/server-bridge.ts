import { DevtoolsLogger } from '@xf-common/browser/console/devtools-console-logger';
import { PathLens } from '@xf-common/facilities/path-lens';
import { createChildAbortController } from '@xf-common/general/abort-signals';
import { IdGenerator } from '@xf-common/general/ids-and-caching';
import { isString, isUndefined } from '@xf-common/general/type-checking';
import { Messaging } from '@xf-common/network/messaging';
import type { WebSocketClient } from './websocket-client';

const log = DevtoolsLogger('ServerBridge');

export class ServerBridge {
  constructor (public readonly network: WebSocketClient) {}
  readonly #pendingRequests = new Map<unknown, RequestDetails>();
  readonly #activeChannels = new Map<unknown, { router: Messaging.V2.MessageHandler; args: any[] }>();
  readonly #responseHandler: Messaging.MessageHandler = { handleMessage: (context: Messaging.InboundMessageContext<Messaging.Message.Response.Data>) => this._receiveResponse(context.messageData) };
  readonly #updateHandler: Messaging.MessageHandler = { handleMessage: (context: Messaging.InboundMessageContext<Messaging.Message.Update.Data>) => this._receiveUpdate(context.messageData) };

  get responseHandler (): Messaging.MessageHandler { return this.#responseHandler; }
  get updateHandler (): Messaging.MessageHandler { return this.#updateHandler; }

  send<T extends Messaging.Message> (message: T): void {
    this.network.send(message);
  }

  request (abortSignal: AbortSignal, requestType: string, requestData: unknown, callback: ServerBridge.OnResponse): void;
  request (abortSignal: AbortSignal, request: Messaging.Message, callback: ServerBridge.OnResponse): void;
  request (abortSignal: AbortSignal, arg1: string | Messaging.Message, arg2: unknown, callback?: ServerBridge.OnResponse): void {
    let request: Messaging.Message;
    if (isString(arg1)) {
      request = Messaging.Message(arg1, arg2);
    }
    else {
      request = arg1;
      callback = arg2 as ServerBridge.OnResponse;
    }
    const ref = IdGenerator.global();
    const abortListener = () => this._abortRequest(ref);
    this.#pendingRequests.set(ref, { kind: 'transient', abortSignal, abortListener, callback: callback! });
    this.send(Messaging.Message.Request(ref, request));
    abortSignal.addEventListener('abort', abortListener, { once: true });
  }

  open<TRequestData> (abortSignal: AbortSignal, requestType: string, requestData: TRequestData, callback: ServerBridge.OnOpenChannelResponse): void;
  open (abortSignal: AbortSignal, request: Messaging.Message, callback: ServerBridge.OnOpenChannelResponse): void;
  open (abortSignal: AbortSignal, arg1: string | Messaging.Message, arg2: unknown, callback?: ServerBridge.OnOpenChannelResponse): void {
    let request: Messaging.Message;
    if (isString(arg1)) {
      request = Messaging.Message(arg1, arg2);
    }
    else {
      request = arg1;
      callback = arg2 as ServerBridge.OnOpenChannelResponse;
    }
    const ref = IdGenerator.global();
    const abortListener = () => this._abortRequest(ref);
    this.#pendingRequests.set(ref, { kind: 'persistent', abortSignal, abortListener, callback: callback! });
    this.send(Messaging.Message.Request(ref, request));
    abortSignal.addEventListener('abort', abortListener, { once: true });
  }

  private _abortRequest (ref: unknown): void {
    if (this.#pendingRequests.delete(ref) || this.#activeChannels.delete(ref)) {
      this.send(Messaging.Message.Request.Cancel(ref));
    }
  }

  private _receiveResponse (response: Messaging.Message.Response.Data) {
    const ref = response.ref;
    const request = this.#pendingRequests.get(ref);
    this.#pendingRequests.delete(ref);
    if (isUndefined(request)) return; // The requester may have already cancelled the request locally.
    request.abortSignal.removeEventListener('abort', request.abortListener);
    const messageType = PathLens.from(':', response.message.type);
    const messageData = response.message.data;
    const context = new InboundMessageFromServer(response.message, messageType, messageData, ref);
    if (request.kind === 'transient') {
      if (response.persistent) {
        log.warn(`Singular request yielded a persistent channel response. The request will be cancelled automatically, but the response will still be delivered.`);
        this.send(Messaging.Message.Request.Cancel(ref));
      }
      request.callback(context);
    }
    else {
      if (!response.persistent) {
        log.error(`Persistent request yielded a non-persistent response. This is unexpected. The callback will not be invoked.`);
        return;
      }
      const channel = new ServerBridge.PersistentChannel(this, this.#activeChannels, ref, request.abortSignal);
      request.callback(context, channel);
    }
  }

  private _receiveUpdate (update: Messaging.Message.Update.Data): void {
    const ref = update.ref;
    const channel = this.#activeChannels.get(ref);
    if (!channel) return;
    const context = new InboundMessageFromServer(update.message, PathLens.from(':', update.message.type), update.message.data, ref);
    channel.router.handleMessage(context, ...channel.args);
  }
}
export namespace ServerBridge {
  export type OnResponse = (context: Messaging.InboundMessageContext) => void;
  export interface OnOpenChannelResponse {
    (context: Messaging.InboundMessageContext, channel: PersistentChannel): void;
  }

  export class PersistentChannel {
    constructor (
      private readonly _server: ServerBridge,
      private readonly _activeChannels: Map<unknown, { router: Messaging.V2.MessageHandler; args: any[] }>,
      private readonly _ref: unknown,
      abortSignal: AbortSignal
    ) {
      const abortController = createChildAbortController(abortSignal);
      abortController.signal.addEventListener('abort', () => this._onAbort());
      this.#abortController = abortController;
    }
    readonly #abortController: AbortController;

    get abortSignal (): AbortSignal { return this.#abortController.signal; }

    setRouter<A extends any[]> (router: Messaging.V2.MessageHandler<Messaging.InboundMessageContext, A>, ...args: A): void {
      this._activeChannels.set(this._ref, { router, args });
    }

    send (message: Messaging.Message): void;
    send (messageType: string, messageData: unknown): void;
    send (arg0: Messaging.Message | string, messageData?: unknown): void {
      if (typeof arg0 === 'string') {
        this._server.send(Messaging.Message.Update(this._ref, Messaging.Message(arg0, messageData)));
      }
      else {
        this._server.send(Messaging.Message.Update(this._ref, arg0));
      }
    }

    close (): void {
      this.#abortController.abort();
    }

    private _onAbort () {
      if (this._activeChannels.delete(this._ref)) {
        this._server.send(Messaging.Message.Request.Cancel(this._ref));
      }
    }
  }
}

type RequestDetails = TransientRequestDetails | PersistentRequestDetails;
interface BaseRequestDetails {
  readonly kind: string;
  readonly abortSignal: AbortSignal;
  readonly abortListener: () => void;
}
interface TransientRequestDetails extends BaseRequestDetails {
  readonly kind: 'transient';
  readonly callback: ServerBridge.OnResponse;
}
interface PersistentRequestDetails extends BaseRequestDetails {
  readonly kind: 'persistent';
  readonly callback: ServerBridge.OnOpenChannelResponse;
}

export class InboundMessageFromServer implements Messaging.InboundMessageContext {
  constructor (
    public readonly message: Messaging.Message,
    public readonly messageType: PathLens,
    public readonly messageData: unknown,
    private readonly _ref: unknown
  ) {}

  withMessageType (messageType: PathLens, current: this): this {
    return new InboundMessageFromServer(current.message, messageType, current.messageData, current._ref) as this;
  }
}
