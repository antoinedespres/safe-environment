import * as vscode from 'vscode';

// Built-in patterns with human-readable descriptions
const BUILTIN_PATTERNS: { pattern: string; label: string; category: string }[] = [
  // Environment files
  { pattern: '[/\\\\]\\.env($|\\.)', label: '.env files', category: 'Environment' },
  { pattern: '[/\\\\]\\.envrc$', label: '.envrc (direnv)', category: 'Environment' },
  { pattern: '\\.local$', label: '*.local files', category: 'Environment' },

  // Credentials & Keys
  { pattern: '[/\\\\]\\.netrc$', label: '.netrc', category: 'Credentials' },
  { pattern: '[/\\\\]_netrc$', label: '_netrc', category: 'Credentials' },
  { pattern: '[/\\\\]\\.npmrc$', label: '.npmrc', category: 'Credentials' },
  { pattern: '[/\\\\]\\.pypirc$', label: '.pypirc', category: 'Credentials' },
  { pattern: '[/\\\\]\\.gem[/\\\\]credentials$', label: '.gem/credentials', category: 'Credentials' },
  { pattern: '[/\\\\]\\.docker[/\\\\]config\\.json$', label: '.docker/config.json', category: 'Credentials' },
  { pattern: '[/\\\\]credentials\\.json$', label: 'credentials.json', category: 'Credentials' },
  { pattern: '[/\\\\]secrets\\.json$', label: 'secrets.json', category: 'Credentials' },
  { pattern: '\\.pem$', label: '*.pem files', category: 'Keys' },
  { pattern: '\\.key$', label: '*.key files', category: 'Keys' },
  { pattern: '\\.p12$', label: '*.p12 files', category: 'Keys' },
  { pattern: '\\.pfx$', label: '*.pfx files', category: 'Keys' },

  // Cloud & Services
  { pattern: '[/\\\\]\\.aws[/\\\\]credentials$', label: '.aws/credentials', category: 'Cloud' },
  { pattern: '[/\\\\]\\.aws[/\\\\]config$', label: '.aws/config', category: 'Cloud' },
  { pattern: '[/\\\\]\\.gcloud[/\\\\]credentials\\.db$', label: '.gcloud/credentials.db', category: 'Cloud' },
  { pattern: '[/\\\\]\\.azure[/\\\\]credentials$', label: '.azure/credentials', category: 'Cloud' },
  { pattern: '[/\\\\]service-account.*\\.json$', label: 'service-account*.json', category: 'Cloud' },
  { pattern: '[/\\\\]kubeconfig$', label: 'kubeconfig', category: 'Cloud' },
  { pattern: '[/\\\\]\\.kube[/\\\\]config$', label: '.kube/config', category: 'Cloud' },

  // Version Control & CI
  { pattern: '[/\\\\]\\.git-credentials$', label: '.git-credentials', category: 'Git' },
  { pattern: '[/\\\\]\\.github[/\\\\]secrets', label: '.github/secrets', category: 'Git' },

  // Application-Specific
  { pattern: '[/\\\\]wp-config\\.php$', label: 'wp-config.php', category: 'Application' },
  { pattern: '[/\\\\]\\.htpasswd$', label: '.htpasswd', category: 'Application' },
];

// Extract just the pattern strings for backwards compatibility
const DEFAULT_SENSITIVE_PATTERNS: string[] = BUILTIN_PATTERNS.map(p => p.pattern);

/**
 * Get the effective list of sensitive file patterns from settings
 */
