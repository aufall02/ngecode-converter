// ─── Dependencies Diagram Generator ───────────────────────────────────────────
// Generates a Mermaid flowchart LR showing import/export relationships.
//
// Add this diagram type to getDiagramTypes() in astToMermaid.ts and it will
// automatically appear in the UI selector.

import type { Node } from "acorn";
import { walkSimple, toAN, sanitizeId, sanitizeLabel, getNodeName } from "./helpers";
import type { MermaidResult } from "./types";

// ─── Internal types ───────────────────────────────────────────────────────────

interface ImportInfo {
  source: string;
  specifiers: string[];
}

interface ExportInfo {
  name: string;
  type: "default" | "named" | "all";
}

// ─── Public: generateDependencies ────────────────────────────────────────────

/**
 * Walk the AST and collect all ImportDeclaration / ExportDeclaration nodes,
 * then render them as a left-to-right flowchart.
 */
export function generateDependencies(ast: Node): MermaidResult {
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const moduleName = "ThisModule";

  walkSimple(ast, {
    ImportDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const source = toAN(node.source).value as string;
      const specifiers: string[] = [];
      if (Array.isArray(node.specifiers)) {
        for (const spec of node.specifiers as unknown[]) {
          const s = toAN(spec);
          if (s.type === "ImportDefaultSpecifier") {
            specifiers.push(getNodeName(s.local));
          } else if (s.type === "ImportNamespaceSpecifier") {
            specifiers.push(`* as ${getNodeName(s.local)}`);
          } else {
            specifiers.push(getNodeName(s.imported));
          }
        }
      }
      imports.push({ source, specifiers });
    },

    ExportDefaultDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      let name = "default";
      if (node.declaration) {
        const decl = toAN(node.declaration);
        if (decl.id) name = getNodeName(decl.id);
        else if (decl.type === "Identifier") name = getNodeName(decl);
      }
      exports.push({ name, type: "default" });
    },

    ExportNamedDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (node.declaration) {
        const decl = toAN(node.declaration);
        if (decl.id) {
          exports.push({ name: getNodeName(decl.id), type: "named" });
        } else if (Array.isArray(decl.declarations)) {
          for (const d of decl.declarations as unknown[]) {
            exports.push({ name: getNodeName(toAN(d).id), type: "named" });
          }
        }
      }
      if (Array.isArray(node.specifiers)) {
        for (const spec of node.specifiers as unknown[]) {
          exports.push({
            name: getNodeName(toAN(spec).exported),
            type: "named",
          });
        }
      }
    },

    ExportAllDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const source = toAN(node.source).value as string;
      exports.push({ name: `re-export from ${source}`, type: "all" });
    },
  });

  if (imports.length === 0 && exports.length === 0) {
    return {
      success: false,
      diagram: "",
      error:
        "No import/export statements found. Add some imports or exports to see the dependency graph.",
    };
  }

  const lines: string[] = ["flowchart LR"];
  const seenSources = new Set<string>();

  lines.push(`  ${sanitizeId(moduleName)}["📦 ${moduleName}"]`);

  for (const imp of imports) {
    const srcId = sanitizeId(imp.source);
    if (!seenSources.has(srcId)) {
      const label = imp.source.startsWith(".")
        ? `📄 ${imp.source}`
        : `📦 ${imp.source}`;
      lines.push(`  ${srcId}["${sanitizeLabel(label)}"]`);
      seenSources.add(srcId);
    }
    const edgeLabel =
      imp.specifiers.length > 0
        ? imp.specifiers.slice(0, 3).join(", ") +
          (imp.specifiers.length > 3 ? "..." : "")
        : "import";
    lines.push(
      `  ${srcId} -->|"${sanitizeLabel(edgeLabel)}"| ${sanitizeId(moduleName)}`,
    );
  }

  if (exports.length > 0) {
    lines.push(`  Exports["🚀 Exports"]`);
    for (const exp of exports) {
      const label =
        exp.type === "default"
          ? `default: ${exp.name}`
          : exp.type === "all"
            ? exp.name
            : exp.name;
      lines.push(
        `  ${sanitizeId(moduleName)} -->|"${sanitizeLabel(label)}"| Exports`,
      );
    }
  }

  return { success: true, diagram: lines.join("\n") };
}
