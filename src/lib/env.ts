/**
 * Lazy env access. Call inside functions (never at module top-level) so a
 * missing value fails at runtime where it is used, not at build/import time.
 */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export function optionalEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}
