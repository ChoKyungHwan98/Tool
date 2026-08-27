import type { SVGProps } from 'react';

export type IconName =
  | 'home' | 'projects' | 'database' | 'pattern' | 'document' | 'plus'
  | 'connections' | 'settings' | 'search' | 'panel' | 'close' | 'folder'
  | 'clock' | 'arrow' | 'check' | 'grid' | 'more' | 'pin' | 'tray'
  | 'focus' | 'warning' | 'spark' | 'back' | 'menu' | 'chevron' | 'prompt' | 'copy' | 'save'
  | 'layout' | 'edges' | 'map' | 'undo' | 'dots';

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  let content;
  switch (name) {
    case 'home': content = <><path d="M3 11.2 12 4l9 7.2"/><path d="M5.5 10.2V20h13v-9.8M9.5 20v-6h5v6"/></>; break;
    case 'projects': content = <><path d="M3.5 6.5h6l1.7 2H20.5v10.5H3.5z"/><path d="M3.5 8.5V5h5l1.5 1.5"/></>; break;
    case 'database': content = <><ellipse cx="12" cy="5.5" rx="7.5" ry="3"/><path d="M4.5 5.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/><path d="M4.5 11.5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/></>; break;
    case 'pattern': content = <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m8.3 7 7.2-.1M7.5 8l3.3 7.7M16.5 9l-3.2 6.7"/></>; break;
    case 'document': content = <><path d="M6 3.5h8l4 4V21H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/></>; break;
    case 'plus': content = <><path d="M12 5v14M5 12h14"/></>; break;
    case 'connections': content = <><path d="M9.5 14.5 14.5 9.5"/><path d="m7.8 16.2-1.3 1.3a3.2 3.2 0 0 1-4.5-4.5l3.5-3.5A3.2 3.2 0 0 1 10 9"/><path d="m16.2 7.8 1.3-1.3A3.2 3.2 0 0 1 22 11l-3.5 3.5A3.2 3.2 0 0 1 14 15"/></>; break;
    case 'settings': content = <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>; break;
    case 'search': content = <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>; break;
    case 'panel': content = <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>; break;
    case 'close': content = <><path d="m7 7 10 10M17 7 7 17"/></>; break;
    case 'folder': content = <><path d="M3.5 7h6l1.7 2h9.3v10H3.5z"/><path d="M3.5 9V5.5h5L10 7"/></>; break;
    case 'clock': content = <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>; break;
    case 'arrow': content = <><path d="M5 12h14M14 7l5 5-5 5"/></>; break;
    case 'check': content = <><path d="m5 12.5 4.2 4.2L19 7"/></>; break;
    case 'grid': content = <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>; break;
    case 'more': content = <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></>; break;
    case 'pin': content = <><path d="m8 3 8 8M14.5 4.5l5 5-3 1.5-4.5 4.5-1 3-2-2 3-1 4.5-4.5zM9 17l-4 4"/></>; break;
    case 'tray': content = <><path d="M4 5h16v11H4z"/><path d="M8 20h8M12 16v4M8 9h8M9.5 12h5"/></>; break;
    case 'focus': content = <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>; break;
    case 'warning': content = <><path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5M12 17.5h.01"/></>; break;
    case 'spark': content = <><path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></>; break;
    case 'back': content = <><path d="M19 12H5M11 6l-6 6 6 6"/></>; break;
    case 'menu': content = <><path d="M4 7h16M4 12h16M4 17h16"/></>; break;
    case 'chevron': content = <><path d="m7 9 5 5 5-5"/></>; break;
    case 'prompt': content = <><path d="M4 5.5h16v11H9l-5 4z"/><path d="M8 9h8M8 12.5h5"/></>; break;
    case 'copy': content = <><rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"/></>; break;
    case 'save': content = <><path d="M4 4h14l2 2v14H4z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></>; break;
    case 'layout': content = <><rect x="3.5" y="4" width="7" height="6" rx="1"/><rect x="13.5" y="4" width="7" height="6" rx="1"/><rect x="3.5" y="14" width="17" height="6" rx="1"/></>; break;
    case 'edges': content = <><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 7h10M6.2 8.7l4.6 7.6M17.8 8.7l-4.6 7.6"/></>; break;
    case 'map': content = <><path d="m3.5 5.5 5-2 7 2 5-2v15l-5 2-7-2-5 2z"/><path d="M8.5 3.5v15M15.5 5.5v15"/></>; break;
    case 'undo': content = <><path d="M8 7H4v-4"/><path d="M4.5 7.5A8 8 0 1 1 5 17"/></>; break;
    case 'dots': content = <><circle cx="6" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="18" cy="18" r="1" fill="currentColor" stroke="none"/></>; break;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common} {...props}>{content}</svg>;
}

export function toolIconName(toolId: string): IconName {
  if (toolId === 'table-designer') return 'database';
  if (toolId === 'pattern-designer') return 'pattern';
  if (toolId === 'deck-designer') return 'document';
  if (toolId === 'prompt-library') return 'prompt';
  return 'grid';
}
