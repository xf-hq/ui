import { dispose, disposeArray, registerDisposableAsNoop, tryDispose } from '@xf-common/general/disposables';
import { returnNull, returnTrue, returnVoid } from '@xf-common/general/presets';
import { isDefined, isNotNull, isNull, isUndefined } from '@xf-common/general/type-checking';
import { DOMLocationPointer } from './dom-location-pointer';

export const isDOMNodeRange = (value: unknown): value is DOMNodeRange => value instanceof DOMNodeRange;

export class DOMNodeRange implements Disposable, Iterable<ChildNode> {
  static create (driver: DOMNodeRange.Driver<void>): DOMNodeRange;
  static create<TData> (driver: DOMNodeRange.Driver<TData>, data: TData): DOMNodeRange;
  static create (driver: DOMNodeRange.Driver<unknown>, data?: unknown) { return new DOMNodeRange(driver, data); }
  private constructor (driver: DOMNodeRange.Driver<unknown>, data?: unknown) {
    this.#driver = driver;
    this.#data = data;
  }
  readonly #driver: DOMNodeRange.Driver<unknown>;
  readonly #data: unknown;
  #isImmutable?: boolean;
  #firstActiveNode?: ChildNode | null;
  #lastActiveNode?: ChildNode | null;
  #firstActiveElement?: Element | null;
  #lastActiveElement?: Element | null;

