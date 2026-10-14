import { tulisNarasi } from "@/lib/narasi";

// Menerima JSON angka dari mesin forecast, mengembalikan narasi yang lolos validasi angka.
export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ error: "ANTHROPIC_API_KEY belum diset" }, { status: 503 });
  const input = await req.json();
  const call = async (system: string, user: string) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5", max_tokens: 1500, system, messages: [{ role: "user", content: user }] }),
    });
    const j = await r.json();
    return (j.content?.[0]?.text as string) ?? "";
  };
  const res = await tulisNarasi(input, call);
  return res.ok ? Response.json({ narasi: res.text }) : Response.json({ error: "Narasi memuat angka di luar data", bad: res.bad }, { status: 422 });
}
