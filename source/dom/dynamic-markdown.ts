import type { StringSource } from '@xf-common/dynamic';
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
  return source.subscribe((sub) => {
    const log = { value: false, html: false };
    if (options?.log) {
      if (typeof options.log === 'boolean') log.value = log.html = options.log;
      else Object.assign(log, options.log);
    }
    const render = (value: string) => {
      // let msg: ConsoleMessage | undefined;
      // if (log.value || log.html) msg = cmsg.std.squareBracketed(cmsg.std.mc.lightBlue('appendDynamicMarkdown')).setMode('group').beginPrint();
      // if (log.value) cmsg.std.punctuated([cmsg.std.mc.green('Markdown'), ':']).printGroup(() => console.log(value));
      const html = renderMarkdownToHtmlSync(value);
      containerElement.innerHTML = html;
      // if (log.html) cmsg.std.punctuated([cmsg.std.mc.green('HTML'), ':']).printGroup(() => console.log(html));
      // msg?.endPrint();
    };
    render(sub.value);
    return render;
  });
}

export interface DynamicMarkdownOptions {
  log?: boolean | {
    value?: boolean;
    html?: boolean;
  };
}