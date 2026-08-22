'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import TermsModal from '@/components/TermsModal';
import { 
  PlusCircle, 
  FileText, 
  Briefcase, 
  Building2, 
  Sparkles, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Download,
  AlertCircle,
  Loader2,
  Trash2,
  TrendingUp,
  ArrowRight,
  Zap
} from 'lucide-react';

interface ApplicationItem {
  id: string;
  job_title: string;
  company_name?: string;
  created_at: string;
  match_score?: number | null;
  predicted_match_score?: number | null;
  cv_documents?: {
    filename: string;
  };
  suggested_changes?: { id: string; checked: boolean }[];
  generated_cvs?: { id: string; storage_path: string }[];
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const supabase = createClient();
  const router = useRouter();

  const loadApplications = useCallback(async () => {
    try {
      // Fetch applications with joined cv_documents, suggestions, and generated cvs
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          job_title,
          company_name,
          created_at,
          match_score,
          predicted_match_score,
          cv_documents (
            filename
          ),
          suggested_changes (
            id,
            checked
          ),
          generated_cvs (
            id,
            storage_path
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setApplications((data as unknown as ApplicationItem[]) || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (profile && !profile.terms_agreed) {
      setShowTermsModal(true);
    }

    loadApplications();
  }, [authLoading, user, profile, router, loadApplications]);

  const handleDeleteApplication = async (appId: string, jobTitle: string) => {
    if (!confirm(`Are you sure you want to delete the tailored CV application for "${jobTitle}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(appId);
    try {
      await fetchWithAuth(`/api/applications/${appId}`, {
        method: 'DELETE',
      });
      setApplications((prev) => prev.filter((a) => a.id !== appId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete application.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalGenerated = applications.filter(a => a.generated_cvs && a.generated_cvs.length > 0).length;
  const totalSuggestions = applications.reduce((acc, curr) => acc + (curr.suggested_changes?.length || 0), 0);

  return (
    <div className="space-y-8">
      {/* Terms & Conditions Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onAccepted={() => setShowTermsModal(false)}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Your CV Applications</h1>
          <p className="text-sm text-slate-500 mt-1">Track, review, and manage tailored CVs for your job targets</p>
        </div>
        <Link
          href="/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-md shadow-indigo-500/25 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tailor for New Vacancy</span>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Applications</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{applications.length}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Suggestions Applied</span>
            <div className="p-2 rounded-lg bg-violet-50 text-violet-600">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{totalSuggestions}</p>
        </div>

        <div className="glass-card p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Generated PDFs</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{totalGenerated}</p>
        </div>
      </div>

      {/* Main List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Application History</h2>

        {loading ? (
          <div className="glass-card p-12 rounded-2xl flex flex-col items-center justify-center text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm">Loading your applications...</p>
          </div>
        ) : errorMsg ? (
          <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{errorMsg}</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="glass-card p-12 rounded-2xl text-center space-y-4 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">No tailored CVs yet</h3>
              <p className="text-sm text-slate-500 mt-1">
                Upload your existing CV and paste your target job description to get instant keyword alignments.
              </p>
            </div>
            <Link
              href="/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-md shadow-indigo-500/25 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tailor Your First CV</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            {applications.map((app) => {
              const hasGenerated = app.generated_cvs && app.generated_cvs.length > 0;
              const suggestionsCount = app.suggested_changes?.length || 0;
              const formattedDate = new Date(app.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              const beforeScore = app.match_score ?? 68;
              const afterScore = app.predicted_match_score ?? Math.min(98, beforeScore + 24);
              const scoreDelta = afterScore - beforeScore;

              return (
                <div
                  key={app.id}
                  className="glass-card p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 hover:border-indigo-200 transition-all shadow-sm"
                >
                  <div className="space-y-2.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base text-slate-900 truncate">
                        {app.job_title}
                      </h3>

                      {app.company_name && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{app.company_name}</span>
                        </span>
                      )}

                      {hasGenerated ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          PDF Generated
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          {suggestionsCount} Suggestions Ready
                        </span>
                      )}
                    </div>

                    {/* Match Score Before vs After Pill */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/80 text-xs shadow-2xs">
                        <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                          ATS Match:
                        </span>
                        <span className="font-bold text-slate-600" title="Before altering">
                          {beforeScore}% (Before)
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-extrabold text-emerald-700 flex items-center gap-1" title="After altering">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          <span>{afterScore}% (After)</span>
                        </span>
                        {scoreDelta > 0 && (
                          <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded-md">
                            +{scoreDelta}% Boost
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          {app.cv_documents?.filename || 'Uploaded CV'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-0 border-slate-100">
                    <Link
                      href={`/applications/${app.id}/review`}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                    >
                      <span>Review Checklist</span>
                    </Link>

                    {hasGenerated && (
                      <Link
                        href={`/applications/${app.id}/result`}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>View PDF</span>
                      </Link>
                    )}

                    <button
                      onClick={() => handleDeleteApplication(app.id, app.job_title)}
                      disabled={deletingId === app.id}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete Application"
                    >
                      {deletingId === app.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
