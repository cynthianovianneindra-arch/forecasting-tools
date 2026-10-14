import { it, expect, vi, afterEach } from "vitest";
import { latestDataset, saveDataset, storeConfigured } from "./store";
afterEach(() => { vi.unstubAllGlobals(); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; });
it("nonaktif tanpa env", async () => { expect(storeConfigured()).toBe(false); expect(await latestDataset()).toBeNull(); });
it("simpan dan baca lewat PostgREST", async () => {
  process.env.SUPABASE_URL = "https://x.supabase.co"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
  const f = vi.fn(async (_u: string, init?: RequestInit) => init?.method === "POST" ? new Response(null, { status: 201 }) : new Response(JSON.stringify([{ id: 1, filename: "a.xlsx", txns: [] }]), { status: 200 }));
  vi.stubGlobal("fetch", f);
  await saveDataset("a.xlsx", "kalender", { txns: [{ utj: "2025-01" }], rows: 1, utj: 1, akad: 0, batal: 0, warnings: [] });
  expect(JSON.parse(f.mock.calls[0][1]!.body as string)).toMatchObject({ filename: "a.xlsx", utj: 1 });
  expect((await latestDataset())?.filename).toBe("a.xlsx");
});
