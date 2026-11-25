#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { loadStressConfig } from './config/env';
import { getLoadProfile } from './config/presets';
import type { BrowserDriverType, ProfileName, SuiteName } from './config/types';
import {
  runCapacityBenchmark,
  saveCapacityReportJson,
} from './core/capacity';
import {
  PreFlightError,
  prepareRuntimeContext,
  validatePreFlightContext,
} from './core/context';
import { writeStressReports } from './reporters';
import {
  printFinalSummary,
  printLiveHttpProgress,
  printPreFlightBanner,
  printScenarioHeader,
  printScenarioResult,
} from './reporters/console';
import { buildExecutionPlan, executeStressSuite } from './scenarios';

const ENV_TARGETS: Record<'local' | 'staging', { web: string; admin: string; server: string }> = {
  local: {
    web: 'http://127.0.0.1:5173',
    admin: 'http://127.0.0.1:5174',
    server: 'http://127.0.0.1:9000',
  },
  staging: {
    web: 'http://127.0.0.1:18080',
    admin: 'http://127.0.0.1:18081',
    server: 'http://127.0.0.1:18080',
  },
};

const HELP_TEXT = `
AeroApex 全栈压力测试工具 (drone-stress)

用法:
  npm run stress -- [选项]

选项:
  -e, --env <local|staging>    目标环境预设: local (5173/5174/9000) | staging (18080/18081/18080)
  -p, --profile <name>         压测预设档位: smoke | l1-baseline | l2-growth | l3-burst | spike
  -s, --suite <name>           压测套件范围: all | frontend | backend | assets | browser | sdk | api | mixed
  -c, --concurrency <num>      覆盖默认 HTTP 并发数 (VUs)
  -d, --duration <sec>         覆盖单场景持续秒数
      --capacity               阶梯探顶模式：逐级递增并发采集 RPS、延迟拐点、CPU/内存负载并推算承载用户数
      --capacity-steps <list>  自定义阶梯并发列表（逗号分隔，如 10,25,50,100,200,350）
      --check-only             仅执行压测前环境健康与就绪度检测（不发起压测流量）
      --allow-partial          允许在部分服务离线时仅压测在线目标（默认关闭：任一依赖离线立即阻断）
      --web-url <url>          自定义前台官网地址
      --admin-url <url>        自定义管理后台地址
      --server-url <url>       自定义后端服务地址
      --app-key <key>          监控上报项目 appKey
      --browser-driver <mode>  浏览器驱动: auto | playwright | cdp
      --simulate-ips           注入随机 X-Forwarded-For 模拟海量独立 IP
      --report-dir <dir>       报告输出目录 (默认 reports/)
      --strict                 任一场景 SLA 未达标时返回退出码 1 (用于 CI 门禁)
  -h, --help                   显示帮助信息
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      env: { type: 'string', short: 'e' },
      profile: { type: 'string', short: 'p' },
      suite: { type: 'string', short: 's' },
      concurrency: { type: 'string', short: 'c' },
      duration: { type: 'string', short: 'd' },
      capacity: { type: 'boolean' },
      'capacity-steps': { type: 'string' },
      'check-only': { type: 'boolean' },
      'allow-partial': { type: 'boolean' },
      'web-url': { type: 'string' },
      'admin-url': { type: 'string' },
      'server-url': { type: 'string' },
      'app-key': { type: 'string' },
      'browser-driver': { type: 'string' },
      'simulate-ips': { type: 'boolean' },
      'report-dir': { type: 'string' },
      strict: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });

  if (values.help) {
    console.log(HELP_TEXT.trim());
    return;
  }

  const envOverrides: NodeJS.ProcessEnv = { ...process.env };
  if (values.env) {
    if (values.env !== 'local' && values.env !== 'staging') {
      throw new Error(`无效的 --env="${values.env}"，仅支持 local 或 staging`);
    }
    const preset = ENV_TARGETS[values.env];
    envOverrides.STRESS_WEB_URL = preset.web;
    envOverrides.STRESS_ADMIN_URL = preset.admin;
    envOverrides.STRESS_SERVER_URL = preset.server;
  }
  if (values.profile) envOverrides.STRESS_PROFILE = values.profile as ProfileName;
  if (values.suite) envOverrides.STRESS_SUITE = values.suite as SuiteName;
  if (values['web-url']) envOverrides.STRESS_WEB_URL = values['web-url'];
  if (values['admin-url']) envOverrides.STRESS_ADMIN_URL = values['admin-url'];
  if (values['server-url']) envOverrides.STRESS_SERVER_URL = values['server-url'];
  if (values['app-key']) envOverrides.STRESS_APP_KEY = values['app-key'];
  if (values['browser-driver']) {
    envOverrides.STRESS_BROWSER_DRIVER = values['browser-driver'] as BrowserDriverType;
  }
  if (values['simulate-ips']) envOverrides.STRESS_SIMULATE_IPS = 'true';
  if (values['allow-partial']) envOverrides.STRESS_ALLOW_PARTIAL = 'true';
  if (values['report-dir']) envOverrides.STRESS_REPORT_DIR = values['report-dir'];

  const config = loadStressConfig(process.cwd(), envOverrides);
  const concurrency = values.concurrency ? Number(values.concurrency) : undefined;
  const durationSec = values.duration ? Number(values.duration) : undefined;
  if (concurrency !== undefined && (!Number.isFinite(concurrency) || concurrency < 1)) {
    throw new Error('--concurrency 必须为大于等于 1 的整数');
  }
  if (durationSec !== undefined && (!Number.isFinite(durationSec) || durationSec < 1)) {
    throw new Error('--duration 必须为大于等于 1 的秒数');
  }

  const profile = getLoadProfile(config.profile, { concurrency, durationSec });

  // 独立预检模式 (--check-only)
  if (values['check-only']) {
    const ctx = await prepareRuntimeContext(config);
    const issues = validatePreFlightContext(ctx, config.suite);
    const plan = buildExecutionPlan(ctx, profile, config.suite);
    printPreFlightBanner(ctx, profile, plan, issues);
    if (issues.length > 0) {
      process.exitCode = 1;
    }
    return;
  }

  // 阶梯容量探顶模式 (--capacity)
  if (values.capacity) {
    const customSteps = values['capacity-steps']
      ? values['capacity-steps']
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((n) => Number.isFinite(n) && n >= 1)
      : undefined;
    const mode = config.suite === 'assets' || config.suite === 'frontend' ? 'frontend-only' : 'mixed';
    console.log(`\n━━━ AeroApex 服务器容量阶梯探顶评估 (${mode}) ━━━`);
    const capReport = await runCapacityBenchmark(config, {
      targetMode: mode,
      concurrencySteps: customSteps,
      stepDurationSec: durationSec ?? 4,
      onStepResult: (s) => {
        const icon = s.zone === 'healthy' ? '🟢' : s.zone === 'degraded' ? '🟡' : '🔴';
        console.log(
          `  ${icon} [${String(s.concurrency).padStart(3)} VUs] RPS: ${String(s.rps).padStart(7)} | P50: ${s.p50Ms}ms · P95: ${s.p95Ms}ms | Err: ${(s.errorRate * 100).toFixed(2)}% (429:${s.rateLimitedRequests}) | CPU: ${s.cpuBusyPct}% · Load1m: ${s.loadAvg1m} · Mem: ${s.memUsedGb}/${s.memTotalGb}GB`,
        );
      },
    });
    const outJson = saveCapacityReportJson(capReport, config.reportDir);
    const est = capReport.estimate;
    console.log(`\n  ▶ 安全最大并发连接: ${est.maxHealthyVus} VUs (${est.maxHealthyRps} req/s) | 极限吞吐峰值: ${est.peakUsableRps} req/s`);
    console.log(
      `  ▶ 正常可承载同时在线用户 (CCU): 约 ${est.recommendedOnlineUsers} 人（区间 ${est.concurrentOnlineUsersRange[0]} ~ ${est.concurrentOnlineUsersRange[1]} 人）`,
    );
    console.log(`  ▶ 正常可支撑日活用户规模 (DAU): 约 ${est.recommendedDau} 人/天  |  数据已存至 ${outJson}\n`);
    return;
  }

  const report = await executeStressSuite(config, profile, {
    onContextReady: (ctx, plan, issues) => printPreFlightBanner(ctx, profile, plan, issues),
    onScenarioStart: (index, total, title) => printScenarioHeader(index, total, title),
    onHttpProgress: (snapshot) => printLiveHttpProgress(snapshot),
    onScenarioComplete: (result) => printScenarioResult(result),
  });

  const saved = writeStressReports(report, config.reportDir);
  printFinalSummary(report, saved);

  if (values.strict && !report.summary.overallPassed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  if (err instanceof PreFlightError) {
    process.exitCode = 1;
    return;
  }
  console.error(`\n[drone-stress] 执行异常: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
