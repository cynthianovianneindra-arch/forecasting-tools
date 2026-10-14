import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Membuat PDF dari halaman /laporan dengan parameter yang sama (browser tanpa layar di server), lalu mengirimnya sebagai unduhan.
 *  Dilindungi middleware (harus login). Parameter narasi dibuang agar pembuatan PDF tidak pernah memanggil Claude. */
export async function GET(req: NextRequest) {
  const sp = new URLSearchParams(req.nextUrl.searchParams);
  sp.delete("narasi");
  const nama = (sp.get("nama") ?? "Laporan").replace(/[^\w\- .]/g, "").trim().slice(0, 80) || "Laporan";
  sp.delete("nama");
  const cookie = req.cookies.get(COOKIE)?.value;
  const lokal = !process.env.VERCEL;
  let browser;
  try {
    browser = await puppeteer.launch(lokal
      ? { executablePath: process.env.PDF_CHROME_PATH ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"], headless: true }
      : { executablePath: await chromium.executablePath(), args: chromium.args, headless: "shell" });
    const page = await browser.newPage();
    const url = new URL("/laporan", req.nextUrl.origin);
    url.search = sp.toString();
    if (cookie) await page.setCookie({ name: COOKIE, value: cookie, url: url.origin });
    await page.setViewport({ width: 1100, height: 1500 });
    await page.emulateMediaType("print");
    const res = await page.goto(url.toString(), { waitUntil: "networkidle0", timeout: 45000 });
    if (!res || !res.ok() || new URL(page.url()).pathname !== "/laporan") return NextResponse.json({ error: "Gagal membuka halaman laporan" }, { status: 502 });
    const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    return new NextResponse(Buffer.from(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${encodeURIComponent(nama)}.pdf"`, "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: `Gagal membuat PDF: ${e instanceof Error ? e.message : "tidak diketahui"}` }, { status: 500 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
