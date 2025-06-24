import type { Context } from '@xf-common/facilities/context';
import { isDefined, isFunction, isString, isUndefined } from '@xf-common/general/type-checking';
import { type DOMContext } from './dom-context';
import { DOM } from './dom-helpers';
import { DOMView } from './dom-view';
import type { HTMLTemplate } from './html-template';
import type { ManagedStylesheet } from './managed-stylesheet';

export function isDOMComponent (target: unknown): target is DOMComponent {
  return isFunction((target as DOMComponent).render);
}

/**
 * # `DOMComponent`
 *
 * ## Basics
 *
 * A `DOMComponent` instance is simply a an object with a `render` function that first takes a `DOMContext` (or
 * extension thereof), followed by some number of additional arguments defined on a per-component basis, and returns an
 * object that implements the `DOMView` interface.
 *
 * Given a component definition, here's how we render it:
 * ```ts
 * declare const ColoredTextComponent: DOMComponent<DOMContext, [text: string, color: string]>; // assume this is defined elsewhere
 *
 * const view = context.render(ColoredTextComponent, 'Hello, world!', 'red');
 * ```
 *
 * The only thing directly bound to the context when a component is rendered using `DOMContext.render()` is
 * `DOMContext.RenderComponent`, referencing the component instance. Rendering a component therefore has no intrinsic
 * effect on the DOM or the way it is bound to context, which means components can participate in the rendering process
 * (e.g. coordinating it) without actually rendering anything themselves.
 *
 * ## The basics
 * Here's the simplest way of defining a component:
 * ```ts
 * const ColoredTextComponent = {
 *   render (context: DOMContext, text: string, color: string): DOMView {
 *     const element = context.domActiveRange.firstActiveHTMLElementRequired;
 *     element.textContent = props.text;
 *     element.style.color = props.color;
 *     return context.createDOMView(element);
 *   }
 * }
 * ```
 *
 * Or with type safety established upfront, making the `render` function more concise in the process:
 * ```ts
 * const ColoredTextComponent: DOMComponent<DOMContext, [text: string, color: string]> = {
 *   render (context, text, color) {
 *     // ...
 *   }
 * };
 * ```
 *
 * Or use the provided API to allow inference to take care of type safety:
 * ```ts
 * const ColoredTextComponent = DOMComponent((context: DOMContext, text: string, color: string) => {
 *   // ...
 * });
 * ```
 *
 * ## How to render a component
 *
 * ```ts
 * const view = context.render(ColoredTextComponent, 'Hello, world!', 'red');
 * // Manually attach the view to the DOM:
 * for (const node of view.dom) {
 *   parentElement.appendChild(node);
 * }
 *
 * // Or use the `attachTo` method:
 * view.dom.attachTo(parentElement); // Note: We can alternatively pass it a `DOMLocationPointer` object as needed.
 * ```
 *
 * ## Custom views
 *
 * ```ts
 * import { DOMComponent, DOMContext, DOMNodeRange, DOMView } from '@sx/ui/dom';
 *
 * class ColoredTextView extends DOMView.Generic {
 *   constructor (public readonly dom: DOMNodeRange) {}
 *   setText (text: string) {
 *     this.dom.firstActiveHTMLElementRequired.textContent = text;
 *   }
 * }
 * const ColoredTextComponent: DOMComponent<DOMContext, [text: string, color: string], ColoredTextView> = {
 *   render (context, text, color) {
 *     // ...
 *     return new ColoredTextView(context.domActiveRange);
 *   }
 * };
 *
 * function run (context: DOMContext) {
 *   const view = context.render(ColoredTextComponent, 'Hello, world!', 'red');
 *   setTimeout(() => view.setText('Goodbye, world!'), 1000);
 * }
 * ```
 *
 * ## Binding props/args to a component definition
 *
 * Binding component args to a component returns a new component definition that will always use those args when asked
 * to render in a given context.
 *
 * First define a wrapper function:
 * ```ts
 * // Prebinding is very simple. Just capture the arguments by closure and return another component:
 * function ColoredTextComponent (text: string, color: string): DOMComponent<DOMContext, [], ColoredTextComponent.View> {
 *   return {
 *     render: (context) => ColoredTextComponent.render(context, text, color)
 *   };
 * }
 *
 * // Or use built in helpers to cut down on boilerplate:
 * function ColoredTextComponent (text: string, color: string) {
 *   return DOMComponent.bind(ColoredTextComponent, text, color);
 * }
 *
 * // However the function is defined, you can define its particulars in a namespace of the same name:
 * namespace ColoredTextComponent {
 *   export type View = InstanceType<typeof View>;
 *   export const View = class ColoredTextComponentView extends DOMView.Generic { ... };
 *   // You must export the component as `Component` in order to be able to reference the namespace without having to
 *   // dereference the component explicitly:
 *   export const Component = DOMComponent({ ... });
 * }
 *
 * // Putting it into action:
 * function run (context: DOMContext) {
 *   // Bind props to the component to remove it as a concern from whoever is rendering it:
 *   const foo = ColoredTextComponent('Hello, world!', 'red');
 *   // Render it:
 *   context.render(foo);
 *   // Or pass it to another component to render as a subcomponent:
 *   context.render(SomeHigherOrderComponent, foo);
 * }
 * ```
 *
 * ## Templated components
 * The `DOMComponent` namespace provides a helper for defining components that automatically prepare and bind a default
 * HTML template and associate it with an optional CSS stylesheet. When doing so, context is automatically bound to the
 * root element defined by the template, meaning we can focus purely on what we want the component to do.
 *
 * ```ts
 * const ColoredTextComponent = DOMComponent.Templated('colored-text', ({ clsname, defineComponent }) => {
 *  // `defineComponent` is mainly a tool to get around TypeScript's limitations when it comes to type inference.
 *  return defineComponent({
 *    render (context, text: string, color: string) {
 *      const span = context.domActiveRange.querySelectorRequired(clsname.selector('text'));
 *      span.textContent = text;
 *      span.style.color = color;
 *      // No need to pass in an element - The `DOMComponent.Templated` handled all that for us before it called
 *      // `render`, which is why we were able to successfully find the span element in the code above.
 *      return context.createDOMView();
 *    }
 *
 *    html: DOM.html(`
 *      <div class="${clsname}">
 *        <span class="${clsname('text')}"></span>
 *      </div>
 *    `),
 *
 *    css: DOM.css(`
 *      .${clsname} {
 *        padding: 10px;
 *        background-color: white;
 *        box-shadow: 0 0 5px 0 #00000011;
 *        > .${clsname('text')} {
 *          font-size: 150%;
 *        }
 *      }
 *    `),
 *  });
 * });
 * ```
 *
 * ### Predefined subcomponents
 *
 * TODO: Document this.
 */
