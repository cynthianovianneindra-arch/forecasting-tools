// Grafik SVG ringan (tanpa library, tanpa JavaScript klien). Warna mengikuti palet Obsidian Chrome.
export const WARNA = ["#0A0A0A", "#536878", "#8FA1AE", "#C3D1DC", "#2B3640", "#A9B4BC"];

export interface Irisan { label: string; value: number }

/** Donat dengan angka di tengah dan legenda. */
export function Donat({ data, tengah, sub, satuan = "", persen = true }: { data: Irisan[]; tengah?: string; sub?: string; satuan?: string; persen?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 52, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="gr-donat">
      <svg viewBox="0 0 140 140" role="img" aria-label={"Grafik donat: " + data.map((d) => `${d.label} ${d.value}`).join(", ")}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="#E5E4E2" strokeWidth="18" />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * C, off = -acc; acc += len;
          return <circle key={d.label} cx="70" cy="70" r={R} fill="none" stroke={WARNA[i % WARNA.length]} strokeWidth="18" strokeDasharray={`${Math.max(0, len - 1.5)} ${C - len + 1.5}`} strokeDashoffset={off} transform="rotate(-90 70 70)" />;
        })}
        <text x="70" y={sub ? 68 : 75} textAnchor="middle" className="gr-big">{tengah ?? total}</text>
        {sub && <text x="70" y="86" textAnchor="middle" className="gr-sub">{sub}</text>}
      </svg>
      <ul className="gr-legenda">{data.map((d, i) => <li key={d.label}><i style={{ background: WARNA[i % WARNA.length] }} />{d.label}<b>{d.value}{satuan}{persen && total > 0 ? ` (${Math.round((d.value / total) * 100)}%)` : ""}</b></li>)}</ul>
    </div>
  );
}

/** Batang mendatar berperingkat dengan angka di ujung. */
export function BatangH({ baris, satuan = "", maks }: { baris: { label: string; value: number; catatan?: string }[]; satuan?: string; maks?: number }) {
  const m = maks ?? Math.max(1, ...baris.map((b) => b.value));
  return (
    <div className="gr-bh" role="list">
      {baris.map((b, i) => (
        <div key={b.label} className="gr-bh-row" role="listitem">
          <span className="gr-bh-l" title={b.label}>{b.label}</span>
          <span className="gr-bh-t"><i style={{ width: `${Math.max(2, (b.value / m) * 100)}%`, background: i === 0 ? WARNA[0] : WARNA[1] }} /></span>
          <span className="gr-bh-v">{b.value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}{satuan}{b.catatan ? <small> {b.catatan}</small> : null}</span>
        </div>))}
    </div>
  );
}

