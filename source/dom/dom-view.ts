import { DisposableGroup, dispose, disposeArray, disposeProperties, isVerifiableNoopOnDispose } from '@xf-common/general/disposables';
import { FnCC } from '@xf-common/general/factories-and-latebinding';
import { isDefined } from '@xf-common/general/type-checking';
import type { DOMContext } from './dom-context';
import { DOMNodeRange } from './dom-node-range';

const _isDOMView_ = Symbol('isDOMView');
export const isDOMView = (a: unknown): a is DOMView => a?.[_isDOMView_] === true;

export interface DOMView extends Disposable {
  readonly [_isDOMView_]: true;
  readonly nodes: DOMNodeRange;
  attachDisposable (disposalTarget: LooseDisposable): void;
  removeFromDOM (): void;
  removeFromDOMAndDispose (): void;
}
export function DOMView (dom: DOMNodeRange = DOMNodeRange.Empty, disposalTarget?: LooseDisposable): DOMView {
  const view = new DOMView.Generic(dom);
  if (isDefined(disposalTarget)) view.attachDisposable(disposalTarget);
  return view;
}
export namespace DOMView {
  export abstract class Base implements DOMView {
    #disposed = false;
    #disposables: DisposableGroup | undefined;
    protected get disposables (): DisposableGroup { return this.#disposables ??= new DisposableGroup(); }

    get [_isDOMView_] () { return true as const; }
    abstract get nodes (): DOMNodeRange;

    attachDisposable (disposalTarget: LooseDisposable): this {
      if (this.#disposed) {
        throw new Error('Cannot attach disposables to an already-disposed DOMView');
      }
      if (isVerifiableNoopOnDispose(disposalTarget)) return this;
      this.disposables.add(disposalTarget);
      return this;
    }

    removeFromDOM (): void {
      if (this.#disposed) return;
      this.nodes.remove();
    }

    removeFromDOMAndDispose (): void {
      if (this.#disposed) return;
      this.nodes.remove();
      dispose(this);
    }

    [Symbol.dispose] (): void {
      if (this.#disposed) return;
      this.#disposed = true;
      if (isDefined(this.#disposables)) dispose(this.#disposables);
      dispose(this.nodes);
      this.onDispose();
    }

    /** overridable */
    protected onDispose (): void {}
  }

  class GenericDOMView extends Base {
    constructor (public readonly nodes: DOMNodeRange) { super(); }
  }
  namespace GenericDOMView {}
  export import Generic = GenericDOMView;

  class ContextBoundDOMView<TContext extends DOMContext = DOMContext> extends Base {
    constructor (context: TContext) {
      super();
      this.#context = context;
    }
    readonly #context: TContext;

    override get nodes (): DOMNodeRange { return this.context.domActiveRange; }
    get context (): TContext { return this.#context; }
  }
  namespace ContextBoundDOMView {
    class ContextBoundDOMViewWithComponents<TContext extends DOMContext, TComponents> extends ContextBoundDOMView {
      constructor (context: TContext, public readonly components: TComponents) {
        super(context);
      }
    }
    namespace ContextBoundDOMViewWithComponents {
      export type AndLocations = InstanceType<typeof AndLocations>;
      export const AndLocations = class ContextBoundDOMViewWithComponentsAndLocations<TContext extends DOMContext, TComponents, TLocations> extends ContextBoundDOMViewWithComponents<TContext, TComponents> {
        constructor (context: TContext, components: TComponents, public readonly locations: TLocations) {
          super(context, components);
        }
      };
    }
    export import WithComponents = ContextBoundDOMViewWithComponents;

    export type WithLocations<TContext extends DOMContext, TLocations> = InstanceType<typeof WithLocations<TContext, TLocations>>;
    export const WithLocations = class ContextBoundDOMViewWithLocations<TContext extends DOMContext, TLocations> extends ContextBoundDOMView {
      constructor (context: TContext, public readonly locations: TLocations) {
        super(context);
      }
    };
  }
  export import ContextBound = ContextBoundDOMView;

  export interface StaticTextNode extends DOMView {
    readonly textNode: Text;
    setText (text: string): void;
  }
  export const StaticTextNode = FnCC(
    class StaticTextNodeView extends GenericDOMView implements StaticTextNode {
      static create (textNode: Text, disposalTarget?: LooseDisposable): StaticTextNode {
        const dom = DOMNodeRange.FromStaticNode(textNode);
        const view = new StaticTextNodeView(dom);
        view.attachDisposable(disposalTarget);
        return view;
      }
      get textNode (): Text { return this.nodes.firstActiveNode as Text; }
      setText (text: string): void { this.textNode.nodeValue = text; }
    }
  );

  export interface StaticNode<TNode extends ChildNode = ChildNode> extends DOMView {
    readonly node: TNode;
  }
  export const StaticNode = FnCC(
    class StaticNodeView<TNode extends ChildNode = ChildNode> extends GenericDOMView implements StaticNode<TNode> {
      static create<TNode extends ChildNode> (element: TNode, disposalTarget?: LooseDisposable): StaticNode<TNode> {
        const dom = DOMNodeRange.FromStaticNode(element);
        const view = new StaticNodeView<TNode>(dom);
        view.attachDisposable(disposalTarget);
        return view;
      }
      get node (): TNode { return this.nodes.firstActiveNode as TNode; }
    }
  );

  export interface WithNamedNodes<TNodes extends Record<string, Node>> extends GenericDOMView {
    readonly namedNodes: TNodes;
  }
  export const WithNamedNodes = FnCC(
    class DOMViewWithNamedNodes<TNodes extends Record<string, Node>> extends GenericDOMView implements WithNamedNodes<TNodes> {
      static create<TNodes extends Record<string, Node>> (dom: DOMNodeRange, namedNodes: TNodes, disposalTarget?: LooseDisposable): WithNamedNodes<TNodes> {
        const view = new DOMViewWithNamedNodes(dom, namedNodes);
        view.attachDisposable(disposalTarget);
        return view;
      }
      constructor (dom: DOMNodeRange, public readonly namedNodes: TNodes) { super(dom); }
    }
  );

  export interface StaticBranchList<TView extends DOMView = DOMView> extends DOMView {
    readonly branches: TView[];
  }
  export const StaticBranchList = FnCC(
    class StaticBranchListView<TView extends DOMView> extends Base implements StaticBranchList<TView> {
      static create<TView extends DOMView> (branches: TView[], disposalTarget?: LooseDisposable): StaticBranchList<TView> {
        const view = new StaticBranchListView(branches);
        view.attachDisposable(disposalTarget);
        return view;
      }
      constructor (public readonly branches: TView[]) { super(); }
      #dom?: DOMNodeRange;

      get nodes () { return this.#dom ??= DOMNodeRange.ConcatAll(this.branches.map((branch) => branch.nodes)); }

      protected override onDispose () {
        disposeArray(this.branches);
      }
    }
  );

  export interface StaticBranchRecord<TBranches extends Record<keyof TBranches, DOMView>> extends DOMView {
    readonly branches: TBranches;
  }
  export const StaticBranchRecord = FnCC(
    class StaticBranchRecordView<TBranches extends Record<keyof TBranches, DOMView>> extends Base implements StaticBranchRecord<TBranches> {
      static create<TBranches extends Record<keyof TBranches, DOMView>> (branches: TBranches, disposalTarget?: LooseDisposable): StaticBranchRecord<TBranches> {
        const view = new StaticBranchRecordView(branches);
        view.attachDisposable(disposalTarget);
        return view;
      }
      constructor (public readonly branches: TBranches) { super(); }
      #dom?: DOMNodeRange;

      get nodes () {
        if (isDefined(this.#dom)) return this.#dom;
        const ranges: DOMNodeRange[] = [];
        for (const key in this.branches) {
          ranges.push(this.branches[key].nodes);
        }
        return this.#dom = DOMNodeRange.ConcatAll(ranges);
      }

      protected override onDispose () {
        disposeProperties(this.branches);
      }
    }
  );
}
