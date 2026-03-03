# Panduan Menambah Bahasa Baru

Arsitektur parser di project ini dirancang supaya menambah bahasa baru **tidak perlu menyentuh UI sama sekali**.
Cukup buat adapter baru, daftarkan ke registry, dan semua otomatis muncul — language selector, parser badge, sample code.

---

## Konsep Inti

```
Source Code
    │
    ▼
IParserAdapter.parse()        → menghasilkan AST (format bebas, tiap adapter beda)
    │
    ▼
IParserAdapter.toDiagram()    → menghasilkan Mermaid diagram string
    │
    ▼
UI render (PanZoomDiagram)
```

UI **tidak tahu** format AST-nya apa — itu urusan adapter masing-masing.
Yang penting: `parse()` dan `toDiagram()` mengikuti contract `IParserAdapter`.

---

## Langkah-langkah

### 1. Buat folder adapter baru

```
src/lib/parser/adapters/
├── acorn/              ← JavaScript / TypeScript (sudah ada)
├── python-lezer/       ← Python scaffold (sudah ada)
└── nama-bahasa/        ← buat di sini
    ├── index.ts        ← implementasi IParserAdapter
    └── sampleCode.ts   ← contoh kode untuk editor
```

### 2. Install parser library

Pilih parser yang bisa jalan di browser (no WASM murni, atau WASM yang ada NPM package-nya):

| Bahasa     | Parser yang disarankan          | NPM Package              |
|------------|---------------------------------|--------------------------|
| Python     | Lezer Python                    | `@lezer/python`          |
| Java       | java-parser                     | `java-parser`            |
| PHP        | `@prettier/plugin-php` AST      | `php-parser`             |
| Rust       | Lezer Rust                      | `@lezer/rust` (community)|
| Go         | Lezer Go                        | `@lezer/go` (community)  |
| C / C++    | Lezer C++                       | `@lezer/cpp`             |
| Ruby       | ruby-wasm + parser              | `@ruby/wasm`             |

```bash
npm install <nama-package>
```

### 3. Implementasi `index.ts`

Minimal yang harus ada:

```typescript
import type {
  IParserAdapter,
  ILanguage,
  ParseResult,
  DiagramResult,
  DiagramTypeInfo,
} from "../../core/types";
import type { FlowDirection } from "../../../astParser/astToMermaid";

class MyLanguageAdapter implements IParserAdapter {
  // ── Identitas ──────────────────────────────────────────────────────────────

  readonly id = "my-language";           // unik, kebab-case
  readonly name = "My Language Parser";  // ditampilkan di UI
  readonly description = "...";

  // Ditampilkan sebagai badge "Parser: nama-versi" di header
  readonly parserLibrary = "my-parser-lib";
  readonly parserVersion = "1.2.3";       // samakan dengan package.json

  readonly supportedLanguages: ILanguage[] = [
    {
      id: "mylang",          // dipakai sebagai key di registry
      name: "My Language",   // tampil di language selector
      ext: ".ml",
      monacoId: "mylang",    // Monaco language ID (jika ada)
      icon: "🔧",
    },
  ];

  readonly supportedDiagramTypes: DiagramTypeInfo[] = [
    {
      type: "flowchart",
      name: "Flowchart",
      description: "Control-flow per function",
    },
    // tambahkan diagram type lain jika perlu
  ];

  // ── parse() ───────────────────────────────────────────────────────────────

  parse(code: string, languageId: string): ParseResult {
    try {
      // Gunakan parser library pilihan kamu
      const ast = myParserLib.parse(code);

      return {
        success: true,
        ast,                   // format bebas — kamu yang consume di toDiagram()
        language: languageId,
        adapterId: this.id,
        error: null,
      };
    } catch (err: unknown) {
      const e = err as { message?: string; line?: number; column?: number };
      return {
        success: false,
        ast: null,
        language: languageId,
        adapterId: this.id,
        error: {
          message: e.message ?? "Parse error",
          line: e.line,
          column: e.column,
        },
      };
    }
  }

  // ── toDiagram() ──────────────────────────────────────────────────────────

  toDiagram(
    ast: unknown,
    diagramType: string,
    direction: FlowDirection = "TD",
  ): DiagramResult {
    switch (diagramType) {
      case "flowchart":
        return generateFlowchart(ast, direction);
      default:
        return {
          success: false,
          diagram: "",
          error: `Diagram type "${diagramType}" not supported.`,
        };
    }
  }

  // ── getSampleCode() ───────────────────────────────────────────────────────

  getSampleCode(_languageId: string): string {
    return `// contoh kode My Language`;
  }
}

