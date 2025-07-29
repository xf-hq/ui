import { StringSource } from '@xf-common/dynamic';

/**
 * Creates a {@link StringSource `StringSource`} whose value is taken from an HTML element, updating whenever the user
 * modifies the element's content.
 *
 * For input and textarea elements, tracks the `value` property. For other elements, contentEditable is assumed and so
 * the `textContent` property is tracked.
 *
 * The StringSource becomes active when observed and inactive when no longer observed, automatically managing event
 * listeners to avoid memory leaks.
 *
 * @param element The HTML element to track.
 * @returns A StringSource whose current value is either the `value` property if the element is an INPUT or TEXTAREA,
 *          or the `textContent` property otherwise (assuming contentEditable).
 */
export function htmlElementToStringSource (element: HTMLElement): StringSource.Immediate {
  const readValue = (
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? readTextInputValue(element) :
    readContentEditableValue(element)
  );
  const demandObserver = new createStringValueSourceFromInputEvent_onDemandChanged(element, 'input', readValue);
  return StringSource.create(readValue(), demandObserver);
}
class createStringValueSourceFromInputEvent_onDemandChanged implements StringSource.DemandObserver {
  constructor (
    private readonly element: HTMLElement,
    private readonly eventType: string,
    private readonly readValue: () => string
  ) {}
  #abort: AbortController;

  online (source: StringSource.Manual): void {
    this.#abort = new AbortController();
    source.set(this.readValue());
    this.element.addEventListener(this.eventType, () => source.set(this.readValue()), { signal: this.#abort.signal });
  }

  offline (source: StringSource.Manual): void {
    this.#abort.abort();
    source.set('');
  }
}
const readTextInputValue = (element: HTMLInputElement | HTMLTextAreaElement) => () => element.value;
const readContentEditableValue = (element: HTMLElement) => () => element.textContent ?? '';
