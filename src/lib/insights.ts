import type { Txn } from "./forecast";

export interface Filter { tipe?: string; agent?: string; marketing?: string; tahun?: string }

export function applyFilter(t: Txn[], f: Filter, forForecast: boolean): Txn[] {
  return t.filter((x) => (!f.tipe || x.tipe === f.tipe) && (!f.agent || x.agent === f.agent) && (!f.marketing || x.marketing === f.marketing)
    && (forForecast || !f.tahun || x.utj.startsWith(f.tahun)));
}

export function options(t: Txn[]) {
  const u = (k: "tipe" | "agent" | "marketing") => [...new Set(t.map((x) => x[k]).filter((v): v is string => !!v))].sort();
  return { tipe: u("tipe"), agent: u("agent"), marketing: u("marketing"), tahun: [...new Set(t.map((x) => x.utj.slice(0, 4)))].sort() };
}

const count = <T,>(items: T[], key: (x: T) => string | undefined) => {
  const m = new Map<string, number>();
  for (const i of items) { const k = key(i); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return m;
};
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Enam kartu data aktual. Semua dihitung di kode dari transaksi. */
export function cards(t: Txn[]) {
  const n = t.length, akad = t.filter((x) => x.akad).length;
  const funnel = { utj: n, spr: t.filter((x) => x.spr).length, akad, batal: t.filter((x) => x.batal).length, cair: t.filter((x) => x.cair).length };
  const byType = [...count(t, (x) => x.tipe)].map(([tipe, utj]) => ({ tipe, utj, akad: t.filter((x) => x.tipe === tipe && x.akad).length })).sort((a, b) => b.utj - a.utj);
  const byAgent = [...count(t, (x) => x.agent)].map(([agent, utj]) => {
    const ak = t.filter((x) => x.agent === agent && x.akad).length;
    return { agent, utj, akad: ak, konversi: pct(ak, utj) };
  }).sort((a, b) => b.utj - a.utj).slice(0, 8);
  const leads = [...count(t, (x) => x.leads)].map(([sumber, utj]) => ({ sumber, utj, porsi: pct(utj, n) })).sort((a, b) => b.utj - a.utj).slice(0, 8);
  const bankMap = new Map<string, { berkas: number; approve: number; hari: number[] }>();
  for (const x of t) for (const b of x.banks ?? []) {
    const e = bankMap.get(b.bank) ?? { berkas: 0, approve: 0, hari: [] };
    e.berkas++; if (/APPROVE|ACC|SETUJU/.test(b.status)) e.approve++; if (b.hari !== null && b.hari >= 0) e.hari.push(b.hari);
    bankMap.set(b.bank, e);
  }
  const bank = [...bankMap].map(([nama, e]) => ({ bank: nama, berkas: e.berkas, approve: pct(e.approve, e.berkas), hari: e.hari.length ? e.hari.reduce((a, c) => a + c, 0) / e.hari.length : null })).sort((a, b) => b.berkas - a.berkas).slice(0, 6);
  const batal = t.filter((x) => x.batal);
  const alasanMap = count(batal, (x) => x.alasanBatal?.toUpperCase());
  const alasan = { tercatat: batal.filter((x) => x.alasanBatal).length, total: batal.length, rinci: [...alasanMap].map(([alasan, jml]) => ({ alasan, jml })).sort((a, b) => b.jml - a.jml).slice(0, 6) };
  return { funnel, byType, byAgent, leads, bank, alasan };
}
