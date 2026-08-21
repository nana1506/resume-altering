'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchWithAuth } from '@/lib/api';
import { Sparkles, PlusCircle, LogOut, LayoutDashboard, User, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    async function checkUser() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          try {
            const profile = await fetchWithAuth('/api/user/profile');
            setIsAdmin(profile.role === 'admin' || profile.email === 'isnan.rizqikurniawan@gmail.com');
          } catch (e) {
            setIsAdmin(currentUser.email === 'isnan.rizqikurniawan@gmail.com');
          }
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      } finally {
        setLoading(false);
      }
    }

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setIsAdmin(currentUser.email === 'isnan.rizqikurniawan@gmail.com');
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/request-access';

  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand Logo */}
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-slate-900 tracking-tight flex items-center gap-1.5">
                CV Tailor
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">
                  AI
                </span>
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">Invitation-Only ATS Matching</span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2 sm:gap-3">
            {!loading && (
              <>
                {user ? (
                  <>
                    {isAdmin && (
                      <Link
                        href="/admin"
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                          pathname === '/admin'
                            ? 'bg-amber-500/10 text-amber-800 border border-amber-300/60'
                            : 'text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span>Admin Panel</span>
                      </Link>
                    )}

                    <Link
                      href="/dashboard"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        pathname === '/dashboard'
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      <LayoutDashboard className="w-4 h-4" />
                      <span className="hidden sm:inline">Dashboard</span>
                    </Link>

                    <Link
                      href="/new"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-500/25 transition-all hover:shadow"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Tailor CV</span>
                    </Link>

                    <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

                    <div className="flex items-center gap-2 pl-1">
                      <div 
                        className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold" 
                        title={`${user.email}${isAdmin ? ' (Admin)' : ''}`}
                      >
                        {user.email ? user.email[0].toUpperCase() : <User className="w-4 h-4" />}
                      </div>

                      <button
                        onClick={handleSignOut}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Sign Out"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  !isAuthPage && (
                    <div className="flex items-center gap-2">
                      <Link
                        href="/login"
                        className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/request-access"
                        className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
                      >
                        Request Access
                      </Link>
                    </div>
                  )
                )}
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
