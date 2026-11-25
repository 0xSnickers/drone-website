import fs from 'node:fs';
import path from 'node:path';

export interface ActiveStressHeartbeat {
  active: boolean;
  runId: string;
  profile: string;
  suite: string;
  currentScenario: string;
  concurrency: number;
  startedAt: string;
  updatedAtMs: number;
}

function resolveDefaultReportsDir(): string {
  const cwd = process.cwd();
  if (path.basename(cwd) === 'stress-test') {
    return path.join(cwd, 'reports');
  }
  const nested = path.join(cwd, 'stress-test', 'reports');
  if (fs.existsSync(path.dirname(nested))) {
    return nested;
  }
  return path.join(cwd, 'reports');
}

export function writeStressHeartbeat(
  payload: ActiveStressHeartbeat,
  customReportDir?: string,
): void {
  const dirs = new Set<string>([resolveDefaultReportsDir()]);
  if (customReportDir) dirs.add(customReportDir);

  const raw = JSON.stringify(payload, null, 2) + '\n';
  for (const dir of dirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, '.active-run.json'), raw, 'utf8');
    } catch {
      // 忽略只读目录写心跳异常，不影响压测主流程
    }
  }
}

export function clearStressHeartbeat(customReportDir?: string): void {
  writeStressHeartbeat(
    {
      active: false,
      runId: '',
      profile: '',
      suite: '',
      currentScenario: '',
      concurrency: 0,
      startedAt: '',
      updatedAtMs: Date.now(),
    },
    customReportDir,
  );
}
