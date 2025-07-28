import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { analyzeDocument, SymbolInfo } from './analyzer';

let symbolTable: Map<string, SymbolInfo[]> = new Map();
let stdlibItems: vscode.CompletionItem[] = [];

/* ───────────────────────── 入口 ───────────────────────── */
export function activate(context: vscode.ExtensionContext) {

    loadStdLib(path.join(context.extensionPath, 'data', 'StdLib.json'));

    /* ─── 补全 ─── */
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            'flexia',
            {
                provideCompletionItems(doc, position) {
                    /* ① 当前光标所在的“可补全单词”(含点) 的范围+文本 */
                    const range = doc.getWordRangeAtPosition(position, /[A-Za-z0-9_\.]+/);
                    const prefix = range ? doc.getText(range) : '';

                    const lineText = doc.lineAt(position.line).text.slice(0, position.character);
                    const inString = (lineText.split('"').length % 2 === 0 ? false : true) ||
                                      (lineText.split("'").length % 2 === 0 ? false : true);
                    if (inString) return [];

                    /* ② 本文件符号 ➜ CompletionItem */
                    const locals = analyzeDocument(doc).map(sym => {
                        const it = new vscode.CompletionItem(sym.name, toCompletionKind(sym.kind));
                        it.detail = '[本地] ' + vscode.SymbolKind[sym.kind];
                        /* 通过 textEdit 替换整个 range，而不是简单 insertText */
                        if (range) it.textEdit = vscode.TextEdit.replace(range, sym.name);
                        return it;
                    });

                    /* ③ 标准库 ➜ CompletionItem（同样用 textEdit） */
                    const stds = stdlibItems.map(tpl => {
                        const it = new vscode.CompletionItem(tpl.label!, tpl.kind!);
                        it.detail = tpl.detail;
                        it.documentation = tpl.documentation;
                        if (range) it.textEdit = vscode.TextEdit.replace(range, String(tpl.label));
                        return it;
                    });

                    return [...locals, ...stds];
                }
            },
            '.', '(', '<', "'", '"', ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'   // 触发字符
        )
    );

    /* ─── 跳转到定义 ─── */
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider('flexia', {
            provideDefinition(doc, pos) {
                const word = doc.getText(doc.getWordRangeAtPosition(pos));
                return symbolTable.get(word)?.map(s => s.location);
            }
        })
    );

    /* ─── 查找引用 ─── */
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider('flexia', {
            provideReferences(doc, pos) {
                const word = doc.getText(doc.getWordRangeAtPosition(pos));
                const refs: vscode.Location[] = [];
                for (let i = 0; i < doc.lineCount; i++) {
                    const text = doc.lineAt(i).text;
                    let idx = text.indexOf(word);
                    while (idx !== -1) {
                        refs.push(new vscode.Location(doc.uri, new vscode.Position(i, idx)));
                        idx = text.indexOf(word, idx + 1);
                    }
                }
                return refs;
            }
        })
    );

    /* ─── 动态更新符号表 ─── */
    vscode.workspace.onDidOpenTextDocument(updateSymbols);
    vscode.workspace.onDidChangeTextDocument(e => updateSymbols(e.document));
    vscode.workspace.textDocuments.forEach(updateSymbols);
}

export function deactivate() {/* nothing */}

/* ───────────────────────── 工具函数 ───────────────────────── */
function toCompletionKind(k: vscode.SymbolKind): vscode.CompletionItemKind {
    switch (k) {
        case vscode.SymbolKind.Function: return vscode.CompletionItemKind.Function;
        case vscode.SymbolKind.Class:    return vscode.CompletionItemKind.Class;
        case vscode.SymbolKind.Variable: return vscode.CompletionItemKind.Variable;
        default:                         return vscode.CompletionItemKind.Text;
    }
}

function updateSymbols(doc: vscode.TextDocument) {
    if (doc.languageId !== 'flexia') return;
    for (const s of analyzeDocument(doc)) {
        if (!symbolTable.has(s.name)) symbolTable.set(s.name, []);
        symbolTable.get(s.name)!.push(s);
    }
}

function loadStdLib(jsonPath: string) {
    if (!fs.existsSync(jsonPath)) return;
    const std = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    stdlibItems = std.map((fn: any) => {
        const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
        item.detail = `(${fn.parameters.join(', ')}) • ${fn.source}`;
        item.documentation = new vscode.MarkdownString(`**${fn.name}**(${fn.parameters.join(', ')})`);
        return item;
    });
}
