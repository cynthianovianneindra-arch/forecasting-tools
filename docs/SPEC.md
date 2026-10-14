# Tools Forecasting Penjualan: Spesifikasi untuk Claude Code

Pemilik: Arifah Dona (Head of Digital Marketing, Shaistanaya City / PT Neo Pudji Jaya).
Tujuan: mengganti forecasting Excel manual dengan web app yang meramal penjualan properti, menampilkan dashboard proyeksi, dan menghasilkan laporan analisis PDF.

Bahasa antarmuka dan laporan: Indonesia. Gunakan "tidak" (bukan "ga") untuk nada formal.

Isi paket ini:
- `SPEC.md`: dokumen ini.
- `mockup/`: sumber mockup UI (format `.dc.html`, referensi visual dan teks; tidak bisa dibuka mandiri tanpa runtime-nya).
- `prototypes/`: skrip Python yang menghasilkan temuan backtest di bagian 5 (referensi logika).
- `fixtures/monthly_utj_akad.csv`: deret bulanan UTJ dan akad (Apr 2022 – Jul 2026) untuk uji.
- File Excel sumber (`FORECASTING_UPDATE.xlsx`) tidak disertakan karena berisi nama pembeli. Letakkan sendiri di `data/` saat mengembangkan. Jangan di-commit.

---

## 1. Ringkasan produk

Pengguna adalah manajemen dan tim marketing. Mereka membuka dashboard, melihat proyeksi UTJ, akad, dan penerimaan untuk 12 bulan ke depan (bulanan dan tahunan), memfilter, mengubah variabel what-if, lalu mengunduh laporan PDF lengkap dengan pembahasan bahasa awam.

Prinsip desain yang tidak boleh dilanggar:
1. **Angka dihitung oleh kode, narasi ditulis Claude.** Claude API hanya menerima angka hasil mesin hitung dan menulis pembahasan. Claude tidak boleh menghasilkan atau mengubah angka.
2. **Selalu tampilkan rentang ketidakpastian**, tidak hanya satu angka. Penjualan sangat berfluktuasi (rata-rata UTJ 5,5 unit/bulan, galat tipikal ±3 unit).
3. **Metode sederhana yang menang di backtest dipakai sebagai model utama** (bagian 5). Jangan menambah kompleksitas tanpa bukti di backtest.
4. **Variabel ekonomi makro bukan penggerak model utama.** Dipakai sebagai konteks narasi dan skenario what-if.

## 2. Keputusan yang sudah dikunci

| Topik | Keputusan |
|---|---|
| Yang diramal | Jumlah UTJ, jumlah akad, dan penerimaan (rupiah) |
| Horizon | 12 bulan ke depan, ringkasan tahunan sampai 2028 |
| Cakupan | Satu proyek (Shaistanaya City), semua cluster; filter cluster, tipe, tahap, marketing/agent, periode |
| Laporan | Bulanan dan tahunan, PDF, bahasa mudah dipahami, pembaca: manajemen/owner |
| Dashboard | Grafik sederhana plus tabel, toggle Bulanan/Tahunan |
| Sumber data internal | Google Sheets (sinkron otomatis harian). Tahap awal boleh upload Excel |
| What-if | **Menu sendiri "Simulasi"** di sebelah Dashboard (bukan panel di dashboard) dengan banyak variabel (bagian 4.1). Order bangun = unit spec/stok milik developer: input jumlah unit, tipe, bulan mulai bangun |
| Menu "Order Bangun" terpisah | **Dihapus** dari desain. Order bangun hanya sebagai salah satu variabel what-if |
| Kartu KPI di atas dashboard | **Dihapus** dari desain |
| Lencana kekuatan data di panel what-if | **Dihapus** dari desain |

## 3. Layar (lihat `mockup/`)

Navigasi atas: Dashboard · Simulasi · Laporan PDF · Data & Integrasi. (Simulasi dipisah dari Dashboard; Dashboard utama adalah proyeksi dasar yang tetap.)

