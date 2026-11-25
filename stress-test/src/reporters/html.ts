import type {
  BrowserScenarioResult,
  HttpScenarioResult,
  StressRunReport,
  TimeSeriesBucket,
} from '../config/types';
import { round } from '../core/stats';

function esc(text: string | number): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTimelineSvg(timeline: TimeSeriesBucket[]): string {
  if (timeline.length === 0) return '';
  const width = 680;
  const height = 160;
  const pad = { top: 18, right: 20, bottom: 26, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxRps = Math.max(1, ...timeline.map((b) => b.rps));
  const maxP95 = Math.max(1, ...timeline.map((b) => b.p95Ms));

  const xAt = (idx: number) =>
    timeline.length === 1 ? pad.left + plotW / 2 : pad.left + (idx / (timeline.length - 1)) * plotW;
  const yRps = (val: number) => pad.top + plotH - (val / maxRps) * plotH;
  const yLat = (val: number) => pad.top + plotH - (val / maxP95) * plotH;

  const rpsPoints = timeline
    .map((b, i) => `${round(xAt(i), 1)},${round(yRps(b.rps), 1)}`)
    .join(' ');
  const p95Points = timeline
    .map((b, i) => `${round(xAt(i), 1)},${round(yLat(b.p95Ms), 1)}`)
    .join(' ');

  return `
  <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="RPS 与 P95 趋势图">
    <line x1="${pad.left}" y1="${pad.top + plotH}" x2="${width - pad.right}" y2="${pad.top + plotH}" stroke="currentColor" stroke-opacity="0.18" />
    <line x1="${pad.left}" y1="${pad.top}" x2="${width - pad.right}" y2="${pad.top}" stroke="currentColor" stroke-opacity="0.08" stroke-dasharray="4 4" />
    <polyline fill="none" stroke="#3b82f6" stroke-width="2.2" points="${rpsPoints}" />
    <polyline fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="5 3" points="${p95Points}" />
    <text x="${pad.left}" y="13" font-size="11" fill="#3b82f6">● 吞吐峰值 ${maxRps} req/s</text>
    <text x="${pad.left + 165}" y="13" font-size="11" fill="#f59e0b">--- P95 峰值 ${maxP95} ms</text>
    <text x="${pad.left}" y="${height - 6}" font-size="10" fill="currentColor" opacity="0.6">1s</text>
    <text x="${width - pad.right - 24}" y="${height - 6}" font-size="10" fill="currentColor" opacity="0.6">${timeline.length}s</text>
  </svg>`;
}

function renderHttpCard(r: HttpScenarioResult): string {
  const badgeCls = r.sla.passed ? 'badge-pass' : 'badge-fail';
  const statusPills = Object.entries(r.statusCounts)
    .map(([code, cnt]) => `<span class="pill">HTTP ${esc(code)}: <b>${cnt}</b></span>`)
    .join(' ');
  const slaRows = r.sla.checks
    .map(
      (c) =>
        `<span class="pill ${c.passed ? 'pill-ok' : 'pill-err'}">${esc(c.metric)}: ${esc(c.actual)} (${esc(c.target)})</span>`,
    )
    .join(' ');

  return `
  <section class="card">
    <div class="card-header">
      <div>
        <h3>${esc(r.name)}</h3>
        <p class="muted">总 RPS: ${r.rps} · 限流率: ${round(r.rateLimitRate * 100, 2)}% · 目标: <code>${esc(r.targetUrl)}</code> · 峰值并发 ${r.peakConcurrency} VUs · 持续 ${r.durationSec}s</p>
      </div>
      <span class="badge ${badgeCls}">${r.sla.passed ? 'SLA PASS' : 'SLA FAIL'}</span>
    </div>
    <div class="kpi-row">
      <div class="kpi"><span class="kpi-label">成功吞吐率 (RPS)</span><strong class="kpi-val">${r.successRps}</strong></div>
      <div class="kpi"><span class="kpi-label">总请求 / 成功</span><strong class="kpi-val">${r.totalRequests} / ${r.okRequests}</strong></div>
      <div class="kpi"><span class="kpi-label">429 限流 / 失败</span><strong class="kpi-val">${r.rateLimitedRequests} / ${r.failedRequests}</strong></div>
      <div class="kpi"><span class="kpi-label">TTFB P95</span><strong class="kpi-val">${r.ttfbMs.p95} ms</strong></div>
      <div class="kpi"><span class="kpi-label">P50 / P95 / P99</span><strong class="kpi-val">${r.latencyMs.p50} / ${r.latencyMs.p95} / ${r.latencyMs.p99} ms</strong></div>
    </div>
    ${renderTimelineSvg(r.timeline)}
    <div class="pills-row">${statusPills}</div>
    <div class="pills-row">${slaRows}</div>
  </section>`;
}

function renderBrowserCard(b: BrowserScenarioResult): string {
  if (b.driverUsed === 'skipped') {
    return `
    <section class="card">
      <div class="card-header">
        <div>
          <h3>${esc(b.name)}</h3>
          <p class="muted">目标: <code>${esc(b.targetUrl)}</code></p>
        </div>
        <span class="badge badge-skip">SKIPPED</span>
      </div>
      <p class="muted">${esc(b.skippedReason ?? '')}</p>
    </section>`;
  }

  const badgeCls = b.sla.passed ? 'badge-pass' : 'badge-fail';
  const routeRows = b.routeBreakdown
    .map(
      (rt) =>
        `<tr><td><code>${esc(rt.route)}</code></td><td>${rt.count}</td><td>${rt.avgFcpMs} ms</td><td>${rt.p95LoadMs} ms</td><td>${rt.jsErrors}</td></tr>`,
    )
    .join('');

  return `
  <section class="card">
    <div class="card-header">
      <div>
        <h3>${esc(b.name)}</h3>
        <p class="muted">驱动: <code>${esc(b.driverUsed)}</code> · 并发页面 ${b.concurrency} · 导航 ${b.okNavigations}/${b.totalNavigations}</p>
      </div>
      <span class="badge ${badgeCls}">${b.sla.passed ? 'SLA PASS' : 'SLA FAIL'}</span>
    </div>
    <div class="kpi-row">
      <div class="kpi"><span class="kpi-label">FCP P95</span><strong class="kpi-val">${b.metrics.fcpMs.p95} ms</strong></div>
      <div class="kpi"><span class="kpi-label">LCP P95</span><strong class="kpi-val">${b.metrics.lcpMs.p95} ms</strong></div>
      <div class="kpi"><span class="kpi-label">Load P95</span><strong class="kpi-val">${b.metrics.loadEventMs.p95} ms</strong></div>
      <div class="kpi"><span class="kpi-label">交互均值</span><strong class="kpi-val">${b.metrics.interactionMs.avg} ms</strong></div>
      <div class="kpi"><span class="kpi-label">JS Heap 峰值 / DOM 节点</span><strong class="kpi-val">${b.metrics.peakJsHeapMb} MB / ${b.metrics.avgDomNodes}</strong></div>
    </div>
    <table class="data-table">
      <thead><tr><th>路由</th><th>采样次数</th><th>FCP 均值</th><th>Load P95</th><th>JS 异常</th></tr></thead>
      <tbody>${routeRows}</tbody>
    </table>
  </section>`;
}

export function renderHtmlReport(report: StressRunReport): string {
  const cardsHtml = report.results
    .map((r) => (r.kind === 'http' ? renderHttpCard(r) : renderBrowserCard(r)))
    .join('\n');
  const bottlenecksHtml = report.bottlenecks.map((n) => `<li>${esc(n)}</li>`).join('');

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AeroApex 压力测试报告 · ${esc(report.runId)}</title>
  <style>
    :root { --bg:#0b1120; --card:#111827; --border:#1f2937; --text:#f3f4f6; --muted:#9ca3af; --pass:#10b981; --fail:#ef4444; --warn:#f59e0b; }
    @media (prefers-color-scheme: light) {
      :root { --bg:#f8fafc; --card:#ffffff; --border:#e2e8f0; --text:#0f172a; --muted:#64748b; }
    }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--text); line-height:1.5; padding:28px 16px; }
    .container { max-width: 1080px; margin: 0 auto; }
    header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
    h1 { margin:0 0 6px; font-size:24px; }
    h2 { font-size:17px; margin:20px 0 10px; }
    h3 { margin:0 0 4px; font-size:16px; }
    .muted { color:var(--muted); font-size:13px; margin:0; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:18px; margin-bottom:16px; }
    .card-header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px; }
    .badge { padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; }
    .badge-pass { background:rgba(16,185,129,0.16); color:var(--pass); }
    .badge-fail { background:rgba(239,68,68,0.16); color:var(--fail); }
    .badge-skip { background:rgba(245,158,11,0.16); color:var(--warn); }
    .kpi-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-bottom:12px; }
    .kpi { border:1px solid var(--border); border-radius:8px; padding:10px 12px; }
    .kpi-label { display:block; font-size:12px; color:var(--muted); }
    .kpi-val { font-size:16px; }
    .chart-svg { width:100%; height:auto; max-height:175px; display:block; margin:8px 0; }
    .pills-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
    .pill { font-size:12px; padding:2px 8px; border-radius:6px; border:1px solid var(--border); color:var(--muted); }
    .pill-ok { border-color:rgba(16,185,129,0.35); color:var(--pass); }
    .pill-err { border-color:rgba(239,68,68,0.4); color:var(--fail); }
    .data-table { width:100%; border-collapse:collapse; font-size:13px; margin-top:10px; }
    .data-table th, .data-table td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--border); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:12px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>AeroApex 前后端压力测试报告</h1>
        <p class="muted">Run ID: <code>${esc(report.runId)}</code> · 档位: <code>${esc(report.profile.name)}</code> (${esc(report.profile.label)}) · 套件: <code>${esc(report.suite)}</code> · 生成于 ${esc(report.generatedAt)}</p>
      </div>
      <span class="badge ${report.summary.overallPassed ? 'badge-pass' : 'badge-fail'}">${report.summary.overallPassed ? 'OVERALL PASSED' : 'OVERALL FAILED'}</span>
    </header>

    <section class="card">
      <div class="kpi-row">
        <div class="kpi"><span class="kpi-label">执行场景 (通过/总数)</span><strong class="kpi-val">${report.summary.passedScenarios} / ${report.summary.totalScenarios}</strong></div>
        <div class="kpi"><span class="kpi-label">HTTP 累计请求</span><strong class="kpi-val">${report.summary.totalHttpRequests}</strong></div>
        <div class="kpi"><span class="kpi-label">HTTP 综合吞吐</span><strong class="kpi-val">${report.summary.overallHttpRps} req/s</strong></div>
        <div class="kpi"><span class="kpi-label">非限流错误率</span><strong class="kpi-val">${round(report.summary.overallHttpErrorRate * 100, 2)}%</strong></div>
        <div class="kpi"><span class="kpi-label">浏览器导航压测次数</span><strong class="kpi-val">${report.summary.totalBrowserNavigations}</strong></div>
      </div>
      <h2>瓶颈诊断与容量调优建议</h2>
      <ul>${bottlenecksHtml}</ul>
    </section>

    ${cardsHtml}
  </div>
</body>
</html>\n`;
}
