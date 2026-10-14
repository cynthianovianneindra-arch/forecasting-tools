import { driveConfigured, fetchFromDrive } from "@/lib/drive";
import { adminSegar } from "@/lib/auth";

// Paksa ambil ulang dari Drive lalu kembali ke layar Data. Dijadwalkan harian lewat Vercel Cron (GET).
export async function POST(req: Request) {
  if (!(await adminSegar())) return Response.json({ error: "Hanya untuk admin" }, { status: 403 });
  return run(req, true);
}
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  return run(req, false);
}
async function run(req: Request, redirect: boolean) {
  if (!driveConfigured()) return Response.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON belum diset" }, { status: 503 });
  try {
    const f = await fetchFromDrive(true);
    return redirect ? Response.redirect(new URL("/data", req.url), 303) : Response.json({ ok: true, name: f.name, modifiedTime: f.modifiedTime });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
