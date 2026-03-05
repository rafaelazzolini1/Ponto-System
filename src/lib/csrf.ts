// lib/csrf.ts
import { NextRequest } from "next/server";

const CSRF_SECRET = process.env.CSRF_SECRET || "csrf-secret-dev";

export function generateCsrfToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2);
  return `${timestamp}.${random}.${Buffer.from(CSRF_SECRET).toString("base64")}`;
}

export async function validateCsrf(req: NextRequest): Promise<boolean> {
  // Em desenvolvimento, pula a validação CSRF para facilitar testes
  if (process.env.NODE_ENV !== "production") return true;

  const token =
    req.headers.get("x-csrf-token") ||
    req.headers.get("csrf-token");

  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const expectedBase64 = Buffer.from(CSRF_SECRET).toString("base64");
  return parts[2] === expectedBase64;
}