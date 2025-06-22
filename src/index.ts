import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { homedir } from "node:os";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
	{
		name: "system-process-analyzer",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	},
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: "findProcessLogFiles",
				description:
					"システム内のCPU監視ログファイル（JSON形式）を検索する",
				inputSchema: {
					type: "object",
					properties: {
						searchPath: {
							type: "string",
							description: "検索対象ディレクトリ（省略時はホームディレクトリを検索）",
						},
						namePattern: {
							type: "string",
							description: "ファイル名パターン（省略時は 'process', 'cpu', 'log' を含むファイルを検索）",
						},
					},
				},
			},
			{
				name: "loadProcessLogFile",
				description:
					"CPU監視ログファイル（JSON形式）を読み込み、データを取得する",
				inputSchema: {
					type: "object",
					properties: {
						filePath: {
							type: "string",
							description: "CPU監視ログファイルのパス（.json形式）",
						},
					},
					required: ["filePath"],
				},
			},
			{
				name: "analyzeProcessData",
				description:
					"CPU監視データを分析し、高負荷プロセスの特定と改善提案を含む詳細レポートを生成する",
				inputSchema: {
					type: "object",
					properties: {
						processLogData: {
							type: "object",
							description: "CPU監視ログデータ",
							properties: {
								execution_timestamp: { type: "string" },
								system_info: {
									type: "object",
									properties: {
										cpu_cores: { type: "number" },
										load_average: { type: "string" },
										uptime: { type: "string" },
									},
								},
								monitoring_config: {
									type: "object",
									properties: {
										cpu_threshold_percent: { type: "number" },
										max_processes_per_measurement: { type: "number" },
										measurement_interval_seconds: { type: "number" },
										total_measurements: { type: "number" },
									},
								},
								measurements: {
									type: "array",
									items: {
										type: "object",
										properties: {
											measurement: { type: "number" },
											timestamp: { type: "string" },
											processes: {
												type: "array",
												items: {
													type: "object",
													properties: {
														pid: { type: "number" },
														cpu: { type: "number" },
														mem: { type: "number" },
														time: { type: "string" },
														command: { type: "string" },
													},
												},
											},
										},
									},
								},
							},
						},
						analysisOptions: {
							type: "object",
							description: "分析オプション",
							properties: {
								cpuWarningThreshold: {
									type: "number",
									description: "CPU使用率の警告閾値（％）",
									default: 80,
								},
								cpuCriticalThreshold: {
									type: "number",
									description: "CPU使用率の危険閾値（％）",
									default: 90,
								},
								includeRecommendations: {
									type: "boolean",
									description: "改善提案を含むかどうか",
									default: true,
								},
								outputFormat: {
									type: "string",
									description: "出力形式",
									enum: ["markdown", "json", "text"],
									default: "markdown",
								},
							},
						},
					},
					required: ["processLogData"],
				},
			},
			{
				name: "analyzeSystemProcessLogs",
				description:
					"システム内のCPU監視ログファイルを自動検索し、最新のログを分析してレポートを生成する",
				inputSchema: {
					type: "object",
					properties: {
						searchPath: {
							type: "string",
							description: "検索対象ディレクトリ（省略時はホームディレクトリを検索）",
						},
						analysisOptions: {
							type: "object",
							description: "分析オプション",
							properties: {
								cpuWarningThreshold: {
									type: "number",
									description: "CPU使用率の警告閾値（％）",
									default: 80,
								},
								cpuCriticalThreshold: {
									type: "number",
									description: "CPU使用率の危険閾値（％）",
									default: 90,
								},
								includeRecommendations: {
									type: "boolean",
									description: "改善提案を含むかどうか",
									default: true,
								},
								outputFormat: {
									type: "string",
									description: "出力形式",
									enum: ["markdown", "json", "text"],
									default: "markdown",
								},
							},
						},
					},
				},
			},
		],
	};
});

