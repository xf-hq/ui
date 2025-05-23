import { returnTrue } from '@xf-common/general/presets';
import { isDefined, isUndefined } from '@xf-common/general/type-checking';
import { DOMLocationPointer } from './dom-location-pointer';
import { DOMNodeRange } from './dom-node-range';

export class HTMLTemplate {
  constructor (template: HTMLTemplateElement) {
    this.#template = template;
  }
  readonly #template: HTMLTemplateElement;

  render (): DOMNodeRange {
    return DOMNodeRange.create(RenderedRange.Driver, {
      templateElement: this.#template,
      nodes: undefined,
      location: null,
    });
  }
}
export namespace HTMLTemplate {
  export function define (html: string): HTMLTemplate {
    const template = document.createElement('template');
    template.innerHTML = html;
    return new HTMLTemplate(template);
  }

  const cache = new WeakMap<DOMNodeRange, Map<string, Element>>();
  export function extractById<TElement extends Element> (id: string, dom: DOMNodeRange): TElement;
  export function extractById<TElement extends Element> (id: string, as: new (...args: any) => TElement, dom: DOMNodeRange): TElement;
  export function extractById<TElement extends Element> (id: string, dom_or_ctor: DOMNodeRange | (new (...args: any) => TElement), maybe_dom?: DOMNodeRange): TElement {
    const [dom, ctor] = dom_or_ctor instanceof DOMNodeRange ? [dom_or_ctor, undefined] : [maybe_dom!, dom_or_ctor];
    let idcache = cache.get(dom);
    if (isUndefined(idcache)) cache.set(dom, idcache = new Map());
    else {
      const element = idcache.get(id);
      if (isDefined(element)) return element as TElement;
    }
    const element = dom.querySelectorRequired(`#${CSS.escape(id)}`, ctor!);
    element.removeAttribute('id');
    idcache.set(id, element);
    return element;
  }

  export function extractByIdAsLocation (id: string, dom: DOMNodeRange): DOMLocationPointer {
    const element = extractById(id, dom);
    return DOMLocationPointer.from(element);
  }

  export function extractByIdAsNodeRange (id: string, dom: DOMNodeRange): DOMNodeRange {
    const element = extractById(id, dom);
    return DOMNodeRange.FromStaticNode(element);
  }
}

namespace RenderedRange {
  interface Data {
    readonly templateElement: HTMLTemplateElement;
    location: DOMLocationPointer | null;
    nodes: ChildNode[] | undefined;
  }
  export const Driver: DOMNodeRange.Driver<Data> = {
    isImmutableRange: returnTrue,
    firstActiveNode (data) {
      const nodes = getNodes(data);
      return nodes.length === 0 ? null : nodes[0];
    },
    lastActiveNode (data) {
      const nodes = getNodes(data);
      return nodes.length === 0 ? null : nodes[nodes.length - 1];
    },
    attachedLocation: (data) => data.location,
    attachToDOM (data, location) {
      data.location = location;
      const nodes = getNodes(data);
      location.appendEach(nodes);
    },
    removeFromDOM (data) {
      if (isUndefined(data.nodes)) return;
      const nodes = getNodes(data);
      for (const node of nodes) {
        node.remove();
      }
    },
    dispose (data) {
      data.nodes = undefined;
    },
  };
  function getNodes (data: Data) {
    let nodes = data.nodes;
    if (isUndefined(nodes)) {
      const fragment = document.importNode(data.templateElement.content, true);
      nodes = Array.from(fragment.childNodes);
      data.nodes = nodes;
    }
    return nodes;
  }
}
