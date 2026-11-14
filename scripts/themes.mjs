// Color themes for the start screen and the report. Each theme lists a few base colors
// taken from its official palette; everything else (soft backgrounds, grid lines) is
// derived. Text colors are checked against WCAG contrast and darkened (light themes) or
// lightened (dark themes) when an official color is too faint to read on its background.
//
// The ids must match THEMES in public/theme-list.js, which the build generates from this list.

export const THEMES = [
  // The app's own palette. "system" uses light or dark to follow the operating system.
  { id: 'light', name: 'Light', scheme: 'light',
    c: { bg: '#f6f7f5', panel: '#ffffff', fg: '#1b2420', muted: '#5d6a64', line: '#dde2df', accent: '#1f7a5a', ink: '#ffffff',
         st: '#8a948f', ath: '#b4572e', price: '#6f7d8a', good: '#1f7a5a', warn: '#8a5a00', bad: '#a33a2b' } },
  { id: 'dark', name: 'Dark', scheme: 'dark',
    c: { bg: '#121614', panel: '#1a201d', fg: '#e6ece9', muted: '#9aa7a1', line: '#2c3531', accent: '#4cc095', ink: '#0d1a14',
         st: '#7d8883', ath: '#e08a5f', price: '#8d9aa6', good: '#5fd0a4', warn: '#e5b45a', bad: '#f08a7a' } },

  // https://primer.style/foundations/color (GitHub Primer)
  { id: 'github-light', name: 'GitHub Light', scheme: 'light',
    c: { bg: '#f6f8fa', panel: '#ffffff', fg: '#1f2328', muted: '#59636e', line: '#d1d9e0', accent: '#0969da', ink: '#ffffff',
         st: '#818b98', ath: '#bc4c00', price: '#8c959f', good: '#1a7f37', warn: '#9a6700', bad: '#d1242f' } },
  { id: 'github-dark', name: 'GitHub Dark', scheme: 'dark',
    c: { bg: '#0d1117', panel: '#151b23', fg: '#e6edf3', muted: '#9198a1', line: '#30363d', accent: '#4493f8', ink: '#0d1117',
         st: '#656c76', ath: '#db6d28', price: '#8b949e', good: '#3fb950', warn: '#d29922', bad: '#f85149' } },

  // https://github.com/atom/atom/tree/master/packages/one-dark-syntax
  { id: 'one-dark', name: 'One Dark', scheme: 'dark',
    c: { bg: '#21252b', panel: '#282c34', fg: '#abb2bf', muted: '#7f848e', line: '#3e4451', accent: '#61afef', ink: '#21252b',
         st: '#5c6370', ath: '#d19a66', price: '#7f848e', good: '#98c379', warn: '#e5c07b', bad: '#e06c75' } },

  // https://spec.draculatheme.com
  { id: 'dracula', name: 'Dracula', scheme: 'dark',
    c: { bg: '#21222c', panel: '#282a36', fg: '#f8f8f2', muted: '#a0a8cd', line: '#44475a', accent: '#bd93f9', ink: '#21222c',
         st: '#6272a4', ath: '#ffb86c', price: '#8be9fd', good: '#50fa7b', warn: '#f1fa8c', bad: '#ff5555' } },

  // https://github.com/folke/tokyonight.nvim
  { id: 'tokyo-night', name: 'Tokyo Night', scheme: 'dark',
    c: { bg: '#16161e', panel: '#1a1b26', fg: '#c0caf5', muted: '#9aa5ce', line: '#292e42', accent: '#7aa2f7', ink: '#16161e',
         st: '#565f89', ath: '#ff9e64', price: '#737aa2', good: '#9ece6a', warn: '#e0af68', bad: '#f7768e' } },

  // https://catppuccin.com/palette
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', scheme: 'light',
    c: { bg: '#e6e9ef', panel: '#eff1f5', fg: '#4c4f69', muted: '#6c6f85', line: '#ccd0da', accent: '#8839ef', ink: '#eff1f5',
         st: '#9ca0b0', ath: '#fe640b', price: '#7c7f93', good: '#40a02b', warn: '#df8e1d', bad: '#d20f39' } },
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', scheme: 'dark',
    c: { bg: '#181825', panel: '#1e1e2e', fg: '#cdd6f4', muted: '#a6adc8', line: '#313244', accent: '#cba6f7', ink: '#1e1e2e',
         st: '#6c7086', ath: '#fab387', price: '#9399b2', good: '#a6e3a1', warn: '#f9e2af', bad: '#f38ba8' } },

  // https://www.nordtheme.com/docs/colors-and-palettes
  { id: 'nord', name: 'Nord', scheme: 'dark',
    c: { bg: '#2e3440', panel: '#3b4252', fg: '#eceff4', muted: '#d8dee9', line: '#4c566a', accent: '#88c0d0', ink: '#2e3440',
         st: '#7b88a1', ath: '#d08770', price: '#81a1c1', good: '#a3be8c', warn: '#ebcb8b', bad: '#bf616a' } },

  // https://ethanschoonover.com/solarized/
  { id: 'solarized-light', name: 'Solarized Light', scheme: 'light',
    c: { bg: '#eee8d5', panel: '#fdf6e3', fg: '#073642', muted: '#586e75', line: '#e4ddc8', accent: '#268bd2', ink: '#fdf6e3',
         st: '#93a1a1', ath: '#cb4b16', price: '#6c71c4', good: '#859900', warn: '#b58900', bad: '#dc322f' } },
  { id: 'solarized-dark', name: 'Solarized Dark', scheme: 'dark',
    c: { bg: '#002b36', panel: '#073642', fg: '#eee8d5', muted: '#93a1a1', line: '#0e4a57', accent: '#268bd2', ink: '#002b36',
         st: '#586e75', ath: '#cb4b16', price: '#6c71c4', good: '#859900', warn: '#b58900', bad: '#dc322f' } },
];

