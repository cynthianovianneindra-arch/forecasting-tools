import { driveConfigured, fetchFromDrive } from "@/lib/drive";
import { onedriveConfigured } from "@/lib/onedrive";
import { sinkronOneDrive } from "@/lib/sinkronExcel";
import { adminSegar } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Sinkron sumber data: Excel di OneDrive (utama) atau Google Drive (cadangan lama). Dijadwalkan harian lewat Vercel Cron (GET); tombol "Sinkron sekarang" (POST, admin).
export async function POST(req: Request) {
  if (!(await adminSegar())) return Response.json({ error: "Hanya untuk admin" }, { status: 403 });
  return run(req, true);
}
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  return run(req, false);
}
async function run(req: Request, manual: boolean) {
  const kembali = (kunci: "ok" | "err", pesan: string) => { const u = new URL("/", req.url); u.searchParams.set(kunci, pesan); return Response.redirect(u, 303); };
  if (onedriveConfigured()) {
    const h = await sinkronOneDrive(manual);
    if (manual) return kembali(h.status === "gagal" ? "err" : "ok", h.pesan);
    return Response.json({ ok: h.status !== "gagal", status: h.status, pesan: h.pesan }, { status: h.status === "gagal" ? 502 : 200 });
  }
  if (!driveConfigured()) return manual ? kembali("err", "ONEDRIVE_EXCEL_URL belum diset di Vercel") : Response.json({ error: "ONEDRIVE_EXCEL_URL belum diset" }, { status: 503 });
  try {
    const f = await fetchFromDrive(true);
    return manual ? kembali("ok", `Google Drive dibaca: ${f.name}`) : Response.json({ ok: true, name: f.name, modifiedTime: f.modifiedTime });
  } catch (e) { return manual ? kembali("err", e instanceof Error ? e.message : String(e)) : Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
