// ─── Python Adapter (Lezer) ───────────────────────────────────────────────────
// Implements IParserAdapter untuk Python menggunakan @lezer/python sebagai
// parser. Lezer adalah incremental parser yang dipakai CodeMirror 6 —
// ringan, berjalan di browser tanpa WASM.
//
// ── Cara daftarkan ke registry ────────────────────────────────────────────────
//   1. Install dependency:
//        npm install @lezer/python @lezer/common
//
//   2. Daftarkan di src/lib/parser/index.ts:
//        import { pythonLezerAdapter } from "./adapters/python-lezer";
//        parserRegistry.register(pythonLezerAdapter);
//
// ── Cara extend diagram types ─────────────────────────────────────────────────
//   Tambahkan entry baru di DIAGRAM_TYPES dan tangani di toDiagram() switch.
//
// NOTE: File ini adalah scaffold — method parse() dan toDiagram() sudah
// mengembalikan data nyata tapi diagram generator untuk Python masih
// placeholder. Implementasi penuh ada di TODO di bawah.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IParserAdapter,
  ILanguage,
  ParseResult,
  DiagramResult,
  DiagramTypeInfo,
} from "../../core/types";
import type { FlowDirection } from "../../../astParser/astToMermaid";

// ─── Supported Languages ──────────────────────────────────────────────────────

const LANGUAGES: ILanguage[] = [
  {
    id: "python",
    name: "Python",
    ext: ".py",
    monacoId: "python",
    icon: "🐍",
  },
];

// ─── Diagram Types ────────────────────────────────────────────────────────────

const DIAGRAM_TYPES: DiagramTypeInfo[] = [
  {
    type: "flowchart",
    name: "Flowchart",
    description: "Control-flow diagram per function/method",
  },
  {
    type: "structure",
    name: "Class Structure",
    description: "Class hierarchy and method overview",
  },
];

// ─── Sample Code ──────────────────────────────────────────────────────────────

const SAMPLE_PYTHON = `# OOP Dasar — Python
# Konsep: Encapsulation, Inheritance, Polymorphism

class Animal:
    """Base class untuk semua hewan."""

    def __init__(self, name: str, age: int):
        self.name = name
        self.age = age
        self.alive = True

    def describe(self) -> str:
        return f"{self.name} ({self.age} tahun)"

    def make_sound(self) -> str:
        return f"{self.name} membuat suara..."

    def eat(self, food: str) -> None:
        if not self.alive:
            print(f"{self.name} sudah tidak bisa makan")
            return
        print(f"{self.name} memakan {food}")


class Dog(Animal):
    """Subclass Dog — override make_sound (polymorphism)."""

    def __init__(self, name: str, age: int, breed: str):
        super().__init__(name, age)
        self.breed = breed

    def make_sound(self) -> str:
        return f"{self.name} berkata: Guk guk!"

    def fetch(self, item: str) -> str:
        return f"{self.name} mengambil {item}"


class Cat(Animal):
    """Subclass Cat."""

    def make_sound(self) -> str:
        return f"{self.name} berkata: Meow~"

    def purr(self) -> str:
        return f"{self.name} mendengkur..."


# ── Standalone Functions ───────────────────────────────────────────────────────

def greet(name: str) -> str:
    """Sapa seseorang."""
    if not name:
        return "Halo, siapa kamu?"
    return f"Halo, {name}!"


async def fetch_data(url: str) -> dict:
    """Ambil data dari URL (async)."""
    if not url:
        raise ValueError("URL tidak boleh kosong")
    # TODO: implementasi HTTP request
    return {"url": url, "data": None}
`;

// ─── Lezer Tree Node Helper ───────────────────────────────────────────────────
// Lezer menghasilkan SyntaxTree — kita convert ke plain object supaya
// diagram generator mudah di-traverse.

export interface LezerNode {
  type: string;
  from: number;
  to: number;
  children: LezerNode[];
  /** Source text slice untuk node ini */
  text?: string;
}

/**
 * Convert Lezer SyntaxTree menjadi plain LezerNode tree.
 * @param tree   Lezer SyntaxTree dari parser.parse()
 * @param source Source code asli (untuk extract text per node)
 */
