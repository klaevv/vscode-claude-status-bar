import * as path from "node:path";
import * as vscode from "vscode";
import { coalescedTask } from "./coalescedTask";
import { readLatestSnapshot, resolveClaudeHome } from "./reader";
import { renderStatus } from "./statusBar";
import { Snapshot } from "./types";

let item: vscode.StatusBarItem;
let timer: NodeJS.Timeout | undefined;
let latest: Snapshot | undefined;

function config() {
  const value = vscode.workspace.getConfiguration("claudeStatus");
  return {
    home: resolveClaudeHome(value.get("claudeHome", "~/.claude")),
    interval: Math.max(5, value.get("refreshIntervalSeconds", 60)),
    lookback: Math.max(1, value.get("lookbackDays", 7)),
    contextWindow: Math.max(1, value.get("contextWindowTokens", 200_000))
  };
}

async function showUsage(): Promise<void> {
  if (!latest) {
    void vscode.window.showInformationMessage("No recent Claude Code usage was found.");
    return;
  }
  const settings = config();
  const rendered = renderStatus(latest, settings.contextWindow);
  await vscode.window.showQuickPick([
    { label: `$(dashboard) ${latest.contextTokens.toLocaleString()} tokens`, description: `${rendered.percent.toFixed(1)}% of context window` },
    { label: "$(file) Open transcript", description: path.basename(latest.sourceFile), file: latest.sourceFile }
  ], { title: "Claude Code usage (local transcript)", placeHolder: `Captured ${latest.capturedAt.toLocaleString()}` }).then(async selected => {
    if (selected && "file" in selected && selected.file) await vscode.window.showTextDocument(vscode.Uri.file(selected.file));
  });
}

export function activate(context: vscode.ExtensionContext): void {
  item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = "claudeStatus.showUsage";
  item.name = "Claude context usage";
  context.subscriptions.push(item);

  const refresh = coalescedTask(async () => {
    const settings = config();
    latest = await readLatestSnapshot(settings.home, settings.lookback);
    if (!latest) {
      item.text = "$(sparkle) Claude —";
      item.tooltip = "No recent Claude Code transcript usage found.";
      item.backgroundColor = undefined;
    } else {
      const rendered = renderStatus(latest, settings.contextWindow);
      item.text = rendered.text;
      item.tooltip = new vscode.MarkdownString(rendered.tooltip, true);
      item.backgroundColor = rendered.severity === "error"
        ? new vscode.ThemeColor("statusBarItem.errorBackground")
        : rendered.severity === "warning" ? new vscode.ThemeColor("statusBarItem.warningBackground") : undefined;
    }
    item.show();
  });
  const restartTimer = () => {
    if (timer) clearInterval(timer);
    timer = setInterval(() => void refresh(), config().interval * 1000);
  };
  context.subscriptions.push(
    vscode.commands.registerCommand("claudeStatus.refresh", refresh),
    vscode.commands.registerCommand("claudeStatus.showUsage", showUsage),
    vscode.commands.registerCommand("claudeStatus.openProjectsFolder", () => vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(path.join(config().home, "projects")))),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration("claudeStatus")) { restartTimer(); void refresh(); }
    }),
    { dispose: () => { if (timer) clearInterval(timer); } }
  );
  restartTimer();
  void refresh();
}

export function deactivate(): void {}