### 3.1 Dashboard (`Main.dc.html`)
- Judul "Proyeksi Penjualan" dan toggle **Bulanan / Tahunan**.
- Baris filter: Periode, Cluster, Tipe rumah, Tahap, Marketing/agent, tombol Reset filter.
- Kolom kiri:
  - Grafik batang UTJ dan akad. Bulanan: 12 bulan aktual terakhir plus 12 bulan proyeksi (garis putus-putus menandai awal proyeksi, batang proyeksi berpola terang, latar abu-abu = rentang UTJ yang makin lebar). Tahunan: 2022–2028.
  - Tabel rincian proyeksi (6 bulan pertama atau per tahun): periode, UTJ (rentang), akad, penerimaan, catatan.
  - Enam kartu data aktual: funnel penjualan, penjualan per tipe rumah, performa agent, sumber leads, proses bank, alasan batal.
- Kolom kanan:
  - Kartu ajakan "Mau coba skenario?" yang menautkan ke menu Simulasi. Dashboard tidak punya kontrol what-if; angkanya selalu proyeksi dasar.
  - Kartu unduh laporan: "PDF Bulanan" dan "PDF Tahunan" (mengikuti filter aktif; skenario dari menu Simulasi bisa ikut dicetak sebagai opsi).
  - Kartu Pipeline berjalan dan kartu Konteks makro.

### 3.1b Simulasi Skenario (`Simulasi.dc.html`)
- Layar sendiri, tanpa baris filter. Tata letak dua kolom: **kiri = kontrol**, **kanan = hasil**.
- Kiri: kotak "Hasil skenario · 12 bulan" (UTJ, akad, penerimaan, jumlah variabel diubah, selisih terhadap dasar), lalu lima kelompok variabel sebagai dropdown (`<details>`): Suplai · order bangun (terbuka, input jumlah unit, tipe, bulan mulai), Harga & promo, Marketing, Pipeline & bank, Kondisi ekonomi; tombol Reset skenario.
- Kanan: grafik hasil skenario (toggle Bulanan/Tahunan) dengan **garis abu-abu = proyeksi dasar** dari dashboard sebagai pembanding, dan tabel rincian.
- Proyeksi dasar di Dashboard tidak pernah berubah oleh simulasi. Koefisien what-if di mockup hanya ilustrasi (bagian 4.1).

### 3.2 Laporan PDF (`Laporan.dc.html` + `Laporan02` … `Laporan12.dc.html`)
Laporan lengkap **12 halaman A4** (794×1123 px). Satu file mockup per halaman:
1. Sampul: judul, 3 angka utama, daftar isi, tabel info laporan
2. Ringkasan manajemen
3. Kinerja 12 bulan terakhir (grafik + tabel)
4. Proyeksi UTJ (grafik dengan rentang, tabel per bulan, ringkasan per kuartal)
5. Akad dan penerimaan (tabel bulanan, tabel peluang jadi per bulan sejak UTJ)
6. Funnel penjualan dan pembatalan (alasan batal baru terisi untuk 32 dari 85 kasus)
7. Tipe rumah dan harga (harga bersih rata-rata nyata per tipe, porsi nilai)
8. Agent dan sumber leads (sampel konversi per agent kecil; data leads baru sejak Okt 2025)
9. Proses bank dan kondisi ekonomi (makro hanya konteks, korelasi bulanan lemah ±0,2)
10. Efektivitas marketing: biaya, leads, UTJ per bulan; struktur biaya; porsi leads vs porsi UTJ per sumber
11. Temuan dan tindakan marketing (5 kartu: temuan, tindakan, ukuran berhasil, prioritas)
12. Skenario what-if, cara angka dibuat, keterbatasan, rekomendasi tindakan, langkah berikutnya

Aturan isi: semua angka datang dari mesin hitung, narasi ditulis Claude hanya dari JSON angka (bagian 9). Angka skenario di halaman 10 pada mockup adalah **ilustrasi**. Versi bulanan dan tahunan memakai kerangka yang sama; versi tahunan menambah perbandingan antar tahun. Semua halaman perlu catatan keterbatasan data yang jujur.

