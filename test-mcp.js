#!/usr/bin/env node

// MCPサーバーの簡易テスト用スクリプト
import { readFile } from 'node:fs/promises';

async function testAnalysis() {
    console.log('🧪 プロセス分析テストを開始...');
    
    // サンプルファイルを読み込み
    const logFile = '/Users/yuzunosk/bin/cpu-monitor-dir/logs/cpu_monitor_log_20250622_174617.json';
    console.log(`📁 ログファイル: ${logFile}`);
    
    try {
        const fileContent = await readFile(logFile, 'utf-8');
        const processLogData = JSON.parse(fileContent);
        
        console.log('✅ ファイル読み込み成功');
        console.log(`📊 測定回数: ${processLogData.measurements.length}回`);
        console.log(`⏰ 実行時刻: ${processLogData.execution_timestamp}`);
        console.log(`💻 システム情報: ${processLogData.system_info.cpu_cores}コア, 負荷平均 ${processLogData.system_info.load_average}`);
        
        // 分析処理をインポートして実行
        const { analyzeProcesses, generateMarkdownReport } = await import('./build/index.js');
        
        const options = {
            cpuWarningThreshold: 20,  // テスト用に低い値に設定
            cpuCriticalThreshold: 40,
            includeRecommendations: true,
            outputFormat: "markdown"
        };
        
        console.log('\n🔍 分析処理を実行中...');
        const analysis = analyzeProcesses(processLogData, options);
        
        console.log('\n📋 レポート生成中...');
        const report = generateMarkdownReport(processLogData, analysis, options);
        
        console.log('\n' + '='.repeat(50));
        console.log('📄 生成されたレポート:');
        console.log('='.repeat(50));
        console.log(report);
        
    } catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
    }
}

testAnalysis();