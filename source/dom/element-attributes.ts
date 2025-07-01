import { AssociativeRecordSource, Async, isAssociativeRecordSource, isAsync, isMapSource, isValueSource, MapSource, ValueSource, type AssociativeRecordData, type BasicPrimitiveData, type MapData } from '@xf-common/dynamic';
import { isDefined, isString } from '@xf-common/general/type-checking';
import type { DOMContext } from './dom-context';

export namespace Attributes {
  export function set (context: DOMContext, name: string, value: BasicPrimitiveData): void;
  export function set (context: DOMContext, attributes: Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>): void;
  export function set (context: DOMContext, arg1: any, arg2?: any): void {
    if (isString(arg1)) {
      const name = arg1 as string;
      const value = arg2 as BasicPrimitiveData;
      setAttribute(context, name, value, false);
    }
    else {
      const attributes = arg1 as Record<string, BasicPrimitiveData> | MapData<string, BasicPrimitiveData> | AssociativeRecordData<BasicPrimitiveData>;
      if (isAsync(attributes)) return setAttributesFromAsync(context, attributes);
      setAttributesFromImmediate(context, attributes);
    }
  }
  export function remove (context: DOMContext, name: string): void;
  export function remove (context: DOMContext, names: Iterable<string>): void;
  export function remove (context: DOMContext, arg1: any): void {
    if (isString(arg1)) {
      removeAttribute(context, arg1 as string);
    }
    else {
      removeAttributes(context, arg1 as Iterable<string>);
    }
  }
}

function setAttributesFromAsync (context: DOMContext, attributes: Async<AssociativeRecordData.Immediate<BasicPrimitiveData> | MapData.Immediate<string, BasicPrimitiveData> | Record<string, BasicPrimitiveData>>) {
  attributes.then((value) => {
    if (context.isAborted) return;
    setAttributesFromImmediate(context, value);
  });
}

function setAttributesFromImmediate (context: DOMContext, attributes: Record<string, BasicPrimitiveData> | MapData.Immediate<string, BasicPrimitiveData> | AssociativeRecordData.Immediate<BasicPrimitiveData>) {
  if (attributes instanceof Map) return setAttributesFromMap(context, attributes);
  if (isMapSource(attributes)) return setAttributesFromMapSource(context, attributes);
  if (isAssociativeRecordSource(attributes)) return setAttributesFromAssociativeRecordSource(context, attributes);
  return setAttributesFromPlainRecord(context, attributes);
}

function setAttributesFromMapSource (context: DOMContext, source: MapSource<string, BasicPrimitiveData>) {
  const abortControllers = new Map<string, AbortController>();
  MapSource.subscribe(context.abort.signal, source, {
    init: (sub) => setAttributesFromMap(context, sub.__map, abortControllers),
    event: (event) => {
      if (event.add) setAttributesFromMap(context, event.add, abortControllers);
      if (event.change) setAttributesFromMap(context, event.change, abortControllers);
      if (event.delete) removeAttributes(context, event.delete, abortControllers);
    },
  });
}

function setAttributesFromMap (context: DOMContext, attributes: ReadonlyMap<string, BasicPrimitiveData>, abortControllers?: Map<string, AbortController>) {
  for (const [name, value] of attributes) {
    setOrUpdateExistingAttribute(context, name, value, abortControllers);
  }
}

function setAttributesFromAssociativeRecordSource (context: DOMContext, source: AssociativeRecordSource<BasicPrimitiveData>) {
  const abortControllers = new Map<string, AbortController>();
  AssociativeRecordSource.subscribe(context.abort.signal, source, {
    init: (sub) => setAttributesFromPlainRecord(context, sub.__record, abortControllers),
    event: (event) => {
      if (event.delete) removeAttributes(context, event.delete, abortControllers);
      if (event.change) setAttributesFromPlainRecord(context, event.change, abortControllers);
      if (event.add) setAttributesFromPlainRecord(context, event.add, abortControllers);
    },
  });
}