### 3.3 Data & Integrasi (`Data.dc.html`)
Tabel status sheet Google Sheets (baris, status sambungan, peringatan kualitas), tabel indikator ekonomi (sumber, frekuensi, status terakhir diambil), tombol "Sinkron semua sekarang", dan pengaturan **Batas tutup bulan**: kalender (tgl 1 – akhir bulan) atau mengikuti Excel lama (jendela bergeser sekitar 2 hari, lihat bagian 6.3).

## 4. What-if

### 4.1 Variabel (11)
| Kelompok | Variabel | Rentang slider | Pengaruh di mockup (ASUMSI ILUSTRASI) |
|---|---|---|---|
| Suplai | Jumlah unit dibangun (plus tipe dan bulan mulai) | 0–30 | Unit siap jual = bulan mulai + durasi bangun (±5 bulan, ilustrasi). Tambahan UTJ ≈ 0,55/unit, tambahan akad ≈ 0,4/unit, tersebar 6 bulan setelah siap jual (akad terlambat 1 bulan) |
| Harga & promo | Perubahan harga | −10…+10 % | UTJ −0,8 % per +1 % harga |
| | Nilai promo (dari harga) | 0…6 % | UTJ +2 % per 1 poin |
| Marketing | Perubahan jumlah leads | −30…+50 % | UTJ +0,5 % per +1 % leads |
| | Tambahan event per bulan | 0…6 | UTJ +3 % per event |
| Pipeline & bank | Tingkat batal | −10…+10 poin | Akad −1,5 % per poin |
| | Lama proses bank | −15…+15 hari | Akad −0,3 % per hari |
| Ekonomi | BI Rate | −100…+100 bps | UTJ −0,04 % per bps |
| | IHSG | −20…+20 % | UTJ +0,15 % per 1 % |
| | Harga emas | −20…+20 % | UTJ +0,1 % per 1 % |
| | Inflasi | −2…+2 poin | UTJ −3 % per poin |

**Semua koefisien di tabel ini hanya ilustrasi untuk mockup.** Implementasi sungguhan harus mengkalibrasinya:
- Pipeline & bank: dari data (rate hazard akad/batal, durasi bank), bukti kuat.
- Harga/promo: dari histori PRICELIST dan kode promo (sheet DV). Bukti sedang.
- Leads/event: data leads baru Okt 2025–Mei 2026 dan event mulai 2025. Tampilkan peringatan jika koefisien tidak stabil.
- Ekonomi: korelasi bulanan dengan UTJ hanya ±0,2 (bagian 5.3). Perlakukan sebagai gambaran arah. Laporan harus menyebut hal ini.

### 4.2 Perilaku
- Efek variabel dihitung sebagai pengali pada proyeksi dasar. Rentang ketidakpastian tetap ditampilkan.
- Proyeksi penjualan tidak boleh melebihi stok unit yang tersedia dijual (sheet UNIT, status Open dan unit baru dari order bangun). Jika stok hampir habis, tampilkan peringatan.
- Skenario bisa disimpan dan dipakai ulang saat mengunduh PDF.

## 5. Mesin forecast

### 5.1 Definisi deret
- UTJ per bulan = jumlah baris dengan tanggal UTJ (`PENJUALAN!AT`) di bulan itu. Akad per bulan = tanggal akad (`PENJUALAN!AX`).
- Deret mulai Apr 2022 (UTJ pertama). Total UTJ 284, akad 188 (harus cocok dengan sheet FORECASTING lama). Lihat `fixtures/monthly_utj_akad.csv` (kalender bulan penuh).
- Penerimaan = akad × net price. Mockup memakai rata-rata net price Rp 0,762 miliar. Versi sungguhan harus memakai harga per tipe/unit (PRICELIST, UNIT) dan sebaiknya jadwal penerimaan (lihat bagian 10, pertanyaan terbuka).

### 5.2 Hasil backtest (rolling origin)
Pengujian: 26 titik asal (Apr 2024 – Mei 2026). Di tiap titik, ramal 1–3 bulan ke depan hanya dengan data yang sudah ada. Metrik: MAE dalam unit (lebih kecil lebih baik). Skrip: `prototypes/bt.py`.

