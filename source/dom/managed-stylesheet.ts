import { AssociativeRecordSource, Subscribable, ValueSource, type NumberSource, type StringSource } from '@xf-common/dynamic';
import { disposableFunction, dispose } from '@xf-common/general/disposables';
import { isDefined, isString, isUndefined } from '@xf-common/general/type-checking';
import { TemplateLiteral } from '@xf-common/primitive';
import type { DOMContext } from './dom-context';
import { createChildAbortController } from '@xf-common/general/abort-signals';

export class ManagedStylesheet implements Disposable {
  static insert (stylesheet: string): ManagedStylesheet {
    return new ManagedStylesheet(ManagedStylesheet.#createStyleSheet(stylesheet));
  }
  static #createStyleSheet (stylesheet: string): CSSStyleSheet {
    const sheet = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    sheet.replaceSync(stylesheet);
    return sheet;
  }

  constructor (sheet: CSSStyleSheet) { this.#sheet = sheet; }
  readonly #sheet: CSSStyleSheet;
  readonly #childSheets = new Set<ManagedStylesheet.ChildStylesheet>();

  createChildStylesheet (cssText: string): ManagedStylesheet.ChildStylesheet {
    const sheet = ManagedStylesheet.#createStyleSheet(cssText);
    const child = new ManagedStylesheet.ChildStylesheet(sheet, this.#childSheets);
    this.#childSheets.add(child);
    return child;
  }

  insertRule (cssText: string): ManagedStylesheet.Rule {
    const sheet = this.#sheet;
    const index = sheet.insertRule(cssText);
    const rule = sheet.cssRules.item(index)!;
    return new StyleRule(sheet, rule);
  }

  insertRuleSet (ruleSet: ManagedStylesheet.RuleSet): void;
  insertRuleSet (abortSignal: AbortSignal, ruleSet: ManagedStylesheet.RuleSet): void;
  insertRuleSet (arg0: AbortSignal | ManagedStylesheet.RuleSet, arg1?: ManagedStylesheet.RuleSet): void {
    throw new Error(`Not Implemented`);
  }

  [Symbol.dispose] () {
    for (const child of this.#childSheets) dispose(child);
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((sheet) => sheet !== this.#sheet);
  }
}
export namespace ManagedStylesheet {
  export type RuleSet = RuleSetRecord | AssociativeRecordSource<RuleSetRecord>;
  export type RuleValue = string | number | StringSource | NumberSource;
  export interface RuleSetRecord {
    readonly [key: string]: RuleSet | RuleValue;
  }

  export type OnDemandArg = OnDemandGroup | OnDemandRuleSet | string;
  export type OnDemandGroup = OnDemandArg[];

  export function onDemand (css: ManagedStylesheet.OnDemandArg): ManagedStylesheet.OnDemandRuleSet;
  export function onDemand (strings: TemplateStringsArray, ...tokens: unknown[]): ManagedStylesheet.OnDemandRuleSet;
  export function onDemand (arg: ManagedStylesheet.OnDemandArg | TemplateStringsArray, ...tokens: unknown[]) {
    if (arg instanceof ManagedStylesheet.OnDemandRuleSet) return arg;
    let cssText: string;
    // if (TemplateLiteral.isTemplateStringsArray(arg)) {}
    if (isString(arg)) {
      cssText = arg;
    }
    else {
      if (!TemplateLiteral.arrayIsTemplateStringsArray(arg)) {
        switch (arg.length) {
          case 0: throw new Error('CSS group array cannot be empty');
          case 1: return onDemand(arg[0] as any);
          default: return new OnDemandStaticGroupOfRuleSets(arg.map((source) => onDemand(source)));
        }
      }
      cssText = TemplateLiteral.staticJoin(arg, tokens);
    }
    return new OnDemandStaticRuleSet(cssText);
  }

  export class ChildStylesheet extends ManagedStylesheet {
    constructor (sheet: CSSStyleSheet, childSheets: Set<ManagedStylesheet>) {
      super(sheet);
      this.#childSheets = childSheets;
    }
    readonly #childSheets: Set<ManagedStylesheet>;

    override [Symbol.dispose] () {
      this.#childSheets.delete(this);
      super[Symbol.dispose]();
    }
  }

  export abstract class OnDemandRuleSet {
    abstract require (context: DOMContext): () => void;
  }

  export interface Rule {
    set (name: string, value: string): void;
    unset (name: string): void;
    scheduleForDisposal (): void;
    cancelScheduledDisposal (): void;
  }
}

class StyleRule implements ManagedStylesheet.Rule {
  private static readonly cleanupQueue = new Set<StyleRule>();
  private static isCleanupQueued = false;
  private static timeoutHandle: any;
  private static cleanupDelay = 1000;
  private static runCleanupOperation () {
    for (const rule of StyleRule.cleanupQueue) {
      dispose(rule);
    }
    StyleRule.cleanupQueue.clear();
    StyleRule.isCleanupQueued = false;
  }
  private static addToCleanupQueue (rule: StyleRule) {
    StyleRule.cleanupQueue.add(rule);
    if (!StyleRule.isCleanupQueued) {
      StyleRule.isCleanupQueued = true;
      StyleRule.timeoutHandle = setTimeout(StyleRule.runCleanupOperation, StyleRule.cleanupDelay);
    }
  }
  private static removeFromCleanupQueue (rule: StyleRule) {
    if (StyleRule.cleanupQueue.delete(rule) && StyleRule.cleanupQueue.size === 0) {
      clearTimeout(StyleRule.timeoutHandle);
      StyleRule.isCleanupQueued = false;
    }
  }

  constructor (
    protected readonly sheet: CSSStyleSheet,
    protected readonly rule: CSSRule
  ) {}

  #scheduledForDisposal = false;
  scheduleForDisposal () {
    if (this.#scheduledForDisposal) return;
    this.#scheduledForDisposal = true;
    StyleRule.addToCleanupQueue(this);
  }
  cancelScheduledDisposal () {
    if (!this.#scheduledForDisposal) return;
    this.#scheduledForDisposal = false;
    StyleRule.removeFromCleanupQueue(this);
  }

  set (name: string, value: string) {
    const rule = this.rule as CSSStyleRule;
    rule.style.setProperty(name, value);
  }
  unset (name: string) {
    const rule = this.rule as CSSStyleRule;
    rule.style.removeProperty(name);
  }

  #onDisposed: (() => void)[] | undefined;
  onDisposed (onDisposed: () => void): void {
    if (isUndefined(this.#onDisposed)) this.#onDisposed = [onDisposed];
    else this.#onDisposed.push(onDisposed);
  }

  [Symbol.dispose] () {
    const sheet = this.sheet;
    for (let i = 0; i < sheet.cssRules.length; ++i) {
      if (sheet.cssRules.item(i) === this.rule) {
        sheet.deleteRule(i);
        break;
      }
    }
    if (isDefined(this.#onDisposed)) {
      for (const onDisposed of this.#onDisposed) onDisposed();
    }
  }
}

class OnDemandStaticRuleSet extends ManagedStylesheet.OnDemandRuleSet {
  constructor (cssText: string) {
    super();
    this.#cssText = cssText;
  }
  readonly #cssText: string;
  readonly #refs = new Map<ManagedStylesheet, { contexts: Set<DOMContext>; rule: StyleRule }>;

  require (context: DOMContext): () => void {
    const refs = this.#refs;
    const ss = context.stylesheet;
    let ref = refs.get(ss);
    if (isUndefined(ref)) {
      const rule = ss.insertRule(this.#cssText) as StyleRule;
      ref = { contexts: new Set(), rule };
      ref.rule.onDisposed(() => refs.delete(ss));
      refs.set(ss, ref);
    }
    else {
      ref.rule.cancelScheduledDisposal();
    }
    ref.contexts.add(context);
    return disposableFunction(() => {
      if (ref.contexts.delete(context) && ref.contexts.size === 0) {
        ref.rule.scheduleForDisposal();
      }
    });
  }
}

class OnDemandStaticGroupOfRuleSets extends ManagedStylesheet.OnDemandRuleSet {
  constructor (sources: ManagedStylesheet.OnDemandRuleSet[]) {
    super();
    this.#sources = sources;
  }
  readonly #sources: ManagedStylesheet.OnDemandRuleSet[];

  require (context: DOMContext) {
    const releaseFunctions: (() => void)[] = [];
    for (const source of this.#sources) {
      releaseFunctions.push(source.require(context));
    }
    return disposableFunction(releaseFunctions);
  }
}

// Note to the agent: for child branches whose lifespan may be shorter than the parent branch, use child abort
// controllers. Construct them with `createChildAbortController`, passing the parent abort signal as argument. You'll
// get back a new abort controller already bound to the parent signal. If the child branch is no longer needed, abort
// the child controller and get rid of it.

namespace RuleSetInserter {
  // INSTRUCTIONS:
  // - You're going to be unfolding the value of `ruleSetSource` and applying them individually to the `sheet` object.
  export function execute (abortSignal: AbortSignal | null, sheet: CSSStyleSheet, ruleSetSource: ManagedStylesheet.RuleSet): void {
    // TODO.
  }
}
