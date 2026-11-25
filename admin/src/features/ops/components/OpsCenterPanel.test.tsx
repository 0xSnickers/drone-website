import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { listReleases, listStressRuns } from '../api/opsApi';
import { OpsCenterPanel } from './OpsCenterPanel';

vi.mock('../api/opsApi', () => ({
  listReleases: vi.fn(),
  createRelease: vi.fn(),
  deleteRelease: vi.fn(),
  listStressRuns: vi.fn(),
  getStressRunDetail: vi.fn(),
}));

describe('OpsCenterPanel', () => {
  beforeEach(() => {
    vi.mocked(listReleases).mockResolvedValue({
      items: [
        {
          id: 'r1',
          version: 'v1.0.0',
          environment: 'production',
          commitSha: 'a1b2c3d4',
          branch: 'main',
          status: 'success',
          triggeredBy: 'demo@example.com',
          notes: 'Initial release',
          ciSummary: {},
          deployedAt: '2026-11-25T07:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    vi.mocked(listStressRuns).mockResolvedValue({
      items: [
        {
          id: 's1',
          runId: 'stress-2026-11-25T07-51-21',
          releaseVersion: 'v1.0.0',
          profile: 'l1-baseline',
          profileLabel: 'L1 起步期基线',
          suite: 'all',
          passed: true,
          durationSec: 12.5,
          totalRequests: 5000,
          overallRps: 290.33,
          errorRate: 0,
          passedScenarios: 10,
          totalScenarios: 10,
          startedAt: '2026-11-25T07:51:33Z',
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
  });

  it('renders releases KPI/table and switches to stress runs tab', async () => {
    renderWithProviders(<OpsCenterPanel canEdit />);

    expect(await screen.findByText('Initial release')).toBeInTheDocument();
    expect(screen.getByText('10/10')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '压测报告' }));
    expect(await screen.findByText('stress-2026-11-25T07-51-21')).toBeInTheDocument();
  });
});
