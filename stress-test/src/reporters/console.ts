import type { LoadProfile, ScenarioResult, StressRunReport } from '../config/types';
import type { PreFlightIssue, RuntimeContext } from '../core/context';
import type { LiveProgressSnapshot } from '../core/load-runner';
import { round } from '../core/stats';
import type { ExecutionPlan } from '../scenarios';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function badge(ok: boolean, okLabel = 'ONLINE', failLabel = 'OFFLINE'): string {
  return ok
    ? `${ANSI.green}● ${okLabel}${ANSI.reset}`
    : `${ANSI.red}○ ${failLabel}${ANSI.reset}`;
}

export function printPreFlightBanner(
  ctx: RuntimeContext,
  profile: LoadProfile,
  plan: ExecutionPlan,
  issues: PreFlightIssue[] = [],
): void {
  const { reachability } = ctx;
  console.log(`\n${ANSI.bold}${ANSI.cyan}━━━ AeroApex 全栈压力测试引擎 (drone-stress) ━━━${ANSI.reset}`);
  console.log(
    `  档位: ${ANSI.bold}${profile.name}${ANSI.reset} (${profile.label})  |  套件: ${ANSI.bold}${ctx.config.suite}${ANSI.reset}  |  模拟多 IP: ${ctx.config.simulateIps ? '开启' : '关闭'}`,
  );
  console.log(`  说明: ${ANSI.dim}${profile.description}${ANSI.reset}\n`);
  console.log(`  ${ANSI.bold}目标连通性与就绪度预检:${ANSI.reset}`);
  console.log(
    `    • Web 前台官网   (${reachability.web.url})  ${badge(reachability.web.reachable)} ${reachability.web.reachable ? `${ANSI.dim}[${reachability.web.latencyMs}ms · 静态资源 ${ctx.webAssetPaths.length} 项]${ANSI.reset}` : ''}`,
  );
  console.log(
    `    • Admin 管理后台 (${reachability.admin.url})  ${badge(reachability.admin.reachable)} ${reachability.admin.reachable ? `${ANSI.dim}[${reachability.admin.latencyMs}ms · 静态资源 ${ctx.adminAssetPaths.length} 项]${ANSI.reset}` : ''}`,
  );
  console.log(
    `    • Server 后端    (${reachability.server.url})  ${badge(reachability.server.reachable && reachability.server.ready)} ${
      reachability.server.reachable
        ? `${ANSI.dim}[Health:✓ · Ready:${reachability.server.ready ? '✓' : '✗'} · Auth:${reachability.server.authenticated ? '✓' : '✗'} · AppKey:${ctx.resolvedAppKey}]${ANSI.reset}`
        : ''
    }`,
  );

  if (issues.length > 0 && !ctx.config.allowPartial) {
    console.log(
      `\n  ${ANSI.red}${ANSI.bold}✗ 环境预检失败，已阻断压力测试（检测到 ${issues.length} 个依赖服务未正常启动）：${ANSI.reset}`,
    );
    for (const item of issues) {
      console.log(`    • [${item.component}] ${item.url} -> ${item.reason}`);
      console.log(`      ${ANSI.dim}处理建议: ${item.hint}${ANSI.reset}`);
    }
    console.log('');
    return;
  }

  const totalScenarios = plan.httpScenarios.length + plan.browserPlans.length;
  console.log(
    `\n  ${ANSI.green}✓ 环境预检通过${ANSI.reset}，计划执行 ${ANSI.bold}${totalScenarios}${ANSI.reset} 个压测场景（HTTP 场景 ${plan.httpScenarios.length} 个，浏览器场景 ${plan.browserPlans.length} 个）\n`,
  );
}

export function printScenarioHeader(index: number, total: number, title: string): void {
  console.log(`${ANSI.bold}[${index}/${total}] ▶ ${title}${ANSI.reset}`);
}

