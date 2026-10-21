import { it, expect } from "vitest";
import { rapikan, normalisasiTelepon, rapikanTxns } from "./rapi";
import { cocokkanLeads, normNama, tingkatCocok } from "./leads";

it("rapikan: kapital seragam, singkatan dan kode unit tetap", () => {
  expect(rapikan("TEAM ARIYANTI")).toBe("Team Ariyanti");
  expect(rapikan("inhouse")).toBe("Inhouse");
  expect(rapikan("  new   gwen ")).toBe("New Gwen");
  expect(rapikan("BRCS")).toBe("BRCS");
  expect(rapikan("BRI")).toBe("BRI");
  expect(rapikan("DKI SYARIAH")).toBe("DKI Syariah");
  expect(rapikan("A-01")).toBe("A-01");
  expect(rapikan("Arnica 70")).toBe("Arnica 70");
  expect(rapikan("(KOSONG)")).toBe("(Kosong)");
  expect(rapikan("OPEN HOUSE")).toBe("Open House");
  expect(rapikan(undefined)).toBe("");
});

it("rapikanTxns menyeragamkan agent, marketing, bank", () => {
  const [t] = rapikanTxns([{ utj: "2026-01", agent: "INHOUSE", marketing: "RISKY", banks: [{ bank: "BTN", hari: 3, status: "PROSES" }] }]);
  expect(t.agent).toBe("Inhouse"); expect(t.marketing).toBe("Risky"); expect(t.banks![0].bank).toBe("BTN");
});

it("telepon: berbagai format menjadi 62xxxxxxxxxx", () => {
  for (const v of ["857821797", "0857821797", "+62857821797", "62857821797", "(0857) 821-797", "0857 821 797", 857821797, "0857821797 / 0812345678"])
    expect(normalisasiTelepon(v)).toBe("62857821797");
  expect(normalisasiTelepon("08123")).toBeNull();
  expect(normalisasiTelepon("")).toBeNull();
  expect(normalisasiTelepon(null)).toBeNull();
  expect(normalisasiTelepon("abc")).toBeNull();
  expect(normalisasiTelepon("0211234567")).toBeNull(); // telepon rumah bukan seluler
});

it("normNama: tanpa gelar dan tanda baca", () => {
  expect(normNama("Bapak H. Budi Santoso, S.E.")).toBe("BUDI SANTOSO");
  expect(normNama("Éka  Putri")).toBe("EKA PUTRI");
});

it("tingkat cocok nama", () => {
  expect(tingkatCocok("BUDI SANTOSO", "BUDI SANTOSO")).toBe(1);
  expect(tingkatCocok("SANTOSO BUDI", "BUDI SANTOSO")).toBe(2);
  expect(tingkatCocok("BUDI SANTOSO", "BUDI SANTOSO PUTRA")).toBe(3);
  expect(tingkatCocok("HENDRIK SUGIANTO", "HENDRIK SUGIANTA")).toBe(4);
  expect(tingkatCocok("BUDI", "BUDI SANTOSO")).toBe(0);
  expect(tingkatCocok("ANI", "ANA")).toBe(0);
});

it("cocokkan leads: nama pasti, telepon, tebakan satu nama; UTJ dipakai satu kali; tidak boleh UTJ sebelum lead", () => {
  const leads = [
    { nama: "BUDI SANTOSO", bulan: "2026-01", marketing: "RISKY" },
    { nama: "", bulan: "2026-01", marketing: "RISKY", telp: "62857821797" },
    { nama: "ARTO", bulan: "2026-02", marketing: "ADI" },
    { nama: "BUDI SANTOSO", bulan: "2026-03", marketing: "RISKY" },   // UTJ sudah terpakai oleh lead pertama
    { nama: "CITRA DEWI", bulan: "2026-05", marketing: "ADI" },        // UTJ-nya sebelum lead
  ];
  const utj = [
    { nama: "BUDI SANTOSO", bulan: "2026-02", marketing: "RISKY" },
    { nama: "DONI", bulan: "2026-02", marketing: "RISKY", telp: "62857821797" },
    { nama: "ARTO WIBOWO", bulan: "2026-03", marketing: "ADI" },
    { nama: "CITRA DEWI", bulan: "2026-03", marketing: "ADI" },
  ];
  const h = cocokkanLeads(leads, utj);
  expect(h.get(0)).toBe("pasti");
  expect(h.get(1)).toBe("pasti");
  expect(h.get(2)).toBe("kira");
  expect(h.has(3)).toBe(false);
  expect(h.has(4)).toBe(false);
});
