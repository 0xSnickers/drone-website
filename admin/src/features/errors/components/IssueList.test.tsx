import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import * as api from '../api/errorApi';
import { IssueList } from './IssueList';

vi.mock('../api/errorApi');

const issue = {
  id: 'i1',
  projectId: 'p1',
  fingerprint: 'f',
  type: 'js' as const,
  message: "TypeError: Cannot read properties of undefined (reading 'price')",
  source: '',
  status: 'open' as const,
  count: 20,
  firstSeen: new Date(Date.now() - 86_400_000).toISOString(),
  lastSeen: new Date().toISOString(),
  rangeCount: 7,
  users: 5,
};

describe('IssueList', () => {
  it('renders issues with links to detail and passes range + filters to the API', async () => {
    vi.mocked(api.getIssues).mockResolvedValue({
      items: [issue],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    renderWithProviders(<IssueList params={{ range: '7d', tz: 'UTC' }} />);

    const link = await screen.findByRole('link', { name: issue.message });
    expect(link).toHaveAttribute('href', '/errors/i1');
    const row = within(link.closest('tr')!);
    expect(row.getByText('未解决')).toBeInTheDocument();
    expect(row.getByText('JS 错误')).toBeInTheDocument();
    expect(row.getByText('7')).toBeInTheDocument();
    await waitFor(() =>
      expect(api.getIssues).toHaveBeenCalledWith(
        expect.objectContaining({ range: '7d', sort: 'frequent', page: 1 }),
      ),
    );
  });

  it('shows an empty state', async () => {
    vi.mocked(api.getIssues).mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    renderWithProviders(<IssueList params={{ range: '24h', tz: 'UTC' }} />);
    expect(await screen.findByText('所选范围内没有异常，做得好！')).toBeInTheDocument();
  });
});
