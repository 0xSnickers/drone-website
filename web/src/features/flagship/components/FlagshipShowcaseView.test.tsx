import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetCartStoreForTests, useCartStore } from '@/features/store';
import { renderWithProviders } from '@/test/render';
import { FlagshipShowcaseView } from './FlagshipShowcaseView';

describe('FlagshipShowcaseView', () => {
  beforeEach(() => {
    resetCartStoreForTests();
  });

  it('switches 3D perspectives and updates edition price in the order dock', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FlagshipShowcaseView />);

    expect(screen.getByText('VIEW // 整机全向外观')).toBeInTheDocument();
    expect(screen.getAllByText('8,999').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /光学云台/ }));
    expect(screen.getByText('VIEW // 三轴机械云台')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /标准版.*6,999/ }));
    expect(screen.getAllByText('6,999').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: '加入购物车' }));
    const hasStandardDrone = useCartStore
      .getState()
      .items.some((item) => item.id === 'v8-pro-standard');
    expect(hasStandardDrone).toBe(true);
  });
});
