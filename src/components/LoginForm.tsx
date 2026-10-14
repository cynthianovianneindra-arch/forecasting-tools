"use client";
import { useState } from "react";

export function LoginForm({ next, galat, siap }: { next: string; galat?: string; siap: boolean }) {
  const [lihat, setLihat] = useState(false);
  const [bantuan, setBantuan] = useState(false);
  return (
    <form method="post" action="/api/auth/login" className="lg-form">
      <h1>Selamat datang kembali!</h1>
      <p className="lg-sub">Masuk dengan akun yang diberikan admin.</p>
      {galat && <p className="lg-err" role="alert">{galat}</p>}
      {!siap && <p className="lg-warn">Login belum aktif: isi SESSION_SECRET (minimal 32 karakter) di pengaturan server.</p>}
      <input type="hidden" name="next" value={next} />
      <label className="lg-field">Email
        <input type="email" name="email" placeholder="Masukkan email Anda" required autoComplete="username" autoFocus />
      </label>
      <label className="lg-field">Kata sandi
        <span className="lg-pw">
          <input type={lihat ? "text" : "password"} name="password" placeholder="Masukkan kata sandi" required autoComplete="current-password" />
          <button type="button" className="lg-eye" onClick={() => setLihat((v) => !v)} aria-label={lihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={lihat}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{lihat
              ? <><path d="M3 3l18 18M10.6 5.2A9.7 9.7 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.3 2.6-2.7 3.9M6.4 6.5C4.3 7.9 2.9 10 2.5 12c1 2.8 4.5 7 9.5 7 1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
              : <><path d="M2.5 12C3.5 9.2 7 5 12 5s8.5 4.2 9.5 7c-1 2.8-4.5 7-9.5 7S3.5 14.8 2.5 12z" /><circle cx="12" cy="12" r="3" /></>}</svg>
          </button>
        </span>
      </label>
      <div className="lg-row">
        <label className="lg-check"><input type="checkbox" name="ingat" value="1" /> Ingat saya (30 hari)</label>
        <button type="button" className="lg-link" onClick={() => setBantuan((v) => !v)}>Lupa kata sandi?</button>
      </div>
      {bantuan && <p className="lg-help">Hubungi admin untuk mereset kata sandi Anda. Setelah direset, Anda bisa menggantinya sendiri di menu Akun.</p>}
      <button type="submit" className="lg-btn">Masuk</button>
      <p className="lg-foot">Akun dibuat oleh admin. Belum punya akun? Minta admin menambahkan email Anda.</p>
    </form>
  );
}
