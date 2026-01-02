// frontend/middleware.js
// Place ce fichier à la RACINE du dossier frontend (à côté de app/)

import { NextResponse } from 'next/server';

export function middleware(request) {
  // 🔓 DÉSACTIVE la protection en développement local
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  // 🔒 ACTIVE la protection en production
  const ALLOWED_USER = process.env.BASIC_AUTH_USER || 'admin';
  const ALLOWED_PASSWORD = process.env.BASIC_AUTH_PASSWORD || 'changeme';

  // Vérifie si l'en-tête Authorization est présent
  const basicAuth = request.headers.get('authorization');

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1];
    
    try {
      const [user, pwd] = atob(authValue).split(':');

      // Vérifie les credentials
      if (user === ALLOWED_USER && pwd === ALLOWED_PASSWORD) {
        return NextResponse.next();
      }
    } catch (error) {
      // En cas d'erreur de décodage, demande l'authentification
    }
  }

  // Si pas d'auth ou mauvais credentials, demande l'authentification
  return new Response('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Nauticash - Private Beta"',
    },
  });
}

// Configuration : protège toutes les routes
export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};