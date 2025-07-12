import { AssociativeRecordSource, Async, isAssociativeRecordSource, isAsync, isMapSource, isValueSource, MapSource, ValueSource, type AssociativeRecordData, type BasicPrimitiveData, type MapData } from '@xf-common/dynamic';
import { isString } from '@xf-common/general/type-checking';
import type { DOMContext } from './dom-context';

export namespace DataSet {
  export type DataSetType = Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>;

  export function set (context: DOMContext, name: string, value: BasicPrimitiveData): void;
  export function set (context: DOMContext, values: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set (context: DOMContext, arg1: any, arg2?: any): void {
    if (isString(arg1)) {
      const name = arg1 as string;
      const value = arg2 as BasicPrimitiveData;
      setDataItem(context, name, value);
    }
    else {
      const values = arg1 as Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>;
      if (isAsync(values)) return setDataSetFromAsync(context, values);
      setDataSetFromImmediate(context, values);
    }
  }
  export function remove (context: DOMContext, name: string): void;
  export function remove (context: DOMContext, names: Iterable<string>): void;
  export function remove (context: DOMContext, arg1: any): void {
    if (isString(arg1)) {
      const name = arg1 as string;
      removeDataItem(context, name);
    }
    else {
      const names = arg1 as Iterable<string>;
      removeDataSet(context, names);
    }
  }
}

function setDataSetFromAsync (context: DOMContext, values: Async<AssociativeRecordData.Immediate<BasicPrimitiveData> | MapData.Immediate<string, BasicPrimitiveData> | Record<string, BasicPrimitiveData>>) {
  values.then((value) => {
    if (context.isAborted) return;
    setDataSetFromImmediate(context, value);
  });
}

function setDataSetFromImmediate (context: DOMContext, values: Record<string, BasicPrimitiveData> | MapData.Immediate<string, BasicPrimitiveData> | AssociativeRecordData.Immediate<BasicPrimitiveData>) {
  if (values instanceof Map) return setDataSetFromMap(context, values);
  if (isMapSource(values)) return setDataSetFromMapSource(context, values);
  if (isAssociativeRecordSource(values)) return setDataSetFromAssociativeRecordSource(context, values);
  return setDataSetFromPlainRecord(context, values);
}

function setDataSetFromMap (context: DOMContext, values: ReadonlyMap<string, BasicPrimitiveData>, abortControllers?: Map<string, AbortController>) {
  for (const [name, value] of values) {
    setOrUpdateExistingDataItem(context, name, value, abortControllers);
  }
}

function setDataSetFromMapSource (context: DOMContext, source: MapSource<string, BasicPrimitiveData>) {
  const abortControllers = new Map<string, AbortController>();
  MapSource.subscribe(context.abort.signal, source, {
    init: (sub) => setDataSetFromMap(context, sub.__map, abortControllers),
    event: (event) => {
      if (event.add) setDataSetFromMap(context, event.add, abortControllers);
      if (event.change) setDataSetFromMap(context, event.change, abortControllers);
      if (event.delete) removeDataSet(context, event.delete, abortControllers);
    },
  });
}

function setDataSetFromAssociativeRecordSource (context: DOMContext, source: AssociativeRecordSource<BasicPrimitiveData>) {
  const abortControllers = new Map<string, AbortController>();
  AssociativeRecordSource.subscribe(context.abort.signal, source, {
    init: (sub) => setDataSetFromPlainRecord(context, sub.__record, abortControllers),
    event: (event) => {
      if (event.delete) removeDataSet(context, event.delete, abortControllers);
      if (event.change) setDataSetFromPlainRecord(context, event.change, abortControllers);
      if (event.add) setDataSetFromPlainRecord(context, event.add, abortControllers);
    },
  });
}

function setDataSetFromPlainRecord (context: DOMContext, values: Record<string, BasicPrimitiveData>, abortControllers?: Map<string, AbortController>): void {
  for (const name in values) {
    setOrUpdateExistingDataItem(context, name, values[name], abortControllers);
  }
}

function removeDataSet (context: DOMContext, names: Iterable<string>, abortControllers?: Map<string, AbortController>) {
  for (const name of names) {
    removeDataItem(context, name, abortControllers);
  }
}

function setDataItem (context: DOMContext, name: string, value: BasicPrimitiveData, useSubcontext: boolean = false): AbortController | undefined {
  if (isAsync(value)) return setDataItemFromAsync(context, name, value, useSubcontext);
  if (isValueSource(value)) return setDataItemFromValueSource(context, name, value, useSubcontext);
  setDataItemFromLiteralValue(context, name, value);
}

function setDataItemFromLiteralValue (context: DOMContext, name: string, value: BasicPrimitiveData.Literal) {
  if (!isString(value)) value = String(value);
  for (const element of context.domActiveRange.htmlOrSvgElements()) {
    element.dataset[name] = value;
  }
}

function setDataItemFromAsync (context: DOMContext, name: string, async: Async<BasicPrimitiveData.Immediate>, useSubcontext: boolean): AbortController | undefined {
  let abortController: AbortController | undefined;
  if (useSubcontext) {
    abortController = new AbortController();
    context = context.abortable(abortController);
  }
  async.then((value) => {
    if (context.isAborted) return;
    if (isValueSource(value)) return setDataItemFromValueSource(context, name, value, false);
    return setDataItem(context, name, value, false);
  });
  return abortController;
}

function setDataItemFromValueSource (context: DOMContext, name: string, source: BasicPrimitiveData.Dynamic, useSubcontext: boolean): AbortController | undefined {
  let abortController: AbortController | undefined;
  if (useSubcontext) {
    abortController = new AbortController();
    context = context.abortable(abortController);
  }
  ValueSource.subscribe(context.abort.signal, source, (value) => setDataItemFromLiteralValue(context, name, value)).echo();
  return abortController;
}

function removeDataItem (context: DOMContext, name: string, abortControllers?: Map<string, AbortController>) {
  if (abortControllers) {
    const abortController = abortControllers.get(name);
    if (abortController) {
      abortController.abort();
      abortControllers.delete(name);
    }
  }
  for (const element of context.domActiveRange.htmlOrSvgElements()) {
    delete element.dataset[name];
  }
}

function setOrUpdateExistingDataItem (context: DOMContext, name: string, value: BasicPrimitiveData, abortControllers?: Map<string, AbortController>) {
  if (abortControllers) {
    const oldController = abortControllers.get(name);
    if (oldController) {
      oldController.abort();
      const newController = setDataItem(context, name, value, true);
      if (newController) {
        abortControllers.set(name, newController);
      }
      else {
        abortControllers.delete(name);
      }
    }
    else {
      const controller = setDataItem(context, name, value, true);
      if (controller) {
        abortControllers.set(name, controller);
      }
    }
  }
  else {
    setDataItem(context, name, value, false);
  }
}
