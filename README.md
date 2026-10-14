# Forecast Penjualan (Shaistanaya City)

Web app proyeksi UTJ, akad, dan penerimaan. Spesifikasi: `docs/SPEC.md`; mockup: `docs/mockup/`.

## Menjalankan
    npm install
    npm run dev        # http://localhost:3000
    npm test
    npm run typecheck

## Status terhadap fase SPEC bagian 9
- **1. Mesin forecast (TS):** ada. Rata-rata 12 bln, tren OLS pembanding, hazard pipeline, backtest rolling-origin, rentang dari kuantil galat. UTJ MAE 1-3 bln = 3,24 (26 titik asal), sesuai SPEC.
- **2. Dashboard:** grafik, rentang, toggle Bulanan/Tahunan, tabel, tanda tren menyimpang. Belum: filter, enam kartu data aktual, konteks makro.
- **3. What-if:** 11 variabel, garis dasar abu-abu, peringatan stok. Koefisien masih ilustrasi, stok = konstanta demo. Belum: simpan skenario.
- **4. Sinkron Sheets + makro:** belum. Layar Data hanya kerangka + cek total 284/188.
- **5. Laporan + narasi:** pratinjau cetak A4 (2 dari 12 halaman); `/api/narasi` dengan validator angka (butuh `ANTHROPIC_API_KEY`).

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
