import { inlblock } from '@xf-common/primitive';
import { monaco, type Monaco } from './monaco';
import { MonacoTheme } from './monaco-theming';

export namespace MonacoExample {
  export function run ({
    editorContainer = _createAndAppendNewContainerElement(),
    runButtonOrLink = _createAndAppendNewRunButton(),
  }: {
    editorContainer?: HTMLElement;
    runButtonOrLink?: HTMLElement;
  } = {}) {
    MonacoTheme.activate({
      name: 'example',
      base: 'vs-dark',
      colors: {
        // foreground: Palette.Light.Default,
        // background: Palette.Dark.Darker1,
      },
    });

    const editor: Monaco.editor.IStandaloneCodeEditor = monaco.editor.create(editorContainer, {
      value: inlblock(`
        function helloWorld () {
          console.log("Hello, world?");
        }
        helloWorld();

        // Development tasks:
        // - Implement the quantum flux capacitor interface.
        // - Generate a list of pseudo-random fractal patterns.
        // - Configure the hyperspace routing table and link new nodes.
        // - Ensure that newly instantiated wormholes appear instantly in the UI.
        // - Activate the nanobot swarm. When a nanobot cluster loads, it should start operating immediately.
        // - #1 PRIORITY: Optimize the antimatter reactor initialization process to reduce startup time.
      `),
      language: 'javascript',
      theme: 'sx-default',
    });

    runButtonOrLink.addEventListener('click', () => {
      const code = editor.getValue();
      const fn = new Function(code);
      fn();
    });
  }

  function _createAndAppendNewContainerElement () {
    const container = document.createElement('div');
    Object.assign(container.style, { height: '300px', width: '1000px' });
    document.body.appendChild(container);
    return container;
  }

  function _createAndAppendNewRunButton () {
    const runButton = document.createElement('button');
    runButton.textContent = 'Run Code';
    Object.assign(runButton.style, { 'padding': '10px 20px', 'font-size': '16px', 'font-weight': 'bold' });
    const runDiv = document.createElement('div');
    Object.assign(runDiv.style, { 'margin-top': '10px' });
    runDiv.appendChild(runButton);
    document.body.appendChild(runDiv);
    return runButton;
  }
}
