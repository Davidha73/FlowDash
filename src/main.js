import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { createIconPlaceholder, initIcons } from './modules/icons.js';
import { loadSettings, saveSettings } from './modules/settingsStore.js';
import { initWindowState } from './modules/windowState.js';
import { createSettingsDrawer } from './modules/settingsDrawer.js';

const STARTER_TEMPLATES = [
  {
    app: 'wordflow',
    id: 'letter',
    title: 'Letter',
    desc: 'Formal or personal letter',
    html: '<p><strong>Your Name</strong><br>123 Street Address<br>City, Postcode</p><p>Date</p><p><strong>Recipient Name</strong><br>Company or Organisation<br>Address</p><p>Dear [Name],</p><p>Write the body of your letter here.</p><p>Sincerely,</p><p>Your Name</p>',
  },
  {
    app: 'wordflow',
    id: 'report',
    title: 'Report',
    desc: 'Title, summary & sections',
    html: '<h1>Report Title</h1><p><em>Prepared by [Your Name] • Date</em></p><h2>Executive Summary</h2><p>Summarise the key findings and purpose of this report.</p><h2>Key Details</h2><p>Add your main points, data, or analysis here.</p><h2>Next Steps</h2><ul><li>Action item 1</li><li>Action item 2</li></ul>',
  },
  {
    app: 'wordflow',
    id: 'meeting',
    title: 'Meeting Notes',
    desc: 'Agenda, attendees & actions',
    html: '<h1>Meeting Notes</h1><p><strong>Date:</strong> [Date] &nbsp;|&nbsp; <strong>Attendees:</strong> [Names]</p><h2>Agenda</h2><ul><li>Topic 1</li><li>Topic 2</li></ul><h2>Discussion &amp; Decisions</h2><p>Capture key notes and decisions here.</p><h2>Action Items</h2><ul><li>[Owner] — Task description</li></ul>',
  },
  {
    app: 'boardflow',
    id: 'brainstorm',
    title: 'Brainstorm',
    desc: 'Sticky notes & idea clusters',
    shapes: [
      { id: 't1', type: 'rect', x: 120, y: 100, w: 180, h: 140, fillColor: '#FEF08A', strokeColor: '#EAB308', strokeWidth: 1, cornerRadius: 6, shadow: 'soft', textEnabled: true, label: 'Core Idea' },
      { id: 't2', type: 'rect', x: 340, y: 100, w: 180, h: 140, fillColor: '#BFDBFE', strokeColor: '#3B82F6', strokeWidth: 1, cornerRadius: 6, shadow: 'soft', textEnabled: true, label: 'User Value' },
      { id: 't3', type: 'rect', x: 560, y: 100, w: 180, h: 140, fillColor: '#BBF7D0', strokeColor: '#22C55E', strokeWidth: 1, cornerRadius: 6, shadow: 'soft', textEnabled: true, label: 'Next Steps' },
    ],
  },
  {
    app: 'boardflow',
    id: 'flowchart',
    title: 'Flowchart',
    desc: 'Start, decision & action steps',
    shapes: [
      { id: 'f1', type: 'ellipse', x: 140, y: 120, w: 130, h: 70, fillColor: '#DBEAFE', strokeColor: '#2563EB', strokeWidth: 2, textEnabled: true, label: 'Start' },
      { id: 'f2', type: 'rect', x: 340, y: 120, w: 150, h: 70, fillColor: '#ffffff', strokeColor: '#1a1a1a', strokeWidth: 2, cornerRadius: 8, textEnabled: true, label: 'Process Step' },
      { id: 'f3', type: 'arrow', x1: 270, y1: 155, x2: 340, y2: 155, strokeColor: '#1a1a1a', strokeWidth: 2, startMarker: 'none', endMarker: 'arrow' },
    ],
  },
  {
    app: 'boardflow',
    id: 'retro',
    title: 'Retrospective',
    desc: 'Went well, improve & actions',
    shapes: [
      { id: 'r1', type: 'rect', x: 100, y: 90, w: 200, h: 60, fillColor: '#BBF7D0', strokeColor: '#16A34A', strokeWidth: 1, cornerRadius: 6, textEnabled: true, label: 'What Went Well' },
      { id: 'r2', type: 'rect', x: 330, y: 90, w: 200, h: 60, fillColor: '#FED7AA', strokeColor: '#EA580C', strokeWidth: 1, cornerRadius: 6, textEnabled: true, label: 'To Improve' },
      { id: 'r3', type: 'rect', x: 560, y: 90, w: 200, h: 60, fillColor: '#DDD6FE', strokeColor: '#7C3AED', strokeWidth: 1, cornerRadius: 6, textEnabled: true, label: 'Action Items' },
    ],
  },
];

