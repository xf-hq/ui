import { AssociativeRecordSource, Async, isAssociativeRecordSource, isAsync, isMapSource, isValueSource, MapSource, ValueSource, type AssociativeRecordData, type BasicPrimitiveData, type MapData } from '@xf-common/dynamic';
import { isString } from '@xf-common/general/type-checking';
import type { DOMContext } from './dom-context';

export namespace Styles {
  export type StylesType = Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>;

  export function set (context: DOMContext, name: string, value: BasicPrimitiveData): void;
  export function set (context: DOMContext, styles: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set (context: DOMContext, arg1: any, arg2?: any): void {
    if (isString(arg1)) {
      const name = arg1 as string;
      const value = arg2 as BasicPrimitiveData;
      setStyle(context, name, value);
    }
    else {
      const styles = arg1 as Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>;
      if (isAsync(styles)) return setStylesFromAsync(context, styles);
      setStylesFromImmediate(context, styles);
    }
  }
  export function remove (context: DOMContext, name: string): void;
  export function remove (context: DOMContext, names: Iterable<string>): void;
  export function remove (context: DOMContext, arg1: any): void {
    if (isString(arg1)) {
      const name = arg1 as string;
      removeStyle(context, name);
    }
    else {
      const names = arg1 as Iterable<string>;
      removeStyles(context, names);
    }
  }
}

function setStylesFromAsync (context: DOMContext, styles: Async<AssociativeRecordData.Immediate<BasicPrimitiveData> | MapData.Immediate<string, BasicPrimitiveData> | Record<string, BasicPrimitiveData>>) {
  styles.then((value) => {
    if (context.isAborted) return;
    setStylesFromImmediate(context, value);
  });
}

function setStylesFromImmediate (context: DOMContext, styles: Record<string, BasicPrimitiveData> | MapData.Immediate<string, BasicPrimitiveData> | AssociativeRecordData.Immediate<BasicPrimitiveData>) {
  if (styles instanceof Map) return setStylesFromMap(context, styles);
  if (isMapSource(styles)) return setStylesFromMapSource(context, styles);
  if (isAssociativeRecordSource(styles)) return setStylesFromAssociativeRecordSource(context, styles);
  return setStylesFromPlainRecord(context, styles);
}

function setStylesFromMap (context: DOMContext, styles: ReadonlyMap<string, BasicPrimitiveData>, abortControllers?: Map<string, AbortController>) {
  for (const [name, value] of styles) {
    setOrUpdateExistingStyle(context, name, value, abortControllers);
  }
}

function setStylesFromMapSource (context: DOMContext, source: MapSource<string, BasicPrimitiveData>) {
  const abortControllers = new Map<string, AbortController>();
  MapSource.subscribe(context.abort.signal, source, {
    init: (sub) => setStylesFromMap(context, sub.__map, abortControllers),
    event: (event) => {
      if (event.add) setStylesFromMap(context, event.add, abortControllers);
      if (event.change) setStylesFromMap(context, event.change, abortControllers);
      if (event.delete) removeStyles(context, event.delete, abortControllers);
    },
  });
}

function setStylesFromAssociativeRecordSource (context: DOMContext, source: AssociativeRecordSource<BasicPrimitiveData>) {
  const abortControllers = new Map<string, AbortController>();
  AssociativeRecordSource.subscribe(context.abort.signal, source, {
    init: (sub) => setStylesFromPlainRecord(context, sub.__record, abortControllers),
    event: (event) => {
      if (event.delete) removeStyles(context, event.delete, abortControllers);
      if (event.change) setStylesFromPlainRecord(context, event.change, abortControllers);
      if (event.add) setStylesFromPlainRecord(context, event.add, abortControllers);
    },
  });
}

function setStylesFromPlainRecord (context: DOMContext, styles: Record<string, BasicPrimitiveData>, abortControllers?: Map<string, AbortController>): void {
  for (const name in styles) {
    setOrUpdateExistingStyle(context, name, styles[name], abortControllers);
  }
}

function removeStyles (context: DOMContext, names: Iterable<string>, abortControllers?: Map<string, AbortController>) {
  for (const name of names) {
    removeStyle(context, name, abortControllers);
  }
}

function setStyle (context: DOMContext, name: string, value: BasicPrimitiveData, useSubcontext: boolean = false): AbortController | undefined {
  if (isAsync(value)) return setStyleFromAsync(context, name, value, useSubcontext);
  if (isValueSource(value)) return setStyleFromValueSource(context, name, value, useSubcontext);
  setStyleFromLiteralValue(context, name, value);
}

function setStyleFromLiteralValue (context: DOMContext, name: string, value: BasicPrimitiveData.Literal) {
  if (!isString(value)) value = String(value);
  for (const element of context.domActiveRange.styleableElements()) {
    element.style.setProperty(name, value);
  }
}

function setStyleFromAsync (context: DOMContext, name: string, async: Async<BasicPrimitiveData.Immediate>, useSubcontext: boolean): AbortController | undefined {
  let abortController: AbortController | undefined;
  if (useSubcontext) {
    abortController = new AbortController();
    context = context.abortable(abortController);
  }
  async.then((value) => {
    if (context.isAborted) return;
    if (isValueSource(value)) return setStyleFromValueSource(context, name, value, false);
    return setStyle(context, name, value, false);
  });
  return abortController;
}

function setStyleFromValueSource (context: DOMContext, name: string, source: BasicPrimitiveData.Dynamic, useSubcontext: boolean): AbortController | undefined {
  let abortController: AbortController | undefined;
  if (useSubcontext) {
    abortController = new AbortController();
    context = context.abortable(abortController);
  }
  ValueSource.subscribe(context.abort.signal, source, (value) => setStyleFromLiteralValue(context, name, value)).echo();
  return abortController;
}

function removeStyle (context: DOMContext, name: string, abortControllers?: Map<string, AbortController>) {
  if (abortControllers) {
    const abortController = abortControllers.get(name);
    if (abortController) {
      abortController.abort();
      abortControllers.delete(name);
    }
  }
  for (const element of context.domActiveRange.styleableElements()) {
    element.style.removeProperty(name);
  }
}

function setOrUpdateExistingStyle (context: DOMContext, name: string, value: BasicPrimitiveData, abortControllers?: Map<string, AbortController>) {
  if (abortControllers) {
    const oldController = abortControllers.get(name);
    if (oldController) {
      oldController.abort();
      const newController = setStyle(context, name, value, true);
      if (newController) {
        abortControllers.set(name, newController);
      }
      else {
        abortControllers.delete(name);
      }
    }
    else {
      const controller = setStyle(context, name, value, true);
      if (controller) {
        abortControllers.set(name, controller);
      }
    }
  }
  else {
    setStyle(context, name, value, false);
  }
}
