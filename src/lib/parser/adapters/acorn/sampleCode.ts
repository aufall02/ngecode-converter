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

  typescript: `// OOP Dasar - TypeScript
// Konsep: Interface, Abstract Class, Encapsulation, Inheritance, Polymorphism

// ── Interface ─────────────────────────────────────────────────────────────────
interface Describable {
  describe(): string;
}

interface Soundable {
  makeSound(): string;
}

// ── Abstract Base Class ───────────────────────────────────────────────────────
abstract class Animal implements Describable, Soundable {
  protected name: string;
  protected age: number;
  private alive: boolean;

  constructor(name: string, age: number) {
    this.name  = name;
    this.age   = age;
    this.alive = true;
  }

  describe(): string {
    return this.name + " (" + this.age + " tahun)";
  }

  // Abstract method — wajib diimplementasikan subclass
  abstract makeSound(): string;

  eat(food: string): void {
    if (!this.alive) {
      console.log(this.name + " sudah tidak bisa makan");
      return;
    }
    console.log(this.name + " makan " + food);
  }

  sleep(): void {
    console.log(this.name + " sedang tidur...");
  }
}

// ── Inheritance: Dog ──────────────────────────────────────────────────────────
class Dog extends Animal {
  private breed: string;

  constructor(name: string, age: number, breed: string) {
    super(name, age);
    this.breed = breed;
  }

  makeSound(): string {
    return this.name + " berkata: Guk guk!";
  }

  fetch(item: string): string {
    console.log(this.name + " mengambil " + item);
    return item;
  }

  getBreed(): string {
    return this.breed;
  }
}

// ── Inheritance: Cat ──────────────────────────────────────────────────────────
class Cat extends Animal {
  private indoor: boolean;

  constructor(name: string, age: number, indoor: boolean) {
    super(name, age);
    this.indoor = indoor;
  }

  makeSound(): string {
    return this.name + " berkata: Meong!";
  }

  purr(): void {
    console.log(this.name + " mendengkur...");
  }

  isIndoor(): boolean {
    return this.indoor;
  }
}

// ── Encapsulation: BankAccount ────────────────────────────────────────────────
class BankAccount {
  private owner: string;
  private balance: number;

  constructor(owner: string, initialBalance: number) {
    this.owner   = owner;
    this.balance = initialBalance;
  }

  getBalance(): number {
    return this.balance;
  }

  getOwner(): string {
    return this.owner;
  }

  deposit(amount: number): boolean {
    if (amount <= 0) {
      console.log("Jumlah deposit harus lebih dari 0");
      return false;
    }
    this.balance += amount;
    console.log("Deposit " + amount + " berhasil");
    return true;
  }

  withdraw(amount: number): boolean {
    if (amount <= 0) {
      console.log("Jumlah penarikan harus lebih dari 0");
      return false;
    }
    if (amount > this.balance) {
      console.log("Saldo tidak cukup");
      return false;
    }
    this.balance -= amount;
    console.log("Penarikan " + amount + " berhasil");
    return true;
  }
}

// ── Main Program ──────────────────────────────────────────────────────────────
function main(): void {
  const dog = new Dog("Rex", 3, "Labrador");
  const cat = new Cat("Mimi", 2, true);

  // Polymorphism — array of Animal, tiap objek punya makeSound() sendiri
  const animals: Animal[] = [dog, cat];
  for (let i = 0; i < animals.length; i++) {
    console.log(animals[i].makeSound());
    console.log(animals[i].describe());
  }

  // Encapsulation
  const acc = new BankAccount("Budi", 1000000);
  acc.deposit(500000);
  acc.withdraw(200000);
  console.log("Saldo akhir: " + acc.getBalance());
}

main();
`,
};
