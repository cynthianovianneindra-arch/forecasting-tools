import { cookieHapus, isSecure } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return new Response(null, { status: 303, headers: { Location: new URL("/login", req.url).toString(), "Set-Cookie": cookieHapus(isSecure(req)) } });
}