const SVG_NS = 'http://www.w3.org/2000/svg';

function createBoardTemplatePreviewSvg(shapes) {
  if (!Array.isArray(shapes) || shapes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  shapes.forEach((s) => {
    const sx1 = s.type === 'line' || s.type === 'arrow' ? Math.min(s.x1, s.x2) : s.x;
    const sy1 = s.type === 'line' || s.type === 'arrow' ? Math.min(s.y1, s.y2) : s.y;
    const sx2 = s.type === 'line' || s.type === 'arrow' ? Math.max(s.x1, s.x2) : s.x + (s.w || 40);
    const sy2 = s.type === 'line' || s.type === 'arrow' ? Math.max(s.y1, s.y2) : s.y + (s.h || 40);
    minX = Math.min(minX, sx1);
    minY = Math.min(minY, sy1);
    maxX = Math.max(maxX, sx2);
    maxY = Math.max(maxY, sy2);
  });
  const pad = 28;
  const vbW = Math.max(120, maxX - minX + pad * 2);
  const vbH = Math.max(90, maxY - minY + pad * 2);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${minX - pad} ${minY - pad} ${vbW} ${vbH}`);
  svg.setAttribute('class', 'recent-template-thumb-svg');

  shapes.forEach((s) => {
    if (s.type === 'line' || s.type === 'arrow') {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(s.x1));
      line.setAttribute('y1', String(s.y1));
      line.setAttribute('x2', String(s.x2));
      line.setAttribute('y2', String(s.y2));
      line.setAttribute('stroke', s.strokeColor && s.strokeColor !== 'none' ? s.strokeColor : '#64748b');
      line.setAttribute('stroke-width', String(Math.max(4, s.strokeWidth || 3)));
      svg.appendChild(line);
    } else if (s.type === 'ellipse') {
      const el = document.createElementNS(SVG_NS, 'ellipse');
      el.setAttribute('cx', String(s.x + s.w / 2));
      el.setAttribute('cy', String(s.y + s.h / 2));
      el.setAttribute('rx', String(s.w / 2));
      el.setAttribute('ry', String(s.h / 2));
      el.setAttribute('fill', s.fillColor === 'none' ? 'none' : s.fillColor || '#ffffff');
      el.setAttribute('stroke', s.strokeColor === 'none' ? 'none' : s.strokeColor || '#64748b');
      el.setAttribute('stroke-width', '4');
      svg.appendChild(el);
    } else {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', String(s.x));
      rect.setAttribute('y', String(s.y));
      rect.setAttribute('width', String(s.w || 40));
      rect.setAttribute('height', String(s.h || 40));
      rect.setAttribute('rx', String(s.cornerRadius || 4));
      rect.setAttribute('fill', s.fillColor === 'none' ? 'none' : s.fillColor || '#ffffff');
      rect.setAttribute('stroke', s.strokeColor === 'none' ? 'none' : s.strokeColor || '#64748b');
      rect.setAttribute('stroke-width', '4');
      svg.appendChild(rect);
    }
  });
  return svg;
}

let toastTimerId = 0;
function showToast(msg, durationMs = 2200) {
  const el = document.getElementById('flow-toast');
  if (!el || !msg) return;
  el.textContent = msg;
  el.classList.add('is-visible');
  if (toastTimerId) window.clearTimeout(toastTimerId);
  toastTimerId = window.setTimeout(() => {
    el.classList.remove('is-visible');
    toastTimerId = 0;
  }, durationMs);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSize(bytes) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDirName(filePath) {
  const idx = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return idx > 0 ? filePath.slice(0, idx) : '';
}

async function initApp() {
  document.title = '';
  initIcons();
  const settings = await loadSettings();
  let currentTheme = settings.theme || 'light';
  let currentFilter = settings.defaultFilter || 'all';
  let suiteIndex = { recents: { wordflow: [], boardflow: [] }, templates: { wordflow: [], boardflow: [] } };

  const colorSchemeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');
  const applyTheme = (theme) => {
    currentTheme = theme === 'dark' || theme === 'system' ? theme : 'light';
    const effective =
      currentTheme === 'system' ? (colorSchemeMedia?.matches ? 'dark' : 'light') : currentTheme;
    document.documentElement.dataset.theme = effective;
    const labelEl = document.getElementById('status-theme-label');
    if (labelEl) {
      labelEl.textContent = `Theme: ${currentTheme[0].toUpperCase()}${currentTheme.slice(1)}`;
    }
  };
  applyTheme(currentTheme);
  colorSchemeMedia?.addEventListener('change', () => {
    if (currentTheme === 'system') applyTheme('system');
  });

  initWindowState(settings.window, (windowPatch) => saveSettings({ window: windowPatch }));

  createSettingsDrawer({
    getTheme: () => currentTheme,
    getDefaultFilter: () => currentFilter,
    onThemeChange: applyTheme,
    onDefaultFilterChange: (f) => setFilter(f),
  });

  async function launchTarget(target, actionPayload = null) {
    try {
      const payloadStr = actionPayload
        ? JSON.stringify({ flowSuite: 1, createdAt: new Date().toISOString(), ...actionPayload })
        : null;
      await invoke('launch_flow_app', { target, payload: payloadStr });
      const label = target === 'wordflow' ? 'WordFlow' : target === 'boardflow' ? 'BoardFlow' : 'NoteFlow';
      showToast(`Opening ${label}…`);
      window.setTimeout(refreshRunningApps, 800);
    } catch {
      showToast(`Could not launch ${target}`);
    }
  }

  async function quitTarget(target) {
    try {
      await invoke('quit_flow_app', { target });
      const label = target === 'wordflow' ? 'WordFlow' : target === 'boardflow' ? 'BoardFlow' : 'NoteFlow';
      showToast(`Closing ${label}…`);
      window.setTimeout(refreshRunningApps, 800);
    } catch {
      showToast(`Could not close ${target}`);
    }
  }

  async function refreshRunningApps() {
    try {
      const status = await invoke('get_running_flow_apps');
      ['wordflow', 'boardflow', 'noteflow'].forEach((appKey) => {
        const running = Boolean(status?.[appKey]);
        const cardEl = document.querySelector(`.app-card[data-app="${appKey}"]`);
        cardEl?.classList.toggle('is-running', running);
        const quitBtnEl = document.getElementById(`btn-quit-${appKey}`);
        if (quitBtnEl) {
          quitBtnEl.disabled = !running;
        }
      });
      const runningCount =
        (status?.wordflow ? 1 : 0) + (status?.boardflow ? 1 : 0) + (status?.noteflow ? 1 : 0);
      const summaryEl = document.getElementById('status-suite-summary');
      if (summaryEl) {
        summaryEl.textContent =
          runningCount === 0
            ? 'Flow Suite • All editor apps closed (low memory)'
            : `Flow Suite • ${runningCount} app${runningCount === 1 ? '' : 's'} running`;
      }
    } catch {
      // Ignore outside Tauri
    }
  }

  let filteredRecentsCache = [];
  let filteredTemplatesCache = [];

  function setHoverHighlight(appKey) {
    document.querySelectorAll('.app-card[data-app]').forEach((card) => {
      card.classList.toggle('is-hover-highlight', Boolean(appKey && card.dataset.app === appKey));
    });
  }

  function createRecentRow(doc, onBeforeOpen) {
    const row = document.createElement('div');
    row.className = 'recent-doc-row';
    row.setAttribute('role', 'listitem');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'recent-doc-item';
    btn.title = doc.path;
    btn.addEventListener('click', () => {
      onBeforeOpen?.();
      launchTarget(doc.app, { kind: 'open-file', path: doc.path });
    });

    const info = document.createElement('span');
    info.className = 'recent-doc-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'recent-doc-name';
    nameEl.textContent = doc.name || doc.path;
    const pathEl = document.createElement('span');
    pathEl.className = 'recent-doc-path';
    pathEl.textContent = getDirName(doc.path);
    info.append(nameEl, pathEl);

    const meta = document.createElement('span');
    meta.className = 'recent-doc-meta';
    const modeEl = document.createElement('span');
    modeEl.className = 'recent-doc-mode';
    modeEl.textContent =
      doc.app === 'boardflow'
        ? 'BOARD'
        : doc.app === 'noteflow'
          ? 'NOTE'
          : (doc.mode || 'DOCX').toUpperCase();
    const sizeEl = document.createElement('span');
    sizeEl.textContent = formatSize(doc.size);
    const dateEl = document.createElement('span');
    dateEl.textContent = formatDate(doc.lastOpened || doc.modifiedAt || doc.openedAt);
    meta.append(modeEl, sizeEl, dateEl);

    btn.append(info, meta);

    const finderBtn = document.createElement('button');
    finderBtn.type = 'button';
    finderBtn.className = 'recent-doc-action-btn';
    finderBtn.title = 'Show in Finder';
    finderBtn.appendChild(createIconPlaceholder('folder-search', 'lucide-xs'));
    finderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      invoke('show_in_explorer', { path: doc.path }).catch(() => showToast('File not found on disk'));
    });

    row.append(btn, finderBtn);
    row.addEventListener('mouseenter', () => setHoverHighlight(doc.app));
    row.addEventListener('mouseleave', () => setHoverHighlight(null));
    return row;
  }

  function createTemplateCard(tpl, onBeforeSelect) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'recent-template-card';

    const thumb = document.createElement('div');
    thumb.className = 'recent-template-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    const appMark = document.createElement('span');
    appMark.className = 'brand-mark recent-template-app-mark';
    appMark.textContent = tpl.app === 'boardflow' ? 'B' : 'W';
    thumb.appendChild(appMark);
    if (tpl.app === 'boardflow') {
      const svg = createBoardTemplatePreviewSvg(tpl.shapes);
      if (svg) thumb.appendChild(svg);
      else {
        thumb.classList.add('is-blank');
        thumb.appendChild(createIconPlaceholder('layout-template', 'lucide-md'));
      }
    } else if (tpl.html || tpl.content) {
      const previewDoc = document.createElement('div');
      previewDoc.className = 'recent-template-preview-doc';
      previewDoc.innerHTML = tpl.html || `<pre>${tpl.content}</pre>`;
      thumb.appendChild(previewDoc);
    } else {
      thumb.classList.add('is-blank');
      thumb.appendChild(createIconPlaceholder('file-text', 'lucide-md'));
    }

    const textWrap = document.createElement('span');
    textWrap.className = 'recent-template-text';
    const titleEl = document.createElement('span');
    titleEl.className = 'recent-template-title';
    titleEl.textContent = tpl.title;
    const descEl = document.createElement('span');
    descEl.className = 'recent-template-desc';
    descEl.textContent = tpl.desc || (tpl.app === 'boardflow' ? 'BoardFlow template' : 'WordFlow template');
    textWrap.append(titleEl, descEl);

    card.append(thumb, textWrap);
    card.addEventListener('mouseenter', () => setHoverHighlight(tpl.app));
    card.addEventListener('mouseleave', () => setHoverHighlight(null));
    card.addEventListener('click', () => {
      onBeforeSelect?.();
      launchTarget(tpl.app, { kind: 'new-template', template: tpl });
    });
    return card;
  }

  const allRecentsModalEl = document.getElementById('all-recents-modal');
  const allRecentsBackdropEl = document.getElementById('all-recents-modal-backdrop');
  const allRecentsListEl = document.getElementById('all-recents-list');
  const allTemplatesModalEl = document.getElementById('all-templates-modal');
  const allTemplatesBackdropEl = document.getElementById('all-templates-modal-backdrop');
  const allTemplatesGridEl = document.getElementById('all-templates-grid');

  function setAllRecentsOpen(isOpen) {
    if (!allRecentsModalEl) return;
    if (isOpen && allRecentsListEl) {
      allRecentsListEl.innerHTML = '';
      filteredRecentsCache.forEach((doc) => {
        allRecentsListEl.appendChild(createRecentRow(doc, () => setAllRecentsOpen(false)));
      });
      initIcons(allRecentsListEl);
    }
    allRecentsModalEl.classList.toggle('is-open', isOpen);
    allRecentsBackdropEl?.classList.toggle('is-open', isOpen);
    allRecentsModalEl.setAttribute('aria-hidden', String(!isOpen));
    allRecentsBackdropEl?.setAttribute('aria-hidden', String(!isOpen));
  }

  function setAllTemplatesOpen(isOpen) {
    if (!allTemplatesModalEl) return;
    if (isOpen && allTemplatesGridEl) {
      allTemplatesGridEl.innerHTML = '';
      filteredTemplatesCache.forEach((tpl) => {
        allTemplatesGridEl.appendChild(createTemplateCard(tpl, () => setAllTemplatesOpen(false)));
      });
      initIcons(allTemplatesGridEl);
    }
    allTemplatesModalEl.classList.toggle('is-open', isOpen);
    allTemplatesBackdropEl?.classList.toggle('is-open', isOpen);
    allTemplatesModalEl.setAttribute('aria-hidden', String(!isOpen));
    allTemplatesBackdropEl?.setAttribute('aria-hidden', String(!isOpen));
  }

  document.getElementById('btn-more-recents')?.addEventListener('click', () => setAllRecentsOpen(true));
  document.getElementById('btn-close-all-recents')?.addEventListener('click', () => setAllRecentsOpen(false));
  document.getElementById('btn-done-all-recents')?.addEventListener('click', () => setAllRecentsOpen(false));
  allRecentsBackdropEl?.addEventListener('click', () => setAllRecentsOpen(false));

  document.getElementById('btn-more-templates')?.addEventListener('click', () => setAllTemplatesOpen(true));
  document.getElementById('btn-close-all-templates')?.addEventListener('click', () => setAllTemplatesOpen(false));
  document.getElementById('btn-done-all-templates')?.addEventListener('click', () => setAllTemplatesOpen(false));
  allTemplatesBackdropEl?.addEventListener('click', () => setAllTemplatesOpen(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (allRecentsModalEl?.classList.contains('is-open')) setAllRecentsOpen(false);
      if (allTemplatesModalEl?.classList.contains('is-open')) setAllTemplatesOpen(false);
    }
  });

  function renderSuiteLists() {
    const recentWrapEl = document.getElementById('recent-list-wrap');
    const recentsMoreRowEl = document.getElementById('recents-more-row');
    const recentsMoreBtnEl = document.getElementById('btn-more-recents');
    const countEl = document.getElementById('recent-docs-count');
    const templatesGridEl = document.getElementById('templates-grid');
    const templatesMoreRowEl = document.getElementById('templates-more-row');
    const templatesMoreBtnEl = document.getElementById('btn-more-templates');

    const wfRecents = (suiteIndex.recents?.wordflow || []).map((d) => ({ ...d, app: 'wordflow' }));
    const bfRecents = (suiteIndex.recents?.boardflow || []).map((d) => ({ ...d, app: 'boardflow' }));
    const nfRecents = (suiteIndex.recents?.noteflow || []).map((d) => ({ ...d, app: 'noteflow' }));
    let merged = [...wfRecents, ...bfRecents, ...nfRecents];
    if (currentFilter !== 'all') {
      merged = merged.filter((item) => item.app === currentFilter);
    }
    merged.sort((a, b) => {
      const ta = new Date(a.lastOpened || a.modifiedAt || a.openedAt || 0).getTime() || 0;
      const tb = new Date(b.lastOpened || b.modifiedAt || b.openedAt || 0).getTime() || 0;
      return tb - ta;
    });
    filteredRecentsCache = merged;

    if (countEl) {
      countEl.textContent = `${merged.length} ${merged.length === 1 ? 'item' : 'items'}`;
    }

    if (recentWrapEl) {
      recentWrapEl.innerHTML = '';
      if (merged.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'recent-docs-empty';
        empty.textContent = 'No recent documents or boards yet.';
        recentWrapEl.appendChild(empty);
        if (recentsMoreRowEl) recentsMoreRowEl.hidden = true;
      } else {
        const list = document.createElement('div');
        list.className = 'recent-docs-list';
        list.setAttribute('role', 'list');
        merged.slice(0, 5).forEach((doc) => list.appendChild(createRecentRow(doc)));
        recentWrapEl.appendChild(list);
        if (recentsMoreRowEl && recentsMoreBtnEl) {
          recentsMoreRowEl.hidden = false;
          recentsMoreBtnEl.textContent = merged.length > 5 ? `More… (${merged.length})` : 'More…';
        }
      }
    }

    if (templatesGridEl) {
      templatesGridEl.innerHTML = '';
      const wfCustom = (suiteIndex.templates?.wordflow || []).map((t) => ({ ...t, app: 'wordflow' }));
      const bfCustom = (suiteIndex.templates?.boardflow || []).map((t) => ({ ...t, app: 'boardflow' }));
      let allTemplates = [...STARTER_TEMPLATES, ...wfCustom, ...bfCustom];
      if (currentFilter !== 'all') {
        allTemplates = allTemplates.filter((t) => t.app === currentFilter);
      }
      filteredTemplatesCache = allTemplates;
      allTemplates.slice(0, 4).forEach((tpl) => {
        templatesGridEl.appendChild(createTemplateCard(tpl));
      });
      if (templatesMoreRowEl && templatesMoreBtnEl) {
        templatesMoreRowEl.hidden = allTemplates.length === 0;
        templatesMoreBtnEl.textContent =
          allTemplates.length > 4 ? `More… (${allTemplates.length})` : 'More…';
      }
    }

    const titleEl = document.querySelector('.recent-docs-title');
    if (titleEl) {
      titleEl.textContent =
        currentFilter === 'wordflow'
          ? 'Recent Documents'
          : currentFilter === 'boardflow'
            ? 'Recent Boards'
            : currentFilter === 'noteflow'
              ? 'Recent Notes'
              : 'Recent Work';
    }

    const actionsEl = document.getElementById('recent-docs-actions');
    if (actionsEl) {
      actionsEl.innerHTML = '';
      if (currentFilter === 'wordflow') {
        const newSplitWrap = document.createElement('div');
        newSplitWrap.className = 'recent-new-split';

        const newDocBtn = document.createElement('button');
        newDocBtn.type = 'button';
        newDocBtn.className = 'recent-docs-action-btn is-primary recent-new-split-main';
        newDocBtn.textContent = 'New Document';
        newDocBtn.addEventListener('click', () => launchTarget('wordflow', { kind: 'new-document' }));

        const newToggleBtn = document.createElement('button');
        newToggleBtn.type = 'button';
        newToggleBtn.className = 'recent-docs-action-btn is-primary recent-new-split-toggle';
        newToggleBtn.title = 'Choose document mode';
        newToggleBtn.setAttribute('aria-label', 'Choose document mode');
        newToggleBtn.setAttribute('aria-haspopup', 'menu');
        newToggleBtn.setAttribute('aria-expanded', 'false');
        newToggleBtn.appendChild(createIconPlaceholder('chevron-down', 'lucide-xs'));

        const newModePopover = document.createElement('div');
        newModePopover.className = 'recent-new-popover';
        newModePopover.setAttribute('role', 'menu');
        newModePopover.setAttribute('aria-label', 'New document mode');

        [
          { mode: 'docx', label: '.docx (Word)' },
          { mode: 'md', label: '.md (Markdown)' },
          { mode: 'html', label: '.html (HTML)' },
          { mode: 'txt', label: '.txt (Plain Text)' },
        ].forEach(({ mode, label }) => {
          const modeItem = document.createElement('button');
          modeItem.type = 'button';
          modeItem.className = 'recent-new-menu-item';
          modeItem.setAttribute('role', 'menuitem');
          modeItem.textContent = label;
          modeItem.addEventListener('click', () => {
            newModePopover.classList.remove('is-open');
            newToggleBtn.setAttribute('aria-expanded', 'false');
            launchTarget('wordflow', { kind: 'new-document', mode });
          });
          newModePopover.appendChild(modeItem);
        });

        newToggleBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          const willOpen = !newModePopover.classList.contains('is-open');
          newModePopover.classList.toggle('is-open', willOpen);
          newToggleBtn.setAttribute('aria-expanded', String(willOpen));
        });

        newSplitWrap.append(newDocBtn, newToggleBtn, newModePopover);
        actionsEl.appendChild(newSplitWrap);
      }
      if (currentFilter === 'boardflow') {
        const newBoardBtn = document.createElement('button');
        newBoardBtn.type = 'button';
        newBoardBtn.className = 'recent-docs-action-btn is-primary';
        newBoardBtn.textContent = 'New Board';
        newBoardBtn.addEventListener('click', () => launchTarget('boardflow', { kind: 'new-document' }));
        actionsEl.appendChild(newBoardBtn);
      }
      if (currentFilter === 'noteflow') {
        const newNoteBtn = document.createElement('button');
        newNoteBtn.type = 'button';
        newNoteBtn.className = 'recent-docs-action-btn is-primary';
        newNoteBtn.textContent = 'New Note';
        newNoteBtn.addEventListener('click', () => launchTarget('noteflow', { kind: 'new-document' }));
        actionsEl.appendChild(newNoteBtn);
      }
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'recent-docs-action-btn';
      openBtn.textContent = currentFilter === 'boardflow' ? 'Open Board…' : 'Open File…';
      openBtn.addEventListener('click', () => {
        if (currentFilter === 'wordflow') {
          pickAndOpen([{ name: 'Documents', extensions: ['docx', 'md', 'html', 'htm', 'txt'] }], 'wordflow');
        } else if (currentFilter === 'boardflow') {
          pickAndOpen([{ name: 'BoardFlow Board', extensions: ['board', 'json'] }], 'boardflow');
        } else {
          pickAndOpen([{ name: 'Flow Suite Files', extensions: ['docx', 'md', 'html', 'htm', 'txt', 'board'] }]);
        }
      });
      actionsEl.appendChild(openBtn);
    }

    initIcons();
  }

  async function refreshIndex() {
    try {
      const raw = await invoke('read_flow_suite_index');
      if (raw) suiteIndex = JSON.parse(raw);
    } catch {
      // Ignore outside Tauri
    }
    renderSuiteLists();
    await refreshRunningApps();
  }

  function setFilter(nextFilter) {
    currentFilter = nextFilter;
    document.querySelectorAll('.pill-filter-btn').forEach((btn) => {
      const active = btn.dataset.filter === currentFilter;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.app-card[data-app]').forEach((card) => {
      const selected = card.dataset.app === currentFilter;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    const allBtn = document.getElementById('btn-filter-all');
    if (allBtn) {
      allBtn.classList.toggle('is-active', currentFilter === 'all');
    }
    renderSuiteLists();
  }

  document.getElementById('btn-filter-all')?.addEventListener('click', () => setFilter('all'));

  document.querySelector('.dash-workspace')?.addEventListener('click', (e) => {
    if (currentFilter === 'all') return;
    if (
      e.target.closest(
        '.app-card, button, a, input, select, .recent-doc-row, .recent-template-card, .recent-new-split'
      )
    ) {
      return;
    }
    setFilter('all');
  });

  document.querySelectorAll('.pill-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter || 'all'));
  });

  document.querySelectorAll('.app-card[data-app]').forEach((card) => {
    const toggle = () => {
      const appKey = card.dataset.app;
      setFilter(currentFilter === appKey ? 'all' : appKey);
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  function closeAppCardMenus() {
    document.querySelectorAll('.app-card-menu-popover.is-open').forEach((p) => p.classList.remove('is-open'));
    document.querySelectorAll('.app-card-menu-btn[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }

  document.querySelectorAll('.app-card-menu-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrap = btn.closest('.app-card-menu-wrap');
      const popover = wrap?.querySelector('.app-card-menu-popover');
      const willOpen = !popover?.classList.contains('is-open');
      closeAppCardMenus();
      if (willOpen && popover) {
        popover.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.querySelectorAll('[data-app-switch]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = btn.dataset.appSwitch;
      if (target) launchTarget(target);
    });
  });

  document.getElementById('btn-refresh')?.addEventListener('click', refreshIndex);
  document.getElementById('btn-quit-wordflow')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAppCardMenus();
    quitTarget('wordflow');
  });
  document.getElementById('btn-quit-boardflow')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAppCardMenus();
    quitTarget('boardflow');
  });
  document.getElementById('btn-quit-noteflow')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAppCardMenus();
    quitTarget('noteflow');
  });

  async function pickAndOpen(filters, forcedApp = null) {
    const selected = await open({ multiple: false, filters });
    if (!selected) return;
    const path = typeof selected === 'string' ? selected : selected.path;
    if (!path) return;
    const isBoard = forcedApp === 'boardflow' || /\.board$/i.test(path);
    launchTarget(isBoard ? 'boardflow' : 'wordflow', { kind: 'open-file', path });
  }

  document.getElementById('btn-open-any')?.addEventListener('click', () =>
    pickAndOpen([{ name: 'Flow Suite Files', extensions: ['docx', 'md', 'html', 'htm', 'txt', 'board'] }])
  );

  document.addEventListener('mousedown', (event) => {
    if (!event.target.closest('.recent-new-split')) {
      document.querySelectorAll('.recent-new-popover.is-open').forEach((p) => p.classList.remove('is-open'));
      document.querySelectorAll('.recent-new-split-toggle[aria-expanded="true"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    }
    if (!event.target.closest('.app-card-menu-wrap')) {
      closeAppCardMenus();
    }
  });

  const firedReminderKeys = new Set();

  function formatLocalDateTimeInput(ts) {
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function removeReminderBanner(noteId) {
    const stack = document.getElementById('reminder-banner-stack');
    if (!stack) return;
    stack.querySelectorAll(`.reminder-banner[data-note-id="${noteId}"]`).forEach((el) => el.remove());
    if (stack.children.length === 0) {
      stack.hidden = true;
    }
  }

  function showReminderBanner(note) {
    const stack = document.getElementById('reminder-banner-stack');
    if (!stack || !note?.id) return;
    removeReminderBanner(note.id);

    const title = note.title?.trim() || 'Untitled Note';
    const banner = document.createElement('div');
    banner.className = 'reminder-banner';
    banner.dataset.noteId = note.id;

    const info = document.createElement('div');
    info.className = 'reminder-banner-info';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'reminder-banner-icon';
    iconWrap.appendChild(createIconPlaceholder('bell', 'lucide-xs'));

    const textWrap = document.createElement('div');
    textWrap.className = 'reminder-banner-text';

    const titleEl = document.createElement('span');
    titleEl.className = 'reminder-banner-title';
    titleEl.textContent = `NoteFlow Reminder: ${title}`;

    const timeEl = document.createElement('span');
    timeEl.className = 'reminder-banner-time';
    timeEl.textContent = `Scheduled for ${formatDate(note.reminderAt)}`;

    textWrap.append(titleEl, timeEl);
    info.append(iconWrap, textWrap);

    const actions = document.createElement('div');
    actions.className = 'reminder-banner-actions';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'reminder-banner-btn is-primary';
    openBtn.textContent = 'Open Note';
    openBtn.addEventListener('click', () => {
      removeReminderBanner(note.id);
      launchTarget('noteflow', { kind: 'open-file', path: `noteflow://${note.id}` });
    });

    const snoozeBtn = document.createElement('button');
    snoozeBtn.type = 'button';
    snoozeBtn.className = 'reminder-banner-btn';
    snoozeBtn.textContent = 'Snooze 10m';
    snoozeBtn.addEventListener('click', async () => {
      removeReminderBanner(note.id);
      const nextReminder = formatLocalDateTimeInput(Date.now() + 10 * 60 * 1000);
      try {
        await invoke('update_noteflow_reminder', {
          id: note.id,
          reminderAt: nextReminder,
          reminderFiredFor: null,
        });
        showToast('Reminder snoozed for 10 minutes');
      } catch {
        showToast('Could not snooze reminder');
      }
    });

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'reminder-banner-dismiss';
    dismissBtn.title = 'Dismiss reminder';
    dismissBtn.setAttribute('aria-label', 'Dismiss reminder');
    dismissBtn.appendChild(createIconPlaceholder('x', 'lucide-xs'));
    dismissBtn.addEventListener('click', () => removeReminderBanner(note.id));

    actions.append(openBtn, snoozeBtn, dismissBtn);
    banner.append(info, actions);
    stack.appendChild(banner);
    stack.hidden = false;
    initIcons(banner);
  }

  async function checkNoteFlowReminders() {
    try {
      const rawList = await invoke('list_noteflow_notes');
      const now = Date.now();
      for (const raw of rawList || []) {
        let note;
        try {
          note = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!note?.id || !note.reminderAt) continue;
        const dueMs = new Date(note.reminderAt).getTime();
        if (Number.isNaN(dueMs) || dueMs > now) continue;

        const key = `${note.id}::${note.reminderAt}`;
        if (note.reminderFiredFor === note.reminderAt || firedReminderKeys.has(key)) {
          continue;
        }

        firedReminderKeys.add(key);
        showReminderBanner(note);

        const title = note.title?.trim() || 'Untitled Note';
        invoke('send_system_notification', {
          title: 'NoteFlow Reminder',
          body: title,
        }).catch(() => {});

        invoke('update_noteflow_reminder', {
          id: note.id,
          reminderAt: note.reminderAt,
          reminderFiredFor: note.reminderAt,
        }).catch(() => {});
      }
    } catch {
      // Ignore outside Tauri
    }
  }

  setFilter(currentFilter);
  await refreshIndex();
  await checkNoteFlowReminders();

  window.addEventListener('focus', () => {
    refreshIndex();
    checkNoteFlowReminders();
  });
  window.setInterval(() => {
    if (document.hasFocus()) refreshRunningApps();
  }, 4000);
  window.setInterval(checkNoteFlowReminders, 15000);
}

document.addEventListener('DOMContentLoaded', initApp);