export interface DOMComponent<
  TContext extends DOMContext<TComponents> = DOMContext,
  TArgs extends unknown[] = unknown[],
  TView extends DOMView = DOMView,
  TComponents extends DOMComponent.Components = DOMComponent.Components
> {
  readonly render: (context: TContext, ...args: TArgs) => TView;
  readonly components?: TComponents | null;
}
export function DOMComponent<
  TContext extends DOMContext = DOMContext,
  TArgs extends unknown[] = unknown[],
  TView extends DOMView = DOMView
> (render: (context: TContext, ...args: TArgs) => TView): DOMComponent<TContext, TArgs, TView> {
  return { render };
}
export namespace DOMComponent {
  export function bind<TComponent extends DOMComponent> (component: TComponent, ...args: InferArgs<TComponent>): DOMComponent<InferContext<TComponent>, [], InferView<TComponent>> {
    return {
      render: (context): InferView<TComponent> => component.render(context, ...args) as InferView<TComponent>,
    };
  }

  export function bindable<TComponent extends DOMComponent> (component: TComponent) {
    return (...args: InferArgs<TComponent>) => bind(component, ...args);
  }

  export function getComponentOf<TComponents extends DOMComponent.Components, TName extends keyof TComponents> (
    component: DOMComponent<any, any, any, TComponents>,
    name: TName
  ): TComponents[TName] {
    const subcomponent = component.components?.[name as string];
    if (isDefined(subcomponent)) return subcomponent as TComponents[TName];
    throw new Error(`"${String(name)}" is not defined as a subcomponent of the specified component.`);
  }

  // export type Render<TContext extends DOMContext, TArgs extends unknown[], TView extends DOMView> = (context: TContext, ...args: TArgs) => TView;
  // export type Render<TComponent extends DOMComponent> = (context: InferContext<TComponent>, ...args: InferArgs<TComponent>) => InferView<TComponent>;
  export type Components = Record<string, DOMComponent>;

  export type InferContext<TComponent extends DOMComponent> = TComponent extends DOMComponent<infer TContext extends DOMContext, any, any> ? TContext : never;
  export type InferArgs<TComponent extends DOMComponent> = TComponent extends DOMComponent<any, infer TArgs extends unknown[], any> ? TArgs : never;
  export type InferView<TComponent extends DOMComponent> = TComponent extends DOMComponent<any, any, infer TView extends DOMView> ? TView : never;

