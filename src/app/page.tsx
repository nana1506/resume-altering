import Link from 'next/link';
import { Sparkles, CheckCircle2, ArrowRight, Upload, Wand2, Download, ShieldCheck, FileCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto pt-6 sm:pt-12 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Tailor your CV for ATS screening in seconds</span>
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
          Land more interviews with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">AI-matched CVs</span>
        </h1>

        <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Upload your existing CV and target job description. Google Gemini discovers skill gaps, suggests bullet-by-bullet enhancements in an interactive checklist, and generates a polished ATS-friendly PDF.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 text-base group"
          >
            <span>Get Started for Free</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium transition-colors flex items-center justify-center text-base shadow-sm"
          >
            Sign In to Account
          </Link>
        </div>
      </section>

      {/* 3-Step Process Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <div className="glass-card p-6 rounded-2xl space-y-3 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg text-slate-900">1. Upload & Paste</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Upload your PDF/DOCX resume and paste the vacancy text. Our parser extracts clean sections automatically.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-3 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-lg">
            <Wand2 className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg text-slate-900">2. Review Suggestions</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Check or uncheck Gemini suggestions. Click to edit bullet points inline without losing control.
          </p>
        </div>

        <div className="glass-card p-6 rounded-2xl space-y-3 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            <Download className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-lg text-slate-900">3. Download PDF</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Only approved changes are incorporated into an ATS-friendly, clean PDF with signed storage download.
          </p>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="glass-panel p-8 sm:p-10 rounded-3xl max-w-4xl mx-auto border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Precise & Non-Destructive</h4>
              <p className="text-xs text-slate-600 mt-1">Never rewrites your entire background. Only suggests targeted keyword alignments.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Interactive Checklist UI</h4>
              <p className="text-xs text-slate-600 mt-1">Full control over every change. Edit inline with optimistic real-time sync.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Enterprise Security (RLS)</h4>
              <p className="text-xs text-slate-600 mt-1">All documents and applications are secured by Supabase Row-Level Security.</p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Powered by Gemini AI</h4>
              <p className="text-xs text-slate-600 mt-1">Deep semantic analysis maps qualifications to required vacancy keywords.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
