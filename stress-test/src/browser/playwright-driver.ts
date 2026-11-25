import { performance } from 'node:perf_hooks';
import type { BrowserPageSample } from '../config/types';
import {
  buildInteractionScript,
  COLLECT_VITALS_SCRIPT,
  LCP_INIT_SCRIPT,
  type BrowserDriver,
  type BrowserVisitOptions,
} from './types';

interface MinimalPlaywrightPage {
  on(event: string, listener: (arg: unknown) => void): void;
  addInitScript(script: string): Promise<void>;
  goto(url: string, options: { timeout: number; waitUntil: 'load' }): Promise<unknown>;
  evaluate<T>(pageFunction: string): Promise<T>;
  close(): Promise<void>;
}

interface MinimalPlaywrightContext {
  newPage(): Promise<MinimalPlaywrightPage>;
  close(): Promise<void>;
}

interface MinimalPlaywrightBrowser {
  newContext(options: { viewport: { width: number; height: number } }): Promise<MinimalPlaywrightContext>;
  close(): Promise<void>;
}

interface MinimalPlaywrightModule {
  chromium: {
    launch(options: {
      headless: boolean;
      executablePath?: string;
      args?: string[];
    }): Promise<MinimalPlaywrightBrowser>;
  };
}

const dynamicImport = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<MinimalPlaywrightModule>;

export async function createPlaywrightDriver(options: {
  headless: boolean;
  chromeBin?: string;
}): Promise<BrowserDriver> {
  let pw: MinimalPlaywrightModule | null = null;
  try {
    pw = await dynamicImport('playwright');
  } catch {
    pw = await dynamicImport('playwright-core');
  }

  const browser = await pw.chromium.launch({
    headless: options.headless,
    ...(options.chromeBin ? { executablePath: options.chromeBin } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-precise-memory-info'],
  });

  return {
    name: 'playwright',
    async visitAndInteract(visit: BrowserVisitOptions): Promise<BrowserPageSample> {
      const started = performance.now();
      const jsErrors: string[] = [];
      let context: MinimalPlaywrightContext | null = null;

      try {
        context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        page.on('pageerror', (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          jsErrors.push(msg.slice(0, 160));
        });

        await page.addInitScript(LCP_INIT_SCRIPT);
        await page.goto(`${visit.baseUrl}${visit.route}`, {
          timeout: visit.timeoutMs,
          waitUntil: 'load',
        });
        const navigationMs = round2(performance.now() - started);

        const interactionMs = await page.evaluate<number>(
          buildInteractionScript(visit.interactionMode, visit.credentials),
        );
        const vitals = await page.evaluate<{
          ttfbMs: number;
          fcpMs: number;
          lcpMs: number;
          domContentLoadedMs: number;
          loadEventMs: number;
          jsHeapUsedMb: number;
          domNodes: number;
        }>(COLLECT_VITALS_SCRIPT);

        return {
          route: visit.route,
          ok: true,
          navigationMs,
          ttfbMs: vitals.ttfbMs,
          fcpMs: vitals.fcpMs,
          lcpMs: vitals.lcpMs,
          domContentLoadedMs: vitals.domContentLoadedMs,
          loadEventMs: vitals.loadEventMs,
          jsHeapUsedMb: vitals.jsHeapUsedMb,
          domNodes: vitals.domNodes,
          interactionMs,
          jsErrors,
        };
      } catch (err) {
        return {
          route: visit.route,
          ok: false,
          navigationMs: round2(performance.now() - started),
          ttfbMs: 0,
          fcpMs: 0,
          lcpMs: 0,
          domContentLoadedMs: 0,
          loadEventMs: 0,
          jsHeapUsedMb: 0,
          domNodes: 0,
          interactionMs: 0,
          jsErrors,
          errorReason: err instanceof Error ? err.message.slice(0, 120) : 'PLAYWRIGHT_ERROR',
        };
      } finally {
        if (context) {
          await context.close().catch(() => undefined);
        }
      }
    },
    async close(): Promise<void> {
      await browser.close().catch(() => undefined);
    },
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
