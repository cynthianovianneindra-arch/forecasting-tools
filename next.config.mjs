export default {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  // berkas Chromium (folder bin) dibaca saat runtime sehingga tidak terdeteksi otomatis; sertakan agar ikut terbawa ke fungsi serverless
  outputFileTracingIncludes: { "/api/laporan/pdf": ["./node_modules/@sparticuz/chromium/bin/**"] },
};
