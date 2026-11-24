// Generates the files the site serves from sources that stay hand-edited:
//  - public/themes.css, public/theme-list.js, and the themes block inside
//    public/report-template.html, from scripts/themes.mjs
//  - public/report.html and public/report.js from public/report-template.html
//  - the copies of base.css, shared.js and i18n.js that the template carries
// The template stays the single source for the report: it is also what "Save report"
// downloads, with the data filled in. The site's pages can't run inline scripts (see the
// Content-Security-Policy in src/worker.js), so the script moves to its own file.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { THEMES, themeCss, tokens } from './themes.mjs';

const dir = new URL('../public/', import.meta.url);
const NOTE = 'Generated from report-template.html by scripts/sync.mjs. Do not edit.';

// ---- themes ----
const adjusted = [];
const css = themeCss(adjusted);
writeFileSync(new URL('themes.css', dir), css + '\n');
// the picker shows each theme's own colors as a swatch
const swatches = THEMES.map((t) => {
  const k = tokens(t);
  return { id: t.id, name: t.name, scheme: t.scheme, bg: k.bg, panel: k.panel, fg: k.fg, line: k.line, accent: k.accent };
});
writeFileSync(new URL('theme-list.js', dir),
  `// Generated from scripts/themes.mjs by scripts/sync.mjs. Do not edit.\nwindow.TLV_THEMES = ${JSON.stringify(swatches)};\n`);
const templatePath = new URL('report-template.html', dir);
let template = readFileSync(templatePath, 'utf8');
// The template carries its own copies of the themes, base.css and shared.js, so a saved
// report works offline. Each copy sits between BEGIN/END markers and is refreshed here.
const fill = (text, name, body) => {
  const re = new RegExp(`/\\* ${name}:BEGIN \\*/[\\s\\S]*?/\\* ${name}:END \\*/`);
  if (!re.test(text)) throw new Error(`report-template.html has no ${name}:BEGIN/END markers`);
  return text.replace(re, () => `/* ${name}:BEGIN */\n${body.trim()}\n/* ${name}:END */`);
};
let filled = fill(template, 'THEMES', css);
filled = fill(filled, 'BASE', readFileSync(new URL('base.css', dir), 'utf8'));
filled = fill(filled, 'SHARED', readFileSync(new URL('shared.js', dir), 'utf8'));
filled = fill(filled, 'I18N', readFileSync(new URL('i18n.js', dir), 'utf8'));
if (filled !== template) writeFileSync(templatePath, (template = filled));
for (const line of adjusted) console.log(`  made legible: ${line}`);

// ---- report page ----
const main = template.match(/<script>([\s\S]*?)<\/script>/);
if (!main) throw new Error('report-template.html has no inline <script>');
const dataTag = '<script id="data" type="application/json">__DATA__</script>';
if (!template.includes(dataTag)) throw new Error('report-template.html has no data placeholder');

const ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 21h-7a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v3"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h12.5"/><path d="M21 15h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3h-2.5"/><path d="M19 21v1m0 -8v1"/></svg>';
// Small line icons for the toolbar's buttons; each button's name is its title and aria-label.
const svg = (body, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const I = {
  refresh: svg('<path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>'),
  eye: svg('<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6"/>', 'i-shown'),
  eyeOff: svg('<path d="M10.585 10.587a2 2 0 0 0 2.829 2.828"/><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87"/><path d="M3 3l18 18"/>', 'i-hidden'),
  save: svg('<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/>'),
  trash: svg('<path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>'),
};
// The toolbar shared by the result pages, on one line on a laptop screen; `page` marks the current tab.
const toolbar = (page) => `<nav class="webbar" aria-label="Results">
  <div class="wb-left">
    <a class="wb-brand" href="./?new" title="Q portfolio">${ICON}<span class="wb-name">Q portfolio</span></a>
    <div class="wb-tabs">
      <a class="wb-tab" href="performance"${page === 'perf' ? ' aria-current="page"' : ''}>Performance</a>
      <a class="wb-tab" href="report"${page === 'sell' ? ' aria-current="page"' : ''}>Sell check</a>
    </div>
  </div>
  <div class="wb-actions">
    <a class="wb-btn primary" href="./?new" title="Upload new file">New file</a>
    <button class="wb-btn icon" id="wb-refresh" type="button" title="Refresh prices" aria-label="Refresh prices">${I.refresh}</button>
    <label class="wb-auto" title="Updates run while the US market is open (9:30 AM to 4:00 PM New York time), plus once after the close, and pause while this tab is hidden.">${I.clock}
      <select id="wb-auto" aria-label="Update prices automatically">
        <option value="0">Manual</option>
        <option value="5">5 min</option>
        <option value="15">15 min</option>
        <option value="30">30 min</option>
        <option value="60">1 hour</option>
      </select>
    </label>
    <button class="wb-btn icon" id="wb-hide" type="button" aria-pressed="false" aria-label="Hide amounts" title="Hide amounts, leaving percentages, so you can share a screenshot">${I.eye}${I.eyeOff}</button>
${page === 'sell' ? `    <button class="wb-btn icon" id="wb-save" type="button" title="Save report" aria-label="Save report">${I.save}</button>\n` : ''}    <button class="wb-btn icon" id="wb-forget" type="button" title="Forget this result" aria-label="Forget this result">${I.trash}<span class="wb-confirm"></span></button>
    <div class="lang-switch"></div>
    <div class="wb-theme"><span class="tp-label vh">Theme</span><div class="theme-picker"></div></div>
  </div>
  <p class="wb-status" id="wb-status" role="status"></p>
</nav>
`;

const html = template
  .replace('<!doctype html>', `<!doctype html>\n<!-- ${NOTE} -->`)
  .replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, '\n<meta name="referrer" content="no-referrer">\n<link rel="icon" href="favicon.svg" type="image/svg+xml">')
  .replace('<title>', '<script src="theme-boot.js"></script>\n<title>')
  .replace('</head>', '<link rel="stylesheet" href="picker.css">\n<link rel="stylesheet" href="web.css">\n</head>')
  .replace('<body>\n', `<body>\n${toolbar('sell')}`)
  .replace(/\s*<div class="lang-switch standalone"><\/div>/, '')   // the toolbar has one
  .replace(dataTag, '<script id="data" type="application/json"></script>')
  .replace(main[0], [
    '<script src="i18n.js"></script>',
    '<script src="theme-list.js"></script>',
    '<script src="web.js"></script>',
    '<script src="shared.js"></script>',
    '<script src="lots.js"></script>',
    '<script src="prices.js"></script>',
    '<script src="market.js"></script>',
    '<script src="toolbar.js"></script>',
    '<script src="report-boot.js"></script>',
  ].join('\n'));
if (!html.includes('class="webbar"') || !html.includes('web.css')) throw new Error('report.html: toolbar not inserted');
if (html.includes('lang-switch standalone')) throw new Error('report.html: the saved report\'s language switch was not removed');

writeFileSync(new URL('report.html', dir), html);

// ---- performance page: same toolbar, between its markers ----
const perfPath = new URL('performance.html', dir);
const perf = readFileSync(perfPath, 'utf8');
const withBar = perf.replace(/<!-- TOOLBAR:BEGIN[^>]*-->[\s\S]*?<!-- TOOLBAR:END -->/, `<!-- TOOLBAR:BEGIN (generated by scripts/sync.mjs) -->\n${toolbar('perf')}<!-- TOOLBAR:END -->`);
if (!/<!-- TOOLBAR:BEGIN[^>]*-->/.test(perf)) throw new Error('performance.html has no TOOLBAR:BEGIN/END markers');
if (withBar !== perf) writeFileSync(perfPath, withBar);
// on the site, report.html loads shared.js and i18n.js itself, so report.js drops the template's copies
const reportJs = main[1]
  .replace(/\/\* SHARED:BEGIN \*\/[\s\S]*?\/\* SHARED:END \*\/\n?/, '')
  .replace(/\/\* I18N:BEGIN \*\/[\s\S]*?\/\* I18N:END \*\/\n?/, '');
writeFileSync(new URL('report.js', dir), `// ${NOTE}\n${reportJs.trimStart()}`);
// ---- versioned file references ----
// Each page names its own files with ?v=<fingerprint of the file>, so after a deploy a
// browser never mixes a new page with an old script or stylesheet.
const version = (name) => createHash('sha256').update(readFileSync(new URL(name, dir))).digest('hex').slice(0, 10);
const versioned = (html) => html.replace(/(<script src="|<link rel="stylesheet" href=")([a-z0-9-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"/g,
  (_, before, name) => `${before}${name}?v=${version(name)}"`);
// report-boot.js loads report.js after the page opens: stamp that reference first
const bootPath = new URL('report-boot.js', dir);
const boot = readFileSync(bootPath, 'utf8');
const bootStamped = boot.replace(/s\.src = 'report\.js(?:\?v=[0-9a-f]+)?';/, `s.src = 'report.js?v=${version('report.js')}';`);
if (!bootStamped.includes('report.js?v=')) throw new Error('report-boot.js: report.js reference not found');
if (bootStamped !== boot) writeFileSync(bootPath, bootStamped);
for (const page of ['index.html', 'performance.html', 'report.html']) {
  const path = new URL(page, dir);
  const before = readFileSync(path, 'utf8'), after = versioned(before);
  if (after !== before) writeFileSync(path, after);
}

console.log('wrote public/themes.css, theme-list.js, report.html, report.js and the performance toolbar');
