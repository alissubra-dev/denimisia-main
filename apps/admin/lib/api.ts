const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function adminFetch<T>(
  path: string,
  token?: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${path}`, {
    // Admin data must always be fresh. Without this the browser caches GET
    // responses (they carry an ETag and no `no-store`), so edits like a
    // deleted variant kept showing the old copy across reloads even though
    // the API returned the updated data.
    cache: 'no-store',
    ...options,
    headers,
  });

  // Handle empty responses (e.g., DELETE returns 204 No Content)
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }

  if (!res.ok) {
    let body = {};
    try {
      body = JSON.parse(text);
    } catch {}
    throw new Error((body as { message?: string }).message ?? `API error ${res.status}`);
  }

  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    // Return the text as-is if not JSON
    return text as unknown as T;
  }
  return (json as { data?: T }).data ?? json as T;
}

export async function adminPost<T>(
  path: string,
  body: unknown,
  token?: string,
): Promise<T> {
  return adminFetch<T>(path, token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
