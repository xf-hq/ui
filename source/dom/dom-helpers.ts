import { randomCamelCaseIdentifier } from '@xf-common/general/code';
import { FnCC } from '@xf-common/general/factories-and-latebinding';
import { TemplateLiteral } from '@xf-common/primitive';
import { DOMConnectedness } from './dom-connectedness';
import * as _Layout from './dom-layout-helpers.internal';
import * as DynamicMarkdown from './dynamic-markdown';
import * as DynamicNodes from './dynamic-nodes';
import * as DynamicText from './dynamic-text';
import { HTMLTemplate } from './html-template';
import { ManagedStylesheet } from './managed-stylesheet';

export namespace DOM {
  export function html (html: string): HTMLTemplate;
  export function html (strings: TemplateStringsArray, ...tokens: unknown[]): HTMLTemplate;
  export function html (html_or_strings: string | TemplateStringsArray, ...tokens: unknown[]): HTMLTemplate {
    const html = TemplateLiteral.maybeStaticJoin(html_or_strings, tokens).split('\n').map((line) => line.trim()).join('');
    return HTMLTemplate.define(html.trim());
  }

  export const css = ManagedStylesheet.onDemand;

  export namespace CSS {
    export interface NamingScope {
      (...preferredName: string[]): string;
      selector (name: string): string;
      toString (): string;
      createChildScope (...preferredNames: string[]): NamingScope;
    }
    export function NamingScope (baseClassStack: readonly string[], uniqueToken?: string): NamingScope {
      if (!uniqueToken) uniqueToken = randomCamelCaseIdentifier(6);
      const prefix = baseClassStack.join('--');
      const appendToken = prefix
        ? (name: string) => name ? `${prefix}--${name}__${uniqueToken}` : `${prefix}__${uniqueToken}`
        : (name: string) => name ? `${prefix}${name}__${uniqueToken}` : uniqueToken;
      const formatName = (...preferredNames: string[]) => preferredNames.join('--');
      const formatFinal = (...preferredNames: string[]) => appendToken(formatName(...preferredNames));
      return Object.assign(formatFinal, {
        selector: (name: string) => `.${formatFinal(name)}`,
        toString: formatFinal,
        createChildScope: (...preferredNames: string[]) => NamingScope([...baseClassStack, ...preferredNames], uniqueToken),
      } satisfies Pick<NamingScope, keyof NamingScope>);
    }

    export interface RandomizedClassName {
      readonly base: string;
      readonly suffix: string;
      readonly value: string;
      valueOf (): string;
    }
    export const randomizeClassName = FnCC(class RandomizedClassName implements CSS.RandomizedClassName {
      static readonly create = (baseName: string): CSS.RandomizedClassName => new RandomizedClassName(baseName);
      constructor (baseName: string) {
        this.#baseName = baseName;
        this.#value = `${baseName}${this.#suffix = `__${randomCamelCaseIdentifier(6)}`}`;
      }
      readonly #baseName: string;
      readonly #suffix: string;
      readonly #value: string;

      get base (): string { return this.#baseName; }
      get suffix (): string { return this.#suffix; }
      get value (): string { return this.#value; }

      toString (): string { return this.value; }
      valueOf (): string { return this.value; }
      [Symbol.toPrimitive] (): string { return this.value; }
    });

    /**
     * Sets or toggles the color scheme of the site.
     * - If the argument is 'system', any existing override will be removed.
     * - If the argument is null or it is omitted, the active overriding color theme will be toggled from whatever it is
     *   currently set to (either by override, or by system preference if no override is currently set).
     * @remarks
     * As a prerequisite for this function to work, make sure to set this in the site's main stylesheet:
     * ```css
     * :where(html) {
     *   --color-scheme: only dark;
     *   color-scheme: var(--color-scheme);
     * }
     * ```
     */
    export function setOrToggleColorScheme (colorSchemeToSet?: 'light' | 'dark' | 'system' | null): 'light' | 'dark' {
      const style = document.documentElement.style;
      switch (colorSchemeToSet) {
        case 'dark': colorSchemeToSet = 'dark'; break;
        case 'light': colorSchemeToSet = 'light'; break;
        case 'system': {
          style.removeProperty('--color-scheme');
          localStorage.removeItem('color-scheme');
          return getSystemColorScheme();
        }
        default: {
          const currentScheme = localStorage.getItem('color-scheme') as 'light' | 'dark' | null ?? getSystemColorScheme();
          colorSchemeToSet = currentScheme === 'dark' ? 'light' : 'dark';
        }
      }
      localStorage.setItem('color-scheme', colorSchemeToSet);
      style.setProperty('--color-scheme', colorSchemeToSet);
      setDataAttribute(colorSchemeToSet);
      return colorSchemeToSet;
    }
    export function loadColorSchemeOverride (): void {
      const savedScheme = localStorage.getItem('color-scheme') as 'light' | 'dark' | null;
      if (savedScheme) {
        document.documentElement.style.setProperty('--color-scheme', savedScheme);
      }
      setDataAttribute(savedScheme);
    }
    export function getActiveColorSchemeOverride (): 'light' | 'dark' | null {
      return localStorage.getItem('color-scheme') as 'light' | 'dark' | null;
    }
    export function getSystemColorScheme (): 'light' | 'dark' {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function setDataAttribute (colorScheme: 'light' | 'dark' | null | undefined) {
      document.documentElement.dataset.colorScheme = colorScheme ?? getSystemColorScheme();
    }
  }

  export function setStyles (element: Element, styles: Record<string, any>): void;
  export function setStyles (element: HTMLElement, styles: Record<string, any>): void {
    const style = element.style;
    if (!(style instanceof CSSStyleDeclaration)) throw new Error(`Element does not have a 'style' property or it is not an instance of CSSStyleDeclaration.`);
    for (const key in styles) {
      style.setProperty(key, styles[key]);
    }
  }

  export import Layout = _Layout;
  export const appendDynamicText = DynamicText.appendDynamicText;
  export const appendDynamicNodeRange = DynamicNodes.appendDynamicDOMNodeRange;
  export const appendDynamicMarkdown = DynamicMarkdown.appendDynamicMarkdown;

  export import isConnected = DOMConnectedness;
}
