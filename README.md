# NgeCode Converter

> **Visualisasi kode jadi flowchart secara otomatis** — tulis atau paste kode, lihat diagram langsung terbentuk.

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Built with SvelteKit](https://img.shields.io/badge/Built%20with-SvelteKit-FF3E00?logo=svelte)](https://kit.svelte.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)

---

## Apa Ini?

NgeCode Converter adalah tools open-source berbasis web yang mengkonversi source code menjadi **diagram flowchart interaktif** secara real-time. Cocok untuk:

- 📚 **Belajar** — pahami alur logika kode orang lain
- 🎓 **Mengajar** — visualisasikan algoritma ke murid/audiens
- 📝 **Dokumentasi** — generate diagram dari kode yang sudah ada
- 🔍 **Review kode** — lihat control flow secara visual sebelum merge

Terinspirasi dari [AST Explorer](https://astexplorer.net), tapi fokus pada **diagram** bukan raw AST.

---

## Fitur

### ✅ Sudah Ada
| Fitur | Deskripsi |
|---|---|
| **Flowchart otomatis** | Parse kode → generate diagram per function/method |
| **Multi-bahasa** | JavaScript, TypeScript (Python scaffold tersedia) |
| **OOP support** | Class, method, inheritance — dikelompokkan otomatis per class |
| **Higher-order functions** | `forEach`, `map`, `filter`, `reduce` — callback body ikut di-walk |
| **Bidirectional highlight** | Klik node diagram → highlight kode; gerak cursor → highlight node |
| **Pan & zoom** | Setiap diagram bisa di-pan dan zoom bebas |
| **Multi-diagram view** | Banyak function → banyak card, collapsible per class/method |
| **Export** | Download SVG / PNG / Mermaid source |
| **Single diagram mode** | 1 function → full height tanpa chrome |
| **Parser badge** | Tampilkan library parser + versi yang digunakan |


### ⏳ Coming Soon (butuh setup dulu)
| Fitur | Status | Catatan |
|---|---|---|
| **Snippet management** | 🔜 Perlu database | Save/load snippet butuh backend DB — lihat bagian Roadmap |

### 🔜 Roadmap
- [ ] Python (aktifkan `@lezer/python`)
- [ ] Java, Go, Rust via adapter baru
- [ ] Sequence diagram dari function calls
- [ ] Class structure diagram
- [ ] Dark mode
- [ ] Collaborative editing
- [ ] **Snippet backend** — database untuk simpan & share snippet (kandidat: PlanetScale / Turso / Cloudflare D1)
- [ ] User auth untuk snippet private/public

---

## Teknologi

### Frontend
| Library | Versi | Kegunaan |
|---|---|---|
| [SvelteKit](https://kit.svelte.dev) | `^2.50` | Framework utama, routing, SSR |
| [Svelte](https://svelte.dev) | `^5.51` | UI reactivity (Svelte 5 runes) |
| [TypeScript](https://www.typescriptlang.org) | `^5.9` | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | `^4.1` | Styling utility-first |
| [Vite](https://vitejs.dev) | `^7.3` | Build tool & dev server |

### Editor & Diagram
| Library | Versi | Kegunaan |
|---|---|---|
| [Monaco Editor](https://microsoft.github.io/monaco-editor/) | `^0.55` | Code editor (sama seperti VS Code) |
| [Mermaid](https://mermaid.js.org) | `^11.12` | Render diagram ke SVG |
| [svg-pan-zoom](https://github.com/bumbu/svg-pan-zoom) | `^3.6` | Pan & zoom interaktif pada SVG |

### Parser
| Library | Versi | Kegunaan |
|---|---|---|
| [Acorn](https://github.com/acornjs/acorn) | `^8.16` | JavaScript/TypeScript AST parser |
| [acorn-walk](https://github.com/acornjs/acorn/tree/master/acorn-walk) | `^8.3` | AS
T traversal helper |

### Icons
| Library | Versi | Kegunaan |
|---|---|---|
| [Lucide Svelte](https://lucide.dev) | `^0.576` | Icon set |

---

## Arsitektur

```
src/
├── lib/
│   ├── astParser/
│   │   └── astToMermaid.ts      # Core: AST → Mermaid diagram string
│   ├── parser/
│   │   ├── core/
│   │   │   ├── types.ts         # Interface IParserAdapter, DiagramResult, dll
│   │   │   └── registry.ts      # Global singleton registry
│   │   ├── adapters/
│   │   │   ├── acorn/           # JS/TS adapter (aktif)
│   │   │   └── python-lezer/    # Python scaffold (siap diaktifkan)
│   │   └── index.ts             # Auto-register semua adapter
│   └── Components/
│       ├── MonacoEditor.svelte  # Code editor wrapper
│       ├── PanZoomDiagram.svelte # SVG pan/zoom wrapper
│       ├── ResizablePanel.svelte # Split panel kiri-kanan
│       └── ExportPanel.svelte   # Export SVG/PNG/Mermaid
└── routes/
    └── +page.svelte             # Main page
```

### Cara Kerja
```
Source Code (editor)
      │
      ▼
IParserAdapter.parse()     → AST (format per adapter)
      │
      ▼
IParserAdapter.toDiagram() → Mermaid string + nodePositions map
      │
      ├── %%SPLIT%%  (satu blok per function)
      │
      ▼
mermaid.render()           → SVG
      │
      ▼
PanZoomDiagram             → Interaktif di browser
```

---

## Cara Menambah Bahasa Baru

Cukup **3 langkah**, tanpa ubah UI sama sekali:

**1. Buat adapter baru**
```
src/lib/parser/adapters/nama-bahasa/
├── index.ts       # implements IParserAdapter
└── sampleCode.ts  # contoh kode default
```

**2. Implement interface**
```typescript
class MyAdapter implements IParserAdapter {
  readonly id = "my-lang";
  readonly name = "My Language Parser";
  readonly parserLibrary = "my-parser";   // tampil di UI badge
  readonly parserVersion = "1.0.0";
  readonly supportedLanguages = [{ id: "mylang", name: "MyLang", ... }];
  readonly supportedDiagramTypes = [{ type: "flowchart", ... }];

  parse(code, languageId): ParseResult { ... }
  toDiagram(ast, diagramType, direction): DiagramResult { ... }
  getSampleCode(languageId): string { ... }
}
```

**3. Daftarkan di `src/lib/parser/index.ts`**
```typescript
import { myAdapter } from "./adapters/nama-bahasa";
parserRegistry.register(myAdapter);
```

Selesai — bahasa baru otomatis muncul di language selector dan parser badge.

Lihat panduan lengkap di [`ADDING_LANGUAGES.md`](./docs/ADDING_LANGUAGES.md).

---

## Cara Jalankan Lokal

### Prasyarat
- Node.js `>= 18`
- npm `>= 9`

### Install & Jalankan

```bash
# Clone repo
git clone https://github.com/aufall02/ngecode-converter
cd ngecode-converter

# Install dependencies
npm install

# Jalankan dev server
npm run dev
```

Buka di browser: `http://localhost:5173`

### Build Production

```bash
npm run build
npm run preview
```

### Type Check

```bash
npm run check
# atau watch mode:
npm run check:watch
```

---

## Penggunaan

### Dasar
1. **Tulis atau paste kode** di panel kiri
2. **Diagram terbentuk otomatis** di panel kanan
3. Klik **▶ / ▼** pada card untuk expand/collapse diagram
4. **Scroll atau pinch** untuk zoom di dalam diagram
5. **Drag** untuk pan (geser diagram)

### Ganti Bahasa
Klik dropdown bahasa di header (JavaScript / TypeScript) — editor langsung ganti sample code dan re-parse.

### Arah Diagram
Tombol **TD** (top-down) dan **LR** (left-right) di pojok kanan panel diagram.

### Bidirectional Highlight
- **Klik node di diagram** → kode yang bersangkutan di-highlight di editor (background biru)
- **Gerakkan cursor di editor** → node diagram yang bersangkutan dapat glow biru

### Export
Klik tombol **Export** di panel diagram (sebelah kiri tombol TD/LR), pilih format:
- **SVG** — vektor, bisa di-scale bebas
- **PNG** — raster, siap pakai di dokumen
- **Mermaid** — source diagram, bisa di-paste ke Notion, GitHub, dll

### Snippet Management ⚠️ Coming Soon
Fitur snippet (save, fork, share) sementara **disembunyikan** karena membutuhkan setup database backend terlebih dahulu.

> **Rencana ke depan:** snippet akan disimpan di database (kandidat: Cloudflare D1 / Turso / PlanetScale) sehingga bisa benar-benar di-share ke publik via link pendek, bukan hanya URL panjang berbasis encoding.

Untuk saat ini, kode tidak tersimpan antar sesi — refresh halaman akan reset ke sample code.

---

## Kontribusi

Pull request, issue, dan feedback sangat disambut! 🙌

1. Fork repo
2. Buat branch: `git checkout -b feat/nama-fitur`
3. Commit: `git commit -m "feat: tambah adapter Java"`
4. Push: `git push origin feat/nama-fitur`
5. Buat Pull Request

Pastikan `npm run check` tidak menghasilkan error baru sebelum PR.

---

## Lisensi

Proyek ini dirilis di bawah **GNU General Public License v3.0 (GPL-3.0)**.

```
NgeCode Converter — Visualisasi kode sebagai flowchart interaktif
Copyright (C) 2025  NgeCode

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
```

Artinya:
- ✅ **Bebas digunakan** untuk keperluan apapun
- ✅ **Bebas dimodifikasi** dan didistribusikan ulang
- ✅ **Bebas diambil** sebagai basis project baru
- ⚠️ **Wajib open-source** — jika kamu distribusikan versi modifikasi, source code-nya harus ikut dibuka dengan lisensi GPL-3.0 yang sama

---

<p align="center">
  Built with ❤️ by <a href="https://ngecode.id">NgeCode</a> · Code. Teach. Share. Repeat.
</p>
