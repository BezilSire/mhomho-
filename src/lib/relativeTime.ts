/**
 * Human relative time. Kept dependency-free and pure so it can be unit tested
 * and reused by every activity surface.
 */
export function relativeTime(timestamp: number, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'just now';
  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSeconds < 15) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds} secs ago`;

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} mins ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hr ago' : `${hours} hrs ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;

  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

/** Example: 24 Oct, 18:42 */
export function absoluteTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  return new Date(timestamp).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initials(value: string): string {
  const clean = value.trim().replace(/^@/, '');
  if (!clean) return '?';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}
