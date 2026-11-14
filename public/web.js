'use strict';
// Shared by both pages: the theme picker and the saved result.
// Everything is kept in this browser's own storage and never sent anywhere.
(() => {
  const RESULT = 'tlv-result', THEME = 'tlv-theme';
  const read = (key) => {
    for (const s of ['localStorage', 'sessionStorage']) {
      try { const v = window[s].getItem(key); if (v != null) return v; } catch {}
    }
    return null;
  };
  // falls back to this tab only when the browser blocks lasting storage (some private windows)
  const write = (key, value) => {
    try { localStorage.setItem(key, value); return true; } catch {}
    // lasting storage is blocked or full: drop its older copy, so it isn't read back instead
    try { localStorage.removeItem(key); } catch {}
    try { sessionStorage.setItem(key, value); return true; } catch {}
    return false;
  };
  const remove = (key) => {
    for (const s of ['localStorage', 'sessionStorage']) { try { window[s].removeItem(key); } catch {} }
  };

  // ---------- theme picker ----------
  // A custom list instead of a <select>, so each option can show its theme's colors.
  // Moving through the list previews the theme on the page; Esc or clicking away undoes it.

  const THEMES = window.TLV_THEMES || [];
  const byId = Object.fromEntries(THEMES.map((t) => [t.id, t]));
  const OPTIONS = [
    { id: 'system', name: 'System', hint: 'Follows your device' },
    ...THEMES.filter((t) => t.id === 'light' || t.id === 'dark'),
    { group: 'Popular themes' },
    ...THEMES.filter((t) => t.id !== 'light' && t.id !== 'dark'),
  ];
  let current = byId[read(THEME)] ? read(THEME) : 'system';

  function applyTheme(t) {
    if (!t || t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    window.dispatchEvent(new Event('tlv-theme')); // charts that compute colors redraw
  }

  // A small picture of the theme: its background, a card, an accent dot and a line of text.
  function swatch(id) {
    const el = document.createElement('span');
    el.className = 'tp-sw';
    el.setAttribute('aria-hidden', 'true');
    const card = document.createElement('i');
    const dot = document.createElement('b');
    const text = document.createElement('u');
    card.append(dot, text);
    el.append(card);
    if (id === 'system') {
      const l = byId.light, d = byId.dark;
      el.style.background = `linear-gradient(135deg, ${l.bg} 50%, ${d.bg} 50%)`;
      el.style.borderColor = l.line;
      card.style.background = `linear-gradient(135deg, ${l.panel} 50%, ${d.panel} 50%)`;
      dot.style.background = l.accent;
      text.style.background = `linear-gradient(90deg, ${l.fg} 50%, ${d.fg} 50%)`;
    } else {
      const t = byId[id];
      el.style.background = t.bg;
      el.style.borderColor = t.line;
      card.style.background = t.panel;
      dot.style.background = t.accent;
      text.style.background = t.fg;
    }
    return el;
  }

  const nameOf = (id) => OPTIONS.find((o) => o.id === id)?.name || 'System';
  const pickers = [];

  function buildPicker(host, n) {
    const label = host.parentElement.querySelector('.tp-label');
    if (label) label.id = `tp-label-${n}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tp-button';
    button.id = `tp-button-${n}`;
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    if (label) button.setAttribute('aria-labelledby', `${label.id} ${button.id}`);
    const shown = document.createElement('span');
    shown.className = 'tp-name';
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 12 12');
    chevron.setAttribute('aria-hidden', 'true');
    chevron.classList.add('tp-chevron');
    chevron.innerHTML = '<path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>';

    const list = document.createElement('ul');
    list.className = 'tp-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Theme');
    list.tabIndex = -1;
    list.hidden = true;

    const items = [];
    for (const o of OPTIONS) {
      const li = document.createElement('li');
      if (o.group) {
        li.className = 'tp-group';
        li.setAttribute('role', 'presentation');
        li.textContent = o.group;
      } else {
        li.className = 'tp-option';
        li.id = `tp-${n}-${o.id}`;
        li.setAttribute('role', 'option');
        li.dataset.id = o.id;
        const name = document.createElement('span');
        name.className = 'tp-option-name';
        name.textContent = o.name;
        if (o.hint) {
          const hint = document.createElement('small');
          hint.textContent = o.hint;
          name.append(hint);
        }
        const check = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        check.setAttribute('viewBox', '0 0 16 16');
        check.setAttribute('aria-hidden', 'true');
        check.classList.add('tp-check');
        check.innerHTML = '<path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
        li.append(swatch(o.id), name, check);
        items.push(li);
      }
      list.append(li);
    }

    button.append(document.createElement('span'), shown, chevron);
    host.append(button, list);

    let active = -1;
    const isOpen = () => !list.hidden;

    function showCurrent() {
      button.firstChild.replaceWith(swatch(current));
      shown.textContent = nameOf(current);
      for (const li of items) li.setAttribute('aria-selected', String(li.dataset.id === current));
    }

    function highlight(i, scroll = true) {
      active = Math.max(0, Math.min(items.length - 1, i));
      items.forEach((li, k) => li.classList.toggle('active', k === active));
      list.setAttribute('aria-activedescendant', items[active].id);
      if (scroll) items[active].scrollIntoView({ block: 'nearest' });
      applyTheme(items[active].dataset.id); // live preview
    }

    function open() {
      for (const p of pickers) if (p !== api && p.isOpen()) p.close(false);
      list.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      highlight(items.findIndex((li) => li.dataset.id === current));
      list.focus();
    }

    function close(keep, focusButton = true) {
      if (!isOpen()) return;
      list.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      list.removeAttribute('aria-activedescendant');
      if (keep && active >= 0) choose(items[active].dataset.id);
      else applyTheme(current); // undo the preview
      if (focusButton) button.focus();
    }

    button.addEventListener('click', () => (isOpen() ? close(false) : open()));
    button.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); open(); }
    });

    let typed = '', typedAt = 0;
    list.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
      else if (e.key === 'Home') { e.preventDefault(); highlight(0); }
      else if (e.key === 'End') { e.preventDefault(); highlight(items.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); close(true); }
      else if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Tab') { close(false, false); }
      else if (e.key.length === 1 && /\S/.test(e.key)) {
        // type the start of a name to jump to it
        typed = (Date.now() - typedAt > 700 ? '' : typed) + e.key.toLowerCase();
        typedAt = Date.now();
        const i = items.findIndex((li) => li.textContent.toLowerCase().startsWith(typed));
        if (i >= 0) highlight(i);
      }
    });
    list.addEventListener('mousemove', (e) => {
      const li = e.target.closest('.tp-option');
      if (li) { const i = items.indexOf(li); if (i !== active) highlight(i, false); }
    });
    list.addEventListener('click', (e) => {
      const li = e.target.closest('.tp-option');
      if (li) { highlight(items.indexOf(li), false); close(true); }
    });
    document.addEventListener('pointerdown', (e) => {
      if (isOpen() && !host.contains(e.target)) close(false, false);
    });

    const api = { isOpen, close, showCurrent };
    showCurrent();
    return api;
  }

  function choose(id) {
    current = id;
    write(THEME, id);
    applyTheme(id);
    for (const p of pickers) p.showCurrent();
  }

  document.querySelectorAll('.theme-picker').forEach((host, n) => pickers.push(buildPicker(host, n)));

  window.TLV = {
    saveResult: (data) => write(RESULT, JSON.stringify(data)),
    loadResult: () => { try { return JSON.parse(read(RESULT) || 'null'); } catch { return null; } },
    hasResult: () => read(RESULT) != null,
    forgetResult: () => remove(RESULT),
    theme: () => document.documentElement.getAttribute('data-theme'),
  };
})();