export const myLanguageAdapter = new MyLanguageAdapter();
```

### 4. Daftarkan ke registry

Buka `src/lib/parser/index.ts` dan tambahkan **2 baris**:

```typescript
// di bagian exports
export { myLanguageAdapter } from "./adapters/nama-bahasa/index";

// di bagian auto-registration
import { myLanguageAdapter } from "./adapters/nama-bahasa/index";
parserRegistry.register(myLanguageAdapter);
```

**Selesai.** Tidak ada file lain yang perlu diubah.

---

## Format diagram: `%%SPLIT%%` dan metadata

Untuk flowchart multi-fungsi, `toDiagram()` harus mengembalikan beberapa blok
Mermaid yang dipisah `%%SPLIT%%`. UI akan memisah dan merender masing-masing
sebagai card tersendiri.

Setiap blok juga bisa menyertakan metadata comment untuk grouping di UI:

```
flowchart TD
  %% fn: methodName ⚡          ← nama yang ditampilkan di title bar card
  %% class: ClassName           ← (opsional) group card ini di bawah class header
  start(["▶ ClassName.method"])
  ...
```

- `%% fn: <title>` → wajib, menjadi judul card
- `%% class: <nama>` → opsional, jika ada maka card dikelompokkan dalam class group
- `⚡` di nama → otomatis memunculkan badge "async" kuning

Contoh output `toDiagram()` untuk 2 method dalam 1 class:

```
flowchart TD
  %% fn: constructor
  %% class: Dog
  ...

%%SPLIT%%

flowchart TD
  %% fn: makeSound
  %% class: Dog
  ...

%%SPLIT%%

flowchart TD
  %% fn: greet ⚡
  ...
```

---

## Tips diagram generator

### Traverse AST secara rekursif

Setiap parser punya format AST berbeda. Pola umumnya:

```typescript
function walk(node: MyAstNode): void {
  switch (node.type) {
    case "FunctionDeclaration":
      handleFunction(node);
      break;
    case "ClassDeclaration":
      handleClass(node);
      break;
    default:
      // rekursi ke children
      for (const child of node.children ?? []) {
        walk(child);
      }
  }
}
```

### Generate node ID yang unik

Gunakan counter sederhana supaya ID Mermaid tidak tabrakan antar diagram:

```typescript
let nodeCounter = 0;
function freshId(prefix = "n"): string {
  return `${prefix}${nodeCounter++}`;
}
// Reset counter di awal tiap diagram block
```

### Sanitize label Mermaid

Label yang mengandung `"`, `[`, `]`, `(`, `)` bisa merusak syntax Mermaid:

```typescript
function sanitizeLabel(text: string): string {
  return text.replace(/["[\](){}]/g, (c) => `&#${c.charCodeAt(0)};`);
}
```

---

## Monaco Editor: daftarkan bahasa baru

Jika bahasa kamu belum ada di Monaco secara default, tambahkan di
`src/lib/Components/MonacoEditor.svelte` saat instance Monaco dibuat:

```typescript
monaco.languages.register({ id: "mylang" });
monaco.languages.setMonarchTokensProvider("mylang", {
  tokenizer: {
    root: [
      [/keywords/, "keyword"],
      // ... token rules
    ],
  },
});
```

Kalau bahasa sudah didukung Monaco (python, java, go, rust, cpp, dll),
cukup set `monacoId` yang sesuai di `ILanguage` dan Monaco otomatis
memberikan syntax highlighting.

---

## Checklist sebelum PR

- [ ] `id` adapter unik (tidak tabrakan dengan adapter lain)
- [ ] `parserLibrary` dan `parserVersion` sesuai dengan versi di `package.json`
- [ ] `parse()` mengembalikan `error.line` dan `error.column` jika parser menyediakan
- [ ] `toDiagram()` mengembalikan error yang deskriptif jika tidak ada fungsi/class
- [ ] `getSampleCode()` mengembalikan kode yang cukup menarik untuk demo OOP
- [ ] Adapter didaftarkan di `src/lib/parser/index.ts`
- [ ] `npm run check` tidak menghasilkan error baru