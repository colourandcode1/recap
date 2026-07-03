// Global capture suppression — held for the entire replay mode so neither
// synthetic replay actions nor the facilitator's own input pollute a session.

let _suppressed = false;

export function suppressCapture(): void {
  _suppressed = true;
}

export function resumeCapture(): void {
  _suppressed = false;
}

export function isCaptureSuppressed(): boolean {
  return _suppressed;
}
