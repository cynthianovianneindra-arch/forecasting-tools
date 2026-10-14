import type { ForecastRow } from "./forecast";
import { applyScenario, changedCount, EMPTY, pengali, Referensi, Scenario, totalBangun, turunan } from "./whatif";

const f = (n: number, d = 0) => n.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const tanda = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + f(Math.abs(n));

export interface AnalisisInput {
  base: ForecastRow[]; s: Scenario; ref: Referensi;
  stokOpen: number; belumDibangunPerTipe: { tipe: string; n: number }[];
  netPriceMiliar: number; korelasiEkonomi?: number | null;
}
export interface Analisis {
  totals: { utjBase: number; utjScn: number; akadBase: number; akadScn: number; penBase: number; penScn: number };
  kontribusi: { kelompok: string; selisihUtj: number }[];
  ringkasan: string[]; stok: string; peringatan: string[];
  bulanPuncak: { bulan: string; utj: number };
}

/** Analisis hasil skenario: perubahan total, kontribusi tiap kelompok variabel, stok, ketidakpastian, dan peringatan. Semua angka dari mesin hitung. */
export function analisisSkenario(a: AnalisisInput): Analisis {
  const { base, s, ref } = a;
  const res = applyScenario(base, s, ref, a.stokOpen, a.netPriceMiliar);
  const utjBase = sum(base.map((b) => b.utjInt)), utjScn = sum(res.rows.map((r) => r.utjInt));
  const akadBase = sum(base.map((b) => b.akadInt)), akadScn = sum(res.rows.map((r) => r.akadInt));
  const penBase = akadBase * a.netPriceMiliar, penScn = sum(res.rows.map((r) => r.penerimaan));
  const dU = utjScn - utjBase, dA = akadScn - akadBase;

  // Kontribusi dihitung dari angka mentah (agar efek kecil per bulan tidak hilang oleh pembulatan ke bawah), lalu ditampilkan bulat (ke arah nol).
  const utjMentahBase = sum(base.map((b) => b.utj));
  const total = (v: Scenario) => Math.trunc(sum(applyScenario(base, v, ref, a.stokOpen, a.netPriceMiliar).rows.map((r) => r.utj)) - utjMentahBase);
  const kontribusi = [
    { kelompok: "Order bangun", selisihUtj: total({ ...EMPTY, bangun: s.bangun, mulaiBangun: s.mulaiBangun, event: {} }) },
    { kelompok: "Harga dan promo", selisihUtj: total({ ...EMPTY, bangun: {}, event: {}, harga: s.harga, promo: s.promo }) },
    { kelompok: "Marketing dan event", selisihUtj: total({ ...EMPTY, bangun: {}, leads: s.leads, event: s.event }) },
    { kelompok: "Kondisi ekonomi", selisihUtj: total({ ...EMPTY, bangun: {}, event: {}, birate: s.birate, ihsg: s.ihsg, emas: s.emas, inflasi: s.inflasi }) },
  ];
  const aktif = kontribusi.filter((k) => k.selisihUtj !== 0).sort((x, y) => Math.abs(y.selisihUtj) - Math.abs(x.selisihUtj));

  const puncak = res.rows.reduce((m, r) => (r.utjInt > m.utj ? { bulan: r.bulan, utj: r.utjInt } : m), { bulan: res.rows[0]?.bulan ?? "", utj: -1 });
  const half = Math.sqrt(sum(base.map((b) => ((b.utjHiInt - b.utjLoInt) / 2) ** 2)));

  const ringkasan: string[] = [];
  const n = changedCount(s);
  if (n === 0) ringkasan.push("Belum ada variabel yang diubah, jadi hasil sama dengan proyeksi dasar.");
  else {
    ringkasan.push(`Skenario mengubah ${n} variabel. Total UTJ 12 bulan ${f(utjBase)} menjadi ${f(utjScn)} (${tanda(dU)} unit${utjBase ? `, ${tanda(Math.round((dU / utjBase) * 100))}%` : ""}); akad ${f(akadBase)} menjadi ${f(akadScn)} (${tanda(dA)}); penerimaan Rp ${f(penBase, 1)} miliar menjadi Rp ${f(penScn, 1)} miliar (${penScn - penBase >= 0 ? "+" : "−"}Rp ${f(Math.abs(penScn - penBase), 1)} miliar).`);
    if (aktif.length) ringkasan.push(`Pendorong terbesar: ${aktif[0].kelompok} (${tanda(aktif[0].selisihUtj)} UTJ)${aktif.length > 1 ? `, diikuti ${aktif.slice(1).map((k) => `${k.kelompok} (${tanda(k.selisihUtj)})`).join(", ")}` : ""}. Pengaruh tiap kelompok dihitung dari angka mentah, sedangkan total memakai UTJ bulanan yang dibulatkan ke bawah, sehingga jumlahnya bisa berbeda beberapa unit.`);
    ringkasan.push(`UTJ bulanan tertinggi pada skenario ini ${f(puncak.utj)} unit (${puncak.bulan}).`);
    ringkasan.push(Math.abs(dU) <= half
      ? `Selisih ${tanda(dU)} UTJ masih berada dalam ketidakpastian proyeksi dasar (sekitar ±${f(half)} unit untuk total 12 bulan, rentang 10–90%), jadi perbedaannya belum tentu terlihat pada hasil nyata.`
      : `Selisih ${tanda(dU)} UTJ lebih besar daripada ketidakpastian proyeksi dasar (sekitar ±${f(half)} unit untuk total 12 bulan), sehingga perubahan ini cukup berarti secara arah, walau besarnya tetap perkiraan.`);
  }

  const unit = totalBangun(s), stokTotal = a.stokOpen + unit, perlu = Math.round(res.stokNeto);
  const stok = res.stockWarning
    ? `Stok tidak cukup: kebutuhan unit bersih 12 bulan (UTJ dikurangi batal) sekitar ${f(perlu)} unit, sedangkan stok Open ${f(a.stokOpen)}${unit ? ` ditambah ${f(unit)} unit order bangun = ${f(stokTotal)}` : ""}; kekurangan sekitar ${f(Math.max(0, perlu - stokTotal))} unit.`
    : `Stok cukup: kebutuhan unit bersih 12 bulan sekitar ${f(perlu)} unit, sedangkan stok Open ${f(a.stokOpen)}${unit ? ` ditambah ${f(unit)} unit order bangun = ${f(stokTotal)}` : ""}.`;

  const peringatan: string[] = ["Koefisien skenario masih ilustrasi dan belum dikalibrasi dari data; baca sebagai gambaran arah, bukan ramalan."];
  const t = turunan(s, ref), p = pengali(t);
  if (p.ekonomi !== 0) peringatan.push(`Pengaruh variabel ekonomi lemah pada data historis${a.korelasiEkonomi !== null && a.korelasiEkonomi !== undefined ? ` (korelasi bulanan terbesar sekitar ${f(Math.abs(a.korelasiEkonomi), 2)})` : ""}; perlakukan hanya sebagai arah.`);
  if (t.event > 0) peringatan.push("Event dari kelima kategori dihitung sama (setiap event menambah UTJ dengan bobot yang sama); data event baru ada sejak 2025 sehingga bobot per kategori belum bisa dikalibrasi.");
  if (t.leadsPct !== 0 || t.event > 0) peringatan.push("Hubungan marketing dengan UTJ baru berasal dari 8 bulan data (Okt 2025 – Mei 2026) dan bukan sebab-akibat yang terbukti.");
  for (const [tipe, nn] of Object.entries(s.bangun)) {
    const tersedia = a.belumDibangunPerTipe.find((x) => x.tipe === tipe)?.n ?? 0;
    if (nn > tersedia) peringatan.push(`Order bangun ${tipe} (${f(nn)} unit) melebihi unit belum dibangun untuk tipe itu (${f(tersedia)} unit).`);
  }
  return { totals: { utjBase, utjScn, akadBase, akadScn, penBase, penScn }, kontribusi, ringkasan, stok, peringatan, bulanPuncak: puncak };
}
