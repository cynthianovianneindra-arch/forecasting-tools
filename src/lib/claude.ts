import { createHash } from "node:crypto";
import { tulisNarasi } from "./narasi";

export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** Batas panggilan Claude per hari (UTC), dipisah per jenis: "laporan" (env CLAUDE_DAILY_LIMIT, default 5) dan "sync" untuk
 *  pembacaan halaman BI/BPS (env CLAUDE_SYNC_DAILY_LIMIT, default 4). Disimpan di memori instance: pada serverless hitungan bisa
 *  ter-reset saat instance baru, jadi ini pengaman biaya kasar; batas keras tetap atur di console.anthropic.com. */
export type Jenis = "laporan" | "sync";
const used: Record<Jenis, { day: string; n: number }> = { laporan: { day: "", n: 0 }, sync: { day: "", n: 0 } };
const hariIni = () => new Date().toISOString().slice(0, 10);
export const dailyLimit = (j: Jenis = "laporan") =>
  Math.max(0, parseInt((j === "sync" ? process.env.CLAUDE_SYNC_DAILY_LIMIT : process.env.CLAUDE_DAILY_LIMIT) ?? (j === "sync" ? "4" : "5"), 10) || 0);
export function takeBudget(j: Jenis = "laporan"): boolean {
  const u = used[j];
  if (u.day !== hariIni()) { u.day = hariIni(); u.n = 0; }
  if (u.n >= dailyLimit(j)) return false;
  u.n++;
  return true;
}
export const budgetLeft = (j: Jenis = "laporan") => Math.max(0, dailyLimit(j) - (used[j].day === hariIni() ? used[j].n : 0));
export function resetBudgetForTest() { for (const u of Object.values(used)) { u.day = ""; u.n = 0; } }

export async function callClaude(system: string, user: string, jenis: Jenis = "laporan"): Promise<string> {
  if (!takeBudget(jenis)) throw new Error("Batas harian panggilan Claude tercapai");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5", max_tokens: 2200, system, messages: [{ role: "user", content: user }] }),
  });
  if (r.status === 401) throw new Error("Claude API 401: ANTHROPIC_API_KEY ditolak (key salah, ada spasi/baris baru di ujung, sudah dicabut, atau belum ada kredit); buat key baru dan isi ulang di Vercel");
  if (!r.ok) throw new Error(`Claude API ${r.status}`);
  const j = await r.json();
  return (j.content?.[0]?.text as string) ?? "";
}

export const SECTIONS = ["ringkasan", "proyeksi", "funnel", "bank", "marketing", "stok", "risiko", "rekomendasi"] as const;
export type Sections = Record<(typeof SECTIONS)[number], string>;

const FORMAT = `Balas HANYA JSON dengan kunci ${SECTIONS.join(", ")} (ringkasan = 6-8 kalimat yang merangkum hasil utama, kinerja, stok, marketing, ekonomi, dan risiko; yang lain masing-masing 2-4 kalimat): ringkasan = ringkasan manajemen yang detail; proyeksi = membaca proyeksi UTJ/akad beserta rentang; funnel = funnel dan pembatalan; bank = proses bank dan konteks ekonomi; stok = kondisi stok dan kebutuhan order bangun; risiko = risiko dan keterbatasan utama; rekomendasi = urutan tindakan prioritas untuk manajemen dari daftar rekomendasi yang diberikan; marketing = efektivitas marketing dari data marketing (sebut bahwa pola awal dan bukan sebab-akibat, sampel pendek). Jika data marketing tidak ada, isi marketing dengan "Data marketing belum tersedia."`;

const cache = new Map<string, { at: number; v: Sections | null }>();
const TTL = 60 * 60 * 1000;

/** Narasi laporan dari JSON angka. Null bila tidak ada key, API gagal, atau angka di teks tidak ada di JSON (setelah 3 percobaan). */
export async function narasiLaporan(input: unknown, call = callClaude): Promise<Sections | null> {
  if (call === callClaude && !claudeConfigured()) return null;
  const key = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  let out: Sections | null = null;
  try {
    const res = await tulisNarasi({ data: input, format: FORMAT }, async (sys, user) => {
      // tulisNarasi memvalidasi seluruh teks balasan terhadap JSON masukan
      return call(sys + "\n" + FORMAT, user);
    });
    if (res.ok) {
      const m = res.text.match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : null;
      if (j && SECTIONS.every((k) => typeof j[k] === "string")) out = j as Sections;
    }
  } catch { out = null; }
  if (out || budgetLeft() > 0) cache.set(key, { at: Date.now(), v: out });
  return out;
}
