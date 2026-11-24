import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CreatorFeedSection } from './CreatorFeedSection';

describe('CreatorFeedSection', () => {
  it('filters works by hashtag and loads more trails on demand', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreatorFeedSection />);

    expect(screen.getByText('天门山九十九道盘山弯公路')).toBeInTheDocument();
    expect(screen.queryByText('多洛米蒂锯齿峰日照金山')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /加载更多全球飞友航迹灵感/ }));
    expect(await screen.findByText('多洛米蒂锯齿峰日照金山')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '#雪山之巅' }));
    expect(screen.getByText('多洛米蒂锯齿峰日照金山')).toBeInTheDocument();
    expect(screen.queryByText('天门山九十九道盘山弯公路')).not.toBeInTheDocument();
  });
});
