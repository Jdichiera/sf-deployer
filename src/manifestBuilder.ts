import * as vscode from 'vscode';
import * as path from 'path';

import { promises as fsp } from 'fs';
import { performance } from 'perf_hooks';

export class ManifestBuilder {
  /**
   * Build package.xml from selected paths and write to .sf-deployer/package.xml.
   * Very simplified mapping: handles ApexClass (.cls), ApexTrigger (.trigger), Aura and LWC bundles, and metadata XML files.
   */
  static async build(
    context: vscode.ExtensionContext
  ): Promise<{ path: string; xml: string }> {
    const tStart = performance.now();

    const selected = context.workspaceState.get<string[]>(
      'sfDeployer.selected',
      []
    );
    if (!selected.length) {
      throw new Error('No selections');
    }

    // Fast, async file collection using glob's promise interface
    const { glob } = await import('glob');

    async function collectFiles(paths: string[]): Promise<string[]> {
      const results: string[][] = await Promise.all(
        paths.map(async (p) => {
          const stat = await fsp.stat(p);
          if (!stat.isDirectory()) {
            return [p];
          }

          // Match only likely deployable file types to reduce I/O
          const pattern =
            '**/*.{cls,trigger,xml,page,app,cmp,component,js,ts,html}';
          // glob returns paths relative to the cwd we pass, so we join afterwards
          const matches: string[] = await glob(pattern, {
            cwd: p,
            nodir: true,
            dot: false,
            ignore: [
              '**/node_modules/**',
              '**/.git/**',
              '**/coverage/**',
              '**/dist/**',
              '**/out/**',
              '**/__tests__/**',
            ],
          });
          return matches.map((m) => path.join(p, m));
        })
      );
      return results.flat();
    }

    const tCollectStart = performance.now();
    const filePaths = await collectFiles(selected);
    const tCollectEnd = performance.now();

    const types: Record<string, Set<string>> = {};

    const tClassifyStart = performance.now();

    for (const p of filePaths) {
      // Normalize path separators
      const norm = p.split(path.sep).join(path.posix.sep);
      const ext = path.extname(p).toLowerCase();
      // Skip clearly non-deployable extensions
      if (['.txt', '.md', '.log'].includes(ext)) {
        console.log(`SF Deployer: Skipping non-deployable file: ${norm}`);
        continue;
      }
      const base = path.basename(p, ext);

      console.log(`SF Deployer: Processing file: ${p}`);
      console.log(`SF Deployer: Normalized path: ${norm}`);
      console.log(`SF Deployer: Extension: ${ext}, Base: ${base}`);

      // Detect LWC bundle (any file inside force-app/.../lwc/<bundle>/...)
      const lwcMatch = norm.match(/\blwc\/([^/]+)/);
      if (lwcMatch) {
        const bundle = lwcMatch[1];
        types['LightningComponentBundle'] = (
          types['LightningComponentBundle'] || new Set()
        ).add(bundle);
        continue; // skip further checks; we already handled
      }

      const auraMatch = norm.match(/\baura\/([^/]+)/);
      if (auraMatch) {
        const bundle = auraMatch[1];
        types['AuraDefinitionBundle'] = (
          types['AuraDefinitionBundle'] || new Set()
        ).add(bundle);
        continue;
      }

      if (ext === '.cls') {
        types['ApexClass'] = (types['ApexClass'] || new Set()).add(base);
        continue;
      }
      if (ext === '.trigger') {
        types['ApexTrigger'] = (types['ApexTrigger'] || new Set()).add(base);
        continue;
      }

      // Flow detection before generic meta skip
      const flowMeta = norm.match(/\/flows\/([^/]+)\.flow-meta\.xml$/);
      if (flowMeta) {
        const flowName = flowMeta[1];
        (types['Flow'] = types['Flow'] || new Set()).add(flowName);
        continue;
      }
      if (ext === '.flow') {
        (types['Flow'] = types['Flow'] || new Set()).add(base);
        continue;
      }

      // Skip Apex metadata companion files (we handle the .cls/.trigger files directly)
      if (
        ext === '.xml' &&
        (p.endsWith('.cls-meta.xml') || p.endsWith('.trigger-meta.xml'))
      ) {
        console.log(`SF Deployer: Skipping Apex companion meta file: ${norm}`);
        continue;
      }

      // Additional metadata patterns
      if (ext === '.xml' && norm.endsWith('.layout-meta.xml')) {
        types['Layout'] = (types['Layout'] || new Set()).add(
          base.replace('.layout', '')
        );
        continue;
      }
      if (ext === '.xml' && norm.endsWith('.flexipage-meta.xml')) {
        types['FlexiPage'] = (types['FlexiPage'] || new Set()).add(
          base.replace('.flexipage-meta', '')
        );
        continue;
      }
      // Apex Test Suite
      if (ext === '.xml' && /\.testSuite-meta\.xml$/i.test(norm)) {
        const suiteName = base.replace(/\.testSuite-meta$/i, '');
        types['ApexTestSuite'] = (types['ApexTestSuite'] || new Set()).add(
          suiteName
        );
        continue;
      }
      if (ext === '.page') {
        types['ApexPage'] = (types['ApexPage'] || new Set()).add(base);
        continue;
      }
      if (ext === '.xml' && norm.endsWith('.tab-meta.xml')) {
        types['CustomTab'] = (types['CustomTab'] || new Set()).add(
          base.replace('.tab-meta', '')
        );
        continue;
      }
      // Custom Object patterns
      if (ext === '.xml' && norm.endsWith('.object-meta.xml')) {
        const objName = path.basename(norm, '.object-meta.xml');
        console.log(`SF Deployer: Found CustomObject: ${objName} from ${norm}`);
        types['CustomObject'] = (types['CustomObject'] || new Set()).add(
          objName
        );
        continue;
      }
      if (ext === '.object') {
        console.log(`SF Deployer: Found CustomObject: ${base} from ${norm}`);
        types['CustomObject'] = (types['CustomObject'] || new Set()).add(base);
        continue;
      }
      // Support objects in objects/ directory without meta suffix
      if (
        ext === '.xml' &&
        norm.includes('/objects/') &&
        !norm.includes('/fields/')
      ) {
        const objectMatch = norm.match(/\/objects\/([^/]+)\.xml$/);
        if (objectMatch) {
          let objName = objectMatch[1];
          // Remove common suffixes that might be in filename but not needed in manifest
          objName = objName
            .replace(/\.object$/, '')
            .replace(/\.object-meta$/, '');
          console.log(
            `SF Deployer: Found CustomObject (alt pattern): ${objName} from ${norm}`
          );
          types['CustomObject'] = (types['CustomObject'] || new Set()).add(
            objName
          );
          continue;
        }
      }
      // Custom Field patterns
      if (
        ext === '.xml' &&
        norm.includes('/fields/') &&
        norm.endsWith('.field-meta.xml')
      ) {
        console.log(`SF Deployer: Checking field pattern for: ${norm}`);
        const match = norm.match(
          /\/objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/
        );
        if (match) {
          const obj = match[1];
          const field = match[2];
          console.log(
            `SF Deployer: Found CustomField: ${obj}.${field} from ${norm}`
          );
          types['CustomField'] = (types['CustomField'] || new Set()).add(
            `${obj}.${field}`
          );
        } else {
          console.log(`SF Deployer: Field pattern did not match for: ${norm}`);
        }
        continue;
      }
      // Support fields without meta suffix
      if (ext === '.field' && norm.includes('/fields/')) {
        const fieldMatch = norm.match(
          /\/objects\/([^/]+)\/fields\/([^/]+)\.field$/
        );
        if (fieldMatch) {
          const obj = fieldMatch[1];
          const field = fieldMatch[2];
          console.log(
            `SF Deployer: Found CustomField (alt pattern): ${obj}.${field} from ${norm}`
          );
          types['CustomField'] = (types['CustomField'] || new Set()).add(
            `${obj}.${field}`
          );
          continue;
        }
      }
      // Fallback for any field file in /fields/ directory
      if (ext === '.xml' && norm.includes('/fields/')) {
        const generalFieldMatch = norm.match(
          /\/([^/]+)\/fields\/([^/]+)\.xml$/
        );
        if (generalFieldMatch) {
          const obj = generalFieldMatch[1];
          const field = generalFieldMatch[2].replace('.field-meta', '');
          console.log(
            `SF Deployer: Found CustomField (general pattern): ${obj}.${field} from ${norm}`
          );
          types['CustomField'] = (types['CustomField'] || new Set()).add(
            `${obj}.${field}`
          );
          continue;
        }
      }
      if (ext === '.xml' && norm.endsWith('.profile-meta.xml')) {
        types['Profile'] = (types['Profile'] || new Set()).add(
          base.replace('.profile', '')
        );
        continue;
      }
      if (ext === '.flow') {
        types['Flow'] = (types['Flow'] || new Set()).add(base);
        continue;
      }
      if (ext === '.xml' && norm.endsWith('.flow-meta.xml')) {
        types['Flow'] = (types['Flow'] || new Set()).add(
          base.replace('.flow', '')
        );
        continue;
      }
      if (ext === '.xml' && norm.endsWith('.group-meta.xml')) {
        types['Group'] = (types['Group'] || new Set()).add(
          base.replace('.group', '')
        );
        continue;
      }
      // Flow via file or meta
      const flowMatch = norm.match(/\/flows\/([^/]+)\.flow/);
      if (flowMatch) {
        const flowName = flowMatch[1];
        (types['Flow'] = types['Flow'] || new Set()).add(flowName);
        continue;
      }

      // Log unmatched files for debugging
      console.log(
        `SF Deployer: No metadata type match found for: ${norm} (ext: ${ext})`
      );
    }

    const tClassifyEnd = performance.now();

    const typeEntries = Object.entries(types);
    if (!typeEntries.length) {
      console.log(
        `SF Deployer: Processed ${filePaths.length} files but found no recognizable metadata types`
      );
      console.log('SF Deployer: Files processed:', filePaths);
      throw new Error(
        `No recognizable metadata types found in ${filePaths.length} selected files. Check console for details of processed files.`
      );
    }

    console.log(
      `SF Deployer: Successfully identified metadata types:`,
      Object.keys(types)
    );
    console.log(
      `SF Deployer: Total files processed: ${filePaths.length}, Types found: ${typeEntries.length}`
    );

    const xmlParts: string[] = [];
    xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
    xmlParts.push('<Package xmlns="http://soap.sforce.com/2006/04/metadata">');
    for (const [typeName, members] of typeEntries) {
      xmlParts.push('  <types>');
      for (const m of [...members]) {
        xmlParts.push(`    <members>${m}</members>`);
      }
      xmlParts.push(`    <name>${typeName}</name>`);
      xmlParts.push('  </types>');
    }
    xmlParts.push('  <version>60.0</version>');
    xmlParts.push('</Package>');

    const xmlString = xmlParts.join('\n');

    // Prepare directories
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath ||
      context.extensionPath;
    const manifestsDir = path.join(workspaceRoot, '.sf-deployer');
    await fsp.mkdir(manifestsDir, { recursive: true });
    const manifestPath = path.join(manifestsDir, 'package.xml');

    // Overwrite existing manifest without archiving
    const tWriteStart = performance.now();
    await fsp.writeFile(manifestPath, xmlString);
    const tWriteEnd = performance.now();

    // Logging timing metrics
    console.log(
      `SF Deployer timing — collect: ${(tCollectEnd - tCollectStart).toFixed(
        1
      )} ms, classify: ${(tClassifyEnd - tClassifyStart).toFixed(
        1
      )} ms, write: ${(tWriteEnd - tWriteStart).toFixed(1)} ms, total: ${(
        tWriteEnd - tStart
      ).toFixed(1)} ms, files: ${filePaths.length}`
    );

    return { path: manifestPath, xml: xmlString } as const;
  }

