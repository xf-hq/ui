import type { Monaco } from '../monaco';

export function getCurrentLineText (editor: Monaco.editor.IStandaloneCodeEditor): string | null {
  const model = editor.getModel();
  if (!model) return null;
  const currentPosition = editor.getPosition();
  if (!currentPosition) return null;
  return model.getLineContent(currentPosition.lineNumber);
}

export function insertTextAtCursor (editor: Monaco.editor.IStandaloneCodeEditor, textToInsert: string): void {
  const selection = editor.getSelection();
  if (!selection) return;
  editor.executeEdits('insert-text-at-cursor', [{
    range: selection,
    text: textToInsert,
    forceMoveMarkers: true,
  }]);
}

export namespace ModifierKeys {
  export interface Event {
    readonly ctrlKey: boolean;
    readonly shiftKey: boolean;
    readonly altKey: boolean;
    readonly metaKey: boolean;
  }

  export const Ctrl = 0b1;
  export const Shift = 0b10;
  export const Alt = 0b100;
  export const Meta = 0b1000;

  export const CtrlShift = Ctrl | Shift;
  export const CtrlAlt = Ctrl | Alt;
  export const ShiftAlt = Shift | Alt;
  export const CtrlAltShift = Ctrl | Alt | Shift;

  export function fromEvent (event: Event) {
    let flags = 0;
    if (event.ctrlKey) flags |= Ctrl;
    if (event.shiftKey) flags |= Shift;
    if (event.altKey) flags |= Alt;
    if (event.metaKey) flags |= Meta;
    return flags;
  }

  export function includes (expected: number, actual: number) {
    return (expected & actual) === expected;
  }
}