import { importPenjualan } from "./importExcel";
import { listDatasets, saveDataset, storeConfigured } from "./store";
import { onedriveConfigured, unduhDariOneDrive } from "./onedrive";

export interface HasilSinkron { status: "baru" | "sama" | "gagal"; pesan: string }

let berjalan: Promise<HasilSinkron> | null = null;
let terakhirCoba = 0;
const JEDA_MS = 10 * 60 * 1000;
const BASI_MS = 30 * 60 * 1000;

/** Ambil Excel dari OneDrive, simpan sebagai snapshot dataset bila isinya berubah (dikenali dari sidik file di nama dataset). Satu proses sekaligus per instance. */
export function sinkronOneDrive(paksa = false): Promise<HasilSinkron> {
  if (berjalan) return berjalan;
  berjalan = jalankan(paksa).finally(() => { berjalan = null; });
  return berjalan;
}

async function jalankan(paksa: boolean): Promise<HasilSinkron> {
  if (!onedriveConfigured()) return { status: "gagal", pesan: "ONEDRIVE_EXCEL_URL belum diset di Vercel" };
  if (!storeConfigured()) return { status: "gagal", pesan: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset" };
  terakhirCoba = Date.now();
  try {
    const f = await unduhDariOneDrive();
    const tag = `[${f.sidik}]`;
    const [terakhir] = await listDatasets(1);
    if (!paksa && terakhir?.filename.includes(tag)) return { status: "sama", pesan: "Excel belum berubah sejak sinkron terakhir" };
    const rep = await importPenjualan(f.buffer, "kalender");
    if (rep.utj === 0) return { status: "gagal", pesan: "Tidak ada baris UTJ terbaca dari Excel OneDrive; periksa sheet PENJUALAN dan kolomnya" };
    await saveDataset(`OneDrive: ${f.nama} ${tag}`, "kalender", rep);
    return { status: "baru", pesan: `Excel OneDrive dibaca: ${rep.utj} UTJ, ${rep.akad} akad, ${rep.batal} batal, ${rep.warnings.length} peringatan` };
  } catch (e) { return { status: "gagal", pesan: e instanceof Error ? e.message : "Gagal sinkron dari OneDrive" }; }
}

/** Dipanggil di latar belakang setelah halaman dikirim: sinkron bila data sudah lebih dari 30 menit dan percobaan terakhir lebih dari 10 menit lalu. */
export async function segarkanBilaPerlu(): Promise<void> {
  if (!onedriveConfigured() || !storeConfigured() || Date.now() - terakhirCoba < JEDA_MS) return;
  try {
    const [terakhir] = await listDatasets(1);
    if (terakhir && Date.now() - new Date(terakhir.uploaded_at).getTime() < BASI_MS && !terakhir.filename.startsWith("Input manual")) return;
    await sinkronOneDrive(false);
  } catch { /* gagal di latar belakang tidak boleh mengganggu halaman */ }
}
