import { it, expect } from "vitest";
import { narasiLaporan, takeBudget, resetBudgetForTest, dailyLimit } from "./claude";
const input = { utj12: 85, akad12: 57, proyeksiUtj: 85.0 };
const ok = JSON.stringify({ ringkasan: "UTJ 85 dan akad 57.", proyeksi: "Proyeksi UTJ 85,0.", funnel: "Stabil.", bank: "Ekonomi lemah." });
it("lolos bila angka ada di JSON", async () => {
  expect(await narasiLaporan(input, async () => ok)).toMatchObject({ ringkasan: "UTJ 85 dan akad 57." });
});
it("null bila Claude mengarang angka", async () => {
  const bad = JSON.stringify({ ringkasan: "UTJ 99.", proyeksi: "a", funnel: "b", bank: "c" });
  expect(await narasiLaporan({ x: 1 }, async () => bad)).toBeNull();
});
it("null bila bukan JSON", async () => {
  expect(await narasiLaporan({ y: 2 }, async () => "halo")).toBeNull();
});
it("batas harian", () => {
  process.env.CLAUDE_DAILY_LIMIT = "2"; resetBudgetForTest();
  expect([takeBudget(), takeBudget(), takeBudget()]).toEqual([true, true, false]);
  expect(dailyLimit()).toBe(2);
  delete process.env.CLAUDE_DAILY_LIMIT; resetBudgetForTest();
});
