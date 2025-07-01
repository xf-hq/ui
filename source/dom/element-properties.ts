import { AssociativeRecordSource, Async, isAssociativeRecordSource, isAsync, isMapSource, isValueSource, MapSource, ValueSource, type AssociativeRecordData, type BasicPrimitiveData, type MapData } from '@xf-common/dynamic';
import { isString } from '@xf-common/general/type-checking';
import type { DOMContext } from './dom-context';

export namespace Properties {
  export type PropertiesType = Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>;

  export function set (context: DOMContext, name: string, value: BasicPrimitiveData): void;
  export function set (context: DOMContext, properties: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set (context: DOMContext, arg1: any, arg2?: any): void {
    if (isString(arg1)) {
      const name = arg1 as string;
      const value = arg2 as BasicPrimitiveData;
      setProperty(context, name, value);
    }
    else {
      const properties = arg1 as Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>;
      if (isAsync(properties)) return setPropertiesFromAsync(context, properties);
      setPropertiesFromImmediate(context, properties);
    }
  }
  export function unset (context: DOMContext, name: string): void;
  export function unset (context: DOMContext, names: Iterable<string>): void;
  export function unset (context: DOMContext, arg1: any): void {
    if (isString(arg1)) {
      const name = arg1 as string;
      removeProperty(context, name);
    }
    else {
      const names = arg1 as Iterable<string>;
      removeProperties(context, names);
    }
  }
}

function setPropertiesFromAsync (context: DOMContext, properties: Async<AssociativeRecordData.Immediate<BasicPrimitiveData> | MapData.Immediate<string, BasicPrimitiveData> | Record<string, BasicPrimitiveData>>) {
  properties.then((value) => {
    if (context.isAborted) return;
    setPropertiesFromImmediate(context, value);
  });
}

function setPropertiesFromImmediate (context: DOMContext, properties: Record<string, BasicPrimitiveData> | MapData.Immediate<string, BasicPrimitiveData> | AssociativeRecordData.Immediate<BasicPrimitiveData>) {
  if (properties instanceof Map) return setPropertiesFromMap(context, properties);
  if (isMapSource(properties)) return setPropertiesFromMapSource(context, properties);
  if (isAssociativeRecordSource(properties)) return setPropertiesFromAssociativeRecordSource(context, properties);
  return setPropertiesFromPlainRecord(context, properties);
}

function setPropertiesFromMap (context: DOMContext, properties: ReadonlyMap<string, BasicPrimitiveData>, abortControllers?: Map<string, AbortController>) {
  for (const [name, value] of properties) {
    setOrUpdateExistingProperty(context, name, value, abortControllers);
  }
}

function setPropertiesFromMapSource (context: DOMContext, source: MapSource<string, BasicPrimitiveData>) {
  const abortControllers = new Map<string, AbortController>();
  MapSource.subscribe(context.abort.signal, source, {
    init: (sub) => setPropertiesFromMap(context, sub.__map, abortControllers),
    event: (event) => {
      if (event.add) setPropertiesFromMap(context, event.add, abortControllers);
      if (event.change) setPropertiesFromMap(context, event.change, abortControllers);
      if (event.delete) removeProperties(context, event.delete, abortControllers);
    },
  });
}

function setPropertiesFromAssociativeRecordSource (context: DOMContext, source: AssociativeRecordSource<BasicPrimitiveData>) {
  const abortControllers = new Map<string, AbortController>();
  AssociativeRecordSource.subscribe(context.abort.signal, source, {
    init: (sub) => setPropertiesFromPlainRecord(context, sub.__record, abortControllers),
    event: (event) => {
      if (event.delete) removeProperties(context, event.delete, abortControllers);
      if (event.change) setPropertiesFromPlainRecord(context, event.change, abortControllers);
      if (event.add) setPropertiesFromPlainRecord(context, event.add, abortControllers);
    },
  });
}

function setPropertiesFromPlainRecord (context: DOMContext, properties: Record<string, BasicPrimitiveData>, abortControllers?: Map<string, AbortController>) {
  for (const name in properties) {
    setOrUpdateExistingProperty(context, name, properties[name], abortControllers);
  }
}

function setOrUpdateExistingProperty (context: DOMContext, name: string, value: BasicPrimitiveData, abortControllers?: Map<string, AbortController>) {
  if (abortControllers) {
    const oldController = abortControllers.get(name);
    if (oldController) {
      oldController.abort();
      const newController = setProperty(context, name, value, true);
      if (newController) {
        abortControllers.set(name, newController);
      }
      else {
        abortControllers.delete(name);
      }
    }
    else {
      const controller = setProperty(context, name, value, true);
      if (controller) {
        abortControllers.set(name, controller);
      }
    }
  }
  else {
    setProperty(context, name, value, false);
  }
}

function removeProperties (context: DOMContext, names: Iterable<string>, abortControllers?: Map<string, AbortController>) {
  for (const name of names) {
    removeProperty(context, name, abortControllers);
  }
}

function setProperty (context: DOMContext, name: string, value: BasicPrimitiveData, useSubcontext: boolean = false): AbortController | undefined {
  if (isAsync(value)) return setPropertyFromAsync(context, name, value, useSubcontext);
  if (isValueSource(value)) return setPropertyFromValueSource(context, name, value, useSubcontext);
  setPropertyFromLiteralValue(context, name, value);
}

function setPropertyFromLiteralValue (context: DOMContext, name: string, value: BasicPrimitiveData.Literal) {
  for (const element of context.domActiveRange.elements()) {
    element[name] = value;
  }
}

function setPropertyFromAsync (context: DOMContext, name: string, async: Async<BasicPrimitiveData.Immediate>, useSubcontext: boolean): AbortController | undefined {
  let abortController: AbortController | undefined;
  if (useSubcontext) {
    abortController = new AbortController();
    context = context.abortable(abortController);
  }
  async.then((value) => {
    if (context.isAborted) return;
    if (isValueSource(value)) return setPropertyFromValueSource(context, name, value, false);
    return setProperty(context, name, value, false);
  });
  return abortController;
}

function setPropertyFromValueSource (context: DOMContext, name: string, source: BasicPrimitiveData.Dynamic, useSubcontext: boolean): AbortController | undefined {
  let abortController: AbortController | undefined;
  if (useSubcontext) {
    abortController = new AbortController();
    context = context.abortable(abortController);
  }
  ValueSource.subscribe(context.abort.signal, source, (value) => setPropertyFromLiteralValue(context, name, value)).echo();
  return abortController;
}

function removeProperty (context: DOMContext, name: string, abortControllers?: Map<string, AbortController>) {
  if (abortControllers) {
    const abortController = abortControllers.get(name);
    if (abortController) {
      abortController.abort();
      abortControllers.delete(name);
    }
  }
  for (const element of context.domActiveRange.elements()) {
    delete element[name];
  }
}