**UTJ**
| Metode | MAE 1 bln | MAE 1–3 bln | MAE total 3 bln |
|---|---|---|---|
| Exponential smoothing (level) | 3,26 | **3,18** | 6,39 |
| Rata-rata 12 bulan | 3,26 | 3,24 | **5,87** |
| Holt damped | 3,28 | 3,28 | 7,13 |
| Rata-rata 6 bulan | 3,21 | 3,33 | 6,98 |
| Rata-rata 3 bulan | 3,65 | 3,42 | 7,88 |
| Holt-Winters musiman | 3,71 | 3,78 | 6,70 |
| Naive (bulan lalu) | 3,50 | 4,04 | 10,27 |
| Seasonal naive | 4,62 | 4,67 | 7,31 |
| **Excel lama** (`FORECAST.LINEAR` per bulan kalender) | 4,72 | 4,83 | 8,30 |

Kesimpulan: pakai **rata-rata 12 bulan** (atau exponential smoothing level) untuk UTJ. Metode Excel lama paling buruk.

**Akad**
| Metode | MAE total 3 bln |
|---|---|
| **Pipeline UTJ (5.4)** | **2,95** |
| Rata-rata 6 bulan | 4,13 |
| Excel lama | 5,26 |

Akad harus diproyeksikan dari pipeline UTJ, bukan sebagai deret berdiri sendiri.

### 5.3 Variabel makro
`prototypes/macro.py`: regresi Ridge dengan variabel makro lag 1 bulan, 26 titik uji.
- Gabungan IHSG + emas + inflasi + BI Rate: MAE 3,27 vs rata-rata 12 bulan 3,26 (tidak ada gain).
- Emas saja 2,98 dan BI Rate saja 3,09, selisih kecil dan bisa kebetulan.
- Korelasi tahunan 0,97 (IHSG) dan 0,89 (emas) di sheet INSTRUMEN EKONOMI berasal dari 4 titik data, menyesatkan. Korelasi bulanan: emas 0,19, IHSG 0,19, inflasi 0,03.
- Pernikahan, kelahiran, UMR adalah data tahunan yang diulang tiap bulan, bukan sinyal bulanan.
- BI Rate di sheet lama kosong di baris awal (`#DIV/0!` pada korelasi).

Aturan implementasi: makro boleh masuk model hanya jika lolos backtest rolling-origin yang sama (galat lebih kecil secara konsisten). Sementara itu pakai sebagai konteks narasi.

### 5.4 Model pipeline akad
Skrip referensi: `prototypes/pipe.py`. Algoritma (discrete-time hazard, per bulan umur UTJ):

1. Untuk tiap UTJ, "umur" = selisih bulan dari bulan UTJ. Hasil: akad pada umur a, batal pada umur a, atau masih terbuka.
2. Pada titik waktu T (hanya event dengan bulan ≤ T): hazard akad `ha[a]` = jumlah akad pada umur a ÷ jumlah UTJ yang berisiko pada umur a (masih terbuka dan umur a sudah teramati). Idem hazard batal `hb[a]`. Jika berisiko < 3, hazard = 0. Umur 0–18.
3. Untuk tiap UTJ terbuka berumur `age`, probabilitas akad di bulan T+k = `s × ha[age+k]` dengan `s` diperbarui `s ×= (1 − ha − hb)`.
4. Tambahkan UTJ baru yang diproyeksi (rata-rata 12 bulan) yang masuk di bulan T+j dan menjadi akad di T+j+k dengan hazard umur k.
5. Jumlahkan per bulan untuk proyeksi akad.

Hazard terbaru (data s.d. Jul 2026), umur 0–8 bulan:
- akad: 0,10 · 0,25 · 0,23 · 0,14 · 0,11 · 0,20 · 0,15 · 0,10 · 0,20
- batal: 0,05 · 0,09 · 0,06 · 0,14 · 0,10 · 0,11 · 0,08 · 0,07 · 0,04

Hitung ulang dari data setiap sinkron. Uji regresi: implementasi harus mereproduksi MAE total 3 bulan ≈ 2,95 (toleransi kecil karena beda definisi bulan).

