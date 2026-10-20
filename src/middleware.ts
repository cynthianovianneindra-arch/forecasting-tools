import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, putusanAkses, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const sesi = await verifySession(req.cookies.get(COOKIE)?.value, process.env.SESSION_SECRET);
  const { pathname, search } = req.nextUrl;
  const v = putusanAkses({ path: pathname, method: req.method, sesi, adaAuthHeader: !!req.headers.get("authorization") });
  if (v === "izinkan") return NextResponse.next();
  if (v === "401") return NextResponse.json({ error: "Perlu login" }, { status: 401 });
  if (v === "403") return pathname.startsWith("/api/") ? NextResponse.json({ error: "Hanya untuk admin" }, { status: 403 }) : new NextResponse("Akses ditolak: halaman ini hanya untuk admin.", { status: 403 });
  const u = req.nextUrl.clone();
  u.pathname = "/login";
  u.search = "";
  if (pathname !== "/") u.searchParams.set("next", pathname + search);
  return NextResponse.redirect(u);
}

export const config = { matcher: ["/((?!_next/static|_next/image|icon.png|logo.png|login-bg.jpg|favicon.ico).*)"] };
