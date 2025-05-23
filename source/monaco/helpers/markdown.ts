import { isDefined, isObject } from '@xf-common/general/type-checking';
import { monaco, type Monaco } from '../monaco';
import { getCurrentLineText, insertTextAtCursor, ModifierKeys } from './general';

export namespace MonacoMarkdown {
  export const STANDARD_EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
    language: 'markdown',
    automaticLayout: true,
    minimap: { enabled: false },
    scrollbar: { vertical: 'auto', horizontal: 'auto' },
    quickSuggestions: false,
    lineNumbers: () => '>',
    wordWrap: 'on',
    tabSize: 2,
    guides: { indentation: false },
    autoSurround: 'never',
    autoClosingBrackets: 'never',
  };
  export function createEditor (domElement: HTMLElement, options: Monaco.editor.IStandaloneEditorConstructionOptions = {}) {
    const editor = monaco.editor.create(domElement, {
      ...STANDARD_EDITOR_OPTIONS,
      ...options,
    });
    initializeEditingEnhancements(editor);
    return editor;
  }

  export function initializeEditingEnhancements (editor: Monaco.editor.IStandaloneCodeEditor) {
    const behaviours = Behaviours(editor);
    behaviours.indentBulletOnTab();
    editor.onKeyDown((event) => {
      const handler = behaviours.onKeyDown[event.keyCode];
      if (isDefined(handler)) {
        const modifiers = ModifierKeys.fromEvent(event);
        handler(event, modifiers);
      }
    });
  }
}

const Behaviours = (editor: Monaco.editor.IStandaloneCodeEditor) => {
  return {
    onKeyDown: ((handlers: Partial<Record<Monaco.KeyCode, (event: Monaco.IKeyboardEvent, modifiers: number) => void>>) => handlers)({
      [monaco.KeyCode.Enter]: autoAddOrRemoveBullet,
      [monaco.KeyCode.Quote]: autoSurroundSelection(),
      [monaco.KeyCode.Backquote]: autoSurroundSelection(),
      [monaco.KeyCode.BracketLeft]: autoSurroundSelection({ '[': ']', '{': '}' }),
      [monaco.KeyCode.Digit9]: autoSurroundSelection({ '(': ')' }),
      [monaco.KeyCode.Comma]: autoSurroundSelection({ '<': '>' }),
    }),
    indentBulletOnTab,
  };

  function autoSurroundSelection (s?: string | Record<string, string>) {
    return (event: Monaco.IKeyboardEvent, modifierKeys: number) => {
      const selection = editor.getSelection();
      if (!selection) return;
      const model = editor.getModel()!;
      const selectedText = model.getValueInRange(selection);
      if (selectedText.length === 0) return;
      const left = event.browserEvent.key;
      let right: string;
      if (isObject(s)) {
        if (!(left in s)) return;
        right = s[left];
      }
      else {
        right = left;
      }
      event.preventDefault();
      const replacementText = `${left}${selectedText}${right}`;
      editor.executeEdits('wrap-selection', [{ range: selection, text: replacementText }]);
    };
  }

  /**
   * Pressing enter while on a line that starts with a bullet should either (a) automatically add a new bullet on the
   * next line or (b) stay on the current line and remove the bullet if there was no text after the bullet and it was
   * the last bullet in the current list.
   */
  function autoAddOrRemoveBullet (event: Monaco.IKeyboardEvent, modifierKeys: number) {
    const currentLineText = getCurrentLineText(editor);
    if (!currentLineText) return null;
    const match = /^(\s*)-(?: +|$)/.exec(currentLineText);
    if (match) {
      const whitespaceBeforeBullet = match[1];
      // If the cursor is before the bullet character, do nothing (return).
      if (editor.getPosition()!.column <= whitespaceBeforeBullet.length + 1) return;
      // const textBeforeCursor = currentLineText.slice(0, editor.getPosition()!.column - 1);
      // If this is the last bullet and it is empty, just remove the bullet instead of adding a new one.
      const currentLineNumber = editor.getPosition()!.lineNumber;
      const model = editor.getModel()!;
      const isEmptyBullet = currentLineText === match[0];
      if (isEmptyBullet) {
        const isLastLine = currentLineNumber === model.getLineCount();
        const isLastBulletInCurrentList = isLastLine || !new RegExp(`^${whitespaceBeforeBullet}-(?: |$)`).test(model.getLineContent(currentLineNumber + 1));
        if (isLastBulletInCurrentList) {
          editor.executeEdits('remove-empty-bullet', [
            // Remember: columns are 1-based, not 0-based.
            { range: new monaco.Range(currentLineNumber, whitespaceBeforeBullet.length + 1, currentLineNumber, currentLineText.length + 1), text: '' },
          ]);
          return;
        }
      }
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();

      const shouldDoubleSpace = ModifierKeys.includes(ModifierKeys.Shift, modifierKeys);
      const shouldIncrementIndent = ModifierKeys.includes(ModifierKeys.Alt, modifierKeys);
      const indentAndBullet = (shouldIncrementIndent ? '  ' : '') + match[0];
      const newline = shouldDoubleSpace ? '\n\n' : '\n';
      insertTextAtCursor(editor, newline + indentAndBullet);
    }
  }

  /**
   * When pressing tab to indent, if the line starts with a bullet, we should indent the line as a whole, and not just
   * insert some spaces at the current cursor position.
   * @privateRemarks
   * This is implemented separately from a normal keyboard event handler; The default action for the tab key can't be
   * overridden as easily as many others because Monaco has indentation providers and things like that, which kick in
   * independently of what's happening here (which means event.preventDefault() won't prevent the indentation from
   * happening). Instead, we'll just detect the changes and revise them with alternative changes as necessary.
   */
  function indentBulletOnTab () {
    let detectedIndentEvent = false;
    editor.onKeyDown((event) => {
      // We can at least see that the change is going to happen, even if we can't directly prevent it.
      if (event.keyCode === monaco.KeyCode.Tab && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
        detectedIndentEvent = true;
      }
    });
    editor.onDidChangeModelContent((event) => {
      if (!detectedIndentEvent) return;
      detectedIndentEvent = false;
      const model = editor.getModel()!;
      const changesToAdjust: Monaco.editor.IModelContentChange[] = [];
      for (let i = 0; i < event.changes.length; ++i) {
        const change = event.changes[i];
        const line = model.getLineContent(change.range.startLineNumber);
        const match = /^\s*- /.exec(line);
        if (!match) return;
        const bulletIndex = match.index;
        // If the change occurred before the bullet, then the behaviour was already correct and it's fine as is.
        if (change.range.startColumn < bulletIndex) return;
        changesToAdjust.push(change);
      }
      for (let i = 0; i < changesToAdjust.length; ++i) {
        const change = changesToAdjust[i];
        // Reverse the change and then insert the spaces at the start of the line.
        editor.executeEdits('adjust-tab-key', [
          { range: { ...change.range, endColumn: change.range.endColumn + 2 }, text: '' },
          { range: new monaco.Range(change.range.startLineNumber, 1, change.range.startLineNumber, 1), text: '  ' },
        ]);
      }
    });
  }
};