  /**
   * Save current selection as a named manifest
   */
  static async saveNamedManifest(
    context: vscode.ExtensionContext,
    manifestName: string
  ): Promise<{ path: string; xml: string }> {
    const selected = context.workspaceState.get<string[]>(
      'sfDeployer.selected',
      []
    );
    if (!selected.length) {
      throw new Error('No files selected to save');
    }

    // Build the manifest content using the same logic as build()
    const { xml } = await this.build(context);

    // Prepare directories
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath ||
      context.extensionPath;
    const manifestsDir = path.join(workspaceRoot, '.sf-deployer');
    await fsp.mkdir(manifestsDir, { recursive: true });

    // Create manifest with custom name
    const sanitizedName = manifestName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const manifestPath = path.join(manifestsDir, `${sanitizedName}.xml`);

    // Validate path to prevent directory traversal
    const resolvedPath = path.resolve(manifestPath);
    const resolvedDir = path.resolve(manifestsDir);
    if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
      throw new Error('Invalid manifest path: directory traversal detected');
    }

    // Escape XML comment content to prevent injection
    const escapeXmlComment = (str: string) => str.replace(/--/g, '- -');

    // Save manifest with metadata header
    const manifestContent = `<!-- SF Deployer Named Manifest: ${escapeXmlComment(manifestName)} -->
<!-- Created: ${new Date().toISOString()} -->
<!-- Selected Paths: ${escapeXmlComment(JSON.stringify(selected))} -->
${xml}`;

