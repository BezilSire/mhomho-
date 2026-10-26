import { describe, expect, it } from 'vitest';
import { initials, relativeTime } from '../src/lib/relativeTime.ts';

const NOW = 1_700_000_000_000;
const seconds = (value: number) => value * 1000;

describe('relativeTime', () => {
  it('describes the first minute precisely', () => {
    expect(relativeTime(NOW, NOW)).toBe('just now');
    expect(relativeTime(NOW - seconds(10), NOW)).toBe('just now');
    expect(relativeTime(NOW - seconds(30), NOW)).toBe('30 secs ago');
    expect(relativeTime(NOW - seconds(60), NOW)).toBe('1 min ago');
    expect(relativeTime(NOW - seconds(180), NOW)).toBe('3 mins ago');
  });

  it('moves through hours, days and weeks', () => {
    expect(relativeTime(NOW - 60 * 60 * 1000, NOW)).toBe('1 hr ago');
    expect(relativeTime(NOW - 5 * 60 * 60 * 1000, NOW)).toBe('5 hrs ago');
    expect(relativeTime(NOW - 24 * 60 * 60 * 1000, NOW)).toBe('yesterday');
    expect(relativeTime(NOW - 3 * 24 * 60 * 60 * 1000, NOW)).toBe('3 days ago');
    expect(relativeTime(NOW - 14 * 24 * 60 * 60 * 1000, NOW)).toBe('2 weeks ago');
  });

  it('never renders a negative age', () => {
    expect(relativeTime(NOW + 5_000, NOW)).toBe('just now');
    expect(relativeTime(0, NOW)).toBe('just now');
  });
});

describe('initials', () => {
  it('handles handles and full names', () => {
    expect(initials('@tinashe')).toBe('TI');
    expect(initials('Tinashe Moyo')).toBe('TM');
    expect(initials('  ')).toBe('?');
  });
});
