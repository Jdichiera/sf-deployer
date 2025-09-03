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

// intercept terminal commands
let sentCmd = '';
(vscode as any).window.createTerminal = jest.fn().mockReturnValue({
  show: jest.fn(),
  sendText: (txt: string) => (sentCmd = txt),
});

jest.spyOn(ManifestBuilder, 'build').mockResolvedValue({
  path: '/tmp/pkg.xml',
  xml: '<Package></Package>',
} as any);

const ctx = new (vscode as any).ExtensionContext();
ctx.workspaceState.update('sfDeployer.selected', [
  '/force-app/main/default/classes/Foo.cls',
]);
activate(ctx);

describe('deploy command CLI modes', () => {
  const cases: Array<{ mode: any; extraFlags?: any }> = [
    { mode: 'preview' },
    { mode: 'validate', extraFlags: { dryRun: true, orgAlias: 'myOrg' } },
  ];

  test.each(cases)('constructs CLI for %s', async ({ mode, extraFlags }) => {
    sentCmd = '';
    const panel = new (vscode as any).WebviewPanel();
    (vscode as any).window.createWebviewPanel = jest
      .fn()
      .mockReturnValue(panel);

    await vscode.commands.executeCommand('sfDeployer.openPicker');
    jest.advanceTimersByTime(150);

    panel.webview._fire({
      type: 'deploy',
      flags: { mode, ...extraFlags },
    });

    jest.runOnlyPendingTimers();
    await Promise.resolve();

    expect(sentCmd).toContain(`sf project deploy ${mode}`);
    expect(sentCmd).toContain('--manifest');
    if (extraFlags?.dryRun) expect(sentCmd).toContain('--dry-run');
    if (extraFlags?.orgAlias)
      expect(sentCmd).toContain(`--target-org ${extraFlags.orgAlias}`);
  });
});

afterAll(() => jest.useRealTimers());
