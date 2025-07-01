import { dispose, disposeArray, registerDisposableAsNoop, tryDispose } from '@xf-common/general/disposables';
import { returnNull, returnTrue, returnVoid } from '@xf-common/general/presets';
import { isDefined, isNotNull, isNull, isUndefined } from '@xf-common/general/type-checking';
import { DOMLocationPointer } from './dom-location-pointer';
import { DOM } from './dom-helpers';

export const isDOMNodeRange = (value: unknown): value is DOMNodeRange => value instanceof DOMNodeRange;

export class DOMNodeRange implements Disposable, Iterable<ChildNode> {
  static create (driver: DOMNodeRange.Driver<void>): DOMNodeRange;
  static create<TData> (driver: DOMNodeRange.Driver<TData>, data: TData): DOMNodeRange;
  static create (driver: DOMNodeRange.Driver<unknown>, data?: unknown) {
    return new DOMNodeRange(driver, data);
  }

  private constructor (driver: DOMNodeRange.Driver<unknown>, data?: unknown) {
    this.#driver = driver;
    this.#data = data;
  }
  readonly #driver: DOMNodeRange.Driver<unknown>;
  readonly #data: unknown;
  #isImmutable?: boolean;
  #firstActiveNode?: ChildNode | null;
  #firstActiveElement?: Element | null;
  #firstActiveHTMLElement?: HTMLElement | null;
  #firstActiveSVGElement?: SVGElement | null;
  #lastActiveNode?: ChildNode | null;
  #lastActiveElement?: Element | null;
  #lastActiveHTMLElement?: HTMLElement | null;
  #lastActiveSVGElement?: SVGElement | null;

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

