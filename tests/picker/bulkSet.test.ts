// @ts-nocheck
/**
 * @jest-environment jsdom
 */
import fs from 'fs';
import path from 'path';

// Ensure DOM globals are present (ts-jest may default to node env in some setups)
if (typeof window === 'undefined') {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  // @ts-ignore
  global.window = dom.window;
  // @ts-ignore
  global.document = dom.window.document;
}

// Ensure required DOM nodes exist for pickerScript
document.body.innerHTML = `
  <div id="tree"></div>
  <ul id="selList"></ul>
  <pre id="manifest"></pre>
  <button id="deployBtn"></button>
  <button id="clearBtn"></button>
  <input type="checkbox" id="dryRun" />
  <input type="text" id="filterInput" />
  <pre id="cmdPreview"></pre>
  <label><input type="radio" name="testLevel" value="NoTestRun" checked></label>
  <label><input type="radio" name="testLevel" value="RunLocalTests"></label>
  <label><input type="radio" name="testLevel" value="RunSpecifiedTests"></label>
`;

describe('picker webview bulkSet behaviour', () => {
  it('sends single bulkSet message containing all descendant paths', async () => {
    // Mock VSCode API
    const postMessageMock = jest.fn();
    (window as any).acquireVsCodeApi = () => ({
      postMessage: postMessageMock,
      getState: () => ({}),
      setState: () => {},
    });

    // Load and execute picker script
    const scriptPath = path.resolve(__dirname, '../../media/pickerScript.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    // execute within global scope
    // eslint-disable-next-line no-eval
    eval(scriptContent);

    // Build minimal tree data
    const tree = [
      {
        name: 'classes',
        path: '/force-app/main/default/classes',
        children: [
          { name: 'Foo.cls', path: '/force-app/main/default/classes/Foo.cls' },
          { name: 'Bar.cls', path: '/force-app/main/default/classes/Bar.cls' },
        ],
      },
    ];

    // Send init message to render tree
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'init', tree, selected: [] },
      })
    );

    // locate folder checkbox (enabled one)
    const folderCheckbox = document.querySelector(
      'summary input[type="checkbox"]:not(:disabled)'
    ) as HTMLInputElement;
    expect(folderCheckbox).toBeTruthy();

    // Toggle checkbox to checked
    folderCheckbox.checked = true;
    folderCheckbox.dispatchEvent(new Event('change'));

    // Allow microtasks to run
    await new Promise((r) => setTimeout(r, 0));

    expect(postMessageMock).toHaveBeenCalledTimes(1);
    const msg = postMessageMock.mock.calls[0][0];
    expect(msg.type).toBe('bulkSet');
    expect(msg.selected).toBe(true);
    expect(msg.paths).toEqual([
      '/force-app/main/default/classes/Foo.cls',
      '/force-app/main/default/classes/Bar.cls',
    ]);
  });
});
