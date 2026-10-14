"use client";

/** Membuka dialog cetak browser dengan nama file yang sudah terisi; pilih "Simpan sebagai PDF" (tujuan/destination). */
export function UnduhPdf({ nama }: { nama: string }) {
  const unduh = () => {
    const judul = document.title;
    document.title = nama;
    const pulih = () => { document.title = judul; window.removeEventListener("afterprint", pulih); };
    window.addEventListener("afterprint", pulih);
    window.print();
  };
  return <button className="btn" type="button" onClick={unduh}>Unduh PDF</button>;
}
