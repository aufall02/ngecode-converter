<script lang="ts">
    import {
        BookOpen,
        CheckCircle,
        XCircle,
        AlertTriangle,
        Tag,
        ArrowLeft,
        Zap,
        Play,
        GitBranch,
    } from "lucide-svelte";

    interface ChangelogEntry {
        version: string;
        date: string;
        changes: { type: "added" | "improved" | "fixed"; text: string }[];
    }

    const changelog: ChangelogEntry[] = [
        {
            version: "0.4.0",
            date: "2025",
            changes: [
                { type: "added", text: "Refactor diagram engine — setiap diagram type kini punya file terpisah (flowchart.ts, structure.ts, dll)" },
                { type: "added", text: "TypeScript sample code — switch JS ↔ TS sekarang update konten editor secara otomatis" },
                { type: "fixed", text: "Fix bug: editor tidak update saat ganti bahasa (Svelte 5 $effect dependency tracking)" },
            ],
        },
        {
            version: "0.3.0",
            date: "2025",
            changes: [
                { type: "added", text: "TypeScript support — type annotations di-strip otomatis sebelum parsing" },
                { type: "added", text: "Pan & zoom di setiap diagram card" },
                { type: "added", text: "Grouping otomatis per class dan method" },
                { type: "added", text: "Collapse / expand diagram card" },
                { type: "improved", text: "forEach, map, filter, reduce callback dirender sebagai loop body" },
            ],
        },
        {
            version: "0.2.0",
            date: "2025",
            changes: [
                { type: "added", text: "Export diagram ke SVG & PNG" },
                { type: "added", text: "Share via URL (code di-encode ke query param)" },
                { type: "added", text: "Save & load snippet di localStorage" },
                { type: "improved", text: "Async function ditandai dengan ⚡" },
            ],
        },
        {
            version: "0.1.0",
            date: "2025",
            changes: [
                { type: "added", text: "Initial release — JavaScript → Flowchart" },
                { type: "added", text: "Monaco Editor dengan syntax highlighting" },
                { type: "added", text: "Flowchart otomatis: if/else, switch, for, while, return, try/catch" },
            ],
        },
    ];

    // ── Flowchart: yang didukung untuk KONVERSI ke diagram ────────────────────
    const flowchartSupported = [
        {
            category: "Kondisi",
            icon: "🔀",
            items: [
                { label: "if / else", note: "termasuk else-if chain" },
                { label: "switch / case", note: "termasuk default" },
                { label: "Ternary (a ? b : c)", note: "ditampilkan sebagai label ekspresi" },
            ],
        },
        {
            category: "Loop",
            icon: "🔁",
            items: [
                { label: "for (init; test; update)", note: "classic for loop" },
                { label: "while (condition)", note: "" },
                { label: "do...while (condition)", note: "" },
                { label: "for...of", note: "array, iterable" },
                { label: "for...in", note: "object keys" },
                { label: "forEach(callback)", note: "callback di-walk sebagai loop body" },
                { label: "map / filter / reduce / find / some / every", note: "callback di-walk sebagai loop body" },
            ],
        },
        {
            category: "Fungsi & Class",
            icon: "🧩",
            items: [
                { label: "function declaration", note: "function foo() {}" },
                { label: "arrow function (variable)", note: "const foo = () => {}" },
                { label: "async function", note: "ditandai ⚡ di diagram" },
                { label: "class declaration", note: "setiap method jadi diagram tersendiri" },
                { label: "class method", note: "digroup per class" },
                { label: "constructor", note: "diikutsertakan" },
            ],
        },
        {
            category: "Statement",
            icon: "📝",
            items: [
                { label: "return", note: "ditampilkan sebagai terminal node (rounded)" },
                { label: "throw", note: "ditampilkan sebagai terminal node" },
                { label: "try / catch", note: "edge bertanda 'error' ke catch block" },
                { label: "variable declaration", note: "const / let / var" },
                { label: "assignment expression", note: "x = value" },
                { label: "function call", note: "ditampilkan sebagai call node (🔧)" },
            ],
        },
        {
            category: "Bahasa",
            icon: "🌐",
            items: [
                { label: "JavaScript (.js / .mjs)", note: "full support" },
                { label: "TypeScript (.ts)", note: "type annotations di-strip otomatis sebelum parsing" },
            ],
        },
    ];

    const flowchartLimitations = [
        // { text: "JSX belum didukung", detail: "Acorn tidak parse JSX secara native — komponen React/Solid belum bisa dikonversi" },
        { text: "Decorator TypeScript diabaikan", detail: "Di-strip sebelum parsing, tidak muncul di diagram" },
        { text: "Generic type kompleks mungkin tidak ter-strip sempurna", detail: "Edge case pada nested generic seperti Map<K, V[]>" },
        { text: "Function overload (TS) hanya ambil implementasi terakhir", detail: "Overload signature diabaikan, hanya body implementasi yang di-walk" },
        { text: "Dynamic property access tidak di-resolve", detail: "obj[key] ditampilkan apa adanya, nilai key tidak dievaluasi" },
    ];

    // ── Run mode: yang didukung untuk EKSEKUSI & ANIMASI ─────────────────────
    const runSupported = [
        {
            category: "Tipe data & ekspresi",
            icon: "🔢",
            items: [
                { label: "number, string, boolean, null, undefined", note: "" },
                { label: "array & object literal", note: "[], {}" },
                { label: "template literal", note: "`Hello ${name}`" },
                { label: "operator aritmatika & logika", note: "+, -, *, /, %, &&, ||, ??" },
                { label: "destructuring assignment", note: "const { a, b } = obj" },
                { label: "spread operator", note: "[...arr], {...obj}" },
            ],
        },
        {
            category: "Kontrol alur",
            icon: "🔀",
            items: [
                { label: "if / else / else-if", note: "path yang diambil dianimasi di flowchart" },
                { label: "switch / case", note: "case yang aktif disorot" },
                { label: "for / while / do-while", note: "tiap iterasi terlihat di animasi" },
                { label: "for...of / for...in", note: "" },
                { label: "forEach / map / filter / reduce", note: "callback di-trace tiap elemen" },
                { label: "return / throw", note: "node terminal disorot saat tercapai" },
                { label: "try / catch", note: "path error terlihat jika exception terjadi" },
                { label: "break / continue", note: "loop keluar lebih awal terlihat di animasi" },
            ],
        },
        {
            category: "Fungsi",
            icon: "🧩",
            items: [
                { label: "function declaration & call", note: "tiap pemanggilan fungsi di-trace" },
                { label: "arrow function", note: "const fn = () => {}" },
                { label: "rekursi", note: "dibatasi max call depth" },
                { label: "default parameter", note: "function foo(x = 0) {}" },
                { label: "rest parameter", note: "function foo(...args) {}" },
            ],
        },
        {
            category: "Built-in yang tersedia",
            icon: "📦",
            items: [
                { label: "console.log / warn / error", note: "output muncul di panel console" },
                { label: "Math.*", note: "Math.max, Math.floor, dll" },
                { label: "Array.*", note: "Array.isArray, Array.from, dll" },
                { label: "Object.*", note: "Object.keys, Object.entries, dll" },
                { label: "JSON.parse / JSON.stringify", note: "" },
                { label: "String / Number / Boolean", note: "wrapper & conversion" },
                { label: "parseInt / parseFloat / isNaN / isFinite", note: "" },
                { label: "setTimeout / clearTimeout", note: "terbatas, tidak block animasi" },
            ],
        },
    ];

    const runLimitations = [
        { text: "import / require tidak bisa dieksekusi", detail: "Kode dijalankan di sandbox terisolasi — tidak ada module resolver. Semua dependensi harus inline." },
        { text: "DOM & browser API tidak tersedia", detail: "Tidak ada window, document, localStorage, fetch, dll. Kode dijalankan di Web Worker." },
        { text: "Maksimal 10.000 iterasi per loop", detail: "Untuk mencegah infinite loop membekukan browser. Kode akan dihentikan jika melebihi batas ini." },
        { text: "Maksimal kedalaman rekursi 500 call", detail: "Rekursi yang terlalu dalam akan dilempar sebagai error dan animasi berhenti di situ." },
        { text: "Tidak ada akses ke file system", detail: "readFile, writeFile, dan sejenisnya tidak tersedia." },
        { text: "async/await terbatas", detail: "Promise dan async function bisa dijalankan, tapi animasinya bersifat sequential — timing asli tidak dipertahankan." },
        { text: "TypeScript perlu di-strip dulu", detail: "Sebelum dieksekusi, type annotation dihapus otomatis. Logika tetap berjalan, tapi type info hilang." },
    ];

    const comingSoon = [
        { text: "▶ Run mode — animasi eksekusi langsung di flowchart", hot: true },
        { text: "Python support", hot: false },
        { text: "Diagram tipe lain: Class Structure, Dependencies, Sequence", hot: false },
        { text: "Step-through debugger — jalankan kode satu langkah per langkah", hot: true },
        { text: "Console output panel di samping diagram", hot: false },
        { text: "Dark mode penuh", hot: false },
        { text: "Keyboard shortcuts", hot: false },
    ];
