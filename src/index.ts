import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ログファイル読み込み関数
async function readProcessLog(filepath: string) {
	try {
		const file = Bun.file(filepath);
		const content = await file.text();

		return {
			content: [
				{
					type: "text",
					text: `ログファイルを読み込みました: ${filepath}\n\n${content}`,
				},
			],
		};
	} catch (error: any) {
		return {
			content: [
				{
					type: "text",
					text: `エラー: ${error.message}`,
				},
			],
		};
	}
}

// サーバー作成
const server = new Server(
	{ name: "process-log-mcp", version: "1.0.0" },
	{ capabilities: { tools: {} } },
);

// ツール一覧
server.setRequestHandler("tools/list", async () => {
	return {
		tools: [
			{
				name: "read_process_log",
				description: "プロセスログファイルを読み込みます",
				inputSchema: {
					type: "object",
					properties: {
						filepath: {
							type: "string",
							description: "ログファイルのパス",
						},
					},
					required: ["filepath"],
				},
			},
		],
	};
});

// ツール実行
server.setRequestHandler("tools/call", async (request) => {
	if (request.params.name === "read_process_log") {
		return await readProcessLog(request.params.arguments.filepath);
	}
	throw new Error(`Unknown tool: ${request.params.name}`);
});

// サーバー起動
async function startServer() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.log("🎯 Process Log MCP Server が起動しました");
}

startServer().catch(console.error);
