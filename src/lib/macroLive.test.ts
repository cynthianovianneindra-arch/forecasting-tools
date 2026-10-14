import { it, expect, vi } from "vitest";
import { bacaTabelDeterministik, berdekatan, jagaLonjakan, sekitarKataKunci, parseYahooMonthly, htmlToText, extractFromPage, mergeMacro, syncLive } from "./macroLive";

const yahoo = (closes: (number | null)[]) => ({ chart: { result: [{ timestamp: closes.map((_, i) => Date.UTC(2026, i, 1) / 1000), indicators: { quote: [{ close: closes }] } }] } });

it("parse Yahoo: bulan, abaikan null, urut", () => {
  expect(parseYahooMonthly(yahoo([100.123, null, 120]))).toEqual([{ bulan: "2026-01", nilai: 100.12 }, { bulan: "2026-03", nilai: 120 }]);
  expect(parseYahooMonthly({})).toEqual([]);
});
it("htmlToText membuang script dan tag", () => {
  expect(htmlToText("<html><script>x=1</script><p>Inflasi <b>2,42</b>&nbsp;persen</p></html>")).toBe("Inflasi 2,42 persen");
});
it("ekstraksi lolos hanya bila angka ada di teks dan wajar", async () => {
  const teks = "Inflasi tahunan September 2026 sebesar 2,42 persen";
  expect(await extractFromPage(teks, "inflasi", async () => '{"bulan":"2026-09","nilai":2.42}')).toEqual({ bulan: "2026-09", nilai: 2.42 });
  await expect(extractFromPage(teks, "inflasi", async () => '{"bulan":"2026-09","nilai":3.1}')).rejects.toThrow(/halusinasi/);
  await expect(extractFromPage(teks, "inflasi", async () => '{"bulan":"2026-13","nilai":2.42}')).rejects.toThrow(/Bulan tidak valid/);
  await expect(extractFromPage("BI Rate 55 persen", "birate", async () => '{"bulan":"2026-09","nilai":55}')).rejects.toThrow(/rentang/);
  await expect(extractFromPage(teks, "inflasi", async () => '{"bulan":null,"nilai":null}')).rejects.toThrow(/tidak ditemukan/);
});
it("merge: live menimpa bulan sama, inflasi persen -> pecahan", () => {
  const excel = [{ bulan: "2026-05", emas: 1, ihsg: 2, inflasi: 0.02, ihpr: null, birate: 5 }];
  const r = mergeMacro(excel, [{ bulan: "2026-05", indikator: "ihsg", nilai: 9 }, { bulan: "2026-06", indikator: "inflasi", nilai: 2.5 }]);
  expect(r[0]).toMatchObject({ bulan: "2026-05", ihsg: 9, emas: 1 });
  expect(r[1]).toMatchObject({ bulan: "2026-06", inflasi: 0.025 });
});
it("inflasi: BPS 403 -> cadangan halaman BI dipakai", async () => {
  const f = vi.fn(async (u: RequestInfo | URL) => {
    const url = String(u);
    if (url.includes("yahoo")) return new Response(JSON.stringify(yahoo([100])));
    if (url.includes("bps.go.id")) return new Response("forbidden", { status: 403 });
    return new Response("<p>Inflasi IHK tahunan September 2026 sebesar 2,42 persen</p>");
  });
  const { hasil } = await syncLive({ fetch: f as unknown as typeof fetch, call: async () => '{"bulan":"2026-09","nilai":2.42}' });
  expect(hasil.find((h) => h.indikator === "inflasi")).toMatchObject({ ok: true, nilai: 2.42, sumber: "bi.go.id (data inflasi) [dibaca Claude]" });
});
it("inflasi: semua sumber gagal -> galat gabungan, sumber lain tetap jalan", async () => {
  const f = vi.fn(async (u: RequestInfo | URL) => String(u).includes("yahoo") ? new Response(JSON.stringify(yahoo([100]))) : new Response("x", { status: 403 }));
  const { hasil } = await syncLive({ fetch: f as unknown as typeof fetch, call: async () => "{}" });
  const inf = hasil.find((h) => h.indikator === "inflasi")!;
  expect(inf.ok).toBe(false);
  expect(inf.error).toMatch(/bps\.go\.id.*403.*bi\.go\.id/);
  expect(hasil.find((h) => h.indikator === "ihsg")?.ok).toBe(true);
});
it("syncLive: satu sumber gagal tidak menghentikan yang lain", async () => {
  const f = vi.fn(async (u: RequestInfo | URL) => String(u).includes("yahoo") ? (String(u).includes("JKSE") ? new Response(JSON.stringify(yahoo([7000, 7100]))) : new Response("x", { status: 429 })) : new Response("<p>BI-Rate September 2026 sebesar 5,25 persen</p>"));
  const { rows, hasil } = await syncLive({ fetch: f as unknown as typeof fetch, call: async () => '{"bulan":"2026-09","nilai":5.25}' });
  expect(hasil.find((h) => h.indikator === "ihsg")?.ok).toBe(true);
  expect(hasil.find((h) => h.indikator === "emas")).toMatchObject({ ok: false });
  expect(hasil.find((h) => h.indikator === "birate")?.ok).toBe(true);
  expect(rows.some((r) => r.indikator === "ihsg" && r.nilai === 7100)).toBe(true);
});
it("syncLive: inflasi/birate yang dilewati tidak memanggil Claude", async () => {
  const f = vi.fn(async (u: RequestInfo | URL) => String(u).includes("yahoo") ? new Response(JSON.stringify(yahoo([100]))) : new Response("x", { status: 403 }));
  const call = vi.fn(async () => "{}");
  const { hasil } = await syncLive({ fetch: f as unknown as typeof fetch, call, lewati: new Set(["inflasi", "birate"]) });
  expect(call).not.toHaveBeenCalled();
  expect(hasil.filter((h) => h.indikator === "inflasi" || h.indikator === "birate").every((h) => h.ok && /dilewati/.test(h.sumber))).toBe(true);
});
it("sekitarKataKunci mengutamakan potongan berangka dan membuang menu", () => {
  const menu = "Beranda Tentang BI Profil Kontak ".repeat(300);
  const teks = `${menu} Data BI-Rate: 16 September 2026 | 4,75 % ${menu}`;
  const p = sekitarKataKunci(teks, "birate");
  expect(p).toContain("4,75");
  expect(p.length).toBeLessThanOrEqual(6000);
});
it("balasan bukan JSON memuat cuplikan balasan untuk diagnosis", async () => {
  await expect(extractFromPage("BI-Rate 4,75", "birate", async () => "Maaf, saya tidak menemukan data.")).rejects.toThrow(/Maaf, saya tidak menemukan/);
});
it("tabel BI-Rate dibaca tanpa Claude: ambil tanggal terbaru", () => {
  const teks = "Menu Beranda BI-Rate Tanggal BI-Rate 16 Juli 2026 4,75 % 18 Agustus 2026 5,00 % 16 September 2026 4,75 % Lainnya";
  expect(bacaTabelDeterministik(teks, "birate")).toEqual({ bulan: "2026-09", nilai: 4.75 });
});
it("tabel inflasi YoY dibaca; halaman yang memuat MtM tidak ditebak", () => {
  expect(bacaTabelDeterministik("Data Inflasi Agustus 2026 2,31 % September 2026 2,42 %", "inflasi")).toEqual({ bulan: "2026-09", nilai: 2.42 });
  expect(bacaTabelDeterministik("Inflasi MtM September 2026 0,12 %", "inflasi")).toBeNull();
});
it("tidak ada pola -> null (cadangan Claude)", () => {
  expect(bacaTabelDeterministik("halaman kosong tanpa tabel", "birate")).toBeNull();
});
it("berdekatan: angka harus dekat bulan yang dilaporkan", () => {
  const teks = "September 2026 inflasi 2,42 persen " + "x ".repeat(400) + " tarif 4,75 persen";
  expect(berdekatan(teks, "2026-09", 2.42)).toBe(true);
  expect(berdekatan(teks, "2026-09", 4.75)).toBe(false);
  expect(berdekatan(teks, "2026-08", 2.42)).toBe(false);
});
it("ekstraksi Claude ditolak bila angka tidak berdekatan dengan bulan", async () => {
  const teks = "Inflasi tahunan September 2026 sebesar 2,10 persen. " + "x ".repeat(150) + " lain-lain 2,42";
  await expect(extractFromPage(teks, "inflasi", async () => '{"bulan":"2026-09","nilai":2.42}')).rejects.toThrow(/berdekatan|terkait/);
});
it("jagaLonjakan menolak lonjakan besar dan menahan penyimpanan", () => {
  const rows = [{ bulan: "2026-09", indikator: "birate" as const, nilai: 9.5, sumber: "bi.go.id" }, { bulan: "2026-09", indikator: "ihsg" as const, nilai: 7000, sumber: "Yahoo" }];
  const hasil = [{ indikator: "birate" as const, ok: true, bulan: "2026-09", nilai: 9.5, sumber: "bi.go.id" }, { indikator: "ihsg" as const, ok: true, bulan: "2026-09", nilai: 7000, sumber: "Yahoo" }];
  const r = jagaLonjakan(rows, hasil, [{ bulan: "2026-08", indikator: "birate", nilai: 4.75 }]);
  expect(r.rows.map((x) => x.indikator)).toEqual(["ihsg"]);
  expect(r.hasil.find((h) => h.indikator === "birate")).toMatchObject({ ok: false });
  expect(jagaLonjakan(rows, hasil, [{ bulan: "2026-08", indikator: "birate", nilai: 9.0 }]).rows).toHaveLength(2);
});
