import { ManifestBuilder } from '../src/manifestBuilder';
import * as vscode from 'vscode';
import * as path from 'path';
import { promises as fsp } from 'fs';

describe('ManifestBuilder - RecordType support', () => {
  const testDir = path.join(__dirname, 'test-recordtypes');
  const objectApiName = 'Pool_Transaction__c';
  const recordTypeName = 'Contract_Transaction';

  beforeAll(async () => {
    await fsp.mkdir(
      path.join(testDir, 'objects', objectApiName, 'recordTypes'),
      { recursive: true }
    );
    await fsp.writeFile(
      path.join(
        testDir,
        'objects',
        objectApiName,
        'recordTypes',
        `${recordTypeName}.recordType-meta.xml`
      ),
      '<RecordTypeMeta/>',
      'utf8'
    );
    (vscode.workspace as any) = {
      workspaceFolders: [{ uri: { fsPath: testDir } }],
    };
  });

  afterAll(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  it('maps RecordType metadata to manifest correctly', async () => {
    const ctx = {
      extensionPath: testDir,
      workspaceState: {
        get: () => [
          path.join(
            testDir,
            'objects',
            objectApiName,
            'recordTypes',
            `${recordTypeName}.recordType-meta.xml`
          ),
        ],
        update: () => {},
      },
    } as unknown as vscode.ExtensionContext;

    const res = await ManifestBuilder.build(ctx);

    expect(res.xml).toContain('<name>RecordType</name>');
    expect(res.xml).toContain(
      `<members>${objectApiName}.${recordTypeName}</members>`
    );
  });
});
