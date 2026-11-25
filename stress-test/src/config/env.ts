import fs from 'node:fs';
import path from 'node:path';
import type { BrowserDriverType, ProfileName, StressEnvConfig, SuiteName } from './types';

const VALID_PROFILES = new Set<ProfileName>([
  'smoke',
  'l1-baseline',
  'l2-growth',
  'l3-burst',
  'spike',
]);
const VALID_SUITES = new Set<SuiteName>([
  'all',
  'frontend',
  'backend',
  'assets',
  'browser',
  'sdk',
  'api',
  'mixed',
]);
const VALID_DRIVERS = new Set<BrowserDriverType>(['auto', 'playwright', 'cdp']);

function parseDotEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed
      .slice(eqIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    out[key] = val;
  }
  return out;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function loadStressConfig(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): StressEnvConfig {
  const fileEnv = parseDotEnvFile(path.join(cwd, '.env'));
  const read = (key: string, fallback: string): string => {
    const val = env[key] ?? fileEnv[key];
    return val !== undefined && val !== '' ? val : fallback;
  };

  const rawProfile = read('STRESS_PROFILE', 'l1-baseline') as ProfileName;
  const rawSuite = read('STRESS_SUITE', 'all') as SuiteName;
  const rawDriver = read('STRESS_BROWSER_DRIVER', 'auto') as BrowserDriverType;

  if (!VALID_PROFILES.has(rawProfile)) {
    throw new Error(
      `Invalid STRESS_PROFILE="${rawProfile}". Expected one of: ${[...VALID_PROFILES].join(', ')}`,
    );
  }
  if (!VALID_SUITES.has(rawSuite)) {
    throw new Error(
      `Invalid STRESS_SUITE="${rawSuite}". Expected one of: ${[...VALID_SUITES].join(', ')}`,
    );
  }
  if (!VALID_DRIVERS.has(rawDriver)) {
    throw new Error(
      `Invalid STRESS_BROWSER_DRIVER="${rawDriver}". Expected one of: ${[...VALID_DRIVERS].join(', ')}`,
    );
  }

  return {
    webUrl: stripTrailingSlash(read('STRESS_WEB_URL', 'http://localhost:5173')),
    adminUrl: stripTrailingSlash(read('STRESS_ADMIN_URL', 'http://localhost:5174')),
    serverUrl: stripTrailingSlash(read('STRESS_SERVER_URL', 'http://localhost:9000')),
    adminEmail: read('STRESS_ADMIN_EMAIL', 'demo@example.com'),
    adminPassword: read('STRESS_ADMIN_PASSWORD', 'password123'),
    appKey: read('STRESS_APP_KEY', 'pk_demo_web'),
    profile: rawProfile,
    suite: rawSuite,
    simulateIps: read('STRESS_SIMULATE_IPS', 'false').toLowerCase() === 'true',
    allowPartial: read('STRESS_ALLOW_PARTIAL', 'false').toLowerCase() === 'true',
    browserDriver: rawDriver,
    chromeBin: env.STRESS_CHROME_BIN ?? fileEnv.STRESS_CHROME_BIN ?? '',
    headless: read('STRESS_HEADLESS', 'true').toLowerCase() !== 'false',
    reportDir: path.resolve(cwd, read('STRESS_REPORT_DIR', 'reports')),
  };
}
