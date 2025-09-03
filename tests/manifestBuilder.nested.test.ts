import './__mocks__/vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { ManifestBuilder } from '../src/manifestBuilder';

// mock minimal vscode workspace
(vscode as any).workspace = {
  workspaceFolders: [{ uri: { fsPath: '' } }],
};

describe('ManifestBuilder with nested folder selection', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sfdc-nested-'));
  const forceDir = path.join(tmpDir, 'force-app', 'main', 'default', 'classes');
  const subDir = path.join(forceDir, 'nested');
  beforeAll(() => {
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(forceDir, 'LevelOne.cls'),
      'public class LevelOne {}'
    );
    fs.writeFileSync(
      path.join(subDir, 'LevelTwo.cls'),
      'public class LevelTwo {}'
    );
    (vscode as any).workspace.workspaceFolders[0].uri.fsPath = tmpDir;
  });

  it('includes classes from subfolders when parent folder is selected', async () => {
    const ctx = new (vscode as any).ExtensionContext();
    ctx.workspaceState.update('sfDeployer.selected', [forceDir]);
    const { xml } = await ManifestBuilder.build(ctx);

    expect(xml).toContain('<types>');
    expect(xml).toContain('<name>ApexClass</name>');
    expect(xml).toContain('<members>LevelOne</members>');
    expect(xml).toContain('<members>LevelTwo</members>');
  });
});
