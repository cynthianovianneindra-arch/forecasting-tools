import { timingSafeEqual } from "node:crypto";
import { importPenjualan } from "./importExcel";
import { listDatasets, saveDataset, storeConfigured } from "./store";
import { onedriveConfigured, unduhDariOneDrive, sidikBerkas } from "./onedrive";
import { driveConfigured, fetchFromDrive } from "./drive";

/** Bandingkan kunci dengan waktu tetap; kunci benar minimal 24 karakter. */
export function kunciCocok(diberi: string | null, benar: string | undefined): boolean {
  if (!diberi || !benar || benar.length < 24) return false;
  const a = Buffer.from(diberi), b = Buffer.from(benar);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface HasilSinkron { status: "baru" | "sama" | "gagal"; pesan: string }

/** Sumber Excel yang terhubung: OneDrive, Google Drive (service account, ditarik), atau Google Sheets lewat Apps Script (dikirim ke /api/excel-masuk, butuh EXCEL_PUSH_SECRET). */
export const dorongConfigured = () => (process.env.EXCEL_PUSH_SECRET ?? "").length >= 24;
export type SumberExcel = "OneDrive" | "Google Drive" | "Apps Script";
export const sumberExcel = (): SumberExcel | null => (onedriveConfigured() ? "OneDrive" : driveConfigured() ? "Google Drive" : dorongConfigured() ? "Apps Script" : null);

async function ambilBerkas(): Promise<{ buffer: ArrayBuffer; nama: string; sidik: string; sumber: string }> {
  if (sumberExcel() === "Apps Script") throw new Error("Data dikirim oleh Apps Script dari Google Sheets: jalankan fungsi kirimKeAplikasi di Apps Script (atau tunggu pemicu waktunya)");
  if (onedriveConfigured()) return { ...(await unduhDariOneDrive()), sumber: "OneDrive" };
  const f = await fetchFromDrive(true);
  return { buffer: f.buffer, nama: f.name, sidik: sidikBerkas(f.buffer), sumber: "Google Drive" };
}

let berjalan: Promise<HasilSinkron> | null = null;
let terakhirCoba = 0;
const JEDA_MS = 10 * 60 * 1000;
const BASI_MS = 30 * 60 * 1000;

/** Ambil Excel dari OneDrive, simpan sebagai snapshot dataset bila isinya berubah (dikenali dari sidik file di nama dataset). Satu proses sekaligus per instance. */
export function sinkronExcel(paksa = false): Promise<HasilSinkron> {
  if (berjalan) return berjalan;
  berjalan = jalankan(paksa).finally(() => { berjalan = null; });
  return berjalan;
}

async function jalankan(paksa: boolean): Promise<HasilSinkron> {
  if (!sumberExcel()) return { status: "gagal", pesan: "Sumber Excel belum diset di Vercel (ONEDRIVE_EXCEL_URL, GOOGLE_SERVICE_ACCOUNT_JSON, atau EXCEL_PUSH_SECRET)" };
  if (!storeConfigured()) return { status: "gagal", pesan: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diset" };
  terakhirCoba = Date.now();
  try { return await simpanBerkas(await ambilBerkas(), paksa); }
  catch (e) { return { status: "gagal", pesan: e instanceof Error ? e.message : "Gagal sinkron Excel" }; }
}

/** Baca berkas xlsx dan simpan sebagai dataset baru bila isinya berubah (dikenali dari sidik berkas di nama dataset). Dipakai sinkron tarik dan unggahan Apps Script. */
export async function simpanBerkas(f: { buffer: ArrayBuffer; nama: string; sidik: string; sumber: string }, paksa = false): Promise<HasilSinkron> {
  const tag = `[${f.sidik}]`;
  const [terakhir] = await listDatasets(1);
  if (!paksa && terakhir?.filename.includes(tag)) return { status: "sama", pesan: "Excel belum berubah sejak sinkron terakhir" };
  const rep = await importPenjualan(f.buffer, "kalender");
  if (rep.utj === 0) return { status: "gagal", pesan: `Tidak ada baris UTJ terbaca dari ${f.sumber}; periksa sheet PENJUALAN dan kolomnya` };
  await saveDataset(`${f.sumber}: ${f.nama} ${tag}`, "kalender", rep);
  return { status: "baru", pesan: `${f.sumber} dibaca: ${rep.utj} UTJ, ${rep.akad} akad, ${rep.batal} batal, ${rep.warnings.length} peringatan` };
}

/** Dipanggil di latar belakang setelah halaman dikirim: sinkron bila data sudah lebih dari 30 menit dan percobaan terakhir lebih dari 10 menit lalu. */
export async function segarkanBilaPerlu(): Promise<void> {
  if (!sumberExcel() || sumberExcel() === "Apps Script" || !storeConfigured() || Date.now() - terakhirCoba < JEDA_MS) return;
  try {
    const [terakhir] = await listDatasets(1);
    if (terakhir && Date.now() - new Date(terakhir.uploaded_at).getTime() < BASI_MS && !terakhir.filename.startsWith("Input manual")) return;
    await sinkronExcel(false);
  } catch { /* gagal di latar belakang tidak boleh mengganggu halaman */ }
}

/** Nama lama, dipertahankan untuk kompatibilitas. */
export const sinkronOneDrive = sinkronExcel;
