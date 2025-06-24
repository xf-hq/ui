import { PathReader } from '@xf-common/facilities/path-reader';
import { IdGenerator } from '@xf-common/general/ids-and-caching';
import { isUndefined } from '@xf-common/general/type-checking';
import { Messaging } from '@xf-common/network/messaging';
import type { WebSocketClient } from './websocket-client';

export class ServerBridge {
  constructor (public readonly network: WebSocketClient) {}
  readonly #pendingRequests = new Map<unknown, (context: Messaging.InboundMessageContext) => void>();
  readonly #responseHandler: Messaging.MessageHandler = { handleMessage: (context) => this.receiveResponse(context) };

  get responseHandler (): Messaging.MessageHandler { return this.#responseHandler; }

  send<T extends Messaging.Message> (message: T): void {
    this.network.send(message);
  }

  initiateRequest (abort: AbortSignal, message: Messaging.Message, callback: (context: Messaging.InboundMessageContext) => void): void {
    const id = IdGenerator.global();
    this.#pendingRequests.set(id, callback);
    this.send(Messaging.Message.Request(id, message));
    abort.addEventListener('abort', () => this.send(Messaging.Message.Request.Cancel(id)));
  }

  private receiveResponse (context: Messaging.InboundMessageContext) {
    const response = context.messageData as Messaging.Message.Response.Data;
    const ref = response.ref;
    const callback = this.#pendingRequests.get(ref);
    if (isUndefined(callback)) return; // The requester may have already disposed of the request locally.
    this.#pendingRequests.delete(ref);
    callback({
      messageType: PathReader.from(response.message.type),
      messageData: response.message.data,
    });
  }
}
