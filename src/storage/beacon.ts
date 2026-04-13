// Optional remote transport via navigator.sendBeacon().

import type { AnyEvent } from '../types.js';

let _endpoint: string | null = null;

export function setEndpoint(url: string): void {
  _endpoint = url;
}

export async function sendBeaconBatch(events: AnyEvent[]): Promise<void> {
  if (!_endpoint || events.length === 0) return;

  try {
    const payload = JSON.stringify(events);
    const blob = new Blob([payload], { type: 'application/json' });
    const sent = navigator.sendBeacon(_endpoint, blob);
    if (!sent) {
      // sendBeacon can fail (e.g. too large) — fall back to fetch
      await fetch(_endpoint, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      });
    }
  } catch (err) {
    console.error('[Recap] Beacon send error:', err);
  }
}

export function hasEndpoint(): boolean {
  return _endpoint !== null;
}