</script>

<svelte:head>
    <title>Docs — NgeCode Converter</title>
</svelte:head>

<div class="min-h-screen bg-[#FDF6E3] text-[#657b83]">

    <!-- Header -->
    <header class="border-b border-[#93a1a1]/20 bg-[#FDF6E3] sticky top-0 z-10">
        <div class="max-w-4xl mx-auto px-6 h-14 flex items-center gap-4">
            <a
                href="/"
                class="flex items-center gap-1.5 text-sm text-[#93a1a1] hover:text-[#268bd2] transition-colors"
            >
                <ArrowLeft size={14} />
                <span>Kembali</span>
            </a>
            <div class="h-4 w-px bg-[#93a1a1]/30"></div>
            <div class="flex items-center gap-2">
                <BookOpen size={15} class="text-[#268bd2]" />
                <span class="font-semibold text-[#586e75]">Dokumentasi</span>
            </div>
        </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-10 space-y-16">

        <!-- Hero -->
        <section>
            <h1 class="text-2xl font-bold text-[#586e75] mb-2">NgeCode Converter</h1>
            <p class="text-[#93a1a1] text-sm leading-relaxed max-w-2xl">
                Tulis kode JavaScript atau TypeScript, lalu lihat flowchart-nya terbentuk otomatis.
                Halaman ini berisi daftar lengkap konstruk yang didukung untuk masing-masing fitur,
                limitasi yang perlu diketahui, dan changelog.
            </p>
        </section>

        <!-- ── SECTION 1: FLOWCHART ─────────────────────────────────────────── -->
        <section class="space-y-6">

            <!-- Section title -->
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                    <GitBranch size={18} class="text-[#859900]" />
                    <h2 class="text-lg font-bold text-[#586e75]">Flowchart — Konversi Kode</h2>
                </div>
                <div class="flex-1 h-px bg-[#93a1a1]/20"></div>
            </div>

            <p class="text-sm text-[#93a1a1] leading-relaxed -mt-2">
                Kode kamu diparse menjadi AST, lalu setiap konstruk (if, loop, fungsi, dll) dikonversi
                jadi node & edge di flowchart Mermaid. Berikut konstruk yang dikenali dan ditampilkan di diagram.
            </p>

            <!-- Supported -->
            <div>
                <h3 class="text-sm font-semibold text-[#586e75] mb-4 flex items-center gap-2">
                    <CheckCircle size={14} class="text-[#859900]" />
                    Konstruk yang Didukung
                </h3>
                <div class="space-y-5">
                    {#each flowchartSupported as group}
                        <div>
                            <h4 class="text-xs font-medium text-[#93a1a1] uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                                <span>{group.icon}</span>
                                <span>{group.category}</span>
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {#each group.items as item}
                                    <div class="flex items-start gap-2 bg-white border border-[#93a1a1]/15 rounded-lg px-3 py-2">
                                        <CheckCircle size={12} class="text-[#859900] mt-0.5 shrink-0" />
                                        <div class="min-w-0">
                                            <span class="font-mono text-xs text-[#586e75] font-medium">{item.label}</span>
                                            {#if item.note}
                                                <span class="text-xs text-[#93a1a1] ml-1">— {item.note}</span>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Limitations -->
            <div>
                <h3 class="text-sm font-semibold text-[#586e75] mb-4 flex items-center gap-2">
                    <AlertTriangle size={14} class="text-[#b58900]" />
                    Limitasi Flowchart
                </h3>
                <div class="space-y-1.5">
                    {#each flowchartLimitations as item}
                        <div class="flex items-start gap-3 bg-white border border-[#93a1a1]/15 rounded-lg px-4 py-2.5">
                            <XCircle size={12} class="text-[#b58900] mt-0.5 shrink-0" />
                            <div>
                                <p class="text-sm font-medium text-[#586e75]">{item.text}</p>
                                <p class="text-xs text-[#93a1a1] mt-0.5">{item.detail}</p>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

        </section>

        <!-- ── SECTION 2: RUN MODE ──────────────────────────────────────────── -->
        <section class="space-y-6">

            <!-- Section title -->
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2">
                    <Play size={18} class="text-[#268bd2]" />
                    <h2 class="text-lg font-bold text-[#586e75]">Run Mode — Animasi Eksekusi</h2>
                    <span class="text-xs bg-[#268bd2]/10 text-[#268bd2] px-2 py-0.5 rounded-full font-medium">Coming Soon</span>
                </div>
                <div class="flex-1 h-px bg-[#93a1a1]/20"></div>
            </div>

            <p class="text-sm text-[#93a1a1] leading-relaxed -mt-2">
                Kode kamu dijalankan di sandbox terisolasi (Web Worker), lalu setiap langkah eksekusi
                dianimasikan langsung di flowchart — node mana yang aktif, cabang mana yang diambil,
                loop iterasi keberapa, hingga di mana program berhenti. Fitur ini <strong class="text-[#586e75]">bukan debugger kode</strong>,
                melainkan <strong class="text-[#586e75]">visualisasi alur eksekusi</strong> di atas flowchart.
            </p>

            <!-- Supported -->
            <div>
                <h3 class="text-sm font-semibold text-[#586e75] mb-4 flex items-center gap-2">
                    <CheckCircle size={14} class="text-[#859900]" />
                    Yang Bisa Dijalankan
                </h3>
                <div class="space-y-5">
                    {#each runSupported as group}
                        <div>
                            <h4 class="text-xs font-medium text-[#93a1a1] uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                                <span>{group.icon}</span>
                                <span>{group.category}</span>
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {#each group.items as item}
                                    <div class="flex items-start gap-2 bg-white border border-[#93a1a1]/15 rounded-lg px-3 py-2">
                                        <CheckCircle size={12} class="text-[#859900] mt-0.5 shrink-0" />
                                        <div class="min-w-0">
                                            <span class="font-mono text-xs text-[#586e75] font-medium">{item.label}</span>
                                            {#if item.note}
                                                <span class="text-xs text-[#93a1a1] ml-1">— {item.note}</span>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

            <!-- Limitations -->
            <div>
                <h3 class="text-sm font-semibold text-[#586e75] mb-4 flex items-center gap-2">
                    <AlertTriangle size={14} class="text-[#b58900]" />
                    Limitasi Run Mode
                </h3>
                <div class="space-y-1.5">
                    {#each runLimitations as item}
                        <div class="flex items-start gap-3 bg-white border border-[#93a1a1]/15 rounded-lg px-4 py-2.5">
                            <XCircle size={12} class="text-[#dc322f] mt-0.5 shrink-0" />
                            <div>
                                <p class="text-sm font-medium text-[#586e75]">{item.text}</p>
                                <p class="text-xs text-[#93a1a1] mt-0.5">{item.detail}</p>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>

        </section>

        <!-- ── COMING SOON ──────────────────────────────────────────────────── -->
        <section>
            <div class="flex items-center gap-3 mb-5">
                <div class="flex items-center gap-2">
                    <Zap size={16} class="text-[#268bd2]" />
                    <h2 class="text-base font-bold text-[#586e75]">Coming Soon</h2>
                </div>
                <div class="flex-1 h-px bg-[#93a1a1]/20"></div>
            </div>

            <div class="space-y-2">
                {#each comingSoon as item}
                    <div class="flex items-center gap-3 bg-white border rounded-lg px-4 py-2.5
                        {item.hot ? 'border-[#268bd2]/25 bg-[#268bd2]/3' : 'border-[#93a1a1]/15'}">
                        <div class="w-1.5 h-1.5 rounded-full shrink-0
                            {item.hot ? 'bg-[#268bd2]' : 'bg-[#93a1a1]/40'}">
                        </div>
                        <span class="text-sm {item.hot ? 'text-[#586e75] font-medium' : 'text-[#657b83]'}">{item.text}</span>
                        {#if item.hot}
                            <span class="ml-auto text-xs bg-[#268bd2]/10 text-[#268bd2] px-1.5 py-0.5 rounded font-medium shrink-0">soon</span>
                        {/if}
                    </div>
                {/each}
            </div>
        </section>

        <!-- ── CHANGELOG ────────────────────────────────────────────────────── -->
        <section>
            <div class="flex items-center gap-3 mb-5">
                <div class="flex items-center gap-2">
                    <Tag size={16} class="text-[#6c71c4]" />
                    <h2 class="text-base font-bold text-[#586e75]">Changelog</h2>
                </div>
                <div class="flex-1 h-px bg-[#93a1a1]/20"></div>
            </div>

            <div class="space-y-7">
                {#each changelog as entry, i}
                    <div class="relative pl-5 border-l-2 {i === 0 ? 'border-[#268bd2]' : 'border-[#93a1a1]/25'}">
                        <div class="flex items-center gap-2 mb-3">
                            <span class="font-mono text-sm font-bold {i === 0 ? 'text-[#268bd2]' : 'text-[#586e75]'}">
                                v{entry.version}
                            </span>
                            <span class="text-xs text-[#93a1a1]">{entry.date}</span>
                            {#if i === 0}
                                <span class="text-xs bg-[#268bd2]/10 text-[#268bd2] px-1.5 py-0.5 rounded font-medium">latest</span>
                            {/if}
                        </div>

                        <div class="space-y-1.5">
                            {#each entry.changes as change}
                                <div class="flex items-start gap-2">
                                    <span class="text-xs font-mono px-1.5 py-0.5 rounded shrink-0 mt-0.5
                                        {change.type === 'added'    ? 'bg-[#859900]/10 text-[#859900]' :
                                         change.type === 'improved' ? 'bg-[#268bd2]/10 text-[#268bd2]' :
                                                                      'bg-[#dc322f]/10 text-[#dc322f]'}">
                                        {change.type === 'added'    ? '+ added'    :
                                         change.type === 'improved' ? '~ improved' : '✓ fixed'}
                                    </span>
                                    <span class="text-sm text-[#657b83] leading-relaxed">{change.text}</span>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Footer -->
        <section class="border-t border-[#93a1a1]/20 pt-8 pb-4">
            <p class="text-xs text-[#93a1a1] text-center">
                NgeCode Converter adalah proyek open source.
                <a
                    href="https://github.com/aufall02/ngecode-converter"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[#268bd2] hover:underline ml-1"
                >
                    Lihat di GitHub →
                </a>
            </p>
        </section>

    </main>
</div>
