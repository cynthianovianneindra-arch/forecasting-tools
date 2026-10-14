import { createHash } from "node:crypto";
import { tulisNarasi } from "./narasi";

export const claudeConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/** Batas panggilan Claude per hari (UTC), env CLAUDE_DAILY_LIMIT, default 30. Disimpan di memori instance: pada serverless
 *  hitungan bisa ter-reset saat instance baru, jadi ini pengaman biaya kasar; batas keras tetap atur di console.anthropic.com. */
const used = { day: "", n: 0 };
export const dailyLimit = () => Math.max(0, parseInt(process.env.CLAUDE_DAILY_LIMIT ?? "30", 10) || 0);
export function takeBudget(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (used.day !== day) { used.day = day; used.n = 0; }
  if (used.n >= dailyLimit()) return false;
  used.n++;
  return true;
}
export const budgetLeft = () => Math.max(0, dailyLimit() - (used.day === new Date().toISOString().slice(0, 10) ? used.n : 0));
export function resetBudgetForTest() { used.day = ""; used.n = 0; }

export async function callClaude(system: string, user: string): Promise<string> {
  if (!takeBudget()) throw new Error("Batas harian panggilan Claude tercapai");
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
