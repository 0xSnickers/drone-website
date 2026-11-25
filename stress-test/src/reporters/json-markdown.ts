import type { StressRunReport } from '../config/types';
import { round } from '../core/stats';

export function renderJsonReport(report: StressRunReport): string {
  return JSON.stringify(report, null, 2) + '\n';
}

export function renderMarkdownReport(report: StressRunReport): string {
  const lines: string[] = [];
  const verdict = report.summary.overallPassed ? '✅ PASSED' : '❌ FAILED';

  lines.push(`# AeroApex 全栈压力测试报告 (${report.runId})`);
  lines.push('');
  lines.push(`- **生成时间**: \`${report.generatedAt}\``);
  lines.push(`- **压测档位**: \`${report.profile.name}\`（${report.profile.label}）`);
  lines.push(
    `- **压测套件**: \`${report.suite}\` | **总耗时**: \`${report.durationSec}s\` | **综合结论**: **${verdict}**`,
  );
  lines.push(
    `- **运行环境**: Node \`${report.environment.nodeVersion}\` · \`${report.environment.platform}/${report.environment.arch}\` · CPU \`${report.environment.cpuCount} cores\``,
  );
  lines.push('');

  lines.push('## 1. 被测服务预检状态');
  lines.push('');
  lines.push('| 服务角色 | 地址 | 在线状态 | 补充信息 |');
  lines.push('| --- | --- | --- | --- |');
  lines.push(
    `| 前台官网 (Web) | \`${report.reachability.web.url}\` | ${report.reachability.web.reachable ? '🟢 在线' : '🔴 离线'} | 首包耗时 ${report.reachability.web.latencyMs ?? '-'}ms |`,
  );
  lines.push(
    `| 管理后台 (Admin) | \`${report.reachability.admin.url}\` | ${report.reachability.admin.reachable ? '🟢 在线' : '🔴 离线'} | 首包耗时 ${report.reachability.admin.latencyMs ?? '-'}ms |`,
  );
  lines.push(
    `| 统一后端 (Server) | \`${report.reachability.server.url}\` | ${report.reachability.server.reachable ? '🟢 在线' : '🔴 离线'} | Ready: ${report.reachability.server.ready ? '是' : '否'}, 鉴权: ${report.reachability.server.authenticated ? '已登录' : '未登录'}, AppKey: \`${report.reachability.server.resolvedAppKey}\` |`,
  );
  lines.push('');

  const httpResults = report.results.filter((r) => r.kind === 'http');
  if (httpResults.length > 0) {
    lines.push('## 2. HTTP 并发压测指标明细');
    lines.push('');
    lines.push(
      '| 场景名称 | 峰值并发 | 总请求 | 总 / 成功 RPS | 成功 / 429限流 / 失败 | 错误率 | P50 | P95 | P99 | TTFB P95 | SLA |',
    );
    lines.push('| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | :---: |');
    for (const r of httpResults) {
      lines.push(
        `| ${r.name} | ${r.peakConcurrency} | ${r.totalRequests} | ${r.rps} / **${r.successRps}** | ${r.okRequests} / ${r.rateLimitedRequests} / ${r.failedRequests} | ${round(r.errorRate * 100, 2)}% | ${r.latencyMs.p50}ms | **${r.latencyMs.p95}ms** | ${r.latencyMs.p99}ms | ${r.ttfbMs.p95}ms | ${r.sla.passed ? '✅' : '❌'} |`,
      );
    }
    lines.push('');
  }

  const browserResults = report.results.filter((r) => r.kind === 'browser');
  if (browserResults.length > 0) {
    lines.push('## 3. 真实浏览器渲染与交互压测指标');
    lines.push('');
    lines.push(
      '| 场景名称 | 驱动 | 并发实例 | 导航成功/总数 | FCP P95 | LCP P95 | Load P95 | 交互均值 | JS Heap 峰值 | DOM 均值 | JS 异常 | SLA |',
    );
    lines.push(
      '| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |',
    );
    for (const b of browserResults) {
      if (b.driverUsed === 'skipped') {
        lines.push(
          `| ${b.name} | skipped | ${b.concurrency} | - | - | - | - | - | - | - | - | ⚠️ 跳过 (${b.skippedReason ?? ''}) |`,
        );
      } else {
        lines.push(
          `| ${b.name} | \`${b.driverUsed}\` | ${b.concurrency} | ${b.okNavigations}/${b.totalNavigations} | **${b.metrics.fcpMs.p95}ms** | ${b.metrics.lcpMs.p95}ms | **${b.metrics.loadEventMs.p95}ms** | ${b.metrics.interactionMs.avg}ms | ${b.metrics.peakJsHeapMb}MB | ${b.metrics.avgDomNodes} | ${b.totalJsErrors} | ${b.sla.passed ? '✅' : '❌'} |`,
        );
      }
    }
    lines.push('');
  }

  lines.push('## 4. 瓶颈诊断与容量调优建议');
  lines.push('');
  for (const item of report.bottlenecks) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  return lines.join('\n');
}
