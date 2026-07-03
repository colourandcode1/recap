// Playback controls — fixed bottom-centre bar: play/pause, scrubber, speed,
// elapsed/total time, warnings, exit. Lives outside the researcher panel so
// the scrubber has room and the panel can stay closed during replay.

import type { ReplaySession } from './replay.js';
import type { ReplaySpeed } from './scheduler.js';

const PREFIX = 'recap-replay-bar';
const SPEEDS: ReplaySpeed[] = [1, 2, 4];

let _root: HTMLDivElement | null = null;
let _styleEl: HTMLStyleElement | null = null;

const STYLES = `
.${PREFIX} {
  position: fixed;
  bottom: 20px; left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  background: #1c2333;
  color: #fff;
  font: 500 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 10px 16px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  z-index: 2147483002;
  min-width: 420px;
  max-width: calc(100vw - 40px);
}
.${PREFIX} button {
  background: none;
  border: none;
  color: #fff;
  font: inherit;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
}
.${PREFIX} button:hover { background: rgba(255,255,255,0.12); }
.${PREFIX}-play { font-size: 15px; width: 34px; }
.${PREFIX}-seek {
  flex: 1;
  accent-color: #4f7cff;
  cursor: pointer;
  min-width: 160px;
}
.${PREFIX}-time { font-variant-numeric: tabular-nums; opacity: 0.85; white-space: nowrap; }
.${PREFIX}-speed { min-width: 38px; text-align: center; border: 1px solid rgba(255,255,255,0.25) !important; border-radius: 6px; }
.${PREFIX}-warning {
  position: fixed;
  bottom: 72px; left: 50%;
  transform: translateX(-50%);
  background: #6b4b12;
  color: #ffe3ad;
  font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 6px 12px;
  border-radius: 8px;
  z-index: 2147483002;
  max-width: calc(100vw - 40px);
  text-align: center;
}
`;

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface ReplayControls {
  destroy(): void;
}

/**
 * Build the playback bar for a replay session. `onExit` is called when the
 * facilitator clicks ✕ (the caller stops the session and tears down).
 */
export function createControls(session: ReplaySession, onExit: () => void): ReplayControls {
  destroyControlsDom();

  _styleEl = document.createElement('style');
  _styleEl.textContent = STYLES;
  document.head.appendChild(_styleEl);

  _root = document.createElement('div');
  _root.className = PREFIX;
  _root.setAttribute('data-ut-no-track', '');

  const duration = session.getDuration();
  _root.innerHTML = `
    <button class="${PREFIX}-play" type="button" aria-label="Play">▶</button>
    <input class="${PREFIX}-seek" type="range" min="0" max="${Math.ceil(duration)}" step="1" value="0" aria-label="Seek" />
    <span class="${PREFIX}-time">0:00 / ${formatTime(duration)}</span>
    <button class="${PREFIX}-speed" type="button" aria-label="Playback speed">1×</button>
    <button class="${PREFIX}-exit" type="button" aria-label="Exit replay">✕</button>
  `;
  document.body.appendChild(_root);

  const playBtn = _root.querySelector<HTMLButtonElement>(`.${PREFIX}-play`)!;
  const seek = _root.querySelector<HTMLInputElement>(`.${PREFIX}-seek`)!;
  const timeEl = _root.querySelector<HTMLSpanElement>(`.${PREFIX}-time`)!;
  const speedBtn = _root.querySelector<HTMLButtonElement>(`.${PREFIX}-speed`)!;
  const exitBtn = _root.querySelector<HTMLButtonElement>(`.${PREFIX}-exit`)!;

  // Warnings (viewport mismatch, multi-pageload) as a chip above the bar
  const warnings = session.getWarnings();
  if (warnings.length > 0) {
    const chip = document.createElement('div');
    chip.className = `${PREFIX}-warning`;
    chip.setAttribute('data-ut-no-track', '');
    chip.textContent = `⚠ ${warnings.join(' ')}`;
    document.body.appendChild(chip);
  }

  let scrubbing = false;

  playBtn.addEventListener('click', () => {
    if (session.isPlaying()) {
      session.pause();
      playBtn.textContent = '▶';
    } else {
      session.play();
      playBtn.textContent = '⏸';
    }
  });

  seek.addEventListener('input', () => {
    scrubbing = true;
    session.seek(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    scrubbing = false;
  });

  speedBtn.addEventListener('click', () => {
    const next = SPEEDS[(SPEEDS.indexOf(session.getSpeed()) + 1) % SPEEDS.length]!;
    session.setSpeed(next);
    speedBtn.textContent = `${next}×`;
  });

  exitBtn.addEventListener('click', onExit);

  session.onTick((t) => {
    if (!scrubbing) seek.value = String(Math.floor(t));
    timeEl.textContent = `${formatTime(t)} / ${formatTime(duration)}`;
  });

  session.onEnd(() => {
    playBtn.textContent = '▶';
  });

  return { destroy: destroyControlsDom };
}

function destroyControlsDom(): void {
  _root?.remove();
  _root = null;
  _styleEl?.remove();
  _styleEl = null;
  document.querySelectorAll(`.${PREFIX}-warning`).forEach((el) => el.remove());
}
