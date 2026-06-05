import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

/**
 * Middleware Supabase: refresca la sesión en cada navegación.
 * Sin esto, las cookies de sesión expiran y los Server Components
 * empiezan a recibir `user = null` aleatoriamente.
 *
 * Patrón recomendado oficial: https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: getUser() es lo que dispara el refresh de cookies.
  // No quitar esta línea.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - Files con extensión (svg, png, jpg, jpeg, gif, webp, woff, woff2, ttf, otf, css, js)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ttf|otf|css|js)$).*)',
  ],
}
