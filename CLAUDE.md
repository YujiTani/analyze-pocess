# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリでコードを扱う際のガイダンスを提供します。

## 日本語での回答

このプロジェクトでは**日本語**で回答してください。コメント、エラーメッセージ、説明は全て日本語で行うこと。

## コマンド

### 開発・実行コマンド
- `bun run build` - TypeScriptコードをビルド
- `bun run lint` - Biomeでコードをlint
- `bun run format` - Biomeでコードをフォーマット
- `bun run check` - Biomeでlintとフォーマットを実行

### 実行環境
- このプロジェクトは**Bun**ランタイムを使用
- Node.jsではなくBunを使ってコードを実行する

## アーキテクチャ

### プロジェクト概要
- Model Context Protocol (MCP) サーバーの実装
- プロセスログファイルの読み込み・解析機能を提供
- `@modelcontextprotocol/sdk`を使用してMCPサーバーを構築

### 主要コンポーネント
- `src/index.ts` - MCPサーバーのメインエントリーポイント
- `readProcessLog`関数 - ログファイル読み込み処理
- tools/list, tools/callハンドラー - MCP toolsの実装

### ビルド設定
- TypeScript ES2022, Node16モジュール解決
- 出力先: `./build/`
- バイナリとして`./build/index.js`を実行可能

### コードスタイル
- Biome使用（推奨ルール有効）
- タブインデント
- ダブルクォート
- インポート自動整理有効