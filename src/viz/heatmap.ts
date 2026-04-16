/*
 * Heatmap renderer — adapted from simpleheat by Vladimir Agafonkin
 * Original: https://github.com/mourner/simpleheat
 * License: BSD-2-Clause
 *
 * Copyright (c) 2015, Vladimir Agafonkin
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 */

import type { ClickEvent } from '../types.js';

const DEFAULT_RADIUS = 25;
const DEFAULT_BLUR = 15;
const DEFAULT_OPACITY = 0.65;

// Color gradient: blue → cyan → green → yellow → red
const DEFAULT_GRADIENT: Record<number, string> = {
  0.4: 'blue',
  0.65: 'lime',
  1: 'red',
};

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _circle: HTMLCanvasElement | null = null;
let _colorGradient: Uint8ClampedArray | null = null;
let _radius = DEFAULT_RADIUS;
let _blur = DEFAULT_BLUR;
let _clicks: ClickEvent[] = [];
let _scrollScheduled = false;

function handleScroll(): void {
  if (_canvas?.style.display === 'none') return;
  if (_scrollScheduled) return;
  _scrollScheduled = true;
  requestAnimationFrame(() => {
    _scrollScheduled = false;
    renderHeatmap(_clicks);
  });
}

function createCircle(radius: number, blur: number): HTMLCanvasElement {
  const r = radius + blur;
  const d = 2 * r;
  const c = document.createElement('canvas');
  c.width = d;
  c.height = d;
  const cx = c.getContext('2d')!;
  const grad = cx.createRadialGradient(r, r, blur, r, r, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, d, d);
  return c;
}

function createColorGradient(stops: Record<number, string>): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 1;
  const cx = c.getContext('2d')!;
  const grad = cx.createLinearGradient(0, 0, 256, 0);
  for (const [stop, color] of Object.entries(stops)) {
    grad.addColorStop(Number(stop), color);
  }
  cx.fillStyle = grad;
  cx.fillRect(0, 0, 256, 1);
  return cx.getImageData(0, 0, 256, 1).data;
}

function colorize(pixels: ImageData, gradient: Uint8ClampedArray): void {
  const data = pixels.data;
  for (let i = 0, len = data.length; i < len; i += 4) {
    const alpha = data[i + 3]!;
    if (alpha > 0) {
      const idx = alpha * 4;
      data[i] = gradient[idx]!;
      data[i + 1] = gradient[idx + 1]!;
      data[i + 2] = gradient[idx + 2]!;
      data[i + 3] = alpha;
    }
  }
}

export function initHeatmapCanvas(): HTMLCanvasElement {
  if (_canvas) return _canvas;

  _canvas = document.createElement('canvas');
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
  _canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(_canvas);
  window.addEventListener('scroll', handleScroll, { passive: true });

  _ctx = _canvas.getContext('2d')!;
  _circle = createCircle(DEFAULT_RADIUS, DEFAULT_BLUR);
  _colorGradient = createColorGradient(DEFAULT_GRADIENT);
  _radius = DEFAULT_RADIUS;
  _blur = DEFAULT_BLUR;

  return _canvas;
}

function resizeCanvas(): void {
  if (!_canvas) return;
  _canvas.width = window.innerWidth;
  _canvas.height = window.innerHeight;
}

export function renderHeatmap(clicks: ClickEvent[]): void {
  if (!_canvas || !_ctx) return;

  _clicks = clicks;
  resizeCanvas();
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

  if (clicks.length === 0) return;

  // Use pageX/pageY (document-relative) adjusted by current scroll offset
  // so dots stay aligned with page content as the user scrolls.
  _ctx.globalAlpha = 0.05;
  for (const click of clicks) {
    const r = _radius + _blur;
    _ctx.drawImage(_circle!, click.pageX - window.scrollX - r, click.pageY - window.scrollY - r);
  }

  // Colorize
  const imageData = _ctx.getImageData(0, 0, _canvas.width, _canvas.height);
  colorize(imageData, _colorGradient!);
  _ctx.putImageData(imageData, 0, 0);
}

export function showHeatmap(): void {
  if (_canvas) _canvas.style.display = 'block';
}

export function hideHeatmap(): void {
  if (_canvas) _canvas.style.display = 'none';
}

export function isHeatmapVisible(): boolean {
  return _canvas?.style.display !== 'none';
}

export function getHeatmapDataURL(): string | null {
  if (!_canvas) return null;
  return _canvas.toDataURL('image/png');
}

export function destroyHeatmap(): void {
  if (_canvas) {
    window.removeEventListener('scroll', handleScroll);
    _canvas.parentElement?.removeChild(_canvas);
    _canvas = null;
    _ctx = null;
  }
}
