// Pembersihan data: huruf kapital seragam dan format nomor telepon. Fungsi murni.
import type { Txn } from "./forecast";
import type { MarketingData, UnitRow } from "./importExcel";

const SINGKATAN = new Set(["BRI", "BTN", "BNI", "BSN", "BCA", "DKI", "PT", "CV", "KPR", "OTS", "SHM", "IHSG", "SPR", "PPJB", "UTJ", "KUA", "UMR", "UMK", "AC", "TV", "ID", "OH", "DP", "CB", "WI", "IG", "FB", "DM"]);
const hurufBesarSemua = (w: string) => w === w.toUpperCase() && w !== w.toLowerCase();
const tanpaVokal = (w: string) => !/[AIUEO]/i.test(w);

/** Teks nama seragam: Kapital Di Awal Tiap Kata; singkatan (BRI, BTN, BRCS: tanpa vokal) tetap huruf besar; kata berisi angka (A-01, F5-05, Arnica 70) dibiarkan. Contoh: "TEAM ARIYANTI" -> "Team Ariyanti". */
export function rapikan(v: string | null | undefined): string {
  const t = (v ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const kata = (w: string): string => {
    if (/\d/.test(w)) return w;
    if (/^\(.*\)$/.test(w)) return `(${kata(w.slice(1, -1))})`;
    const bagian = w.split(/([-/&'])/);
    return bagian.map((b) => {
      if (!b || /^[-/&']$/.test(b)) return b;
      if (SINGKATAN.has(b.toUpperCase()) || (hurufBesarSemua(b) && b.length <= 5 && tanpaVokal(b))) return b.toUpperCase();
      return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
    }).join("");
  };
  return t.split(" ").map(kata).join(" ");
}

export function rapikanTxns(txns: Txn[]): Txn[] {
  return txns.map((t) => ({
    ...t,
    ...(t.tipe ? { tipe: rapikan(t.tipe) } : {}), ...(t.agent ? { agent: rapikan(t.agent) } : {}), ...(t.marketing ? { marketing: rapikan(t.marketing) } : {}),
    ...(t.leads ? { leads: rapikan(t.leads) } : {}), ...(t.database ? { database: rapikan(t.database) } : {}), ...(t.alasanBatal ? { alasanBatal: rapikan(t.alasanBatal) } : {}),
    ...(t.banks ? { banks: t.banks.map((b) => ({ ...b, bank: rapikan(b.bank) })) } : {}),
  }));
}

export function rapikanMarketing(m: MarketingData): MarketingData {
  return {
    leads: m.leads.map((l) => ({ ...l, database: rapikan(l.database), asal: rapikan(l.asal), marketing: rapikan(l.marketing), status: rapikan(l.status) })),
    events: m.events.map((e) => ({ ...e, kategori: rapikan(e.kategori), kegiatan: e.kegiatan })),
  };
}

export const rapikanUnits = (u: UnitRow[]): UnitRow[] => u.map((x) => ({ ...x, tipe: rapikan(x.tipe), tahap: rapikan(x.tahap), cluster: rapikan(x.cluster) }));

/** Nomor telepon ke format 62xxxxxxxxxx. "857821797", "0857821797", "+62857821797", "(0857) 821-797" -> "62857821797". Hanya nomor seluler Indonesia (8...) 9-12 digit; selain itu null.
 *  Bila ada beberapa nomor (dipisah / , ; atau "dan"), nomor pertama dipakai. Nomor tidak pernah disimpan: hanya dipakai di memori saat impor. */
export function normalisasiTelepon(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = typeof raw === "number" ? String(Math.trunc(raw)) : String(raw);
  const pertama = s.split(/[\/,;]|\bdan\b/i)[0];
  let d = pertama.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("62")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return /^8\d{8,11}$/.test(d) ? `62${d}` : null;
}
