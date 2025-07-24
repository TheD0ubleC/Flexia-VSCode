import * as vscode from 'vscode';

export interface SymbolInfo {
  name: string;
  kind: vscode.SymbolKind;
  location: vscode.Location;
}

export function analyzeDocument(doc: vscode.TextDocument): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];

  const functionRegex = /\bFunction\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  const classRegex = /\bClass\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  const varRegex = /\b(?:int|float|double|string|bool|char|var)\s+([a-z_][a-zA-Z0-9_]*)\b/g;

  for (let line = 0; line < doc.lineCount; line++) {
    const text = doc.lineAt(line).text;

    let match: RegExpExecArray | null;
    while ((match = functionRegex.exec(text))) {
      symbols.push({
        name: match[1],
        kind: vscode.SymbolKind.Function,
        location: new vscode.Location(doc.uri, new vscode.Position(line, match.index))
      });
    }

    while ((match = classRegex.exec(text))) {
      symbols.push({
        name: match[1],
        kind: vscode.SymbolKind.Class,
        location: new vscode.Location(doc.uri, new vscode.Position(line, match.index))
      });
    }

    while ((match = varRegex.exec(text))) {
      symbols.push({
        name: match[1],
        kind: vscode.SymbolKind.Variable,
        location: new vscode.Location(doc.uri, new vscode.Position(line, match.index))
      });
    }
  }

  return symbols;
}
