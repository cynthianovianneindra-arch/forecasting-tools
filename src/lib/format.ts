const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const labelBulan = (b: string) => `${BLN[+b.slice(5) - 1]} ${b.slice(2, 4)}`;
export const labelPanjang = (b: string) => `${BLN[+b.slice(5) - 1]} ${b.slice(0, 4)}`;
export const f1 = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const BLN_PENUH = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const labelPenuh = (b: string) => `${BLN_PENUH[+b.slice(5) - 1]} ${b.slice(0, 4)}`;
/** Label sumbu hanya tiap 3 bulan (Jan, Apr, Jul, Okt) agar tidak padat. */
export const tampilLabel = (b: string) => [1, 4, 7, 10].includes(+b.slice(5));