function getSensitivePatterns(): RegExp[] {
  const config = vscode.workspace.getConfiguration('safeEnvironment');
  const additionalPatterns = config.get<string[]>('additionalPatterns', []);
  const disabledPatterns = config.get<string[]>('disabledPatterns', []);

  // Filter out disabled patterns from defaults
  const activeDefaults = DEFAULT_SENSITIVE_PATTERNS.filter(
    pattern => !disabledPatterns.some(disabled => {
      try {
        return pattern === disabled || new RegExp(disabled).source === new RegExp(pattern).source;
      } catch {
        return pattern === disabled;
      }
    })
  );

  // Combine defaults with additional patterns
  const allPatterns = [...activeDefaults, ...additionalPatterns];

  // Convert strings to RegExp, filtering out invalid patterns
  return allPatterns
    .map(pattern => {
      try {
        return new RegExp(pattern);
      } catch (e) {
        console.warn(`Invalid regex pattern: ${pattern}`, e);
        return null;
      }
    })
    .filter((p): p is RegExp => p !== null);
}

/**
 * Check if a file path matches any sensitive file pattern
 */
function isSensitiveFile(filePath: string): boolean {
  const patterns = getSensitivePatterns();
  return patterns.some(pattern => pattern.test(filePath));
}

/**
 * Check if the extension is enabled
 */
function isEnabled(): boolean {
  const config = vscode.workspace.getConfiguration('safeEnvironment');
  return config.get<boolean>('enabled', true);
}

/**
 * Quick Pick menu for toggling patterns
 */
async function showQuickToggle(): Promise<void> {
  const config = vscode.workspace.getConfiguration('safeEnvironment');
  const disabledPatterns = config.get<string[]>('disabledPatterns', []);
  const additionalPatterns = config.get<string[]>('additionalPatterns', []);

  interface PatternItem extends vscode.QuickPickItem {
    pattern: string;
    isBuiltin: boolean;
  }

  // Build items list
  const items: PatternItem[] = [];

  // Add built-in patterns
  for (const p of BUILTIN_PATTERNS) {
    const isDisabled = disabledPatterns.includes(p.pattern);
    items.push({
      label: `${isDisabled ? '$(circle-outline)' : '$(check)'} ${p.label}`,
      description: p.category,
      detail: isDisabled ? 'Disabled' : 'Enabled',
      pattern: p.pattern,
      isBuiltin: true,
      picked: !isDisabled,
    });
  }

  // Add custom patterns
  for (const pattern of additionalPatterns) {
    items.push({
      label: `$(check) ${pattern}`,
      description: 'Custom',
      detail: 'Enabled (custom pattern)',
      pattern: pattern,
      isBuiltin: false,
      picked: true,
    });
  }

  // Add option to add new pattern
  const addNewItem: PatternItem = {
    label: '$(add) Add custom pattern...',
    description: '',
    pattern: '',
    isBuiltin: false,
  };
  items.push(addNewItem);

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a pattern to toggle or add a new one',
    title: 'Safe Environment: Toggle Patterns',
  });

  if (!selected) {
    return;
  }

  // Handle "Add new pattern"
  if (selected === addNewItem) {
    const newPattern = await vscode.window.showInputBox({
      prompt: 'Enter a regex pattern for files to protect',
      placeHolder: 'e.g., secret\\.yaml$ or config\\.prod\\.json$',
      validateInput: (value) => {
        if (!value) {
          return 'Pattern cannot be empty';
        }
        try {
          new RegExp(value);
          return null;
        } catch {
          return 'Invalid regex pattern';
        }
      },
    });

    if (newPattern) {
      const updated = [...additionalPatterns, newPattern];
      await config.update('additionalPatterns', updated, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Added pattern: ${newPattern}`);
    }
    return;
  }

  // Toggle the selected pattern
  if (selected.isBuiltin) {
    // Toggle built-in pattern
    const isCurrentlyDisabled = disabledPatterns.includes(selected.pattern);
    let updated: string[];

    if (isCurrentlyDisabled) {
      // Re-enable it
      updated = disabledPatterns.filter(p => p !== selected.pattern);
      vscode.window.showInformationMessage(`Enabled: ${BUILTIN_PATTERNS.find(p => p.pattern === selected.pattern)?.label}`);
    } else {
      // Disable it
      updated = [...disabledPatterns, selected.pattern];
      vscode.window.showInformationMessage(`Disabled: ${BUILTIN_PATTERNS.find(p => p.pattern === selected.pattern)?.label}`);
    }

    await config.update('disabledPatterns', updated, vscode.ConfigurationTarget.Global);
  } else {
    // Remove custom pattern
    const confirm = await vscode.window.showQuickPick(['Yes', 'No'], {
      placeHolder: `Remove custom pattern "${selected.pattern}"?`,
    });

    if (confirm === 'Yes') {
      const updated = additionalPatterns.filter(p => p !== selected.pattern);
      await config.update('additionalPatterns', updated, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Removed pattern: ${selected.pattern}`);
    }
  }
}

