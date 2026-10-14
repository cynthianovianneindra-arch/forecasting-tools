import { it, expect } from "vitest";
import { applyFilter, cards } from "./insights";
const t = [
  { utj: "2025-01", akad: "2025-03", tipe: "A", agent: "X", leads: "IG", spr: true, cair: true, banks: [{ bank: "BTN", hari: 20, status: "APPROVE" }] },
  { utj: "2025-02", batal: "2025-04", tipe: "B", agent: "X", leads: "IG", alasanBatal: "Reject Bank", banks: [{ bank: "BTN", hari: 30, status: "REJECT" }] },
];
it("filter dan kartu", () => {
  expect(applyFilter(t, { tipe: "A" }, true)).toHaveLength(1);
  const c = cards(t);
  expect(c.funnel).toMatchObject({ utj: 2, akad: 1, batal: 1, spr: 1 });
  expect(c.bank[0]).toMatchObject({ bank: "BTN", berkas: 2, approve: 50, hari: 25 });
  expect(c.alasan).toMatchObject({ tercatat: 1, total: 1 });
});
