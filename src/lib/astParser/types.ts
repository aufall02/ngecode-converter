// ─── Shared Types ─────────────────────────────────────────────────────────────
// Semua type & interface yang dipakai bersama oleh diagram generators.
// Import dari sini, bukan dari astToMermaid langsung.

export interface DiagramType {
  type: string;
  name: string;
  description: string;
}

export interface NodeLoc {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface MermaidResult {
  success: boolean;
  diagram: string;
  error?: string;
  /** Map dari mermaid node ID → posisi source code */
  nodePositions?: Record<string, NodeLoc>;
}

export type FlowDirection = "TD" | "LR";
