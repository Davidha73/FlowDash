import {
  ArrowUpRight,
  Bell,
  Box,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  EllipsisVertical,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderSearch,
  LayoutDashboard,
  LayoutTemplate,
  Plus,
  Power,
  RefreshCw,
  StickyNote,
  X,
  createIcons,
} from 'lucide';

const APP_ICONS = {
  ArrowUpRight,
  Bell,
  Box,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  EllipsisVertical,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderSearch,
  LayoutDashboard,
  LayoutTemplate,
  Plus,
  Power,
  RefreshCw,
  StickyNote,
  X,
};

export function initIcons(root = document) {
  createIcons({
    icons: APP_ICONS,
    root,
    attrs: {
      'stroke-width': '1.8',
    },
  });
}

export function createIconPlaceholder(name, className = 'lucide-sm') {
  const iconEl = document.createElement('i');
  iconEl.dataset.lucide = name;
  if (className) iconEl.className = className;
  iconEl.setAttribute('aria-hidden', 'true');
  return iconEl;
}
