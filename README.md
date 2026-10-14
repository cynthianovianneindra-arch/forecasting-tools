# Forecast Penjualan (Shaistanaya City)

Web app proyeksi UTJ, akad, dan penerimaan. Spesifikasi: `docs/SPEC.md`; mockup: `docs/mockup/`.

## Menjalankan
    npm install
    npm run dev        # http://localhost:3000
    npm test
    npm run typecheck

## Status terhadap fase SPEC bagian 9
- **1. Mesin forecast (TS):** ada. Rata-rata 12 bln, tren OLS pembanding, hazard pipeline, backtest rolling-origin, rentang dari kuantil galat. UTJ MAE 1-3 bln = 3,24 (26 titik asal), sesuai SPEC.
- **2. Dashboard:** grafik, rentang, toggle Bulanan/Tahunan, tabel, tanda tren menyimpang, filter (tipe, agent, marketing, periode untuk kartu) dan enam kartu data aktual. Nilai kartu cocok SPEC 6.2 (funnel 284/240/188/181, tipe, agent, persen approve bank, alasan batal). Belum: filter cluster/tahap (tidak ada di PENJUALAN), konteks makro, sumber leads dari sheet LEADS.
- **3. What-if:** 11 variabel, garis dasar abu-abu, peringatan stok. Koefisien masih ilustrasi, stok = konstanta demo. Belum: simpan skenario.
- **4. Sinkron Sheets + makro:** belum. Layar Data hanya kerangka + cek total 284/188.
- **5. Laporan + narasi:** pratinjau cetak A4 (12 dari 12 halaman; hlm 10-11 dari sheet LEADS dan EVENT MARKETING); `/api/narasi` dengan validator angka (butuh `ANTHROPIC_API_KEY`).

## Data demo
`fixtures/monthly_utj_akad.csv` hanya hitungan bulanan. Transaksi untuk pipeline direkonstruksi di
`src/lib/demo.ts` (akad dipasangkan FIFO ke UTJ tertua; sisa > 8 bulan dianggap batal). Maka MAE akad
pipeline (~5,7) belum sebanding dengan target 2,95 dan angka "pipeline berjalan" tidak nyata. Kriteria Fase 1
untuk akad baru bisa diverifikasi setelah `FORECASTING_UPDATE.xlsx` ditaruh di `data/` (di-gitignore). Jika file ada, app otomatis membaca sheet PENJUALAN (kolom J, AT, AU, AX; `src/lib/importExcel.ts`), membersihkan error Excel, dan melaporkan peringatan di menu Data & Integrasi; jika tidak ada, memakai data demo. Diuji dengan file asli: UTJ 284, akad 188, UTJ 12 bulan 85, pipeline berjalan 16, hazard sama dengan SPEC 5.4, backtest akad pipeline MAE total 3 bln = 2,95 (target SPEC tercapai) vs rata-rata 12 bln 4,24. Batal terbaca 80 (SPEC: 85): 5 baris (288-292) punya akad/batal tanpa tanggal UTJ dan dilewati; peringatan tampil di Data & Integrasi.

## Sinkron Google Drive
File sumber: `FORECASTING UPDATE.xlsx` di Drive (ID di `.env.example`).
1. Buat service account di Google Cloud, aktifkan Drive API, unduh kunci JSON.
2. Share folder/file Drive ke email service account (Viewer).
3. Set env `GOOGLE_SERVICE_ACCOUNT_JSON` (isi JSON satu baris), opsional `DRIVE_FILE_ID`, `CRON_SECRET`.
4. Menu Data & Integrasi: tombol "Sinkron semua sekarang". Vercel Cron memanggil `/api/sync` tiap hari (`vercel.json`). Cache 1 jam.
Prioritas sumber: Drive, lalu `data/FORECASTING_UPDATE.xlsx`, lalu data demo. Belum diuji dengan Drive asli (sandbox tidak bisa mengakses Drive).

