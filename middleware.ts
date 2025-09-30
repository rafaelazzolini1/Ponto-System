import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

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
    await getAuth().verifyIdToken(token);
    console.log("✅ Token válido no middleware");

    if (url.pathname === "/login") {
      url.pathname = "/ponto";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  } catch (error) {
    console.error("❌ Erro ao validar token:", error);
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ["/", "/login", "/ponto", "/ponto/:path*"],
};

