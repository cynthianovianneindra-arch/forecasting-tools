import type { Txn } from "./forecast";
import type { EventCost, LeadAgg, MarketingData, UnitRow } from "./importExcel";

// Input data manual: fungsi murni (mudah diuji). Hasilnya disimpan sebagai snapshot dataset baru (riwayat bisa diurungkan).
export interface Dataset { txns: Txn[]; units: UnitRow[]; marketing: MarketingData }

export type Edit =
  | { jenis: "transaksi_baru"; bulanUtj: string; unit?: string; tipe?: string; agent?: string; marketing?: string; database?: string; leads?: string; netPriceJuta?: number }
  | { jenis: "status_transaksi"; unit: string; bulanAkad?: string; bulanBatal?: string; alasan?: string }
  | { jenis: "event"; bulan: string; kategori: string; kegiatan: string; biayaRp: number }
  | { jenis: "leads"; bulan: string; database: string; asal: string; marketing: string; status: string; n: number; survey: number }
  | { jenis: "unit"; unit: string; status: string; tipe?: string; tahap?: string; cluster?: string };

export class ManualError extends Error {}

const BULAN = /^\d{4}-(0[1-9]|1[0-2])$/;
const up = (v?: string) => (v ?? "").trim().replace(/\s+/g, " ").toUpperCase();
const bulanOk = (b: string | undefined, nama: string) => { if (!b || !BULAN.test(b)) throw new ManualError(`${nama}: pilih bulan yang valid (YYYY-MM)`); return b; };
const angka = (v: number | undefined, nama: string, min: number, max: number) => { if (v === undefined || !isFinite(v) || v < min || v > max) throw new ManualError(`${nama}: angka harus antara ${min} dan ${max}`); return v; };
export const STATUS_UNIT = ["OPEN", "CLOSE", "PROSES", "SOLD", "MARGAL"];

