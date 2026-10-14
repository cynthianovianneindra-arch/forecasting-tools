const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const labelBulan = (b: string) => `${BLN[+b.slice(5) - 1]} ${b.slice(2, 4)}`;
export const labelPanjang = (b: string) => `${BLN[+b.slice(5) - 1]} ${b.slice(0, 4)}`;
export const f1 = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
