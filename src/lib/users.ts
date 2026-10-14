import type { Peran } from "./session";

// Tabel app_users di Supabase (PostgREST, service role). Kata sandi hanya disimpan sebagai hash scrypt.
const url = () => process.env.SUPABASE_URL;
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const usersConfigured = () => !!(url() && key());
const headers = () => ({ apikey: key()!, authorization: `Bearer ${key()}`, "content-type": "application/json" });

export interface Pengguna { id: number; email: string; nama: string; peran: Peran; aktif: boolean; password_hash: string; dibuat: string; login_terakhir: string | null }

export const SQL_TABEL_PENGGUNA = `create table if not exists app_users (
  id bigserial primary key,
  email text not null unique,
  nama text not null default '',
  peran text not null default 'viewer' check (peran in ('admin','viewer')),
  password_hash text not null,
  aktif boolean not null default true,
  dibuat timestamptz not null default now(),
  login_terakhir timestamptz
);
alter table app_users enable row level security;`;

async function req(path: string, init?: RequestInit) {
  const r = await fetch(`${url()}/rest/v1/app_users${path}`, { ...init, headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) }, cache: "no-store" });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    if (r.status === 404 || /PGRST205|app_users/.test(t)) throw new Error("Tabel app_users belum dibuat di Supabase");
    if (r.status === 409 || /duplicate key|23505/.test(t)) throw new Error("Email sudah terdaftar");
    throw new Error(`Supabase ${r.status}`);
  }
  return r;
}

export async function cariPenggunaEmail(email: string): Promise<Pengguna | null> {
  const r = await req(`?email=eq.${encodeURIComponent(email)}&select=*&limit=1`);
  return ((await r.json()) as Pengguna[])[0] ?? null;
}
export async function cariPenggunaId(id: number): Promise<Pengguna | null> {
  const r = await req(`?id=eq.${id}&select=*&limit=1`);
  return ((await r.json()) as Pengguna[])[0] ?? null;
}
export async function daftarPengguna(): Promise<Pengguna[]> {
  const r = await req(`?select=*&order=dibuat.asc&limit=500`);
  return (await r.json()) as Pengguna[];
}
export async function buatPengguna(p: { email: string; nama: string; peran: Peran; password_hash: string }): Promise<void> {
  await req("", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(p) });
}
export async function ubahPengguna(id: number, patch: Partial<Pick<Pengguna, "nama" | "peran" | "aktif" | "password_hash" | "login_terakhir">>): Promise<void> {
  await req(`?id=eq.${id}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(patch) });
}
