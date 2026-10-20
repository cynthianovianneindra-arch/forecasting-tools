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
      <div className="lg-frame">
        <div className="lg-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" /><span>Shaistanaya City<small>PT Neo Pudji Jaya</small></span>
        </div>
        <div className="lg-stack">
          <LoginForm next={next} galat={q.err} siap={secretValid(process.env.SESSION_SECRET)} />
          <p className="lg-foot">Belum punya akun? <b>Hubungi admin</b> untuk dibuatkan.</p>
        </div>
      </div>
    </main>
  );
}
