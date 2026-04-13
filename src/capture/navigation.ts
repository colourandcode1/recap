// Navigation tracking — monkey-patches history API, listens for popstate/hashchange.

import type { NavigationEvent } from '../types.js';
import { getSessionId, getTimestamp } from './session.js';
import { sanitizeUrl } from '../privacy/sanitize.js';

type NavHandler = (event: NavigationEvent) => void;

let _handler: NavHandler | null = null;
let _stripQuery = true;
let _currentUrl = '';
let _cleanupFns: Array<() => void> = [];

// Keep original references
const _originalPushState = history.pushState.bind(history);
const _originalReplaceState = history.replaceState.bind(history);

function emit(from: string, to: string, method: NavigationEvent['method']): void {
  if (!_handler) return;
  try {
    const event: NavigationEvent = {
      sessionId: getSessionId(),
      timestamp: getTimestamp(),
      type: 'navigation',
      url: to,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      from,
      to,
      method,
    };
    _handler(event);
  } catch (err) {
    console.error('[Recap] Navigation event error:', err);
  }
}

function patchHistoryMethod(
  original: typeof history.pushState,
  method: 'pushState' | 'replaceState'
): typeof history.pushState {
  return function (
    this: History,
    data: unknown,
    unused: string,
    url?: string | URL | null
  ): void {
    const from = sanitizeUrl(_currentUrl || location.href, _stripQuery);
    original.call(this, data, unused, url);
    const to = sanitizeUrl(location.href, _stripQuery);
    if (from !== to) {
      _currentUrl = location.href;
      emit(from, to, method);
    }
  };
}

function onPopState(): void {
  try {
    const from = sanitizeUrl(_currentUrl || '', _stripQuery);
    const to = sanitizeUrl(location.href, _stripQuery);
    _currentUrl = location.href;
    emit(from, to, 'popstate');
  } catch (err) {
    console.error('[Recap] popstate handler error:', err);
  }
}

function onHashChange(): void {
  try {
    const from = sanitizeUrl(_currentUrl || '', _stripQuery);
    const to = sanitizeUrl(location.href, _stripQuery);
    _currentUrl = location.href;
    emit(from, to, 'hashchange');
  } catch (err) {
    console.error('[Recap] hashchange handler error:', err);
  }
}

export function initNavigationCapture(handler: NavHandler, stripQuery = true): () => void {
  _handler = handler;
  _stripQuery = stripQuery;
  _currentUrl = location.href;

  // Record initial page load
  emit('', sanitizeUrl(location.href, _stripQuery), 'pageload');

  // Patch history methods
  history.pushState = patchHistoryMethod(_originalPushState, 'pushState');
  history.replaceState = patchHistoryMethod(_originalReplaceState, 'replaceState');

  window.addEventListener('popstate', onPopState);
  window.addEventListener('hashchange', onHashChange);

  _cleanupFns = [
    () => window.removeEventListener('popstate', onPopState),
    () => window.removeEventListener('hashchange', onHashChange),
    () => {
      history.pushState = _originalPushState;
      history.replaceState = _originalReplaceState;
    },
  ];

  return () => {
    _handler = null;
    _cleanupFns.forEach((fn) => fn());
    _cleanupFns = [];
  };
}
