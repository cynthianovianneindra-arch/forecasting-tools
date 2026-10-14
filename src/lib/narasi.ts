// Kontrak narasi: Claude hanya menerima JSON angka dan menulis kalimat. Validator memastikan tidak ada angka baru.

export function collectNumbers(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof v === "number") { out.add(fmtVariants(v)[0]); fmtVariants(v).forEach((x) => out.add(x)); }
  else if (typeof v === "string") (v.match(/\d+(?:[.,]\d+)?/g) ?? []).forEach((m) => out.add(norm(m)));
  else if (Array.isArray(v)) v.forEach((x) => collectNumbers(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collectNumbers(x, out));
  return out;
}
const norm = (s: string) => s.replace(",", ".");
function fmtVariants(n: number): string[] {
  const r = [String(n), n.toFixed(0), n.toFixed(1), n.toFixed(2), String(Math.round(n))];
  return r.map(norm);
}
/** Angka di teks yang tidak ada di JSON masukan. Kosong = lolos. */
export function unknownNumbers(text: string, input: unknown): string[] {
  const allowed = collectNumbers(input);
  const found = (text.match(/\d+(?:[.,]\d+)?/g) ?? []).map(norm);
  return [...new Set(found.filter((n) => !allowed.has(n)))];
}

export const SYSTEM_PROMPT = `Anda menulis pembahasan laporan penjualan properti untuk manajemen non-teknis, dalam bahasa Indonesia yang mudah dipahami (gunakan "tidak", bukan "ga").
Aturan: hanya kutip angka yang ada di JSON; jangan menghitung ulang atau menebak angka; sebut ketidakpastian dan batas data; untuk variabel ekonomi sebut bahwa pengaruhnya lemah pada data historis; hindari klaim sebab-akibat yang tidak didukung data. Sampel kecil disebut hipotesis. Pembaca malas membaca dan bukan orang teknis: pakai kalimat pendek dan bahasa sehari-hari, jelaskan dengan contoh sederhana, hindari istilah teknis (misalnya exponential smoothing, galat, korelasi, pipeline), dan langsung ke inti.`;

export async function tulisNarasi(input: unknown, call: (system: string, user: string) => Promise<string>, maxTry = 3) {
  let bad: string[] = [];
  for (let i = 0; i < maxTry; i++) {
    const extra = bad.length ? `\nPerbaiki: angka ini tidak ada di JSON dan harus dihapus: ${bad.join(", ")}.` : "";
    const text = await call(SYSTEM_PROMPT, JSON.stringify(input) + extra);
    bad = unknownNumbers(text, input);
    if (!bad.length) return { text, ok: true as const };
  }
  return { text: "", ok: false as const, bad };
}
