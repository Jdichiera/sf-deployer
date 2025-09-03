import '../__mocks__/vscode';
jest.useFakeTimers();
import * as vscode from 'vscode';
import * as child_process from 'child_process';

// Mock fs to return dummy template
jest.mock('fs', () => {
  const fs = jest.requireActual('fs');
  return {
    ...fs,
    readFileSync: (p: string, enc: string) => {
      if (p.endsWith('pickerTemplate.html')) {
        return '<html><body><div id="tree"></div></body></html>';
      }
      return fs.readFileSync(p, enc);
    },
  };
});

// Import extension activate after mocks
import { activate } from '../../src/extension';
import { ManifestBuilder } from '../../src/manifestBuilder';

const ctx = new (vscode as any).ExtensionContext();
// pre-populate selection so openPicker triggers manifest build
ctx.workspaceState.update('sfDeployer.selected', [
  '/force-app/main/default/classes/Dummy.cls',
]);

activate(ctx);

describe('broadcastManifest', () => {
  it('posts manifest to active webview once', async () => {
    // mock ManifestBuilder.build
    jest.spyOn(ManifestBuilder, 'build').mockResolvedValue({
      path: '/tmp/pkg.xml',
      xml: '<Package></Package>',
    } as any);

    // Prepare a fake panel and make extension return it
    const panel = new (vscode as any).WebviewPanel();
    (vscode as any).window.createWebviewPanel = jest
      .fn()
      .mockReturnValue(panel);

    // execute command that opens picker and triggers broadcast
    await vscode.commands.executeCommand('sfDeployer.openPicker');

    // fast-forward timers to allow broadcastManifest setTimeout(100) to fire
    jest.advanceTimersByTime(150);
    await Promise.resolve(); // flush microtasks

    const calls = (panel.webview.postMessage as jest.Mock).mock.calls;
    const manifestCall = calls.find((c) => c[0].type === 'manifest');
    expect(manifestCall).toBeTruthy();
    expect(manifestCall[0].xml).toBe('<Package></Package>');
  });
  afterAll(() => {
    jest.useRealTimers();
  });
});
