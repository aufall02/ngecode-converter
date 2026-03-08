/**
 * Selamat datang di NgeCode Converter! (TypeScript)
 * Tulis atau paste kode TypeScript kamu di sini,
 * lalu lihat flowchart-nya otomatis terbentuk.
 */

interface Mahasiswa {
  nama: string;
  nim: string;
  nilai: number[];
}

function hitungRataRata(nilai: number[]): number {
  if (nilai.length === 0) return 0;
  const total = nilai.reduce((acc, n) => acc + n, 0);
  return total / nilai.length;
}

function getGrade(rata: number): string {
  if (rata >= 90) return "A";
  if (rata >= 80) return "B";
  if (rata >= 70) return "C";
  if (rata >= 60) return "D";
  return "E";
}

function cetakLaporan(mahasiswa: Mahasiswa): void {
  const rata = hitungRataRata(mahasiswa.nilai);
  const grade = getGrade(rata);
  console.log(`${mahasiswa.nama} (${mahasiswa.nim})`);
  console.log(`Rata-rata: ${rata.toFixed(2)} → Grade: ${grade}`);
}

const daftarMahasiswa: Mahasiswa[] = [
  { nama: "Eva", nim: "2021001", nilai: [85, 90, 78] },
  { nama: "Aldori", nim: "2021002", nilai: [70, 65, 80] },
  { nama: "Kanig", nim: "2021003", nilai: [95, 92, 98] },
];

daftarMahasiswa.forEach((mhs) => {
  cetakLaporan(mhs);
});
