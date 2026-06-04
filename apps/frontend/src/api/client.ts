export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined && init?.body !== null && init.body !== '';

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const storedLocale = localStorage.getItem('metrixify_locale');
  if (storedLocale === 'uk' || storedLocale === 'en') {
    headers.set('Accept-Language', storedLocale);
  }

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}
