import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';
import zlib from 'node:zlib';
import type { HttpRequestSpec, HttpSample } from '../config/types';

export class HttpLoadClient {
  private readonly httpAgent: http.Agent;
  private readonly httpsAgent: https.Agent;

  constructor(maxSockets = 512) {
    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 15_000,
      maxSockets,
      maxFreeSockets: Math.min(128, maxSockets),
    });
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 15_000,
      maxSockets,
      maxFreeSockets: Math.min(128, maxSockets),
      rejectUnauthorized: false,
    });
  }

  async send(spec: HttpRequestSpec, defaultTimeoutMs = 6000): Promise<HttpSample> {
    const startedPerf = performance.now();
    const timestampMs = Date.now();
    const timeoutMs = spec.timeoutMs ?? defaultTimeoutMs;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(spec.url);
    } catch {
      return {
        timestampMs,
        status: 0,
        ttfbMs: 0,
        durationMs: 0,
        bytes: 0,
        ok: false,
        rateLimited: false,
        errorReason: 'INVALID_URL',
      };
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;
    const agent = isHttps ? this.httpsAgent : this.httpAgent;
    const bodyBuffer = spec.body !== undefined ? Buffer.from(spec.body, 'utf8') : undefined;

    const headers: Record<string, string> = {
      accept: 'application/json, text/html, */*',
      'x-stress-run': '1',
      ...spec.headers,
    };
    if (bodyBuffer && !headers['content-length'] && !headers['Content-Length']) {
      headers['content-length'] = String(bodyBuffer.byteLength);
    }

    return new Promise<HttpSample>((resolve) => {
      let settled = false;
      let ttfbMs = 0;

      const finish = (sample: HttpSample) => {
        if (settled) return;
        settled = true;
        resolve(sample);
      };

      const req = transport.request(
        parsedUrl,
        {
          method: spec.method,
          headers,
          agent,
        },
        (res) => {
          ttfbMs = round2(performance.now() - startedPerf);
          const status = res.statusCode ?? 0;
          let bytes = 0;
          const chunks: Buffer[] = [];
          const needBodyText = Boolean(spec.validateBody);

          res.on('data', (chunk: Buffer) => {
            bytes += chunk.byteLength;
            if (needBodyText && bytes <= 65_536) {
              chunks.push(chunk);
            }
          });

          res.on('end', () => {
            const durationMs = round2(performance.now() - startedPerf);
            const rateLimited = status === 429;

            if (rateLimited && spec.allowRateLimit !== false) {
              finish({
                timestampMs,
                status,
                ttfbMs,
                durationMs,
                bytes,
                ok: true,
                rateLimited: true,
              });
              return;
            }

            const httpOk = status >= 200 && status < 400;
            if (!httpOk) {
              finish({
                timestampMs,
                status,
                ttfbMs,
                durationMs,
                bytes,
                ok: false,
                rateLimited,
                errorReason: `HTTP_${status}`,
              });
              return;
            }

            if (spec.validateBody) {
              const bodyText = decodeBodyBuffer(
                Buffer.concat(chunks),
                res.headers['content-encoding'],
              );
              const validationErr = spec.validateBody(status, bodyText);
              if (validationErr) {
                finish({
                  timestampMs,
                  status,
                  ttfbMs,
                  durationMs,
                  bytes,
                  ok: false,
                  rateLimited: false,
                  errorReason: validationErr,
                });
                return;
              }
            }

            finish({
              timestampMs,
              status,
              ttfbMs,
              durationMs,
              bytes,
              ok: true,
              rateLimited: false,
            });
          });

          res.on('error', (err) => {
            finish({
              timestampMs,
              status,
              ttfbMs,
              durationMs: round2(performance.now() - startedPerf),
              bytes,
              ok: false,
              rateLimited: false,
              errorReason: normalizeNetError(err),
            });
          });
        },
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('TIMEOUT'));
      });

      req.on('error', (err) => {
        finish({
          timestampMs,
          status: 0,
          ttfbMs,
          durationMs: round2(performance.now() - startedPerf),
          bytes: 0,
          ok: false,
          rateLimited: false,
          errorReason: normalizeNetError(err),
        });
      });

      if (bodyBuffer) {
        req.write(bodyBuffer);
      }
      req.end();
    });
  }

  destroy(): void {
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
  }
}

function decodeBodyBuffer(raw: Buffer, contentEncoding: string | undefined): string {
  const enc = contentEncoding?.toLowerCase().trim();
  try {
    if (enc === 'gzip' || enc === 'x-gzip') return zlib.gunzipSync(raw).toString('utf8');
    if (enc === 'deflate') return zlib.inflateSync(raw).toString('utf8');
    if (enc === 'br') return zlib.brotliDecompressSync(raw).toString('utf8');
  } catch {
    return raw.toString('utf8');
  }
  return raw.toString('utf8');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalizeNetError(err: Error & { code?: string }): string {
  if (err.message === 'TIMEOUT' || err.code === 'ETIMEDOUT') return 'TIMEOUT';
  if (err.code) return err.code;
  return err.message.slice(0, 48) || 'NETWORK_ERROR';
}