// 分析処理関数
export function analyzeProcesses(processLogData: any, options: any) {
	const measurements = processLogData.measurements;
	const processes = new Map<number, any>();

	// プロセス毎の統計情報を収集
	measurements.forEach((measurement: any) => {
		measurement.processes.forEach((proc: any) => {
			const pid = proc.pid;
			if (!processes.has(pid)) {
				processes.set(pid, {
					pid,
					command: proc.command,
					maxCpu: proc.cpu,
					minCpu: proc.cpu,
					avgCpu: proc.cpu,
					maxMem: proc.mem,
					cpuValues: [proc.cpu],
					measurements: 1,
					timestamps: [measurement.timestamp],
				});
			} else {
				const existing = processes.get(pid);
				if (existing) {
					existing.maxCpu = Math.max(existing.maxCpu, proc.cpu);
					existing.minCpu = Math.min(existing.minCpu, proc.cpu);
					existing.cpuValues.push(proc.cpu);
					existing.avgCpu =
						existing.cpuValues.reduce((a: number, b: number) => a + b, 0) /
						existing.cpuValues.length;
					existing.maxMem = Math.max(existing.maxMem, proc.mem);
					existing.measurements++;
					existing.timestamps.push(measurement.timestamp);
				}
			}
		});
	});

	// 高負荷プロセスの特定
	const highLoadProcesses = Array.from(processes.values())
		.filter((proc) => proc.maxCpu >= options.cpuWarningThreshold)
		.sort((a, b) => b.maxCpu - a.maxCpu);

	// 異常検出
	const criticalProcesses = highLoadProcesses.filter(
		(proc) => proc.maxCpu >= options.cpuCriticalThreshold,
	);

	// 負荷平均の計算
	const loadAverage = processLogData.system_info?.load_average
		?.split(" ")
		.map((val: string) => parseFloat(val)) || [0, 0, 0];
	const cpuCores = processLogData.system_info?.cpu_cores || 1;
	const loadPerCore = loadAverage[0] / cpuCores;

	return {
		totalProcesses: processes.size,
		highLoadProcesses,
		criticalProcesses,
		loadAverage,
		cpuCores,
		loadPerCore,
		measurementCount: measurements.length,
		timeRange: {
			start: measurements[0]?.timestamp,
			end: measurements[measurements.length - 1]?.timestamp,
		},
	};
}

