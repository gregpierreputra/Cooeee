import { ipAddress, rewrite } from '@vercel/functions';

// Vercel Routing Middleware: the only way to the API. Every /api request is
// forwarded to the Railway server with two headers the caller cannot write:
// the secret both sides hold in PROXY_SECRET, and the client address Vercel
// measured itself. The server refuses any request without the secret, so
// calling Railway directly, or inventing an address, gains nothing.

const API_ORIGIN = 'https://cooeee-production.up.railway.app';

export const config = { matcher: '/api/:path*' };

export default function middleware(request: Request): Response {
  const secret = process.env.PROXY_SECRET;
  // Without the secret the server would refuse every request, so say so here.
  if (!secret) return Response.json({ error: 'unavailable' }, { status: 503 });
  const { pathname, search } = new URL(request.url);
  const headers = new Headers(request.headers);
  headers.set('x-cooeee-proxy', secret);
  headers.set('x-cooeee-client', ipAddress(request) ?? '');
  return rewrite(new URL(pathname + search, API_ORIGIN), { request: { headers } });
}
