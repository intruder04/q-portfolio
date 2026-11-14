'use strict';
// Runs before the page draws, so it opens in the chosen theme without a flash.
try {
  const t = localStorage.getItem('tlv-theme');
  if (t && t !== 'system' && /^[a-z-]+$/.test(t)) document.documentElement.setAttribute('data-theme', t);
} catch {}
