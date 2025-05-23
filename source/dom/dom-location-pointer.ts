import { returnNull } from '@xf-common/general/presets';
import { isFunction, isNotNull, isNull, isUndefined } from '@xf-common/general/type-checking';

export const isDOMLocationPointer = (target: unknown): target is DOMLocationPointer => target instanceof DOMLocationPointer;

export class DOMLocationPointer {
  static from (target: DOMLocationPointer | DOMLocationPointer.Props | Element): DOMLocationPointer {
    if (target instanceof DOMLocationPointer) return target;
    if (target instanceof Element) return new DOMLocationPointer(target, returnNull, returnNull, appendAsLastChild);

    const getPreviousOuterSibling = fromNodePointerProp(target.previousOuterSibling);
    const getNextOuterSibling = fromNodePointerProp(target.nextOuterSibling);
    let insert: DOMLocationPointer.Append;
    if (isNotNull(getNextOuterSibling)) insert = appendBeforeNextOuterSibling;
    else if (isNotNull(getPreviousOuterSibling)) insert = appendAfterPreviousSibling;
    else insert = appendAsLastChild;
    return new DOMLocationPointer(
      target.parentElement,
      getPreviousOuterSibling ?? returnNull,
      getNextOuterSibling ?? returnNull,
      insert
    );
  }

  constructor (
    parentElement: Element,
    getPreviousOuterSibling: DOMLocationPointer.ChildNodeGetter,
    getNextOuterSibling: DOMLocationPointer.ChildNodeGetter,
    append: DOMLocationPointer.Append,
  ) {
    this.#parentElement = parentElement;
    this.#getPreviousOuterSibling = getPreviousOuterSibling;
    this.#getNextOuterSibling = getNextOuterSibling;
    this.#append = append;
  }
  readonly #parentElement: Element;
  readonly #getPreviousOuterSibling: DOMLocationPointer.ChildNodeGetter;
  readonly #getNextOuterSibling: DOMLocationPointer.ChildNodeGetter;
  readonly #append: DOMLocationPointer.Append;

  get parentElement () { return this.#parentElement; }
  get previousOuterSibling () { return isNull(this.#getPreviousOuterSibling) ? null : this.#getPreviousOuterSibling(); }
  get nextOuterSibling () { return isNull(this.#getNextOuterSibling) ? null : this.#getNextOuterSibling(); }

  append (node: ChildNode): void {
    this.#append(this, node);
  }
  appendEach (nodes: Iterable<ChildNode> | ArrayLike<ChildNode>): void {
    if ('length' in nodes) {
      for (let i = 0; i < nodes.length; ++i) {
        this.#append(this, nodes[i]);
      }
    }
    else {
      for (const node of nodes) {
        this.#append(this, node);
      }
    }
  }
}
export namespace DOMLocationPointer {
  export type ChildNodeGetter = () => ChildNode | null;
  export type Append = (location: DOMLocationPointer, nodeToAppend: ChildNode) => void;

  export interface Props {
    parentElement: Element;
    previousOuterSibling?: Props.NodeRef | null;
    nextOuterSibling?: Props.NodeRef | null;
  }
  export namespace Props {
    export type NodeRef = ChildNode | ChildNodeGetter | null;
  }
}

function fromNodePointerProp (arg: DOMLocationPointer.Props.NodeRef | undefined): DOMLocationPointer.ChildNodeGetter | null {
  if (isUndefined(arg)) return null;
  if (isFunction(arg)) return arg;
  return () => arg;
}

function appendAsLastChild (location: DOMLocationPointer, nodeToAppend: ChildNode): void {
  location.parentElement.appendChild(nodeToAppend);
}
function appendBeforeNextOuterSibling (location: DOMLocationPointer, nodeToAppend: ChildNode): void {
  location.parentElement.insertBefore(nodeToAppend, location.nextOuterSibling);
}
function appendAfterPreviousSibling (location: DOMLocationPointer, nodeToAppend: ChildNode): void {
  const parentElement = location.parentElement;
  const previousNode = location.previousOuterSibling;
  if (isNull(previousNode)) parentElement.prepend(nodeToAppend);
  else {
    const nextNode = previousNode.nextSibling;
    if (isNull(nextNode)) parentElement.appendChild(nodeToAppend);
    else parentElement.insertBefore(nodeToAppend, nextNode);
  }
}
