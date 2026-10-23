import { Nav, badge } from "@/components/Nav";
import { BatangH, Donat, Garis, Temuan, Tumpuk } from "@/components/Grafik";
import { getData } from "@/lib/data";
import { rapikan } from "@/lib/rapi";
import { f1, labelBulan } from "@/lib/format";
import { addMonths, ym } from "@/lib/forecast";

export const dynamic = "force-dynamic";

export default async function Page() {
  const d = await getData();
  const tx = d.txns;
  const ada = d.source !== "demo" && tx.some((t) => (t.banks ?? []).length);
  const kasus = tx.flatMap((t) => (t.banks ?? []).map((b) => ({ ...b, t })));
  const perBank = new Map<string, { n: number; approve: number; reject: number; withdraw: number; proses: number; hari: number[] }>();
  for (const k of kasus) {
    const e = perBank.get(k.bank) ?? { n: 0, approve: 0, reject: 0, withdraw: 0, proses: 0, hari: [] };
    e.n++; if (/APPROVE|ACC|SETUJU/.test(k.status)) e.approve++; else if (/REJECT|TOLAK/.test(k.status)) e.reject++; else if (/WITHDRAW|CABUT|BATAL/.test(k.status)) e.withdraw++; else if (/PROSES/.test(k.status)) e.proses++;
    if (k.hari !== null && k.hari >= 0) e.hari.push(k.hari);
    perBank.set(k.bank, e);
  }
  const baris = [...perBank].map(([bank, e]) => ({ bank, ...e, persenApprove: e.n ? Math.round((e.approve / e.n) * 1000) / 10 : 0, rataHari: e.hari.length ? e.hari.reduce((a, c) => a + c, 0) / e.hari.length : null })).sort((a, b) => b.n - a.n);
  const layak = baris.filter((b) => b.n >= 5);
  const terbaik = [...layak].sort((a, b) => b.persenApprove - a.persenApprove)[0], tercepat = [...layak].filter((b) => b.rataHari !== null).sort((a, b) => a.rataHari! - b.rataHari!)[0], terburuk = [...layak].sort((a, b) => a.persenApprove - b.persenApprove)[0];
  const status = [{ label: "Approved", value: baris.reduce((s, b) => s + b.approve, 0) }, { label: "Proses", value: baris.reduce((s, b) => s + b.proses, 0) }, { label: "Reject", value: baris.reduce((s, b) => s + b.reject, 0) }, { label: "Withdraw", value: baris.reduce((s, b) => s + b.withdraw, 0) }].filter((x) => x.value > 0);
  const terbuka = tx.filter((t) => !t.akad && !t.batal);
  const dalamBank = terbuka.filter((t) => (t.banks ?? []).some((b) => /PROSES/.test(b.status)));
  const nilai = terbuka.reduce((s, t) => s + (t.netPrice ?? d.netPrice * 1e9), 0) / 1e9;
  // Analisa tambahan
  const jenis = (st: string) => (/APPROVE|ACC|SETUJU/.test(st) ? 0 : /REJECT|TOLAK/.test(st) ? 1 : /WITHDRAW|CABUT|BATAL/.test(st) ? 2 : /PROSES/.test(st) ? 3 : -1);
  const tumpuk = baris.map((b) => ({ label: rapikan(b.bank), nilai: [b.approve, b.reject, b.withdraw, b.proses] }));
  const bulanList = Array.from({ length: 18 }, (_, i) => addMonths(d.end, i - 17));
  const perBulan = new Map<string, { n: number; ok: number }>();
  for (const k of kasus) { const e = perBulan.get(k.t.utj) ?? { n: 0, ok: 0 }; e.n++; if (jenis(k.status) === 0) e.ok++; perBulan.set(k.t.utj, e); }
  const kuartal = new Map<string, { n: number; ok: number }>();
  for (const [m, e] of perBulan) { const q = `${m.slice(0, 4)} K${Math.ceil(+m.slice(5) / 3)}`; const x = kuartal.get(q) ?? { n: 0, ok: 0 }; x.n += e.n; x.ok += e.ok; kuartal.set(q, x); }
  const kuartalList = [...kuartal].sort((a, b) => a[0].localeCompare(b[0])).filter(([, e]) => e.n >= 3).slice(-8);
  const ember = (xs: number[], batas: number[], nama: (i: number) => string) => { const c = Array(batas.length + 1).fill(0); for (const x of xs) { let i = batas.findIndex((b) => x <= b); if (i < 0) i = batas.length; c[i]++; } return c.map((v, i) => ({ label: nama(i), value: v })); };
  const sebaran = ember(kasus.filter((k) => k.hari !== null && k.hari >= 0 && jenis(k.status) !== 2).map((k) => k.hari as number), [14, 30, 45, 60], (i) => ["0–14 hari", "15–30 hari", "31–45 hari", "46–60 hari", "Lebih dari 60 hari"][i]);
  const umur = ember(terbuka.map((t) => ym(d.end) - ym(t.utj)), [1, 3, 6, 12], (i) => ["0–1 bulan", "2–3 bulan", "4–6 bulan", "7–12 bulan", "Lebih dari 12 bulan"][i]);
  const pegang = new Map<string, number>();
  for (const t of terbuka) { const b = (t.banks ?? []).filter((x) => x.bank).pop()?.bank ?? "Belum ke bank"; pegang.set(rapikan(b), (pegang.get(rapikan(b)) ?? 0) + 1); }
  const pegangList = [...pegang].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
  return (<><Nav active="/bank" updated={d.source === "demo" ? "Sumber: fixture" : `Data ${d.end}`} />
    <main className="wrap stack"><p>{badge(d.source)}</p>
      <div><h1>Proses Bank</h1><p className="muted" style={{ maxWidth: 680 }}>Seberapa cepat dan seberapa sering bank menyetujui berkas KPR, serta berkas yang masih menggantung (outstanding).</p></div>
      {!ada ? <p className="warn">Belum ada data proses bank (kolom Proses Bank di sheet PENJUALAN).</p> : <>
        <Temuan judul={terbaik ? `${terbaik.bank} paling sering menyetujui berkas (${terbaik.persenApprove}%)${tercepat ? `; ${tercepat.bank} paling cepat (${f1(tercepat.rataHari!)} hari)` : ""}` : "Data bank masih sedikit"}
          isi={terburuk && terburuk.bank !== terbaik?.bank ? `${terburuk.bank} paling rendah persetujuannya (${terburuk.persenApprove}% dari ${terburuk.n} berkas).` : undefined}
          aksi={terbaik ? `arahkan pembeli dengan profil kuat ke ${terbaik.bank}${terburuk && terburuk.bank !== terbaik.bank ? ` dan siapkan bank cadangan bila pengajuan ke ${terburuk.bank}` : ""}.` : undefined} />
        <div className="kpis">
          <div className="kpi-card accent"><small>Berkas outstanding</small><span className="big">{terbuka.length}</span><span className="sub">UTJ belum akad dan belum batal</span></div>
          <div className="kpi-card gold"><small>Sedang diproses bank</small><span className="big">{dalamBank.length}</span><span className="sub">status berkas Proses</span></div>
          <div className="kpi-card"><small>Pendapatan kotor potensial</small><span className="big">Rp {f1(nilai)} M</span><span className="sub">bila semua outstanding akad</span></div>
          <div className="kpi-card"><small>Total pengajuan</small><span className="big">{kasus.length}</span><span className="sub">{baris.length} bank</span></div>
        </div>
        <div className="grid">
          <div className="card"><h2>Hasil pengajuan</h2><Donat data={status} tengah={String(kasus.length)} sub="pengajuan" /></div>
          <div className="card"><h2>Persen disetujui per bank</h2><BatangH baris={layak.sort((a, b) => b.persenApprove - a.persenApprove).map((b) => ({ label: rapikan(b.bank), value: b.persenApprove, catatan: `(${b.n})` }))} satuan="%" maks={100} />
            <p className="muted" style={{ fontSize: 12 }}>Hanya bank dengan 5 pengajuan atau lebih. Angka dalam kurung = jumlah pengajuan.</p></div>
        </div>
        <div className="pair">
          <div className="card"><h2>Status berkas per bank</h2><Tumpuk baris={tumpuk} seri={["Approved", "Reject", "Withdraw", "Proses"]} /></div>
          <div className="card"><h2>Rata-rata lama proses (hari)</h2><BatangH baris={layak.filter((b) => b.rataHari !== null).sort((a, b) => a.rataHari! - b.rataHari!).map((b) => ({ label: b.bank, value: Math.round(b.rataHari! * 10) / 10 }))} satuan=" hari" />
            <p className="muted" style={{ fontSize: 12 }}>Hanya bank dengan 5 pengajuan atau lebih.</p></div>
        </div>
        <div className="pair">
          <div className="card"><h2>Pengajuan per bulan</h2><Garis labels={bulanList.map(labelBulan)} deret={[{ nama: "Pengajuan", nilai: bulanList.map((m) => perBulan.get(m)?.n ?? 0) }]} judul="Pengajuan bank per bulan UTJ" lebar={420} tinggi={190} />
            <p className="muted" style={{ fontSize: 12 }}>Dihitung menurut bulan UTJ, 18 bulan terakhir.</p></div>
          <div className="card"><h2>Persen disetujui per kuartal</h2><Garis labels={kuartalList.map(([q]) => q)} deret={[{ nama: "% disetujui", nilai: kuartalList.map(([, e]) => Math.round((e.ok / e.n) * 1000) / 10) }]} format={(v) => `${Math.round(v)}%`} judul="Persen berkas disetujui per kuartal" lebar={420} tinggi={190} />
            <p className="muted" style={{ fontSize: 12 }}>Kuartal dengan minimal 3 pengajuan. Kuartal terbaru masih banyak yang diproses, jadi angkanya bisa naik nanti.</p></div>
        </div>
        <div className="pair">
          <div className="card"><h2>Sebaran lama proses</h2><BatangH baris={sebaran} /><p className="muted" style={{ fontSize: 12 }}>Jumlah pengajuan menurut lama proses, tanpa yang withdraw.</p></div>
          <div className="card"><h2>Umur berkas outstanding</h2><BatangH baris={umur} /><p className="muted" style={{ fontSize: 12 }}>Selisih bulan UTJ sampai data terakhir. Berkas tua perlu dicek: apakah masih layak akad.</p></div>
        </div>
        <div className="grid">
          <div className="card"><h2>Rincian per bank</h2>
            <table className="compact"><thead><tr><th>Bank</th><th className="n">Berkas</th><th className="n">Approve</th><th className="n">Reject</th><th className="n">Withdraw</th><th className="n">Proses</th><th className="n">Hari</th></tr></thead>
              <tbody>{baris.map((b) => <tr key={b.bank}><td>{b.bank}</td><td className="n">{b.n}</td><td className="n">{b.approve}</td><td className="n">{b.reject}</td><td className="n">{b.withdraw}</td><td className="n">{b.proses}</td><td className="n">{b.rataHari === null ? "-" : f1(b.rataHari)}</td></tr>)}</tbody></table></div>
          <div className="card"><h2>Berkas outstanding per bank</h2><BatangH baris={pegangList} /><p className="muted" style={{ fontSize: 12 }}>Bank terakhir yang memegang berkas UTJ yang belum akad dan belum batal.</p></div>
        </div></>}
    </main></>);
}
