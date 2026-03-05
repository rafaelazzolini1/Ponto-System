// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { validateCsrf } from "@/lib/csrf";
import { rateLimit } from "@/lib/rate-limit";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

// Extrai o IP real da requisição (Vercel passa no header x-forwarded-for)
function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  // ── 1. Rate Limiting ──────────────────────────────────────────────────────
  // Máximo de 10 tentativas de login por IP a cada 15 minutos
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

  // ── 2. CSRF Validation ────────────────────────────────────────────────────
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json(
      { error: "Token CSRF inválido ou ausente." },
      { status: 403 }
    );
  }

  // ── 3. Criação da sessão ──────────────────────────────────────────────────
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

    return NextResponse.json({
      ok: true,
      remaining: rl.remaining, // informa tentativas restantes
    });
  } catch (error) {
    console.error("Erro ao criar sessão:", error);
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }
}

export async function DELETE(req: NextRequest) {
  // CSRF também protege o logout
  const csrfValid = await validateCsrf(req);
  if (!csrfValid) {
    return NextResponse.json(
      { error: "Token CSRF inválido." },
      { status: 403 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.delete("session");
  cookieStore.delete("cpf");
  return NextResponse.json({ ok: true });
}