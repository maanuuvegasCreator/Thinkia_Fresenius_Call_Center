export function formatClock(d = new Date()): string {
  return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function formatMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
