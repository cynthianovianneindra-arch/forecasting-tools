import { ManualError, applyEdit, cekMakro, Edit } from "@/lib/manual";
import { deleteDataset, latestDataset, saveDataset, storeConfigured, upsertMacroManual } from "@/lib/store";
import type { ImportReport } from "@/lib/importExcel";
import { adminSegar } from "@/lib/auth";

export const runtime = "nodejs";

const str = (f: FormData, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string).trim() : "");
const num = (f: FormData, k: string) => (str(f, k) === "" ? undefined : Number(str(f, k).replace(",", ".")));

// Input data manual dari layar Data & Integrasi. Hanya admin (sesi login). Setiap perubahan = snapshot dataset baru (bisa diurungkan).
export async function POST(req: Request) {
  const back = (k: "ok" | "err", msg: string) => { const u = new URL("/data", req.url); u.searchParams.set(k, msg); return Response.redirect(u, 303); };
  if (!(await adminSegar())) return Response.json({ error: "Hanya untuk admin" }, { status: 403 });
  if (!storeConfigured()) return back("err", "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset");
  const f = await req.formData();
  const jenis = str(f, "jenis");
  try {
    if (jenis === "makro") {
      const m = cekMakro(str(f, "bulan"), str(f, "indikator"), num(f, "nilai") ?? NaN);
      await upsertMacroManual(m);
      return back("ok", `Data ekonomi tersimpan: ${m.indikator} ${m.bulan} = ${m.nilai}`);
    }
    const ds = await latestDataset();
    if (jenis === "urungkan") {
      if (!ds || !ds.filename.startsWith("Input manual")) return back("err", "Tidak ada input manual terakhir yang bisa diurungkan (snapshot terakhir berasal dari unggahan Excel)");
      await deleteDataset(ds.id);
      return back("ok", `Input manual terakhir diurungkan: ${ds.filename}`);
    }
    if (!ds) return back("err", "Belum ada dataset. Unggah Excel dulu, lalu tambah data manual.");
    const edit = ((): Edit => {
      switch (jenis) {
        case "transaksi_baru": return { jenis, bulanUtj: str(f, "bulanUtj"), unit: str(f, "unit"), tipe: str(f, "tipe"), agent: str(f, "agent"), marketing: str(f, "marketing"), database: str(f, "database"), leads: str(f, "leads"), netPriceJuta: num(f, "netPriceJuta") };
        case "status_transaksi": return { jenis, unit: str(f, "unit"), bulanAkad: str(f, "bulanAkad") || undefined, bulanBatal: str(f, "bulanBatal") || undefined, alasan: str(f, "alasan") || undefined };
        case "event": return { jenis, bulan: str(f, "bulan"), kategori: str(f, "kategori"), kegiatan: str(f, "kegiatan"), biayaRp: num(f, "biayaRp") ?? NaN };
        case "leads": return { jenis, bulan: str(f, "bulan"), database: str(f, "database"), asal: str(f, "asal"), marketing: str(f, "marketing"), status: str(f, "status"), n: num(f, "n") ?? NaN, survey: num(f, "survey") ?? 0 };
        case "unit": return { jenis, unit: str(f, "unit"), status: str(f, "status"), tipe: str(f, "tipe"), tahap: str(f, "tahap"), cluster: str(f, "cluster") };
        default: throw new ManualError("Jenis input tidak dikenal");
      }
    })();
    const out = applyEdit({ txns: ds.txns, units: ds.units ?? [], marketing: ds.marketing ?? { leads: [], events: [] } }, edit);
    const rep: ImportReport = {
      txns: out.ds.txns, units: out.ds.units, marketing: out.ds.marketing, macro: ds.macro ?? undefined, rows: out.ds.txns.length,
      utj: out.ds.txns.length, akad: out.ds.txns.filter((t) => t.akad).length, batal: out.ds.txns.filter((t) => t.batal).length, warnings: [],
    };
    await saveDataset(`Input manual: ${out.ringkasan}`, ds.mode, rep);
    return back("ok", `Tersimpan: ${out.ringkasan}`);
  } catch (e) {
    return back("err", e instanceof ManualError ? e.message : e instanceof Error ? e.message : "Gagal menyimpan");
  }
}
