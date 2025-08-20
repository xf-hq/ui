import { AssociativeRecordSource, Async, isAssociativeRecordSource, isAsync, isExplicitAsyncData, isMapSource, isValueSource, MapSource, type AssociativeRecordData, type AsyncData, type BasicPrimitiveData, type MapData } from '@xf-common/dynamic';
import { isOnDemandAsync, OnDemandAsync } from '@xf-common/dynamic/async/on-demand-async';
import { DisposableGroup, tryDispose } from '@xf-common/general/disposables';
import { isString } from '@xf-common/general/type-checking';
import type { DOMContext } from './dom-context';

export namespace Properties {
  export function set (context: DOMContext, name: string, value: BasicPrimitiveData): void;
  export function set (context: DOMContext, properties: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set (context: DOMContext, arg1: any, arg2?: any): void {
    ElementAssignableAspects.set(context, DRIVER, arg1, arg2);
  }
  export function unset (context: DOMContext, name: string): void;
  export function unset (context: DOMContext, names: Iterable<string>): void;
  export function unset (context: DOMContext, arg1: any): void {
    ElementAssignableAspects.unset(context, DRIVER, arg1);
  }

  const DRIVER: ElementAssignableAspects.Driver<Element> = {
    elements: (context) => context.domActiveRange.elements(),
    assign: (element, name, value) => element[name] = String(value),
    unassign: (element, name) => delete element[name],
  };
}

export namespace Attributes {
  export function set (context: DOMContext, name: string, value: BasicPrimitiveData): void;
  export function set (context: DOMContext, attributes: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set (context: DOMContext, arg1: any, arg2?: any): void {
    ElementAssignableAspects.set(context, DRIVER, arg1, arg2);
  }
  export function remove (context: DOMContext, name: string): void;
  export function remove (context: DOMContext, names: Iterable<string>): void;
  export function remove (context: DOMContext, arg1: any): void {
    ElementAssignableAspects.unset(context, DRIVER, arg1);
  }

  const DRIVER: ElementAssignableAspects.Driver<Element> = {
    elements: (context) => context.domActiveRange.elements(),
    assign: (element, name, value) => {
      const [ns, _name] = qualifyAttributeName(name);
      element.setAttributeNS(ns, _name, String(value));
    },
    unassign: (element, name) => {
      const [ns, _name] = qualifyAttributeName(name);
      element.removeAttributeNS(ns, _name);
    },
  };
  function qualifyAttributeName (name: string): [namespace: string | null, name: string] {
    const i_colon = name.indexOf(':');
    if (i_colon === -1) return [null, name];
    const prefix = name.slice(0, i_colon);
    let namespace: string | null;
    switch (prefix) {
      case 'svg': namespace = 'http://www.w3.org/2000/svg'; break;
      case 'xlink': namespace = 'http://www.w3.org/1999/xlink'; break;
      case 'xml': namespace = 'http://www.w3.org/XML/1998/namespace'; break;
      case 'xmlns': namespace = 'http://www.w3.org/2000/xmlns/'; break;
      default: return [null, name];
    }
    return [namespace, name.slice(i_colon + 1)];
  }
}

export namespace Styles {
  export function set (context: DOMContext, name: string, value: BasicPrimitiveData): void;
  export function set (context: DOMContext, styles: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set (context: DOMContext, arg1: any, arg2?: any): void {
    ElementAssignableAspects.set(context, DRIVER, arg1, arg2);
  }
  export function remove (context: DOMContext, name: string): void;
  export function remove (context: DOMContext, names: Iterable<string>): void;
  export function remove (context: DOMContext, arg1: any): void {
    ElementAssignableAspects.unset(context, DRIVER, arg1);
  }

  const DRIVER: ElementAssignableAspects.Driver<Element & ElementCSSInlineStyle> = {
    elements: (context) => context.domActiveRange.styleableElements(),
    assign: (element, name, value) => {
      element.style.setProperty(name, String(value));
    },
    unassign: (element, name) => {
      element.style.removeProperty(name);
    },
  };
}

export namespace DataSet {
  export function set (context: DOMContext, name: string, value: BasicPrimitiveData): void;
  export function set (context: DOMContext, values: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set (context: DOMContext, arg1: any, arg2?: any): void {
    ElementAssignableAspects.set(context, DRIVER, arg1, arg2);
  }
  export function remove (context: DOMContext, name: string): void;
  export function remove (context: DOMContext, names: Iterable<string>): void;
  export function remove (context: DOMContext, arg1: any): void {
    ElementAssignableAspects.unset(context, DRIVER, arg1);
  }

  const DRIVER: ElementAssignableAspects.Driver<HTMLElement | SVGElement> = {
    elements: (context) => context.domActiveRange.htmlOrSvgElements(),
    assign: (element, name, value) => {
      element.dataset[name] = String(value);
    },
    unassign: (element, name) => {
      delete element.dataset[name];
    },
  };
}

export namespace ElementAssignableAspects {
  export interface Driver<E extends Element> {
    elements (context: DOMContext): Iterable<E>;
    assign (element: E, name: string, value: any): void;
    unassign (element: E, name: string): void;
  }

