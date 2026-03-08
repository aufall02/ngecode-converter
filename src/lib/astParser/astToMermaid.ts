// ─── AST → Mermaid Router ─────────────────────────────────────────────────────
// Thin orchestration layer. All diagram logic lives in its own module:
//
//   flowchart.ts     ← control-flow diagram (active)
//   structure.ts     ← class/function structure diagram (ready, UI hidden)
//   dependencies.ts  ← import/export graph (ready, UI hidden)
//   sequence.ts      ← call sequence diagram (ready, UI hidden)
//
// To add a new diagram type:
//   1. Create src/lib/astParser/my-diagram.ts
//   2. Export a `generateMyDiagram(ast, ...): MermaidResult` function
//   3. Add an entry to getDiagramTypes() below
//   4. Add a case to astToMermaid() below
//   5. (Optional) Unhide the selector in the UI
//
// Backward-compatible exports: all types & FlowDirection are re-exported here
// so existing importers (`acorn/index.ts`, `+page.svelte`, etc.) keep working.

import type { Node } from "acorn";

// ─── Re-export shared types ───────────────────────────────────────────────────
export type {
  DiagramType,
  NodeLoc,
  MermaidResult,
  FlowDirection,
} from "./types";

// ─── Import diagram generators ────────────────────────────────────────────────
import { generateFlowchart } from "./flowchart";
import { generateClassStructure } from "./structure";
import { generateDependencies } from "./dependencies";
import { generateSequence } from "./sequence";

import type { MermaidResult, FlowDirection, DiagramType } from "./types";

// ─── Diagram registry ─────────────────────────────────────────────────────────

/**
 * Returns the list of diagram types exposed in the UI.
 * To enable a hidden type: move it out of the commented block below and
 * uncomment the import in the UI selector.
 */
export function getDiagramTypes(): DiagramType[] {
  return [
    {
      type: "flowchart",
      name: "Flowchart",
      description:
        "Shows control flow: conditions, loops, and calls per function",
    },
    // Uncomment to enable in UI:
    // {
    //   type: "structure",
    //   name: "Class Structure",
    //   description: "Shows classes, methods, and properties",
    // },
    // {
    //   type: "dependencies",
    //   name: "Dependencies",
    //   description: "Shows import/export relationships",
    // },
    // {
    //   type: "sequence",
    //   name: "Sequence",
    //   description: "Shows function call sequence",
    // },
  ];
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Convert an Acorn AST to a Mermaid diagram string.
 * Delegates to the appropriate generator based on `diagramType`.
 */
export function astToMermaid(
  ast: Node,
  diagramType: string,
  flowDirection: FlowDirection = "TD",
): MermaidResult {
  try {
    switch (diagramType) {
      case "flowchart":
        return generateFlowchart(ast, flowDirection);
      case "structure":
        return generateClassStructure(ast);
      case "dependencies":
        return generateDependencies(ast);
      case "sequence":
        return generateSequence(ast);
      default:
        return generateFlowchart(ast, flowDirection);
    }
  } catch (err: unknown) {
    const e = err as { message?: string };
    return {
      success: false,
      diagram: "",
      error: e.message ?? "Failed to convert AST to diagram",
    };
  }
}
