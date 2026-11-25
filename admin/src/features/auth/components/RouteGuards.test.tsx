import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '../store/authStore';
import { RequireAuth } from './RouteGuards';

describe('monitoring access', () => {
  afterEach(() => useAuthStore.setState({ user: null, status: 'anonymous' }));

  it.each(['user', 'unknown'])('blocks %s accounts before rendering monitoring pages', (role) => {
    useAuthStore.setState({
      status: 'authenticated',
      user: { id: '1', name: 'Member', email: null, role },
    });
    renderWithProviders(<RequireAuth />, { route: '/' });
    expect(screen.getByRole('alert')).toHaveTextContent('请联系管理员');
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
  });

  it.each(['admin', 'monitor_viewer'])(
    'allows %s accounts to render the protected outlet',
    (role) => {
      useAuthStore.setState({
        status: 'authenticated',
        user: { id: '1', name: 'Operator', email: null, role },
      });
      renderWithProviders(
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/" element={<p>监控内容</p>} />
          </Route>
        </Routes>,
      );
      expect(screen.getByText('监控内容')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );
});
