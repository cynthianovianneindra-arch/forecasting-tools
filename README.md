# Forecast Penjualan (Shaistanaya City)

Web app proyeksi UTJ, akad, dan penerimaan. Spesifikasi: `docs/SPEC.md`; mockup: `docs/mockup/`.

## Menjalankan
    npm install
    npm run dev        # http://localhost:3000
    npm test
    npm run typecheck

## Status terhadap fase SPEC bagian 9
- **1. Mesin forecast (TS):** ada. Rata-rata 12 bln, tren OLS pembanding, hazard pipeline, backtest rolling-origin, rentang dari kuantil galat. UTJ MAE 1-3 bln = 3,16 dengan exponential smoothing (rata-rata 12 bln: 3,24; SPEC: 3,18).
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
- `CLAUDE_DAILY_LIMIT` (default 5 panggilan/hari, UTC) membatasi panggilan narasi laporan, dan `CLAUDE_SYNC_DAILY_LIMIT` (default 4) membatasi pembacaan halaman BI/BPS; hitungan di memori instance, jadi pada serverless bisa ter-reset. Pasang juga batas pengeluaran bulanan di console.anthropic.com sebagai batas keras.
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
- Data ekonomi dibaca dari sheet INSTRUMEN EKONOMI (emas, IHSG, inflasi, BI Rate; data s.d. Mei 2026). Korelasi bulanan dengan UTJ lemah (|r| < 0,3), hanya konteks. Pembaruan otomatis (lihat bagian berikutnya) belum teruji terhadap situs asli.
- Tabel `datasets` punya kolom `units` dan `macro`; unggah ulang Excel untuk mengisinya.

## Pembaruan otomatis data ekonomi (tanpa API key berbayar)
- **IHSG (^JKSE) dan emas (GC=F, USD/oz):** Yahoo Finance endpoint chart (tidak resmi, tanpa key). Parser diuji dengan contoh respons.
- **Inflasi tahunan:** halaman bps.go.id (`BPS_INFLASI_URL`, default beranda). **BI Rate:** halaman bi.go.id (`BI_RATE_URL`). Teks halaman diekstrak Claude; hasil hanya diterima jika bulan valid, nilai wajar (0-20%), dan angkanya benar-benar muncul di teks halaman. Memakai kuota terpisah `CLAUDE_SYNC_DAILY_LIMIT` (default 4/hari), tidak mengurangi jatah laporan.
- Hasil disimpan di tabel Supabase `macro_live` dan menimpa bulan yang sama dari Excel. Sumber yang gagal tidak menimpa data terakhir; alasan gagal tampil di layar Data.
- Pemicu: tombol "Sinkron data ekonomi sekarang" (butuh `UPLOAD_TOKEN`) dan Vercel Cron harian `/api/macro-sync` (butuh `CRON_SECRET`).
- **Hasil uji pertama di produksi:** Yahoo (IHSG, emas) berhasil; bps.go.id menjawab HTTP 403 (memblokir akses otomatis), sehingga inflasi kini memakai cadangan halaman Data Inflasi bi.go.id (`BI_INFLASI_URL`); BI Rate gagal karena ANTHROPIC_API_KEY ditolak (401). Isi ulang key yang valid.
- **Belum diuji dengan situs asli**: sandbox pengembangan tidak bisa menjangkau Yahoo, BPS, atau BI. URL BPS default (beranda) mungkin tidak memuat angka inflasi; isi `BPS_INFLASI_URL` dengan halaman yang memuatnya. Kegagalan akan tampil jelas di layar Data.

## Arti status unit dan peringatan stok (dikonfirmasi pemilik)
Open = tersedia dijual (stok); Close = belum dibangun (potensi order bangun); Margal dan Sold = sudah terjual; Proses = sudah dipesan.
Peringatan stok memakai pemakaian bersih = UTJ dikurangi batal (UTJ batal mengembalikan unit ke stok), dari model pipeline: pada proyeksi dasar sekitar 5,1 unit/bulan, stok Open (32) habis di bulan ke-7 dan kurang sekitar 29 unit dalam 12 bulan; 78 unit Close menjadi batas atas order bangun di Simulasi.

