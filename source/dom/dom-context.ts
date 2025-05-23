import type { Compositional } from '@xf-common/facilities/compositional/compositional';
import { Context } from '@xf-common/facilities/context';
import { isArray, isDefined, isString } from '@xf-common/general/type-checking';
import { DOMComponent, isDOMComponent } from './dom-component';
import { DOM } from './dom-helpers';
import { DOMLocationPointer, isDOMLocationPointer } from './dom-location-pointer';
import { DOMNodeRange, isDOMNodeRange } from './dom-node-range';
import { DOMView, isDOMView } from './dom-view';
import { HTMLTemplate } from './html-template';
import type { ManagedStylesheet } from './managed-stylesheet';

export interface DOMContext<TComponents extends DOMComponent.Components = DOMComponent.Components> extends Compositional.ExtractInterface<typeof DOMContext.InterfaceType> {
  renderComponent<K extends keyof TComponents> (componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
  renderComponentInto<K extends keyof TComponents> (selector: string, componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
  renderComponentDetached<K extends keyof TComponents> (componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
  renderComponentToSlotById<K extends keyof TComponents> (slotId: string, componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
}
export namespace DOMContext {
  const _domActiveRange_ = Symbol('DOMContext.DOMActiveRange');
  const _insertionLocation_ = Symbol('DOMContext.InsertionLocation');
  const _stylesheet_ = Symbol('DOMContext.Stylesheet');
  const _detachedByDefault_ = Symbol('DOMContext.DetachedByDefault');

  type SpecialMethods<TComponents extends DOMComponent.Components> = Pick<DOMContext<TComponents>, 'renderComponent' | 'renderComponentToSlotById' | 'renderComponentInto' | 'renderComponentDetached'>;

  export type InterfaceType = typeof InterfaceType;
  export const InterfaceType = Context.Immediate.InterfaceType.extend(($Class) => (
    class DOMContext<TComponents extends DOMComponent.Components = DOMComponent.Components> extends $Class.EntityInstance implements SpecialMethods<TComponents> {
      private [_domActiveRange_]?: DOMNodeRange;
      private [_insertionLocation_]?: DOMLocationPointer;
      private [_stylesheet_]?: ManagedStylesheet;
      private [_detachedByDefault_]?: boolean;

      get domActiveRange () { return this[_domActiveRange_] ??= this.query(DOMContextQueryTypes.ActiveDOMRange); }
      get domInsertionLocation () { return this[_insertionLocation_] ??= this.unbind(DOMContextBindings.DOM.InsertionLocation); }
      get stylesheet () { return this[_stylesheet_] ??= this.unbind(DOMContextBindings.StyleSheet.Driver); }
      protected get detachedByDefault () { return this[_detachedByDefault_] ??= this.unbind(DOMContextBindings.DOM.DetachedByDefault); }

      bindStyleSheet (stylesheet: ManagedStylesheet): this {
        return this.bind(DOMContextBindings.StyleSheet, stylesheet);
      }

      bindDOMRange (dom: ChildNode | DOMNodeRange): this {
        if (!isDOMNodeRange(dom)) dom = DOMNodeRange.FromStaticNode(dom);
        return this.bind(DOMContextBindings.DOM.ActiveRange, dom);
      }

      bindDOMLocation (location: Element | DOMNodeRange | DOMLocationPointer | DOMLocationPointer.Props | string): this {
        if (isString(location)) location = this.domActiveRange.querySelectorRequired(location);
        return bindDOMInsertionLocation(this, location);
      }

      bindDOM (dom: Element | DOMNodeRange | DOMView | string): this {
        if (isString(dom)) dom = this.domActiveRange.querySelectorRequired(dom);
        else if (isDOMView(dom)) dom = dom.dom;
        return this.bindDOMRange(dom).bindDOMLocation(dom);
      }

      /**
       * Extracts the element with the specified id attribute from the active DOM node range, removes its id attribute,
       * then binds to this context (a) a new active DOM node range with the extracted element as its sole member, and (b)
       * a new active DOM insertion location with the element as the parent element thereof. The newly bound context is
       * then returned.
       */
      bindDOMTemplateSlotById (id: string): this {
        const element = HTMLTemplate.extractById(id, this.domActiveRange);

        // TODO: If the slot id was referenced earlier, the id attribute will have been removed from the element to
        // prevent duplicate ids from existing in the DOM. After the first extraction, a cached reference matching the
        // id to the element should be stored somewhere.

        // this.tryUnbind(DOMComponent.RenderingContext.Driver)
        return this
          .bind(DOMContextBindings.TemplateSlot, { id })
          .bindDOMRange(DOMNodeRange.FromStaticNode(element))
          .bindDOMLocation(element);
      }

      private _render<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, target: DOMComponent.OrNS<TContext, TArgs, TView>, args: TArgs): TView {
        const component = isDOMComponent(target) ? target : target.Component;
        const context = this.bind(DOMContextBindings.RenderComponent, { component });
        return component.render(context, ...args) as TView;
      }

      renderDetached<TContext extends DOMContext, TTarget extends DOMComponent.OrNS> (this: TContext, target: TTarget, ...args: DOMComponent.OrNS.InferArgs<TTarget>): DOMComponent.OrNS.InferView<TTarget>;
      renderDetached<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs): TView;
      renderDetached<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs) {
        return this
          .bind(DOMContextBindings.DOM.DetachedByDefault, true)
          ._render(target, args);
      }

      render<TContext extends DOMContext, TTarget extends DOMComponent.OrNS> (this: TContext, target: TTarget, ...args: DOMComponent.OrNS.InferArgs<TTarget>): DOMComponent.OrNS.InferView<TTarget>;
      render<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs): TView;
      render<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs) {
        const view = this._render(target, args);
        if (!this.detachedByDefault) {
          view.dom.attachTo(this.domInsertionLocation);
        }
        return view;
      }
      renderText (text: unknown = ''): DOMView.StaticTextNode {
        const textNode = document.createTextNode(String(text));
        this.domInsertionLocation.append(textNode);
        return DOMView.StaticTextNode(textNode);
      }
      renderHTML (html: string): DOMNodeRange {
        const dom = HTMLTemplate.define(html).render();
        dom.attachTo(this.domInsertionLocation);
        return dom;
      }
      renderComponent<K extends keyof TComponents> (componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
      renderComponent (componentIdentifier: any, ...args: any[]) {
        const binding = this.unbind(DOMContextBindings.RenderComponent.Driver);
        const target = DOMComponent.getComponentOf(binding.component, componentIdentifier);
        return this.render(target, ...args);
      }
      renderComponentDetached<K extends keyof TComponents> (componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
      renderComponentDetached (componentIdentifier: any, ...args: any[]) {
        const binding = this.unbind(DOMContextBindings.RenderComponent.Driver);
        const target = DOMComponent.getComponentOf(binding.component, componentIdentifier);
        return this.renderDetached(target, ...args);
      }

      renderInto<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, selector: string, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs): TView {
        return this.bindDOM(selector).render(target, ...args);
      }
      renderTextInto (selector: string, text: unknown = ''): DOMView.StaticTextNode {
        return this.bindDOM(selector).renderText(text);
      }
      renderHTMLInto (selector: string, html: string): DOMNodeRange {
        return this.bindDOM(selector).renderHTML(html);
      }
      renderComponentInto<K extends keyof TComponents> (selector: string, componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]> {
        return this.bindDOM(selector).renderComponent(componentIdentifier, ...args);
      }

      renderToSlotById<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, id: string, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs): TView {
        return this.bindDOMTemplateSlotById(id).render(target, ...args);
      }
      renderTextToSlotById (id: string, text: unknown = ''): DOMView.StaticTextNode {
        return this.bindDOMTemplateSlotById(id).renderText(text);
      }
      renderHTMLToSlotById (id: string, html: string): DOMNodeRange {
        return this.bindDOMTemplateSlotById(id).renderHTML(html);
      }
      renderComponentToSlotById<K extends keyof TComponents> (slotId: string, componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]> {
        return this.bindDOMTemplateSlotById(slotId).renderComponent(componentIdentifier, ...args);
      }

      removeElementById (id: string): void {
        const element = HTMLTemplate.extractById(id, this.domActiveRange);
        element.remove();
      }

      renderEach<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, branches: DOMComponent<TContext, TArgs, TView>[], ...args: TArgs): DOMView.StaticBranchList<TView>;
      renderEach<TContext extends DOMContext, TArgs extends unknown[], T extends Record<string, DOMComponent<TContext, TArgs, DOMView>>> (this: TContext, branches: T, ...args: TArgs): DOMView.StaticBranchRecord<{ [K in SRecord.KeyOf<T>]: DOMComponent.InferView<T[K]> }>;
      renderEach<TContext extends DOMContext, TArgs extends unknown[]> (this: TContext, branches: Record<string, DOMComponent<TContext, TArgs, DOMView>> | DOMComponent<TContext, TArgs, DOMView>[], ...args: TArgs) {
        if (isArray(branches)) {
          const branchRootContext = this.bind(DOMContextBindings.BranchRoot, { branchCount: branches.length, branchNames: null });
          let branchContext = branchRootContext;
          let tailingRange: DOMNodeRange = DOMNodeRange.Empty;
          const views: DOMView[] = [];
          for (let i = branches.length - 1; i >= 0; --i) {
            const branch = branches[i];
            const view = branchContext
              .bind(DOMContextBindings.Branch, { index: i, name: null })
              .render(branch, ...args);
            views.push(view);
            if (i > 0) {
              tailingRange = DOMNodeRange.ConcatAll([view.dom, tailingRange]);
              branchContext = branchRootContext.bindDOMLocation({
                parentElement: this.domInsertionLocation.parentElement,
                nextOuterSibling: () => tailingRange.firstActiveNode,
              });
            }
          }
          views.reverse();
          return DOMView.StaticBranchList(views);
        }
        else {
          const branchNames = Object.keys(branches);
          const branchRootContext = this.bind(DOMContextBindings.BranchRoot, { branchCount: branchNames.length, branchNames });
          let branchContext = branchRootContext;
          let tailingRange: DOMNodeRange = DOMNodeRange.Empty;
          const views: Record<string, DOMView> = {};
          for (let i = branchNames.length - 1; i >= 0; --i) {
            const name = branchNames[i];
            const branch = branches[name];
            const view = branchContext
              .bind(DOMContextBindings.Branch, { index: i, name })
              .render(branch, ...args);
            views[name] = view;
            if (i > 0) {
              tailingRange = DOMNodeRange.ConcatAll([view.dom, tailingRange]);
              branchContext = branchRootContext.bindDOMLocation({
                parentElement: this.domInsertionLocation.parentElement,
                nextOuterSibling: () => tailingRange.firstActiveNode,
              });
            }
          }
          return DOMView.StaticBranchRecord(views);
        }
      }

      extractById<TElement extends Element> (id: string, as?: new (...args: any) => TElement): TElement {
        return isDefined(as)
          ? HTMLTemplate.extractById(id, as, this.domActiveRange)
          : HTMLTemplate.extractById(id, this.domActiveRange);
      }
      extractByIdAsLocation (id: string): DOMLocationPointer {
        return HTMLTemplate.extractByIdAsLocation(id, this.domActiveRange);
      }
      extractByIdAsNodeRange (id: string): DOMNodeRange {
        return HTMLTemplate.extractByIdAsNodeRange(id, this.domActiveRange);
      }

      createDOMView (dom: DOMNodeRange | ChildNode | 'expose-prebound-dom', disposable?: LooseDisposable): DOMView.ContextBound {
        const context = dom === 'expose-prebound-dom' ? this : this.bindDOMRange(dom);
        const view = new DOMView.ContextBound(context);
        if (disposable) view.attachDisposable(disposable);
        return view;
      }

      setStyles (styles: Record<string, any>): void {
        for (const element of this.domActiveRange.elements()) {
          if (element['style'] instanceof CSSStyleDeclaration) {
            DOM.setStyles(element, styles);
          }
        }
      }
    }
  ));

  export type RenderableTarget<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> =
    | DOMComponent<TContext, TArgs, TView>
    // | Context.Immediate.Callback<TContext, TArgs, TView>
    ;
  export namespace RenderableTarget {
    export type InferView<T> = T extends RenderableTarget<any, any, infer TView> ? TView : never;
  }

  export function bindRoot<TContext extends Context> (context: TContext, stylesheet: ManagedStylesheet): TContext {
    return context
      .bind(DOMContextBindings.StyleSheet, stylesheet)
      .bind(DOMContextBindings.DOM.ActiveRange, DOMNodeRange.FromStaticNode(document.body))
      .bind(DOMContextBindings.DOM.InsertionLocation, DOMLocationPointer.from(document.body));
  }

  export function bindDOMInsertionLocation<TContext extends Context.Immediate> (context: TContext, location: Element | DOMNodeRange | DOMLocationPointer | DOMLocationPointer.Props): TContext;
  export function bindDOMInsertionLocation<TContext extends Context.Immediate> (context: TContext, locationArg: Element | DOMNodeRange | DOMLocationPointer | DOMLocationPointer.Props): TContext {
    let location: DOMLocationPointer;
    if (isDOMLocationPointer(locationArg)) location = locationArg;
    else if (isDOMNodeRange(locationArg)) location = DOMLocationPointer.from(locationArg.firstActiveElementRequired);
    else location = DOMLocationPointer.from(locationArg);
    return context
      .bind(DOMContextBindings.DOM.InsertionLocation, location)
      .bind(DOMContextBindings.DOM.DetachedByDefault, false);
  }
}

