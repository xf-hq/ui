import { ValueSource, type StringSource } from '@xf-common/dynamic';
import { renderMarkdownToHtmlSync } from '../markdown/markdown-helpers';
import type { DOMContext } from './dom-context';
import { DOMLocationPointer, isDOMLocationPointer } from './dom-location-pointer';
import { DOMNodeRange, isDOMNodeRange } from './dom-node-range';

export function appendDynamicMarkdown (location: DOMContext | DOMLocationPointer | DOMNodeRange | Element, source: StringSource, options?: DynamicMarkdownOptions): Disposable {
  const containerElement = document.createElement('div');
  containerElement.style.display = 'contents';
  if (location instanceof Element) location.appendChild(containerElement);
  else if (isDOMLocationPointer(location)) location.append(containerElement);
  else if (isDOMNodeRange(location)) location.lastActiveElementRequired.appendChild(containerElement);
  else location.domInsertionLocation.append(containerElement);
  return source.subscribe(new TextReceiver(containerElement, options));
}

class TextReceiver implements ValueSource.Receiver<string, []> {
  constructor (
    private readonly containerElement: Element,
    private readonly options?: DynamicMarkdownOptions,
  ) {}
  #subscription: ValueSource.Subscription<string>;
  #log: { value: boolean; html: boolean };
  init (subscription: ValueSource.Subscription<string>): void {
    this.#subscription = subscription;
    const log = { value: false, html: false };
    const options = this.options;
    if (options?.log) {
      if (typeof options.log === 'boolean') log.value = log.html = options.log;
      else Object.assign(log, options.log);
    }
    this._render(subscription.value);
  }
  event (value: string): void {
    this._render(value);
  }

  private _render (value: string): void {
    // let msg: ConsoleMessage | undefined;
    // if (this.#log.value || this.#log.html) msg = cmsg.std.squareBracketed(cmsg.std.mc.lightBlue('appendDynamicMarkdown')).setMode('group').beginPrint();
    // if (this.#log.value) cmsg.std.punctuated([cmsg.std.mc.green('Markdown'), ':']).printGroup(() => console.log(value));
    const html = renderMarkdownToHtmlSync(value);
    this.containerElement.innerHTML = html;
    // if (this.#log.html) cmsg.std.punctuated([cmsg.std.mc.green('HTML'), ':']).printGroup(() => console.log(html));
    // msg?.endPrint();
  }
}

export interface DynamicMarkdownOptions {
  log?: boolean | {
    value?: boolean;
    html?: boolean;
  };
}