import { bacaFormTarget, TargetError } from "@/lib/target";
import { storeConfigured, upsertTarget } from "@/lib/store";
import { adminSegar } from "@/lib/auth";

export const runtime = "nodejs";

// Simpan target penjualan satu tahun (12 bulan) dari layar Data & Integrasi. Hanya admin (sesi login).
export async function POST(req: Request) {
  const back = (k: "ok" | "err", msg: string, tahun?: string) => { const u = new URL("/data", req.url); u.searchParams.set(k, msg); if (tahun) u.searchParams.set("tahun", tahun); return Response.redirect(u, 303); };
  if (!(await adminSegar())) return Response.json({ error: "Hanya untuk admin" }, { status: 403 });
  if (!storeConfigured()) return back("err", "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset");
  const f = await req.formData();
  const get = (k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string) : "");
  try {
    const { tahun, rows } = bacaFormTarget(get);
    await upsertTarget(rows);
    const u = rows.reduce((s, r) => s + r.utj, 0), a = rows.reduce((s, r) => s + r.akad, 0);
    return back("ok", `Target ${tahun} tersimpan: UTJ ${u}, akad ${a}`, tahun);
  } catch (e) {
    return back("err", e instanceof TargetError || e instanceof Error ? e.message : "Gagal menyimpan target", get("tahun") || undefined);
  }
}
