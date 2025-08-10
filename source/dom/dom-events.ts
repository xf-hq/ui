import { Subscribable } from '@xf-common/dynamic';
import { disposableFunction, disposeOnAbort } from '@xf-common/general/disposables';
import type { DOMNodeRange } from './dom-node-range';
import type { DOMContext } from './dom-context';

export const OnClick: <A extends any[]>(context: DOMContext, ...args: A) => Subscribable<A> = Subscribable.OnDemand<any, [context: DOMContext, ...args: any]>((out, context, ...args) => context.onClick(() => out.event(...args)));
export const OnClickOrTap: <A extends any[]>(context: DOMContext, ...args: A) => Subscribable<A> = Subscribable.OnDemand<any, [context: DOMContext, ...args: any]>((out, context, ...args) => context.onClickOrTap(() => out.event(...args)));

/**
 * Adds click event listeners to the specified DOM node range.
 * @param dom The DOM node range to attach the event listeners to.
 * @param listener The event listener to call when a click event occurs.
 * @param options Optional configuration options.
 * @returns A disposable function that removes the event listeners.
 */
export function onClick (dom: DOMNodeRange, listener: (event: MouseEvent) => void, options?: { signal?: AbortSignal }): DisposableFunction {
  const elements = Array.from(dom.elements());
  const cleanupFunctions: (() => void)[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    const clickHandler = (event: MouseEvent) => listener(event);
    element.addEventListener('click', clickHandler);
    cleanupFunctions.push(() => {
      element.removeEventListener('click', clickHandler);
    });
  }

  const dispose = disposableFunction(cleanupFunctions);
  if (options?.signal) disposeOnAbort(options.signal, dispose);
  return dispose;
}

/**
 * Adds click/tap event handlers that work across mouse and touch devices.
 * @param dom The DOM node range to attach the event listeners to.
 * @param listener The event listener to call when a click/tap event occurs.
 * @param options Optional configuration options.
 * @returns A disposable function that removes the event listeners.
 */
export function onClickOrTap (dom: DOMNodeRange, listener: (event: MouseEvent | TouchEvent) => void, options?: { signal?: AbortSignal }) {
  const elements = Array.from(dom.elements());
  const cleanupFunctions: (() => void)[] = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];

    const clickHandler = (event: MouseEvent) => listener(event);
    const touchHandler = (event: TouchEvent) => {
      // Prevent the subsequent click event on touch devices
      event.preventDefault();
      listener(event);
    };

    element.addEventListener('click', clickHandler);
    element.addEventListener('touchend', touchHandler);

    cleanupFunctions.push(() => {
      element.removeEventListener('click', clickHandler);
      element.removeEventListener('touchend', touchHandler);
    });
  }

  const dispose = disposableFunction(cleanupFunctions);
  if (options?.signal) disposeOnAbort(options.signal, dispose);
  return dispose;
}