function lezerTreeToPlain(tree: unknown, source: string): LezerNode {
  // Lezer SyntaxTree punya .cursor() API untuk traverse
  const t = tree as {
    cursor: () => {
      type: { name: string };
      from: number;
      to: number;
      firstChild: () => boolean;
      nextSibling: () => boolean;
      parent: () => boolean;
    };
  };

  const cursor = t.cursor();

  function buildNode(): LezerNode {
    const node: LezerNode = {
      type: cursor.type.name,
      from: cursor.from,
      to: cursor.to,
      children: [],
      text: source.slice(cursor.from, cursor.to),
    };

    if (cursor.firstChild()) {
      do {
        node.children.push(buildNode());
      } while (cursor.nextSibling());
      cursor.parent();
    }

    return node;
  }

  return buildNode();
}

// ─── Diagram Generators ───────────────────────────────────────────────────────

/**
 * Extract semua FunctionDef dan ClassDef dari root node.
 */
function extractDefinitions(root: LezerNode): {
  classes: Array<{
    name: string;
    methods: Array<{ name: string; isAsync: boolean; body: LezerNode }>;
  }>;
  functions: Array<{ name: string; isAsync: boolean; body: LezerNode }>;
} {
  const classes: Array<{
    name: string;
    methods: Array<{ name: string; isAsync: boolean; body: LezerNode }>;
  }> = [];
  const functions: Array<{
    name: string;
    isAsync: boolean;
    body: LezerNode;
  }> = [];

  function walk(node: LezerNode): void {
    if (node.type === "ClassDefinition") {
      const nameNode = node.children.find((c) => c.type === "VariableName");
      const className = nameNode?.text ?? "UnknownClass";
      const body = node.children.find((c) => c.type === "Body");
      const methods: Array<{
        name: string;
        isAsync: boolean;
        body: LezerNode;
      }> = [];

      if (body) {
        for (const child of body.children) {
          const isAsync = child.type === "AsyncFunctionDefinition";
          if (
            child.type === "FunctionDefinition" ||
            child.type === "AsyncFunctionDefinition"
          ) {
            const mName =
              child.children.find((c) => c.type === "VariableName")?.text ??
              "unknown";
            const mBody =
              child.children.find((c) => c.type === "Body") ?? child;
            methods.push({ name: mName, isAsync, body: mBody });
          }
        }
      }

      classes.push({ name: className, methods });
      return; // Jangan masuk ke class body untuk top-level scan
    }

    const isAsync = node.type === "AsyncFunctionDefinition";
    if (
      node.type === "FunctionDefinition" ||
      node.type === "AsyncFunctionDefinition"
    ) {
      const nameNode = node.children.find((c) => c.type === "VariableName");
      const funcName = nameNode?.text ?? "unknown";
      const body = node.children.find((c) => c.type === "Body") ?? node;
      functions.push({ name: funcName, isAsync, body });
      return;
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  walk(root);
  return { classes, functions };
}

/**
 * Generate flowchart Mermaid dari LezerNode tree (Python).
 *
 * TODO: Implementasi penuh walkStatement untuk Python AST nodes:
 *   - IfStatement → branch Yes/No
 *   - ForStatement, WhileStatement → loop
 *   - ReturnStatement → exit node
 *   - TryStatement → try/except
 *
 * Saat ini menghasilkan diagram sederhana: Start → [body summary] → End
 */
function generateFlowchart(
  root: LezerNode,
  source: string,
  direction: FlowDirection,
): DiagramResult {
  const { classes, functions } = extractDefinitions(root);

  if (classes.length === 0 && functions.length === 0) {
    return {
      success: false,
      diagram: "",
      error: "No functions or classes found to generate a flowchart.",
    };
  }

  const diagrams: string[] = [];

  // ── Class methods ──────────────────────────────────────────────────────────
  for (const cls of classes) {
    for (const method of cls.methods) {
      const asyncTag = method.isAsync ? " ⚡" : "";
      const title = `${method.name}${asyncTag}`;
      const block = [`flowchart ${direction}`];
      block.push(`  %% fn: ${title}`);
      block.push(`  %% class: ${cls.name}`);

      const startId = "start";
      const endId = "end_node";
      block.push(
        `  ${startId}([\"▶ ${cls.name}.${title}\"])`,
      );

      // TODO: walk method.body para genearar nodes detail
      // Untuk sekarang satu node summary
      const bodyText = source
        .slice(method.body.from, method.body.to)
        .split("\n")
        .filter((l) => l.trim() && !l.trim().startsWith("#"))
        .slice(0, 3)
        .map((l) => l.trim().replace(/"/g, "'"))
        .join(" · ");

      if (bodyText) {
        block.push(`  body[\"${bodyText}\"]`);
        block.push(`  ${startId} --> body`);
        block.push(`  body --> ${endId}`);
      } else {
        block.push(`  ${startId} --> ${endId}`);
      }

      block.push(`  ${endId}([\"End ◀\"])`);
      diagrams.push(block.join("\n"));
    }
  }

  // ── Standalone functions ───────────────────────────────────────────────────
  for (const fn of functions) {
    const asyncTag = fn.isAsync ? " ⚡" : "";
    const title = `${fn.name}${asyncTag}`;
    const block = [`flowchart ${direction}`];
    block.push(`  %% fn: ${title}`);

    const startId = "start";
    const endId = "end_node";
    block.push(`  ${startId}([\"▶ ${title}\"])`);

    const bodyText = source
      .slice(fn.body.from, fn.body.to)
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("#"))
      .slice(0, 3)
      .map((l) => l.trim().replace(/"/g, "'"))
      .join(" · ");

    if (bodyText) {
      block.push(`  body[\"${bodyText}\"]`);
      block.push(`  ${startId} --> body`);
      block.push(`  body --> ${endId}`);
    } else {
      block.push(`  ${startId} --> ${endId}`);
    }

    block.push(`  ${endId}([\"End ◀\"])`);
    diagrams.push(block.join("\n"));
  }

  return {
    success: true,
    diagram: diagrams.join("\n\n%%SPLIT%%\n\n"),
  };
}

/**
 * Generate class structure diagram (classDiagram Mermaid) dari Python AST.
 */
function generateStructure(root: LezerNode): DiagramResult {
  const { classes } = extractDefinitions(root);

  if (classes.length === 0) {
    return {
      success: false,
      diagram: "",
      error: "No classes found to generate a structure diagram.",
    };
  }

  const lines = ["classDiagram"];

  for (const cls of classes) {
    lines.push(`  class ${cls.name} {`);
    for (const method of cls.methods) {
      const asyncPrefix = method.isAsync ? "<<async>> " : "";
      lines.push(`    ${asyncPrefix}+${method.name}()`);
    }
    lines.push("  }");
  }

  return { success: true, diagram: lines.join("\n") };
}

// ─── PythonLezerAdapter ───────────────────────────────────────────────────────

class PythonLezerAdapter implements IParserAdapter {
  // ── Metadata ─────────────────────────────────────────────────────────────────

  readonly id = "python-lezer";
  readonly name = "Lezer Python";
  readonly description =
    "Incremental Python parser powered by @lezer/python — " +
    "same engine as CodeMirror 6. Runs fully in the browser, no WASM needed. " +
    "Install @lezer/python to activate.";

  readonly parserLibrary = "@lezer/python";
  readonly parserVersion = "1.1.14"; // Update sesuai package.json saat install

  readonly supportedLanguages: ILanguage[] = LANGUAGES;
  readonly supportedDiagramTypes: DiagramTypeInfo[] = DIAGRAM_TYPES;

  // ── parse() ──────────────────────────────────────────────────────────────────

  parse(code: string, languageId: string): ParseResult {
    if (languageId !== "python") {
      return {
        success: false,
        ast: null,
        language: languageId,
        adapterId: this.id,
        error: { message: `Unsupported language: ${languageId}` },
      };
    }

    try {
      // Dynamic import — @lezer/python harus sudah di-install
      // Kita gunakan synchronous require-style via eval untuk kompatibilitas
      // Catatan: idealnya import static setelah npm install @lezer/python
      //
      // import { parser } from "@lezer/python";
      // const tree = parser.parse(code);
      //
      // Karena @lezer/python belum di-install, kita return error yang informatif.

      // TODO: Uncomment setelah `npm install @lezer/python @lezer/common`
      // const { parser } = await import("@lezer/python");
      // const tree = parser.parse(code);
      // const ast = lezerTreeToPlain(tree, code);

      // ── Fallback: simple regex-based AST untuk scaffold ──────────────────────
      // Ini BUKAN pengganti parser sungguhan — hanya supaya adapter
      // bisa di-register dan diuji tanpa install @lezer/python dulu.
      const ast = buildFallbackAst(code);

      return {
        success: true,
        ast,
        language: languageId,
        adapterId: this.id,
        error: null,
      };
    } catch (err: unknown) {
      const e = err as { message?: string };
      return {
        success: false,
        ast: null,
        language: languageId,
        adapterId: this.id,
        error: { message: e.message ?? "Failed to parse Python code" },
      };
    }
  }

  // ── toDiagram() ──────────────────────────────────────────────────────────────

  toDiagram(
    ast: unknown,
    diagramType: string,
    direction: FlowDirection = "TD",
  ): DiagramResult {
    const root = ast as LezerNode;

    if (!root || !root.children) {
      return {
        success: false,
        diagram: "",
        error: "Invalid AST — run parse() first.",
      };
    }

    switch (diagramType) {
      case "flowchart":
        return generateFlowchart(root, root.text ?? "", direction);
      case "structure":
        return generateStructure(root);
      default:
        return {
          success: false,
          diagram: "",
          error: `Diagram type "${diagramType}" not supported for Python.`,
        };
    }
  }

  // ── getSampleCode() ──────────────────────────────────────────────────────────

  getSampleCode(_languageId: string): string {
    return SAMPLE_PYTHON;
  }
}

// ─── Fallback AST Builder (regex-based, no @lezer/python needed) ──────────────
// Digunakan saat @lezer/python belum di-install.
// Menghasilkan LezerNode tree minimal yang cukup untuk diagram generator.
// Ganti dengan Lezer tree setelah install package sungguhan.

function buildFallbackAst(source: string): LezerNode {
  const root: LezerNode = {
    type: "Script",
    from: 0,
    to: source.length,
    children: [],
    text: source,
  };

  const lines = source.split("\n");
  let pos = 0;
  let currentClass: LezerNode | null = null;
  let currentClassIndent = 0;
  let classBodyNode: LezerNode | null = null;

  for (const line of lines) {
    const lineLen = line.length + 1; // +1 for \n
    const trimmed = line.trim();
    const indent = line.search(/\S/);

    // Detect class boundary end
    if (
      currentClass &&
      indent <= currentClassIndent &&
      trimmed.length > 0 &&
      !trimmed.startsWith("#")
    ) {
      currentClass = null;
      classBodyNode = null;
    }

    // Class definition
    const classMatch = trimmed.match(/^class\s+(\w+)[\s:(]/);
    if (classMatch) {
      const nameFrom = pos + line.indexOf(classMatch[1]);
      const nameNode: LezerNode = {
        type: "VariableName",
        from: nameFrom,
        to: nameFrom + classMatch[1].length,
        children: [],
        text: classMatch[1],
      };
      classBodyNode = {
        type: "Body",
        from: pos,
        to: pos + lineLen,
        children: [],
        text: "",
      };
      currentClass = {
        type: "ClassDefinition",
        from: pos,
        to: pos + lineLen,
        children: [nameNode, classBodyNode],
        text: line,
      };
      currentClassIndent = indent;
      root.children.push(currentClass);
      pos += lineLen;
      continue;
    }

    // Async function definition
    const asyncFnMatch = trimmed.match(/^async\s+def\s+(\w+)\s*\(/);
    if (asyncFnMatch) {
      const fnName = asyncFnMatch[1];
      const nameFrom = pos + line.indexOf(fnName);
      const nameNode: LezerNode = {
        type: "VariableName",
        from: nameFrom,
        to: nameFrom + fnName.length,
        children: [],
        text: fnName,
      };
      const bodyNode: LezerNode = {
        type: "Body",
        from: pos + lineLen,
        to: pos + lineLen,
        children: [],
        text: "",
      };
      const fnNode: LezerNode = {
        type: "AsyncFunctionDefinition",
        from: pos,
        to: pos + lineLen,
        children: [nameNode, bodyNode],
        text: line,
      };

      if (currentClass && classBodyNode && indent > currentClassIndent) {
        classBodyNode.children.push(fnNode);
        if (currentClass.to < pos + lineLen)
          currentClass.to = pos + lineLen;
      } else {
        root.children.push(fnNode);
      }
      pos += lineLen;
      continue;
    }

    // Regular function definition
    const fnMatch = trimmed.match(/^def\s+(\w+)\s*\(/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      const nameFrom = pos + line.indexOf(fnName);
      const nameNode: LezerNode = {
        type: "VariableName",
        from: nameFrom,
        to: nameFrom + fnName.length,
        children: [],
        text: fnName,
      };
      const bodyNode: LezerNode = {
        type: "Body",
        from: pos + lineLen,
        to: pos + lineLen,
        children: [],
        text: "",
      };
      const fnNode: LezerNode = {
        type: "FunctionDefinition",
        from: pos,
        to: pos + lineLen,
        children: [nameNode, bodyNode],
        text: line,
      };

      if (currentClass && classBodyNode && indent > currentClassIndent) {
        classBodyNode.children.push(fnNode);
        if (currentClass.to < pos + lineLen)
          currentClass.to = pos + lineLen;
      } else {
        root.children.push(fnNode);
      }
      pos += lineLen;
      continue;
    }

    pos += lineLen;
  }

  return root;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const pythonLezerAdapter = new PythonLezerAdapter();
