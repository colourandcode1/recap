import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob, exportCSV, exportJSON, exportSummaryJSON } from '../../src/storage/export.js';
import type { AnyEvent } from '../../src/types.js';

const sampleEvents: AnyEvent[] = [
  {
    type: 'click',
    sessionId: 'session-1',
    timestamp: 1000,
    url: '/home',
    viewport: { width: 1280, height: 720 },
    x: 10,
    y: 20,
    pageX: 10,
    pageY: 20,
    clientX: 10,
    clientY: 20,
    selector: 'button.cta',
    tagName: 'BUTTON',
    label: 'Start',
    pageRegion: 'center',
  },
];

describe('storage export helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('downloads blobs with sanitized filenames and delayed cleanup', () => {
    const result = downloadBlob(new Blob(['payload']), 'recap:demo/session?.json');

    expect(result).toBe(true);
    const anchor = document.querySelector('a[download]') as HTMLAnchorElement | null;
    expect(anchor).not.toBeNull();
    expect(anchor?.download).toBe('recap-demo-session.json');

    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3999);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('returns false when dispatching download click fails', () => {
    const clickSpy = vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => {
      throw new Error('click blocked');
    });

    const result = downloadBlob(new Blob(['payload']), 'recap.json');

    expect(clickSpy).toHaveBeenCalled();
    expect(result).toBe(false);
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('propagates success/failure contracts for JSON/CSV/AI exporters', () => {
    expect(exportJSON(sampleEvents, 'participant/01')).toBe(true);
    expect(exportCSV(sampleEvents)).toBe(true);
    expect(exportSummaryJSON({ score: 1 }, 'participant/01')).toBe(true);

    const clickSpy = vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(() => {
      throw new Error('click blocked');
    });

    expect(exportJSON(sampleEvents, 'participant/01')).toBe(false);
    expect(exportCSV(sampleEvents)).toBe(false);
    expect(exportSummaryJSON({ score: 1 }, 'participant/01')).toBe(false);
    expect(clickSpy).toHaveBeenCalled();
  });
});
