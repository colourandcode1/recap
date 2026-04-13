// Navigation flow diagram — exports an SVG showing the page sequence.

import type { NavigationEvent } from '../types.js';

interface FlowNode {
  url: string;
  visits: number;
  totalTime: number; // seconds
}

interface FlowEdge {
  from: string;
  to: string;
  count: number;
}

function buildFlowGraph(
  navEvents: NavigationEvent[]
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodeMap = new Map<string, FlowNode>();
  const edgeMap = new Map<string, FlowEdge>();

  for (let i = 0; i < navEvents.length; i++) {
    const nav = navEvents[i]!;
    if (nav.to && !nodeMap.has(nav.to)) {
      nodeMap.set(nav.to, { url: nav.to, visits: 0, totalTime: 0 });
    }
    if (nav.to) nodeMap.get(nav.to)!.visits++;

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

  // Calculate time on page from nav timestamps
  for (let i = 0; i < navEvents.length - 1; i++) {
    const cur = navEvents[i]!;
    const next = navEvents[i + 1]!;
    const node = nodeMap.get(cur.to);
    if (node) node.totalTime += (next.timestamp - cur.timestamp) / 1000;
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

function truncateUrl(url: string, maxLen = 20): string {
  if (url.length <= maxLen) return url;
  return '…' + url.slice(-(maxLen - 1));
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

export function generateFlowSVG(navEvents: NavigationEvent[]): string {
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

  const nodePositions = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    nodePositions.set(node.url, {
      x: GAP_X + col * (BOX_W + GAP_X),
      y: 50 + row * (BOX_H + GAP_Y),
    });
  });

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" font-family="system-ui, sans-serif">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="#1a1a2e"/>`;
  svg += `<text x="${svgW / 2}" y="28" text-anchor="middle" fill="#a0aec0" font-size="13" font-weight="600">Navigation Flow</text>`;

  // Draw edges
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

  // Arrow marker
  svg += `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#4a5568"/></marker></defs>`;

  // Draw nodes
  for (const node of nodes) {
    const pos = nodePositions.get(node.url)!;
    const avgTime = node.visits > 0 ? node.totalTime / node.visits : 0;
    svg += `<rect x="${pos.x}" y="${pos.y}" width="${BOX_W}" height="${BOX_H}" rx="6" fill="#2d3748" stroke="#4299e1" stroke-width="1.5"/>`;
    svg += `<text x="${pos.x + BOX_W / 2}" y="${pos.y + 18}" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="600">${truncateUrl(node.url)}</text>`;
    svg += `<text x="${pos.x + BOX_W / 2}" y="${pos.y + 34}" text-anchor="middle" fill="#a0aec0" font-size="10">${node.visits}x · avg ${formatSeconds(avgTime)}</text>`;
  }

  svg += '</svg>';
  return svg;
}

export function downloadFlowDiagram(navEvents: NavigationEvent[], sessionName?: string): void {
  const svg = generateFlowSVG(navEvents);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = sessionName ? `recap-flow-${sessionName}-${ts}.svg` : `recap-flow-${ts}.svg`;
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