export function applyEdit(ds: Dataset, e: Edit): { ds: Dataset; ringkasan: string } {
  const txns = ds.txns.map((t) => ({ ...t })), units = ds.units.map((u) => ({ ...u }));
  const marketing: MarketingData = { leads: [...ds.marketing.leads], events: [...ds.marketing.events] };
  const setStatus = (id: string | undefined, st: string) => { const u = id ? units.find((x) => x.unit === id) : undefined; if (u) u.status = st; };

  if (e.jenis === "transaksi_baru") {
    const bulan = bulanOk(e.bulanUtj, "Bulan UTJ");
    const unit = up(e.unit) || undefined;
    if (unit) {
      const u = units.find((x) => x.unit === unit);
      if (!u) throw new ManualError(`Unit ${unit} tidak ada di master unit`);
      if (txns.some((t) => t.unit === unit && !t.akad && !t.batal)) throw new ManualError(`Unit ${unit} masih punya UTJ berjalan`);
    }
    const u = unit ? units.find((x) => x.unit === unit) : undefined;
    const harga = e.netPriceJuta === undefined || isNaN(e.netPriceJuta) ? undefined : angka(e.netPriceJuta, "Harga bersih (juta)", 10, 50000) * 1e6;
    txns.push({ utj: bulan, unit, tipe: (e.tipe || u?.tipe || "").trim() || undefined, cluster: u?.cluster || undefined, tahap: u?.tahap || undefined, agent: up(e.agent) || undefined, marketing: up(e.marketing) || undefined, database: (e.database ?? "").trim() || undefined, leads: (e.leads ?? "").trim() || undefined, netPrice: harga, banks: [] });
    setStatus(unit, "PROSES");
    return { ds: { txns, units, marketing }, ringkasan: `tambah UTJ ${bulan}${unit ? ` unit ${unit}` : ""}` };
  }
  if (e.jenis === "status_transaksi") {
    const unit = up(e.unit);
    const t = txns.find((x) => x.unit === unit && !x.akad && !x.batal) ?? txns.filter((x) => x.unit === unit).pop();
    if (!t) throw new ManualError(`Tidak ada transaksi untuk unit ${unit}. Unggah ulang Excel agar ID unit tercatat.`);
    if (e.bulanAkad && e.bulanBatal) throw new ManualError("Isi akad atau batal, bukan keduanya");
    if (!e.bulanAkad && !e.bulanBatal && !e.alasan) throw new ManualError("Isi bulan akad, bulan batal, atau alasan batal");
    if (e.bulanAkad) { const b = bulanOk(e.bulanAkad, "Bulan akad"); if (b < t.utj) throw new ManualError("Bulan akad tidak boleh sebelum bulan UTJ"); t.akad = b; t.batal = null; setStatus(unit, "SOLD"); }
    if (e.bulanBatal) { const b = bulanOk(e.bulanBatal, "Bulan batal"); if (b < t.utj) throw new ManualError("Bulan batal tidak boleh sebelum bulan UTJ"); t.batal = b; t.akad = null; setStatus(unit, "OPEN"); }
    if (e.alasan?.trim()) t.alasanBatal = e.alasan.trim();
    return { ds: { txns, units, marketing }, ringkasan: `ubah status unit ${unit}${e.bulanAkad ? " → akad " + e.bulanAkad : ""}${e.bulanBatal ? " → batal " + e.bulanBatal : ""}` };
  }
  if (e.jenis === "event") {
    const bulan = bulanOk(e.bulan, "Bulan event");
    if (!e.kegiatan?.trim()) throw new ManualError("Nama kegiatan wajib diisi");
    const ev: EventCost = { bulan, kategori: e.kategori?.trim() || "(lain)", kegiatan: e.kegiatan.trim(), biaya: angka(e.biayaRp, "Biaya (Rp)", 1, 1e11) };
    marketing.events.push(ev);
    return { ds: { txns, units, marketing }, ringkasan: `tambah biaya event ${ev.kegiatan} ${bulan}` };
  }
  if (e.jenis === "leads") {
    const bulan = bulanOk(e.bulan, "Bulan leads");
    const n = angka(e.n, "Jumlah leads", 1, 100000), survey = angka(e.survey, "Jumlah survey", 0, n);
    const row: LeadAgg = { bulan, database: up(e.database) || "(KOSONG)", asal: up(e.asal) || "(KOSONG)", marketing: up(e.marketing) || "(KOSONG)", status: up(e.status), n, survey };
    marketing.leads.push(row);
    return { ds: { txns, units, marketing }, ringkasan: `tambah ${n} leads ${bulan}` };
  }
  // unit
  const id = up(e.unit), st = up(e.status);
  if (!id) throw new ManualError("ID unit wajib diisi");
  if (!STATUS_UNIT.includes(st)) throw new ManualError(`Status unit harus salah satu dari ${STATUS_UNIT.join(", ")}`);
  const u = units.find((x) => x.unit === id);
  if (u) { u.status = st; if (e.tipe?.trim()) u.tipe = e.tipe.trim(); if (e.tahap?.trim()) u.tahap = e.tahap.trim(); if (e.cluster?.trim()) u.cluster = e.cluster.trim(); }
  else { if (!e.tipe?.trim()) throw new ManualError("Unit baru: tipe wajib diisi"); units.push({ unit: id, tipe: e.tipe.trim(), tahap: (e.tahap ?? "").trim(), cluster: (e.cluster ?? "").trim(), status: st }); }
  return { ds: { txns, units, marketing }, ringkasan: `${u ? "ubah" : "tambah"} unit ${id} → ${st}` };
}

export const INDIKATOR_MANUAL = { ihsg: { nama: "IHSG", min: 100, max: 100000 }, emas: { nama: "Emas (USD/oz)", min: 100, max: 100000 }, inflasi: { nama: "Inflasi tahunan (%)", min: -5, max: 30 }, birate: { nama: "BI Rate (%)", min: 0, max: 30 }, ihpr: { nama: "IHPR", min: 10, max: 1000 } } as const;
export type IndikatorManual = keyof typeof INDIKATOR_MANUAL;

/** Validasi input data ekonomi manual; inflasi dan BI Rate dalam persen. */
export function cekMakro(bulan: string, indikator: string, nilai: number): { bulan: string; indikator: IndikatorManual; nilai: number } {
  bulanOk(bulan, "Bulan");
  const k = indikator as IndikatorManual;
  if (!(k in INDIKATOR_MANUAL)) throw new ManualError("Indikator tidak dikenal");
  const r = INDIKATOR_MANUAL[k];
  return { bulan, indikator: k, nilai: angka(nilai, r.nama, r.min, r.max) };
}
