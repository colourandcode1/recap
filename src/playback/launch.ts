// Replay launcher — ties a replay session to its controls bar and makes sure
// researcher overlays are out of the way. The panel closes itself before
// calling this (avoids a panel <-> playback import cycle).

import type { AnyEvent } from '../types.js';
import { startReplay, type ReplaySession } from './replay.js';
import { createControls } from './controls.js';
import { hideHeatmap, isHeatmapVisible } from '../viz/heatmap.js';
import { hideScrollDepthOverlay, isScrollDepthVisible } from '../viz/scroll-depth.js';

/**
 * Start a replay with the playback bar. Playback begins paused so the
 * facilitator can read any warnings before pressing play.
 */
export function launchReplay(events: AnyEvent[]): ReplaySession {
  if (isHeatmapVisible()) hideHeatmap();
  if (isScrollDepthVisible()) hideScrollDepthOverlay();

  const session = startReplay(events);
  const controls = createControls(session, () => session.stop());

  // Tear the controls down whenever the session stops, regardless of who
  // stopped it (exit button, public API, or a new replay starting).
  const innerStop = session.stop;
  session.stop = () => {
    controls.destroy();
    innerStop();
  };

  return session;
}
