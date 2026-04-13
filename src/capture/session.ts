// Session ID generation — sessionStorage UUID, no cookies, no fingerprinting.

const SESSION_KEY = 'recap-session-id';
const NAME_KEY = 'recap-session-name';

function generateUUID(): string {
  // Use crypto.randomUUID() if available (modern browsers), else fallback
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: manual UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let _sessionId: string | null = null;
let _sessionName: string | null = null;

export function getSessionId(): string {
  if (_sessionId) return _sessionId;

  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      _sessionId = stored;
      return _sessionId;
    }
    _sessionId = generateUUID();
    sessionStorage.setItem(SESSION_KEY, _sessionId);
  } catch {
    // sessionStorage unavailable (e.g. some private browsing modes)
    // Generate a per-page-load UUID — tracking works, just no cross-page linking
    console.warn('[Recap] sessionStorage unavailable — session ID will reset on each page load');
    _sessionId = generateUUID();
  }

  return _sessionId;
}

export function setSessionName(name: string): void {
  _sessionName = name;
  try {
    sessionStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore
  }
}

export function getSessionName(): string | null {
  if (_sessionName) return _sessionName;
  try {
    _sessionName = sessionStorage.getItem(NAME_KEY);
  } catch {
    // ignore
  }
  return _sessionName;
}

export function getTimestamp(): number {
  try {
    return performance.now();
  } catch {
    return Date.now();
  }
}

export function getSessionStart(): number {
  // We store session start as a module-level var so all timestamps are relative to it
  return _sessionStart;
}

const _sessionStart = getTimestamp();
