'use client';

import { useState } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { ShieldCheck, Check, AlertCircle, Loader2, FileText } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onAccepted: () => void;
}

export default function TermsModal({ isOpen, onAccepted }: TermsModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAccept = async () => {
    if (!agreed) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      await fetchWithAuth('/api/user/accept-terms', {
        method: 'POST',
      });
      onAccepted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record terms acceptance.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Terms & Data Policy</h2>
            <p className="text-xs text-slate-500">Please review before continuing to CV Tailor</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Policy Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2.5 max-h-48 overflow-y-auto">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            Data Storage & AI Processing Agreement
          </p>
          <p>
            By using CV Tailor, you acknowledge and agree that your uploaded curriculum vitae documents, job descriptions, and user profile information are securely stored in our cloud infrastructure (Supabase) and processed via Google Gemini AI to generate customized keyword recommendations and PDF resumes.
          </p>
          <p>
            • Your data is protected under Row-Level Security policies and is accessible only to you and authorized system administrators.
          </p>
          <p>
            • You retain full ownership of your documents and can permanently delete your job application histories at any time.
          </p>
        </div>

        {/* Checkbox agreement */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <span className="text-xs text-slate-700 select-none group-hover:text-slate-900 leading-relaxed font-medium">
            I agree to the Terms & Conditions and acknowledge that my resume data is stored and managed by CV Tailor for AI matching.
          </span>
        </label>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={!agreed || loading}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Recording agreement...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Agree & Continue to App</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
