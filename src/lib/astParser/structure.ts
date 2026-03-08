// ─── Class Structure Diagram Generator ────────────────────────────────────────
// Generates a Mermaid classDiagram from the AST.
//
// Detects:
//   • ClassDeclaration  → class box with methods & properties
//   • FunctionDeclaration / arrow function  → shown as a "Functions" module box
//   • Inheritance (extends) → inheritance arrow
//
// To enable in the UI: add "structure" to getDiagramTypes() in astToMermaid.ts
// and uncomment the relevant option in the UI selector.

import type { Node } from "acorn";
import { walkSimple, toAN, sanitizeId, sanitizeLabel, getNodeName } from "./helpers";
import type { MermaidResult } from "./types";

// ─── Internal types ───────────────────────────────────────────────────────────

interface ClassInfo {
  name: string;
  methods: string[];
  properties: string[];
  superClass?: string;
}

// ─── Public: generateClassStructure ──────────────────────────────────────────

/**
 * Generate a Mermaid classDiagram from the AST.
 * Returns success:false if no classes or functions are found.
 */
export function generateClassStructure(ast: Node): MermaidResult {
  const classes = new Map<string, ClassInfo>();
  const functions: string[] = [];
  const variables: string[] = [];

  walkSimple(ast, {
    ClassDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      const className = getNodeName(node.id);
      const info: ClassInfo = {
        name: className,
        methods: [],
        properties: [],
        superClass: node.superClass ? getNodeName(node.superClass) : undefined,
      };

      const body = toAN(node.body);
      if (body && Array.isArray(body.body)) {
        for (const member of body.body as unknown[]) {
          const m = toAN(member);

          if (m.type === "MethodDefinition") {
            const methodName = getNodeName(m.key);
            const kind = m.kind as string;
            const isStatic = m.static as boolean;
            const prefix = isStatic ? "+" : "+";
            const suffix =
              kind === "get" ? " (get)" : kind === "set" ? " (set)" : "()";
            if (methodName !== "constructor") {
              info.methods.push(`${prefix}${methodName}${suffix}`);
            }
          } else if (
            m.type === "PropertyDefinition" ||
            m.type === "ClassProperty"
          ) {
            const propName = getNodeName(m.key);
            const isStatic = m.static as boolean;
            info.properties.push(`${isStatic ? "+" : "+"}${propName}`);
          }
        }
      }

      classes.set(className, info);
    },

    FunctionDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (node.id) {
        functions.push(getNodeName(node.id));
      }
    },

    VariableDeclaration(rawNode) {
      const node = toAN(rawNode as unknown);
      if (!Array.isArray(node.declarations)) return;
      for (const decl of node.declarations as unknown[]) {
        const d = toAN(decl);
        const init = d.init ? toAN(d.init) : null;
        if (
          init &&
          (init.type === "ArrowFunctionExpression" ||
            init.type === "FunctionExpression")
        ) {
          functions.push(getNodeName(d.id));
        } else if (!init || init.type !== "NewExpression") {
          const name = getNodeName(d.id);
          if (name !== "unknown") variables.push(name);
        }
      }
    },
  });

  if (classes.size === 0 && functions.length === 0) {
    return {
      success: false,
      diagram: "",
      error:
        "No classes or functions found. Try a different diagram type or add some code.",
    };
  }

  const lines: string[] = ["classDiagram"];

  // Emit class boxes
  for (const [, info] of classes) {
    lines.push(`  class ${sanitizeId(info.name)} {`);
    for (const prop of info.properties) {
      lines.push(`    ${sanitizeLabel(prop)}`);
    }
    for (const method of info.methods) {
      lines.push(`    ${sanitizeLabel(method)}`);
    }
    lines.push("  }");
  }

  // Emit inheritance arrows
  for (const [, info] of classes) {
    if (info.superClass && classes.has(info.superClass)) {
      lines.push(
        `  ${sanitizeId(info.superClass)} <|-- ${sanitizeId(info.name)}`,
      );
    }
  }

  // Emit standalone functions as a module box
  if (functions.length > 0) {
    lines.push(`  class Functions {`);
    for (const fn of functions.slice(0, 12)) {
      lines.push(`    +${sanitizeLabel(fn)}()`);
    }
    if (functions.length > 12) {
      lines.push(`    +... ${functions.length - 12} more`);
    }
    lines.push("  }");
  }

  // suppress unused-variable warning
  void variables;

  return { success: true, diagram: lines.join("\n") };
}
