// Export utilities — JSON download, CSV, clipboard.

import type { AnyEvent, ClickEvent, ScrollEvent, NavigationEvent } from '../types.js';

const DEFAULT_DOWNLOAD_PREFIX = 'recap-export';
const FALLBACK_DOWNLOAD_EXT = 'txt';

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeFilename(filename: string): string {
  const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch?.[1] ?? FALLBACK_DOWNLOAD_EXT;
  const base = extMatch ? filename.slice(0, -(ext.length + 1)) : filename;
  const safeBase = sanitizeFilenamePart(base) || DEFAULT_DOWNLOAD_PREFIX;
  const safeExt = sanitizeFilenamePart(ext) || FALLBACK_DOWNLOAD_EXT;
  return `${safeBase}.${safeExt}`;
}

export function downloadBlob(blob: Blob, filename: string): boolean {
  let objectUrl = '';
  let anchor: HTMLAnchorElement | null = null;
  try {
    objectUrl = URL.createObjectURL(blob);
    anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = sanitizeFilename(filename);
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    return true;
  } catch (err) {
    console.error('[Recap] Download failed:', err);
    return false;
  } finally {
    // Delay cleanup enough for browsers that defer blob download startup.
    setTimeout(() => {
      if (anchor?.parentElement) {
        anchor.parentElement.removeChild(anchor);
      }
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }, 4000);
  }
}

export function buildFilename(prefix: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${ts}.${ext}`;
}

export function exportJSON(events: AnyEvent[], sessionName?: string): boolean {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessionName,
    events,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const name = sessionName ? `recap-${sessionName}` : 'recap-session';
  return downloadBlob(blob, buildFilename(name, 'json'));
}

export function exportCSV(events: AnyEvent[], sessionName?: string): boolean {
  const headers = [
    'type',
    'sessionId',
    'timestamp',
    'url',
    'viewportWidth',
    'viewportHeight',
    'pageX',
    'pageY',
    'clientX',
    'clientY',
    'selector',
    'tagName',
    'label',
    'pageRegion',
    'scrollDepth',
    'maxScrollDepth',
    'navFrom',
    'navTo',
    'navMethod',
  ];

  const rows = events.map((e) => {
    const base = [
      e.type,
      e.sessionId,
      e.timestamp,
      e.url,
      e.viewport.width,
      e.viewport.height,
    ];

    if (e.type === 'click') {
      const c = e as ClickEvent;
      return [
        ...base,
        c.pageX,
        c.pageY,
        c.clientX,
        c.clientY,
        c.selector,
        c.tagName,
        c.label ?? '',
        c.pageRegion,
        '',
        '',
        '',
        '',
        '',
      ];
    }

    if (e.type === 'scroll') {
      const s = e as ScrollEvent;
      return [...base, '', '', '', '', '', '', '', '', s.depth, s.maxDepth, '', '', ''];
    }

    if (e.type === 'navigation') {
      const n = e as NavigationEvent;
      return [...base, '', '', '', '', '', '', '', '', '', '', n.from, n.to, n.method];
    }

    return [...base, '', '', '', '', '', '', '', '', '', '', '', '', ''];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const name = sessionName ? `recap-${sessionName}` : 'recap-session';
  return downloadBlob(blob, buildFilename(name, 'csv'));
}

export async function copyToClipboard(events: AnyEvent[]): Promise<void> {
  const json = JSON.stringify(events, null, 2);
  await navigator.clipboard.writeText(json);
}

export function exportSummaryJSON(summary: object, sessionName?: string): boolean {
  const blob = new Blob([JSON.stringify(summary, null, 2)], {
    type: 'application/json',
  });
  const name = sessionName ? `recap-ai-${sessionName}` : 'recap-ai-summary';
  return downloadBlob(blob, buildFilename(name, 'json'));
}
