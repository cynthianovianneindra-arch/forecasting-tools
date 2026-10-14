import type { Txn } from "./forecast";
import type { ImportReport, MarketingData } from "./importExcel";

// Penyimpanan dataset di Supabase (PostgREST, tanpa dependensi tambahan). Hanya dipakai di server dengan service role key.
const url = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const storeConfigured = () => !!(url() && key());
const headers = () => ({ apikey: key()!, authorization: `Bearer ${key()}`, "content-type": "application/json" });

export interface DatasetMeta { id: number; uploaded_at: string; filename: string; mode: string; rows: number; utj: number; akad: number; batal: number; warnings: string[] }

export async function latestDataset(): Promise<(DatasetMeta & { txns: Txn[]; marketing: MarketingData | null }) | null> {
  if (!storeConfigured()) return null;
  const r = await fetch(`${url()}/rest/v1/datasets?select=*&order=uploaded_at.desc&limit=1`, { headers: headers(), cache: "no-store" });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  const rows = await r.json();
  return rows[0] ?? null;
}

export async function listDatasets(limit = 5): Promise<DatasetMeta[]> {
  if (!storeConfigured()) return [];
  const r = await fetch(`${url()}/rest/v1/datasets?select=id,uploaded_at,filename,mode,rows,utj,akad,batal,warnings&order=uploaded_at.desc&limit=${limit}`, { headers: headers(), cache: "no-store" });
  return r.ok ? r.json() : [];
}

export async function saveDataset(filename: string, mode: string, rep: ImportReport): Promise<void> {
  const r = await fetch(`${url()}/rest/v1/datasets`, {
    method: "POST", headers: { ...headers(), prefer: "return=minimal" },
    body: JSON.stringify({ filename, mode, rows: rep.rows, utj: rep.utj, akad: rep.akad, batal: rep.batal, warnings: rep.warnings.slice(0, 200), txns: rep.txns, marketing: rep.marketing ?? null }),
  });
  if (!r.ok) throw new Error(`Gagal menyimpan ke Supabase (${r.status})`);
}
