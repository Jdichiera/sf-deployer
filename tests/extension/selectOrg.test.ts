import '../__mocks__/vscode';
import * as vscode from 'vscode';
import { activate } from '../../src/extension';

// Mock child_process.execSync to return a fake org list
jest.mock('child_process', () => ({
  execSync: jest.fn(() =>
    JSON.stringify({
      result: {
        nonScratchOrgs: [{ alias: 'myOrgAlias', username: 'user@example.com' }],
        scratchOrgs: [],
      },
    })
  ),
}));

// Prepare vscode mocks
const { window } = vscode as any;
window.showQuickPick = jest.fn().mockResolvedValue('myOrgAlias');

const ctx = new (vscode as any).ExtensionContext();

activate(ctx);

describe('selectOrg command', () => {
  it('stores selected org alias in workspaceState', async () => {
    await vscode.commands.executeCommand('sfDeployer.selectOrg');
    expect(ctx.workspaceState.get('sfDeployer.targetOrg')).toBe('myOrgAlias');
  });
});
