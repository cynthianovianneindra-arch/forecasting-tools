import type { Txn } from "./forecast";
import type { MarketingData } from "./importExcel";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
export function pearson(x: number[], y: number[]): number | null {
  const n = x.length; if (n < 3) return null;
  const mx = sum(x) / n, my = sum(y) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export interface Finding { id: string; judul: string; temuan: string; tindakan: string; ukuran: string; prioritas: "Tinggi" | "Sedang" | "Rendah"; label: "data" | "hipotesis" }

/** Semua angka dan temuan dihitung deterministik (SPEC halaman 10–11). Tidak ada klaim sebab-akibat. */
export function marketingInsights(m: MarketingData, txns: Txn[]) {
  const bulan = [...new Set(m.leads.map((l) => l.bulan))].sort();
  const utjBy = new Map<string, number>();
  for (const t of txns) utjBy.set(t.utj, (utjBy.get(t.utj) ?? 0) + 1);
  const perBulan = bulan.map((b) => ({
    bulan: b,
    biaya: sum(m.events.filter((e) => e.bulan === b).map((e) => e.biaya)),
    leads: sum(m.leads.filter((l) => l.bulan === b).map((l) => l.n)),
    utj: utjBy.get(b) ?? 0,
  }));
  const biaya = sum(perBulan.map((x) => x.biaya)), leads = sum(perBulan.map((x) => x.leads)), utj = sum(perBulan.map((x) => x.utj));
  const kategoriMap = new Map<string, number>();
  for (const e of m.events.filter((e) => bulan.includes(e.bulan))) kategoriMap.set(e.kategori, (kategoriMap.get(e.kategori) ?? 0) + e.biaya);
  const kategori = [...kategoriMap].map(([k, v]) => ({ kategori: k, biaya: v, porsi: pct(v, biaya) })).sort((a, b) => b.biaya - a.biaya);

  const noStatus = sum(m.leads.filter((l) => !l.status).map((l) => l.n));
  const mk = new Map<string, { n: number; filled: number }>();
  for (const l of m.leads) { const e = mk.get(l.marketing) ?? { n: 0, filled: 0 }; e.n += l.n; if (l.status) e.filled += l.n; mk.set(l.marketing, e); }
  const statusPerMarketing = [...mk].map(([nama, e]) => ({ marketing: nama, leads: e.n, terisi: pct(e.filled, e.n) })).filter((x) => x.leads >= 30 && x.marketing !== "(KOSONG)").sort((a, b) => b.terisi - a.terisi);

  const db = new Map<string, { leads: number; survey: number }>();
  for (const l of m.leads) { const e = db.get(l.database) ?? { leads: 0, survey: 0 }; e.leads += l.n; e.survey += l.survey; db.set(l.database, e); }
  const utjDb = new Map<string, number>();
  for (const t of txns) if (t.database) utjDb.set(t.database.toUpperCase(), (utjDb.get(t.database.toUpperCase()) ?? 0) + 1);
  const utjTotalDb = sum([...utjDb.values()]);
  const sumber = [...db].map(([nama, e]) => ({ database: nama, porsiLeads: pct(e.leads, leads), porsiSurvey: pct(e.survey, sum([...db.values()].map((x) => x.survey))), surveyPerLeads: pct(e.survey, e.leads), porsiUtj: pct(utjDb.get(nama) ?? 0, utjTotalDb) })).sort((a, b) => b.porsiLeads - a.porsiLeads).slice(0, 6);

  const inh = (t: Txn) => t.agent === "INHOUSE";
  const batalIn = { n: txns.filter(inh).length, b: txns.filter((t) => inh(t) && t.batal).length };
  const batalOut = { n: txns.filter((t) => !inh(t)).length, b: txns.filter((t) => !inh(t) && t.batal).length };
  const batalInPct = pct(batalIn.b, batalIn.n), batalOutPct = pct(batalOut.b, batalOut.n);

  const rBiayaLeads = pearson(perBulan.map((x) => x.biaya), perBulan.map((x) => x.leads));
  const rBiayaUtj = pearson(perBulan.map((x) => x.biaya), perBulan.map((x) => x.utj));
  const med = median(perBulan.map((x) => x.biaya));
  const lonjakan = perBulan.find((x) => med > 0 && x.biaya > 3 * med);

  const stats = {
    periode: bulan.length ? `${bulan[0]} s.d. ${bulan[bulan.length - 1]}` : "-", jumlahBulan: bulan.length,
    biayaJuta: +(biaya / 1e6).toFixed(1), leads, utj,
    biayaPerLeadRibu: leads ? +(biaya / leads / 1e3).toFixed(1) : null, biayaPerUtjJuta: utj ? +(biaya / utj / 1e6).toFixed(1) : null,
    persenLeadsTanpaStatus: pct(noStatus, leads),
    korelasiBiayaLeads: rBiayaLeads === null ? null : +rBiayaLeads.toFixed(2), korelasiBiayaUtj: rBiayaUtj === null ? null : +rBiayaUtj.toFixed(2),
    persenBatalInhouse: batalInPct, persenBatalNonInhouse: batalOutPct,
  };

  const f: Finding[] = [];
  if (stats.persenLeadsTanpaStatus >= 50) f.push({ id: "status", judul: "Status leads banyak kosong", label: "data",
    temuan: `${stats.persenLeadsTanpaStatus}% dari ${leads} leads belum punya status.${statusPerMarketing.length ? ` Status terisi per marketing: ${statusPerMarketing.map((x) => `${x.marketing} ${Math.round(x.terisi)}%`).join(", ")}.` : ""}`,
    tindakan: "Wajibkan pengisian status leads di sheet (Prospect, Survey, Follow Up, Lost, Closing) dan tinjau kepatuhan tiap marketing tiap minggu.", ukuran: "Leads tanpa status turun di bawah 20% dalam dua bulan.", prioritas: "Tinggi" });
  const top = sumber[0];
  if (top && top.porsiLeads >= 50 && top.surveyPerLeads < 5) f.push({ id: "office", judul: `Sumber ${top.database} besar tetapi jarang survey`, label: "data",
    temuan: `${top.database} menyumbang ${top.porsiLeads}% leads, tetapi hanya ${top.surveyPerLeads}% dari leads-nya sampai tahap survey.`,
    tindakan: `Evaluasi kualitas leads ${top.database} dan skrip tindak lanjutnya sebelum menambah anggaran ke sumber ini.`, ukuran: "Rasio survey per leads sumber ini naik minimal dua kali lipat.", prioritas: "Tinggi" });
  const hi = sumber.find((x) => x.porsiUtj >= 2 * Math.max(x.porsiLeads, 1) && x.porsiLeads >= 5);
  if (hi) f.push({ id: "pribadi", judul: `Sumber ${hi.database}: porsi UTJ jauh di atas porsi leads`, label: "hipotesis",
    temuan: `${hi.database} hanya ${hi.porsiLeads}% leads, tetapi ${hi.porsiUtj}% porsi UTJ (seluruh riwayat). Bandingkan porsi, bukan konversi.`,
    tindakan: `Uji dengan menambah kegiatan jaringan ${hi.database} di satu periode, lalu bandingkan UTJ-nya.`, ukuran: "Porsi UTJ sumber ini bertahan saat leads-nya bertambah.", prioritas: "Sedang" });
  if (lonjakan) f.push({ id: "lonjakan", judul: "Lonjakan biaya satu bulan belum terbukti berdampak", label: "hipotesis",
    temuan: `Biaya ${lonjakan.bulan} Rp ${(lonjakan.biaya / 1e6).toFixed(1)} juta, lebih dari tiga kali median bulanan; leads ${lonjakan.leads}, UTJ ${lonjakan.utj}. Korelasi biaya-leads ${stats.korelasiBiayaLeads ?? "-"}, biaya-UTJ ${stats.korelasiBiayaUtj ?? "-"} dengan hanya ${bulan.length} bulan data: pola awal, bukan sebab-akibat.`,
    tindakan: "Catat setiap event dengan ID agar biaya, leads, dan UTJ bisa dikaitkan, lalu ukur ulang setelah data lebih panjang.", ukuran: "Setiap event punya ID dan tercatat di leads serta UTJ.", prioritas: "Sedang" });
  if (Math.abs(batalInPct - batalOutPct) >= 5) f.push({ id: "batal", judul: "Pembatalan inhouse berbeda dari non-inhouse", label: "hipotesis",
    temuan: `Batal inhouse ${batalInPct}% (${batalIn.b} dari ${batalIn.n}) dibanding non-inhouse ${batalOutPct}% (${batalOut.b} dari ${batalOut.n}). Sampel kecil.`,
    tindakan: "Tinjau proses penyaringan calon pembeli inhouse (kemampuan bank, kelengkapan berkas) sebelum UTJ.", ukuran: "Selisih persen batal mengecil dalam tiga bulan.", prioritas: "Sedang" });
  const cov = txns.filter((t) => t.batal).length;
  const rec = txns.filter((t) => t.batal && t.alasanBatal).length;
  if (cov && rec / cov < 0.5) f.push({ id: "alasan", judul: "Alasan batal belum lengkap", label: "data",
    temuan: `Alasan batal baru tercatat untuk ${rec} dari ${cov} kasus.`, tindakan: "Wajibkan alasan batal saat tanggal batal diisi.", ukuran: "Alasan batal terisi untuk semua kasus baru.", prioritas: "Tinggi" });
  return { stats, perBulan, kategori, statusPerMarketing, sumber, findings: f.slice(0, 5) };
}
