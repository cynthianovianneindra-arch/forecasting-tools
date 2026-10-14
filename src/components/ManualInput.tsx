import { STATUS_UNIT, INDIKATOR_MANUAL } from "@/lib/manual";
import { labelPenuh } from "@/lib/format";
import type { getData } from "@/lib/data";

type D = Awaited<ReturnType<typeof getData>>;
const inp = { minHeight: 44, borderRadius: 14, border: "1px solid #DEDDDB", background: "#F1F0EE", padding: "0 12px", fontSize: 14, minWidth: 140 } as const;

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ fontSize: 12, color: "#5B6670", display: "flex", flexDirection: "column", gap: 4 }}>{label}{children}</label>;
}
function Form({ jenis, judul, children, ket }: { jenis: string; judul: string; children: React.ReactNode; ket?: string }) {
  return (
    <details style={{ marginBottom: 8 }}><summary>{judul}</summary>
      <form action="/api/manual" method="post" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", padding: "8px 0 12px" }}>
        <input type="hidden" name="jenis" value={jenis} />
        {ket && <p className="muted" style={{ fontSize: 12, flexBasis: "100%", margin: 0 }}>{ket}</p>}
        {children}
        <F label="Token unggah"><input style={inp} type="password" name="token" required autoComplete="off" /></F>
        <button className="btn" type="submit">Simpan</button>
      </form>
    </details>
  );
}
const list = (id: string, vals: string[]) => <datalist id={id}>{vals.map((v) => <option key={v} value={v} />)}</datalist>;

