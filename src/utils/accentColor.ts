/** Converts a hex color to rgb components string e.g. "#7c3aed" → "124, 58, 237" */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Darkens a hex color by a percentage */
function darken(hex: string, pct = 12): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = Math.max(0, ((n >> 16) & 255) - Math.round(2.55 * pct));
  const g = Math.max(0, ((n >> 8) & 255) - Math.round(2.55 * pct));
  const b = Math.max(0, (n & 255) - Math.round(2.55 * pct));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function applyAccentColor(hex: string) {
  const root = document.documentElement;
  const safe = hex && hex.startsWith('#') && hex.length >= 7 ? hex : '#7c3aed';
  root.style.setProperty('--accent', safe);
  root.style.setProperty('--accent-dim', darken(safe, 10));
  root.style.setProperty('--accent-glow', `rgba(${hexToRgb(safe)}, 0.35)`);
  root.style.setProperty('--accent-subtle', `rgba(${hexToRgb(safe)}, 0.13)`);
}
