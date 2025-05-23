import type * as MonacoNamespace from 'monaco-editor';

export namespace MonacoLoader {
  export async function initialize () {
    const require: ((...args: any) => void) & { config: any } = globalThis.require as any;
    const window: any = globalThis.window as any;
    require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@latest/min/vs' } });
    window.MonacoEnvironment = {
      getWorkerUrl: function (/* workerId, label */) {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = { baseUrl: 'https://unpkg.com/monaco-editor@latest/min/' };
          importScripts('https://unpkg.com/monaco-editor@latest/min/vs/base/worker/workerMain.js');`
        )}`;
      },
    };
    require(['vs/editor/editor.main'], () => {
      monaco = window.monaco;
      _resolve(window.monaco);
    });
    await onReady;
  }
  let _resolve: (value: typeof MonacoNamespace) => void;
  export const onReady = new Promise<typeof MonacoNamespace>((resolve) => _resolve = resolve);
}

export type * as Monaco from 'monaco-editor';
export let monaco: typeof MonacoNamespace = undefined!;