/** Input data manual untuk setiap variabel: transaksi, status transaksi, biaya event, leads, unit, dan data ekonomi. */
export function ManualInput({ d }: { d: D }) {
  const units = d.units ?? [];
  const open = units.filter((u) => u.status.toUpperCase() === "OPEN").map((u) => u.unit);
  const berjalan = d.txns.filter((t) => t.unit && !t.akad && !t.batal).map((t) => t.unit!);
  const adaUnitId = d.txns.some((t) => t.unit);
  return (
    <div className="card"><h2>Input data manual</h2>
      <p className="muted">Tambah atau ubah data satu per satu tanpa Excel. Setiap input tersimpan sebagai versi data baru dan langsung dipakai Dashboard, Simulasi, dan Laporan; input manual terakhir bisa diurungkan. Bulan memakai format kalender (tutup bulan tanggal 1 sampai akhir bulan).</p>
      {list("dl-open", open)}{list("dl-berjalan", berjalan)}{list("dl-unit", units.map((u) => u.unit))}{list("dl-tipe", d.opts.tipe)}{list("dl-agent", d.opts.agent)}{list("dl-mkt", d.opts.marketing)}
      <Form jenis="transaksi_baru" judul="UTJ baru (transaksi)" ket="Memilih unit Open mengisi tipe, cluster, tahap dan mengubah status unit menjadi Proses.">
        <F label="Bulan UTJ"><input style={inp} type="month" name="bulanUtj" required /></F>
        <F label="Unit (opsional)"><input style={inp} name="unit" list="dl-open" placeholder="mis. F3-08" /></F>
        <F label="Tipe (jika tanpa unit)"><input style={inp} name="tipe" list="dl-tipe" /></F>
        <F label="Agent"><input style={inp} name="agent" list="dl-agent" /></F>
        <F label="Marketing"><input style={inp} name="marketing" list="dl-mkt" /></F>
        <F label="Database"><input style={inp} name="database" placeholder="Office / Pribadi" /></F>
        <F label="Asal leads"><input style={inp} name="leads" placeholder="Instagram" /></F>
        <F label="Harga bersih (juta Rp)"><input style={inp} type="number" step="any" name="netPriceJuta" /></F>
      </Form>
      <Form jenis="status_transaksi" judul="Ubah status transaksi (akad atau batal)" ket={adaUnitId ? "Isi salah satu: bulan akad atau bulan batal. Akad mengubah unit menjadi Sold; batal mengembalikan unit ke Open." : "ID unit belum tersimpan di data ini: unggah ulang Excel sekali agar fitur ini aktif."}>
        <F label="Unit"><input style={inp} name="unit" list="dl-berjalan" required /></F>
        <F label="Bulan akad"><input style={inp} type="month" name="bulanAkad" /></F>
        <F label="Bulan batal"><input style={inp} type="month" name="bulanBatal" /></F>
        <F label="Alasan batal"><input style={inp} name="alasan" placeholder="mis. Reject bank" /></F>
      </Form>
      <Form jenis="event" judul="Biaya event marketing">
        <F label="Bulan"><input style={inp} type="month" name="bulan" required /></F>
        <F label="Kategori"><input style={inp} name="kategori" list="dl-kat" placeholder="Iklan, Open House, ..." required /></F>
        {list("dl-kat", [...new Set(d.marketing?.events.map((e) => e.kategori) ?? [])])}
        <F label="Kegiatan"><input style={inp} name="kegiatan" required /></F>
        <F label="Biaya (Rp)"><input style={inp} type="number" name="biayaRp" min="1" step="any" required /></F>
      </Form>
      <Form jenis="leads" judul="Leads (jumlah per kelompok)" ket="Leads dicatat agregat (jumlah), tanpa nama dan nomor telepon.">
        <F label="Bulan"><input style={inp} type="month" name="bulan" required /></F>
        <F label="Database"><input style={inp} name="database" placeholder="Office / Pribadi" required /></F>
        <F label="Asal leads"><input style={inp} name="asal" placeholder="Instagram" required /></F>
        <F label="Marketing"><input style={inp} name="marketing" list="dl-mkt" required /></F>
        <F label="Status"><input style={inp} name="status" placeholder="Prospect, Survey, Lost, ..." /></F>
        <F label="Jumlah leads"><input style={inp} type="number" name="n" min="1" required /></F>
        <F label="Di antaranya survey"><input style={inp} type="number" name="survey" min="0" defaultValue={0} /></F>
      </Form>
      <Form jenis="unit" judul="Unit (status, tipe, tahap, cluster)" ket="Open = tersedia dijual; Close = belum dibangun; Proses = sudah dipesan; Sold dan Margal = terjual. Unit baru wajib mengisi tipe.">
        <F label="ID unit"><input style={inp} name="unit" list="dl-unit" required /></F>
        <F label="Status"><select style={inp} name="status" defaultValue="OPEN">{STATUS_UNIT.map((x) => <option key={x}>{x}</option>)}</select></F>
        <F label="Tipe"><input style={inp} name="tipe" list="dl-tipe" /></F>
        <F label="Tahap"><input style={inp} name="tahap" placeholder="Tahap 1" /></F>
        <F label="Cluster"><input style={inp} name="cluster" placeholder="Sierra" /></F>
      </Form>
      <Form jenis="makro" judul="Data ekonomi (IHSG, emas, inflasi, BI Rate, IHPR)" ket="Input manual mengalahkan data otomatis dan Excel untuk bulan yang sama. Inflasi dan BI Rate dalam persen.">
        <F label="Bulan"><input style={inp} type="month" name="bulan" required /></F>
        <F label="Indikator"><select style={inp} name="indikator">{Object.entries(INDIKATOR_MANUAL).map(([k, v]) => <option key={k} value={k}>{v.nama}</option>)}</select></F>
        <F label="Nilai"><input style={inp} type="number" step="any" name="nilai" required /></F>
      </Form>
      {d.manualMacro.length > 0 && <p className="muted" style={{ fontSize: 12 }}>Data ekonomi manual terakhir: {d.manualMacro.map((m) => `${m.indikator} ${labelPenuh(m.bulan)} = ${m.nilai}`).join("; ")}</p>}
      <form action="/api/manual" method="post" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <input type="hidden" name="jenis" value="urungkan" />
        <F label="Token unggah"><input style={inp} type="password" name="token" required autoComplete="off" /></F>
        <button className="btn alt" type="submit">Urungkan input manual terakhir</button>
      </form>
    </div>
  );
}
