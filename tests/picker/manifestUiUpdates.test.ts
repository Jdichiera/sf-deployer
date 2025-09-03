// @ts-nocheck
/**
 * @jest-environment jsdom
 */
import fs from 'fs';
import path from 'path';

// Ensure DOM globals are present
if (typeof window === 'undefined') {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
}

// Setup complete DOM structure that pickerScript expects
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
  
  <!-- Manifest controls -->
  <input type="text" id="manifestName" placeholder="Manifest name..." />
  <button id="saveManifestBtn">Save Current</button>
  <select id="manifestDropdown">
    <option value="">-- Select saved manifest --</option>
    <option value="test-manifest">test-manifest</option>
    <option value="another-manifest">another-manifest</option>
  </select>
  <button id="loadManifestBtn">Load</button>

`;

describe('picker webview manifest UI updates', () => {
  let postMessageMock: jest.Mock;

  beforeEach(() => {
    // Mock VSCode API
    postMessageMock = jest.fn();
    (window as any).acquireVsCodeApi = () => ({
      postMessage: postMessageMock,
      getState: () => ({}),
      setState: () => {},
    });

    // Load and execute picker script
    const scriptPath = path.resolve(__dirname, '../../media/pickerScript.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    eval(scriptContent);

    // Reset mock after script loads (it calls requestManifestList)
    postMessageMock.mockClear();
  });

  describe('manifestSaved message handling', () => {
    it('should clear input field and trigger manifest rebuild', async () => {
      const manifestNameInput = document.getElementById(
        'manifestName'
      ) as HTMLInputElement;
      manifestNameInput.value = 'test-manifest';

      // Send manifestSaved message
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'manifestSaved',
            manifestName: 'test-manifest',
            path: '/workspace/manifests/test-manifest.xml',
          },
        })
      );

      await new Promise((r) => setTimeout(r, 0));

      // Input field should be cleared
      expect(manifestNameInput.value).toBe('');
      expect(manifestNameInput.placeholder).toBe('Manifest name...');
    });
  });

  describe('manifestLoaded message handling', () => {
    it('should clear input field and reset dropdown', async () => {
      const manifestNameInput = document.getElementById(
        'manifestName'
      ) as HTMLInputElement;
      const manifestDropdown = document.getElementById(
        'manifestDropdown'
      ) as HTMLSelectElement;

      manifestNameInput.value = 'some-input';
      manifestDropdown.value = 'test-manifest';

      // Send manifestLoaded message
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'manifestLoaded',
            manifestName: 'test-manifest',
            selections: ['/force-app/main/default/classes/TestClass.cls'],
            hasInvalidPaths: false,
          },
        })
      );

      await new Promise((r) => setTimeout(r, 0));

      // Input field should be cleared and dropdown reset
      expect(manifestNameInput.value).toBe('');
      expect(manifestNameInput.placeholder).toBe('Manifest name...');
      expect(manifestDropdown.value).toBe('');
    });

    it('should handle manifest with invalid paths', async () => {
      // Send manifestLoaded message with invalid paths
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'manifestLoaded',
            manifestName: 'stale-manifest',
            selections: ['/force-app/main/default/classes/ValidClass.cls'],
            originalSelections: [
              '/force-app/main/default/classes/ValidClass.cls',
              '/force-app/main/default/classes/DeletedClass.cls',
            ],
            hasInvalidPaths: true,
          },
        })
      );

      await new Promise((r) => setTimeout(r, 0));

      // Should still clear UI elements properly
      const manifestNameInput = document.getElementById(
        'manifestName'
      ) as HTMLInputElement;
      const manifestDropdown = document.getElementById(
        'manifestDropdown'
      ) as HTMLSelectElement;
      expect(manifestNameInput.value).toBe('');
      expect(manifestDropdown.value).toBe('');
    });
  });

  describe('updateSelections message handling', () => {
    it('should update tree checkboxes based on provided selections', async () => {
      // Build tree with some checkboxes
      const tree = [
        {
          name: 'classes',
          path: '/force-app/main/default/classes',
          children: [
            {
              name: 'TestClass.cls',
              path: '/force-app/main/default/classes/TestClass.cls',
            },
            {
              name: 'AnotherClass.cls',
              path: '/force-app/main/default/classes/AnotherClass.cls',
            },
          ],
        },
      ];

      // Initialize tree
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'init', tree, selected: [] },
        })
      );

      await new Promise((r) => setTimeout(r, 0));

      // Send updateSelections message
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'updateSelections',
            selections: ['/force-app/main/default/classes/TestClass.cls'],
          },
        })
      );

      await new Promise((r) => setTimeout(r, 0));

      // Check that the correct checkbox is checked
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const testClassCheckbox = Array.from(checkboxes).find(
        (cb: HTMLInputElement) =>
          cb.dataset.path === '/force-app/main/default/classes/TestClass.cls'
      ) as HTMLInputElement;
      const anotherClassCheckbox = Array.from(checkboxes).find(
        (cb: HTMLInputElement) =>
          cb.dataset.path === '/force-app/main/default/classes/AnotherClass.cls'
      ) as HTMLInputElement;

      expect(testClassCheckbox).toBeTruthy();
      expect(testClassCheckbox.checked).toBe(true);
      expect(anotherClassCheckbox).toBeTruthy();
      expect(anotherClassCheckbox.checked).toBe(false);
    });

    it('should clear all selections when empty array provided', async () => {
      // Build tree and select some items first
      const tree = [
        {
          name: 'classes',
          path: '/force-app/main/default/classes',
          children: [
            {
              name: 'TestClass.cls',
              path: '/force-app/main/default/classes/TestClass.cls',
            },
          ],
        },
      ];

      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'init',
            tree,
            selected: ['/force-app/main/default/classes/TestClass.cls'],
          },
        })
      );

      await new Promise((r) => setTimeout(r, 0));

      // Send updateSelections with empty array
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'updateSelections',
            selections: [],
          },
        })
      );

      await new Promise((r) => setTimeout(r, 0));

      // All checkboxes should be unchecked
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox: HTMLInputElement) => {
        if (checkbox.dataset.path) {
          expect(checkbox.checked).toBe(false);
        }
      });
    });
  });

  describe('manifestList message handling', () => {
    it('should update dropdown options', async () => {
      const manifestDropdown = document.getElementById(
        'manifestDropdown'
      ) as HTMLSelectElement;

      // Send manifestList message
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'manifestList',
            manifests: ['deployment-package', 'hotfix-v2', 'feature-branch'],
          },
        })
      );

      await new Promise((r) => setTimeout(r, 0));

      // Check dropdown options
      const options = Array.from(manifestDropdown.options);
      expect(options).toHaveLength(4); // placeholder + 3 manifests
      expect(options[0].value).toBe('');
      expect(options[0].textContent).toBe('-- Select saved manifest --');
      expect(options[1].value).toBe('deployment-package');
      expect(options[2].value).toBe('hotfix-v2');
      expect(options[3].value).toBe('feature-branch');
    });
  });
});
