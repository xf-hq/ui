import { StaticColor } from '@xf-common/color/static-color';
import { isDefined, isString } from '@xf-common/general/type-checking';
import { defineGetter } from '@xf-common/primitive';
import { type Monaco, monaco } from './monaco';

export interface MonacoTheme {
  readonly name: string;
  readonly base: Monaco.editor.BuiltinTheme;
  readonly colors: Partial<MonacoTheme.Colors>;
}
export namespace MonacoTheme {
  export interface Colors {
    readonly background: StaticColor;
    readonly foreground: StaticColor;
    readonly activeForeground: StaticColor;
    readonly activeBackground: StaticColor;
    readonly lineNumber: StaticColor;
    readonly activeLineNumber: StaticColor;
    readonly keyword: StaticColor;
    readonly comment: StaticColor;
    readonly punctuation: StaticColor;
  }

  const themes = new Map<string, MonacoTheme>([
    ['vs-dark', { name: 'vs-dark', base: 'vs-dark', colors: {} }],
  ]);
  let _activeThemeName = 'vs-dark';

  export declare const activeThemeName: string;
  export declare const currentTheme: MonacoTheme;

  defineGetter(MonacoTheme, 'activeThemeName', () => _activeThemeName);
  defineGetter(MonacoTheme, 'currentTheme', () => themes.get(_activeThemeName));

  export function register (theme: MonacoTheme) {
    themes.set(theme.name, theme);

    const rules: Monaco.editor.ITokenThemeRule[] = [];
    const colors: Monaco.editor.IColors = {};

    if (theme.colors.background) colors['editor.background'] = theme.colors.background.hex;
    if (theme.colors.foreground) colors['editor.foreground'] = theme.colors.foreground.hex;

    if (theme.colors.activeForeground) colors['editorLineNumber.activeForeground'] = theme.colors.activeForeground.hex;
    if (theme.colors.activeBackground) colors['editor.lineHighlightBackground'] = theme.colors.activeBackground.hex;
    else if (theme.colors.background) colors['editor.lineHighlightBackground'] = theme.colors.background.darken('10%').hex;

    if (theme.colors.lineNumber) colors['editorLineNumber.foreground'] = theme.colors.lineNumber.hex;
    if (theme.colors.activeLineNumber) colors['editorLineNumber.activeForeground'] = theme.colors.activeLineNumber.hex;

    if (theme.colors.keyword) rules.push({ token: 'keyword', foreground: theme.colors.keyword.hex });

    let commentColor: StaticColor | undefined;
    if (theme.colors.comment) commentColor = theme.colors.comment;
    else if (theme.colors.background) {
      if (theme.colors.foreground) {
        commentColor = theme.colors.background.interpolate(theme.colors.foreground, 0.4);
      }
      else {
        commentColor = theme.colors.background.setLightness(0.5);
      }
    }
    if (isDefined(commentColor)) rules.push({ token: 'comment.js', foreground: commentColor.hex });

    const punctuation = theme.colors.punctuation ?? theme.colors.foreground?.darken('40%');
    if (punctuation) {
      rules.push({ token: 'delimiter.parenthesis', foreground: punctuation.hex });
      rules.push({ token: 'delimiter.bracket', foreground: punctuation.hex });
      rules.push({ token: 'delimiter.brace', foreground: punctuation.hex });
    }

    monaco.editor.defineTheme(theme.name, {
      base: theme.base,
      inherit: true,
      rules,
      colors,
    });
  }

  export function activate (theme: MonacoTheme): void;
  export function activate (name: string): void;
  export function activate (arg: MonacoTheme | string): void {
    let name: string;
    if (isString(arg)) name = arg;
    else {
      name = arg.name;
      register(arg);
    }
    _activeThemeName = name;
    monaco.editor.setTheme(name);
  }
}
