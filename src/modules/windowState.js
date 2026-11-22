import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';

export async function initWindowState(savedWindow, onSaveWindow) {
  let win;
  try {
    win = getCurrentWindow();
  } catch {
    return;
  }

  try {
    if (savedWindow?.maximized) {
      await win.maximize();
    } else {
      if (savedWindow?.width >= 400 && savedWindow?.height >= 300) {
        await win.setSize(new PhysicalSize(savedWindow.width, savedWindow.height));
      }
      if (
        typeof savedWindow?.x === 'number' &&
        typeof savedWindow?.y === 'number' &&
        savedWindow.x > -10000 &&
        savedWindow.y > -10000
      ) {
        await win.setPosition(new PhysicalPosition(savedWindow.x, savedWindow.y));
      }
    }
  } catch {
    // Ignore outside Tauri
  }

  let timer = null;
  const scheduleSave = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        if (await win.isMinimized()) return;
        const maximized = await win.isMaximized();
        if (maximized) {
          onSaveWindow?.({ maximized: true });
          return;
        }
        const size = await win.innerSize();
        const pos = await win.outerPosition();
        if (size.width < 400 || size.height < 300 || pos.x <= -10000 || pos.y <= -10000) return;
        onSaveWindow?.({
          width: size.width,
          height: size.height,
          x: pos.x,
          y: pos.y,
          maximized: false,
        });
      } catch {
        // Ignore outside Tauri
      }
    }, 350);
  };

  try {
    await win.onResized(scheduleSave);
    await win.onMoved(scheduleSave);
  } catch {
    // Ignore outside Tauri
  }
}
