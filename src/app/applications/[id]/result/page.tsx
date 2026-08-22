'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/api';
import { 
  CheckCircle2, 
  Download, 
  ArrowLeft, 
  FileText, 
  ExternalLink, 
  Sparkles, 
  AlertCircle, 
  Loader2,
  RefreshCw
} from 'lucide-react';

interface GeneratedCV {
  id: string;
  storage_path: string;
  preview_url?: string;
  download_url: string;
  filename?: string;
  created_at: string;
}

interface ApplicationData {
  id: string;
  job_title: string;
  cv_documents?: {
    filename: string;
  };
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params?.id as string;

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [latestCV, setLatestCV] = useState<GeneratedCV | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadResult() {
      if (!applicationId) return;
      try {
        const data = await fetchWithAuth(`/api/applications/${applicationId}`);
        setApplication(data.application);
        const cvs = data.generated_cvs || [];
        if (cvs.length > 0) {
          setLatestCV(cvs[0]);
        } else {
          setErrorMsg('No generated CV found for this application. Please generate one from the checklist.');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load generated CV.');
      } finally {
        setLoading(false);
      }
    }

    loadResult();
  }, [applicationId]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Loading tailored CV preview...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Navigation & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/applications/${applicationId}/review`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Checklist Review</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Tailored CV Ready</span>
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </h1>
          <p className="text-sm text-slate-500">
            Target: <strong className="text-slate-800">{application?.job_title}</strong>
          </p>
        </div>

        {latestCV?.download_url && (
          <a
            href={latestCV.download_url}
            target="_blank"
            rel="noopener noreferrer"
            download={latestCV.filename || 'CV.pdf'}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Tailored PDF</span>
          </a>
        )}
      </div>

      {errorMsg ? (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p>{errorMsg}</p>
            <Link
              href={`/applications/${applicationId}/review`}
              className="inline-flex items-center gap-1 font-semibold text-rose-800 hover:underline"
            >
              <span>Go to review checklist</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PDF Preview Container */}
          <div className="lg:col-span-2 glass-card rounded-3xl p-4 overflow-hidden border border-slate-200 shadow-md">
            <div className="bg-slate-100 rounded-2xl overflow-hidden h-[680px] flex items-center justify-center relative border border-slate-200">
              {latestCV?.preview_url || latestCV?.download_url ? (
                <iframe
                  src={`${latestCV.preview_url || latestCV.download_url}#toolbar=0&navpanes=0`}
                  title="Tailored CV PDF Preview"
                  className="w-full h-full border-0 rounded-2xl"
                />
              ) : (
                <div className="text-center space-y-3 p-6 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto text-slate-400" />
                  <p className="text-sm font-medium">Preview unavailable directly in browser.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Actions & Info */}
          <div className="space-y-5">
            {/* Quick Actions Card */}
            <div className="glass-card p-6 rounded-3xl space-y-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Download & Actions</span>
              </h3>

              {latestCV?.download_url && (
                <a
                  href={latestCV.download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={latestCV.filename || 'CV.pdf'}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF Document</span>
                </a>
              )}

              <Link
                href={`/applications/${applicationId}/review`}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Adjust Suggestions</span>
              </Link>

              <Link
                href="/new"
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>Tailor Another Job Vacancy</span>
              </Link>
            </div>

            {/* ATS Optimization Note */}
            <div className="glass-card p-6 rounded-3xl space-y-3 border-indigo-100">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-indigo-900">
                ATS Compatibility Note
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                This PDF is structured using standard single-column ATS typography, high-contrast formatting, and semantic section tags to ensure maximum parsing fidelity in Greenhouse, Lever, Workday, and Taleo.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
