import { ArraySource, Async, Future, isAsync, isValueSource, Monitor, StringData, type AssociativeRecordData, type BasicPrimitiveData, type MapData, type StringSource, type ValueSource } from '@xf-common/dynamic';
import { isOnDemandAsync } from '@xf-common/dynamic/async/on-demand-async';
import type { Compositional } from '@xf-common/facilities/compositional/compositional';
import { Context } from '@xf-common/facilities/context';
import { disposableFunction, dispose } from '@xf-common/general/disposables';
import { isArray, isDefined, isString } from '@xf-common/general/type-checking';
import { renderMarkdownToHtmlSync } from '../markdown/markdown-helpers';
import { DOMComponent, isDOMComponent } from './dom-component';
import { DOM } from './dom-helpers';
import { DOMLocationPointer, isDOMLocationPointer } from './dom-location-pointer';
import { DOMNodeRange, isDOMNodeRange } from './dom-node-range';
import { DOMView, isDOMView } from './dom-view';
import type { DynamicMarkdownOptions } from './dynamic-markdown';
import { HTMLTemplate } from './html-template';
import type { ManagedStylesheet } from './managed-stylesheet';

export interface DOMContext<TComponents extends DOMComponent.Components = DOMComponent.Components> extends Compositional.ExtractInterface<typeof DOMContext.InterfaceType> {
  renderComponent<K extends keyof TComponents> (componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
  renderComponentInto<K extends keyof TComponents> (selector: string, componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
  renderComponentDetached<K extends keyof TComponents> (componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
  renderComponentToTemplateId<K extends keyof TComponents> (slotId: string, componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]>;
}
export namespace DOMContext {
  const _domActiveRange_ = Symbol('DOMContext.DOMActiveRange');

  type SpecialMethods<TComponents extends DOMComponent.Components> = Pick<DOMContext<TComponents>, 'renderComponent' | 'renderComponentToTemplateId' | 'renderComponentInto' | 'renderComponentDetached'>;

  export type InterfaceType = typeof InterfaceType;
  export const InterfaceType = Context.Immediate.InterfaceType.extend((InterfaceType) => (
    class DOMContext<TComponents extends DOMComponent.Components = DOMComponent.Components> extends InterfaceType.BaseClass implements SpecialMethods<TComponents> {
      get domActiveRange () { return this.query(DOMContextQueryTypes.ActiveDOMRange); }
      get domInsertionLocation () { return this.unbind(DOMContextBindings.DOM.InsertionLocation); }
      get stylesheet () { return this.unbind(DOMContextBindings.StyleSheet.Driver); }
      get classList () { return this.domActiveRange.firstActiveElementRequired.classList; }

      protected get detachedByDefault () { return this.unbind(DOMContextBindings.DOM.DetachedByDefault); }

      bindStyleSheet (stylesheet: ManagedStylesheet): this {
        return this.bind(DOMContextBindings.StyleSheet, stylesheet);
      }

      bindDOMRange<TContext extends DOMContext> (this: TContext, dom: ChildNode | DOMNodeRange): TContext {
        if (!isDOMNodeRange(dom)) dom = DOMNodeRange.FromStaticNode(dom);
        return this.bind(DOMContextBindings.DOM.ActiveRange, dom);
      }

      bindDOMLocation<TContext extends DOMContext> (this: TContext, location: Element | DOMNodeRange | DOMLocationPointer | DOMLocationPointer.Props | string): TContext {
        if (isString(location)) location = this.domActiveRange.querySelectorRequired(location);
        return bindDOMLocationPointer(this, location);
      }

      /**
       * @remarks
       * If a string is passed, it is interpreted as a CSS selector and will be passed to `querySelectorRequired` on the
       * active DOM node range for this context.
       */
      bindDOM<TContext extends DOMContext> (this: TContext, dom: Element | DOMNodeRange | DOMView | string): TContext;
      bindDOM<TContext extends DOMContext, R> (this: TContext, dom: Element | DOMNodeRange | DOMView | string, callback: (context: TContext) => Exclude<R, void>): R;
      bindDOM<TContext extends DOMContext> (this: TContext, dom: Element | DOMNodeRange | DOMView | string, callback: (context: TContext) => void): TContext;
      bindDOM<TContext extends DOMContext> (this: TContext, dom: Element | DOMNodeRange | DOMView | string, callback?: (context: TContext) => any) {
        if (isString(dom)) dom = this.domActiveRange.querySelectorRequired(dom);
        else if (isDOMView(dom)) dom = dom.nodes;
        const context = this.bindDOMRange(dom).bindDOMLocation(dom);
        return isDefined(callback) ? callback(context) : context;
      }

      /**
       * Extracts the element with the specified id attribute from the active DOM node range, removes its id attribute,
       * then binds to this context (a) a new active DOM node range with the extracted element as its sole member, and (b)
       * a new active DOM insertion location with the element as the parent element thereof. The newly bound context is
       * then returned.
       */
      bindDOMTemplateSlotById<TContext extends DOMContext> (this: TContext, id: string): TContext {
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
      render<TContext extends DOMContext, TArgs extends unknown[] = unknown[], TView extends DOMView = DOMView> (this: TContext, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs): TView;
      render<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs) {
        const view = this._render(target, args);
        if (!this.detachedByDefault) {
          view.nodes.attachTo(this.domInsertionLocation);
        }
        return view;
      }
      renderText (text: Primitive = ''): DOMView.StaticTextNode {
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
      renderTextInto (selector: string, text: Primitive = ''): DOMView.StaticTextNode {
        return this.bindDOM(selector).renderText(text);
      }
      renderHTMLInto (selector: string, html: string): DOMNodeRange {
        return this.bindDOM(selector).renderHTML(html);
      }
      renderMarkdownInto (selector: string, markdown: string): DOMNodeRange {
        const html = renderMarkdownToHtmlSync(markdown);
        return this.renderHTMLInto(selector, html);
      }
      renderComponentInto<K extends keyof TComponents> (selector: string, componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]> {
        return this.bindDOM(selector).renderComponent(componentIdentifier, ...args);
      }

      renderToTemplateId<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> (this: TContext, id: string, target: DOMComponent.OrNS<TContext, TArgs, TView>, ...args: TArgs): TView {
        return this.bindDOMTemplateSlotById(id).render(target, ...args);
      }
      renderTextToTemplateId (id: string, text: Primitive = ''): DOMView.StaticTextNode {
        return this.bindDOMTemplateSlotById(id).renderText(text);
      }
      renderHTMLToTemplateId (id: string, html: string): DOMNodeRange {
        return this.bindDOMTemplateSlotById(id).renderHTML(html);
      }
      renderMarkdownToTemplateId (id: string, markdown: string): DOMNodeRange {
        const html = renderMarkdownToHtmlSync(markdown);
        return this.renderHTMLToTemplateId(id, html);
      }
      renderComponentToTemplateId<K extends keyof TComponents> (slotId: string, componentIdentifier: K, ...args: DOMComponent.InferArgs<TComponents[K]>): DOMComponent.InferView<TComponents[K]> {
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
              tailingRange = DOMNodeRange.ConcatAll([view.nodes, tailingRange]);
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
              tailingRange = DOMNodeRange.ConcatAll([view.nodes, tailingRange]);
              branchContext = branchRootContext.bindDOMLocation({
                parentElement: this.domInsertionLocation.parentElement,
                nextOuterSibling: () => tailingRange.firstActiveNode,
              });
            }
          }
          return DOMView.StaticBranchRecord(views);
        }
      }

      renderFutureText (source: Future<[Primitive]>) {
        const read = (value: Primitive) => this.renderText(value);
        if (!source.waiting) return Future.read(source, read);
        Monitor.attach(source, () => Future.read(source, read), source);
      }
      renderFutureTextInto (selector: string, source: Future<[Primitive]>) {
        const read = (value: Primitive) => this.renderTextInto(selector, value);
        if (!source.waiting) return Future.read(source, read);
        Monitor.attach(source, () => Future.read(source, read), source);
      }
      renderFutureTextToTemplateId (id: string, source: Future<[Primitive]>) {
        const read = (value: Primitive) => this.renderTextToTemplateId(id, value);
        if (!source.waiting) return Future.read(source, read);
        Monitor.attach(source, () => Future.read(source, read), source);
      }

      renderDynamicText (source: ValueSource<Primitive>) {
        const disposable = DOM.appendDynamicText(this.domInsertionLocation, source);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicMarkdown (source: StringSource, options?: DynamicMarkdownOptions) {
        const disposable = DOM.appendDynamicMarkdown(this.domInsertionLocation, source, options);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicNodeRange (source: ArraySource<DOMNodeRange>) {
        const disposable = DOM.appendDynamicNodeRange(this.domInsertionLocation, source);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicArray<TContext extends DOMContext, TModel, TView extends DOMView> (this: TContext, source: ArraySource<TModel>, renderItem: (context: TContext, model: TModel) => TView): ArraySource<TView> {
        const context = this.bind(DOMContextBindings.DOM.DetachedByDefault, true);
        const views = ArraySource.mapToDisposable((item) => renderItem(context, item), source);
        const nodes = ArraySource.map((view) => view.nodes, views);
        this.disposables.add(this.renderDynamicNodeRange(nodes));
        return views;
      }

      renderDynamicTextInto (selector: string, source: ValueSource<Primitive>) {
        const location = DOMLocationPointer.from(this.domActiveRange.querySelectorRequired(selector));
        const disposable = DOM.appendDynamicText(location, source);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicMarkdownInto (selector: string, source: StringSource, options?: DynamicMarkdownOptions) {
        const location = DOMLocationPointer.from(this.domActiveRange.querySelectorRequired(selector));
        const disposable = DOM.appendDynamicMarkdown(location, source, options);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicNodeRangeInto (selector: string, source: ArraySource<DOMNodeRange>) {
        const location = DOMLocationPointer.from(this.domActiveRange.querySelectorRequired(selector));
        const disposable = DOM.appendDynamicNodeRange(location, source);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicArrayInto<TContext extends DOMContext, TModel, TView extends DOMView> (this: TContext, selector: string, source: ArraySource<TModel>, renderItem: (context: TContext, model: TModel) => TView): ArraySource<TView> {
        return this.bindDOM(selector).renderDynamicArray(source, renderItem);
      }

      renderDynamicTextToTemplateId (id: string, source: ValueSource<Primitive>) {
        const location = this.bindDOMTemplateSlotById(id).domInsertionLocation;
        const disposable = DOM.appendDynamicText(location, source);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicMarkdownToTemplateId (id: string, source: StringSource, options?: DynamicMarkdownOptions) {
        const location = this.bindDOMTemplateSlotById(id).domInsertionLocation;
        const disposable = DOM.appendDynamicMarkdown(location, source, options);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicNodeRangeToTemplateId (id: string, source: ArraySource<DOMNodeRange>) {
        const location = this.bindDOMTemplateSlotById(id).domInsertionLocation;
        const disposable = DOM.appendDynamicNodeRange(location, source);
        return this._returnDisposableForDynamicRendered(disposable);
      }
      renderDynamicArrayToTemplateId<TContext extends DOMContext, TModel, TView extends DOMView> (this: TContext, id: string, source: ArraySource<TModel>, renderItem: (context: TContext, model: TModel) => TView): ArraySource<TView> {
        return this.bindDOMTemplateSlotById(id).renderDynamicArray(source, renderItem);
      }

      renderTextData (textData: StringData) {
        if (isString(textData)) this.renderText(textData);
        else if (isValueSource(textData)) this.renderDynamicText(textData);
        else if (isOnDemandAsync(textData)) {
          const async = textData.require();
          this.disposables.add(async);
          async.then((textData) => this.renderTextData(textData));
        }
        else if (isAsync(textData)) return Async(textData.then((textData) => this.renderTextData(textData)));
        throw new Error(`Unexpected StringData value`);
      }
      renderTextDataInto (selector: string, textData: StringData) {
        return this.bindDOM(selector).renderTextData(textData);
      }
      renderTextDataToTemplateId (id: string, textData: StringData) {
        return this.bindDOMTemplateSlotById(id).renderTextData(textData);
      }

      /**
       * Alias for {@link DOMNodeRange.querySelectorRequired `DOMNodeRange.querySelectorRequired`}.
       */
      querySelector (selector: string): Element;
      querySelector<TElement extends Element> (selector: string, as: new (...args: any) => TElement): TElement;
      querySelector<TElement extends Element> (selector: string, as?: new (...args: any) => TElement): TElement {
        return this.domActiveRange.querySelectorRequired(selector, as!);
      }
      /**
       * Alias for {@link DOMNodeRange.querySelectorRequired `DOMNodeRange.querySelectorRequired`}.
       */
      querySelectorRequired (selector: string): Element;
      querySelectorRequired<TElement extends Element> (selector: string, as: new (...args: any) => TElement): TElement;
      querySelectorRequired<TElement extends Element> (selector: string, as?: new (...args: any) => TElement): TElement {
        return this.domActiveRange.querySelectorRequired(selector, as!);
      }
      /**
       * Alias for {@link DOMNodeRange.querySelectorAll `DOMNodeRange.querySelectorAll`}.
       */
      querySelectorAll (selector: string): Element[];
      querySelectorAll<TElement extends Element> (selector: string, as: new (...args: any) => TElement): TElement[];
      querySelectorAll<TElement extends Element> (selector: string, as?: new (...args: any) => TElement): TElement[] {
        return this.domActiveRange.querySelectorAll(selector, as!);
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

      createDOMView (dom: DOMNodeRange | ChildNode | 'expose-prebound-dom' = 'expose-prebound-dom'): DOMView.ContextBound {
        const context = dom === 'expose-prebound-dom' ? this : this.bindDOMRange(dom);
        return new DOMView.ContextBound(context);
      }

      setProperty (name: string, value: BasicPrimitiveData) {
        DOM.Properties.set(this, name, value);
      }
      setProperties (properties: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>) {
        DOM.Properties.set(this, properties);
      }
      removeProperty (name: string) {
        DOM.Properties.unset(this, name);
      }

      setAttribute (name: string, value: BasicPrimitiveData) {
        DOM.Attributes.set(this, name, value);
      }
      setAttributes (attributes: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>) {
        DOM.Attributes.set(this, attributes);
      }
      removeAttribute (name: string) {
        DOM.Attributes.remove(this, name);
      }

      setStyle (name: string, value: BasicPrimitiveData): void {
        DOM.Styles.set(this, name, value);
      }
      setStyles (styles: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void {
        DOM.Styles.set(this, styles);
      }
      removeStyle (name: string): void {
        DOM.Styles.remove(this, name);
      }

      setData (name: string, value: BasicPrimitiveData): void {
        DOM.DataSet.set(this, name, value);
      }
      setDataSet (data: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void {
        DOM.DataSet.set(this, data);
      }
      removeData (name: string): void {
        DOM.DataSet.remove(this, name);
      }

      onClick (listener: (event: MouseEvent) => void): DisposableFunction {
        return DOM.Events.onClick(this.domActiveRange, listener, { signal: this.abort.signal });
      }
      onClickOrTap (listener: (event: MouseEvent | TouchEvent) => void): DisposableFunction {
        return DOM.Events.onClickOrTap(this.domActiveRange, listener, { signal: this.abort.signal });
      }

      private _returnDisposableForDynamicRendered (disposable: Disposable) {
        this.disposables.add(disposable);
        return disposableFunction(() => {
          this.disposables.delete(disposable);
          dispose(disposable);
        });
      }

      observeConnectionToDOM (callback: (isConnected: boolean) => void): void;
      observeConnectionToDOM (abortSignal: AbortSignal, callback: (isConnected: boolean) => void): void;
      observeConnectionToDOM (abortSignalOrCallback: AbortSignal | ((isConnected: boolean) => void), callback?: (isConnected: boolean) => void): void {
        if (isDefined(callback)) {
          DOM.isConnected.observe(abortSignalOrCallback as AbortSignal, this.domActiveRange.firstActiveElementRequired, callback);
        }
        else {
          DOM.isConnected.observe(this.abort.signal, this.domActiveRange.firstActiveElementRequired, abortSignalOrCallback as (isConnected: boolean) => void);
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

  export function bindDOMLocationPointer<TContext extends Context.Immediate> (context: TContext, location: Element | DOMNodeRange | DOMLocationPointer | DOMLocationPointer.Props): TContext;
  export function bindDOMLocationPointer<TContext extends Context.Immediate> (context: TContext, locationArg: Element | DOMNodeRange | DOMLocationPointer | DOMLocationPointer.Props): TContext {
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
