import * as vscode from 'vscode';

export class FileExplorerProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private selected: Set<string>;

  constructor(private context: vscode.ExtensionContext) {
    const saved = context.workspaceState.get<string[]>(
      'sfDeployer.selected',
      []
    );
    this.selected = new Set(saved);
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!vscode.workspace.workspaceFolders?.length) {
      return [];
    }
    const root = vscode.workspace.workspaceFolders[0].uri;
    if (!element) {
      // top-level folders/files
      const children = await vscode.workspace.fs.readDirectory(root);
      return children.map(([name, type]) => this.createItem(root, name, type));
    } else {
      const uri = element.resourceUri!;
      if (element.contextValue === 'folder') {
        const kids = await vscode.workspace.fs.readDirectory(uri);
        return kids.map(([name, type]) => this.createItem(uri, name, type));
      }
      return [];
    }
  }

  private createItem(
    parent: vscode.Uri,
    name: string,
    type: vscode.FileType
  ): vscode.TreeItem {
    const uri = vscode.Uri.joinPath(parent, name);
    const isFolder = type === vscode.FileType.Directory;
    const item = new vscode.TreeItem(
      uri,
      isFolder
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    item.contextValue = isFolder ? 'folder' : 'file';
    item.resourceUri = uri;
    item.iconPath = isFolder ? vscode.ThemeIcon.Folder : vscode.ThemeIcon.File;
    // Checkbox-like indicator using description
    if (this.selected.has(uri.fsPath)) {
      item.description = '✔';
    }
    return item;
  }

  toggleSelect(uri: vscode.Uri) {
    const key = uri.fsPath;
    if (this.selected.has(key)) {
      this.selected.delete(key);
    } else {
      this.selected.add(key);
    }
    this.save();
    this.refresh();
  }

  clear() {
    this.selected.clear();
    this.save();
    this.refresh();
  }

  private save() {
    this.context.workspaceState.update(
      'sfDeployer.selected',
      Array.from(this.selected)
    );
  }

  getSelected(): string[] {
    return Array.from(this.selected);
  }
}