### 5.5 Rentang ketidakpastian
Mockup memakai ±(3 + 0,35 × bulan ke depan) unit untuk UTJ bulanan dan akar jumlah kuadrat untuk total 12 bulan. Implementasi sungguhan: hitung dari galat backtest historis (mis. kuantil 10–90 % galat per horizon). Rentang harus melebar seiring horizon.

### 5.6 Rekomendasi implementasi
Metode pemenang sederhana (rata-rata bergulir dan hazard). Cukup diimplementasikan di **TypeScript** tanpa Python/statsmodels. Itu menyederhanakan deploy di Vercel. Statsmodels dipakai hanya di skrip riset (`prototypes/`), bukan di produksi.

## 6. Data

### 6.1 Sheet sumber dan kolom penting (Excel `FORECASTING_UPDATE.xlsx`)
| Sheet | Isi | Catatan |
|---|---|---|
| `PENJUALAN` | Satu baris per transaksi, data mulai baris 4 | B unit, C tipe, D hook, E progres bangun, F hadap, G fasum, I cara bayar, J status (REAL/SOLD/BATAL), K harga, L diskon, M tambah/kurang desain, N net price, O promo, P–AN blok Proses Bank 1–5 (nama bank, tgl proses awal/akhir, durasi hari, status berkas), AP marketing, AQ agent, AR database, AS asal leads, **AT tgl UTJ**, **AU tgl batal**, AV SPR & PPJB, AW pencairan, **AX tgl akad**, AY alasan batal. 289 baris, 284 UTJ, 188 akad, 85 batal |
| `LEADS` | Leads per sumber dan status, header baris 2 | Kolom: Database, Asal Leads, Tanggal, Marketing, Agent, Minat Pembelian, Tanggal Survey, Status. Berisi nama dan nomor telepon (PII, jangan impor mentah). Tanggal baru Okt 2025–Mei 2026 |
| `PERFORMA MKT` | Konversi per marketing dan agent | Sebenarnya turunan dari PENJUALAN, hitung ulang di database |
| `EVENT MARKETING` | Kegiatan, kategori, qty, harga satuan, biaya, tanggal event | Mulai 2025 |
| `BANK AKAD` | Durasi dan hasil proses bank | Turunan, ada `#VALUE!` pada baris INA |
| `PRICELIST` | Histori harga per unit (unit, tanggal, harga, diskon, net price) | |
| `DV` | Kode promo dan benefit (AC, pompa, kanopi, TV, kulkas, peningkatan SHM, CB UTJ, subsidi angsuran) per marketing/agent | Dasar variabel "nilai promo" |
| `UNIT` | Master unit: tipe, LB, LT, hadap, hook, tahap, cluster, status, progres bangun, fasum | Dasar stok tersedia dan minat per jenis unit |
| `PROGRES BANGUN` | Progres mingguan per unit (±9.600 baris) | Dasar durasi bangun per tipe |
| `INSTRUMEN EKONOMI` | Bulanan Jan 2022–Apr 2026 di kolom P:Z: emas (Q), IHSG (R), inflasi (S), IHPR (T), UMR Jatim (U), UMK Sby (V), UMK Sda (W), pernikahan (X), kelahiran (Y), BI Rate (Z) | |
| `FORECASTING`, `SUMMARY`, `Sheet5` | Hasil hitung Excel lama | Hanya untuk pembanding |

### 6.2 Angka referensi dari data (untuk uji tampilan)
- Funnel: UTJ 284 → SPR & PPJB 240 (84 %) → akad 188 (66 %); batal 85 (30 %); pencairan 181.
- Per tipe (UTJ · akad): Kanaya 62·42, Jenaya 58·43, Angeline 38·24, Darlene 33·22, Gwen 32·20, Ruko 27·17.
- Agent (UTJ, akad, konversi): Inhouse 84, 54, 64 % · Team Ariyanti 37, 34, 92 % · BRCS 17, 17, 100 % · Staf 14, 12, 86 % · Capital21 8, 7, 88 %.
- Sumber leads (Okt 2025–Mei 2026): Instagram 1.175, Facebook 1.101, WhatsApp 456, Iklan pribadi 381, Iklan 216, Meta Ads 73.
- Bank (berkas, approve, durasi hari): BTN 23, 65 %, 24,8 · BRI 26, 42 %, 38,0 · BNI 14, 57 %, 15,8 · Mandiri 13, 46 %, 32,4 · BSN 10, 70 %, 29,5.
- Alasan batal (32 tercatat dari 85): batal sepihak 16, reject bank 11, tidak kooperatif 4, pindah unit 1.
- UTJ berjalan (belum akad/batal): 16 unit. Rata-rata net price ≈ Rp 762 juta.
- 12 bulan terakhir: UTJ 85, akad 57.