/**
 * Settings Webview Panel
 */
class SettingsWebviewPanel {
  public static currentPanel: SettingsWebviewPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.update();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        const config = vscode.workspace.getConfiguration('safeEnvironment');

        switch (message.command) {
          case 'toggleEnabled':
            await config.update('enabled', message.value, vscode.ConfigurationTarget.Global);
            break;

          case 'toggleBuiltinPattern':
            const disabledPatterns = config.get<string[]>('disabledPatterns', []);
            let updated: string[];
            if (message.enabled) {
              updated = disabledPatterns.filter(p => p !== message.pattern);
            } else {
              updated = [...disabledPatterns, message.pattern];
            }
            await config.update('disabledPatterns', updated, vscode.ConfigurationTarget.Global);
            break;

          case 'addCustomPattern':
            const additionalPatterns = config.get<string[]>('additionalPatterns', []);
            if (message.pattern && !additionalPatterns.includes(message.pattern)) {
              try {
                new RegExp(message.pattern);
                await config.update('additionalPatterns', [...additionalPatterns, message.pattern], vscode.ConfigurationTarget.Global);
                this.update();
              } catch {
                vscode.window.showErrorMessage('Invalid regex pattern');
              }
            }
            break;

          case 'removeCustomPattern':
            const patterns = config.get<string[]>('additionalPatterns', []);
            await config.update('additionalPatterns', patterns.filter(p => p !== message.pattern), vscode.ConfigurationTarget.Global);
            this.update();
            break;

          case 'refresh':
            this.update();
            break;
        }
      },
      null,
      this.disposables
    );

    // Update when settings change
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('safeEnvironment')) {
        this.update();
      }
    }, null, this.disposables);
  }

  public static show() {
    if (SettingsWebviewPanel.currentPanel) {
      SettingsWebviewPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'safeEnvironmentSettings',
      'Safe Environment Settings',
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    SettingsWebviewPanel.currentPanel = new SettingsWebviewPanel(panel);
  }

  private update() {
    const config = vscode.workspace.getConfiguration('safeEnvironment');
    const enabled = config.get<boolean>('enabled', true);
    const disabledPatterns = config.get<string[]>('disabledPatterns', []);
    const additionalPatterns = config.get<string[]>('additionalPatterns', []);

    this.panel.webview.html = this.getHtml(enabled, disabledPatterns, additionalPatterns);
  }

  private getHtml(enabled: boolean, disabledPatterns: string[], additionalPatterns: string[]): string {
    const nonce = getNonce();

    // Group patterns by category
    const categories = new Map<string, typeof BUILTIN_PATTERNS>();
    for (const p of BUILTIN_PATTERNS) {
      if (!categories.has(p.category)) {
        categories.set(p.category, []);
      }
      categories.get(p.category)!.push(p);
    }

    let builtinHtml = '';
    for (const [category, patterns] of categories) {
      builtinHtml += `<div class="category"><h3>${category}</h3>`;
      for (const p of patterns) {
        const isEnabled = !disabledPatterns.includes(p.pattern);
        builtinHtml += `
          <label class="pattern-item">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} data-pattern="${this.escapeHtml(p.pattern)}" onchange="toggleBuiltin(this)">
            <span>${this.escapeHtml(p.label)}</span>
          </label>`;
      }
      builtinHtml += '</div>';
    }

    let customHtml = '';
    for (let i = 0; i < additionalPatterns.length; i++) {
      const pattern = additionalPatterns[i];
      customHtml += `
        <div class="custom-item">
          <code>${this.escapeHtml(pattern)}</code>
          <button class="remove-btn" data-index="${i}">Remove</button>
        </div>`;
    }

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Safe Environment Settings</title>
        <style>
          body {
            font-family: var(--vscode-font-family, system-ui, sans-serif);
            padding: 20px;
            color: var(--vscode-foreground, #ccc);
            background-color: var(--vscode-editor-background, #1e1e1e);
          }
          h1 { margin-bottom: 20px; }
          h2 { margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid var(--vscode-widget-border, #444); padding-bottom: 5px; }
          h3 { margin: 15px 0 10px 0; color: var(--vscode-descriptionForeground, #888); font-size: 0.9em; text-transform: uppercase; }
          .master-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 15px;
            background-color: var(--vscode-editor-inactiveSelectionBackground, #333);
            border-radius: 6px;
            margin-bottom: 20px;
          }
          .master-toggle input { width: 20px; height: 20px; }
          .master-toggle span { font-size: 1.1em; font-weight: bold; }
          .category { margin-bottom: 15px; }
          .pattern-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            cursor: pointer;
            border-radius: 4px;
          }
          .pattern-item:hover { background-color: var(--vscode-list-hoverBackground, #2a2d2e); }
          .pattern-item input { width: 16px; height: 16px; }
          .custom-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background-color: var(--vscode-editor-inactiveSelectionBackground, #333);
            border-radius: 4px;
            margin-bottom: 8px;
          }
          .custom-item code { font-family: var(--vscode-editor-font-family, monospace); }
          .custom-item button {
            background-color: var(--vscode-button-secondaryBackground, #555);
            color: var(--vscode-button-secondaryForeground, #fff);
            border: none;
            padding: 4px 12px;
            border-radius: 4px;
            cursor: pointer;
          }
          .custom-item button:hover { background-color: var(--vscode-button-secondaryHoverBackground, #666); }
          .add-pattern {
            display: flex;
            gap: 10px;
            margin-top: 15px;
          }
          .add-pattern input {
            flex: 1;
            padding: 8px;
            border: 1px solid var(--vscode-input-border, #444);
            background-color: var(--vscode-input-background, #333);
            color: var(--vscode-input-foreground, #ccc);
            border-radius: 4px;
          }
          .add-pattern button {
            background-color: var(--vscode-button-background, #007acc);
            color: var(--vscode-button-foreground, #fff);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
          }
          .add-pattern button:hover { background-color: var(--vscode-button-hoverBackground, #005a9e); }
          .empty-state { color: var(--vscode-descriptionForeground, #888); font-style: italic; }
        </style>
      </head>
      <body>
        <h1>Safe Environment Settings</h1>

        <label class="master-toggle">
          <input type="checkbox" ${enabled ? 'checked' : ''} onchange="toggleEnabled(this.checked)">
          <span>Extension Enabled</span>
        </label>

        <h2>Built-in Patterns</h2>
        ${builtinHtml}

        <h2>Custom Patterns</h2>
        ${customHtml || '<p class="empty-state">No custom patterns added</p>'}

        <div class="add-pattern">
          <input type="text" id="newPattern" placeholder="Enter regex pattern (e.g., secret\\.yaml$)">
          <button onclick="addCustom()">Add Pattern</button>
        </div>

        <script nonce="${nonce}">
          const vscode = acquireVsCodeApi();
          const customPatterns = ${JSON.stringify(additionalPatterns)};

          function toggleEnabled(value) {
            vscode.postMessage({ command: 'toggleEnabled', value });
          }

          function toggleBuiltin(checkbox) {
            vscode.postMessage({
              command: 'toggleBuiltinPattern',
              pattern: checkbox.dataset.pattern,
              enabled: checkbox.checked
            });
          }

          function addCustom() {
            const input = document.getElementById('newPattern');
            const pattern = input.value.trim();
            if (pattern) {
              vscode.postMessage({ command: 'addCustomPattern', pattern });
              input.value = '';
            }
          }

          document.getElementById('newPattern').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addCustom();
          });

          // Handle remove buttons
          document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              const index = parseInt(btn.dataset.index, 10);
              const pattern = customPatterns[index];
              if (pattern !== undefined) {
                vscode.postMessage({ command: 'removeCustomPattern', pattern });
              }
            });
          });
        </script>
      </body>
      </html>
    `;
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  private dispose() {
    SettingsWebviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) {
        d.dispose();
      }
    }
  }
}

/**
 * Get the relative path from the workspace root
 */
function getRelativePath(filePath: string): string {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    const workspaceRoot = workspaceFolder.uri.fsPath;
    if (filePath.startsWith(workspaceRoot)) {
      return filePath.substring(workspaceRoot.length + 1); // +1 to remove leading slash
    }
  }
  // Fallback to filename only if outside workspace
  return filePath.split(/[/\\]/).pop() || filePath;
}

/**
 * Show the warning panel for a sensitive file
 */
function showWarningPanel(filePath: string): void {
  const relativePath = getRelativePath(filePath);

  const panel = vscode.window.createWebviewPanel(
    'safeEnvironmentWarning',
    'Sensitive File Warning',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const nonce = getNonce();

  panel.webview.html = /* html */ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Safe Environment Warning</title>
      <style>
        body {
          font-family: var(--vscode-font-family, system-ui, sans-serif);
          background-color: var(--vscode-editor-background, #1e1e1e);
          color: var(--vscode-foreground, #ddd);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          text-align: center;
          padding: 2rem;
          margin: 0;
        }
        h1 { color: #ffcc00; font-size: 1.8rem; margin-bottom: 1rem; }
        p { max-width: 600px; line-height: 1.6; }
        .file-path {
          font-family: var(--vscode-editor-font-family, monospace);
          background-color: var(--vscode-editor-inactiveSelectionBackground, #333);
          padding: 8px 16px;
          border-radius: 4px;
          margin: 1rem 0;
          word-break: break-all;
        }
        .buttons { margin-top: 2rem; }
        button {
          margin: 0.5rem;
          padding: 0.8rem 1.5rem;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
        }
        #open {
          background-color: var(--vscode-button-background, #007acc);
          color: var(--vscode-button-foreground, white);
        }
        #open:hover { background-color: var(--vscode-button-hoverBackground, #005a9e); }
        #cancel {
          background-color: var(--vscode-button-secondaryBackground, #555);
          color: var(--vscode-button-secondaryForeground, white);
        }
        #cancel:hover { background-color: var(--vscode-button-secondaryHoverBackground, #666); }
      </style>
    </head>
    <body>
      <h1>⚠️ Sensitive file detected</h1>
      <div class="file-path">${relativePath}</div>
      <p>
        This file may contain API keys, credentials, or other secrets.<br>
        Opening it while streaming could expose sensitive data.
      </p>
      <div class="buttons">
        <button id="open">Open Anyway</button>
        <button id="cancel">Cancel</button>
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

  panel.webview.onDidReceiveMessage(async (msg) => {
    if (msg.command === 'openAnyway') {
      panel.dispose();
      const doc = await vscode.workspace.openTextDocument(filePath);
      await vscode.window.showTextDocument(doc);
    } else if (msg.command === 'cancel') {
      panel.dispose();
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('safeEnvironment.openSettings', () => {
      SettingsWebviewPanel.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('safeEnvironment.quickToggle', () => {
      showQuickToggle();
    })
  );

  // Intercept sensitive file openings
  const disposable = vscode.workspace.onDidOpenTextDocument(async (doc) => {
    if (isEnabled() && isSensitiveFile(doc.fileName) && doc.uri.scheme === 'file') {
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

        // Show the warning panel
        showWarningPanel(doc.fileName);
      } catch (error) {
        console.error('Failed to intercept sensitive file opening:', error);
      }
    }
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