export namespace DOMContextBindings {
  export namespace DOM {
    export const DetachedByDefault: Context.Driver<boolean> = {
      label: 'DOMContext.Bindings.DOM.DetachedByDefault',
    };
    export const InsertionLocation: Context.Driver<DOMLocationPointer> = {
      label: 'DOMContext.Bindings.DOM.InsertionLocation',
    };
    // export const ActiveRange: Context.Driver<DOMNodeRange> = {
    //   label: 'DOMContext.Bindings.DOM.ActiveRange',
    // };
    export namespace ActiveRange {
      export const Driver: Context.Driver<DOMNodeRange> = {
        label: 'DOMContext.Bindings.DOM.ActiveRange',
        queries: Context.Driver.Queries((match, when, ok) => match([
          when(DOMContextQueryTypes.ActiveDOMRange, (binding) => {
            return ok(binding.data);
          }),
        ])),
      };
    }
  }

  export namespace Template {
    export const Driver: Context.Driver<HTMLTemplate> = {
      label: 'DOMContext.Bindings.Template',
    };
  }
  export namespace TemplateSlot {
    export const Driver: Context.Driver<{ readonly id: string }> = {
      label: 'DOMContext.Bindings.TemplateSlot',
    };
  }

  export namespace StyleSheet {
    export const Driver: Context.Driver<ManagedStylesheet> = {
      label: 'DOMContext.Bindings.StyleSheet',
    };
  }