### 6.3 Masalah kualitas data yang harus ditangani
1. **Definisi bulan di Excel lama bergeser.** Rumus COUNTIFS di sheet FORECASTING memakai jendela `>= EOMONTH(bulan,−1) − 2` dan `< EOMONTH(bulan,0) − 1`, yaitu bergeser sekitar 2 hari dari kalender. Konfirmasi dengan pemilik apakah itu tutup bulan yang disengaja. Sediakan pengaturan "Batas tutup bulan" (kalender atau ikut Excel).
2. Nilai error Excel (`#VALUE!`, `#DIV/0!`, `#N/A` pada tipe) harus dibersihkan saat impor dan dilaporkan di layar Data & Integrasi.
3. Leads dan event punya rentang waktu pendek, jangan dipakai sebagai prediktor model utama sebelum data cukup.
4. Alasan batal baru tercatat untuk sebagian batal.
5. Nama agent tidak konsisten ("XAVIER MARK" vs "XAVIER MARKS"). Normalisasi saat impor.
6. Data pribadi (nama, telepon) tidak perlu masuk database analitik. Cukup ID.


### Metode proyeksi dasar dan peran regresi (keputusan terbaru)
Backtest ulang (26 titik uji, galat rata-rata 1–3 bulan ke depan, unit/bulan): UTJ rata-rata 12 bln 3,24; LinearRegression tren 24 bln 3,12; tren semua data 3,23; tren + lag 3,26. Akad rata-rata 12 bln 2,04; LinearRegression 2,05–2,39. Selisih UTJ terlalu kecil untuk dianggap terbukti.
- **Versi 1:** proyeksi utama = rata-rata 12 bulan (UTJ) dan pipeline hazard (akad).
- **Pembanding:** garis tren `sklearn.linear_model.LinearRegression` ditampilkan di grafik dashboard (garis hijau). Jika berjauhan dari proyeksi utama, tampilkan tanda "arah penjualan mungkin berubah".
- **Fase berikutnya:** pakai regresi untuk mengkalibrasi koefisien what-if setelah data event/promo terkumpul.
- Bukan regresi per bulan kalender seperti Excel lama (itu terburuk).


### Insight marketing (halaman 10–11)
Sumber: sheet LEADS, EVENT MARKETING, PERFORMA MKT. Temuan awal dari data Okt 2025 – Mei 2026 (dihitung ulang, bukan dari sel total sheet):
- Biaya Rp 164,2 jt, 3.943 leads, 63 UTJ: Rp 41,6 rb per lead, Rp 2,6 jt per UTJ. Sel total di sheet (Rp 501.072 dan Rp 22,3 jt) berbeda dari hitungan ulang; tampilkan peringatan kualitas data.
- 56% leads (2.200 dari 3.943) tanpa status. Status terisi per marketing: Eki 36%, Tama 29%, Karin 23%, Risky 20%, Sultan 14%, Adit/Kris 3%.
- Sumber leads: Office 83% leads, survey/leads 1,9%; Pribadi 10% leads, 10,0% survey, 34% porsi UTJ. Porsi UTJ per database di sheet mencakup seluruh riwayat, jadi bandingkan porsi, bukan konversi.
- Biaya per bulan vs hasil: Apr 2026 Rp 74,8 jt (12× Mar), leads turun 723→458, UTJ naik 3→11. Korelasi biaya–leads −0,2, biaya–UTJ 0,33 (n=8): pola awal, bukan sebab-akibat.
- Iklan digital 34% biaya, tetapi leads berlabel iklan berbayar ±10%; Instagram/Facebook tidak dibedakan organik vs berbayar.
- Batal inhouse 24% (20/84) vs non-inhouse 14% (22/161).
**Aturan implementasi:** temuan dihitung oleh kode (aturan deterministik: porsi, rasio, ambang). Claude hanya merumuskan kalimat tindakan dari JSON temuan, tidak boleh membuat angka atau klaim sebab-akibat. Sampel kecil diberi label hipotesis. Data wajib tambahan: kode kampanye/organik-berbayar per lead, status wajib diisi, alasan batal wajib diisi, event dengan ID agar biaya, leads, UTJ bisa dikaitkan.

