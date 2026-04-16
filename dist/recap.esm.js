const SESSION_KEY = "recap-session-id";
const NAME_KEY = "recap-session-name";
function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
let _sessionId = null;
let _sessionName = null;
function getSessionId() {
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
    console.warn("[Recap] sessionStorage unavailable — session ID will reset on each page load");
    _sessionId = generateUUID();
  }
  return _sessionId;
}
function setSessionName(name) {
  _sessionName = name;
  try {
    sessionStorage.setItem(NAME_KEY, name);
  } catch {
  }
}
function getSessionName() {
  if (_sessionName) return _sessionName;
  try {
    _sessionName = sessionStorage.getItem(NAME_KEY);
  } catch {
  }
  return _sessionName;
}
function getTimestamp() {
  try {
    return performance.now();
  } catch {
    return Date.now();
  }
}
getTimestamp();
function sanitizeUrl(rawUrl, stripQuery = true) {
  try {
    const base = typeof location !== "undefined" ? location.href : "https://localhost";
    const url = new URL(rawUrl, base);
    if (stripQuery) {
      return url.pathname;
    }
    return url.pathname + url.search;
  } catch {
    return rawUrl.split("?")[0]?.split("#")[0] ?? rawUrl;
  }
}
function isExcluded(el) {
  if (el.hasAttribute("data-ut-no-track")) return true;
  if (el.classList.contains("ut-block")) return true;
  let parent = el.parentElement;
  while (parent) {
    if (parent.hasAttribute("data-ut-no-track")) return true;
    if (parent.classList.contains("ut-block")) return true;
    parent = parent.parentElement;
  }
  return false;
}
function isMasked(el) {
  if (el.classList.contains("ut-mask")) return true;
  let parent = el.parentElement;
  while (parent) {
    if (parent.classList.contains("ut-mask")) return true;
    parent = parent.parentElement;
  }
  return false;
}
function extractLabel(el) {
  const utLabel = el.getAttribute("data-ut-label");
  if (utLabel) return utLabel.trim();
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref?.textContent) return ref.textContent.trim().slice(0, 80);
  }
  const title = el.getAttribute("title");
  if (title) return title.trim();
  const alt = el.getAttribute("alt");
  if (alt) return alt.trim();
  if (!isMasked(el)) {
    const htmlEl = el;
    const text = (htmlEl.innerText ?? htmlEl.textContent ?? "").trim();
    if (text.length > 0) return text.slice(0, 50);
  }
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return placeholder.trim();
  return null;
}
function nearestHeading(el) {
  const headings = /* @__PURE__ */ new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
  let steps = 0;
  let current = el;
  while (current && steps < 20) {
    let sib = current.previousElementSibling;
    while (sib && steps < 20) {
      steps++;
      if (headings.has(sib.tagName)) {
        const htmlSib = sib;
        const text = (htmlSib.innerText ?? htmlSib.textContent ?? "").trim();
        return text.slice(0, 80) || null;
      }
      sib = sib.previousElementSibling;
    }
    current = current.parentElement;
    steps++;
  }
  return null;
}
function cssEscape(value) {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
  return value.replace(/([^\w-])/g, "\\$1").replace(/^(\d)/, "\\3$1 ");
}
function generateSelector(el) {
  if (el.id) return `#${cssEscape(el.id)}`;
  const utLabel = el.getAttribute("data-ut-label");
  if (utLabel) return `[data-ut-label="${utLabel.replace(/"/g, '\\"')}"]`;
  const segments = [];
  let current = el;
  while (current && current !== document.body && segments.length < 5) {
    const tag = current.tagName.toLowerCase();
    if (current.id && current !== el) {
      segments.push(`#${cssEscape(current.id)}`);
      break;
    }
    const siblings = current.parentElement ? Array.from(current.parentElement.children).filter((c) => c.tagName === current.tagName) : [];
    let segment = tag;
    if (siblings.length > 1) {
      const uniqueClass = findUniqueClass(current, siblings);
      if (uniqueClass) {
        segment = `${tag}.${cssEscape(uniqueClass)}`;
      } else {
        const index = siblings.indexOf(current) + 1;
        segment = `${tag}:nth-of-type(${index})`;
      }
    }
    segments.push(segment);
    current = current.parentElement;
  }
  return segments.reverse().join(" > ");
}
function findUniqueClass(el, siblings) {
  for (const cls of Array.from(el.classList)) {
    const hasDuplicate = siblings.some((s) => s !== el && s.classList.contains(cls));
    if (!hasDuplicate) return cls;
  }
  return null;
}
function getPageRegion(clientX, clientY, viewport) {
  const xRatio = clientX / viewport.width;
  const yRatio = clientY / viewport.height;
  const col = xRatio < 0.33 ? "left" : xRatio < 0.67 ? "center" : "right";
  const row = yRatio < 0.33 ? "top" : yRatio < 0.67 ? "middle" : "bottom";
  if (col === "center" && row === "middle") return "center";
  return `${row}-${col}`;
}
function extractDataAttributes(el) {
  const attrs = {};
  let found = false;
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith("data-ut-")) {
      attrs[attr.name] = attr.value;
      found = true;
    }
  }
  return found ? attrs : void 0;
}
let _handler$2 = null;
let _stripQuery$2 = true;
function onDocumentClick(e) {
  try {
    const target = e.target;
    if (!target || !_handler$2) return;
    if (isExcluded(target)) return;
    const tag = target.tagName.toUpperCase();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };
    const rect = target.getBoundingClientRect();
    const elementX = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0;
    const elementY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0;
    const selector = generateSelector(target);
    const label = extractLabel(target);
    const heading = nearestHeading(target);
    const region = getPageRegion(e.clientX, e.clientY, viewport);
    const dataAttributes = extractDataAttributes(target);
    const event = {
      sessionId: getSessionId(),
      timestamp: getTimestamp(),
      type: "click",
      url: sanitizeUrl(location.href, _stripQuery$2),
      viewport,
      pageX: e.pageX,
      pageY: e.pageY,
      clientX: e.clientX,
      clientY: e.clientY,
      elementX: Math.max(0, Math.min(1, elementX)),
      elementY: Math.max(0, Math.min(1, elementY)),
      selector,
      tagName: tag,
      label,
      nearestHeading: heading,
      pageRegion: region,
      ...dataAttributes !== void 0 ? { dataAttributes } : {}
    };
    _handler$2(event);
  } catch (err) {
    console.error("[Recap] Click capture error:", err);
  }
}
function initClickCapture(handler, stripQuery = true) {
  _handler$2 = handler;
  _stripQuery$2 = stripQuery;
  document.addEventListener("click", onDocumentClick, { passive: true, capture: true });
  return () => {
    document.removeEventListener("click", onDocumentClick, { capture: true });
    _handler$2 = null;
  };
}
const MILESTONES = [25, 50, 75, 100];
const INCREMENT_THRESHOLD = 5;
let _handler$1 = null;
let _stripQuery$1 = true;
let _maxDepth = 0;
let _lastLoggedDepth = 0;
let _sentinels = [];
let _observer = null;
let _rafId = null;
let _resizeDebounceTimer = null;
let _cleanupFns$1 = [];
function getScrollDepth() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight
  );
  const viewHeight = window.innerHeight;
  const scrollable = docHeight - viewHeight;
  if (scrollable <= 0) return 100;
  return Math.min(100, Math.round(scrollTop / scrollable * 100));
}
function emitScroll(depth) {
  if (!_handler$1) return;
  _maxDepth = Math.max(_maxDepth, depth);
  const event = {
    sessionId: getSessionId(),
    timestamp: getTimestamp(),
    type: "scroll",
    url: sanitizeUrl(location.href, _stripQuery$1),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    depth,
    maxDepth: _maxDepth
  };
  try {
    _handler$1(event);
  } catch (err) {
    console.error("[Recap] Scroll event error:", err);
  }
}
function createSentinels() {
  removeSentinels();
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  _sentinels = MILESTONES.map((pct) => {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.setAttribute("data-recap-sentinel", String(pct));
    Object.assign(el.style, {
      position: "absolute",
      height: "1px",
      width: "1px",
      opacity: "0",
      pointerEvents: "none",
      top: `${Math.floor(docHeight * pct / 100)}px`,
      left: "0"
    });
    document.body.appendChild(el);
    return el;
  });
}
function removeSentinels() {
  _sentinels.forEach((s) => s.parentElement?.removeChild(s));
  _sentinels = [];
}
function recalculateSentinelPositions() {
  const docHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight
  );
  _sentinels.forEach((s, i) => {
    const pct = MILESTONES[i] ?? 100;
    s.style.top = `${Math.floor(docHeight * pct / 100)}px`;
  });
}
function setupObserver() {
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
  const milestonesSeen = /* @__PURE__ */ new Set();
  _observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const pct = Number(entry.target.getAttribute("data-recap-sentinel"));
        if (!milestonesSeen.has(pct)) {
          milestonesSeen.add(pct);
          emitScroll(pct);
        }
      }
    },
    { threshold: 0 }
  );
  _sentinels.forEach((s) => _observer.observe(s));
}
function startContinuousTracking() {
  let ticking = false;
  function onScroll() {
    if (!ticking) {
      _rafId = requestAnimationFrame(() => {
        try {
          const depth = getScrollDepth();
          if (depth > _maxDepth || Math.abs(depth - _lastLoggedDepth) >= INCREMENT_THRESHOLD) {
            _lastLoggedDepth = depth;
            emitScroll(depth);
          }
        } catch (err) {
          console.error("[Recap] rAF scroll error:", err);
        }
        ticking = false;
      });
      ticking = true;
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  _cleanupFns$1.push(() => window.removeEventListener("scroll", onScroll));
}
function onResize() {
  if (_resizeDebounceTimer !== null) clearTimeout(_resizeDebounceTimer);
  _resizeDebounceTimer = setTimeout(() => {
    try {
      recalculateSentinelPositions();
    } catch (err) {
      console.error("[Recap] Resize recalculate error:", err);
    }
  }, 500);
}
function initScrollCapture(handler, stripQuery = true) {
  _handler$1 = handler;
  _stripQuery$1 = stripQuery;
  _maxDepth = 0;
  _lastLoggedDepth = 0;
  try {
    createSentinels();
    setupObserver();
  } catch (err) {
    console.error("[Recap] Scroll sentinel setup error:", err);
  }
  startContinuousTracking();
  window.addEventListener("resize", onResize, { passive: true });
  _cleanupFns$1.push(() => window.removeEventListener("resize", onResize));
  return () => {
    _handler$1 = null;
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
    if (_rafId !== null) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }
    if (_resizeDebounceTimer !== null) {
      clearTimeout(_resizeDebounceTimer);
      _resizeDebounceTimer = null;
    }
    _cleanupFns$1.forEach((fn) => fn());
    _cleanupFns$1 = [];
    removeSentinels();
  };
}
let _handler = null;
let _stripQuery = true;
let _currentUrl = "";
let _cleanupFns = [];
const _originalPushState = history.pushState.bind(history);
const _originalReplaceState = history.replaceState.bind(history);
function emit(from, to, method) {
  if (!_handler) return;
  try {
    const event = {
      sessionId: getSessionId(),
      timestamp: getTimestamp(),
      type: "navigation",
      url: to,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      from,
      to,
      method
    };
    _handler(event);
  } catch (err) {
    console.error("[Recap] Navigation event error:", err);
  }
}
function patchHistoryMethod(original, method) {
  return function(data, unused, url) {
    const from = sanitizeUrl(_currentUrl || location.href, _stripQuery);
    original.call(this, data, unused, url);
    const to = sanitizeUrl(location.href, _stripQuery);
    if (from !== to) {
      _currentUrl = location.href;
      emit(from, to, method);
    }
  };
}
function onPopState() {
  try {
    const from = sanitizeUrl(_currentUrl || "", _stripQuery);
    const to = sanitizeUrl(location.href, _stripQuery);
    _currentUrl = location.href;
    emit(from, to, "popstate");
  } catch (err) {
    console.error("[Recap] popstate handler error:", err);
  }
}
function onHashChange() {
  try {
    const from = sanitizeUrl(_currentUrl || "", _stripQuery);
    const to = sanitizeUrl(location.href, _stripQuery);
    _currentUrl = location.href;
    emit(from, to, "hashchange");
  } catch (err) {
    console.error("[Recap] hashchange handler error:", err);
  }
}
function initNavigationCapture(handler, stripQuery = true) {
  _handler = handler;
  _stripQuery = stripQuery;
  _currentUrl = location.href;
  emit("", sanitizeUrl(location.href, _stripQuery), "pageload");
  history.pushState = patchHistoryMethod(_originalPushState, "pushState");
  history.replaceState = patchHistoryMethod(_originalReplaceState, "replaceState");
  window.addEventListener("popstate", onPopState);
  window.addEventListener("hashchange", onHashChange);
  _cleanupFns = [
    () => window.removeEventListener("popstate", onPopState),
    () => window.removeEventListener("hashchange", onHashChange),
    () => {
      history.pushState = _originalPushState;
      history.replaceState = _originalReplaceState;
    }
  ];
  return () => {
    _handler = null;
    _cleanupFns.forEach((fn) => fn());
    _cleanupFns = [];
  };
}
const BUFFER_MAX = 50;
const FLUSH_INTERVAL_MS = 1e4;
let _buffer = [];
let _flushTarget = null;
let _flushTimer = null;
let _isFlushing = false;
function push(event) {
  _buffer.push(event);
  if (_buffer.length >= BUFFER_MAX) {
    void flush();
  }
}
async function flush() {
  if (_isFlushing || _buffer.length === 0 || !_flushTarget) return;
  _isFlushing = true;
  const batch = _buffer.splice(0, _buffer.length);
  try {
    await _flushTarget(batch);
  } catch (err) {
    _buffer.unshift(...batch);
    console.error("[Recap] Buffer flush error:", err);
  } finally {
    _isFlushing = false;
  }
}
function initBuffer(target) {
  _flushTarget = target;
  _buffer = [];
  _flushTimer = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
  function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
      void flush();
    }
  }
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    if (_flushTimer !== null) {
      clearInterval(_flushTimer);
      _flushTimer = null;
    }
    document.removeEventListener("visibilitychange", onVisibilityChange);
    _flushTarget = null;
  };
}
function getBuffer() {
  return [..._buffer];
}
function clearBuffer() {
  _buffer = [];
}
const DB_NAME = "recap-sessions";
const DB_VERSION = 1;
const STORE_NAME = "events";
const RETENTION_DAYS = 30;
let _db = null;
let _unavailable = false;
const _memoryStore = [];
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("sessionId", "sessionId", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
async function getDB() {
  if (_unavailable) return null;
  if (_db) return _db;
  try {
    _db = await openDB();
    return _db;
  } catch {
    _unavailable = true;
    console.warn("[Recap] IndexedDB unavailable — events stored in memory only");
    return null;
  }
}
async function saveEvents(events) {
  if (events.length === 0) return;
  const db = await getDB();
  if (!db) {
    _memoryStore.push(...events);
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    events.forEach((e) => store.add(e));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getSessionEvents(sessionId) {
  const db = await getDB();
  if (!db) {
    return _memoryStore.filter((e) => e.sessionId === sessionId);
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const index = tx.objectStore(STORE_NAME).index("sessionId");
    const req = index.getAll(IDBKeyRange.only(sessionId));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getAllSessions() {
  const db = await getDB();
  if (!db) {
    const ids = [...new Set(_memoryStore.map((e) => e.sessionId))];
    return ids.map((id) => {
      const events = _memoryStore.filter((e) => e.sessionId === id);
      return {
        sessionId: id,
        startTime: Math.min(...events.map((e) => e.timestamp)),
        eventCount: events.length
      };
    });
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const all = req.result;
      const sessionMap = /* @__PURE__ */ new Map();
      for (const e of all) {
        const existing = sessionMap.get(e.sessionId);
        if (!existing) {
          sessionMap.set(e.sessionId, {
            sessionId: e.sessionId,
            startTime: e.timestamp,
            eventCount: 1
          });
        } else {
          existing.eventCount++;
          if (e.timestamp < existing.startTime) existing.startTime = e.timestamp;
        }
      }
      resolve(Array.from(sessionMap.values()));
    };
    req.onerror = () => reject(req.error);
  });
}
async function clearAllSessions() {
  const db = await getDB();
  if (!db) {
    _memoryStore.length = 0;
    return;
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function purgeOldSessions() {
  const db = await getDB();
  if (!db) return;
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1e3;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const index = tx.objectStore(STORE_NAME).index("timestamp");
    const req = index.openCursor(IDBKeyRange.upperBound(cutoff));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
let _endpoint = null;
function setEndpoint(url) {
  _endpoint = url;
}
async function sendBeaconBatch(events) {
  if (!_endpoint || events.length === 0) return;
  try {
    const payload = JSON.stringify(events);
    const blob = new Blob([payload], { type: "application/json" });
    const sent = navigator.sendBeacon(_endpoint, blob);
    if (!sent) {
      await fetch(_endpoint, {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true
      });
    }
  } catch (err) {
    console.error("[Recap] Beacon send error:", err);
  }
}
function hasEndpoint() {
  return _endpoint !== null;
}
const PROMPT_TEMPLATE = `You are a UX researcher analysing a usability test session for a web application prototype.

Below is a structured session summary in JSON format. It contains:
- Session metadata (duration, viewport, pages visited)
- A chronological timeline of user actions with semantic element labels
- Per-page breakdowns of clicks, scroll depth, and time spent
- Detected patterns including frustration signals, backtracking, and accessibility gaps

Please analyse this session and provide:
1. **Task completion assessment** — did the user appear to accomplish their goal? Where did they struggle?
2. **Key friction points** — moments of hesitation, rapid clicking, backtracking, or confusion
3. **Navigation patterns** — was the user's path efficient? Where did they get lost?
4. **Accessibility observations** — unlabelled elements, missed affordances, discoverability issues
5. **Specific recommendations** — concrete UI changes ranked by likely impact

Session data:`;
const PAUSE_THRESHOLD_MS = 5e3;
const LONG_HESITATION_THRESHOLD_S = 10;
const RAPID_CLICK_WINDOW_MS = 2e3;
const RAPID_CLICK_THRESHOLD = 3;
function msToSec(ms) {
  return Math.round(ms) / 1e3;
}
function formatAction(event) {
  if (event.type === "click") {
    const c = event;
    const label = c.label ? `'${c.label}'` : null;
    const tag = c.tagName.charAt(0) + c.tagName.slice(1).toLowerCase();
    return label ? `Clicked ${label} ${tag.toLowerCase()}` : `Clicked unlabelled ${tag} element`;
  }
  if (event.type === "scroll") {
    const s = event;
    return `Scrolled to ${s.depth}% depth`;
  }
  if (event.type === "navigation") {
    const n = event;
    if (n.method === "pageload") return `Landed on ${n.to}`;
    return `Navigated to ${n.to}`;
  }
  return `${event.type} event`;
}
function detectRapidClicks(clicks) {
  const clusters = [];
  const sorted = [...clicks].sort((a, b) => a.timestamp - b.timestamp);
  let i = 0;
  while (i < sorted.length) {
    const anchor = sorted[i];
    let j = i + 1;
    while (j < sorted.length && sorted[j].timestamp - anchor.timestamp <= RAPID_CLICK_WINDOW_MS && (sorted[j].selector === anchor.selector || Math.sqrt(
      (sorted[j].clientX - anchor.clientX) ** 2 + (sorted[j].clientY - anchor.clientY) ** 2
    ) <= 50)) {
      j++;
    }
    const count = j - i;
    if (count >= RAPID_CLICK_THRESHOLD) {
      clusters.push({
        selector: anchor.selector,
        label: anchor.label,
        clickCount: count,
        durationMs: sorted[j - 1].timestamp - anchor.timestamp,
        timestamp: anchor.timestamp,
        page: anchor.url
      });
    }
    i = j;
  }
  return clusters;
}
function detectBacktracking(navEvents) {
  const result = [];
  for (let i = 1; i < navEvents.length; i++) {
    const cur = navEvents[i];
    const prev = navEvents[i - 1];
    const previousUrls = navEvents.slice(0, i - 1).map((n) => n.to);
    if (previousUrls.includes(cur.to)) {
      result.push({
        from: cur.from,
        to: cur.to,
        timestamp: cur.timestamp,
        timeOnPageBeforeBack: (cur.timestamp - prev.timestamp) / 1e3
      });
    }
  }
  return result;
}
function buildPageSummaries(clicks, scrollEvents, navEvents) {
  const urls = [.../* @__PURE__ */ new Set([...clicks.map((c) => c.url), ...navEvents.map((n) => n.to).filter(Boolean)])];
  const summaries = [];
  for (const url of urls) {
    if (!url) continue;
    const pageClicks = clicks.filter((c) => c.url === url);
    const pageScrolls = scrollEvents.filter((s) => s.url === url);
    const pageNavs = navEvents.filter((n) => n.to === url);
    let totalTime = 0;
    for (const nav of pageNavs) {
      const nextNav = navEvents.find(
        (n) => n.from === url && n.timestamp > nav.timestamp
      );
      if (nextNav) totalTime += (nextNav.timestamp - nav.timestamp) / 1e3;
    }
    const maxScroll = pageScrolls.reduce((m, s) => Math.max(m, s.maxDepth), 0);
    const dropoffDepths = pageScrolls.map((s) => s.depth);
    const scrollDropoff = dropoffDepths.length > 0 ? Math.round(dropoffDepths.reduce((a, b) => a + b, 0) / dropoffDepths.length) : 0;
    const firstNav = pageNavs.sort((a, b) => a.timestamp - b.timestamp)[0];
    const firstClick = pageClicks.sort((a, b) => a.timestamp - b.timestamp)[0];
    const timeToFirst = firstNav && firstClick ? (firstClick.timestamp - firstNav.timestamp) / 1e3 : null;
    const byRegion = {};
    for (const c of pageClicks) {
      byRegion[c.pageRegion] = (byRegion[c.pageRegion] ?? 0) + 1;
    }
    const elementMap = /* @__PURE__ */ new Map();
    for (const c of pageClicks) {
      const existing = elementMap.get(c.selector);
      if (existing) {
        existing.clickCount++;
      } else {
        elementMap.set(c.selector, {
          selector: c.selector,
          tagName: c.tagName,
          label: c.label,
          clickCount: 1,
          pageRegion: c.pageRegion
        });
      }
    }
    summaries.push({
      url,
      visits: pageNavs.length || 1,
      totalTimeOnPage: Math.round(totalTime * 10) / 10,
      timeToFirstClick: timeToFirst !== null ? Math.round(timeToFirst * 10) / 10 : null,
      maxScrollDepth: maxScroll,
      scrollDropoffPoint: scrollDropoff,
      clicks: {
        total: pageClicks.length,
        byRegion,
        byElement: Array.from(elementMap.values()).sort((a, b) => b.clickCount - a.clickCount)
      }
    });
  }
  return summaries;
}
function buildTimeline(events, navEvents, rapidClusters, backtrackEvents, sessionStart) {
  const entries = [];
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const firstClickPerPage = /* @__PURE__ */ new Map();
  const pageVisitCount = /* @__PURE__ */ new Map();
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const tSec = msToSec(e.timestamp - sessionStart);
    if (i > 0) {
      const prevTs = sorted[i - 1].timestamp;
      if (e.timestamp - prevTs >= PAUSE_THRESHOLD_MS) {
        entries.push({
          timestamp: msToSec(prevTs + (e.timestamp - prevTs) / 2 - sessionStart),
          action: `Pause — ${Math.round((e.timestamp - prevTs) / 1e3)}s of inactivity`,
          type: "pause",
          page: e.url
        });
      }
    }
    if (e.type === "navigation") {
      const n = e;
      if (!n.to) continue;
      const visitCount = (pageVisitCount.get(n.to) ?? 0) + 1;
      pageVisitCount.set(n.to, visitCount);
      let context;
      const backtrack = backtrackEvents.find(
        (b) => Math.abs(b.timestamp - n.timestamp) < 500
      );
      if (backtrack) {
        context = `Backtracking — returned to ${n.to} after ${Math.round(backtrack.timeOnPageBeforeBack)}s on ${n.from}`;
      } else if (visitCount > 1) {
        context = `${visitCount === 2 ? "2nd" : `${visitCount}th`} visit to this page`;
      }
      entries.push({
        timestamp: tSec,
        action: n.method === "pageload" ? `Landed on ${n.to}` : `Navigated to ${n.to}`,
        type: "navigate",
        page: n.to,
        ...context !== void 0 ? { context } : {}
      });
    } else if (e.type === "scroll") {
      const s = e;
      if ([25, 50, 75, 100].includes(s.depth)) {
        let context;
        if (s.depth >= 80) {
          const pageClicks = sorted.filter(
            (ev) => ev.type === "click" && ev.url === s.url
          );
          if (pageClicks.length === 0) {
            context = `Scrolled to ${s.depth}% depth but no clicks — content may be scan-only or unclear`;
          }
        }
        entries.push({
          timestamp: tSec,
          action: `Scrolled to ${s.depth}% depth`,
          type: "scroll_milestone",
          page: s.url,
          ...context !== void 0 ? { context } : {}
        });
      }
    } else if (e.type === "click") {
      const c = e;
      const cluster = rapidClusters.find(
        (rc) => rc.page === c.url && rc.selector === c.selector && Math.abs(rc.timestamp - c.timestamp) < 100
      );
      if (cluster) {
        const ctxParts = [
          `Potential frustration — user clicked same element repeatedly`
        ];
        if (!c.label) ctxParts.push("Element has no accessible label");
        entries.push({
          timestamp: tSec,
          action: `Rapid clicks detected (${cluster.clickCount} clicks in ${(cluster.durationMs / 1e3).toFixed(1)}s)`,
          type: "rapid_click",
          page: c.url,
          element: {
            selector: c.selector,
            tagName: c.tagName,
            label: c.label,
            nearestHeading: c.nearestHeading,
            pageRegion: c.pageRegion
          },
          context: ctxParts.join(" — ")
        });
        continue;
      }
      let context;
      const firstClick = firstClickPerPage.get(c.url);
      if (firstClick === void 0) {
        firstClickPerPage.set(c.url, c.timestamp);
        const nav = navEvents.find((n) => n.to === c.url && n.timestamp <= c.timestamp);
        if (nav) {
          const delay = (c.timestamp - nav.timestamp) / 1e3;
          context = delay > LONG_HESITATION_THRESHOLD_S ? `First click on this page — ${delay.toFixed(1)}s to first interaction (long hesitation)` : `First click on this page — ${delay.toFixed(1)}s to first interaction`;
        }
      } else if (!c.label) {
        context = "Element has no accessible label — possible discoverability issue";
      }
      entries.push({
        timestamp: tSec,
        action: formatAction(c),
        type: "click",
        page: c.url,
        element: {
          selector: c.selector,
          tagName: c.tagName,
          label: c.label,
          nearestHeading: c.nearestHeading,
          pageRegion: c.pageRegion
        },
        ...context !== void 0 ? { context } : {}
      });
    }
  }
  return entries.sort((a, b) => a.timestamp - b.timestamp);
}
function summarize(events, sessionName) {
  if (events.length === 0) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    return {
      meta: {
        sessionId: "",
        ...sessionName !== void 0 ? { sessionName } : {},
        startTime: now,
        endTime: now,
        duration: 0,
        viewport: { width: 0, height: 0 },
        pagesVisited: 0,
        totalClicks: 0,
        totalScrollEvents: 0
      },
      timeline: [],
      pages: [],
      patterns: {
        mostClickedElements: [],
        unclickedRegions: [],
        averageTimeToFirstClick: 0,
        navigationPath: [],
        backtracking: [],
        rapidClicks: [],
        scrollDropoff: []
      },
      promptTemplate: PROMPT_TEMPLATE
    };
  }
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const sessionStart = sorted[0].timestamp;
  const sessionEnd = sorted[sorted.length - 1].timestamp;
  const sessionId = sorted[0].sessionId;
  const clicks = sorted.filter((e) => e.type === "click");
  const scrollEvents = sorted.filter((e) => e.type === "scroll");
  const navEvents = sorted.filter((e) => e.type === "navigation");
  const pagesVisited = new Set(navEvents.map((n) => n.to).filter(Boolean));
  const viewport = sorted[0].viewport;
  const rapidClusters = detectRapidClicks(clicks);
  const backtrackEvents = detectBacktracking(navEvents);
  const pageSummaries = buildPageSummaries(clicks, scrollEvents, navEvents);
  const timeline = buildTimeline(sorted, navEvents, rapidClusters, backtrackEvents, sessionStart);
  const elementMap = /* @__PURE__ */ new Map();
  for (const c of clicks) {
    const existing = elementMap.get(c.selector);
    if (existing) {
      existing.clickCount++;
    } else {
      elementMap.set(c.selector, {
        selector: c.selector,
        tagName: c.tagName,
        label: c.label,
        clickCount: 1,
        pageRegion: c.pageRegion
      });
    }
  }
  const mostClicked = Array.from(elementMap.values()).sort((a, b) => b.clickCount - a.clickCount).slice(0, 10);
  const allRegions = [
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "center",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right"
  ];
  const clickedRegions = new Set(clicks.map((c) => c.pageRegion));
  const unclickedRegions = allRegions.filter((r) => !clickedRegions.has(r));
  const firstClickTimes = pageSummaries.map((p) => p.timeToFirstClick).filter((t) => t !== null);
  const avgTimeToFirst = firstClickTimes.length > 0 ? firstClickTimes.reduce((a, b) => a + b, 0) / firstClickTimes.length : 0;
  const navigationPath = navEvents.filter((n) => n.to).map((n) => n.to);
  const scrollDropoff = pageSummaries.filter((p) => p.scrollDropoffPoint > 0).map((p) => ({ page: p.url, depth: p.scrollDropoffPoint }));
  return {
    meta: {
      sessionId,
      ...sessionName !== void 0 ? { sessionName } : {},
      startTime: new Date(Date.now() - (sessionEnd - sessionStart)).toISOString(),
      endTime: (/* @__PURE__ */ new Date()).toISOString(),
      duration: Math.round((sessionEnd - sessionStart) / 1e3),
      viewport,
      pagesVisited: pagesVisited.size,
      totalClicks: clicks.length,
      totalScrollEvents: scrollEvents.length
    },
    timeline,
    pages: pageSummaries,
    patterns: {
      mostClickedElements: mostClicked,
      unclickedRegions,
      averageTimeToFirstClick: Math.round(avgTimeToFirst * 10) / 10,
      navigationPath,
      backtracking: backtrackEvents,
      rapidClicks: rapidClusters,
      scrollDropoff
    },
    promptTemplate: PROMPT_TEMPLATE
  };
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
function buildFilename$1(prefix, ext) {
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${prefix}-${ts}.${ext}`;
}
function exportJSON(events, sessionName) {
  const payload = {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    sessionName,
    events
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const name = sessionName ? `recap-${sessionName}` : "recap-session";
  downloadBlob(blob, buildFilename$1(name, "json"));
}
function exportCSV(events, sessionName) {
  const headers = [
    "type",
    "sessionId",
    "timestamp",
    "url",
    "viewportWidth",
    "viewportHeight",
    "pageX",
    "pageY",
    "clientX",
    "clientY",
    "selector",
    "tagName",
    "label",
    "pageRegion",
    "scrollDepth",
    "maxScrollDepth",
    "navFrom",
    "navTo",
    "navMethod"
  ];
  const rows = events.map((e) => {
    const base = [
      e.type,
      e.sessionId,
      e.timestamp,
      e.url,
      e.viewport.width,
      e.viewport.height
    ];
    if (e.type === "click") {
      const c = e;
      return [
        ...base,
        c.pageX,
        c.pageY,
        c.clientX,
        c.clientY,
        c.selector,
        c.tagName,
        c.label ?? "",
        c.pageRegion,
        "",
        "",
        "",
        "",
        ""
      ];
    }
    if (e.type === "scroll") {
      const s = e;
      return [...base, "", "", "", "", "", "", "", "", s.depth, s.maxDepth, "", "", ""];
    }
    if (e.type === "navigation") {
      const n = e;
      return [...base, "", "", "", "", "", "", "", "", "", "", n.from, n.to, n.method];
    }
    return [...base, "", "", "", "", "", "", "", "", "", "", "", "", ""];
  });
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const name = sessionName ? `recap-${sessionName}` : "recap-session";
  downloadBlob(blob, buildFilename$1(name, "csv"));
}
function exportSummaryJSON(summary, sessionName) {
  const blob = new Blob([JSON.stringify(summary, null, 2)], {
    type: "application/json"
  });
  const name = sessionName ? `recap-ai-${sessionName}` : "recap-ai-summary";
  downloadBlob(blob, buildFilename$1(name, "json"));
}
const DEFAULT_RADIUS = 25;
const DEFAULT_BLUR = 15;
const DEFAULT_OPACITY = 0.65;
const DEFAULT_GRADIENT = {
  0.4: "blue",
  0.65: "lime",
  1: "red"
};
let _canvas = null;
let _ctx = null;
let _circle = null;
let _colorGradient = null;
let _radius = DEFAULT_RADIUS;
let _blur = DEFAULT_BLUR;
let _clicks = [];
let _scrollScheduled = false;
function handleScroll() {
  if (_canvas?.style.display === "none") return;
  if (_scrollScheduled) return;
  _scrollScheduled = true;
  requestAnimationFrame(() => {
    _scrollScheduled = false;
    renderHeatmap(_clicks);
  });
}
function createCircle(radius, blur) {
  const r = radius + blur;
  const d = 2 * r;
  const c = document.createElement("canvas");
  c.width = d;
  c.height = d;
  const cx = c.getContext("2d");
  const grad = cx.createRadialGradient(r, r, blur, r, r, r);
  grad.addColorStop(0, "rgba(0,0,0,1)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  cx.fillStyle = grad;
  cx.fillRect(0, 0, d, d);
  return c;
}
function createColorGradient(stops) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 1;
  const cx = c.getContext("2d");
  const grad = cx.createLinearGradient(0, 0, 256, 0);
  for (const [stop, color] of Object.entries(stops)) {
    grad.addColorStop(Number(stop), color);
  }
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 256, 1);
  return cx.getImageData(0, 0, 256, 1).data;
}
function colorize(pixels, gradient) {
  const data = pixels.data;
  for (let i = 0, len = data.length; i < len; i += 4) {
    const alpha = data[i + 3];
    if (alpha > 0) {
      const idx = alpha * 4;
      data[i] = gradient[idx];
      data[i + 1] = gradient[idx + 1];
      data[i + 2] = gradient[idx + 2];
      data[i + 3] = alpha;
    }
  }
}
function initHeatmapCanvas() {
  if (_canvas) return _canvas;
  _canvas = document.createElement("canvas");
  _canvas.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    opacity: ${DEFAULT_OPACITY};
    z-index: 9999;
    display: none;
  `;
  _canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(_canvas);
  window.addEventListener("scroll", handleScroll, { passive: true });
  _ctx = _canvas.getContext("2d");
  _circle = createCircle(DEFAULT_RADIUS, DEFAULT_BLUR);
  _colorGradient = createColorGradient(DEFAULT_GRADIENT);
  _radius = DEFAULT_RADIUS;
  _blur = DEFAULT_BLUR;
  return _canvas;
}
function resizeCanvas() {
  if (!_canvas) return;
  _canvas.width = window.innerWidth;
  _canvas.height = window.innerHeight;
}
function renderHeatmap(clicks) {
  if (!_canvas || !_ctx) return;
  _clicks = clicks;
  resizeCanvas();
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  if (clicks.length === 0) return;
  _ctx.globalAlpha = 0.05;
  for (const click of clicks) {
    const r = _radius + _blur;
    _ctx.drawImage(_circle, click.pageX - window.scrollX - r, click.pageY - window.scrollY - r);
  }
  const imageData = _ctx.getImageData(0, 0, _canvas.width, _canvas.height);
  colorize(imageData, _colorGradient);
  _ctx.putImageData(imageData, 0, 0);
}
function showHeatmap() {
  if (_canvas) _canvas.style.display = "block";
}
function hideHeatmap() {
  if (_canvas) _canvas.style.display = "none";
}
function isHeatmapVisible() {
  return _canvas?.style.display !== "none";
}
function getHeatmapDataURL() {
  if (!_canvas) return null;
  return _canvas.toDataURL("image/png");
}
function hideScrollDepthOverlay() {
}
let _screenshotOverlay = null;
let _escHandler = null;
function buildFilename() {
  return `recap-heatmap-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19)}.png`;
}
function enterScreenshotMode() {
  if (_screenshotOverlay) return;
  const heatmapCanvas = document.querySelector('canvas[aria-hidden="true"]');
  const prevOpacity = heatmapCanvas?.style.opacity;
  if (heatmapCanvas) heatmapCanvas.style.opacity = "1";
  _screenshotOverlay = document.createElement("div");
  _screenshotOverlay.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.85);
    color: #fff;
    font: 14px/1.5 system-ui, sans-serif;
    padding: 14px 20px;
    border-radius: 8px;
    z-index: 10001;
    text-align: center;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    max-width: 420px;
  `;
  const isMac = typeof navigator !== "undefined" && (navigator.platform?.toLowerCase().includes("mac") || navigator.userAgentData?.platform?.toLowerCase().includes("mac"));
  const shortcut = isMac ? "Cmd+Shift+4" : "Win+Shift+S";
  _screenshotOverlay.innerHTML = `
    <strong>Heatmap overlay is visible</strong><br>
    Take a screenshot now.<br>
    <small>${shortcut} on ${isMac ? "Mac" : "Windows"} · Press <kbd style="background:#333;padding:1px 5px;border-radius:3px">Esc</kbd> to exit screenshot mode</small>
  `;
  document.body.appendChild(_screenshotOverlay);
  _escHandler = (e) => {
    if (e.key === "Escape") exitScreenshotMode(heatmapCanvas, prevOpacity);
  };
  document.addEventListener("keydown", _escHandler);
  setTimeout(() => exitScreenshotMode(heatmapCanvas, prevOpacity), 3e4);
}
function exitScreenshotMode(canvas, prevOpacity) {
  if (canvas && prevOpacity !== void 0) canvas.style.opacity = prevOpacity;
  if (_screenshotOverlay) {
    _screenshotOverlay.parentElement?.removeChild(_screenshotOverlay);
    _screenshotOverlay = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
}
function downloadHeatmapPNG() {
  const dataUrl = getHeatmapDataURL();
  if (!dataUrl) {
    console.warn("[Recap] Heatmap canvas not initialized");
    return;
  }
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = buildFilename();
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
function buildFlowGraph(navEvents) {
  const nodeMap = /* @__PURE__ */ new Map();
  const edgeMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < navEvents.length; i++) {
    const nav = navEvents[i];
    if (nav.to && !nodeMap.has(nav.to)) {
      nodeMap.set(nav.to, { url: nav.to, visits: 0, totalTime: 0 });
    }
    if (nav.to) nodeMap.get(nav.to).visits++;
    if (nav.from && nav.to && nav.from !== nav.to) {
      const key = `${nav.from}→${nav.to}`;
      const edge = edgeMap.get(key);
      if (edge) {
        edge.count++;
      } else {
        edgeMap.set(key, { from: nav.from, to: nav.to, count: 1 });
      }
    }
  }
  for (let i = 0; i < navEvents.length - 1; i++) {
    const cur = navEvents[i];
    const next = navEvents[i + 1];
    const node = nodeMap.get(cur.to);
    if (node) node.totalTime += (next.timestamp - cur.timestamp) / 1e3;
  }
  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values())
  };
}
function truncateUrl(url, maxLen = 20) {
  if (url.length <= maxLen) return url;
  return "…" + url.slice(-(maxLen - 1));
}
function formatSeconds(s) {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}
function generateFlowSVG(navEvents) {
  const { nodes, edges } = buildFlowGraph(navEvents);
  if (nodes.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60"><text x="10" y="30" font-family="system-ui" font-size="14" fill="#888">No navigation events recorded</text></svg>';
  }
  const BOX_W = 160;
  const BOX_H = 50;
  const GAP_X = 40;
  const GAP_Y = 30;
  const COLS = Math.min(3, nodes.length);
  const svgW = COLS * (BOX_W + GAP_X) + GAP_X;
  const svgH = Math.ceil(nodes.length / COLS) * (BOX_H + GAP_Y) + GAP_Y + 40;
  const nodePositions = /* @__PURE__ */ new Map();
  nodes.forEach((node, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    nodePositions.set(node.url, {
      x: GAP_X + col * (BOX_W + GAP_X),
      y: 50 + row * (BOX_H + GAP_Y)
    });
  });
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" font-family="system-ui, sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="#1a1a2e"/>`;
  svg += `<text x="${svgW / 2}" y="28" text-anchor="middle" fill="#a0aec0" font-size="13" font-weight="600">Navigation Flow</text>`;
  for (const edge of edges) {
    const from = nodePositions.get(edge.from);
    const to = nodePositions.get(edge.to);
    if (!from || !to) continue;
    const x1 = from.x + BOX_W / 2;
    const y1 = from.y + BOX_H;
    const x2 = to.x + BOX_W / 2;
    const y2 = to.y;
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4a5568" stroke-width="${Math.min(4, edge.count + 1)}" marker-end="url(#arrow)"/>`;
  }
  svg += `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#4a5568"/></marker></defs>`;
  for (const node of nodes) {
    const pos = nodePositions.get(node.url);
    const avgTime = node.visits > 0 ? node.totalTime / node.visits : 0;
    svg += `<rect x="${pos.x}" y="${pos.y}" width="${BOX_W}" height="${BOX_H}" rx="6" fill="#2d3748" stroke="#4299e1" stroke-width="1.5"/>`;
    svg += `<text x="${pos.x + BOX_W / 2}" y="${pos.y + 18}" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="600">${truncateUrl(node.url)}</text>`;
    svg += `<text x="${pos.x + BOX_W / 2}" y="${pos.y + 34}" text-anchor="middle" fill="#a0aec0" font-size="10">${node.visits}x · avg ${formatSeconds(avgTime)}</text>`;
  }
  svg += "</svg>";
  return svg;
}
function downloadFlowDiagram(navEvents, sessionName) {
  const svg = generateFlowSVG(navEvents);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = sessionName ? `recap-flow-${sessionName}-${ts}.svg` : `recap-flow-${ts}.svg`;
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
const PREFIX = "recap-panel";
const STYLES = `
  .${PREFIX}-root {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    max-height: 70vh;
    background: #1a1a2e;
    color: #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    user-select: none;
  }
  .${PREFIX}-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: #16213e;
    border-bottom: 1px solid #2d3748;
    cursor: move;
    flex-shrink: 0;
  }
  .${PREFIX}-title {
    font-weight: 700;
    font-size: 14px;
    color: #4299e1;
    letter-spacing: 0.05em;
  }
  .${PREFIX}-close {
    background: none;
    border: none;
    color: #a0aec0;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    padding: 0 4px;
  }
  .${PREFIX}-close:hover { color: #fff; }
  .${PREFIX}-body {
    overflow-y: auto;
    padding: 12px 14px;
    flex: 1;
  }
  .${PREFIX}-section {
    margin-bottom: 14px;
  }
  .${PREFIX}-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #718096;
    margin-bottom: 6px;
  }
  .${PREFIX}-select {
    width: 100%;
    background: #2d3748;
    color: #e2e8f0;
    border: 1px solid #4a5568;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
  }
  .${PREFIX}-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .${PREFIX}-stat {
    background: #2d3748;
    border-radius: 4px;
    padding: 6px 8px;
    text-align: center;
  }
  .${PREFIX}-stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #4299e1;
  }
  .${PREFIX}-stat-key {
    font-size: 10px;
    color: #718096;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .${PREFIX}-toggles {
    display: flex;
    gap: 8px;
  }
  .${PREFIX}-toggle {
    flex: 1;
    padding: 7px 6px;
    background: #2d3748;
    border: 1px solid #4a5568;
    border-radius: 4px;
    color: #a0aec0;
    cursor: pointer;
    font-size: 11px;
    font-family: system-ui, sans-serif;
    text-align: center;
    transition: all 0.15s;
  }
  .${PREFIX}-toggle:hover { background: #3a4a6b; color: #e2e8f0; }
  .${PREFIX}-toggle.active {
    background: #2b6cb0;
    border-color: #4299e1;
    color: #bee3f8;
  }
  .${PREFIX}-flow {
    background: #0f0f23;
    border-radius: 4px;
    padding: 8px;
    max-height: 120px;
    overflow-y: auto;
    font-size: 11px;
    color: #a0aec0;
  }
  .${PREFIX}-flow-item {
    padding: 2px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .${PREFIX}-flow-arrow {
    color: #4299e1;
    margin: 0 4px;
  }
  .${PREFIX}-exports {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
  }
  .${PREFIX}-btn {
    padding: 7px 4px;
    background: #2d3748;
    border: 1px solid #4a5568;
    border-radius: 4px;
    color: #e2e8f0;
    cursor: pointer;
    font-size: 10px;
    font-family: system-ui, sans-serif;
    text-align: center;
    transition: background 0.15s;
  }
  .${PREFIX}-btn:hover { background: #3a4a6b; }
  .${PREFIX}-btn.primary {
    background: #2b6cb0;
    border-color: #4299e1;
    color: #bee3f8;
  }
  .${PREFIX}-btn.primary:hover { background: #2c5282; }
  .${PREFIX}-btn.danger {
    background: #742a2a;
    border-color: #fc8181;
    color: #fed7d7;
  }
  .${PREFIX}-btn.danger:hover { background: #9b2c2c; }
  .${PREFIX}-footer {
    padding: 8px 14px;
    border-top: 1px solid #2d3748;
    text-align: center;
    flex-shrink: 0;
  }
  .${PREFIX}-clear-link {
    background: none;
    border: none;
    color: #718096;
    font-size: 11px;
    cursor: pointer;
    text-decoration: underline;
    font-family: system-ui, sans-serif;
  }
  .${PREFIX}-clear-link:hover { color: #fc8181; }
  .${PREFIX}-toast {
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #276749;
    color: #c6f6d5;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    z-index: 10001;
    animation: ${PREFIX}-fadein 0.2s ease;
  }
  @keyframes ${PREFIX}-fadein {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
let _panelRoot = null;
let _styleEl = null;
let _currentSessionId = "";
let _allEvents = [];
function injectStyles() {
  if (_styleEl) return;
  _styleEl = document.createElement("style");
  _styleEl.textContent = STYLES;
  document.head.appendChild(_styleEl);
}
function showToast(message, duration = 2500) {
  const toast = document.createElement("div");
  toast.className = `${PREFIX}-toast`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.parentElement?.removeChild(toast), 300);
  }, duration);
}
function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m${Math.round(seconds % 60)}s`;
}
async function loadSessionData(sessionId) {
  try {
    return await getSessionEvents(sessionId);
  } catch {
    return [];
  }
}
function getClicks(events) {
  return events.filter((e) => e.type === "click");
}
function getScrolls(events) {
  return events.filter((e) => e.type === "scroll");
}
function getNavs(events) {
  return events.filter((e) => e.type === "navigation");
}
function buildNavFlowHTML(events) {
  const navs = getNavs(events).filter((n) => n.to);
  if (navs.length === 0) return '<div style="color:#718096;font-style:italic">No navigation recorded</div>';
  const path = navs.map((n) => n.to);
  let html = "";
  for (let i = 0; i < path.length; i++) {
    const url = path[i];
    html += `<div class="${PREFIX}-flow-item">`;
    if (i > 0) html += `<span class="${PREFIX}-flow-arrow">→</span>`;
    html += `<span title="${url}">${url}</span>`;
    html += "</div>";
  }
  return html;
}
function getStats(events) {
  const navs = getNavs(events);
  const scrolls = getScrolls(events);
  const pages = new Set(navs.map((n) => n.to).filter(Boolean)).size;
  const maxScroll = scrolls.reduce((m, s) => Math.max(m, s.maxDepth), 0);
  const duration = events.length > 1 ? Math.round((events[events.length - 1].timestamp - events[0].timestamp) / 1e3) : 0;
  return {
    clicks: getClicks(events).length,
    pages,
    duration,
    maxScroll
  };
}
async function openPanel() {
  if (_panelRoot) {
    let sessions2 = [];
    try {
      sessions2 = await getAllSessions();
    } catch {
    }
    _allEvents = await loadSessionData(_currentSessionId);
    render(_panelRoot, sessions2);
    _panelRoot.style.display = "flex";
    return;
  }
  injectStyles();
  initHeatmapCanvas();
  let sessions = [];
  try {
    sessions = await getAllSessions();
  } catch {
  }
  _currentSessionId = getSessionId();
  _allEvents = await loadSessionData(_currentSessionId);
  _panelRoot = document.createElement("div");
  _panelRoot.className = `${PREFIX}-root`;
  _panelRoot.setAttribute("data-recap-panel", "true");
  render(_panelRoot, sessions);
  document.body.appendChild(_panelRoot);
  makeDraggable(_panelRoot);
}
function render(root, sessions) {
  const stats = getStats(_allEvents);
  const sessionOptions = sessions.map(
    (s) => `<option value="${s.sessionId}" ${s.sessionId === _currentSessionId ? "selected" : ""}>
          ${s.sessionId.slice(0, 8)} (${s.eventCount} events)
        </option>`
  ).join("");
  root.innerHTML = `
    <div class="${PREFIX}-header">
      <span class="${PREFIX}-title">⚡ Recap</span>
      <button class="${PREFIX}-close" aria-label="Close panel">×</button>
    </div>
    <div class="${PREFIX}-body">
      ${sessions.length > 0 ? `<div class="${PREFIX}-section">
               <div class="${PREFIX}-label">Session</div>
               <select class="${PREFIX}-select" id="${PREFIX}-session-select">
                 ${sessionOptions}
               </select>
             </div>` : ""}

      <div class="${PREFIX}-section">
        <div class="${PREFIX}-label">Stats</div>
        <div class="${PREFIX}-stats">
          <div class="${PREFIX}-stat">
            <div class="${PREFIX}-stat-value">${stats.clicks}</div>
            <div class="${PREFIX}-stat-key">Clicks</div>
          </div>
          <div class="${PREFIX}-stat">
            <div class="${PREFIX}-stat-value">${stats.pages}</div>
            <div class="${PREFIX}-stat-key">Pages</div>
          </div>
          <div class="${PREFIX}-stat">
            <div class="${PREFIX}-stat-value">${formatDuration(stats.duration)}</div>
            <div class="${PREFIX}-stat-key">Duration</div>
          </div>
          <div class="${PREFIX}-stat">
            <div class="${PREFIX}-stat-value">${stats.maxScroll}%</div>
            <div class="${PREFIX}-stat-key">Max Scroll</div>
          </div>
        </div>
      </div>

      <div class="${PREFIX}-section">
        <div class="${PREFIX}-label">Overlays</div>
        <div class="${PREFIX}-toggles">
          <button class="${PREFIX}-toggle ${isHeatmapVisible() ? "active" : ""}" id="${PREFIX}-toggle-heatmap">
            🔥 Heatmap
          </button>
          <button class="${PREFIX}-toggle ${"active"}" id="${PREFIX}-toggle-scroll">
            📏 Scroll Depth
          </button>
        </div>
      </div>

      <div class="${PREFIX}-section">
        <div class="${PREFIX}-label">Navigation Flow</div>
        <div class="${PREFIX}-flow">${buildNavFlowHTML(_allEvents)}</div>
      </div>

      <div class="${PREFIX}-section">
        <div class="${PREFIX}-label">Export</div>
        <div class="${PREFIX}-exports">
          <button class="${PREFIX}-btn primary" id="${PREFIX}-btn-screenshot">📸 Screenshot</button>
          <button class="${PREFIX}-btn primary" id="${PREFIX}-btn-ai">🤖 Export AI</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-json">📄 Raw JSON</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-csv">📊 CSV</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-heatmap-png">🖼 Heatmap PNG</button>
          <button class="${PREFIX}-btn" id="${PREFIX}-btn-flow">🗺 Flow SVG</button>
        </div>
      </div>
    </div>
    <div class="${PREFIX}-footer">
      <button class="${PREFIX}-clear-link" id="${PREFIX}-btn-clear">Clear all session data</button>
    </div>
  `;
  bindEvents(root, sessions);
}
function bindEvents(root, sessions) {
  root.querySelector(`.${PREFIX}-close`)?.addEventListener("click", () => {
    closePanel();
  });
  root.querySelector(`#${PREFIX}-session-select`)?.addEventListener("change", async (e) => {
    _currentSessionId = e.target.value;
    _allEvents = await loadSessionData(_currentSessionId);
    if (isHeatmapVisible()) {
      renderHeatmap(getClicks(_allEvents));
    }
    render(root, sessions);
  });
  root.querySelector(`#${PREFIX}-toggle-heatmap`)?.addEventListener("click", () => {
    if (isHeatmapVisible()) {
      hideHeatmap();
    } else {
      renderHeatmap(getClicks(_allEvents));
      showHeatmap();
    }
    render(root, sessions);
  });
  root.querySelector(`#${PREFIX}-toggle-scroll`)?.addEventListener("click", () => {
    render(root, sessions);
  });
  root.querySelector(`#${PREFIX}-btn-screenshot`)?.addEventListener("click", () => {
    closePanel();
    renderHeatmap(getClicks(_allEvents));
    showHeatmap();
    enterScreenshotMode();
  });
  root.querySelector(`#${PREFIX}-btn-ai`)?.addEventListener("click", () => {
    const sessionName = getSessionName() ?? void 0;
    const summary = summarize(_allEvents, sessionName);
    exportSummaryJSON(summary, sessionName);
    showToast("AI summary exported!");
  });
  root.querySelector(`#${PREFIX}-btn-json`)?.addEventListener("click", () => {
    exportJSON(_allEvents, getSessionName() ?? void 0);
    showToast("JSON exported!");
  });
  root.querySelector(`#${PREFIX}-btn-csv`)?.addEventListener("click", () => {
    exportCSV(_allEvents, getSessionName() ?? void 0);
    showToast("CSV exported!");
  });
  root.querySelector(`#${PREFIX}-btn-heatmap-png`)?.addEventListener("click", () => {
    renderHeatmap(getClicks(_allEvents));
    downloadHeatmapPNG();
    showToast("Heatmap PNG downloaded!");
  });
  root.querySelector(`#${PREFIX}-btn-flow`)?.addEventListener("click", () => {
    downloadFlowDiagram(getNavs(_allEvents), getSessionName() ?? void 0);
    showToast("Flow diagram downloaded!");
  });
  root.querySelector(`#${PREFIX}-btn-clear`)?.addEventListener("click", async () => {
    if (!confirm("Clear all Recap session data? This cannot be undone.")) return;
    try {
      await clearAllSessions();
      clearBuffer();
      _allEvents = [];
      hideHeatmap();
      hideScrollDepthOverlay();
      render(root, []);
      showToast("All session data cleared.");
    } catch (err) {
      console.error("[Recap] Clear error:", err);
    }
  });
}
function makeDraggable(el) {
  const header = el.querySelector(`.${PREFIX}-header`);
  if (!header) return;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let origRight = 20;
  let origBottom = 20;
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origRight = parseInt(el.style.right || "20", 10);
    origBottom = parseInt(el.style.bottom || "20", 10);
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.right = `${origRight - dx}px`;
    el.style.bottom = `${origBottom - dy}px`;
    el.style.left = "auto";
    el.style.top = "auto";
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}
function closePanel() {
  if (_panelRoot) _panelRoot.style.display = "none";
}
function isPanelOpen() {
  return _panelRoot !== null && _panelRoot.style.display !== "none";
}
let _initialized = false;
let _destroyFns = [];
const Recap = {
  /**
   * Initialize the tracker with optional config.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  init(config = {}) {
    if (_initialized) return;
    _initialized = true;
    if (config.sessionName) setSessionName(config.sessionName);
    if (config.endpoint) setEndpoint(config.endpoint);
    const strip = config.stripQueryParams !== false;
    void purgeOldSessions();
    const stopBuffer = initBuffer(async (events) => {
      await saveEvents(events);
      if (hasEndpoint()) await sendBeaconBatch(events);
    });
    _destroyFns.push(stopBuffer);
    const stopClicks = initClickCapture((e) => push(e), strip);
    const stopScroll = initScrollCapture((e) => push(e), strip);
    const stopNav = initNavigationCapture((e) => push(e), strip);
    _destroyFns.push(stopClicks, stopScroll, stopNav);
    const shortcut = config.shortcut ?? "Alt+Shift+R";
    const onKey = (e) => {
      if (matchesShortcut(e, shortcut)) {
        e.preventDefault();
        if (isPanelOpen()) {
          closePanel();
        } else {
          void flush().then(() => openPanel());
        }
      }
    };
    document.addEventListener("keydown", onKey);
    _destroyFns.push(() => document.removeEventListener("keydown", onKey));
    if (config.showPanel) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => void openPanel(), { once: true });
      } else {
        void openPanel();
      }
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flush();
    });
  },
  /** Manually flush the event buffer. */
  flush() {
    return flush();
  },
  /** Get the current session ID. */
  getSessionId() {
    return getSessionId();
  },
  /** Open the researcher panel programmatically. */
  openPanel() {
    return flush().then(() => openPanel());
  },
  /** Close the researcher panel. */
  closePanel() {
    closePanel();
  },
  /** Export current session as JSON. */
  exportJSON() {
    const events = getBuffer();
    exportJSON(events);
  },
  /** Export current session as CSV. */
  exportCSV() {
    const events = getBuffer();
    exportCSV(events);
  },
  /** Export AI summary. */
  exportAI() {
    const events = getBuffer();
    const summary = summarize(events);
    exportSummaryJSON(summary);
  },
  /** Tear down all listeners and clean up. */
  destroy() {
    _destroyFns.forEach((fn) => fn());
    _destroyFns = [];
    _initialized = false;
  }
};
function matchesShortcut(e, shortcut) {
  const isMac = typeof navigator !== "undefined" && (navigator.platform?.toLowerCase().includes("mac") || navigator.userAgentData?.platform?.toLowerCase().includes("mac"));
  const parts = shortcut.toUpperCase().split("+");
  const key = parts[parts.length - 1];
  const needsCtrl = parts.includes("CTRL");
  const needsShift = parts.includes("SHIFT");
  const needsMeta = parts.includes("META") || parts.includes("CMD");
  const needsAlt = parts.includes("ALT");
  const ctrlOrMeta = isMac ? e.metaKey : e.ctrlKey;
  const codeKey = e.code.replace(/^Key/, "").replace(/^Digit/, "");
  return codeKey === key && (!needsCtrl || ctrlOrMeta) && (!needsShift || e.shiftKey) && (!needsMeta || e.metaKey) && (!needsAlt || e.altKey);
}
function readScriptConfig() {
  let script = null;
  if (typeof document !== "undefined" && document.currentScript) {
    script = document.currentScript;
  } else {
    const scripts = document.querySelectorAll("script[src]");
    for (const s of Array.from(scripts)) {
      if (s.src.includes("recap")) {
        script = s;
        break;
      }
    }
  }
  if (!script || !("dataset" in script)) return {};
  const el = script;
  const config = {};
  if (el.dataset["sessionName"]) config.sessionName = el.dataset["sessionName"];
  if (el.dataset["showPanel"] === "true") config.showPanel = true;
  if (el.dataset["endpoint"]) config.endpoint = el.dataset["endpoint"];
  if (el.dataset["shortcut"]) config.shortcut = el.dataset["shortcut"];
  if (el.dataset["stripQueryParams"] === "false") config.stripQueryParams = false;
  return config;
}
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const autoConfig = readScriptConfig();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Recap.init(autoConfig), { once: true });
  } else {
    Recap.init(autoConfig);
  }
}
export {
  Recap,
  Recap as default,
  summarize
};
