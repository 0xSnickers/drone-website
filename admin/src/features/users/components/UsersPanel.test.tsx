import { screen } from '@testing-library/react';
import { useAuthStore } from '@/features/auth';
import { renderWithProviders } from '@/test/render';
import { listUsers } from '../api/usersApi';
import { UsersPanel } from './UsersPanel';

vi.mock('../api/usersApi', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

describe('UsersPanel', () => {
  beforeEach(() => {
    vi.mocked(listUsers).mockReset();
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: 'u1', name: 'Demo User', email: 'demo@example.com', role: 'admin' },
    });
  });

  it('renders admin and web users with portal separation badges', async () => {
    vi.mocked(listUsers).mockResolvedValue({
      items: [
        {
          id: 'u1',
          name: 'Demo User',
          email: 'demo@example.com',
          role: 'admin',
          createdAt: '2026-11-25T00:00:00Z',
          updatedAt: '2026-11-25T00:00:00Z',
        },
        {
          id: 'u2',
          name: 'AeroApex Pilot',
          email: 'pilot@aeroapex.com',
          role: 'user',
          createdAt: '2026-11-25T00:00:00Z',
          updatedAt: '2026-11-25T00:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
    });

    renderWithProviders(<UsersPanel canEdit />);

    expect(await screen.findByText('demo@example.com')).toBeInTheDocument();
    expect(screen.getByText('pilot@aeroapex.com')).toBeInTheDocument();
    expect(screen.getByText('管理端 + 官网')).toBeInTheDocument();
    expect(screen.getByText('仅前台官网')).toBeInTheDocument();
  });

  it('blocks non-admin monitor viewers with guidance message', () => {
    renderWithProviders(<UsersPanel canEdit={false} />);

    expect(screen.getByText('仅管理员（admin）可查看和管理用户列表。')).toBeInTheDocument();
    expect(listUsers).not.toHaveBeenCalled();
  });
});