  get isImmutable (): boolean {
    return this.#isImmutable ??= this.#driver.isImmutableRange(this.#data);
  }
  get isAttached (): boolean {
    return isNotNull(this.attachedLocation);
  }
  get isConnectedToDocument (): boolean {
    return this.attachedLocation?.parentElement.isConnected ?? false;
  }
  get attachedLocation (): DOMLocationPointer | null {
    return this.#driver.attachedLocation(this.#data);
  }
  get firstActiveNode (): ChildNode | null {
    if (isDefined(this.#firstActiveNode)) return this.#firstActiveNode;
    const node = this.#driver.firstActiveNode(this.#data);
    if (this.isImmutable) this.#firstActiveNode = node;
    return node;
  }
  get lastActiveNode (): ChildNode | null {
    if (isDefined(this.#lastActiveNode)) return this.#lastActiveNode;
    const node = this.#driver.lastActiveNode(this.#data);
    if (this.isImmutable) this.#lastActiveNode = node;
    return node;
  }
  get firstActiveNodeRequired (): ChildNode {
    const node = this.firstActiveNode;
    if (isNull(node)) {
      throw new Error(`There are no active nodes in this range.`);
    }
    return node;
  }
  get lastActiveNodeRequired (): ChildNode {
    const node = this.lastActiveNode;
    if (isNull(node)) {
      throw new Error(`There are no active nodes in this range.`);
    }
    return node;
  }
  get firstActiveElement (): Element | null {
    if (isDefined(this.#firstActiveElement)) return this.#firstActiveElement;
    let node = this.firstActiveNode;
    let last: ChildNode | null;
    while (isNotNull(node)) {
      if (node instanceof Element) break;
      if (node === (last ??= this.lastActiveNode!)) {
        node = null;
        break;
      }
      node = node.nextSibling;
    }
    return this.#firstActiveElement = node;
  }
  get lastActiveElement (): Element | null {
    if (isDefined(this.#lastActiveElement)) return this.#lastActiveElement;
    let node = this.lastActiveNode;
    let first: ChildNode | null;
    while (isNotNull(node)) {
      if (node instanceof Element) break;
      if (node === (first ??= this.firstActiveNode!)) {
        node = null;
        break;
      }
      node = node.previousSibling;
    }
    return this.#lastActiveElement = node;
  }
  get firstActiveElementRequired (): Element {
    const element = this.firstActiveElement;
    if (isNull(element)) {
      throw new Error(`There are no active elements in this range.`);
    }
    return element;
  }
  get firstActiveHTMLElementRequired (): HTMLElement {
    const element = this.firstActiveElementRequired;
    if (!(element instanceof HTMLElement)) {
      throw new Error(`The first active element is not an instance of HTMLElement.`);
    }
    return element;
  }
  get lastActiveElementRequired (): Element {
    const element = this.lastActiveElement;
    if (isNull(element)) {
      throw new Error(`There are no active elements in this range.`);
    }
    return element;
  }
  get lastActiveHTMLElementRequired (): HTMLElement {
    const element = this.lastActiveElementRequired;
    if (!(element instanceof HTMLElement)) {
      throw new Error(`The last active element is not an instance of HTMLElement.`);
    }
    return element;
  }

  firstActiveNodeAs<TNode extends ChildNode> (Node: new (...args: any) => TNode): TNode {
    const node = this.firstActiveNode;
    if (isNull(node)) {
      throw new Error(`There are no active nodes in this range.`);
    }
    if (!(node instanceof Node)) {
      throw new Error(`The first active node is not an instance of ${Node.name}.`);
    }
    return node;
  }
  lastActiveNodeAs<TNode extends ChildNode> (Node: new (...args: any) => TNode): TNode {
    const node = this.lastActiveNode;
    if (isNull(node)) {
      throw new Error(`There are no active nodes in this range.`);
    }
    if (!(node instanceof Node)) {
      throw new Error(`The last active node is not an instance of ${Node.name}.`);
    }
    return node;
  }

  nodes (): Generator<ChildNode>;
  nodes (CNode: abstract new (...args: any) => ChildNode): Generator<ChildNode>;
  *nodes (CNode?: abstract new (...args: any) => ChildNode) {
    if (isUndefined(CNode)) return yield* this;
    for (const node of this) {
      if (node instanceof CNode!) yield node;
    }
  }

  *elements<TElement extends Element = Element> (CElement?: abstract new (...args: any) => TElement): Generator<TElement> {
    yield* this.nodes(CElement ?? Element) as Generator<TElement>;
  }

  querySelectorRequired<TElement extends Element = Element> (selector: string, as?: new (...args: any) => TElement): TElement {
    const element = this.querySelector(selector, as);
    if (isNull(element)) {
      throw new Error(`No element matching the selector "${selector}" was found. If querying for a class name, check that the class name is preceded by a period.`);
    }
    return element as TElement;
  }

  querySelector<TElement extends Element = Element> (selector: string, as?: new (...args: any) => TElement): TElement | null {
    let lastNode: ChildNode;
    let currentNode = this.firstActiveNode;
    while (isNotNull(currentNode)) {
      if (currentNode instanceof Element) {
        if (currentNode.matches(selector)) return currentNode as TElement;
        const result = currentNode.querySelector(selector);
        if (isNotNull(result)) {
          if (isDefined(as) && !(result instanceof as)) {
            throw new Error(`The element found by the selector "${selector}" was expected to be of type ${as.name}, but was actually of type ${result.constructor.name}.`);
          }
          return result as TElement;
        }
      }
      if (currentNode === (lastNode ??= this.lastActiveNode!)) return null;
      currentNode = currentNode.nextSibling;
    }
    return null;
  }

  querySelectorAll<TElement extends Element = Element> (selector: string): TElement[] {
    const results: TElement[] = [];
    let lastNode: ChildNode;
    let currentNode = this.firstActiveNode;
    while (isNotNull(currentNode)) {
      if (currentNode instanceof Element) {
        if (currentNode.matches(selector)) results.push(currentNode as TElement);
        const list = currentNode.querySelectorAll(selector);
        for (let i = 0; i < list.length; ++i) {
          results.push(list[i] as TElement);
        }
      }
      if (currentNode === (lastNode ??= this.lastActiveNode!)) return results;
      currentNode = currentNode.nextSibling;
    }
    return results;
  }

  setAttribute (name: string, value: string): void {
    for (const element of this.elements()) {
      element.setAttribute(name, value);
    }
  }

  removeAttribute (name: string): void {
    for (const element of this.elements()) {
      element.removeAttribute(name);
    }
  }

  attachTo (location: DOMLocationPointer | Element): void {
    if (location instanceof Element) location = DOMLocationPointer.from(location);
    this.#driver.attachToDOM(this.#data, location);
  }

  remove (): void {
    this.#driver.removeFromDOM(this.#data);
  }

  removeAndDispose (): void {
    this.remove();
    dispose(this);
  }

  *[Symbol.iterator] () {
    let node = this.firstActiveNode;
    while (isNotNull(node)) {
      yield node;
      if (node === this.lastActiveNode) return;
      node = node.nextSibling;
    }
  }

  #disposed = false;
  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    registerDisposableAsNoop(this);
    this.#driver.dispose(this.#data);
  }
}
export namespace DOMNodeRange {
  export interface Driver<TData> {
    isImmutableRange (data: TData): boolean;
    firstActiveNode (data: TData): ChildNode | null;
    lastActiveNode (data: TData): ChildNode | null;
    attachedLocation (data: TData): DOMLocationPointer | null;
    attachToDOM (data: TData, location: DOMLocationPointer): void;
    removeFromDOM (data: TData): void;
    dispose (data: TData): void;
  }
  export interface Props {
    readonly firstActiveNode: () => ChildNode | null;
    readonly remove: () => void;
    readonly disposalTarget: LooseDisposable;
  }
  export type EventArgs =
    | [eventType: 'document:attached']
    | [eventType: 'document:detached'];

  export const Empty: DOMNodeRange = DOMNodeRange.create({
    isImmutableRange: returnTrue,
    firstActiveNode: returnNull,
    lastActiveNode: returnNull,
    attachedLocation: returnNull,
    attachToDOM: returnVoid,
    removeFromDOM: returnVoid,
    dispose: returnVoid,
  });

  export function FromStaticNode (node: ChildNode, currentlyAttachedToLocation: DOMLocationPointer | null = null, disposalTarget?: LooseDisposable): DOMNodeRange {
    return DOMNodeRange.create(FromStaticNode.Driver, { node, location: currentlyAttachedToLocation, disposalTarget });
  }
  export namespace FromStaticNode {
    export interface Data {
      readonly node: ChildNode;
      location: DOMLocationPointer | null;
      disposalTarget: LooseDisposable;
    }
    export const Driver: Driver<Data> = {
      isImmutableRange: returnTrue,
      firstActiveNode: (data) => data.node,
      lastActiveNode: (data) => data.node,
      attachedLocation: (data) => data.location,
      attachToDOM: (data, location) => {
        data.location = location;
        location.append(data.node);
      },
      removeFromDOM: (data) => {
        data.location = null;
        data.node.remove();
      },
      dispose: (data) => tryDispose(data.disposalTarget),
    };
  }

  export function FromStaticNodeArray (nodes: ChildNode[], location: DOMLocationPointer | null = null, disposalTarget?: LooseDisposable): DOMNodeRange {
    return DOMNodeRange.create(FromStaticNodeArray.Driver, { nodes, location, disposalTarget });
  }
  export namespace FromStaticNodeArray {
    export interface Data {
      readonly nodes: ChildNode[];
      location: DOMLocationPointer | null;
      disposalTarget: LooseDisposable;
    }
    export const Driver: Driver<Data> = {
      isImmutableRange: returnTrue,
      firstActiveNode: (data) => data.nodes.length === 0 ? null : data.nodes[0],
      lastActiveNode: (data) => data.nodes.length === 0 ? null : data.nodes[data.nodes.length - 1],
      attachedLocation: (data) => data.location,
      attachToDOM: (data, location) => {
        data.location = location;
        location.appendEach(data.nodes);
      },
      removeFromDOM: (data) => {
        data.location = null;
        for (let i = 0; i < data.nodes.length; ++i) {
          data.nodes[i].remove();
        }
      },
      dispose: (data) => tryDispose(data.disposalTarget),
    };
  }

  export function ConcatAll<T> (ranges: DOMNodeRange[], location: DOMLocationPointer | null = null, disposalTarget?: LooseDisposable): DOMNodeRange {
    let isImmutable = true;
    let firstActiveNode: ChildNode | null | undefined;
    let lastActiveNode: ChildNode | null | undefined;
    for (let i = 0; i < ranges.length; ++i) {
      const range = ranges[i];
      if (range.isImmutable) {
        if (isUndefined(firstActiveNode) && isNotNull(range.firstActiveNode)) {
          firstActiveNode = range.firstActiveNode;
        }
        if (isUndefined(lastActiveNode) && isNotNull(range.lastActiveNode)) {
          lastActiveNode = range.lastActiveNode;
        }
        if (isNull(firstActiveNode) !== isNull(lastActiveNode)) {
          throw new Error(`Invalid range: firstActiveNode and lastActiveNode must both be null or both be non-null.`);
        }
      }
      else {
        isImmutable = false;
        lastActiveNode = undefined;
        break;
      }
    }
    return DOMNodeRange.create(ConcatAll.Driver, { ranges, isImmutable, location, disposalTarget, firstActiveNode, lastActiveNode });
  }
  export namespace ConcatAll {
    export interface Data {
      readonly ranges: DOMNodeRange[];
      readonly isImmutable: boolean;
      location: DOMLocationPointer | null;
      disposalTarget: LooseDisposable;
      firstActiveNode: ChildNode | null | undefined;
      lastActiveNode: ChildNode | null | undefined;
    }
    function findNextActiveNode (data: Data, rangesStartIndex: number): ChildNode | null {
      for (let i = rangesStartIndex; i < data.ranges.length; ++i) {
        const node = data.ranges[i].firstActiveNode;
        if (isNotNull(node)) return node;
      }
      return null;
    }
    export const Driver: Driver<Data> = {
      isImmutableRange: (data) => data.isImmutable,
      firstActiveNode (data) {
        if (isDefined(data.firstActiveNode)) return data.firstActiveNode;
        return findNextActiveNode(data, 0);
      },
      lastActiveNode (data) {
        if (isDefined(data.lastActiveNode)) return data.lastActiveNode;
        for (let i = data.ranges.length - 1; i >= 0; i--) {
          const node = data.ranges[i].lastActiveNode;
          if (isNotNull(node)) return node;
        }
        return null;
      },
      attachedLocation: (data) => data.location,
      attachToDOM (data, location) {
        data.location = location;
        for (let i = data.ranges.length - 1; i >= 0; --i) {
          data.ranges[i].attachTo(location);
          if (i > 0) location = DOMLocationPointer.from({
            parentElement: location.parentElement,
            nextOuterSibling: () => findNextActiveNode(data, i),
          });
        }
      },
      removeFromDOM (data) {
        data.location = null;
        for (const range of data.ranges) {
          range.remove();
        }
      },
      dispose (data) {
        disposeArray(data.ranges);
        tryDispose(data.disposalTarget);
      },
    };
  }
}
