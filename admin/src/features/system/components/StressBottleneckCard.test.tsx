import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import * as api from '../api/systemApi';
import { StressBottleneckCard } from './StressBottleneckCard';

vi.mock('../api/systemApi');

describe('StressBottleneckCard', () => {
  it('renders live active stress run badge and CPU bottleneck warning', async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValue({
      service: 'drone-website-server',
      ingestMode: 'direct',
      effectiveMode: 'direct',
      database: { engine: 'postgresql', ok: true, latencyMs: 2.1 },
      redis: {
        configured: false,
        ok: false,
        circuitOpen: false,
        circuitRemainingSec: 0,
        eventsQueueDepth: 0,
        logsQueueDepth: 0,
      },
      protection: {
        ingestRateLimit: 600,
        localTrackedIps: 5,
        fallbackSampleRate: 0.2,
        selfLogEnabled: false,
        trustProxy: true,
      },
      host: {
        cpuCores: 8,
        cpuPercent: 82.4,
        loadAvg1m: 6.92,
        loadRatio: 0.87,
        memUsedGb: 8.85,
        memTotalGb: 15.07,
        memPercent: 58.7,
      },
      traffic: {
        currentRps: 196.5,
        requests1m: 4200,
        p95LatencyMs: 380.2,
        error5xx1m: 0,
        rateLimited4291m: 14,
        stressTrafficActive: true,
      },
      bottleneck: {
        level: 'approaching',
        primaryFactor: 'cpu',
        safeRpsBaseline: 220,
        capacityPercent: 89.3,
        headroomPercent: 10.7,
      },
      stressTest: {
        active: true,
        runId: 'stress-2026-11-25T14-20-00',
        profile: 'l2-growth',
        suite: 'mixed',
        currentScenario: '全栈真实混合业务流量',
        concurrency: 60,
        startedAt: '2026-11-25T14:20:00Z',
        lastReport: null,
      },
      onlineCapacity: {
        onlineUsers: 120,
        activeSessions: 145,
        estimatedMaxOnline: 1760,
        usagePercent: 6.8,
        riskLevel: 'busy',
        windowMinutes: 5,
      },
    });

    renderWithProviders(<StressBottleneckCard />);
    expect(await screen.findByText(/正在压测 · l2-growth \(60 并发\)/)).toBeInTheDocument();
    expect(screen.getByText(/负载偏高 · 剩余空间约 10\.7%/)).toBeInTheDocument();
    expect(screen.getByText(/当前测试项：全栈真实混合业务流量/)).toBeInTheDocument();
    expect(screen.getByText(/120 \/ 1,760 人/)).toBeInTheDocument();
    expect(screen.getByText(/82\.4%/)).toBeInTheDocument();
    expect(screen.getByText(/196\.5 req\/s/)).toBeInTheDocument();
    expect(screen.getByText(/服务器 CPU 占用偏高/)).toBeInTheDocument();
  });

  it('renders healthy idle state with last stress run summary', async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValue({
      service: 'drone-website-server',
      ingestMode: 'direct',
      effectiveMode: 'direct',
      database: { engine: 'postgresql', ok: true, latencyMs: 1.2 },
      redis: {
        configured: false,
        ok: false,
        circuitOpen: false,
        circuitRemainingSec: 0,
        eventsQueueDepth: 0,
        logsQueueDepth: 0,
      },
      protection: {
        ingestRateLimit: 600,
        localTrackedIps: 1,
        fallbackSampleRate: 0.2,
        selfLogEnabled: false,
        trustProxy: false,
      },
      host: {
        cpuCores: 8,
        cpuPercent: 12.5,
        loadAvg1m: 0.85,
        loadRatio: 0.11,
        memUsedGb: 6.2,
        memTotalGb: 15.07,
        memPercent: 41.1,
      },
      traffic: {
        currentRps: 4.2,
        requests1m: 85,
        p95LatencyMs: 18.4,
        error5xx1m: 0,
        rateLimited4291m: 0,
        stressTrafficActive: false,
      },
      bottleneck: {
        level: 'healthy',
        primaryFactor: 'none',
        safeRpsBaseline: 220,
        capacityPercent: 1.9,
        headroomPercent: 58.9,
      },
      stressTest: {
        active: false,
        runId: null,
        profile: null,
        suite: null,
        currentScenario: null,
        concurrency: 0,
        startedAt: null,
        lastReport: {
          runId: 'stress-1',
          generatedAt: '2026-11-25T10:00:00Z',
          profile: 'l1-baseline',
          overallRps: 221.26,
          errorRate: 0,
          overallPassed: true,
        },
      },
    });

    renderWithProviders(<StressBottleneckCard />);
    expect(await screen.findByText(/最近压测 l1-baseline · 每秒 221\.26 次请求/)).toBeInTheDocument();
    expect(screen.getByText(/承压正常 · 剩余空间约 58\.9%/)).toBeInTheDocument();
  });
});
