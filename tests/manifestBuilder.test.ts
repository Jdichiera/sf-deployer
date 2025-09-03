import { ManifestBuilder } from '../src/manifestBuilder';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsp } from 'fs';

describe('ManifestBuilder', () => {
  const ctx = {
    workspaceState: {
      get: () => [],
      update: () => {},
    },
    extensionPath: '/test/extension',
  } as unknown as vscode.ExtensionContext;

  it('throws on empty selection', async () => {
    await expect(ManifestBuilder.build(ctx)).rejects.toThrow('No selections');
  });

  describe('Named Manifests', () => {
    const testManifestsDir = path.join(__dirname, 'test-manifests');

    beforeEach(async () => {
      // Create test manifests directory
      await fsp.mkdir(testManifestsDir, { recursive: true });

      // Mock workspace folders
      (vscode.workspace as any) = {
        workspaceFolders: [{ uri: { fsPath: __dirname } }],
      };
    });

    afterEach(async () => {
      // Clean up test manifests directory
      try {
        await fsp.rmdir(testManifestsDir, { recursive: true });
      } catch (err) {
        // Directory might not exist
      }
    });

    it('should save a named manifest', async () => {
      // Create a unique directory for this test
      const testId = Math.random().toString(36).substring(7);
      const testDir = path.join(__dirname, `test-save-${testId}`);

      const contextWithSelection = {
        ...ctx,
        extensionPath: testDir,
        workspaceState: {
          get: () => ['/test/force-app/main/default/classes/TestClass.cls'],
          update: () => {},
        },
      } as unknown as vscode.ExtensionContext;

      // Mock workspace folders
      (vscode.workspace as any) = {
        workspaceFolders: [{ uri: { fsPath: testDir } }],
      };

      // Mock the build method to avoid complex file system operations
      jest.spyOn(ManifestBuilder, 'build').mockResolvedValue({
        path: '/test/package.xml',
        xml: '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n  <types>\n    <members>TestClass</members>\n    <name>ApexClass</name>\n  </types>\n  <version>60.0</version>\n</Package>',
      });

      try {
        const result = await ManifestBuilder.saveNamedManifest(
          contextWithSelection,
          'test-manifest'
        );

        expect(result.path).toContain('test-manifest.xml');
        expect(result.xml).toContain(
          'SF Deployer Named Manifest: test-manifest'
        );
        expect(result.xml).toContain('TestClass');
      } finally {
        // Clean up
        await fsp.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should throw error when saving with no selection', async () => {
      await expect(
        ManifestBuilder.saveNamedManifest(ctx, 'test-manifest')
      ).rejects.toThrow('No files selected to save');
    });

    it('should list named manifests', async () => {
      // Create test manifest files in a unique directory
      const testId = Math.random().toString(36).substring(7);
      const testDir = path.join(__dirname, `test-list-${testId}`);
      const manifestsDir = path.join(testDir, 'manifests');
      await fsp.mkdir(manifestsDir, { recursive: true });

      await fsp.writeFile(
        path.join(manifestsDir, 'manifest1.xml'),
        'test content'
      );
      await fsp.writeFile(
        path.join(manifestsDir, 'manifest2.xml'),
        'test content'
      );
      await fsp.writeFile(
        path.join(manifestsDir, 'package.xml'),
        'should be ignored'
      );

      // Create a context pointing to our test directory
      const testCtx = {
        ...ctx,
        extensionPath: testDir,
      } as unknown as vscode.ExtensionContext;

      // Mock workspace folders
      (vscode.workspace as any) = {
        workspaceFolders: [{ uri: { fsPath: testDir } }],
      };

      try {
        const manifests = await ManifestBuilder.listNamedManifests(testCtx);
        expect(manifests).toEqual(['manifest1', 'manifest2']);
      } finally {
        // Clean up
        await fsp.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should return empty array when no manifests exist', async () => {
      // Create a unique directory for this test
      const testId = Math.random().toString(36).substring(7);
      const testDir = path.join(__dirname, `test-empty-${testId}`);

      const testCtx = {
        ...ctx,
        extensionPath: testDir,
      } as unknown as vscode.ExtensionContext;

      // Mock workspace folders
      (vscode.workspace as any) = {
        workspaceFolders: [{ uri: { fsPath: testDir } }],
      };

      try {
        const manifests = await ManifestBuilder.listNamedManifests(testCtx);
        expect(manifests).toEqual([]);
      } finally {
        // Clean up (if any directory was created)
        try {
          await fsp.rm(testDir, { recursive: true, force: true });
        } catch (err) {
          // Directory might not exist, which is fine
        }
      }
    });
  });
});
