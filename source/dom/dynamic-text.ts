import { ValueSource } from '@xf-common/dynamic';
import type { DOMContext } from './dom-context';
import { DOMLocationPointer, isDOMLocationPointer } from './dom-location-pointer';
import { DOMNodeRange, isDOMNodeRange } from './dom-node-range';

export function appendDynamicText (location: DOMContext | DOMLocationPointer | DOMNodeRange | Element, source: ValueSource<Primitive>): Disposable {
  return source.subscribe(new ValueReceiver(location));
}

class ValueReceiver implements ValueSource.Receiver<Primitive, []> {
  #textNode!: Text;

  constructor (private readonly location: DOMContext | DOMLocationPointer | DOMNodeRange | Element) {}

  init (sub: ValueSource.Subscription<Primitive>): void {
    this.#textNode = document.createTextNode(String(sub.value));
    if (isDOMLocationPointer(this.location)) this.location.append(this.#textNode);
    else if (isDOMNodeRange(this.location)) this.location.lastActiveElementRequired.appendChild(this.#textNode);
    else if (this.location instanceof Element) this.location.appendChild(this.#textNode);
    else this.location.domInsertionLocation.append(this.#textNode);
  }

  event (value: Primitive): void {
    this.#textNode.nodeValue = String(value);
  }
}
