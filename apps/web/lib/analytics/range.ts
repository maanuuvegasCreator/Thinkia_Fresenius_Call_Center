import type { AnalyticsRange } from './types';

export function rangeBounds(
  key: AnalyticsRange,
  now = new Date()
): { from: Date; to: Date } {
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  const from = new Date(now);
  if (key === 'today') {
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  if (key === 'week') {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  }
  from.setDate(from.getDate() - 29);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

export function previousWindow(from: Date, to: Date): { from: Date; to: Date } {
  const ms = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  prevTo.setHours(23, 59, 59, 999);
  const prevFrom = new Date(prevTo.getTime() - ms);
  prevFrom.setHours(0, 0, 0, 0);
  return { from: prevFrom, to: prevTo };
}