// ---------- color math ----------

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t)); // t=0 -> a, t=1 -> b
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Move `color` toward `toward` until it reaches `min` contrast against every background.
function legible(color, toward, backgrounds, min) {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(color, toward, t);
    if (backgrounds.every((bg) => contrast(c, bg) >= min)) return c;
  }
  return toward;
}

// ---------- tokens ----------

export function tokens(theme, report = []) {
  const c = { ...theme.c };
  const soft = (color) => mix(color, c.panel, 0.84);
  const fix = (key, min, bgs) => {
    const before = c[key];
    c[key] = legible(c[key], theme.scheme === 'light' ? '#000000' : '#ffffff', bgs, min);
    if (c[key] !== before) report.push(`${theme.name}: ${key} ${before} -> ${c[key]}`);
  };
  fix('muted', 4.5, [c.panel, c.bg]);
  for (const k of ['good', 'warn', 'bad']) fix(k, 4.5, [c.panel, soft(c[k])]);
  fix('accent', 3, [c.panel]);
  if (contrast(c.ink, c.accent) < 4.5) {
    // button text still faint: move the accent away from the text color
    const before = c.accent;
    c.accent = legible(c.accent, lum(c.ink) > lum(c.accent) ? '#000000' : '#ffffff', [c.ink], 4.5);
    report.push(`${theme.name}: accent ${before} -> ${c.accent} (for button text)`);
  }

  return {
    bg: c.bg, panel: c.panel, fg: c.fg, muted: c.muted, line: c.line, grid: mix(c.line, c.panel, 0.45),
    // start screen
    accent: c.accent, 'accent-ink': c.ink, 'accent-soft': soft(c.accent), 'accent-line': mix(c.accent, c.line, 0.45),
    'bad-soft': soft(c.bad),
    // report
    lt: c.accent, 'lt-soft': soft(c.accent), st: c.st, ath: c.ath, price: c.price,
    good: c.good, 'good-bg': soft(c.good), warn: c.warn, 'warn-bg': soft(c.warn), bad: c.bad, 'bad-bg': soft(c.bad),
    'neutral-bg': mix(c.muted, c.panel, 0.86),
  };
}

const block = (selector, theme, report, indent = '') => {
  const t = tokens(theme, report);
  const lines = Object.entries(t).map(([k, v]) => `--${k}: ${v};`);
  const body = [];
  for (let i = 0; i < lines.length; i += 6) body.push(indent + '  ' + lines.slice(i, i + 6).join(' '));
  return `${indent}${selector} {\n${body.join('\n')}\n${indent}  color-scheme: ${theme.scheme};\n${indent}}`;
};

export function themeCss(report = []) {
  const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));
  return [
    '/* Generated from scripts/themes.mjs by scripts/sync-report.mjs. Edit the themes there. */',
    block(':root', byId.light, []),
    '@media (prefers-color-scheme: dark) {',
    block(':root:not([data-theme])', byId.dark, [], '  '),
    '}',
    ...THEMES.map((t) => block(`:root[data-theme="${t.id}"]`, t, report)),
  ].join('\n');
}