export function printLiveHttpProgress(snapshot: LiveProgressSnapshot): void {
  const line = `    ${ANSI.dim}[${snapshot.phaseName} · ${snapshot.concurrency} VUs · ${snapshot.elapsedSec}/${snapshot.totalDurationSec}s]${ANSI.reset} 已完成 ${snapshot.completedRequests} reqs | 瞬时 ${ANSI.cyan}${snapshot.recentRps} req/s${ANSI.reset} | 错误 ${snapshot.errorCount} | 429限流 ${snapshot.rateLimitedCount}`;
  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line.padEnd(105)}`);
  } else {
    console.log(line);
  }
}

export function printScenarioResult(result: ScenarioResult): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\r' + ' '.repeat(110) + '\r');
  }

  if (result.kind === 'http') {
    const verdict = result.sla.passed
      ? `${ANSI.green}PASS${ANSI.reset}`
      : `${ANSI.red}FAIL${ANSI.reset}`;
    const mbPerSec = round(result.throughputBytesPerSec / (1024 * 1024), 2);
    console.log(
      `    结果 [${verdict}] 吞吐 ${ANSI.bold}${result.rps} req/s${ANSI.reset} (${mbPerSec} MB/s) | 总请求 ${result.totalRequests} (2xx:${result.okRequests}, 429:${result.rateLimitedRequests}, 失败:${result.failedRequests})`,
    );
    console.log(
      `    延迟  Avg ${result.latencyMs.avg}ms · P50 ${result.latencyMs.p50}ms · ${ANSI.bold}P95 ${result.latencyMs.p95}ms${ANSI.reset} · P99 ${result.latencyMs.p99}ms · Max ${result.latencyMs.max}ms | TTFB P95 ${result.ttfbMs.p95}ms\n`,
    );
    return;
  }

  if (result.driverUsed === 'skipped') {
    console.log(`    结果 [${ANSI.yellow}SKIPPED${ANSI.reset}] ${result.skippedReason}\n`);
    return;
  }

  const verdict = result.sla.passed
    ? `${ANSI.green}PASS${ANSI.reset}`
    : `${ANSI.red}FAIL${ANSI.reset}`;
  console.log(
    `    结果 [${verdict}] 驱动:${result.driverUsed} | 并发实例:${result.concurrency} | 页面导航:${result.okNavigations}/${result.totalNavigations} | JS异常:${result.totalJsErrors}`,
  );
  console.log(
    `    指标  FCP P95 ${ANSI.bold}${result.metrics.fcpMs.p95}ms${ANSI.reset} · LCP P95 ${result.metrics.lcpMs.p95}ms · Load P95 ${result.metrics.loadEventMs.p95}ms · 交互耗时 Avg ${result.metrics.interactionMs.avg}ms · Heap峰值 ${result.metrics.peakJsHeapMb}MB · DOM均值 ${result.metrics.avgDomNodes}\n`,
  );
}

export function printFinalSummary(
  report: StressRunReport,
  savedFiles: { htmlPath: string; jsonPath: string; markdownPath: string },
): void {
  console.log(`${ANSI.bold}${ANSI.cyan}━━━ 压测汇总与诊断结论 ━━━${ANSI.reset}`);
  const overallBadge = report.summary.overallPassed
    ? `${ANSI.green}${ANSI.bold}PASSED${ANSI.reset}`
    : `${ANSI.red}${ANSI.bold}FAILED${ANSI.reset}`;
  console.log(
    `  综合结论: ${overallBadge}  |  总耗时: ${report.durationSec}s  |  场景通过: ${report.summary.passedScenarios}/${report.summary.totalScenarios} (跳过 ${report.summary.skippedScenarios})`,
  );
  console.log(
    `  HTTP 累计请求: ${report.summary.totalHttpRequests}  |  综合吞吐: ${report.summary.overallHttpRps} req/s  |  非限流错误率: ${round(report.summary.overallHttpErrorRate * 100, 2)}%`,
  );

  console.log(`\n  ${ANSI.bold}瓶颈分析与调优建议:${ANSI.reset}`);
  for (const note of report.bottlenecks) {
    console.log(`    • ${note}`);
  }

  console.log(`\n  ${ANSI.bold}压测报告已输出:${ANSI.reset}`);
  console.log(`    • HTML 可视化报告: ${savedFiles.htmlPath}`);
  console.log(`    • Markdown 报告:   ${savedFiles.markdownPath}`);
  console.log(`    • JSON 原始数据:   ${savedFiles.jsonPath}\n`);
}
