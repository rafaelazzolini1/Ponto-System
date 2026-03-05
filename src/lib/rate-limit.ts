// lib/rate-limit.ts
// Rate limiter em memória — funciona para um único servidor/instância.
// Para múltiplas instâncias em produção, substitua pelo Redis (Upstash, etc).

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  limit: number;      // máximo de requisições
  windowMs: number;   // janela de tempo em ms
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  // Janela expirou ou entrada nova — reseta
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(key, newEntry);
    return { success: true, remaining: limit - 1, resetAt: newEntry.resetAt };
  }

  // Dentro da janela — incrementa
  entry.count += 1;
  store.set(key, entry);

  const remaining = Math.max(0, limit - entry.count);
  const success = entry.count <= limit;

  return { success, remaining, resetAt: entry.resetAt };
}