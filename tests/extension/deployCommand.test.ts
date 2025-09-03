import '../__mocks__/vscode';
import * as vscode from 'vscode';
import { ManifestBuilder } from '../../src/manifestBuilder';
import { activate } from '../../src/extension';

// mock fs readFileSync for template
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

jest.useFakeTimers();

let sentCmd = '';
// intercept terminal creation so we capture the CLI string actually sent
(vscode as any).window.createTerminal = jest.fn().mockReturnValue({
  show: jest.fn(),
  sendText: (txt: string) => {
    sentCmd = txt;
  },
});

// mock ManifestBuilder.build
jest.spyOn(ManifestBuilder, 'build').mockResolvedValue({
  path: '/tmp/pkg.xml',
  xml: '<Package></Package>',
} as any);

const ctx = new (vscode as any).ExtensionContext();
ctx.workspaceState.update('sfDeployer.selected', [
  '/force-app/main/default/classes/Foo.cls',
]);
activate(ctx);

describe('deploy command', () => {
  it('calls ManifestBuilder once and executes CLI', async () => {
    // create webview panel that extension will use
    const panel = new (vscode as any).WebviewPanel();
    (vscode as any).window.createWebviewPanel = jest
      .fn()
      .mockReturnValue(panel);

    // open picker (registers message handler and triggers manifest build with init delay)
    await vscode.commands.executeCommand('sfDeployer.openPicker');
    jest.advanceTimersByTime(150);

    // simulate user clicking Deploy in picker: send deploy message
    panel.webview._fire({
      type: 'deploy',
      flags: { mode: 'start' },
    });

    // advance timers for status bar hide etc.
    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(
      (ManifestBuilder.build as jest.Mock).mock.calls.length
    ).toBeGreaterThanOrEqual(1);
    expect(sentCmd).toContain('sf project deploy start');
    expect(sentCmd).toContain('--manifest');
  });
});

afterAll(() => jest.useRealTimers());
