import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { resetCartStoreForTests } from '../store/cartStore';
import { StoreSupportView } from './StoreSupportView';

describe('StoreSupportView', () => {
  beforeEach(() => {
    resetCartStoreForTests();
  });

  it('filters accessories by category, adds AeroCare to cart, and validates SN', async () => {
    const user = userEvent.setup();
    renderWithProviders(<StoreSupportView />);

    expect(screen.getByText('V8 Pro 智能飞行电池')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '云台与滤镜' }));
    expect(screen.getByText('哈苏大师级 ND 减光滤镜组')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /立即添加保障/ }));
    expect(screen.getByText('¥1,598')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /7×24 极光技术专家服务/ }));
    await user.click(screen.getByRole('button', { name: '核验权益' }));
    expect(screen.getByText('请输入至少 6 位有效设备 SN 码')).toBeInTheDocument();

    await user.type(screen.getByLabelText('设备序列号 (SN)'), 'AXV8P2025CN889');
    await user.click(screen.getByRole('button', { name: '核验权益' }));
    expect(await screen.findByText(/SN 校验通过/)).toBeInTheDocument();
  });
});
