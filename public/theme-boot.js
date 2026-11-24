'use strict';
// Runs before the page draws, so it opens in the chosen theme without a flash.
try {
  const t = localStorage.getItem('tlv-theme');
  if (t && t !== 'system' && /^[a-z-]+$/.test(t)) document.documentElement.setAttribute('data-theme', t);
} catch {}
// In Russian, the page stays hidden until i18n.js has translated it, so English doesn't
// flash first; shown after a moment regardless, in case that script never runs.
try {
  let l = null;
  try { l = localStorage.getItem('tlv-lang'); } catch {}
  if (l === 'ru' || (!l && /^ru\b/i.test(navigator.language || ''))) {
    const s = document.documentElement.style;
    s.visibility = 'hidden';
    setTimeout(() => { s.visibility = ''; }, 1500);
  }
} catch {}
