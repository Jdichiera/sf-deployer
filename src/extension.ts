import * as vscode from 'vscode';
import { exec } from 'child_process';
import { ManifestBuilder } from './manifestBuilder';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  // Store reference to active webview panel
  let activeWebviewPanel: vscode.WebviewPanel | undefined;

  // Open Picker webview
  const openPicker = vscode.commands.registerCommand(
    'sfDeployer.openPicker',
    async () => {
      const panel = vscode.window.createWebviewPanel(
        'sfDeployerPicker',
        'SF Deployer Picker',
        vscode.ViewColumn.One,
        { enableScripts: true, retainContextWhenHidden: true }
      );

      // Store reference to active panel
      activeWebviewPanel = panel;

      // Clear reference when panel is disposed
      panel.onDidDispose(() => {
        activeWebviewPanel = undefined;
      });

      const nonce = Math.random().toString(36).substring(2, 15);
      panel.webview.html = await getPickerHtml(context, panel, nonce);

      // send authenticated org aliases (dropdown removed in vNext)
      const debugChan = vscode.window.createOutputChannel('SF Deployer Debug');
      debugChan.appendLine('Picker opened – using CLI default target org');
      // (org selection dropdown removed)

      // send initial tree once webview is ready
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders?.length) {
        panel.webview.postMessage({ type: 'init', tree: [], selected: [] });
        // Send initial manifest list even when no workspace folders
        try {
          const manifestList =
            await ManifestBuilder.listNamedManifests(context);
          panel.webview.postMessage({
            type: 'manifestList',
            manifests: manifestList,
          });
        } catch (err: any) {
          console.error('Failed to load initial manifest list:', err);
        }
      } else {
        let root = workspaceFolders[0].uri.fsPath;
        const forceApp = path.join(root, 'force-app');
        try {
          const stat = await vscode.workspace.fs.stat(
            vscode.Uri.file(forceApp)
          );
          if (stat.type === vscode.FileType.Directory) {
            root = forceApp;
          }
        } catch {
          // force-app not found; default root remains
        }
        const tree = await buildTree(root);
        const selected = context.workspaceState.get<string[]>(
          'sfDeployer.selected',
          []
        );
        panel.webview.postMessage({ type: 'init', tree, selected });

        // Send initial manifest list
        try {
          const manifestList =
            await ManifestBuilder.listNamedManifests(context);
          panel.webview.postMessage({
            type: 'manifestList',
            manifests: manifestList,
          });
        } catch (err: any) {
          console.error('Failed to load initial manifest list:', err);
        }

        // Show initial manifest state
        setTimeout(() => {
          if (selected.length > 0) {
            broadcastManifest();
          } else {
            // Show helpful message when no files selected
            activeWebviewPanel?.webview.postMessage({
              type: 'manifest',
              xml: '<!-- No files selected. Choose files/folders from the tree to generate a manifest. -->',
            });
          }
        }, 100); // Small delay to ensure webview is ready
      }

      panel.webview.onDidReceiveMessage(async (msg) => {
        if (msg.type === 'log') {
          console.log('Webview:', msg.text);
        } else if (msg.type === 'update') {
          const sel: Set<string> = new Set(
            context.workspaceState.get<string[]>('sfDeployer.selected', [])
          );
          if (msg.selected) {
            sel.add(msg.path);
          } else {
            sel.delete(msg.path);
          }
          context.workspaceState.update('sfDeployer.selected', Array.from(sel));
          void broadcastManifest();
        } else if (msg.type === 'bulkSet') {
          const sel: Set<string> = new Set(
            context.workspaceState.get<string[]>('sfDeployer.selected', [])
          );
          if (msg.selected) {
            msg.paths.forEach((p: string) => sel.add(p));
          } else {
            msg.paths.forEach((p: string) => sel.delete(p));
          }
          context.workspaceState.update('sfDeployer.selected', Array.from(sel));
          void broadcastManifest();
        } else if (msg.type === 'cleared') {
          context.workspaceState.update('sfDeployer.selected', []);
          panel.webview.postMessage({ type: 'cleared' });
          void broadcastManifest();
        } else if (msg.type === 'deploy') {
          context.workspaceState.update('sfDeployer.deployFlags', msg.flags);
          void runDeployWithFlags(msg.flags);
        } else if (msg.type === 'saveManifest') {
          try {
            const { path: savedPath } = await ManifestBuilder.saveNamedManifest(
              context,
              msg.manifestName
            );
            panel.webview.postMessage({
              type: 'manifestSaved',
              manifestName: msg.manifestName,
              path: savedPath,
            });
            vscode.window.showInformationMessage(
              `SF Deployer: Saved manifest "${msg.manifestName}"`
            );

            // Send updated manifest list
            const manifestList =
              await ManifestBuilder.listNamedManifests(context);
            panel.webview.postMessage({
              type: 'manifestList',
              manifests: manifestList,
            });
          } catch (err: any) {
            panel.webview.postMessage({
              type: 'manifestError',
              error: `Failed to save manifest: ${err.message}`,
            });
            vscode.window.showErrorMessage(
              `Failed to save manifest: ${err.message}`
            );
          }
        } else if (msg.type === 'loadManifest') {
          try {
            const { selections, validatedSelections } =
              await ManifestBuilder.loadNamedManifest(
                context,
                msg.manifestName
              );
            panel.webview.postMessage({
              type: 'manifestLoaded',
              manifestName: msg.manifestName,
              selections: validatedSelections,
              originalSelections: selections,
              hasInvalidPaths: selections.length !== validatedSelections.length,
            });

            // Update the picker tree selections to reflect loaded manifest
            panel.webview.postMessage({
              type: 'updateSelections',
              selections: validatedSelections,
            });

            // Update the manifest preview
            void broadcastManifest();

            // Provide user feedback about validation results
            const invalidCount = selections.length - validatedSelections.length;
            if (invalidCount > 0) {
              vscode.window.showWarningMessage(
                `SF Deployer: Loaded manifest "${msg.manifestName}" with ${validatedSelections.length}/${selections.length} valid files. ${invalidCount} files are missing or invalid and were skipped.`
              );
            } else {
              vscode.window.showInformationMessage(
                `SF Deployer: Loaded manifest "${msg.manifestName}" with ${validatedSelections.length} files`
              );
            }
          } catch (err: any) {
            panel.webview.postMessage({
              type: 'manifestError',
              error: `Failed to load manifest: ${err.message}`,
            });
            vscode.window.showErrorMessage(
              `Failed to load manifest: ${err.message}`
            );
          }
        } else if (msg.type === 'requestManifestList') {
          try {
            const manifestList =
              await ManifestBuilder.listNamedManifests(context);
            panel.webview.postMessage({
              type: 'manifestList',
              manifests: manifestList,
            });
          } catch (err: any) {
            console.error('Failed to load manifest list:', err);
          }
        }
        // handle future selection updates here
      });
    }
  );

  context.subscriptions.push(openPicker);

  // Unused function removed for cleaner code

  async function runDeployWithFlags(flags: any) {
    const selected = context.workspaceState.get<string[]>(
      'sfDeployer.selected',
      []
    );
    if (!selected.length) {
      vscode.window.showWarningMessage(
        'SF Deployer: No files/folders selected.'
      );
      return;
    }

    let manifestPath = '';
    try {
      const { path: builtPath, xml } = await ManifestBuilder.build(context);
      manifestPath = builtPath;
      broadcastManifest(xml);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Manifest error: ${err.message}`);
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders?.length) {
      vscode.window.showErrorMessage('No workspace folder open.');
      return;
    }
    const cwd = workspaceFolders[0].uri.fsPath;

    const deployMode =
      flags.mode === 'preview' || flags.mode === 'validate'
        ? flags.mode
        : 'start';
    let cmdBase = `sf project deploy ${deployMode} --manifest "${manifestPath}" --verbose`;

    if (flags.orgAlias) {
      cmdBase += ` --target-org ${flags.orgAlias}`;
    }
    if (flags.dryRun) cmdBase += ' --dry-run';
    // if (flags.checkOnly) cmd += ' --check-only';

    if (!flags.testLevel || flags.testLevel === 'none')
      cmdBase += ' --test-level NoTestRun';
    else if (flags.testLevel === 'all')
      cmdBase += ' --test-level RunLocalTests';
    else if (flags.testLevel === 'specified') {
      let tests = flags.tests;
      if (!tests || !tests.length) {
        // derive from selected .cls files ending with Test or containing @isTest
        tests = selected
          .filter((p) => p.endsWith('.cls'))
          .filter((p) => {
            try {
              const content = fs.readFileSync(p, 'utf8');
              return /@isTest/i.test(content);
            } catch {
              return false;
            }
          })
          .map((p) => path.basename(p, '.cls'));
      }
      if (tests.length) {
        // Persist tests to tests.txt for reuse
        try {
          const manifestsDirPath = path.join(cwd, 'manifests');
          fs.mkdirSync(manifestsDirPath, { recursive: true });
          fs.writeFileSync(
            path.join(manifestsDirPath, 'manifestTests'),
            tests.join('\n'),
            'utf8'
          );
          console.log(
            `SF Deployer: Wrote ${tests.length} test classes to tests.txt`
          );
        } catch (err) {
          console.error('SF Deployer: Failed to write tests.txt', err);
        }

        const testsArg = '--test-level RunSpecifiedTests --tests';
        // We'll stream the command to the terminal in chunks to avoid VSCode input limits
        const terminal = vscode.window.createTerminal({
          name: 'SF Deployer',
          cwd,
        });
        terminal.show(true);

        // 1) send the base command and testsArg (no newline yet)
        terminal.sendText(`${cmdBase} ${testsArg}`, false);

        // 2) stream each test class separated by space
        for (const t of tests) {
          terminal.sendText(` ${t}`, false);
        }

        // 3) finally send newline to execute
        terminal.sendText('', true);

        // create status bar etc. then return early
        const status = vscode.window.createStatusBarItem(
          vscode.StatusBarAlignment.Left
        );
        status.text = `$(sync~spin) SF Deployer running in terminal...`;
        status.show();
        setTimeout(() => status.hide(), 10000);
        return;
      } else {
        vscode.window.showWarningMessage(
          'No Apex test classes selected; running with NoTestRun.'
        );
        cmdBase += ' --test-level NoTestRun';
      }
    }

    // For branches where we didn't return early (NoTestRun, RunLocalTests etc.) send whole command directly
    const terminal = vscode.window.createTerminal({ name: 'SF Deployer', cwd });
    terminal.show(true);
    terminal.sendText(`${cmdBase}`, true);

    const status = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left
    );
    status.text = `$(sync~spin) SF Deployer running in terminal...`;
    status.show();

    // Cannot auto-hide status because we don't know when terminal finishes; hide after 10s
    setTimeout(() => status.hide(), 10000);
  }

  async function broadcastManifest(xml?: string) {
    if (!activeWebviewPanel) {
      console.log('SF Deployer: No active webview to broadcast manifest to');
      return; // No active webview to broadcast to
    }

    if (!xml) {
      try {
        const selected = context.workspaceState.get<string[]>(
          'sfDeployer.selected',
          []
        );
        if (selected.length === 0) {
          // No files selected, show helpful message
          activeWebviewPanel.webview.postMessage({
            type: 'manifest',
            xml: '<!-- No files selected. Choose files/folders from the tree to generate a manifest. -->',
          });
          return;
        }

        console.log(
          `SF Deployer: Building manifest for ${selected.length} selected items`
        );
        const res = await ManifestBuilder.build(context);
        xml = res.xml;
        console.log('SF Deployer: Manifest built successfully');
      } catch (error: any) {
        console.error('SF Deployer: Manifest build failed:', error.message);
        // Send error message to webview
        activeWebviewPanel.webview.postMessage({
          type: 'manifestError',
          error: `Failed to generate manifest: ${error.message}`,
        });
        return;
      }
    }

    // Send manifest to active webview
    activeWebviewPanel.webview.postMessage({ type: 'manifest', xml });
    console.log('SF Deployer: Manifest broadcast to webview');
  }
}

export function deactivate() {}

async function buildTree(dir: string): Promise<any[]> {
  const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
  const result: any[] = [];
  for (const [name, type] of entries) {
    if (name === 'node_modules' || name.startsWith('.git')) {
      continue;
    }
    const full = path.join(dir, name);
    if (type === vscode.FileType.Directory) {
      result.push({
        name,
        path: full,
        children: await buildTree(full),
      });
    } else {
      if (name.endsWith('.cls-meta.xml')) {
        continue; // hide Apex metadata companion files
      }
      result.push({ name, path: full });
    }
  }
  return result;
}

async function getPickerHtml(
  ctx: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  nonce: string
): Promise<string> {
  const templatePath = path.join(
    ctx.extensionPath,
    'media',
    'pickerTemplate.html'
  );
  let html = fs.readFileSync(templatePath, 'utf8');
  // inject CSP nonce
  html = html.replace(
    '<!-- CSP nonce replaced at runtime -->',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' vscode-resource:; style-src 'unsafe-inline' vscode-resource:;" />`
  );
  html = html.replace(/__NONCE__/g, nonce);
  // Fix relative script src
  const scriptPath = vscode.Uri.file(
    path.join(ctx.extensionPath, 'media', 'pickerScript.js')
  );
  const scriptUri = panel.webview.asWebviewUri(scriptPath);
  // Removed codicon CSS injection as we now use emoji
  html = html.replace('pickerScript.js', scriptUri.toString());
  return html;
}

async function loadAliasesViaCli(): Promise<string[]> {
  try {
    const { execSync } = await import('child_process');
    const json = execSync('sf org list --json', { encoding: 'utf8' });
    const data = JSON.parse(json);
    return [...data.result.nonScratchOrgs, ...data.result.scratchOrgs].map(
      (o: any) => o.alias ?? o.username
    );
  } catch {
    return [];
  }
}