## 7. Sumber data eksternal (variabel ekonomi)

Keputusan: lima sumber di bawah. Endpoint, kuota, dan paket gratis belum diverifikasi; uji dulu sebelum produksi (terutama apakah IHSG dan emas tersedia di paket gratis Twelve Data).

| Variabel | Sumber | Cara | Frekuensi |
|---|---|---|---|
| Narasi laporan | **Claude API** | API key Anthropic | Per laporan |
| Data internal (UTJ, akad, leads, dll.) | **Google Sheets API** | Service account; sheet di-share ke email service account | Terjadwal |
| Inflasi, pernikahan, kelahiran, UMR/UMK | **BPS Web API** (`webapi.bps.go.id`) | API key gratis | Bulanan/tahunan |
| BI Rate | **bi.go.id** | Tidak ada API resmi: fetch halaman dan baca tabel dengan kode biasa | Bulanan |
| IHSG dan emas (USD/oz) | **Twelve Data API** | REST + API key (`TWELVE_DATA_API_KEY`) | Harian |

Cadangan: jika Twelve Data menolak simbol di paket gratis, pakai Yahoo Finance (`yahoo-finance2`, simbol `^JKSE` dan `GC=F`; tidak resmi) hanya untuk simbol itu. Indeks harga properti (IHPR) dari Bank Indonesia: kuartalan, sumber perlu dicek di sheet lama. **TradingView tidak dipakai**: tidak ada API publik, scraping melanggar syarat layanan.

Data harga diambil oleh kode biasa, bukan Claude. Claude API hanya untuk narasi laporan (dan opsional cadangan pembaca halaman jika format bi.go.id berubah).

Aturan: jadwalkan pengambilan (cron di Vercel), simpan ke database, dashboard membaca dari database. Jika sumber gagal, pakai data terakhir dan tampilkan peringatan "diperbarui terakhir tanggal …". Data makro tidak mengubah angka proyeksi (backtest tidak menunjukkan gain konsisten); dipakai sebagai konteks laporan dan bahan what-if.

## 8. Arsitektur dan stack (rekomendasi)

- **Frontend:** Next.js (React) di Vercel. Komponen mengikuti `mockup/`. Grafik: pustaka ringan (mis. Recharts/visx) atau SVG sendiri. Fon: Plus Jakarta Sans.
- **Backend/DB:** Supabase (Postgres). Tabel kunci: `transactions`, `units`, `leads_agg`, `events`, `bank_cases`, `price_history`, `macro_series`, `scenarios`, `forecast_runs`, `reports`.
- **Sinkron Google Sheets:** Google Sheets API, job terjadwal (Vercel Cron / Supabase Edge Function) yang membaca sheet, membersihkan, lalu upsert ke Postgres. Tahap awal: upload `.xlsx`.
- **Mesin forecast:** modul TypeScript murni (fungsi deterministik, mudah diuji). Input: deret bulanan dan snapshot pipeline. Output: proyeksi plus rentang. Uji dengan `fixtures/monthly_utj_akad.csv`.
- **PDF:** render server-side dari template HTML (Playwright/Chromium atau `@react-pdf/renderer`). Grafik dirender statis. Halaman A4.
- **Claude API:** satu fungsi server yang menerima JSON ringkasan angka (hasil mesin forecast) dan mengembalikan teks pembahasan per bagian. Kunci API hanya di server.

