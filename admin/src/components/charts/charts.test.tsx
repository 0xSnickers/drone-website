import { fireEvent, render, screen } from '@testing-library/react';
import { LineChart } from './line-chart';
import { StatTile } from './stat-tile';

const data = [
  { bucket: '2026-10-24T00:00:00Z', pv: 10, uv: 4 },
  { bucket: '2026-10-24T01:00:00Z', pv: 30, uv: 9 },
];

describe('LineChart', () => {
  it('draws one path per series, a legend for 2+ series, and a keyboard-driven tooltip listing every series', () => {
    const { container } = render(
      <LineChart
        data={data}
        series={[
          { key: 'pv', label: 'PV', color: 'series-1' },
          { key: 'uv', label: 'UV', color: 'series-2' },
        ]}
        ariaLabel="traffic"
        formatX={(b) => b.slice(11, 16)}
        formatTooltipX={(b) => `at ${b}`}
        formatValue={(v) => `${v}!`}
      />,
    );
    expect(container.querySelectorAll('path[fill="none"]')).toHaveLength(2);
    expect(screen.getByText('UV')).toBeInTheDocument();

    const chart = screen.getByRole('img', { name: 'traffic' });
    fireEvent.focus(chart);
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('at 2026-10-24T01:00:00Z');
    expect(tooltip).toHaveTextContent('30!');
    expect(tooltip).toHaveTextContent('9!');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(screen.getByRole('status')).toHaveTextContent('10!');
    fireEvent.blur(chart);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('single series gets an area wash and no legend', () => {
    const { container } = render(
      <LineChart
        data={data}
        series={[{ key: 'pv', label: 'PV', color: 'series-1' }]}
        ariaLabel="pv"
        formatX={String}
        formatTooltipX={String}
        formatValue={String}
      />,
    );
    expect(container.querySelector('path[fill-opacity="0.1"]')).not.toBeNull();
    expect(screen.queryByText('PV')).not.toBeInTheDocument();
  });
});

describe('StatTile', () => {
  const fmt = (r: number) => `${Math.round(Math.abs(r) * 100)}%`;
  it('rising errors are bad, rising visitors are good', () => {
    const { rerender } = render(
      <StatTile label="Errors" value="12" change={0.5} upIsGood={false} formatChange={fmt} />,
    );
    expect(screen.getByText('+50%').parentElement).toHaveClass('text-critical');
    rerender(<StatTile label="UV" value="12" change={0.5} formatChange={fmt} />);
    expect(screen.getByText('+50%').parentElement).toHaveClass('text-success');
  });
});
