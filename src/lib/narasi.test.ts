import { it, expect } from "vitest";
import { unknownNumbers, tulisNarasi } from "./narasi";
const input = { utj: 7.1, akad: 6, periode: "Agu 2026" };
it("deteksi angka asing", () => {
  expect(unknownNumbers("UTJ sekitar 7,1 dan akad 6 pada Agu 2026", input)).toEqual([]);
  expect(unknownNumbers("UTJ sekitar 9", input)).toEqual(["9"]);
});
it("regenerasi sampai lolos", async () => {
  const outs = ["UTJ 99", "UTJ 7,1"]; let i = 0;
  const r = await tulisNarasi(input, async () => outs[i++]);
  expect(r).toMatchObject({ ok: true, text: "UTJ 7,1" });
});
