// Mencocokkan leads dengan UTJ tanpa menyimpan nama atau telepon: pencocokan dilakukan di memori saat impor, hanya hitungan yang disimpan.
const GELAR = new Set(["BP", "BPK", "BAPAK", "IBU", "IBK", "BU", "HJ", "HAJI", "H", "DR", "DRS", "IR", "MR", "MRS", "MS", "NY", "SDR", "SDRI", "KAK", "MAS", "MBAK", "PAK", "SE", "SKOM", "ST", "SH", "SPD", "AMD"]);

/** Nama untuk dicocokkan: huruf besar, tanpa aksen/tanda baca/gelar, spasi rapi. */
export function normNama(v: unknown): string {
  const s = String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z\s]/g, " ");
  return s.split(/\s+/).filter((t) => t.length >= 2 && !GELAR.has(t)).join(" ");
}

function lev(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

/** Tingkat kecocokan dua nama (kecil = lebih yakin): 1 sama persis, 2 kata sama beda urutan, 3 satu nama memuat nama lain (>= 2 kata), 4 beda satu huruf (nama >= 8 huruf); 0 = tidak cocok. */
export function tingkatCocok(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = a.split(" "), tb = b.split(" ");
  const sa = new Set(ta), sb = new Set(tb);
  if (ta.length === tb.length && ta.every((t) => sb.has(t))) return 2;
  const [kecil, besar] = ta.length <= tb.length ? [ta, sb] : [tb, sa];
  if (kecil.length >= 2 && kecil.every((t) => besar.has(t))) return 3;
  if (a.length >= 8 && b.length >= 8 && a[0] === b[0] && lev(a, b) <= 1) return 4;
  return 0;
}

export interface LeadRow { nama: string; bulan: string; marketing: string; telp?: string | null }
export interface UtjRow { nama: string; bulan: string; marketing: string; telp?: string | null }
export type Yakin = "pasti" | "kira";

const BULAN_MAKS = 6; // untuk tebakan satu nama: UTJ paling lama 6 bulan setelah lead

/** Untuk tiap lead (urut bulan), cari UTJ yang belum terpakai dengan bulan >= bulan lead.
 *  Pasti: nomor telepon sama, atau nama cocok (sama persis, beda urutan, memuat, beda satu huruf). Seri: marketing sama, lalu UTJ paling awal.
 *  Kira: lead hanya satu nama depan (>= 4 huruf) yang sama dengan nama depan satu-satunya UTJ pada marketing yang sama dalam 6 bulan. Setiap UTJ dipakai satu kali. */
export function cocokkanLeads(leads: LeadRow[], utj: UtjRow[]): Map<number, Yakin> {
  const terpakai = new Set<number>();
  const hasil = new Map<number, Yakin>();
  const urut = leads.map((_, i) => i).sort((a, b) => leads[a].bulan.localeCompare(leads[b].bulan));
  const selisihBulan = (a: string, b: string) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  for (const i of urut) {
    const l = leads[i];
    let best: { j: number; tk: number; mk: boolean } | null = null;
    for (let j = 0; j < utj.length; j++) {
      if (terpakai.has(j) || utj[j].bulan < l.bulan) continue;
      const tk = l.telp && utj[j].telp && l.telp === utj[j].telp ? 0 : l.nama && utj[j].nama ? tingkatCocok(l.nama, utj[j].nama) : 0;
      if (tk === 0 && !(l.telp && utj[j].telp && l.telp === utj[j].telp)) continue;
      const mk = !!l.marketing && l.marketing === utj[j].marketing;
      const lebih = !best || tk < best.tk || (tk === best.tk && ((mk && !best.mk) || (mk === best.mk && utj[j].bulan < utj[best.j].bulan)));
      if (lebih) best = { j, tk, mk };
    }
    if (best) { terpakai.add(best.j); hasil.set(i, "pasti"); continue; }
    // tebakan: satu nama depan saja
    if (l.nama && !l.nama.includes(" ") && l.nama.length >= 4 && l.marketing) {
      const kand = utj.map((u, j) => j).filter((j) => !terpakai.has(j) && utj[j].marketing === l.marketing && utj[j].bulan >= l.bulan && selisihBulan(l.bulan, utj[j].bulan) <= BULAN_MAKS && utj[j].nama.split(" ")[0] === l.nama);
      if (kand.length === 1) { terpakai.add(kand[0]); hasil.set(i, "kira"); }
    }
  }
  return hasil;
}
