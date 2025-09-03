import { ManifestBuilder } from '../src/manifestBuilder';
import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

tmp.setGracefulCleanup();

describe('ManifestBuilder - metadata type coverage', () => {
  const tmpDir = tmp.dirSync({ unsafeCleanup: true }).name;
  const forceAppDir = path.join(tmpDir, 'force-app', 'main', 'default');

  const makeDir = (p: string) => fs.mkdirSync(p, { recursive: true });

  // Prepare directory structure + files for each metadata type
  makeDir(path.join(forceAppDir, 'classes'));
  makeDir(path.join(forceAppDir, 'triggers'));
  makeDir(path.join(forceAppDir, 'lwc', 'myLwc'));
  makeDir(path.join(forceAppDir, 'aura', 'myAura'));
  makeDir(path.join(forceAppDir, 'flows'));
  makeDir(path.join(forceAppDir, 'layouts'));
  makeDir(path.join(forceAppDir, 'flexipages'));
  makeDir(path.join(forceAppDir, 'pages'));
  makeDir(path.join(forceAppDir, 'tabs'));
  makeDir(path.join(forceAppDir, 'objects', 'Foo__c'));
  makeDir(path.join(forceAppDir, 'objects', 'Foo__c', 'fields'));
  makeDir(path.join(forceAppDir, 'testSuites'));

  const fileMatrix: Array<{
    file: string;
    expectedType: string;
    expectedMember: string;
  }> = [
    {
      file: path.join(forceAppDir, 'classes', 'Hello.cls'),
      expectedType: 'ApexClass',
      expectedMember: 'Hello',
    },
    {
      file: path.join(forceAppDir, 'triggers', 'MyTrig.trigger'),
      expectedType: 'ApexTrigger',
      expectedMember: 'MyTrig',
    },
    {
      file: path.join(forceAppDir, 'lwc', 'myLwc', 'myLwc.js'),
      expectedType: 'LightningComponentBundle',
      expectedMember: 'myLwc',
    },
    {
      file: path.join(forceAppDir, 'aura', 'myAura', 'myAura.cmp'),
      expectedType: 'AuraDefinitionBundle',
      expectedMember: 'myAura',
    },
    {
      file: path.join(forceAppDir, 'flows', 'MyFlow.flow'),
      expectedType: 'Flow',
      expectedMember: 'MyFlow',
    },
    {
      file: path.join(forceAppDir, 'layouts', 'Foo__c-Layout.layout-meta.xml'),
      expectedType: 'Layout',
      expectedMember: 'Foo__c-Layout-meta',
    },
    {
      file: path.join(forceAppDir, 'flexipages', 'MyPage.flexipage-meta.xml'),
      expectedType: 'FlexiPage',
      expectedMember: 'MyPage',
    },
    {
      file: path.join(forceAppDir, 'pages', 'MyPage.page'),
      expectedType: 'ApexPage',
      expectedMember: 'MyPage',
    },
    {
      file: path.join(forceAppDir, 'tabs', 'Foo__c.tab-meta.xml'),
      expectedType: 'CustomTab',
      expectedMember: 'Foo__c',
    },
    {
      file: path.join(forceAppDir, 'objects', 'Foo__c', 'Foo__c.object'),
      expectedType: 'CustomObject',
      expectedMember: 'Foo__c',
    },
    {
      file: path.join(
        forceAppDir,
        'objects',
        'Foo__c',
        'fields',
        'Bar__c.field-meta.xml'
      ),
      expectedType: 'CustomField',
      expectedMember: 'Foo__c.Bar__c',
    },
    {
      file: path.join(
        forceAppDir,
        'testSuites',
        'DecisionSuite.testSuite-meta.xml'
      ),
      expectedType: 'ApexTestSuite',
      expectedMember: 'DecisionSuite',
    },
  ];

  // write dummy contents for each entry
  fileMatrix.forEach(({ file }) => {
    makeDir(path.dirname(file));
    fs.writeFileSync(file, '// dummy');
  });

  const ctx = {
    workspaceState: {
      get: () => fileMatrix.map((f) => f.file),
      update: () => {},
    },
  } as unknown as vscode.ExtensionContext;

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

  it('maps all supported metadata types correctly', async () => {
    const { xml } = await ManifestBuilder.build(ctx);
    fileMatrix.forEach(({ expectedType, expectedMember }) => {
      expect(xml).toContain(`<name>${expectedType}</name>`);
      expect(xml).toContain(`<members>${expectedMember}</members>`);
    });
  });
});
