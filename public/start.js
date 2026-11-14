'use strict';
(() => {
  const MAX_BYTES = 25 * 1024 * 1024;
  const fresh = new URLSearchParams(location.search).has('new');

  // A saved result opens straight away; "Upload new file" comes here with ?new.
  if (!fresh && window.TLV.hasResult()) {
    location.replace('performance');
    return;
  }
  document.getElementById('back').hidden = !window.TLV.hasResult();

  const panel = document.getElementById('panel');
  const input = document.getElementById('file');
  const workText = document.getElementById('work-text');
  const workSub = document.getElementById('work-sub');
  const bar = document.getElementById('bar');
  const barFill = document.getElementById('bar-fill');
  const errText = document.getElementById('err-text');

  const setState = (s) => { panel.dataset.state = s; };
  const fail = (message) => { errText.textContent = message; setState('error'); };
  const progress = (p) => { barFill.style.width = p + '%'; bar.setAttribute('aria-valuenow', String(Math.round(p))); };

  function onProgress(s) {
    if (s.step !== 'prices') return;
    workText.textContent = s.done < s.total ? `Getting prices · ${s.done + 1} of ${s.total}` : 'Building your report…';
    workSub.textContent = s.ticker ? `Prices and history for ${s.ticker}` : 'Almost done.';
    progress(10 + 88 * (s.done / Math.max(1, s.total)));
  }

  async function open(file) {
    if (panel.dataset.state === 'working') return;
    if (!/\.(qfx|ofx)$/i.test(file.name)) return fail(`“${file.name}” isn't a Quicken export. Choose a file ending in .qfx or .ofx.`);
    if (file.size > MAX_BYTES) return fail('That file is larger than 25 MB, which is too big for a Quicken export.');
    setState('working');
    workText.textContent = 'Reading your file…';
    workSub.textContent = 'Rebuilding every purchase from your export.';
    progress(6);
    try {
      // read here, in the browser; the file itself is never sent anywhere
      const text = new TextDecoder('latin1').decode(await file.arrayBuffer());
      const data = await window.Lots.buildData(text, { method: 'FIFO', fetchQuote: window.Prices.fetchQuote, fetchSeries: window.Prices.fetchSeries, onProgress });
      try { localStorage.setItem('tlv-last-update', String(Date.now())); } catch {}
      if (!window.TLV.saveResult(data)) throw new Error("This browser doesn't allow sites to keep data, so the report can't be shown. Try a normal (not private) window.");
      location.assign('performance');
    } catch (err) {
      fail(String(err?.message || err));
    }
  }

  const choose = () => { input.value = ''; input.click(); };
  document.getElementById('drop').addEventListener('click', choose);
  document.getElementById('retry').addEventListener('click', () => { setState('idle'); choose(); });
  input.addEventListener('change', () => { if (input.files[0]) open(input.files[0]); });

  // drag feedback: count enter/leave so child elements don't flicker the state
  let depth = 0;
  const hasFile = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  addEventListener('dragenter', (e) => {
    if (!hasFile(e) || panel.dataset.state === 'working') return;
    e.preventDefault(); depth++; setState('over');
  });
  addEventListener('dragover', (e) => {
    if (!hasFile(e)) return;
    e.preventDefault(); e.dataTransfer.dropEffect = panel.dataset.state === 'working' ? 'none' : 'copy';
  });
  addEventListener('dragleave', () => {
    if (panel.dataset.state !== 'over') return;
    depth = Math.max(0, depth - 1); if (!depth) setState('idle');
  });
  addEventListener('drop', (e) => {
    e.preventDefault(); depth = 0;
    if (panel.dataset.state === 'working') return;
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return setState('idle');
    if (files.length > 1) return fail('Drop one file at a time.');
    open(files[0]);
  });
})();
