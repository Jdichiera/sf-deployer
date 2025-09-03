export const workspace = {
  workspaceFolders: [{ uri: { fsPath: '/tmp' } }],
  fs: {
    readDirectory: async () => [],
    stat: async () => ({ type: 2 }),
  },
};

// Simple command registry
const commandRegistry: Record<string, Function> = {};

export const commands = {
  registerCommand: (id: string, cb: Function) => {
    commandRegistry[id] = cb;
  },
  executeCommand: async (id: string, ...args: any[]) => {
    return commandRegistry[id]?.(...args);
  },
};

// Webview + window mocks
export const window = {
  createOutputChannel: () => ({ appendLine: jest.fn(), show: jest.fn() }),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showQuickPick: jest.fn(),
  createTerminal: () => ({ show: jest.fn(), sendText: jest.fn() }),
  createStatusBarItem: () => ({ show: jest.fn(), hide: jest.fn(), text: '' }),
  createWebviewPanel: () => new WebviewPanel(),
  activeTextEditor: undefined,
};

export const ViewColumn = { One: 1 };

export const StatusBarAlignment = { Left: 1, Right: 2 } as const;

export const windowState: any = {};

export const Uri = { file: (p: string) => ({ fsPath: p }) };

export const WebviewPanel = class {
  public webview = {
    postMessage: jest.fn(),
    asWebviewUri: (u: any) => ({
      toString: () => (u.toString ? u.toString() : String(u)),
    }),
    _msgCb: undefined as any,
    onDidReceiveMessage(cb: Function) {
      this._msgCb = cb;
    },
    _fire(msg: any) {
      this._msgCb?.(msg);
    },
  };
  onDidDispose = (cb: Function) => {
    this._disposeCb = cb;
  };
  _disposeCb?: Function;
  dispose() {
    this._disposeCb?.();
  }
};

export const ExtensionContext = class {
  subscriptions: any[] = [];
  extensionPath = '/tmp';
  workspaceState = {
    _state: new Map<string, any>(),
    get: (k: string, def?: any) => this.workspaceState._state.get(k) ?? def,
    update: (k: string, v: any) => this.workspaceState._state.set(k, v),
  };
};

export default { workspace, commands, window, Uri, ViewColumn };
