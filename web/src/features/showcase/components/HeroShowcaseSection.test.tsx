import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { HeroShowcaseSection } from './HeroShowcaseSection';

describe('HeroShowcaseSection', () => {
  it('renders flagship drone studio visual and opens launch film preview dialog', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HeroShowcaseSection />);

    expect(
      screen.getByAltText('AeroApex V8 Pro 碳纤维折叠四旋翼航拍旗舰无人机'),
    ).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /发布影片/ }));
    expect(screen.getByText('AeroApex V8 Pro · 2025 全球首发主题影片')).toBeInTheDocument();
  });
});
