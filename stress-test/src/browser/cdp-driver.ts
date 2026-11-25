import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { BrowserPageSample } from '../config/types';
import {
  buildInteractionScript,
  COLLECT_VITALS_SCRIPT,
  LCP_INIT_SCRIPT,
  type BrowserDriver,
  type BrowserVisitOptions,
} from './types';

const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export function detectChromeExecutable(explicitPath?: string): string | null {
  if (explicitPath) {
    return isRunnableExecutable(explicitPath) ? explicitPath : null;
  }
  return CHROME_CANDIDATES.find((c) => isRunnableExecutable(c)) ?? null;
}

function isRunnableExecutable(binPath: string): boolean {
  try {
    fs.accessSync(fs.realpathSync(binPath), fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

type CdpEvent = { method?: string; params?: Record<string, unknown>; sessionId?: string };

class CdpRpcConnection {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    { resolve: (val: Record<string, unknown>) => void; reject: (err: Error) => void }
  >();
  private readonly listeners = new Set<(msg: CdpEvent) => void>();

  constructor(private readonly ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      const parsed = JSON.parse(String(event.data)) as CdpEvent & {
        id?: number;
        result?: Record<string, unknown>;
        error?: { message?: string };
      };
      if (typeof parsed.id === 'number') {
        const entry = this.pending.get(parsed.id);
        if (!entry) return;
        this.pending.delete(parsed.id);
        if (parsed.error) entry.reject(new Error(parsed.error.message ?? 'CDP_RPC_ERROR'));
        else entry.resolve(parsed.result ?? {});
        return;
      }
      for (const fn of this.listeners) fn(parsed);
    });
  }

  send(method: string, params: Record<string, unknown> = {}, sessionId?: string) {
    const id = this.nextId++;
    const body = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(body));
    });
  }

  onEvent(fn: (msg: CdpEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  close(): void {
    for (const [, entry] of this.pending) entry.reject(new Error('CDP_CLOSED'));
    this.pending.clear();
    this.ws.close();
  }
}

export async function createCdpDriver(options: {
  headless: boolean;
  chromeBin?: string;
}): Promise<BrowserDriver> {
  const executable = detectChromeExecutable(options.chromeBin);
  if (!executable) throw new Error('未检测到可用的 Chrome / Chromium 可执行文件');

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drone-stress-chrome-'));
  const args = [
    ...(options.headless ? ['--headless=new'] : []),
    '--remote-debugging-port=0',
    '--remote-allow-origins=*',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--enable-precise-memory-info',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];

  const proc = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsEndpoint = await waitForDevToolsWs(proc, 8000);
  const ws = await openWebSocket(wsEndpoint);
  const rpc = new CdpRpcConnection(ws);

  return {
    name: 'cdp',
    async visitAndInteract(visit: BrowserVisitOptions): Promise<BrowserPageSample> {
      const started = performance.now();
      const jsErrors: string[] = [];
      let targetId = '';

      try {
        const created = await rpc.send('Target.createTarget', { url: 'about:blank' });
        targetId = String(created.targetId ?? '');
        const attached = await rpc.send('Target.attachToTarget', { targetId, flatten: true });
        const sessionId = String(attached.sessionId ?? '');

        const unsub = rpc.onEvent((msg) => {
          if (msg.sessionId === sessionId && msg.method === 'Runtime.exceptionThrown') {
            const details = msg.params?.exceptionDetails as { text?: string } | undefined;
            if (details?.text) jsErrors.push(details.text.slice(0, 160));
          }
        });

        try {
          await Promise.all([
            rpc.send('Page.enable', {}, sessionId),
            rpc.send('Runtime.enable', {}, sessionId),
            rpc.send('Performance.enable', {}, sessionId),
          ]);
          await rpc.send(
            'Page.addScriptToEvaluateOnNewDocument',
            { source: LCP_INIT_SCRIPT },
            sessionId,
          );

          const loadDone = waitForSessionEvent(rpc, sessionId, 'Page.loadEventFired', visit.timeoutMs);
          await rpc.send('Page.navigate', { url: `${visit.baseUrl}${visit.route}` }, sessionId);
          await loadDone;
          const navigationMs = round2(performance.now() - started);

          const interactRes = await rpc.send(
            'Runtime.evaluate',
            {
              expression: buildInteractionScript(visit.interactionMode, visit.credentials),
              awaitPromise: true,
              returnByValue: true,
            },
            sessionId,
          );
          const interactionMs = Number(
            (interactRes.result as { value?: unknown } | undefined)?.value ?? 0,
          );

          const [vitalsRes, perfRes] = await Promise.all([
            rpc.send(
              'Runtime.evaluate',
              { expression: COLLECT_VITALS_SCRIPT, returnByValue: true },
              sessionId,
            ),
            rpc.send('Performance.getMetrics', {}, sessionId),
          ]);

          const vitals = ((vitalsRes.result as { value?: Record<string, number> } | undefined)
            ?.value ?? {}) as Record<string, number>;
          const cdpHeapMb = extractCdpMetricMb(perfRes.metrics, 'JSHeapUsedSize');

          return {
            route: visit.route,
            ok: true,
            navigationMs,
            ttfbMs: vitals.ttfbMs ?? 0,
            fcpMs: vitals.fcpMs ?? 0,
            lcpMs: vitals.lcpMs ?? 0,
            domContentLoadedMs: vitals.domContentLoadedMs ?? 0,
            loadEventMs: vitals.loadEventMs ?? 0,
            jsHeapUsedMb: cdpHeapMb > 0 ? cdpHeapMb : (vitals.jsHeapUsedMb ?? 0),
            domNodes: vitals.domNodes ?? 0,
            interactionMs,
            jsErrors,
          };
        } finally {
          unsub();
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message.slice(0, 120) : 'CDP_ERROR';
        return {
          route: visit.route, ok: false, navigationMs: round2(performance.now() - started),
          ttfbMs: 0, fcpMs: 0, lcpMs: 0, domContentLoadedMs: 0, loadEventMs: 0,
          jsHeapUsedMb: 0, domNodes: 0, interactionMs: 0, jsErrors, errorReason: reason,
        };
      } finally {
        if (targetId) await rpc.send('Target.closeTarget', { targetId }).catch(() => undefined);
      }
    },
    async close(): Promise<void> {
      rpc.close();
      if (proc.exitCode === null) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => { proc.kill('SIGKILL'); resolve(); }, 1500);
          proc.once('exit', () => { clearTimeout(timer); resolve(); });
          proc.kill('SIGTERM');
        });
      }
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 80 });
      } catch { /* ignore temp cleanup race */ }
    },
  };
}

