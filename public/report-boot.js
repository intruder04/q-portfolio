'use strict';
// Shows the result saved in this browser, then runs the report script.
// (The toolbar's buttons are in toolbar.js.)
(() => {
  const data = window.TLV.loadResult();
  if (!data) return location.replace('./?new');

  document.getElementById('data').textContent = JSON.stringify(data);
  const s = document.createElement('script');
  s.src = 'report.js?v=999d2e7a5c';
  document.body.appendChild(s);
})();
