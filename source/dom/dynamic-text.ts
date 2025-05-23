import type { ValueSource } from '@xf-common/dynamic';
import type { DOMContext } from './dom-context';
import { DOMLocationPointer, isDOMLocationPointer } from './dom-location-pointer';
import { DOMNodeRange, isDOMNodeRange } from './dom-node-range';

export function appendDynamicText (location: DOMContext | DOMLocationPointer | DOMNodeRange | Element, source: ValueSource<Primitive>): Disposable {
  return source.subscribe((sub) => {
    const textNode = document.createTextNode(String(sub.value));
    if (isDOMLocationPointer(location)) location.append(textNode);
    else if (isDOMNodeRange(location)) location.lastActiveElementRequired.appendChild(textNode);
    else if (location instanceof Element) location.appendChild(textNode);
    else location.domInsertionLocation.append(textNode);
    return (value) => textNode.nodeValue = String(value);
  });
}
