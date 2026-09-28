// frontend/middleware.js
// Protection "bêta privée" par Basic Auth.
// Active uniquement si BASIC_AUTH_USER et BASIC_AUTH_PASSWORD sont définis
// (plus d'identifiants par défaut : admin/changeme était devinable).

import { NextResponse } from 'next/server';

export function middleware(request) {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  const ALLOWED_USER = process.env.BASIC_AUTH_USER;
  const ALLOWED_PASSWORD = process.env.BASIC_AUTH_PASSWORD;

  // Variables absentes : le site est public
  if (!ALLOWED_USER || !ALLOWED_PASSWORD) {
    return NextResponse.next();
  }

  const basicAuth = request.headers.get('authorization');

  if (basicAuth?.startsWith('Basic ')) {
    try {
      const decoded = atob(basicAuth.slice(6));
      const sep = decoded.indexOf(':');
      const user = decoded.slice(0, sep);
      const pwd = decoded.slice(sep + 1); // le mot de passe peut contenir ":"

      if (sep > -1 && user === ALLOWED_USER && pwd === ALLOWED_PASSWORD) {
        return NextResponse.next();
      }
    } catch {
      // en-tête mal formé : on redemande l'authentification
    }
  }

  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Nauticash - Private Beta"',
    },
  });
}

// Protège toutes les routes sauf les fichiers statiques, les icônes, l'image de partage
// et robots.txt (qui demande aux robots de ne rien indexer pendant la bêta privée)
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|logo_nauticash.webp|robots.txt|icon.png|apple-icon.png|opengraph-image.png).*)',
  ],
};