  export type NS<
    TContext extends DOMContext<TComponents> = DOMContext,
    TArgs extends unknown[] = unknown[],
    TView extends DOMView = DOMView,
    TComponents extends DOMComponent.Components = DOMComponent.Components
  > = {
    readonly Component: DOMComponent<TContext, TArgs, TView, TComponents>;
  };
  export type OrNS<
    TContext extends DOMContext<TComponents> = DOMContext,
    TArgs extends unknown[] = unknown[],
    TView extends DOMView = DOMView,
    TComponents extends DOMComponent.Components = DOMComponent.Components
  > = DOMComponent<TContext, TArgs, TView, TComponents> | NS<TContext, TArgs, TView, TComponents>;
  export namespace OrNS {
    export type InferView<T extends OrNS> = T extends OrNS<any, any, infer TView, any> ? TView : never;
    export type InferArgs<T extends OrNS> = T extends OrNS<any, infer TArgs, any> ? TArgs : never;
  }

  let currentEnv: Templated.DeclarationEnvironment | null = null;

  export function Templated<TComponent extends DOMComponent> (callback: (env: Templated.DeclarationEnvironment) => TComponent): TComponent;
  export function Templated<TComponent extends DOMComponent> (clsname: string, callback: (env: Templated.DeclarationEnvironment) => TComponent): TComponent;

  export function Templated<
    TContext extends DOMContext,
    TArgs extends unknown[],
    TView extends DOMView,
    TComponents extends Components
  > (
    baseClassName_or_config_or_callback:
      | string
      | Templated.Config<TContext, TArgs, TView, TComponents>
      | Templated.DeclarationCallback<TContext, TArgs, TView, TComponents>,
    maybe_config_or_callback?:
      | Templated.Config<TContext, TArgs, TView, TComponents>
      | Templated.DeclarationCallback<TContext, TArgs, TView, TComponents>,
  ) {
    type ConfigOrCallback = Templated.Config<TContext, TArgs, TView, TComponents> | Templated.DeclarationCallback<TContext, TArgs, TView, TComponents>;
    let baseClassName: string | null;
    let config_or_callback: ConfigOrCallback;
    if (isString(baseClassName_or_config_or_callback)) {
      baseClassName = baseClassName_or_config_or_callback;
      config_or_callback = maybe_config_or_callback as ConfigOrCallback;
    }
    else {
      baseClassName = null;
      config_or_callback = baseClassName_or_config_or_callback!;
    }
    const oldEnv = currentEnv;
    currentEnv = currentEnv
      ? baseClassName ? currentEnv.createChildEnvironment(baseClassName) : currentEnv
      : new Templated.DeclarationEnvironment(baseClassName ? [baseClassName] : []);
    let component: DOMComponent<TContext, TArgs, TView, TComponents>;
    if (isFunction(config_or_callback)) {
      const result = config_or_callback(currentEnv);
      if (result instanceof Templated.Component) {
        component = result;
      }
      else {
        component = new Templated.Component(currentEnv, result as Templated.Config<TContext, TArgs, TView, TComponents>);
      }
    }
    else {
      component = new Templated.Component(currentEnv, config_or_callback);
    }
    currentEnv = oldEnv;
    return component;
  }
  export namespace Templated {
    export type Config<
      TContext extends DOMContext = DOMContext,
      TArgs extends unknown[] = unknown[],
      TView extends DOMView = DOMView,
      TComponents extends Components = Components
    > =
      | Config.Standard<TContext, TArgs, TView, TComponents>
      | Config.Minimal
    ;
    export namespace Config {
      export interface Minimal {
        readonly css?: ManagedStylesheet.OnDemandRuleSet | string;
        readonly html: HTMLTemplate | string;
      }
      export interface Standard<
        TContext extends DOMContext<TComponents> = DOMContext,
        TArgs extends unknown[] = unknown[],
        TView extends DOMView = DOMView,
        TComponents extends Components = Components
      > extends Minimal {
        readonly components?: TComponents;
        contextType?: Context.Immediate.InterfaceType.OrNS<TContext> | ((context: DOMContext) => TContext);
        render (context: TContext, ...args: TArgs): TView | (DOMView extends TView ? void : never);
      }
      export function isStandard<
        TContext extends DOMContext,
        TArgs extends unknown[],
        TView extends DOMView,
        TComponents extends Components
      > (config: Config<TContext, TArgs, TView, TComponents>): config is Standard<TContext, TArgs, TView, TComponents> {
        return isDefined((config as Standard<TContext, TArgs, TView, TComponents>).render);
      }
    }

