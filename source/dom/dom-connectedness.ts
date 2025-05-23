import { Subscribable } from '@xf-common/dynamic';
import { AssociativeWeakSet } from '@xf-common/facilities/weak-reference-management';
import { isUndefined } from '@xf-common/general/type-checking';
import { ConnectionObserver, type ConnectionRecord } from '@wessberg/connection-observer';

export namespace DOMConnectedness {
  export type Subscriber = Subscribable.Subscriber<[isConnected: boolean], []>;

  export function observe (node: Node, subscriber: Subscriber): Disposable {
    let source = sources.get(node);
    if (isUndefined(source)) {
      let observer: ConnectionObserver;
      source = new Subscribable.Controller({
        online () {
          observer = new ConnectionObserver(onConnectionEvent);
          observer.observe(node);
        },
        offline () {
          observer.disconnect();
        },
      });
      sources.set(node, source);
    }
    return source.subscribe(subscriber);
  }

  const sources = new AssociativeWeakSet<Node, Subscribable.Controller<[isConnected: boolean]>>();

  function onConnectionEvent (entries: ConnectionRecord[]) {
    for (const { connected, target } of entries) {
      const source = sources.get(target);
      if (source) source.signal(connected);
    }
  }
}
