import { changeRatio, formatBucket, formatCompact, formatMs, formatRelative } from './format';

describe('format', () => {
  it('compacts large numbers only', () => {
    expect(formatCompact(1284, 'en-US')).toBe('1,284');
    expect(formatCompact(12_900, 'en-US')).toBe('12.9K');
    expect(formatCompact(12_900, 'zh-CN')).toBe('1.3万');
  });

  it('formats durations', () => {
    expect(formatMs(85.4, 'en-US')).toBe('85 ms');
    expect(formatMs(1735, 'en-US')).toBe('1.74 s');
  });

  it('computes period-over-period change, null when previous is 0', () => {
    expect(changeRatio(120, 100)).toBeCloseTo(0.2);
    expect(changeRatio(5, 0)).toBeNull();
  });

  it('formats buckets by granularity and relative time', () => {
    const date = new Date(2026, 9, 24, 14, 5);
    expect(formatBucket(date, 'hour', 'en-US')).toBe('14:05');
    expect(formatBucket(date, 'day', 'en-US')).toBe('10/24');
    expect(formatRelative(new Date(Date.now() - 3 * 60_000), 'en-US')).toBe('3 minutes ago');
  });
});
