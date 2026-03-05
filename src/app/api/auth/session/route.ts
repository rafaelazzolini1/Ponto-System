// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  // Rate limiting: máximo 10 tentativas por IP a cada 15 minutos
  const ip = getIp(req);
  const rl = rateLimit(`login:${ip}`, { limit: 10, windowMs: 15 * 60 * 1000 });

  if (!rl.success) {
    const retryAfterSec = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Muitas tentativas de login. Aguarde alguns minutos." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rl.resetAt),
        },
      }
    );
  }

  const { token, cpf } = await req.json();

  if (!token || !cpf) {
    return NextResponse.json(
      { error: "Token ou CPF não fornecido" },
      { status: 401 }
    );
  }

  try {
    await adminAuth.verifyIdToken(token);

    const sessionCookie = await adminAuth.createSessionCookie(token, {
      expiresIn: FIVE_MINUTES_MS,
    });

    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";

    cookieStore.set("session", sessionCookie, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: FIVE_MINUTES_MS / 1000,
      path: "/",
    });

    cookieStore.set("cpf", cpf, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: FIVE_MINUTES_MS / 1000,
      path: "/",
    });

    return NextResponse.json({ ok: true, remaining: rl.remaining });
  } catch (error) {
    console.error("Erro verifyIdToken:", error); // veja o log na Vercel
  return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  cookieStore.delete("cpf");
  return NextResponse.json({ ok: true });
}