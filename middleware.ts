import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const token = req.cookies.get("firebaseToken")?.value;

  if (!token) {
    console.log("❌ Nenhum token encontrado, redirecionando para /login");
    if (url.pathname !== "/login") {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/verify-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    if (response.ok) {
      console.log("✅ Token válido no middleware");
      if (url.pathname === "/login") {
        url.pathname = "/ponto";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    } else {
      throw new Error("Token inválido");
    }
  } catch (error) {
    console.error("❌ Erro ao validar token:", error);
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/", "/login", "/ponto", "/ponto/:path*"],
};