// Export utilities — JSON download, CSV, clipboard.

import type { AnyEvent, ClickEvent, ScrollEvent, NavigationEvent } from '../types.js';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function buildFilename(prefix: string, ext: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${ts}.${ext}`;
}

export function exportJSON(events: AnyEvent[], sessionName?: string): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    sessionName,
    events,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const name = sessionName ? `recap-${sessionName}` : 'recap-session';
  downloadBlob(blob, buildFilename(name, 'json'));
}

export function exportCSV(events: AnyEvent[], sessionName?: string): void {
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
  downloadBlob(blob, buildFilename(name, 'csv'));
}

export async function copyToClipboard(events: AnyEvent[]): Promise<void> {
  const json = JSON.stringify(events, null, 2);
  await navigator.clipboard.writeText(json);
}

export function exportSummaryJSON(summary: object, sessionName?: string): void {
  const blob = new Blob([JSON.stringify(summary, null, 2)], {
    type: 'application/json',
  });
  const name = sessionName ? `recap-ai-${sessionName}` : 'recap-ai-summary';
  downloadBlob(blob, buildFilename(name, 'json'));
}
