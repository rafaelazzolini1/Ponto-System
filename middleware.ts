import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_VALIDITY_MS = 1 * 60 * 1000; // 10 minutos

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const token = req.cookies.get("firebaseToken")?.value;
  const tokenTimestamp = req.cookies.get("tokenTimestamp")?.value;

  if (!token || !tokenTimestamp) {
    console.log("❌ Nenhum token encontrado, redirecionando para /login");
    if (url.pathname !== "/login") {
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Verificar se o token expirou (10 minutos)
  const now = new Date().getTime();
  const tokenAge = now - parseInt(tokenTimestamp);
  
  if (tokenAge > TOKEN_VALIDITY_MS) {
    console.log("❌ Token expirado, redirecionando para /login");
    const response = NextResponse.redirect(url);
    response.cookies.delete("firebaseToken");
    response.cookies.delete("tokenTimestamp");
    response.cookies.delete("cpf");
    url.pathname = "/login";
    return NextResponse.redirect(url);
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
    const response = NextResponse.redirect(url);
    response.cookies.delete("firebaseToken");
    response.cookies.delete("tokenTimestamp");
    response.cookies.delete("cpf");
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/", "/login", "/ponto", "/ponto/:path*"],
};