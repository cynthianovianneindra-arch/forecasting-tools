// Berita properti terbaru dari dua situs (hanya judul, tautan, sumber, dan tanggal; isi berita tidak disalin).
// Pembaca tidak bergantung pada nama class situs: artikel dikenali dari pola alamatnya (bisnis.com /read/YYYYMMDD/, cnnindonesia.com /YYYYMMDDhhmmss-).

export interface Berita { judul: string; url: string; sumber: string; tanggal: string | null; topik: string[]; kategori: string[] }
export type Arah = "mendukung" | "menekan" | "netral";
/** Perkiraan arah pengaruh sebuah berita: bagian penjualan yang tersentuh, arahnya, dan alasannya. */
export interface Dampak { topik: string; arah: Arah; ke: string; alasan: string }

export const SUMBER_BERITA = [
  { nama: "Bisnis.com", url: "https://ekonomi.bisnis.com/properti", host: /(^|\.)bisnis\.com$/i, tanggalUrl: /\/read\/(\d{4})(\d{2})(\d{2})\//, artikel: /\/read\/\d{8}\// },
  { nama: "CNN Indonesia", url: "https://www.cnnindonesia.com/tag/properti", host: /(^|\.)cnnindonesia\.com$/i, tanggalUrl: /\/(\d{4})(\d{2})(\d{2})\d{6}-\d+-\d+\//, artikel: /\/\d{14}-\d+-\d+\// },
  // Alamat artikel Berita Jatim dan Jawa Pos tidak memuat tanggal; tanggal dicari dari data terstruktur atau teks di sekitar tautan.
  { nama: "Berita Jatim", url: "https://beritajatim.com/", host: /(^|\.)beritajatim\.com$/i, tanggalUrl: /(?!)/, artikel: /^\/(?!tag\/|category\/|kategori\/|page\/|author\/|search|indeks|index)(?:[a-z0-9-]+\/)?[a-z0-9]+(?:-[a-z0-9]+){4,}\/?$/i },
  { nama: "Jawa Pos", url: "https://www.jawapos.com/properti", host: /(^|\.)jawapos\.com$/i, tanggalUrl: /(?!)/, artikel: /^\/[a-z-]+\/\d{6,}\//i },
] as const;
type Sumber = (typeof SUMBER_BERITA)[number];

/** Halaman yang dibaca. saring "properti" = ambil hanya judul yang membahas properti (halaman umum berita daerah); opsional = kegagalan tidak dilaporkan (halaman tag yang bisa saja tidak ada). Fokus: properti Sidoarjo (lokasi Shaistanaya City) dan Jawa Timur, dengan berita properti nasional sebagai pelengkap. */
export const HALAMAN_BERITA: { situs: number; url: string; saring: false | "properti"; opsional?: boolean }[] = [
  { situs: 3, url: "https://www.jawapos.com/properti", saring: false },
  { situs: 2, url: "https://beritajatim.com/", saring: "properti" },
  { situs: 2, url: "https://beritajatim.com/ekonomi", saring: "properti", opsional: true },
  { situs: 2, url: "https://beritajatim.com/tag/properti", saring: false, opsional: true },
  { situs: 2, url: "https://beritajatim.com/tag/sidoarjo", saring: "properti", opsional: true },
  { situs: 0, url: "https://ekonomi.bisnis.com/properti", saring: false },
  { situs: 1, url: "https://www.cnnindonesia.com/tag/properti", saring: false },
];

export const SIDOARJO = /Sidoarjo|\bWaru\b|Gedangan|\bKrian\b|Buduran|Tanggulangin|Porong|Sedati|Wonoayu|Sukodono|Tulangan|Balongbendo|Krembung|\bJabon\b|Prambon/i;
export const JATIM = /Jawa Timur|\bJatim\b|Surabaya|Sidoarjo|Gresik|Malang|Mojokerto|Pasuruan|Probolinggo|Jombang|Kediri|Blitar|Tulungagung|Lamongan|Bojonegoro|Tuban|Madiun|Banyuwangi|Jember|Lumajang|Situbondo|Bondowoso|Pamekasan|Sumenep|Bangkalan|Sampang|Nganjuk|Ngawi|Magetan|Ponorogo|Pacitan|Trenggalek|Kota Batu|Madura|Gerbangkertosusila|Surabaya Raya/i;
export const PROPERTI = /rumah|properti|perumahan|hunian|\bKPR\b|developer|pengembang|apartemen|real estate|tanah|\bFLPP\b|Tapera|rusun|\bREI\b|Apersi|kavling|\bruko\b|perumnas|\bkos\b|sewa/i;

/** Kategori berita yang dipantau, dikenali dari kata kunci judul. */
export const KATEGORI: { nama: string; re: RegExp; harusProperti?: boolean }[] = [
  { nama: "Sidoarjo", re: SIDOARJO }, // lokasi Shaistanaya City
  { nama: "Jawa Timur", re: JATIM },
  { nama: "Instrumen ekonomi", re: /BI[- ]?Rate|suku bunga|inflasi|deflasi|IHSG|rupiah|\bkurs\b|dolar AS|harga emas|emas (naik|turun|antam|dunia)|obligasi|\bSBN\b|bank sentral|The Fed|pertumbuhan ekonomi|\bPDB\b/i },
  { nama: "Daya beli", re: /daya beli|konsumsi rumah tangga|kelas menengah|\bPHK\b|pemutusan hubungan kerja|pengangguran|lapangan kerja|harga (beras|BBM|bahan pokok|pangan|listrik)|\bTHR\b|penghasilan masyarakat/i },
  { nama: "Pajak properti", re: /\bPPN\b|\bPBB\b|BPHTB|\bPPh\b|pajak (properti|rumah|tanah|penjualan|pertambahan)|insentif pajak|\bDTP\b/i },
  { nama: "UMR dan upah", re: /\bUMR\b|\bUMK\b|\bUMP\b|upah minimum|kenaikan upah|upah buruh/i },
  { nama: "Keputusan pemerintah", re: /rumah|properti|perumahan|hunian|\bKPR\b|\bFLPP\b|Tapera|rusun|rumah susun|3 juta rumah|\bHGB\b|\bPBG\b|\bIMB\b/i, harusProperti: true },
];
const AKTOR_PEMERINTAH = /pemerintah|kementerian|menteri|presiden|prabowo|\bOJK\b|\bBI\b|bank indonesia|aturan|peraturan|regulasi|kebijakan|perpres|permen|keputusan|\bPP\b|\bBPN\b|\bPUPR\b|\bPKP\b|ditetapkan|resmi/i;

export function kategoriBerita(judul: string): string[] {
  return KATEGORI.filter((k) => k.re.test(judul) && (!k.harusProperti || AKTOR_PEMERINTAH.test(judul))).map((k) => k.nama);
}

const entitas = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const bersih = (s: string) => entitas(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Topik yang relevan untuk penjualan rumah, dikenali dari kata kunci judul (tanpa AI). */
const TOPIK: [RegExp, string][] = [
  [/\bKPR\b|kredit pemilikan rumah/i, "KPR"],
  [/suku bunga|BI[- ]?Rate/i, "Suku bunga"],
  [/\bPPN\b|pajak|PBB|BPHTB/i, "Pajak"],
  [/subsidi|FLPP|Tapera|rumah murah/i, "Subsidi"],
  [/uang muka|\bDP\b|\bLTV\b/i, "Uang muka"],
  [/harga|inflasi/i, "Harga"],
  [/pengembang|developer|properti|perumahan/i, "Pengembang"],
];
export const topikJudul = (judul: string) => TOPIK.filter(([re]) => re.test(judul)).map(([, n]) => n).filter((n) => n !== "Pengembang" || !TOPIK.slice(0, 6).some(([re]) => re.test(judul))).slice(0, 3);

const BULAN_ID: Record<string, string> = { januari: "01", jan: "01", februari: "02", feb: "02", maret: "03", mar: "03", april: "04", apr: "04", mei: "05", juni: "06", jun: "06", juli: "07", jul: "07", agustus: "08", agu: "08", agt: "08", september: "09", sep: "09", oktober: "10", okt: "10", november: "11", nov: "11", desember: "12", des: "12" };
/** Tanggal pertama yang tampak di potongan HTML: atribut datetime="YYYY-MM-DD" atau teks seperti "23 Oktober 2026". */
export function cariTanggal(teks: string): string | null {
  const a = teks.match(/datetime=["'](\d{4}-\d{2}-\d{2})/i);
  const b = teks.match(/\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|sep|okt|nov|des)[a-z]*\.?,?\s+(\d{4})\b/i);
  const ia = a ? teks.indexOf(a[0]) : Infinity, ib = b ? teks.indexOf(b[0]) : Infinity;
  if (a && ia <= ib) return a[1];
  if (b) return `${b[3]}-${BULAN_ID[b[2].toLowerCase()] ?? "01"}-${b[1].padStart(2, "0")}`;
  return null;
}

function tanggalDariUrl(url: string, s: Sumber): string | null {
  const m = url.match(s.tanggalUrl);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function jelajahi(x: unknown, keluar: { judul: string; url: string; tanggal: string | null }[]) {
  if (Array.isArray(x)) { x.forEach((i) => jelajahi(i, keluar)); return; }
  if (!x || typeof x !== "object") return;
  const o = x as Record<string, unknown>;
  const judul = typeof o.headline === "string" ? o.headline : typeof o.name === "string" ? o.name : null;
  const url = typeof o.url === "string" ? o.url : typeof o["@id"] === "string" ? (o["@id"] as string) : null;
  if (judul && url) keluar.push({ judul, url, tanggal: typeof o.datePublished === "string" ? o.datePublished.slice(0, 10) : null });
  for (const v of Object.values(o)) if (v && typeof v === "object") jelajahi(v, keluar);
}

/** Ambil daftar berita dari HTML satu halaman: pertama dari data terstruktur (JSON-LD), lalu dari tautan artikel. */
export function parseBerita(html: string, sumber: Sumber, maks = 10): Berita[] {
  const calon = new Map<string, { judul: string; tanggal: string | null }>();
  const tambah = (urlMentah: string, judulMentah: string, tanggal: string | null) => {
    let u: URL;
    try { u = new URL(entitas(urlMentah), sumber.url); } catch { return; }
    if (!sumber.host.test(u.hostname) || !sumber.artikel.test(u.pathname)) return;
    const judul = bersih(judulMentah);
    if (judul.length < 25 || judul.length > 220 || judul.split(" ").length < 4) return;
    const kunci = u.origin + u.pathname;
    const ada = calon.get(kunci);
    if (!ada || judul.length > ada.judul.length) calon.set(kunci, { judul, tanggal: tanggal ?? ada?.tanggal ?? tanggalDariUrl(u.pathname, sumber) });
  };
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const k: { judul: string; url: string; tanggal: string | null }[] = []; jelajahi(JSON.parse(m[1]), k); k.forEach((b) => tambah(b.url, b.judul, b.tanggal)); } catch { /* JSON-LD rusak: abaikan */ }
  }
  for (const m of html.matchAll(/<a\b[^>]*?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const i = m.index ?? 0;
    tambah(m[1], m[2], cariTanggal(html.slice(i + m[0].length, i + m[0].length + 350)) ?? cariTanggal(html.slice(Math.max(0, i - 150), i)));
  }
  return [...calon].map(([url, b]) => ({ judul: b.judul, url, sumber: sumber.nama, tanggal: b.tanggal ?? tanggalDariUrl(url, sumber), topik: topikJudul(b.judul), kategori: kategoriBerita(b.judul) }))
    .sort((a, b) => (b.tanggal ?? "").localeCompare(a.tanggal ?? "")).slice(0, maks);
}

/** Gabungkan berita beberapa sumber: urut tanggal terbaru, bergantian antar sumber bila tanggalnya sama, tanpa judul ganda. */
export function gabungBerita(daftar: Berita[][], total = 8): Berita[] {
  const semua = daftar.flatMap((d, i) => d.map((b, j) => ({ b, j, i })));
  semua.sort((x, y) => (y.b.tanggal ?? "").localeCompare(x.b.tanggal ?? "") || x.j - y.j || x.i - y.i);
  const lihat = new Set<string>(), out: Berita[] = [];
  for (const { b } of semua) { const k = b.judul.toLowerCase().slice(0, 60); if (lihat.has(k)) continue; lihat.add(k); out.push(b); if (out.length >= total) break; }
  return out;
}

const UA = "Mozilla/5.0 (compatible; forecasting-tools/1.0; +riset internal)";
const TTL = 30 * 60 * 1000, BASI = 24 * 3600 * 1000;
let cache: { waktu: number; hasil: { items: Berita[]; galat: string[] } } | null = null;

/** Ambil berita dari semua halaman (batas waktu 7 detik per halaman). Halaman umum disaring ke kategori minat. Hasil disimpan 30 menit di memori; bila semua gagal, hasil lama (maks. 1 hari) tetap dipakai. */
export async function ambilBerita(f: typeof fetch = fetch, sekarang = Date.now()): Promise<{ items: Berita[]; galat: string[] }> {
  if (cache && sekarang - cache.waktu < TTL) return cache.hasil;
  const galat: string[] = [];
  const daftar = await Promise.all(HALAMAN_BERITA.map(async (h) => {
    const s = SUMBER_BERITA[h.situs];
    try {
      const r = await f(h.url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" }, cache: "no-store", signal: AbortSignal.timeout(7000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const semua = parseBerita(await r.text(), s, h.saring ? 60 : 20);
      if (!semua.length) throw new Error("tidak ada artikel yang dikenali di halaman");
      return h.saring === "properti" ? semua.filter((b) => PROPERTI.test(b.judul)) : semua;
    } catch (e) { if (!h.opsional) galat.push(`${s.nama} (${new URL(h.url).pathname === "/" ? new URL(h.url).hostname : new URL(h.url).pathname}): ${e instanceof Error ? e.message : String(e)}`); return [] as Berita[]; }
  }));
  const items = gabungBerita(daftar, 40);
  if (!items.length && cache && sekarang - cache.waktu < BASI) return { items: cache.hasil.items, galat };
  const hasil = { items, galat };
  if (items.length) cache = { waktu: sekarang, hasil };
  return hasil;
}

// ---------- Analisa dampak (aturan kata kunci, bukan AI; hipotesis untuk dibaca bersama data penjualan) ----------
const re = (s: string) => new RegExp(s, "i");
const ATURAN: { topik: string; syarat: RegExp; naik?: RegExp; turun?: RegExp; ke: string; naikArah: Arah; turunArah: Arah; naikAlasan: string; turunAlasan: string; netralAlasan: string; dasar?: Arah }[] = [
  { topik: "Suku bunga", syarat: re("suku bunga|BI[- ]?Rate|bunga (KPR|acuan|kredit)"), naik: re("naik|dinaikkan|menanjak|tinggi"), turun: re("turun|dipangkas|diturunkan|melandai|pemangkasan"), ke: "Cicilan KPR dan daya beli → jumlah UTJ dan batal",
    naikArah: "menekan", turunArah: "mendukung", naikAlasan: "Bunga naik membuat cicilan lebih berat, calon pembeli lebih sulit lolos KPR sehingga UTJ turun dan batal bisa naik.", turunAlasan: "Bunga turun membuat cicilan lebih ringan sehingga lebih banyak pembeli lolos KPR.", netralAlasan: "Perubahan bunga memengaruhi cicilan KPR; pantau arahnya." },
  { topik: "KPR", syarat: re("\\bKPR\\b|kredit pemilikan rumah|penyaluran kredit"), naik: re("naik|tumbuh|meningkat|dipermudah|relaksasi|longgar"), turun: re("turun|menurun|diperketat|ketat|ditolak|seret|melambat"), ke: "Persetujuan bank → UTJ yang sampai akad",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "KPR yang makin mudah atau tumbuh membantu UTJ sampai akad.", turunAlasan: "KPR yang ketat atau melambat menambah risiko berkas ditolak atau lama diproses bank.", netralAlasan: "Kebijakan KPR memengaruhi proses bank; cek kolom Proses Bank." },
  { topik: "Pajak", syarat: re("\\bPPN\\b|\\bDTP\\b|pajak|PBB|BPHTB|bea"), naik: re("diperpanjang|perpanjangan|ditanggung|insentif|bebas|gratis|dilanjutkan|berlanjut|diskon pajak|keringanan"), turun: re("berakhir|dihapus|dicabut|naik|dinaikkan|dikenakan|tidak diperpanjang|batal diperpanjang"), ke: "Harga akhir dan promo PPN DTP → UTJ",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "Insentif pajak yang berlanjut menjaga harga akhir tetap ringan dan mempertahankan promo yang selama ini mendorong UTJ.", turunAlasan: "Insentif pajak yang berakhir atau pajak yang naik menaikkan harga akhir sehingga UTJ ber-PPN DTP bisa hilang.", netralAlasan: "Aturan pajak properti memengaruhi harga akhir pembeli." },
  { topik: "Subsidi", syarat: re("subsidi|FLPP|Tapera|rumah murah|SBUM|SSB"), naik: re("ditambah|tambahan|naik|diperluas|dipermudah|dilonggarkan|dibuka"), turun: re("dipangkas|habis|dihentikan|dibatasi|dikurangi|turun|ditutup|seret"), ke: "Segmen rumah subsidi → pembeli dan stok tipe bersubsidi",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "Kuota atau kemudahan subsidi bertambah, calon pembeli segmen bawah lebih banyak.", turunAlasan: "Kuota subsidi berkurang atau habis, pembeli segmen bawah tertahan.", netralAlasan: "Kebijakan subsidi memengaruhi pembeli segmen bawah." },
  { topik: "Uang muka", syarat: re("uang muka|\\bDP\\b|\\bLTV\\b|loan to value"), naik: re("naik|diperketat|dinaikkan"), turun: re("turun|ringan|0 ?persen|nol persen|dilonggarkan|dilonggarkan|dihapus|diturunkan"), ke: "Syarat uang muka → minat pembeli awal",
    naikArah: "menekan", turunArah: "mendukung", naikAlasan: "Uang muka lebih tinggi menyulitkan pembeli yang tabungannya terbatas.", turunAlasan: "Uang muka lebih ringan memudahkan pembeli membayar UTJ dan DP.", netralAlasan: "Aturan uang muka memengaruhi daya beli awal." },
  { topik: "UMR dan upah", syarat: re("\\bUMR\\b|\\bUMK\\b|\\bUMP\\b|upah minimum|kenaikan upah|upah buruh"), naik: re("naik|kenaikan|dinaikkan|ditetapkan naik|menjadi Rp"), turun: re("tidak naik|ditunda|turun|dipangkas|batal naik"), ke: "Daya beli pekerja dan biaya tukang → UTJ dan biaya bangun",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "Upah naik menambah daya beli calon pembeli pekerja formal; di sisi lain upah tukang dan biaya bangun bisa ikut naik.", turunAlasan: "Upah yang tertahan menahan daya beli calon pembeli, terutama segmen rumah subsidi.", netralAlasan: "Penetapan upah memengaruhi daya beli calon pembeli dan biaya tenaga bangun." },
  { topik: "Daya beli", syarat: re("daya beli|konsumsi rumah tangga|kelas menengah|\\bPHK\\b|pemutusan hubungan kerja|pengangguran|lapangan kerja|\\bTHR\\b"), naik: re("pulih|meningkat|menguat|tumbuh|naik|bangkit|terbuka"), turun: re("melemah|turun|anjlok|tertekan|menurun|\\bPHK\\b|pemutusan|pengangguran|lesu|menyusut|tergerus"), ke: "Kemampuan membayar cicilan dan DP → UTJ dan batal",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "Daya beli yang pulih memperbesar kelompok pembeli yang sanggup mencicil.", turunAlasan: "Daya beli melemah atau PHK meningkat mengurangi pembeli yang lolos KPR dan menaikkan risiko batal.", netralAlasan: "Kondisi daya beli menentukan kemampuan membayar DP dan cicilan." },
  { topik: "Harga kebutuhan", syarat: re("harga (beras|BBM|bahan pokok|pangan|listrik|sembako)|\\bBBM\\b"), naik: re("naik|melonjak|mahal"), turun: re("turun|murah|diturunkan"), ke: "Sisa penghasilan untuk cicilan → daya beli pembeli",
    naikArah: "menekan", turunArah: "mendukung", naikAlasan: "Harga kebutuhan pokok naik menggerus sisa penghasilan untuk cicilan rumah.", turunAlasan: "Harga kebutuhan turun menambah ruang penghasilan untuk cicilan.", netralAlasan: "Harga kebutuhan memengaruhi sisa penghasilan." },
  { topik: "Inflasi", syarat: re("inflasi|deflasi"), naik: re("naik|meningkat|melonjak|tinggi"), turun: re("turun|menurun|melandai|rendah|deflasi|terkendali"), ke: "Daya beli dan biaya bahan bangunan → UTJ dan harga",
    naikArah: "menekan", turunArah: "mendukung", naikAlasan: "Inflasi tinggi menggerus daya beli dan menaikkan biaya bahan bangunan.", turunAlasan: "Inflasi terkendali menjaga daya beli dan biaya bahan bangunan.", netralAlasan: "Inflasi memengaruhi daya beli dan biaya bangun." },
  { topik: "IHSG", syarat: re("\\bIHSG\\b|bursa saham|pasar saham"), naik: re("naik|menguat|melesat|rekor|hijau"), turun: re("turun|melemah|anjlok|merosot|ambles|merah"), ke: "Sentimen investor dan kekayaan kelas atas → minat membeli",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "Bursa menguat menambah keyakinan dan kekayaan calon pembeli segmen atas.", turunAlasan: "Bursa melemah menurunkan sentimen dan kekayaan calon pembeli segmen atas.", netralAlasan: "Pergerakan bursa memberi gambaran sentimen investor." },
  { topik: "Rupiah dan kurs", syarat: re("rupiah|\\bkurs\\b|dolar AS"), naik: re("menguat|naik"), turun: re("melemah|anjlok|merosot|jatuh|tertekan|ambles"), ke: "Biaya material impor dan kepastian ekonomi → harga bangun dan minat beli",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "Rupiah menguat menjaga biaya material impor dan kepercayaan pasar.", turunAlasan: "Rupiah melemah menaikkan biaya material impor dan memicu ketidakpastian pembeli.", netralAlasan: "Kurs memengaruhi biaya material impor." },
  { topik: "Harga emas", syarat: re("harga emas|emas (naik|turun|antam|dunia)"), naik: re("naik|melonjak|rekor"), turun: re("turun|anjlok|melemah"), ke: "Pilihan investasi pembeli → minat properti sebagai aset",
    naikArah: "netral", turunArah: "netral", naikAlasan: "Emas naik membuat emas bersaing dengan properti sebagai tempat menyimpan uang.", turunAlasan: "Emas turun sedikit mengurangi persaingan investasi dengan properti.", netralAlasan: "Harga emas memberi gambaran pilihan investasi." },
  { topik: "Keputusan pemerintah", syarat: re("(pemerintah|kementerian|menteri|presiden|prabowo|OJK|bank indonesia|BPN|PUPR|PKP|aturan|peraturan|regulasi|kebijakan|perpres|permen|keputusan).*(rumah|properti|perumahan|hunian|KPR|FLPP|Tapera|rusun|3 juta rumah|HGB|PBG|IMB)|(rumah|properti|perumahan|hunian|KPR|FLPP|Tapera|rusun|3 juta rumah|HGB|PBG|IMB).*(pemerintah|kementerian|menteri|presiden|prabowo|OJK|bank indonesia|BPN|PUPR|PKP|aturan|peraturan|regulasi|kebijakan|perpres|permen|keputusan)"), naik: re("insentif|stimulus|program|diperpanjang|dipermudah|dilonggarkan|ditambah|bebas|dipercepat|percepatan|gratis|kuota|dukung|diluncurkan|resmi"), turun: re("dibatasi|dicabut|dihentikan|diperketat|moratorium|dipangkas|dilarang|pembatasan|ditunda|dikurangi"), ke: "Aturan dan program pemerintah → pembeli, harga, dan syarat jual",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "Program atau kemudahan baru dari pemerintah memperluas kelompok pembeli atau meringankan biaya.", turunAlasan: "Pembatasan atau penundaan kebijakan mempersempit pembeli atau menambah biaya.", netralAlasan: "Keputusan pemerintah soal properti perlu dibaca isinya: bisa mengubah syarat jual, pajak, atau pembiayaan." },
  { topik: "Harga", syarat: re("harga (rumah|properti|tanah)|indeks harga"), naik: re("naik|melonjak|mahal"), turun: re("turun|murah|melemah"), ke: "Daya beli dan diskon → konversi UTJ",
    naikArah: "netral", turunArah: "netral", naikAlasan: "Harga naik mengangkat nilai penjualan tetapi menyulitkan daya beli; baca bersama rasio harga terhadap upah di atas.", turunAlasan: "Harga turun membantu daya beli tetapi menekan margin; baca bersama diskon di halaman Marketing.", netralAlasan: "Pergerakan harga memengaruhi daya beli dan diskon." },
  { topik: "Penjualan pasar", syarat: re("penjualan (rumah|properti)|permintaan|sektor properti|pasar properti"), naik: re("naik|tumbuh|meningkat|menguat|pulih|bangkit"), turun: re("turun|melemah|lesu|menurun|anjlok|tertekan|lemah"), ke: "Sentimen pasar → arus leads dan UTJ",
    naikArah: "mendukung", turunArah: "menekan", naikAlasan: "Permintaan pasar yang menguat biasanya menambah leads dan UTJ.", turunAlasan: "Pasar yang melemah biasanya mengurangi leads dan UTJ.", netralAlasan: "Kondisi pasar properti memberi konteks arus leads." },
];

/** Dampak sebuah berita menurut kata kunci judul: sampai 2 pengaruh. Hasilnya hipotesis, bukan ramalan. */
export function analisaDampak(judul: string): Dampak[] {
  const out: Dampak[] = [];
  for (const a of ATURAN) {
    if (!a.syarat.test(judul)) continue;
    if (a.topik === "KPR" && out.some((o) => o.topik === "Suku bunga")) continue; // berita bunga sudah mencakup dampaknya ke KPR
    const n = a.naik?.test(judul), t = a.turun?.test(judul);
    // bila dua arah cocok, pilih yang kata kuncinya muncul lebih dulu (ukuran kasar)
    let arah: Arah = a.dasar ?? "netral", alasan = a.netralAlasan;
    if (n && t) { const i = judul.search(a.naik!), j = judul.search(a.turun!); if (i <= j) { arah = a.naikArah; alasan = a.naikAlasan; } else { arah = a.turunArah; alasan = a.turunAlasan; } }
    else if (n) { arah = a.naikArah; alasan = a.naikAlasan; }
    else if (t) { arah = a.turunArah; alasan = a.turunAlasan; }
    out.push({ topik: a.topik, arah, ke: a.ke, alasan });
    if (out.length >= 2) break;
  }
  // pengaruh pasar yang netral tidak perlu tampil bila sudah ada pengaruh yang lebih spesifik
  return out.some((o) => o.arah !== "netral") ? out.filter((o) => !(o.topik === "Penjualan pasar" && o.arah === "netral")) : out;
}

export interface RingkasDampak { jumlah: Record<Arah, number>; tanpaDampak: number; perTopik: { topik: string; n: number; arah: Arah }[] }
/** Ringkasan dari banyak berita: berapa yang mendukung, menekan, netral, dan topik yang paling sering muncul. */
export function ringkasDampak(daftar: { dampak: Dampak[] }[]): RingkasDampak {
  const jumlah: Record<Arah, number> = { mendukung: 0, menekan: 0, netral: 0 };
  const topik = new Map<string, { n: number; m: number; k: number }>();
  let tanpa = 0;
  for (const b of daftar) {
    if (!b.dampak.length) { tanpa++; continue; }
    const utama = b.dampak.find((d) => d.arah !== "netral") ?? b.dampak[0];
    jumlah[utama.arah]++;
    for (const d of b.dampak) { const e = topik.get(d.topik) ?? { n: 0, m: 0, k: 0 }; e.n++; if (d.arah === "mendukung") e.m++; if (d.arah === "menekan") e.k++; topik.set(d.topik, e); }
  }
  const perTopik = [...topik].map(([t, e]) => ({ topik: t, n: e.n, arah: (e.m > e.k ? "mendukung" : e.k > e.m ? "menekan" : "netral") as Arah })).sort((a, b) => b.n - a.n);
  return { jumlah, tanpaDampak: tanpa, perTopik };
}
