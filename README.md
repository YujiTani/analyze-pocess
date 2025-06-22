# System Process Analyzer

システムプロセスのCPU監視ログファイルを分析するModel Context Protocol (MCP) サーバー実装です。

## 機能

- CPU監視ログファイル（JSON形式）の自動検索
- プロセスデータの詳細分析
- 高負荷プロセスの特定と改善提案
- Markdownフォーマットでの分析レポート生成

## 必要環境

- [Bun](https://bun.sh/) ランタイム
- TypeScript 5.8+

## インストール・セットアップ

1. 依存パッケージのインストール
```bash
bun install
```

2. プロジェクトのビルド
```bash
bun run build
```

## 開発コマンド

```bash
# ビルド
bun run build

# コードチェック（lint + format）
bun run check

# リンター実行
bun run lint

# フォーマッター実行
bun run format
```

## MCPツール一覧

### 1. findProcessLogFiles
システム内のCPU監視ログファイル（JSON形式）を検索します。

**パラメータ:**
- `searchPath` (省略可): 検索対象ディレクトリ（デフォルト: ホームディレクトリ）
- `namePattern` (省略可): ファイル名パターン（デフォルト: 'process', 'cpu', 'log'を含むファイル）

### 2. loadProcessLogFile
指定されたCPU監視ログファイルを読み込みます。

**パラメータ:**
- `filePath` (必須): CPU監視ログファイルのパス（.json形式）

### 3. analyzeProcessData
CPU監視データを分析し、詳細レポートを生成します。

**パラメータ:**
- `processLogData` (必須): CPU監視ログデータ
- `analysisOptions` (省略可): 分析オプション
  - `cpuWarningThreshold`: CPU使用率の警告閾値（デフォルト: 80%）
  - `cpuCriticalThreshold`: CPU使用率の危険閾値（デフォルト: 90%）
  - `includeRecommendations`: 改善提案を含むか（デフォルト: true）
  - `outputFormat`: 出力形式（デフォルト: "markdown"）

### 4. analyzeSystemProcessLogs
システム内のCPU監視ログファイルを自動検索し、最新のログを分析してレポートを生成します。

**パラメータ:**
- `searchPath` (省略可): 検索対象ディレクトリ
- `analysisOptions` (省略可): 分析オプション（analyzeProcessDataと同様）

## 使用例

### 基本的な使用フロー

1. **ログファイルの検索**
   ```
   findProcessLogFiles ツールを使用
   ```

2. **ログファイルの読み込み**
   ```
   loadProcessLogFile ツールで特定のファイルを読み込み
   ```

3. **データ分析**
   ```
   analyzeProcessData ツールで分析レポートを生成
   ```

### ワンステップ分析

```
analyzeSystemProcessLogs ツールを使用して、検索から分析まで一括実行
```

## レポート内容

生成される分析レポートには以下の情報が含まれます：

- **システム基本情報**: CPUコア数、稼働時間、負荷平均
- **監視設定**: CPU閾値、測定間隔、測定回数
- **異常検出結果**: 危険レベル・高負荷プロセスの特定
- **負荷分析**: システム負荷状況と統計情報
- **推奨対処法**: 緊急対応から長期対応まで段階的な改善提案
- **アラート設定推奨値**: 監視体制強化のための設定値

## プロジェクト構成

```
system-process-analyzer/
├── src/
│   └── index.ts          # MCPサーバーのメインコード
├── build/                # ビルド出力先
├── package.json          # プロジェクト設定
├── tsconfig.json         # TypeScript設定
├── biome.json           # Biome設定（lint/format）
└── CLAUDE.md            # Claude Code向けガイダンス
```

## 技術スタック

- **ランタイム**: Bun
- **言語**: TypeScript
- **フレームワーク**: Model Context Protocol SDK
- **開発ツール**: Biome（lint/format）

## ライセンス

ISC

## 貢献

バグ報告や機能改善の提案は、GitHubのIssueでお願いします。