  export function set<E extends Element> (context: DOMContext, driver: Driver<E>, name: string, value: BasicPrimitiveData): void;
  export function set<E extends Element> (context: DOMContext, driver: Driver<E>, values: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set<E extends Element> (context: DOMContext, driver: Driver<E>, arg1: any, arg2?: any): void {
    if (isString(arg1)) {
      const name = arg1 as string;
      const value = arg2 as BasicPrimitiveData;
      assignAspect(new State(driver, context), name, value);
    }
    else {
      const values = arg1 as Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>;
      if (isExplicitAsyncData(values)) return assignValuesFromExplicitAsync(new State(driver, context), values);
      assignValuesFromNonAsync(new State(driver, context), values);
    }
  }
  export function unset<E extends Element> (context: DOMContext, driver: Driver<E>, name: string): void;
  export function unset<E extends Element> (context: DOMContext, driver: Driver<E>, names: Iterable<string>): void;
  export function unset<E extends Element> (context: DOMContext, driver: Driver<E>, arg1: any): void {
    if (isString(arg1)) {
      for (const element of driver.elements(context)) {
        driver.unassign(element, arg1);
      }
    }
    else {
      for (const name of arg1 as Iterable<string>) {
        for (const element of driver.elements(context)) {
          driver.unassign(element, name);
        }
      }
    }
  }
}

class State<E extends Element> implements Disposable {
  constructor (
    private readonly driver: ElementAssignableAspects.Driver<E>,
    private readonly context: DOMContext,
    private readonly parent?: State<E>,
  ) {}
  #disposables?: DisposableGroup;
  #disposed = false;

