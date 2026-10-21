import { sinkronExcel, sumberExcel } from "@/lib/sinkronExcel";
import { adminSegar } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Sinkron Excel sumber (OneDrive atau Google Drive): baca file, simpan sebagai dataset bila isinya berubah. Dijadwalkan harian lewat Vercel Cron (GET); tombol "Sinkron Excel sekarang" (POST, admin) selalu menyimpan ulang.
export async function POST(req: Request) {
  if (!(await adminSegar())) return Response.json({ error: "Hanya untuk admin" }, { status: 403 });
  const h = await sinkronExcel(true);
  const u = new URL("/", req.url);
  u.searchParams.set(h.status === "gagal" ? "err" : "ok", h.pesan);
  return Response.redirect(u, 303);
}
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  if (!sumberExcel()) return Response.json({ error: "ONEDRIVE_EXCEL_URL belum diset" }, { status: 503 });
  const h = await sinkronExcel(false);
  return Response.json({ ok: h.status !== "gagal", status: h.status, pesan: h.pesan }, { status: h.status === "gagal" ? 502 : 200 });
}
