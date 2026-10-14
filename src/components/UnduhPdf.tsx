"use client";
import { useState } from "react";

/** Membuat PDF di server dari tampilan laporan yang sedang dibuka, lalu mengunduhnya otomatis. */
export function UnduhPdf({ nama }: { nama: string }) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const unduh = async () => {
    setSibuk(true); setGalat("");
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set("nama", nama);
      const r = await fetch(`/api/laporan/pdf?${sp.toString()}`);
      if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { error?: string } | null)?.error ?? `Gagal (${r.status})`);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = url; a.download = `${nama}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { setGalat(e instanceof Error ? e.message : "Gagal membuat PDF"); }
    finally { setSibuk(false); }
  };
  return <>
    <button className="btn" type="button" onClick={unduh} disabled={sibuk}>{sibuk ? "Membuat PDF…" : "Unduh PDF"}</button>
    {galat ? <span className="muted" role="alert" style={{ color: "#B3261E", fontSize: 13 }}>{galat}</span> : null}
  </>;
}
