import { callClaude, claudeConfigured } from "@/lib/claude";
import { tulisNarasi } from "@/lib/narasi";

const MAX_BODY = 20_000; // karakter JSON masukan

// Menerima JSON angka dari mesin forecast, mengembalikan narasi yang lolos validasi angka.
// Dikunci dengan NARASI_TOKEN (header Authorization: Bearer ...) agar tidak bisa dipakai orang lain.
export async function POST(req: Request) {
  const token = process.env.NARASI_TOKEN;
  if (!token) return Response.json({ error: "NARASI_TOKEN belum diset; endpoint dinonaktifkan" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${token}`) return new Response("unauthorized", { status: 401 });
  if (!claudeConfigured()) return Response.json({ error: "ANTHROPIC_API_KEY belum diset" }, { status: 503 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return Response.json({ error: "Masukan terlalu besar" }, { status: 413 });
  try {
    const res = await tulisNarasi(JSON.parse(raw), callClaude);
    return res.ok ? Response.json({ narasi: res.text }) : Response.json({ error: "Narasi memuat angka di luar data", bad: res.bad }, { status: 422 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: /Batas harian/.test(msg) ? 429 : 502 });
  }
}
