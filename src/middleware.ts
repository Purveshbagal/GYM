import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Flutter Web runs on its own dev-server origin (a random localhost port
 * per run), so every /api/* call from the browser is cross-origin and gets
 * blocked without these headers — the browser sends an OPTIONS preflight
 * first and refuses the real request unless that preflight succeeds.
 * Android/iOS builds aren't browsers and don't need this, but it's a no-op
 * for them either way.
 */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export function middleware(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: corsHeaders() });
  }

  const res = NextResponse.next();
  for (const [key, value] of Object.entries(corsHeaders())) {
    res.headers.set(key, value);
  }
  return res;
}

export const config = {
  matcher: "/api/:path*",
};