    await fsp.writeFile(manifestPath, manifestContent);

    console.log(
      `SF Deployer: Saved named manifest "${manifestName}" to ${manifestPath}`
    );
    return { path: manifestPath, xml: manifestContent };
  }

  /**
   * Load a named manifest and restore picker selection
   */
  static async loadNamedManifest(
    context: vscode.ExtensionContext,
    manifestName: string
  ): Promise<{
    selections: string[];
    xml: string;
    validatedSelections: string[];
  }> {
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath ||
      context.extensionPath;
    const manifestsDir = path.join(workspaceRoot, '.sf-deployer');

    // Apply same sanitization as save method
    const sanitizedName = manifestName.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Try different file extensions
    const possiblePaths = [
      path.join(manifestsDir, `${sanitizedName}.xml`),
      path.join(manifestsDir, `${sanitizedName}`),
    ];

    let manifestPath = '';
    let manifestContent = '';

    for (const tryPath of possiblePaths) {
      try {
        manifestContent = await fsp.readFile(tryPath, 'utf8');
        manifestPath = tryPath;
        break;
      } catch (err) {
        continue; // Try next path
      }
    }

    if (!manifestPath) {
      throw new Error(`Named manifest "${manifestName}" not found`);
    }

    // Validate basic XML structure
    if (
      !manifestContent.includes('<Package') ||
      !manifestContent.includes('</Package>')
    ) {
      throw new Error(
        `Manifest "${manifestName}" appears to be corrupted - invalid XML structure`
      );
    }

    // Extract selected paths from manifest header comment
    let selections: string[] = [];
    const pathsMatch = manifestContent.match(/<!-- Selected Paths: (.+?) -->/);
    if (pathsMatch) {
      try {
        const parsedSelections = JSON.parse(pathsMatch[1]);
        if (Array.isArray(parsedSelections)) {
          selections = parsedSelections.filter(
            (path) => typeof path === 'string' && path.trim().length > 0
          );
        }
      } catch (err) {
        console.warn(
          'Could not parse selected paths from manifest header, falling back to empty selection'
        );
        selections = [];
      }
    }

    // Validate that selected paths still exist
    const validatedSelections: string[] = [];
    const invalidPaths: string[] = [];

    for (const selPath of selections) {
      try {
        const fullPath = path.isAbsolute(selPath)
          ? selPath
          : path.join(workspaceRoot, selPath);
        await fsp.access(fullPath);
        validatedSelections.push(selPath);
      } catch (err) {
        invalidPaths.push(selPath);
      }
    }

    // Log warnings for invalid paths but don't fail
    if (invalidPaths.length > 0) {
      console.warn(
        `SF Deployer: Found ${invalidPaths.length} invalid/missing paths in manifest "${manifestName}":`,
        invalidPaths.slice(0, 5) // Show first 5 to avoid spam
      );
      if (invalidPaths.length > 5) {
        console.warn(`... and ${invalidPaths.length - 5} more`);
      }
    }

    // Update workspace state with validated selections
    context.workspaceState.update('sfDeployer.selected', validatedSelections);

    const message =
      invalidPaths.length > 0
        ? `Loaded manifest "${manifestName}" with ${validatedSelections.length}/${selections.length} valid files (${invalidPaths.length} missing)`
        : `Loaded manifest "${manifestName}" with ${validatedSelections.length} selections`;

    console.log(`SF Deployer: ${message}`);

    return {
      selections,
      xml: manifestContent,
      validatedSelections,
    };
  }

  /**
   * List all saved named manifests
   */
  static async listNamedManifests(
    context: vscode.ExtensionContext
  ): Promise<string[]> {
    const workspaceRoot =
      vscode.workspace.workspaceFolders?.[0].uri.fsPath ||
      context.extensionPath;
    const manifestsDir = path.join(workspaceRoot, '.sf-deployer');

    try {
      const files = await fsp.readdir(manifestsDir);
      const manifestFiles = files
        .filter((f) => f.endsWith('.xml') && f !== 'package.xml')
        .map((f) => path.basename(f, '.xml'))
        .sort();

      return manifestFiles;
    } catch (err) {
      // Directory doesn't exist or is empty
      return [];
    }
  }
}
