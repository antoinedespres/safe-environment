import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const provider = new SafeEnvWarningProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(SafeEnvWarningProvider.viewType, provider)
  );

  // Intercept .env openings
  const disposable = vscode.workspace.onDidOpenTextDocument(async (doc) => {
    if (doc.fileName.endsWith('.env') && doc.uri.scheme === 'file') {
      try {
        // Use a small delay to ensure the editor is fully opened before closing
        await new Promise(resolve => setTimeout(resolve, 10));

        // Close the normal file editor
        const editors = vscode.window.visibleTextEditors.filter(
          (e) => e.document === doc
        );

        if (editors.length > 0) {
          for (const editor of editors) {
            await vscode.window.showTextDocument(editor.document);
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          }
        }

        // Open our custom warning view instead
        const fakeUri = vscode.Uri.file(doc.fileName).with({ scheme: 'safeenv' });
        await vscode.commands.executeCommand('vscode.openWith', fakeUri, SafeEnvWarningProvider.viewType);
      } catch (error) {
        console.error('Failed to intercept .env file opening:', error);
      }
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

/**
 * Custom Editor Provider that shows a full-page warning
 */
class SafeEnvWarningProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'safeEnv.warningView';

  constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
    return { uri, dispose() {} };
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    // Extract the original file path from the URI (format: safeenv:/path/to/file.env)
    const filePath = document.uri.path;

    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview, filePath);

    // Handle messages from the webview
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      try {
        if (msg.command === 'openAnyway') {
          // Close the warning tab
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          // Open the real file
          const realDoc = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(realDoc);
        } else if (msg.command === 'cancel') {
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to handle action: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private getHtml(webview: vscode.Webview, filePath: string): string {
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Safe Environment Warning</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            background-color: #1e1e1e;
            color: #ddd;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
            padding: 2rem;
          }
          h1 { color: #ffcc00; font-size: 1.8rem; }
          p { max-width: 600px; }
          button {
            margin: 1rem;
            padding: 0.8rem 1.5rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
          }
          #open {
            background-color: #007acc;
            color: white;
          }
          #cancel {
            background-color: #555;
            color: white;
          }
        </style>
      </head>
      <body>
        <h1>⚠️ Sensitive file detected</h1>
        <p>
          You are trying to open <b>${filePath}</b><br><br>
          .env files often contain API keys or secrets.<br>
          Opening them while streaming could expose sensitive data.
        </p>
        <div>
          <button id="open">🔓 Open Anyway</button>
          <button id="cancel">🚫 Cancel</button>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          document.getElementById('open').addEventListener('click', () => {
            vscode.postMessage({ command: 'openAnyway' });
          });
          document.getElementById('cancel').addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
          });
        </script>
      </body>
      </html>
    `;
  }
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
