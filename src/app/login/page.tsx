import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { sesiSaatIni } from "@/lib/auth";
import { amanNext, secretValid } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Masuk · Forecast Penjualan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ err?: string; next?: string }> }) {
  const q = await searchParams;
  const next = amanNext(q.next);
  if (await sesiSaatIni()) redirect(next);
  return (
    <main className="login">
      <section className="lg-art" aria-hidden="true">
        <div className="lg-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" /><span>Shaistanaya City</span>
        </div>
        <div className="lg-copy">
          <h2>Proyeksi penjualan yang jelas.</h2>
          <p>UTJ, akad, dan penerimaan untuk bulan-bulan ke depan, lengkap dengan laporan siap cetak untuk tim Shaistanaya City.</p>
        </div>
        <svg className="lg-dune" viewBox="0 0 600 120" preserveAspectRatio="none"><path d="M0 120V70C80 40 160 30 250 50c90 20 150 50 230 30 50-12 90-30 120-45v85z" /></svg>
      </section>
      <section className="lg-side"><LoginForm next={next} galat={q.err} siap={secretValid(process.env.SESSION_SECRET)} /></section>
    </main>
  );
}
