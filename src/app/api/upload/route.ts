import { importPenjualan } from "@/lib/importExcel";
import { saveDataset, storeConfigured } from "@/lib/store";
import { adminSegar } from "@/lib/auth";

export const runtime = "nodejs";
const MAX_BYTES = 4 * 1024 * 1024; // batas body fungsi serverless Vercel ±4,5 MB

const back = (req: Request, msg: string, ok = false) => {
  const u = new URL("/data", req.url);
  u.searchParams.set(ok ? "ok" : "err", msg);
  return Response.redirect(u, 303);
};

// Unggah Excel lewat dashboard: parse PENJUALAN, simpan transaksi anonim (tanpa nama pembeli) ke Supabase.
export async function POST(req: Request) {
  if (!(await adminSegar())) return Response.json({ error: "Hanya untuk admin" }, { status: 403 });
  if (!storeConfigured()) return back(req, "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return back(req, "Pilih file .xlsx");
  if (file.size > MAX_BYTES) return back(req, "File terlalu besar (maks 4 MB)");
  const mode = form.get("mode") === "excel" ? "excel" : "kalender";
  try {
    const rep = await importPenjualan(await file.arrayBuffer(), mode);
    if (rep.utj === 0) return back(req, "Tidak ada baris UTJ terbaca; periksa sheet PENJUALAN dan kolomnya");
    await saveDataset(file.name, mode, rep);
    return back(req, `Berhasil: ${rep.utj} UTJ, ${rep.akad} akad, ${rep.batal} batal, ${rep.warnings.length} peringatan`, true);
  } catch (e) {
    return back(req, e instanceof Error ? e.message : "Gagal memproses file");
  }
}
