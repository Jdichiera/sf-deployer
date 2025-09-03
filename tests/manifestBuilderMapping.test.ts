import { ManifestBuilder } from '../src/manifestBuilder';
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

tmp.setGracefulCleanup();

describe('ManifestBuilder mapping', () => {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true }).name;
  const forceAppDir = path.join(tmpDir, 'force-app', 'main', 'default');
  fs.mkdirSync(path.join(forceAppDir, 'classes'), { recursive: true });
  fs.mkdirSync(path.join(forceAppDir, 'triggers'), { recursive: true });
  fs.mkdirSync(path.join(forceAppDir, 'lwc', 'bar'), { recursive: true });
  fs.mkdirSync(path.join(forceAppDir, 'aura', 'baz'), { recursive: true });

  const paths = [
    path.join(forceAppDir, 'classes', 'Foo.cls'),
    path.join(forceAppDir, 'triggers', 'MyTrig.trigger'),
    path.join(forceAppDir, 'lwc', 'bar'),
    path.join(forceAppDir, 'aura', 'baz'),
  ];
  fs.writeFileSync(paths[0], 'public class Foo {}');
  fs.writeFileSync(paths[1], 'trigger MyTrig on Account (before insert) {}');
  fs.writeFileSync(path.join(paths[2], 'bar.js'), '');
  fs.writeFileSync(path.join(paths[3], 'baz.cmp'), '');

  const ctx = {
    workspaceState: {
      get: () => paths,
      update: () => {},
    },
  } as unknown as vscode.ExtensionContext;

  // inject workspace folder mock
  jest.mock('vscode', () => {
    const original = jest.requireActual('vscode');
    return {
      ...original,
      workspace: {
        ...original.workspace,
        workspaceFolders: [{ uri: { fsPath: tmpDir } }],
      },
    };
  });

  it('maps mixed metadata types', async () => {
    const { path: manifestPath, xml } = await ManifestBuilder.build(ctx);
    // xml variable already contains string built, but read from disk to assert identical
    const diskXml = fs.readFileSync(manifestPath, 'utf8');
    expect(diskXml).toContain('<name>ApexClass</name>');
    expect(diskXml).toContain('<members>Foo</members>');
    expect(diskXml).toContain('<name>ApexTrigger</name>');
    expect(diskXml).toContain('<members>MyTrig</members>');
    expect(diskXml).toContain('<name>LightningComponentBundle</name>');
    expect(diskXml).toContain('<members>bar</members>');
    expect(diskXml).toContain('<name>AuraDefinitionBundle</name>');
    expect(diskXml).toContain('<members>baz</members>');
  });
});
