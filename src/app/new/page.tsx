'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import TermsModal from '@/components/TermsModal';
import { 
  Upload, 
  FileText, 
  Sparkles, 
  Briefcase, 
  Building2,
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  ArrowRight 
} from 'lucide-react';

export default function NewApplicationPage() {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'uploading' | 'creating' | 'analyzing'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (profile && !profile.terms_agreed) {
      setShowTermsModal(true);
    }
  }, [profile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      validateAndSetFile(selectedFile);
    }
  };

  const validateAndSetFile = (f: File) => {
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    const isDocx = f.name.toLowerCase().endsWith('.docx');
    const isPdf = f.name.toLowerCase().endsWith('.pdf');

    if (!validTypes.includes(f.type) && !isDocx && !isPdf) {
      setErrorMsg('Please upload a valid PDF or DOCX resume document.');
      return;
    }

    if (f.size > 10 * 1024 * 1024) {
      setErrorMsg('File size exceeds 10MB limit.');
      return;
    }

    setErrorMsg(null);
    setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('Please select a CV document to upload.');
      return;
    }
    if (!jobTitle.trim()) {
      setErrorMsg('Please provide a target job title.');
      return;
    }
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setErrorMsg('Please paste the complete job vacancy description (at least 20 characters).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // Step 1: Upload CV
      setCurrentStep('uploading');
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetchWithAuth('/api/cv/upload', {
        method: 'POST',
        body: formData,
      });

      const cvDocumentId = uploadRes.cv_document_id;
      if (!cvDocumentId) {
        throw new Error('Could not retrieve CV document ID.');
      }

      // Step 2: Create Job Application record (with company_name)
      setCurrentStep('creating');
      const appRes = await fetchWithAuth('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cv_document_id: cvDocumentId,
          job_title: jobTitle.trim(),
          company_name: companyName.trim() || null,
          job_description_text: jobDescription.trim(),
        }),
      });

      const applicationId = appRes.id;
      if (!applicationId) {
        throw new Error('Failed to create application.');
      }

      // Step 3: Trigger Gemini Suggestion Analysis
      setCurrentStep('analyzing');
      await fetchWithAuth(`/api/applications/${applicationId}/suggest`, {
        method: 'POST',
      });

      // Redirect to review checklist
      router.push(`/applications/${applicationId}/review`);
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMsg(err.message || 'An error occurred during CV tailoring. Please try again.');
      setIsSubmitting(false);
      setCurrentStep('idle');
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-8">
      {/* Terms & Conditions Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onAccepted={() => setShowTermsModal(false)}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-100">
          <Sparkles className="w-3.5 h-3.5" />
          <span>New Optimization</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Tailor Your CV</h1>
        <p className="text-sm text-slate-500 max-w-lg mx-auto">
          Upload your existing CV, specify the target company and position, and paste the vacancy requirements.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{errorMsg}</p>
        </div>
      )}

      {isSubmitting ? (
        <div className="glass-card p-10 sm:p-14 rounded-3xl text-center space-y-6">
          <div className="relative w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-ping opacity-75" />
            <div className="relative w-20 h-20 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-10 h-10 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-slate-900">
              {currentStep === 'uploading' && 'Parsing your CV document...'}
              {currentStep === 'creating' && 'Setting up job profile...'}
              {currentStep === 'analyzing' && 'Gemini is matching skills & keywords...'}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              {currentStep === 'analyzing'
                ? 'Discovering ATS keyword gaps and drafting precision bullet improvements...'
                : 'Extracting clean structural sections and preparing analysis...'}
            </p>
          </div>

          <div className="max-w-xs mx-auto space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${currentStep !== 'idle' ? 'text-indigo-600' : 'text-slate-300'}`} />
              <span className={currentStep !== 'idle' ? 'text-slate-700 font-medium' : ''}>Document Upload & Parsing</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${currentStep === 'creating' || currentStep === 'analyzing' ? 'text-indigo-600' : 'text-slate-300'}`} />
              <span className={currentStep === 'creating' || currentStep === 'analyzing' ? 'text-slate-700 font-medium' : ''}>Target Vacancy Mapping</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-4 h-4 ${currentStep === 'analyzing' ? 'text-indigo-600 animate-pulse' : 'text-slate-300'}`} />
              <span className={currentStep === 'analyzing' ? 'text-slate-700 font-medium' : ''}>AI Keyword & Skill Optimization</span>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: CV Upload */}
          <div className="glass-card p-6 sm:p-7 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>1. Upload Original CV</span>
              </label>
              <span className="text-xs text-slate-400">PDF or DOCX (Max 10MB)</span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
            />

            {!file ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-indigo-600 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  Click to browse or drag and drop your CV file here
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports Adobe PDF (.pdf) and Microsoft Word (.docx)
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Target Vacancy Details */}
          <div className="glass-card p-6 sm:p-7 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <span>2. Target Job & Company</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Job Position / Title *
                </label>
                <input
                  type="text"
                  required
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Target Company Name (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Google, Stripe, Acme Corp"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Job Vacancy Description & Requirements *
              </label>
              <textarea
                required
                rows={7}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the complete job description, key responsibilities, required technical skills, and qualifications here..."
                className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white resize-y"
              />
            </div>
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={!file || !jobTitle.trim() || !jobDescription.trim()}
            className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-base shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span>Generate AI Tailoring Suggestions</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      )}
    </div>
  );
}
