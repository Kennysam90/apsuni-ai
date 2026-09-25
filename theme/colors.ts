/**
 * Colour helpers for the light theme.
 *
 * The app's screens were drawn dark, with their colours written directly into their styles. Rather than
 * rewrite every screen, light mode re-colours them as they are drawn: greys, whites and the deep navy
 * backgrounds are flipped (dark becomes light, light becomes dark), pale accent colours are deepened so
 * they stay readable on white, and strong colours such as the brand blue are left alone.
 */

type RGBA = [number, number, number, number];

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000', transparent: 'rgba(0,0,0,0)' };

export function parseColor(input: string): RGBA | null {
  const value = (NAMED[input.trim().toLowerCase()] ?? input).trim().toLowerCase();

  if (value.startsWith('#')) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((char) => char + char).join('');
    if (hex.length !== 6 && hex.length !== 8) return null;
    const number = (from: number) => Number.parseInt(hex.slice(from, from + 2), 16);
    return [number(0), number(2), number(4), hex.length === 8 ? number(6) / 255 : 1];
  }

  const match = value.match(/^rgba?\(([^)]+)\)$/);
  if (match) {
    const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map((part) => (part.endsWith('%') ? Number.parseFloat(part) / 100 : Number.parseFloat(part)));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
    return [parts[0], parts[1], parts[2], parts[3] ?? 1];
  }
  return null;
}

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const red = r / 255, green = g / 255, blue = b / 255;
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === red) h = (green - blue) / d + (green < blue ? 6 : 0);
  else if (max === green) h = (blue - red) / d + 2;
  else h = (red - green) / d + 4;
  return [h / 6, s, l];
}

function fromHsl(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const grey = Math.round(l * 255); return [grey, grey, grey]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return [Math.round(channel(h + 1 / 3) * 255), Math.round(channel(h) * 255), Math.round(channel(h - 1 / 3) * 255)];
}

const cache = new Map<string, string>();

/** What a colour is used for decides how it changes: a dark background turns light, light text turns dark. */
export type ColorKind = 'bg' | 'fg' | 'border';

/**
 * The light-mode version of a colour written for the dark theme. Colours it cannot read pass through.
 *  - Dark backgrounds and borders become light; light ones are left alone (they were already light cards).
 *  - Light text and icons become dark; dark ones are left alone (they were drawn for a light card).
 *  - Faint white see-through layers become faint dark ones, so they still show on a light page.
 *  - Pale accent text (light blue, mint, pink) is deepened so it stays readable on white.
 */
export function lightColor(input: string, kind: ColorKind = 'fg'): string {
  const key = `${kind}|${input}`;
  const known = cache.get(key);
  if (known) return known;

  const rgba = parseColor(input);
  let result = input;
  if (rgba && rgba[3] > 0) {
    const [r, g, b, a] = rgba;
    const [h, s, l] = toHsl(r, g, b);
    const neutral = s < 0.3 || l < 0.28; // greys, white, black and every deep navy background or border

    let nextL = l;
    let nextS = s;
    if (neutral) {
      const seeThrough = a < 0.5 && l > 0.85; // e.g. rgba(255,255,255,0.06) laid over a dark page
      if (kind === 'fg') {
        if (l > 0.5) { nextL = 0.06 + (1 - l) * 0.88; nextS = Math.min(s, 0.3); } // light text/icons turn dark
      } else if (seeThrough) {
        nextL = 0.06 + (1 - l) * 0.88; // a faint white layer becomes a faint dark one
        nextS = Math.min(s, 0.3);
      } else if (l < 0.5 && a >= 0.75) {
        // Solid dark surfaces turn light. Dark see-through layers (a dimmed backdrop behind a popup) stay dark.
        if (kind === 'bg') { nextL = 0.97 - l * 0.5; nextS = Math.min(s, 0.25) * 0.6; }
        else { nextL = 0.9 - l * 0.6; nextS = Math.min(s, 0.2); }
      }
    } else if (kind === 'fg' && l > 0.62) {
      nextL = Math.min(0.5, Math.max(0.3, 1.12 - l)); // pale accent text (light blue, mint, pink) becomes deeper
    }
    if (nextL !== l || nextS !== s) {
      const [nr, ng, nb] = fromHsl(h, nextS, nextL);
      result = a >= 1 ? `rgb(${nr}, ${ng}, ${nb})` : `rgba(${nr}, ${ng}, ${nb}, ${a})`;
    }
  }
  cache.set(key, result);
  return result;
}

/** True for a strong, mid-tone colour (the brand blue, a green button...): text on it stays as drawn. */
export function isColoredSurface(input: string): boolean {
  const rgba = parseColor(input);
  if (!rgba || rgba[3] < 0.6) return false;
  const [, s, l] = toHsl(rgba[0], rgba[1], rgba[2]);
  return s >= 0.3 && l >= 0.2 && l <= 0.75;
}