/** Garis atau area, satu atau beberapa deret pada sumbu bulan yang sama. nilai null = putus. */
export function Garis({ labels, deret, tinggi = 170, lebar = 400, area = true, format = (v: number) => String(Math.round(v * 10) / 10), judul }: { labels: string[]; deret: { nama: string; nilai: (number | null)[]; putus?: boolean }[]; tinggi?: number; lebar?: number; area?: boolean; format?: (v: number) => string; judul: string }) {
  const W = lebar, H = tinggi, pl = 40, pr = 10, pt = 10, pb = 24;
  const semua = deret.flatMap((d) => d.nilai.filter((v): v is number => v !== null));
  if (!semua.length || labels.length < 2) return <p className="muted">Belum ada data.</p>;
  const lo = Math.min(...semua), hi = Math.max(...semua), pad = (hi - lo || Math.abs(hi) || 1) * 0.1;
  const y0 = lo - pad, y1 = hi + pad;
  const X = (i: number) => pl + (i * (W - pl - pr)) / (labels.length - 1), Y = (v: number) => pt + ((y1 - v) * (H - pt - pb)) / (y1 - y0);
  const tick = [0, 1, 2, 3].map((k) => y0 + ((y1 - y0) * k) / 3);
  const langkah = Math.max(1, Math.ceil(labels.length / (W > 450 ? 8 : 5)));
  const jalur = (d: { nilai: (number | null)[] }) => { let p = "", buka = false; d.nilai.forEach((v, i) => { if (v === null) { buka = false; return; } p += `${buka ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)} `; buka = true; }); return p.trim(); };
  return (
    <figure className="gr-garis">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={judul}>
        {tick.map((t) => <g key={t}><line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke="#DEDDDB" /><text x={pl - 6} y={Y(t) + 4} textAnchor="end" className="gr-ax">{format(t)}</text></g>)}
        {labels.map((l, i) => (i % langkah === 0 ? <text key={l + i} x={X(i)} y={H - 6} textAnchor="middle" className="gr-ax">{l}</text> : null))}
        {deret.map((d, k) => {
          const warna = WARNA[k % WARNA.length], p = jalur(d);
          const pertama = d.nilai.findIndex((v) => v !== null), terakhir = d.nilai.length - 1 - [...d.nilai].reverse().findIndex((v) => v !== null);
          return <g key={d.nama}>
            {area && k === 0 && pertama >= 0 && !d.nilai.some((v) => v === null) && <path d={`${p} L${X(terakhir).toFixed(1)} ${H - pb} L${X(pertama).toFixed(1)} ${H - pb} Z`} fill={warna} opacity=".10" />}
            <path d={p} fill="none" stroke={warna} strokeWidth="2.2" strokeLinejoin="round" strokeDasharray={d.putus ? "5 4" : undefined} />
          </g>;
        })}
      </svg>
      {deret.length > 1 && <figcaption className="gr-legenda-h">{deret.map((d, k) => <span key={d.nama}><i style={{ background: WARNA[k % WARNA.length] }} />{d.nama}</span>)}</figcaption>}
    </figure>
  );
}

/** Corong penjualan: tiap tahap sebagai batang yang menyempit, dengan persen dari tahap pertama. */
export function Corong({ tahap }: { tahap: { label: string; value: number }[] }) {
  const m = Math.max(1, tahap[0]?.value ?? 1);
  return (
    <div className="gr-corong">
      {tahap.map((t, i) => (
        <div key={t.label} className="gr-corong-row"><span className="gr-bh-l">{t.label}</span>
          <span className="gr-corong-b"><i style={{ width: `${Math.max(3, (t.value / m) * 100)}%`, background: WARNA[Math.min(i, WARNA.length - 1)] }} /></span>
          <span className="gr-bh-v">{t.value}<small> {Math.round((t.value / m) * 100)}%</small></span></div>))}
    </div>
  );
}

/** Garis mini untuk tabel atau kartu. */
export function Mini({ nilai, lebar = 90, tinggi = 26 }: { nilai: number[]; lebar?: number; tinggi?: number }) {
  if (nilai.length < 2) return null;
  const lo = Math.min(...nilai), hi = Math.max(...nilai), r = hi - lo || 1;
  const p = nilai.map((v, i) => `${i ? "L" : "M"}${((i * (lebar - 2)) / (nilai.length - 1) + 1).toFixed(1)} ${(tinggi - 2 - ((v - lo) / r) * (tinggi - 4) + 1).toFixed(1)}`).join(" ");
  return <svg width={lebar} height={tinggi} viewBox={`0 0 ${lebar} ${tinggi}`} aria-hidden="true"><path d={p} fill="none" stroke="#536878" strokeWidth="1.8" strokeLinejoin="round" /></svg>;
}

/** Kutipan temuan utama (callout) di atas grafik: judul grafik yang menyebut temuan. */
export function Temuan({ judul, isi, aksi }: { judul: string; isi?: string; aksi?: string }) {
  return (
    <div className="gr-temuan"><b>{judul}</b>{isi && <p>{isi}</p>}{aksi && <p className="gr-aksi">Langkah: {aksi}</p>}</div>
  );
}
