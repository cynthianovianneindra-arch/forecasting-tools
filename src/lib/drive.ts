import { GoogleAuth } from "google-auth-library";

// File sumber di Google Drive (FORECASTING UPDATE.xlsx). Bisa diganti lewat env DRIVE_FILE_ID.
export const DEFAULT_FILE_ID = "1mUk5SAEi_xhJ3n8i7HjZ5TBQbxyYah7h";

export const driveConfigured = () => !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

export interface DriveFile { buffer: ArrayBuffer; modifiedTime: string; name: string; fetchedAt: string }
let cache: { at: number; file: DriveFile } | null = null;
const TTL_MS = 60 * 60 * 1000;

/** Unduh xlsx dari Drive dengan service account (folder/file harus di-share ke emailnya, akses Viewer). */
export async function fetchFromDrive(force = false): Promise<DriveFile> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.file;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON belum diset");
  const auth = new GoogleAuth({ credentials: JSON.parse(raw), scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
  const client = await auth.getClient();
  const id = process.env.DRIVE_FILE_ID ?? DEFAULT_FILE_ID;
  const meta = await client.request<{ name: string; modifiedTime: string }>({ url: `https://www.googleapis.com/drive/v3/files/${id}?fields=name,modifiedTime&supportsAllDrives=true` });
  const res = await client.request<ArrayBuffer>({ url: `https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, responseType: "arraybuffer" });
  const file = { buffer: res.data, modifiedTime: meta.data.modifiedTime, name: meta.data.name, fetchedAt: new Date().toISOString() };
  cache = { at: Date.now(), file };
  return file;
}