    export interface DeclarationCallback<
      TContext extends DOMContext = DOMContext,
      TArgs extends unknown[] = unknown[],
      TView extends DOMView = DOMView,
      TComponents extends Components = Components
    > {
      // (env: DeclarationEnvironment, create: DeclarationCallback.Create<TContext, TArgs, TView, TComponents>): Config<TContext, TArgs, TView, TComponents>;
      (env: DeclarationEnvironment): Config<TContext, TArgs, TView, TComponents> | DOMComponent<TContext, TArgs, TView, TComponents>;
    }
    export namespace DeclarationCallback {
      export interface Standard<
        TContext extends DOMContext = DOMContext,
        TArgs extends unknown[] = unknown[],
        TView extends DOMView = DOMView,
        TComponents extends Components = Components
      > {
        // (env: DeclarationEnvironment, create: DeclarationCallback.Create<TContext, TArgs, TView, TComponents>): Config<TContext, TArgs, TView, TComponents>;
        (env: DeclarationEnvironment): Config<TContext, TArgs, TView, TComponents> | DOMComponent<TContext, TArgs, TView, TComponents>;
      }
      export type Minimal = (env: DeclarationEnvironment) => Config.Minimal;
      // export type Create<
      //   TContext extends DOMContext,
      //   TArgs extends unknown[],
      //   TView extends DOMView,
      //   TComponents extends Components
      // > = (config: Config<TContext, TArgs, TView, TComponents>) => DOMComponent<TContext, TArgs, TView, TComponents>;
      export interface DefineComponent {
        <TContext extends DOMContext<TComponents>, TArgs extends unknown[], TView extends DOMView, TComponents extends Components>(
          config: Config<TContext, TArgs, TView, TComponents>,
        ): DOMComponent<TContext, TArgs, TView, TComponents>;
      }
      export const defineComponent = (env: DeclarationEnvironment): DefineComponent => (config) => new Component(env, config);
    }
    export class DeclarationEnvironment {
      constructor (
        public readonly baseClassName: readonly string[],
        cssNamingScope?: DOM.CSS.NamingScope,
      ) {
        if (cssNamingScope) this.#cssNamingScope = cssNamingScope;
      }
      #cssNamingScope?: DOM.CSS.NamingScope;
      // #create?: DeclarationCallback.Create;
      #defineComponent?: DeclarationCallback.DefineComponent;

      get env (): DeclarationEnvironment { return this; }
      get clsname () { return this.#cssNamingScope ??= DOM.CSS.NamingScope(this.baseClassName); }
      /** Utility that returns the same as `clsname` but prefixed with a `.` character. */
      get clssel () { return this.clsname.selector; }
      get defineComponent (): DeclarationCallback.DefineComponent { return this.#defineComponent ??= DeclarationCallback.defineComponent(this); }

      createChildEnvironment (...classNames: string[]): DeclarationEnvironment {
        return new DeclarationEnvironment(
          [...this.baseClassName, ...classNames],
          this.#cssNamingScope?.createChildScope(...classNames)
        );
      }
    }

    export class Component<
      TContext extends DOMContext<TComponents>,
      TArgs extends unknown[],
      TView extends DOMView,
      TComponents extends Components
    > implements DOMComponent<TContext, TArgs, TView, TComponents> {

      constructor (
        env: DeclarationEnvironment,
        config: Config<TContext, TArgs, TView, TComponents>
      ) {
        this.#env = env;
        this.#config = config;
      }
      readonly #env: DeclarationEnvironment;
      readonly #config: Config<TContext, TArgs, TView, TComponents>;
      #styles?: ManagedStylesheet.OnDemandRuleSet | null;
      #template?: HTMLTemplate;

      get styles (): ManagedStylesheet.OnDemandRuleSet | null {
        if (this.#styles) return this.#styles;
        if (isUndefined(this.#config.css)) return this.#styles = null;
        if (isString(this.#config.css)) return this.#styles ??= DOM.css(this.#config.css);
        return this.#styles = this.#config.css as ManagedStylesheet.OnDemandRuleSet;
      }
      get template (): HTMLTemplate {
        return this.#template ??= isString(this.#config.html) ? DOM.html(this.#config.html) : this.#config.html;
      }
      get components (): TComponents | null {
        return 'components' in this.#config ? this.#config.components : null;
      }

      render (context: TContext, ...args: TArgs): TView {
        const config = this.#config;
        const releaseStyles = this.styles?.require(context);
        const dom = this.template.render();
        context = context.bindDOM(dom);
        let view: DOMView | undefined | void;
        if (Config.isStandard(config)) {
          if (isDefined(config.contextType)) {
            context = isFunction(config.contextType)
              ? config.contextType(context)
              : context.switch(config.contextType);
          }
          view = config.render(context, ...args);
        }
        if (isUndefined(view)) view = new DOMView.ContextBound(context);
        view.attachDisposable(releaseStyles);
        return view as TView;
      }
    }
  }
}