  export namespace BranchRoot {
    export interface Data {
      readonly branchCount: number;
      readonly branchNames: readonly string[] | null;
    }
    export const Driver: Context.Driver<Data> = {
      label: 'DOMContext.Bindings.BranchRoot',
    };
  }
  export namespace Branch {
    export interface Data {
      readonly index: number;
      readonly name: string | null;
    }
    export const Driver: Context.Driver<Data> = {
      label: 'DOMContext.Bindings.Branch',
    };
  }

  export namespace DOMTemplateSlotById {
    export interface Data {
      readonly element: Element;
      readonly nodeRange: DOMNodeRange;
      readonly insertionLocation: DOMLocationPointer;
    }
    export const Driver: Context.Driver<Data> = {
      label: 'DOMContext.Bindings.DOMTemplateSlotById',
    };
  }

  export namespace RenderComponent {
    export interface BindingData {
      readonly component: DOMComponent;
    }
    export const Driver: Context.Driver<BindingData> = {
      label: 'DOMContext.Bindings.RenderComponent',
    };
  }
}

export namespace DOMContextQueryTypes {
  export const ActiveDOMRange = Context.Query.Type<[], DOMNodeRange>((match, when) => ({
    label: 'DOMContextQueryTypes.ActiveDOMRange',
    query: match([
      when(DOMContextBindings.DOM.ActiveRange, (index) => index.createSuccessfulResponse(index.tailContext.data)),
    ]),
  }));
}
