import { jagaLonjakan, syncLive } from "@/lib/macroLive";
import { adminSegar } from "@/lib/auth";
import { listMacroLive, storeConfigured, upsertMacroLive } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const TUJUH_HARI = 7 * 24 * 3600 * 1000;

/** paksa = tombol manual (selalu ambil); cron harian melewati inflasi/BI Rate yang sudah diambil dalam 7 hari. */
async function run(paksa = false) {
  if (!storeConfigured()) return { error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset", hasil: [] };
  const lewati = new Set<string>();
  const ada = await listMacroLive();
  for (const ind of ["inflasi", "birate"]) {
    const t = Math.max(0, ...ada.filter((x) => x.indikator === ind).map((x) => Date.parse(x.diambil) || 0));
    if (Date.now() - t < TUJUH_HARI) lewati.add(ind);
  }
  const mentah = await syncLive({ lewati: paksa ? new Set<string>() : lewati });
  const { rows, hasil } = jagaLonjakan(mentah.rows, mentah.hasil, ada);
  await upsertMacroLive(rows); // sumber yang gagal tidak menimpa data terakhir
  return { hasil };
}

// Tombol di layar Data (hanya admin): ambil IHSG/emas (Yahoo), inflasi (bps.go.id), BI Rate (bi.go.id).
export async function POST(req: Request) {
  const back = (k: string, msg: string) => { const u = new URL("/data", req.url); u.searchParams.set(k, msg); return Response.redirect(u, 303); };
  if (!(await adminSegar())) return Response.json({ error: "Hanya untuk admin" }, { status: 403 });
  try {
    const r = await run(true);
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
