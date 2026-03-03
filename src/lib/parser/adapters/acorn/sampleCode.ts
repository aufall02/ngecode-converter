// ─── Sample Code — Acorn Adapter (JS / TS) ────────────────────────────────────
// Sample code per language, ditampilkan saat user pertama kali buka atau
// saat switch ke bahasa yang bersangkutan.

export const acornSampleCode: Record<string, string> = {
  javascript: `/**
 * Selamat datang di NgeCode Converter!
 * Tulis atau paste kode JavaScript kamu di sini,
 * lalu lihat flowchart-nya otomatis terbentuk.
 *
 * Tips:
 *   - Klik card di kanan untuk expand/collapse diagram
 *   - Gunakan scroll/pinch untuk zoom di dalam diagram
 *   - Ganti bahasa lewat selector di header
 */

let features = [
  "Flowchart otomatis dari kode JavaScript & TypeScript",
  "Grouping otomatis per class dan method",
  "Support forEach, map, filter — callback ikut di-walk",
  "Pan & zoom di setiap diagram"
];

function printFeatures() {
  features.forEach((feature, i) => {
    console.log(\`[\${i + 1}] \${feature}\`);
  });
}

function greet(name) {
  if (!name) {
    return "Halo, siapa kamu?";
  }
  return \`Halo, \${name}! Selamat ngoding 🚀\`;
}

printFeatures();
console.log(greet("NgeCode"));
`,

  typescript: `/**
 * Selamat datang di NgeCode Converter! (TypeScript)
 * Tulis atau paste kode TypeScript kamu di sini,
 * lalu lihat flowchart-nya otomatis terbentuk.
 *
 * Tips:
 *   - Klik card di kanan untuk expand/collapse diagram
 *   - Gunakan scroll/pinch untuk zoom di dalam diagram
 *   - Ganti bahasa lewat selector di header
 */

const features: string[] = [
  "Flowchart otomatis dari kode JavaScript & TypeScript",
  "Grouping otomatis per class dan method",
  "Support forEach, map, filter — callback ikut di-walk",
  "Pan & zoom di setiap diagram"
];

function printFeatures(): void {
  features.forEach((feature: string, i: number) => {
    console.log(\`[\${i + 1}] \${feature}\`);
  });
}

function greet(name: string): string {
  if (!name) {
    return "Halo, siapa kamu?";
  }
  return \`Halo, \${name}! Selamat ngoding 🚀\`;
}

printFeatures();
console.log(greet("NgeCode"));
`,
};
