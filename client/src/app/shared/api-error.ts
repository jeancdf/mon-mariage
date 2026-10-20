export function apiError(error: unknown, fallback: string): string {
  const message = (error as { error?: { message?: unknown } })?.error?.message;
  return typeof message === 'string' ? message : Array.isArray(message) ? message.filter(item => typeof item === 'string').join(' ') || fallback : fallback;
}