## Revisi dashboard dan Data & Integrasi (keputusan pemilik)
- **Metode UTJ: exponential smoothing** (level, alpha dicari di 0,05-0,30 dari galat satu langkah). Uji mundur 26 titik: galat UTJ 1-3 bulan **3,16** (rata-rata 12 bulan 3,24). Akibatnya level UTJ turun (6,3/bulan dari 7,1) dan galat total akad 3 bulan dari pipeline menjadi **3,15** (sebelumnya 2,95 dengan masukan rata-rata 12 bulan; pembanding rata-rata 6 bulan 4,13).
- **Akad dibulatkan ke bawah** per bulan di dashboard, laporan, dan Simulasi; total dan penerimaan memakai angka yang sudah dibulatkan (jumlah 12 bulan bisa lebih kecil dari jumlah angka mentah).
- Dashboard: filter Periode per tahun dan per bulan; grafik bisa disentuh/diarahkan untuk melihat bulan dan nilainya; label sumbu tiap 3 bulan; kartu Skenario dan Pipeline berjalan dihapus; analisa hasil integrasi (stok per tipe, konteks ekonomi, efektivitas marketing, sumber leads, struktur biaya, temuan dan tindakan) tampil langsung di dashboard dan ikut filter periode.
- **Input data manual** (menu Data & Integrasi, butuh `UPLOAD_TOKEN`): UTJ baru, status transaksi (akad/batal), biaya event, leads (agregat), unit (status/tipe/tahap/cluster), dan data ekonomi (IHSG, emas, inflasi, BI Rate, IHPR). Setiap input menjadi snapshot dataset baru di Supabase (bisa diurungkan satu per satu); data ekonomi manual disimpan di tabel `macro_manual` dan mengalahkan data otomatis dan Excel untuk bulan yang sama. ID unit kini ikut tersimpan: **unggah ulang Excel sekali** agar fitur ubah status transaksi aktif.
- Diuji end-to-end dengan server PostgREST tiruan lokal (unggah, semua jenis input, penolakan input salah, urungkan, filter bulan, tooltip).

## Filter periode berupa rentang bulan
Filter "Periode" memakai **Dari bulan** dan **Sampai bulan** (bebas pilih; jika terbalik otomatis ditukar; salah satu boleh kosong = awal/akhir data). "Periode: tahun" tetap ada sebagai pintasan dan diabaikan bila rentang diisi; tautan lama `?bulan=YYYY-MM` tetap berlaku. Rentang berlaku untuk kartu data aktual, analisa marketing, **dan proyeksi/grafik** (lihat bawah). Bila periode tidak punya data marketing (sebelum Okt 2025), muncul catatan, bukan tabel kosong.

### Proyeksi mengikuti periode
Saat Dari/Sampai bulan dipilih, deret UTJ untuk exponential smoothing dibatasi ke rentang itu dan proyeksi 12 bulan dihitung **setelah bulan akhir rentang** (pipeline akad memakai keadaan UTJ pada bulan akhir itu, jadi hasilnya setara "proyeksi seandainya dibuat pada bulan tersebut"). Grafik menampilkan 12 bulan aktual terakhir di dalam rentang. Konsekuensi: periode pendek membuat proyeksi kurang andal; bila riwayat terlalu pendek untuk uji mundur (kurang dari 5 galat per horizon) rentang UTJ memakai rumus cadangan (data cacah, faktor sebaran 1,5, melebar dengan horizon) dan banner memberi peringatan. Kartu stok disembunyikan bila rentang berakhir sebelum bulan data terakhir (stok adalah kondisi terkini).

## Simulasi dan laporan (revisi)
- **Simulasi: semua variabel diisi manual** (tanpa slider; kolom kosong = tidak diubah). (1) Order bangun per tipe, hanya dari unit berstatus Close, dengan bulan mulai bangun; (2) Harga & promo: harga jual rata-rata dan nilai promo dalam Rp juta (acuan: harga bersih rata-rata dari data); (3) Marketing & event: leads per bulan (acuan: rata-rata 6 bulan data terakhir) dan jumlah event per bulan per kategori Open House, Open Table, Open Booth, Pameran, Company Visit; (4) Kondisi ekonomi: BI Rate, IHSG, emas, inflasi diisi manual (acuan: nilai terakhir). Kelompok Pipeline & Bank dihapus. Koefisien tetap ilustrasi; semua kategori event berbobot sama karena data event baru sejak 2025.
- **Analisis skenario** di bawah hasil (dan di laporan): perubahan total UTJ/akad/penerimaan, pengaruh tiap kelompok variabel (dari angka mentah supaya efek kecil tidak hilang oleh pembulatan), kecukupan stok, perbandingan dengan ketidakpastian proyeksi dasar, dan catatan keterbatasan. Seluruhnya dihitung kode (`src/lib/analisis.ts`).
- **UTJ bulat di seluruh alat:** UTJ (proyeksi, kisaran, skenario, laporan) dan akad dibulatkan ke bawah per bulan; total 12 bulan = jumlah angka bulanan yang sudah dibulatkan, jadi bisa lebih kecil daripada jumlah angka mentah (efek ke bawah sekitar 0,3 unit per bulan).
- **Laporan 16 halaman:** sampul, daftar isi bernomor halaman (dibuat otomatis dari urutan halaman), ringkasan manajemen detail (2 halaman: hasil utama, kinerja, stok, marketing, ekonomi, risiko, rekomendasi prioritas berbasis aturan), lalu halaman rinci per topik termasuk halaman baru Stok dan kapasitas penjualan. Narasi Claude (ringkasan, proyeksi, funnel, bank, marketing, stok, risiko, rekomendasi) tetap divalidasi angkanya; teks dari mesin selalu tampil.
