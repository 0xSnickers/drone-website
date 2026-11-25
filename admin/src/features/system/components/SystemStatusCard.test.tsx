import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import * as api from '../api/systemApi';
import { SystemStatusCard } from './SystemStatusCard';

vi.mock('../api/systemApi');

describe('SystemStatusCard', () => {
  it('renders degraded circuit-breaker warning when Redis falls back', async () => {
    vi.mocked(api.getSystemStatus).mockResolvedValue({
      service: 'drone-website-server',
      ingestMode: 'redis_queue',
      effectiveMode: 'degraded_fallback',
      database: { engine: 'postgresql', ok: true, latencyMs: 1.8 },
      redis: {
        configured: true,
        ok: false,
        circuitOpen: true,
        circuitRemainingSec: 24,
        eventsQueueDepth: 0,
        logsQueueDepth: 0,
      },
      protection: {
        ingestRateLimit: 600,
        localTrackedIps: 12,
        fallbackSampleRate: 0.2,
        selfLogEnabled: false,
        trustProxy: true,
      },
    });

    renderWithProviders(<SystemStatusCard />);
    expect(await screen.findByText(/保护模式运行中/)).toBeInTheDocument();
    expect(screen.getByText(/降级抽样写入 \(20%\)/)).toBeInTheDocument();
    expect(screen.getByText(/postgresql \(1\.8 ms\)/)).toBeInTheDocument();
  });
});