function setAttributesFromPlainRecord (context: DOMContext, attributes: Record<string, BasicPrimitiveData>, abortControllers?: Map<string, AbortController>): void {
  for (const name in attributes) {
    setOrUpdateExistingAttribute(context, name, attributes[name], abortControllers);
  }
}

function setOrUpdateExistingAttribute (context: DOMContext, name: string, value: BasicPrimitiveData, abortControllers?: Map<string, AbortController>) {
  if (abortControllers) {
    const oldController = abortControllers.get(name);
    if (oldController) {
      oldController.abort();
      const newController = setAttribute(context, name, value, true);
      if (newController) {
        abortControllers.set(name, newController);
      }
      else {
        abortControllers.delete(name);
      }
    }
    else {
      const controller = setAttribute(context, name, value, true);
      if (controller) {
        abortControllers.set(name, controller);
      }
    }
  }
  else {
    setAttribute(context, name, value, false);
  }
}

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

function setAttribute (context: DOMContext, name: string, value: BasicPrimitiveData, useSubcontext: boolean): AbortController | undefined {
  const qname = qualifyAttributeName(name);
  return setQualifiedAttribute(context, qname[0], qname[1], value, useSubcontext);
}

function setQualifiedAttribute (context: DOMContext, namespace: string | null, name: string, value: BasicPrimitiveData, useSubcontext: boolean): AbortController | undefined {
  if (isAsync(value)) return setQualifiedAttributeFromAsync(context, namespace, name, value, useSubcontext);
  if (isValueSource(value)) return setQualifiedAttributeFromValueSource(context, namespace, name, value, useSubcontext);
  setQualifiedAttributeFromLiteralValue(context, namespace, name, value);
}

function setQualifiedAttributeFromLiteralValue (context: DOMContext, namespace: string | null, name: string, value: BasicPrimitiveData.Literal) {
  if (!isString(value)) value = String(value);
  for (const element of context.domActiveRange.elements()) {
    element.setAttributeNS(namespace, name, value);
  }
}

function setQualifiedAttributeFromAsync (context: DOMContext, namespace: string | null, name: string, async: Async<BasicPrimitiveData.Immediate>, useSubcontext: boolean): AbortController | undefined {
  let abortController: AbortController | undefined;
  if (useSubcontext) {
    abortController = new AbortController();
    context = context.abortable(abortController);
  }
  async.then((value) => {
    if (context.isAborted) return;
    if (isValueSource(value)) return setQualifiedAttributeFromValueSource(context, namespace, name, value, false);
    return setQualifiedAttribute(context, namespace, name, value, false);
  });
  return abortController;
}

function setQualifiedAttributeFromValueSource (context: DOMContext, namespace: string | null, name: string, source: BasicPrimitiveData.Dynamic, useSubcontext: boolean): AbortController | undefined {
  let abortController: AbortController | undefined;
  if (useSubcontext) {
    abortController = new AbortController();
    context = context.abortable(abortController);
  }
  ValueSource.subscribe(context.abort.signal, source, (value) => setQualifiedAttributeFromLiteralValue(context, namespace, name, value)).echo();
  return abortController;
}

function removeAttributes (context: DOMContext, names: Iterable<string>, abortControllers?: Map<string, AbortController>) {
  for (const name of names) {
    removeAttribute(context, name, abortControllers);
  }
}

function removeAttribute (context: DOMContext, name: string, abortControllers?: Map<string, AbortController>) {
  if (abortControllers) {
    const abortController = abortControllers.get(name);
    if (abortController) {
      abortController.abort();
      abortControllers.delete(name);
    }
  }
  const qname = qualifyAttributeName(name);
  removeQualifiedAttribute(context, qname[0], qname[1]);
}

function removeQualifiedAttribute (context: DOMContext, namespace: string | null, name: string) {
  for (const element of context.domActiveRange.elements()) {
    element.removeAttributeNS(namespace, name);
  }
}