// Markdownレポート生成関数
export function generateMarkdownReport(
	processLogData: any,
	analysis: any,
	options: any,
): string {
	const timestamp = new Date().toLocaleString("ja-JP", {
		timeZone: "Asia/Tokyo",
	});
	const execution_time = processLogData.execution_timestamp;

	let report = `# CPU監視データ分析レポート

## 基本情報
- **分析対象**: CPU監視ログデータ
- **測定時刻**: ${execution_time}
- **測定間隔**: ${processLogData.monitoring_config?.measurement_interval_seconds || "N/A"}秒間隔、${analysis.measurementCount}回測定
- **分析実行時刻**: ${timestamp}

## システム状況

### 基本スペック
- **CPUコア数**: ${analysis.cpuCores}コア
- **システム稼働時間**: ${processLogData.system_info?.uptime || "N/A"}
- **負荷平均**: ${analysis.loadAverage.join(" ")}

### 監視設定
- **CPU閾値**: ${processLogData.monitoring_config?.cpu_threshold_percent || "N/A"}%
- **最大プロセス数/測定**: ${processLogData.monitoring_config?.max_processes_per_measurement || "N/A"}
- **測定間隔**: ${processLogData.monitoring_config?.measurement_interval_seconds || "N/A"}秒
- **総測定回数**: ${analysis.measurementCount}回

## 異常検出結果
`;

	if (analysis.criticalProcesses.length > 0) {
		report += `
### 🚨 危険レベルの高負荷プロセス (${options.cpuCriticalThreshold}%以上)

`;
		analysis.criticalProcesses.forEach((proc: any, index: number) => {
			report += `#### ${index + 1}. PID ${proc.pid}
- **最大CPU使用率**: ${proc.maxCpu.toFixed(1)}%
- **平均CPU使用率**: ${proc.avgCpu.toFixed(1)}%
- **測定回数**: ${proc.measurements}回
- **コマンド**: \`${proc.command}\`

`;
		});
	}

	if (analysis.highLoadProcesses.length > 0) {
		report += `
### ⚠️ 高負荷プロセス (${options.cpuWarningThreshold}%以上)

`;
		analysis.highLoadProcesses
			.slice(0, 10)
			.forEach((proc: any, index: number) => {
				report += `${index + 1}. **PID ${proc.pid}**: 最大CPU ${proc.maxCpu.toFixed(1)}% (平均 ${proc.avgCpu.toFixed(1)}%) - \`${proc.command.length > 60 ? `${proc.command.substring(0, 60)}...` : proc.command}\`
`;
			});
	}

	// 負荷分析
	report += `
### 📊 負荷分析

#### システム負荷状況
- **負荷平均**: ${analysis.loadAverage[0].toFixed(2)} (1分), ${analysis.loadAverage[1].toFixed(2)} (5分), ${analysis.loadAverage[2].toFixed(2)} (15分)
- **コア当たり負荷**: ${analysis.loadPerCore.toFixed(2)}
- **負荷レベル**: ${analysis.loadPerCore > 2 ? "🔴 高負荷" : analysis.loadPerCore > 1 ? "🟡 中負荷" : "🟢 正常"}

#### 高負荷プロセス統計
- **検出されたプロセス数**: ${analysis.highLoadProcesses.length}個
- **危険レベルプロセス**: ${analysis.criticalProcesses.length}個
- **総監視プロセス数**: ${analysis.totalProcesses}個
`;

	// 改善提案
	if (options.includeRecommendations) {
		report += `
## 推奨対処法

### 🔥 緊急対応（即座に実行）
`;

		if (analysis.criticalProcesses.length > 0) {
			report += `
1. **危険レベルプロセスの確認**
   - PID ${analysis.criticalProcesses[0].pid} (CPU: ${analysis.criticalProcesses[0].maxCpu.toFixed(1)}%) の調査
   - プロセスの必要性確認・終了検討

`;
		}

		if (analysis.loadPerCore > 2) {
			report += `2. **システム負荷軽減**
   - 不要なプロセスの終了
   - システム再起動の検討

`;
		}

		report += `### 🛠️ 中期対応（1-2時間以内）

1. **プロセス監視の継続**
\`\`\`bash
# リアルタイム監視
top -o %CPU
# またはhtop
htop
\`\`\`

2. **システムリソース確認**
\`\`\`bash
# メモリ使用量確認
free -h
# ディスク使用量確認  
df -h
\`\`\`

### 📋 長期対応（1日以内）

1. **システム最適化**
   - 定期的な監視スクリプトの設定
   - アラート機能の実装
   - ログローテーションの設定

2. **監視体制の強化**
   - CPU使用率${options.cpuCriticalThreshold}%超過時の自動アラート
   - 負荷平均が${analysis.cpuCores * 2}を超過時の通知

## アラート設定推奨値

- **CPU使用率**: ${options.cpuWarningThreshold}%超過で Warning、${options.cpuCriticalThreshold}%超過で Critical
- **負荷平均**: ${(analysis.cpuCores * 1.5).toFixed(1)}超過で Warning、${(analysis.cpuCores * 2).toFixed(1)}超過で Critical
- **プロセス数**: ${analysis.totalProcesses * 1.5}超過で Warning

## 次回監視時の注意点

1. 高負荷プロセスの継続監視
2. 負荷平均の推移確認
3. 対処法実施後の効果測定
4. 新たな異常プロセスの早期発見
`;
	}

	report += `
---

**レポート生成者**: Process Analyze MCP Server  
**レポート形式**: Markdown  
**次回推奨監視**: ${new Date(Date.now() + 30 * 60 * 1000).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;

	return report;
}

// ファイル検索関数
async function findProcessLogFiles(searchPath?: string, namePattern?: string): Promise<string[]> {
	const basePath = searchPath || homedir();
	const patterns = namePattern?.toLowerCase().split(',').map(p => p.trim()) || ['process', 'cpu', 'log', 'monitor'];
	const foundFiles: string[] = [];

	async function searchDirectory(dirPath: string, maxDepth = 3, currentDepth = 0): Promise<void> {
		if (currentDepth >= maxDepth) return;

		try {
			const entries = await readdir(dirPath, { withFileTypes: true });
			
			for (const entry of entries) {
				const fullPath = join(dirPath, entry.name);
				
				if (entry.isFile() && extname(entry.name).toLowerCase() === '.json') {
					const fileName = entry.name.toLowerCase();
					const hasMatchingPattern = patterns.some(pattern => 
						fileName.includes(pattern)
					);
					
					if (hasMatchingPattern) {
						foundFiles.push(fullPath);
					}
				} else if (entry.isDirectory() && !entry.name.startsWith('.') && 
						   !['node_modules', 'Library', 'Applications'].includes(entry.name)) {
					await searchDirectory(fullPath, maxDepth, currentDepth + 1);
				}
			}
		} catch (error) {
			// ディレクトリアクセスエラーは無視（権限不足など）
		}
	}

	await searchDirectory(basePath);
	return foundFiles;
}

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	try {
		if (name === "findProcessLogFiles") {
			const { searchPath, namePattern } = args as { 
				searchPath?: string; 
				namePattern?: string; 
			};

			const foundFiles = await findProcessLogFiles(searchPath, namePattern);

			if (foundFiles.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `🔍 CPU監視ログファイルが見つかりませんでした\n\n` +
								`検索パス: ${searchPath || homedir()}\n` +
								`検索パターン: ${namePattern || 'process, cpu, log, monitor'}\n\n` +
								`ファイルが存在する場合は、具体的なパスを指定してloadProcessLogFileツールを使用してください。`,
						},
					],
				};
			}

			return {
				content: [
					{
						type: "text",
						text: `🔍 CPU監視ログファイルを${foundFiles.length}個発見しました\n\n` +
							foundFiles.map((file, index) => `${index + 1}. ${file}`).join('\n') + 
							`\n\n特定のファイルを読み込むには、loadProcessLogFileツールを使用してください。`,
					},
				],
			};
		}

		if (name === "loadProcessLogFile") {
			const { filePath } = args as { filePath: string };

			// ファイル存在チェック
			if (!existsSync(filePath)) {
				throw new Error(`ファイルが見つかりません: ${filePath}`);
			}

			// ファイル読み込み
			const fileContent = await readFile(filePath, "utf-8");

			// JSON解析
			let processLogData: any;
			try {
				processLogData = JSON.parse(fileContent);
			} catch (parseError) {
				throw new Error(
					`JSONの解析に失敗しました: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
				);
			}

			// データ構造の基本検証
			if (
				!processLogData.measurements ||
				!Array.isArray(processLogData.measurements)
			) {
				throw new Error(
					"無効なデータ形式です。measurements配列が見つかりません。",
				);
			}

			return {
				content: [
					{
						type: "text",
						text:
							`✅ プロセスログファイルを正常に読み込みました\n\n` +
							`📁 ファイル: ${filePath}\n` +
							`📊 測定回数: ${processLogData.measurements.length}回\n` +
							`⏰ 実行時刻: ${processLogData.execution_timestamp}\n` +
							`💻 システム情報: ${processLogData.system_info?.cpu_cores}コア, 負荷平均 ${processLogData.system_info?.load_average}\n\n` +
							`データを分析するには、analyzeProcessDataツールを使用してください。`,
					},
				],
			};
		}

		if (name === "analyzeProcessData") {
			const { processLogData, analysisOptions = {} } = args as {
				processLogData: any;
				analysisOptions?: {
					cpuWarningThreshold?: number;
					cpuCriticalThreshold?: number;
					includeRecommendations?: boolean;
					outputFormat?: string;
				};
			};

			// デフォルト値の設定
			const options = {
				cpuWarningThreshold: analysisOptions.cpuWarningThreshold || 80,
				cpuCriticalThreshold: analysisOptions.cpuCriticalThreshold || 90,
				includeRecommendations:
					analysisOptions.includeRecommendations !== false,
				outputFormat: analysisOptions.outputFormat || "markdown",
			};

			// データ検証
			if (
				!processLogData.measurements ||
				!Array.isArray(processLogData.measurements)
			) {
				throw new Error(
					"processLogData.measurementsが存在しないか、配列ではありません",
				);
			}

			// 分析処理
			const analysis = analyzeProcesses(processLogData, options);

			// レポート生成
			const report = generateMarkdownReport(processLogData, analysis, options);

			return {
				content: [
					{
						type: "text",
						text: report,
					},
				],
			};
		}

		if (name === "analyzeSystemProcessLogs") {
			const { searchPath, analysisOptions = {} } = args as {
				searchPath?: string;
				analysisOptions?: {
					cpuWarningThreshold?: number;
					cpuCriticalThreshold?: number;
					includeRecommendations?: boolean;
					outputFormat?: string;
				};
			};

			// ファイル検索
			const foundFiles = await findProcessLogFiles(searchPath);

			if (foundFiles.length === 0) {
				return {
					content: [
						{
							type: "text",
							text: `🔍 CPU監視ログファイルが見つかりませんでした\n\n` +
								`検索パス: ${searchPath || homedir()}\n\n` +
								`ファイルが存在する場合は、具体的なパスを指定してloadProcessLogFileツールを使用してください。`,
						},
					],
				};
			}

			// 最新のファイルを選択（作成日時順）
			const latestFile = foundFiles[0]; // 簡単のため最初のファイルを使用

			// ファイル読み込み
			const fileContent = await readFile(latestFile, "utf-8");
			let processLogData: any;
			try {
				processLogData = JSON.parse(fileContent);
			} catch (parseError) {
				throw new Error(
					`JSONの解析に失敗しました: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
				);
			}

			// データ構造の基本検証
			if (
				!processLogData.measurements ||
				!Array.isArray(processLogData.measurements)
			) {
				throw new Error(
					"無効なデータ形式です。measurements配列が見つかりません。",
				);
			}

			// デフォルト値の設定
			const options = {
				cpuWarningThreshold: analysisOptions.cpuWarningThreshold || 80,
				cpuCriticalThreshold: analysisOptions.cpuCriticalThreshold || 90,
				includeRecommendations:
					analysisOptions.includeRecommendations !== false,
				outputFormat: analysisOptions.outputFormat || "markdown",
			};

			// 分析処理
			const analysis = analyzeProcesses(processLogData, options);

			// レポート生成
			const report = generateMarkdownReport(processLogData, analysis, options);

			return {
				content: [
					{
						type: "text",
						text: `📁 分析対象ファイル: ${latestFile}\n\n${report}`,
					},
				],
			};
		}

		throw new Error(`不明なツール: ${name}`);
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: `❌ エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			isError: true,
		};
	}
});

// サーバー起動
async function startServer() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.log("🎯 Process Log MCP Server が起動しました");
}

startServer().catch(console.error);