  /**
   * Returns the first non-null node currently assigned to the range, or null if the range is empty or has no nodes
   * currently assigned to any of its positions.
   */
  get firstActiveNode (): ChildNode | null {
    if (isDefined(this.#firstActiveNode)) return this.#firstActiveNode;
    const node = this.#driver.firstActiveNode(this.#data);
    if (this.isImmutable) this.#firstActiveNode = node;
    return node;
  }
  /**
   * Returns the first non-null node currently assigned to the range, or throws an error if the range is empty or has no
   * nodes currently assigned to any of its positions.
   * @throws {Error} If there is no node currently assigned to any position in this range.
   */
  get firstActiveNodeRequired (): ChildNode {
    const node = this.firstActiveNode;
    if (isNull(node)) {
      throw new Error(`There are no active nodes in this range.`);
    }
    return node;
  }
  /**
   * Returns the first non-null `Element` currently assigned to the range (nodes that are not instances of
   * {@link Element} are disregarded), or null if the range is empty or has no `Element` nodes currently assigned to any
   * of position in the range.
   */
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
  /**
   * Returns the first non-null `Element` currently assigned to the range (nodes that are not instances of
   * {@link Element} are disregarded), or throws an error if the range is empty or has no `Element` nodes currently
   * assigned to any position in the range.
   * @throws {Error} If there are no `Element` nodes currently assigned to any position in this range.
   */
  get firstActiveElementRequired (): Element {
    const element = this.firstActiveElement;
    if (isNull(element)) {
      throw new Error(`There are no active nodes in this range that are instances of 'Element'.`);
    }
    return element;
  }
  /**
   * Returns the first non-null `HTMLElement` currently assigned to the range (nodes that are not instances of
   * {@link HTMLElement} are disregarded), or null if the range is empty or has no `HTMLElement` nodes currently assigned
   * to any position in the range.
   */
  get firstActiveHTMLElement (): HTMLElement | null {
    if (isDefined(this.#firstActiveHTMLElement)) return this.#firstActiveHTMLElement;
    const element = this.firstActiveNodeOfType(HTMLElement);
    if (!this.isImmutable) this.#firstActiveHTMLElement = element;
    return element;
  }
  /**
   * Returns the last non-null `HTMLElement` currently assigned to the range (nodes that are not instances of
   * {@link HTMLElement} are disregarded), or throws an error if the range is empty or has no `HTMLElement` nodes
   * currently assigned to any position in the range.
   * @throws {Error} If there are no `HTMLElement` nodes currently assigned to any position in this range.
   */
  get firstActiveHTMLElementRequired (): HTMLElement {
    const element = this.firstActiveHTMLElement;
    if (isNull(element)) {
      throw new Error(`There are no active nodes in this range that are instances of 'HTMLElement'.`);
    }
    return element;
  }

  /**
   * Returns the last non-null node currently assigned to the range, or null if the range is empty or has no nodes
   * currently assigned to any of its positions.
   */
  get lastActiveNode (): ChildNode | null {
    if (isDefined(this.#lastActiveNode)) return this.#lastActiveNode;
    const node = this.#driver.lastActiveNode(this.#data);
    if (this.isImmutable) this.#lastActiveNode = node;
    return node;
  }
  /**
   * Returns the last non-null node currently assigned to the range, or throws an error if the range is empty or has no
   * nodes currently assigned to any of its positions.
   * @throws {Error} If there is no node currently assigned to any position in this range.
   */
  get lastActiveNodeRequired (): ChildNode {
    const node = this.lastActiveNode;
    if (isNull(node)) {
      throw new Error(`There are no active nodes in this range.`);
    }
    return node;
  }
  /**
   * Returns the last non-null `Element` currently assigned to the range (nodes that are not instances of
   * {@link Element} are disregarded), or null if the range is empty or has no `Element` nodes currently assigned to any
   * of position in the range.
   */
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
  /**
   * Returns the last non-null `Element` currently assigned to the range (nodes that are not instances of
   * {@link Element} are disregarded), or throws an error if the range is empty or has no `Element` nodes currently
   * assigned to any position in the range.
   * @throws {Error} If there are no `Element` nodes currently assigned to any position in this range.
   */
  get lastActiveElementRequired (): Element {
    const element = this.lastActiveElement;
    if (isNull(element)) {
      throw new Error(`There are no active nodes in this range that are instances of 'Element'.`);
    }
    return element;
  }
  /**
   * Returns the last non-null `HTMLElement` currently assigned to the range (nodes that are not instances of
   * {@link HTMLElement} are disregarded), or null if the range is empty or has no `HTMLElement` nodes currently assigned
   * to any position in the range.
   */
  get lastActiveHTMLElement (): HTMLElement | null {
    if (isDefined(this.#lastActiveHTMLElement)) return this.#lastActiveHTMLElement;
    const element = this.lastActiveNodeOfType(HTMLElement);
    if (!this.isImmutable) this.#lastActiveHTMLElement = element;
    return element;
  }
  /**
   * Returns the last non-null `HTMLElement` currently assigned to the range (nodes that are not instances of
   * {@link HTMLElement} are disregarded), or throws an error if the range is empty or has no `HTMLElement` nodes
   * currently assigned to any position in the range.
   * @throws {Error} If there are no `HTMLElement` nodes currently assigned to any position in this range.
   */
  get lastActiveHTMLElementRequired (): HTMLElement {
    const element = this.lastActiveHTMLElement;
    if (isNull(element)) {
      throw new Error(`There are no active nodes in this range that are instances of 'HTMLElement'.`);
    }
    return element;
  }

  /**
   * Returns the first non-null node in the range for which an `instanceof` check returns true relative to the `Node`
   * constructor passed as an argument to this method. If the range is empty or has no nodes that are instances of the
   * specified `Node` constructor, `null` is returned.
   * @param Node The constructor of the node to perform `instanceof` checks against.
   * @returns The first node in the range where `instanceof`{@link Node `Node`} is `true`, or `null` otherwise.
   */
  firstActiveNodeOfType<TNode extends ChildNode> (Node: new (...args: any) => TNode): TNode | null {
    let node = this.firstActiveNode;
    while (isNotNull(node)) {
      if (node instanceof Node) return node;
      node = node.nextSibling;
    }
    return null;
  }
  /**
   * Tests if the first active node in the range is an instance of the specified `Node` constructor. If it is, it is
   * returned cast to the specified type. If there are no active nodes, or the first active node is not an instance of
   * the specified `Node` constructor, an error is thrown.
   * @param Node The constructor of the node to perform `instanceof` checks against.
   * @returns The first active node in the range cast to the specified type.
   * @throws {Error} If there are no active nodes in the range, or if the first active node is not an instance of the
   * specified `Node` constructor.
   */
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
  /**
   * Returns the last non-null node in the range for which an `instanceof` check returns true relative to the `Node`
   * constructor passed as an argument to this method. If the range is empty or has no nodes that are instances of the
   * specified `Node` constructor, `null` is returned.
   * @param Node The constructor of the node to perform `instanceof` checks against.
   * @returns The last node in the range where `instanceof`{@link Node `Node`} is `true`, or `null` otherwise.
   */
  lastActiveNodeOfType<TNode extends ChildNode> (Node: new (...args: any) => TNode): TNode | null {
    let node = this.lastActiveNode;
    while (isNotNull(node)) {
      if (node instanceof Node) return node;
      node = node.previousSibling;
    }
    return null;
  }
  /**
   * Tests if the last active node in the range is an instance of the specified `Node` constructor. If it is, it is
   * returned cast to the specified type. If there are no active nodes, or the last active node is not an instance of
   * the specified `Node` constructor, an error is thrown.
   * @param Node The constructor of the node to perform `instanceof` checks against.
   * @returns The last active node in the range cast to the specified type.
   * @throws {Error} If there are no active nodes in the range, or if the last active node is not an instance of the
   * specified `Node` constructor.
   */
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

  /**
   * Returns a generator that yields all nodes in the range.
   * @returns A generator that yields all nodes in the range.
   */
  nodes (): Generator<ChildNode>;
  /**
   * Returns a generator that yields all nodes in the range, filtered to include only those nodes that are instances of
   * the specified `ChildNode` constructor.
   * @template TNode The subtype of `ChildNode` to yield from the range.
   * @param CNode The constructor to use when testing if a node is an instance of `TNode`.
   * @returns A generator yielding any nodes in the range that are instances of the specified `ChildNode` constructor.
   */
  nodes<TNode extends ChildNode> (CNode: abstract new (...args: any) => TNode): Generator<TNode>;
  *nodes (CNode?: abstract new (...args: any) => ChildNode) {
    if (isUndefined(CNode)) return yield* this;
    for (const node of this) {
      if (node instanceof CNode!) yield node;
    }
  }

  /**
   * Returns a generator that yields all nodes in the range that are instances of {@link Element `Element`}.
   * @returns A generator that yields all elements in the range.
   */
  elements (): Generator<Element>;
  /**
   * Returns a generator that yields all nodes in the range that are instances of `TElement`.
   * @template TElement The subtype of `Element` to yield from the range.
   * @param CElement The constructor to use when testing if a node is an instance of `TElement`.
   * @returns A generator yielding any elements in the range that are instances of the `TElement` constructor.
   */
  elements<TElement extends Element = Element> (CElement?: abstract new (...args: any) => TElement): Generator<TElement>;
  *elements<TElement extends Element = Element> (CElement?: abstract new (...args: any) => TElement) {
    yield* this.nodes(CElement ?? Element) as Generator<TElement>;
  }

  /**
   * Returns a generator that yields all elements in the range that can have inline styles, i.e. those whose interface
   * extends `ElementCSSInlineStyle`.
   * @returns A generator that yields all elements in the range that can have inline styles.
   */
  styleableElements (): Generator<Element & ElementCSSInlineStyle>;
  /**
   * Returns a generator that yields all nodes in the range that are instances of `TElement` and can have inline styles.
   * @template TElement The subtype of `Element & ElementCSSInlineStyle` to yield from the range.
   * @param CElement The constructor to use when testing if a node is an instance of `TElement`.
   * @returns A generator yielding any elements in the range that are instances of `TElement` and can have inline styles.
   */
  styleableElements<TElement extends Element & ElementCSSInlineStyle = Element & ElementCSSInlineStyle> (CElement?: abstract new (...args: any) => TElement): Generator<TElement>;
  *styleableElements<TElement extends Element & ElementCSSInlineStyle = Element & ElementCSSInlineStyle> (CElement?: abstract new (...args: any) => TElement): Generator<TElement> {
    for (const element of this.elements(CElement)) {
      if (DOM.isStylableElement(element)) {
        yield element as TElement;
      }
    }
  }

  /**
   * Returns a generator that yields all nodes in the range that are instances of {@link HTMLElement `HTMLElement`}.
   * @returns A generator that yields all HTML elements in the range.
   */
  htmlElements (): Generator<HTMLElement>;
  /**
   * Returns a generator that yields all nodes in the range that are instances of `TElement`.
   * @template TElement The subtype of `HTMLElement` to yield from the range.
   * @param CElement The constructor to use when testing if a node is an instance of `TElement`.
   * @returns A generator yielding any HTML elements in the range that are instances of `TElement`.
   */
  htmlElements<TElement extends HTMLElement = HTMLElement> (CElement?: abstract new (...args: any) => TElement): Generator<TElement>;
  *htmlElements<TElement extends HTMLElement = HTMLElement> (CElement?: abstract new (...args: any) => TElement) {
    yield* this.nodes(CElement ?? HTMLElement) as Generator<TElement>;
  }

  /**
   * Returns a generator that yields all nodes in the range that are instances of {@link SVGElement `SVGElement`}.
   * @returns A generator that yields all SVG elements in the range.
   */
  svgElements (): Generator<SVGElement>;
  /**
   * Returns a generator that yields all nodes in the range that are instances of `TElement`.
   * @template TElement The subtype of `SVGElement` to yield from the range.
   * @param CElement The constructor to use when testing if a node is an instance of `TElement`.
   * @returns A generator yielding any SVG elements in the range that are instances of `TElement`.
   */
  svgElements<TElement extends SVGElement = SVGElement> (CElement?: abstract new (...args: any) => TElement): Generator<TElement>;
  *svgElements<TElement extends SVGElement = SVGElement> (CElement?: abstract new (...args: any) => TElement) {
    yield* this.nodes(CElement ?? SVGElement) as Generator<TElement>;
  }

  /**
   * Returns the first element in the range that matches the specified selector. If no element matches the selector, an
   * error is thrown.
   * @param selector The CSS selector to match against elements in the range.
   * @returns The first element in the range that matches the selector.
   */
  querySelectorRequired (selector: string): Element;
  /**
   * Returns the first element in the range that matches the specified selector. If no element matches the selector, or
   * if the first element matching the selector is not an instance of `TElement`, an error is thrown.
   * @template TElement The subtype of `Element` to be returned.
   * @param selector The CSS selector to match against elements in the range.
   * @param as The constructor to use when testing if a node matching the selector is an instance of `TElement`.
   */
  querySelectorRequired<TElement extends Element = Element> (selector: string, as: new (...args: any) => TElement): TElement;
  querySelectorRequired (selector: string, as?: new (...args: any) => Element) {
    const element = this.querySelector(selector, as!);
    if (isNull(element)) {
      throw new Error(`No element matching the selector "${selector}" was found. If querying for a class name, check that the class name is preceded by a period.`);
    }
    return element;
  }

 /**
   * Returns the first among all of the range's active elements and their respective subtrees that matches the
   * specified selector. If no element matches the selector, `null` is returned.
   * @param selector The CSS selector to match against elements in the range, and their subtrees.
   * @returns An element matching the selector, or null if no matching element is found.
   */
  querySelector (selector: string): Element | null;
  /**
   * Returns the first among all of the range's active elements and their respective subtrees that matches the specified
   * selector and is an instance of the specified element type.
   * - Each element `element` in the range is tested against the selector until a match is found. For each element:
   *   - `element.matches(selector)` is tested first (because `element.querySelector` excludes the element as a match).
   *   - `element.querySelector(selector)` is tested next if `element` itself was not a match for the selector.
   * - As soon as a match for the selector is found, if it is an instance of `TElement`, it is returned. If not, an
   *   error is thrown.
   * - If no match for the selector is found, `null` is returned.
   * @template TElement The subtype of `Element` to be returned.
   * @param selector The CSS selector to match against elements in the range, and their subtrees.
   * @param as The constructor to use when testing if a node matching the selector is an instance of `TElement`.
   */
  querySelector<TElement extends Element = Element> (selector: string, as: new (...args: any) => TElement): TElement | null;
  querySelector<TElement extends Element> (selector: string, as?: new (...args: any) => TElement) {
    let current: Element | null = this.firstActiveElement;
    while (isNotNull(current)) {
      let match: Element | null = null;
      if (current.matches(selector)) {
        match = current;
      }
      else {
        match = current.querySelector(selector);
      }

      if (isNotNull(match)) {
        if (isUndefined(as) || match instanceof as) {
          return match;
        }
        throw new Error(`The element found by the selector "${selector}" was expected to be of type ${as.name}, but was actually of type ${match.constructor.name}.`);
      }
      if (current === this.lastActiveElement!) return null;
      current = current.nextElementSibling;
    }
    return null;
  }

  /**
   * Returns a list of elements matching the specified selector.
   * @remarks
   * In order: For each element `el` in the range, `el` is appended to the array of matches if `el.matches(selector)` is
   * true. The matches returned by `el.querySelectorAll(selector)` are appended next. The final array is then returned.
   * @param selector The CSS selector to match against elements in the range, and their subtrees.
   * @returns An array of elements matching the selector.
   */
  querySelectorAll (selector: string): Element[];
  /**
   * Returns a list of elements matching the specified selector.
   * @remarks
   * In order: For each element `el` in the range, `el` is appended to the array of matches if `el.matches(selector)` is
   * true. The matches returned by `el.querySelectorAll(selector)` are appended next. The final array is then returned.
   * If any match is found that
   * @template TElement The subtype of `Element` to be returned.
   * @param selector The CSS selector to match against elements in the range, and their subtrees.
   * @param as The constructor to use when testing if a node matching the selector is an instance of `TElement`.
   */
  querySelectorAll<TElement extends Element = Element> (selector: string, as: new (...args: any) => TElement): TElement[];
  querySelectorAll<TElement extends Element> (selector: string, as?: new (...args: any) => TElement): TElement[] {
    const results: TElement[] = [];
    let current = this.firstActiveElement;
    while (isNotNull(current)) {
      if (current.matches(selector)) {
        if (isUndefined(as) || current instanceof as) {
          results.push(current as TElement);
        }
        else {
          throw new Error(`An element in this range matching the selector "${selector}" was found that was not an instance of ${as.name}.`);
        }
      }
      const list = current.querySelectorAll(selector);
      for (let i = 0; i < list.length; ++i) {
        const match = list[i];
        if (isUndefined(as) || match instanceof as) {
          results.push(match as TElement);
        }
        else {
          throw new Error(`An element in one of this range's subtrees was a match for the selector "${selector}" but was not an instance of ${as.name}.`);
        }
      }
      if (current === this.lastActiveElement) return results;
      current = current.nextElementSibling;
    }
    return results;
  }

  /**
   * Sets the value of the specified attribute on all elements currently in the range. This is a one-time operation and
   * is not retroactively applied to elements incorporated into the range after this method is called.
   * @param name The name of the attribute to set.
   * @param value The value to set the attribute to.
   */
  setAttribute (name: string, value: string): void {
    for (const element of this.elements()) {
      element.setAttribute(name, value);
    }
  }

  /**
   * Removes the specified attribute from all elements currently in the range. This is a one-time operation and is not
   * retroactively applied to elements incorporated into the range after this method is called.
   * @param name The name of the attribute to remove.
   */
  removeAttribute (name: string): void {
    for (const element of this.elements()) {
      element.removeAttribute(name);
    }
  }

  attachTo (location: DOMLocationPointer | Element): void {
    if (location instanceof Element) location = DOMLocationPointer.from(location);
    this.#driver.attachToDOM(this.#data, location);
  }

  /**
   * Removes the range from the DOM.
   */
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
