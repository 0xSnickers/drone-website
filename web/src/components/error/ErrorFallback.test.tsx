import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { renderWithProviders } from '@/test/render';
import { ErrorFallback } from './ErrorFallback';

describe('Centered Error and 404 States', () => {
  it('renders centered ErrorFallback with retry callback', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderWithProviders(<ErrorFallback onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('页面出现异常')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders centered NotFoundPage with back-home navigation', () => {
    renderWithProviders(<NotFoundPage />);

    expect(screen.getByText('ERR 404 // ROUTE_NOT_FOUND')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/');
  });
});
