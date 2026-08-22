'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight, KeyRound, Check } from 'lucide-react';

function SetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    async function initSessionFromUrl() {
      try {
        // 1. Check for URL query params errors
        const queryError = searchParams?.get('error_description') || searchParams?.get('error');
        if (queryError) {
          setErrorMsg(decodeURIComponent(queryError.replace(/\+/g, ' ')));
        }

        // 2. Check for PKCE flow 'code' query parameter
        const code = searchParams?.get('code');
        if (code) {
          const { data: codeData, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (!codeErr && codeData?.session) {
            setUserEmail(codeData.session.user.email ?? null);
            setErrorMsg(null);
            setInitializing(false);
            return;
          }
        }

        // 3. Check for Implicit flow hash tokens (#access_token=...&refresh_token=...)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hash = window.location.hash.substring(1);
          const params = new URLSearchParams(hash);
          
          const hashError = params.get('error_description') || params.get('error');
          if (hashError) {
            setErrorMsg(decodeURIComponent(hashError.replace(/\+/g, ' ')));
          }

          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data: hashData, error: hashErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!hashErr && hashData?.session) {
              setUserEmail(hashData.session.user.email ?? null);
              setErrorMsg(null);
              setInitializing(false);
              return;
            } else if (hashErr) {
              console.error('Error setting session from hash:', hashErr);
            }
          }
        }

        // 4. Check existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          setUserEmail(session.user.email ?? null);
        }
      } catch (err: any) {
        console.error('Session initialization error:', err);
      } finally {
        setInitializing(false);
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        setUserEmail(session.user.email ?? null);
        setErrorMsg(null);
      }
    });

    initSessionFromUrl();

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, searchParams]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // If session is missing, re-try parsing URL hash before updating
      let { data: { session } } = await supabase.auth.getSession();
      
      if (!session && typeof window !== 'undefined' && window.location.hash) {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const res = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          session = res.data?.session ?? null;
        }
      }

      if (!session) {
        throw new Error('Authentication session is missing or expired. Please use the direct invite link sent to your email.');
      }

      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      // Transition profile status from 'invited' to 'active'
      try {
        if (session.user?.id) {
          await supabase
            .from('profiles')
            .update({ status: 'active' })
            .eq('id', session.user.id);
        }
      } catch (profileErr) {
        console.warn('Could not update profile status to active:', profileErr);
      }

      setSuccessMsg('Your password has been set successfully! Redirecting to your dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1200);
    } catch (err: any) {
      console.error('Set password error:', err);
      setErrorMsg(err.message || 'Failed to set password. Your invite link may have expired or is invalid.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/50 space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Set Your Account Password</h1>
        <p className="text-sm text-slate-500">
          {userEmail ? (
            <span>Setting password for <strong className="text-slate-800">{userEmail}</strong></span>
          ) : (
            <span>Welcome to CV Tailor! Choose a secure password for your invited account</span>
          )}
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm space-y-2">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="flex-1 font-medium">{errorMsg}</p>
          </div>
          {errorMsg.toLowerCase().includes('expired') || errorMsg.toLowerCase().includes('missing') || errorMsg.toLowerCase().includes('invalid') ? (
            <p className="text-xs text-rose-600 pl-7">
              Invitation links expire for security. Please ask the administrator to re-invite you, or{' '}
              <Link href="/request-access" className="underline font-semibold">
                request access again
              </Link>.
            </p>
          ) : null}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1 font-medium">{successMsg}</p>
        </div>
      )}

      <form onSubmit={handleSetPassword} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            New Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || initializing}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Password...</span>
            </>
          ) : (
            <>
              <span>Save Password & Access App</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="text-xs text-slate-500 hover:text-slate-700 font-medium inline-flex items-center gap-1"
        >
          <span>Already have a password? Sign in instead</span>
        </Link>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center py-8">
      <Suspense
        fallback={
          <div className="p-12 text-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-sm">Loading security verification...</p>
          </div>
        }
      >
        <SetPasswordForm />
      </Suspense>
    </div>
  );
}
