import "./globals.css";
export const metadata = { title: "Forecast Penjualan", description: "Proyeksi UTJ, akad, dan penerimaan Shaistanaya City" };
export default function Root({ children }: { children: React.ReactNode }) {
  return (<html lang="id"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" /></head><body>{children}</body></html>);
}
