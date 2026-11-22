import { getVersion } from '@tauri-apps/api/app';
import { saveSettings } from './settingsStore.js';

export function createSettingsDrawer({
  getTheme,
  getDefaultFilter,
  onThemeChange,
  onDefaultFilterChange,
} = {}) {
  const triggerEl = document.getElementById('btn-settings');
  const closeEl = document.getElementById('btn-close-settings');
  const cancelEl = document.getElementById('btn-cancel-settings');
  const saveEl = document.getElementById('btn-save-settings');
  const drawerEl = document.getElementById('settings-drawer');
  const backdropEl = document.getElementById('settings-backdrop');
  const themeSelectEl = document.getElementById('settings-theme');
  const filterSelectEl = document.getElementById('settings-default-filter');
  const versionEl = document.getElementById('settings-version');

  if (versionEl) {
    getVersion()
      .then((ver) => {
        if (ver) versionEl.textContent = `v${ver}`;
      })
      .catch(() => {});
  }

  function syncValues() {
    if (themeSelectEl && getTheme) {
      themeSelectEl.value = getTheme() || 'light';
    }
    if (filterSelectEl && getDefaultFilter) {
      filterSelectEl.value = getDefaultFilter() || 'all';
    }
  }

  function setOpen(isOpen) {
    if (!drawerEl || !backdropEl) return;
    if (isOpen) syncValues();
    drawerEl.classList.toggle('is-open', isOpen);
    backdropEl.classList.toggle('is-open', isOpen);
    drawerEl.setAttribute('aria-hidden', String(!isOpen));
    backdropEl.setAttribute('aria-hidden', String(!isOpen));
    triggerEl?.setAttribute('aria-expanded', String(isOpen));
  }

  async function commitSettings() {
    const patch = {};
    if (themeSelectEl) patch.theme = themeSelectEl.value;
    if (filterSelectEl) patch.defaultFilter = filterSelectEl.value;
    await saveSettings(patch);
    if (patch.theme) onThemeChange?.(patch.theme);
    if (patch.defaultFilter) onDefaultFilterChange?.(patch.defaultFilter);
    setOpen(false);
  }

  triggerEl?.addEventListener('click', () => setOpen(!drawerEl?.classList.contains('is-open')));
  closeEl?.addEventListener('click', () => setOpen(false));
  cancelEl?.addEventListener('click', () => setOpen(false));
  backdropEl?.addEventListener('click', () => setOpen(false));
  saveEl?.addEventListener('click', () => commitSettings());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerEl?.classList.contains('is-open')) {
      setOpen(false);
    }
  });

  syncValues();
  return { open: () => setOpen(true), close: () => setOpen(false) };
}
