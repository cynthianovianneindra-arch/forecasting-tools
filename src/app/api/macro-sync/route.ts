import { syncLive } from "@/lib/macroLive";
import { storeConfigured, upsertMacroLive } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

async function run() {
  if (!storeConfigured()) return { error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset", hasil: [] };
  const { rows, hasil } = await syncLive();
  await upsertMacroLive(rows); // sumber yang gagal tidak menimpa data terakhir
  return { hasil };
}

// Tombol di layar Data (butuh UPLOAD_TOKEN): ambil IHSG/emas (Yahoo), inflasi (bps.go.id), BI Rate (bi.go.id).
export async function POST(req: Request) {
  const token = process.env.UPLOAD_TOKEN;
  const form = await req.formData();
  const back = (k: string, msg: string) => { const u = new URL("/data", req.url); u.searchParams.set(k, msg); return Response.redirect(u, 303); };
  if (!token) return back("err", "UPLOAD_TOKEN belum diset; sinkron data ekonomi dinonaktifkan");
  if (form.get("token") !== token) return back("err", "Token salah");
  try {
    const r = await run();
    if ("error" in r && r.error) return back("err", r.error);
    const ok = r.hasil.filter((h) => h.ok).length;
    const gagal = r.hasil.filter((h) => !h.ok).map((h) => `${h.sumber} (${h.indikator}): ${h.error}`);
    return back(gagal.length ? "err" : "ok", `Sinkron data ekonomi: ${ok} dari ${r.hasil.length} sumber berhasil.${gagal.length ? " Gagal: " + gagal.join("; ") : ""}`);
  } catch (e) { return back("err", e instanceof Error ? e.message : "Gagal sinkron"); }
}

// Cron harian Vercel.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  try { return Response.json(await run()); } catch (e) { return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
