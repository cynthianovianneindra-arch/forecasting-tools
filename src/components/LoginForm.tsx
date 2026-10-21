"use client";
import { useState } from "react";

export function LoginForm({ next, galat, siap }: { next: string; galat?: string; siap: boolean }) {
  const [lihat, setLihat] = useState(false);
  const [bantuan, setBantuan] = useState(false);
  return (
    <form method="post" action="/api/auth/login" className="lg-form">
      <h1>Welcome!</h1>
      <p className="lg-sub">Sign in to your Account</p>
      {galat && <p className="lg-err" role="alert">{galat}</p>}
      {!siap && <p className="lg-warn">Login belum aktif: isi SESSION_SECRET (minimal 32 karakter) di pengaturan server.</p>}
      <input type="hidden" name="next" value={next} />
      <label className="lg-pill">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.6" /><path d="M15.6 12v1.3a2.2 2.2 0 0 0 4.4 0V12a8 8 0 1 0-3.1 6.3" /></svg>
        <input type="email" name="email" placeholder="Email Address" aria-label="Email Address" required autoComplete="username" autoFocus />
      </label>
      <label className="lg-pill">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></svg>
        <input type={lihat ? "text" : "password"} name="password" placeholder="Password" aria-label="Password" required autoComplete="current-password" />
        <button type="button" className="lg-eye" onClick={() => setLihat((v) => !v)} aria-label={lihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} aria-pressed={lihat}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{lihat
            ? <><path d="M3 3l18 18M10.6 5.2A9.7 9.7 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.3 2.6-2.7 3.9M6.4 6.5C4.3 7.9 2.9 10 2.5 12c1 2.8 4.5 7 9.5 7 1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
            : <><path d="M2.5 12C3.5 9.2 7 5 12 5s8.5 4.2 9.5 7c-1 2.8-4.5 7-9.5 7S3.5 14.8 2.5 12z" /><circle cx="12" cy="12" r="3" /></>}</svg>
        </button>
      </label>
      <button type="button" className="lg-link lg-forgot" onClick={() => setBantuan((v) => !v)}>Forgot Password?</button>
      {bantuan && <p className="lg-help">Hubungi admin untuk mereset kata sandi Anda. Setelah direset, Anda bisa menggantinya sendiri di menu Akun.</p>}
      <label className="lg-check"><input type="checkbox" name="ingat" value="1" /> Remember me</label>
      <button type="submit" className="lg-btn">LOGIN</button>
    </form>
  );
}
