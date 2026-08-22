import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/new') ||
    pathname.startsWith('/applications') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/admin');
  const isAuthPath = pathname === '/login' || pathname === '/register';

  // Check if any supabase auth cookie is present
  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some((c) =>
    c.name.includes('sb-') || c.name.includes('supabase') || c.name.includes('auth-token')
  );

  // Fast path: Unauthenticated user visiting public page (no remote network round-trip)
  if (!hasAuthCookie && !isProtectedPath && !isAuthPath) {
    return supabaseResponse;
  }

  // Fast path: Unauthenticated user visiting protected route -> redirect immediately
  if (!hasAuthCookie && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Only refresh token / check user over the network if auth cookie exists or is on protected/auth path
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth token
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
