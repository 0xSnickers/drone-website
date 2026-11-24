import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AcademyView } from './AcademyView';

describe('AcademyView', () => {
  it('filters courses by category and opens the HUD video preview modal with unlock flow', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AcademyView />);

    expect(screen.getByText('3天掌握 8 大经典电影航拍运镜')).toBeInTheDocument();
    expect(screen.getByText('民航局无人机驾驶员执照直通车')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '入门' }));
    expect(screen.getByText('空域法规、限飞区申报与安全返航指南')).toBeInTheDocument();
    expect(screen.queryByText('3天掌握 8 大经典电影航拍运镜')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '全部课程' }));
    await user.click(screen.getByRole('button', { name: '开始实操' }));

    expect(screen.getByText('HUD.PLAYBACK // 试看片段 01')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /立即解锁完整课程/ }));
    expect(await screen.findByText('已加入「我的课程」')).toBeInTheDocument();
  });
});