## Narasi Claude dan batas pemakaian
- Isi `ANTHROPIC_API_KEY` (Vercel env). Halaman Laporan memanggil Claude sekali per set angka (cache 1 jam); angka di teks divalidasi terhadap JSON, jika gagal memakai teks templat.
- `CLAUDE_DAILY_LIMIT` (default 30 panggilan/hari, UTC) membatasi total panggilan; hitungan di memori instance, jadi pada serverless bisa ter-reset. Pasang juga batas pengeluaran bulanan di console.anthropic.com sebagai batas keras.
- `/api/narasi` butuh `NARASI_TOKEN` (header `Authorization: Bearer ...`), maksimum 20.000 karakter masukan; tanpa token endpoint nonaktif.

## Isi data lewat dashboard (unggah Excel)
Menu Data & Integrasi punya form unggah `.xlsx`. File diparse di server (sheet PENJUALAN), lalu transaksi anonim disimpan di tabel Supabase `datasets` (RLS aktif tanpa policy; hanya service role yang bisa akses). Dashboard, Simulasi, dan Laporan memakai unggahan terbaru.
Env yang dibutuhkan: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API; jangan dibagikan), `UPLOAD_TOKEN` (kata sandi unggah buatanmu). Batas file 4 MB (batas body fungsi Vercel).
Urutan sumber data: unggahan Supabase, Drive, `data/*.xlsx`, data demo.

## Marketing (halaman 10-11)
Impor membaca sheet LEADS (diagregasi per bulan/database/asal/marketing/status; kolom nama dan telepon tidak dibaca) dan EVENT MARKETING (biaya per kategori). Temuan dihitung aturan deterministik di `src/lib/marketing.ts`; Claude hanya merumuskan paragraf dari JSON. Diuji dengan file asli: biaya Rp 164,2 jt, 3.943 leads, 63 UTJ, Rp 41,6 rb/lead, Rp 2,6 jt/UTJ, korelasi biaya-leads -0,2 dan biaya-UTJ 0,33, Office 83% leads dengan 1,9% survey, status terisi per marketing sesuai SPEC.
Selisih dari SPEC: leads tanpa status terbaca 69% (SPEC 56%, 2.200); batal non-inhouse 30% (SPEC 14%, penyebut berbeda: SPEC memakai 161 UTJ non-inhouse, di sini 200). Perlu dikonfirmasi definisinya.
Tabel `datasets` punya kolom `marketing` (jsonb); unggah ulang Excel agar data marketing tersimpan.

## Stok (sheet UNIT) dan data ekonomi
- Impor membaca sheet UNIT (314 unit; status Sold/Open/Proses/Close/Margal) dan memasangkan tiap UTJ ke unitnya (284 dari 284 cocok), sehingga filter Cluster dan Tahap tersedia. Stok tersedia dijual = status **Open** (32 unit); definisi ini perlu dikonfirmasi pemilik (SPEC pertanyaan 3). Pada laju proyeksi (rata-rata 7,1 UTJ/bulan) stok Open habis di bulan ke-5; dashboard dan Simulasi menampilkan peringatan. Proyeksi dasar sengaja tidak dipotong stok (agar sama dengan backtest); peringatan menandai kebutuhan tambahan unit.
- Data ekonomi dibaca dari sheet INSTRUMEN EKONOMI (emas, IHSG, inflasi, BI Rate; data s.d. Mei 2026). Korelasi bulanan dengan UTJ lemah (|r| < 0,3), hanya konteks. Pembaruan otomatis dari BPS, bi.go.id, dan Twelve Data **belum dibuat**: butuh API key dan verifikasi endpoint (SPEC bagian 7); saat ini data ekonomi hanya ikut diperbarui ketika Excel diunggah ulang.
- Tabel `datasets` punya kolom `units` dan `macro`; unggah ulang Excel untuk mengisinya.