### Kontrak narasi Claude
- Input: objek JSON berisi periode, filter, skenario aktif, angka dasar, proyeksi, rentang, pipeline, konteks ekonomi, daftar peringatan data.
- Instruksi sistem: tulis bahasa Indonesia yang mudah dipahami manajemen non-teknis; **hanya kutip angka dari JSON**; jangan menghitung ulang atau menebak angka; sebut ketidakpastian dan batas data; untuk variabel ekonomi sebut bahwa pengaruhnya lemah pada data historis; hindari klaim sebab-akibat yang tidak didukung data.
- Validasi: setelah narasi dibuat, ekstrak semua angka di teks dan pastikan semuanya ada di JSON masukan. Jika ada yang tidak cocok, regenerasi.

## 9. Fase pembangunan dan kriteria selesai

1. **Fondasi data + mesin forecast.**
   Impor Excel, bersihkan, bentuk deret bulanan. Implementasi rata-rata 12 bulan dan pipeline hazard di TypeScript.
   Selesai jika: total UTJ 284 dan akad 188; backtest mereproduksi tabel 5.2 (UTJ rata-rata 12 bulan MAE 1–3 bln ≈ 3,24, pipeline akad total 3 bulan ≈ 2,95).
2. **Dashboard.** Grafik, tabel, filter, toggle, enam kartu data aktual, rentang proyeksi. Selesai jika: tampilan sesuai `mockup/Main.dc.html` dan angka dari database.
3. **What-if.** Panel dengan 11 variabel, koefisien terkalibrasi (bagian 4.1), batas stok, simpan skenario.
4. **Sinkron Google Sheets + data ekonomi.** Layar Data & Integrasi, job terjadwal, peringatan kualitas data, pengaturan batas tutup bulan.
5. **Laporan PDF + narasi Claude.** Bulanan dan tahunan, validasi angka narasi.

Tiap fase diverifikasi dengan data nyata sebelum lanjut. Variabel makro tidak masuk model sebelum lolos backtest.

## 10. Pertanyaan terbuka (tanyakan ke pemilik)

1. Tutup bulan: kalender atau jendela Excel (tgl 29–28)? Apakah itu disengaja?
2. Penerimaan: cukup akad × net price, atau perlu jadwal penerimaan (termin, DP, cicilan tunai bertahap)? Sheet SUMMARY punya "Estimasi" dan "Realisasi Penerimaan".
3. Definisi stok yang tersedia dijual (Open vs Margal vs Hold) dari sheet UNIT.
4. Apakah ada data leads sebelum Okt 2025 dan data biaya iklan bulanan sebelum 2025?
5. Siapa saja pengguna dan perlu login/peran (owner vs tim)? Apakah laporan perlu dibagikan lewat link?
6. Apakah nama pembeli/agent perlu muncul di dashboard, atau cukup agregat?
7. Sumber IHPR di sheet lama: BI atau BPS?

## 11. Token desain (dari mockup)

- Fon: Plus Jakarta Sans (400–800).
- Warna: ink `#141B26`, muted `#5A6473`, border `#E1E5EB`, latar `#F3F5F8`, permukaan `#FFFFFF`; UTJ navy `#24467C`; akad amber `#E58A2B`; proyeksi UTJ `#C7D3E8` dengan garis putus `#24467C`; proyeksi akad `#F7D9B8` dengan garis putus `#B8620F`; rentang `#E3E8F0`; positif `#176B3A`; peringatan `#7A4A00` di `#FCEBD2`; galat `#8F1F23` di `#FBE4E4`.
- Aksesibilitas: kontrol memakai elemen asli (`button`, `select`, `input`, `details/summary`), target sentuh ≥ 44 px, warna bukan satu-satunya pembeda (selalu ada teks), tata letak harus berfungsi di lebar ponsel.

## 12. Lampiran: skrip prototipe (`prototypes/`)

- `extract.py`: membaca sheet PENJUALAN dan LEADS menjadi pandas (tanggal UTJ/batal/SPR/pencairan/akad).
- `bt.py`: backtest metode UTJ dan akad langsung (tabel 5.2).
- `pipe.py`: model pipeline hazard dan backtest akad.
- `macro.py`: uji regresi variabel makro lag 1.

Skrip memakai path lokal sandbox. Sesuaikan path file Excel dan folder keluaran sebelum dijalankan.
