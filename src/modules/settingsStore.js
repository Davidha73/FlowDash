import { invoke } from '@tauri-apps/api/core';

const DEFAULTS = {
  theme: 'light',
  defaultFilter: 'all',
  window: {
    width: 1060,
    height: 740,
    x: null,
    y: null,
    maximized: false,
  },
};

function cloneDefaults() {
  return {
    ...DEFAULTS,
    window: { ...DEFAULTS.window },
  };
}

let cachedSettings = cloneDefaults();

export function getSettingsSnapshot() {
  return {
    ...cachedSettings,
    window: { ...DEFAULTS.window, ...(cachedSettings.window || {}) },
  };
}

export async function loadSettings() {
  try {
    const raw = await invoke('read_settings_file');
    if (!raw || !raw.trim()) {
      cachedSettings = cloneDefaults();
      await saveSettings(cachedSettings);
      return getSettingsSnapshot();
    }
    const parsed = JSON.parse(raw);
    const valid = parsed && typeof parsed === 'object' ? parsed : {};
    cachedSettings = {
      ...cloneDefaults(),
      ...valid,
      window: {
        ...DEFAULTS.window,
        ...(valid.window && typeof valid.window === 'object' ? valid.window : {}),
      },
    };
    return getSettingsSnapshot();
  } catch {
    cachedSettings = cloneDefaults();
    return getSettingsSnapshot();
  }
}

export async function saveSettings(patch) {
  cachedSettings = {
    ...cachedSettings,
    ...patch,
    window: patch?.window
      ? { ...cachedSettings.window, ...patch.window }
      : { ...cachedSettings.window },
  };
  try {
    await invoke('write_settings_file', {
      contents: JSON.stringify(cachedSettings, null, 2),
    });
  } catch {
    // Ignore outside Tauri runtime
  }
  return getSettingsSnapshot();
}
