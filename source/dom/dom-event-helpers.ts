import { StringSource } from '@xf-common/dynamic';

export function createStringValueSourceFromHTMLElementEvent (element: HTMLElement): StringSource {
  const readValue = (
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? readTextInputValue(element) :
    readContentEditableValue(element)
  );
  const source = StringSource.create('', new createStringValueSourceFromInputEvent_onDemandChanged(element, 'input', readValue));
  return source;
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