  get disposables () { return this.#disposables ??= new DisposableGroup(); }
  get isDisposed () { return this.#disposed; }

  // register (name: string, target) {
  //   this.disposables.set(name, target);
  // }
  dispose (name: string) {
    this.#disposables?.delete(name);
  }
  assign (name: string, value: BasicPrimitiveData) {
    for (const element of this.driver.elements(this.context)) {
      this.driver.assign(element, name, value);
    }
  }
  unassign (name: string) {
    for (const element of this.driver.elements(this.context)) {
      this.driver.unassign(element, name);
    }
  }
  createChild () {
    const state = new State(this.driver, this.context, this);
    this.disposables.add(state);
    return state;
  }

  [Symbol.dispose] () {
    if (this.#disposed) return;
    this.#disposed = true;
    this.parent?.disposables.delete(this);
    tryDispose(this.#disposables);
  }
}

function assignValuesFromExplicitAsync<E extends Element> (state: State<E>, values: AsyncData<AssociativeRecordData.NotAsync<BasicPrimitiveData> | MapData.NotAsync<string, BasicPrimitiveData> | Record<string, BasicPrimitiveData>>) {
  let async: Async<AssociativeRecordData.NotAsync<BasicPrimitiveData> | MapData.NotAsync<string, BasicPrimitiveData> | Record<string, BasicPrimitiveData>>;
  if (isOnDemandAsync(values)) {
    async = values.require();
    state.disposables.add(async);
  }
  else {
    async = values;
  }
  async.then((value) => {
    if (state.isDisposed) return;
    assignValuesFromNonAsync(state, value);
  });
}

function assignValuesFromNonAsync<E extends Element> (state: State<E>, values: Record<string, BasicPrimitiveData> | MapData.NotAsync<string, BasicPrimitiveData> | AssociativeRecordData.NotAsync<BasicPrimitiveData>) {
  if (values instanceof Map) return assignValuesFromMap(state, values, false);
  if (isMapSource(values)) return assignValuesFromMapSource(state, values);
  if (isAssociativeRecordSource(values)) return assignValuesFromAssociativeRecordSource(state, values);
  return assignValuesFromPlainRecord(state, values, false);
}

function assignValuesFromMapSource<E extends Element> (state: State<E>, source: MapSource<string, BasicPrimitiveData>) {
  const subscription = source.subscribe({
    init: (sub) => assignValuesFromMap(state, sub.__map, false),
    event: (event) => {
      if (event.add) assignValuesFromMap(state, event.add, false);
      if (event.change) assignValuesFromMap(state, event.change, true);
      if (event.delete) removeAndDisposeValues(state, event.delete);
    },
  });
  state.disposables.add(subscription);
}

function assignValuesFromMap<E extends Element> (state: State<E>, values: ReadonlyMap<string, BasicPrimitiveData>, disposeOld: boolean) {
  for (const [name, value] of values) {
    state.dispose(name);
    assignAspect(state, name, value);
  }
}

function assignValuesFromAssociativeRecordSource<E extends Element> (state: State<E>, source: AssociativeRecordSource<BasicPrimitiveData>) {
  const subscription = source.subscribe({
    init: (sub) => assignValuesFromPlainRecord(state, sub.__record, false),
    event: (event) => {
      if (event.add) assignValuesFromPlainRecord(state, event.add, false);
      if (event.change) assignValuesFromPlainRecord(state, event.change, true);
      if (event.delete) removeAndDisposeValues(state, event.delete);
    },
  });
  state.disposables.add(subscription);
}

function assignValuesFromPlainRecord<E extends Element> (state: State<E>, values: Record<string, BasicPrimitiveData>, disposeOld: boolean): void {
  for (const name in values) {
    if (disposeOld) state.dispose(name);
    assignAspect(state, name, values[name]);
  }
}

function assignAspect<E extends Element> (state: State<E>, name: string, value: BasicPrimitiveData) {
  if (isOnDemandAsync(value)) return assignAspectFromOnDemandAsync(state, name, value);
  if (isAsync(value)) return assignAspectFromAsync(state, name, value);
  if (isValueSource(value)) return assignAspectFromValueSource(state, name, value);
  if (!isString(value)) value = String(value);
  state.assign(name, value);
}

function assignAspectFromOnDemandAsync<E extends Element> (state: State<E>, name: string, source: OnDemandAsync<BasicPrimitiveData>) {
  const async = source.require();
  state.disposables.set(name, async);
  return assignAspectFromAsync(state.createChild(), name, async);
}

function assignAspectFromAsync<E extends Element> (state: State<E>, name: string, source: Async<BasicPrimitiveData>) {
  source.then((value) => {
    if (state.isDisposed) return;
    if (isValueSource(value)) return assignAspectFromValueSource(state, name, value);
    return assignAspect(state, name, value);
  });
}

function assignAspectFromValueSource<E extends Element> (state: State<E>, name: string, source: BasicPrimitiveData.Dynamic) {
  const subscription = source.subscribe((value) => state.assign(name, value));
  state.disposables.set(name, subscription, true);
  subscription.echo();
}

function removeAndDisposeValues<E extends Element> (state: State<E>, names: Iterable<string>) {
  for (const name of names) {
    state.dispose(name);
    state.unassign(name);
  }
}