function waitForDevToolsWs(proc: ChildProcess, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let stderrBuf = '';
    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new Error(`等待 Chrome DevTools 端口超时: ${stderrBuf.slice(0, 120)}`));
    }, timeoutMs);
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8');
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderrBuf);
      if (match?.[1]) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome 进程提前退出 (code=${String(code)})`));
    });
  });
}

function openWebSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener('open', () => resolve(ws), { once: true });
    ws.addEventListener('error', () => reject(new Error('CDP WebSocket 连接失败')), { once: true });
  });
}

function waitForSessionEvent(
  rpc: CdpRpcConnection,
  sessionId: string,
  method: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error(`TIMEOUT_WAITING_${method}`));
    }, timeoutMs);
    const unsub = rpc.onEvent((msg) => {
      if (msg.sessionId === sessionId && msg.method === method) {
        clearTimeout(timer);
        unsub();
        resolve();
      }
    });
  });
}

function extractCdpMetricMb(metricsRaw: unknown, name: string): number {
  if (!Array.isArray(metricsRaw)) return 0;
  const found = metricsRaw.find(
    (m): m is { name: string; value: number } =>
      typeof m === 'object' && m !== null && (m as { name?: string }).name === name,
  );
  return found ? round2(found.value / (1024 * 1024)) : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
