import { dorongConfigured, kunciCocok, simpanBerkas } from "@/lib/sinkronExcel";
import { miripXlsx, sidikBerkas } from "@/lib/onedrive";
import { storeConfigured } from "@/lib/store";
import { bukuDariLembar } from "@/lib/lembarMasuk";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAKS_BYTE = 4.3 * 1024 * 1024; // batas body fungsi serverless Vercel ±4,5 MB

// Apps Script di Google Sheets mengirim berkas xlsx (isi spreadsheet) ke sini. Kunci rahasia = env EXCEL_PUSH_SECRET (header Authorization: Bearer ...).
export async function POST(req: Request) {
  if (!dorongConfigured()) return Response.json({ error: "EXCEL_PUSH_SECRET belum diset (minimal 24 karakter)" }, { status: 503 });
  const auth = req.headers.get("authorization") ?? "";
  if (!kunciCocok(auth.startsWith("Bearer ") ? auth.slice(7) : null, process.env.EXCEL_PUSH_SECRET)) return Response.json({ error: "Kunci salah" }, { status: 401 });
  if (!storeConfigured()) return Response.json({ error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset" }, { status: 503 });
  const mentah = await req.arrayBuffer();
  if (mentah.byteLength > MAKS_BYTE) return Response.json({ error: "Kiriman terlalu besar (maks 4,3 MB)" }, { status: 413 });
  let buf = mentah, nama = req.headers.get("x-nama-berkas")?.slice(0, 120) || "Excel.xlsx", sumber = "Apps Script";
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    // Office Script (Excel di web) mengirim isi sheet sebagai JSON; disusun jadi xlsx di memori lalu dibaca seperti biasa
    try {
      const j = JSON.parse(new TextDecoder().decode(mentah)) as { nama?: string; sheets?: unknown };
      if (typeof j.nama === "string") nama = j.nama.slice(0, 120);
      buf = await bukuDariLembar(j.sheets);
      sumber = "Office Script";
    } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "JSON tidak valid" }, { status: 400 }); }
  } else if (!miripXlsx(buf)) return Response.json({ error: "Isi bukan berkas xlsx atau JSON" }, { status: 400 });
  const h = await simpanBerkas({ buffer: buf, nama, sidik: sidikBerkas(mentah), sumber });
  return Response.json({ ok: h.status !== "gagal", status: h.status, pesan: h.pesan }, { status: h.status === "gagal" ? 422 : 200 });
}
