'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import TermsModal from '@/components/TermsModal';
import CvUploadInput from '@/components/cv/CvUploadInput';
import { 
  FileText, 
  Sparkles, 
  Briefcase, 
  Building2,
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  BookmarkCheck,
  Upload,
  Calendar
} from 'lucide-react';

interface ProfileCvData {
  id: string;
  filename: string;
  created_at: string;
}

export default function NewApplicationPage() {
  const { profile } = useAuth();
  const [profileCv, setProfileCv] = useState<ProfileCvData | null>(null);
  const [loadingCv, setLoadingCv] = useState(true);
  const [cvChoice, setCvChoice] = useState<'saved' | 'upload'>('upload');
  const [saveToProfile, setSaveToProfile] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'idle' | 'uploading' | 'creating' | 'analyzing'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (profile && !profile.terms_agreed) {
      setShowTermsModal(true);
    }
  }, [profile]);

  useEffect(() => {
    const checkProfileCv = async () => {
      try {
        setLoadingCv(true);
        const res = await fetchWithAuth('/api/user/cv');
        if (res.has_profile_cv && res.cv) {
          setProfileCv(res.cv);
          setCvChoice('saved');
          setSaveToProfile(false); // deliberate opt-in if uploading different one
        } else {
          setProfileCv(null);
          setCvChoice('upload');
          setSaveToProfile(true); // default checked for frictionless first save
        }
      } catch (err) {
        console.error('Failed to check profile CV:', err);
        setCvChoice('upload');
        setSaveToProfile(true);
      } finally {
        setLoadingCv(false);
      }
    };

    checkProfileCv();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cvChoice === 'upload' && !file) {
      setErrorMsg('Please select a CV document to upload.');
      return;
    }
    if (cvChoice === 'saved' && !profileCv) {
      setErrorMsg('No saved profile CV found. Please upload a CV.');
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
      let cvDocumentId = '';

      if (cvChoice === 'saved' && profileCv) {
        // Fast-path: Reuse existing parsed profile CV directly
        cvDocumentId = profileCv.id;
      } else if (file) {
        // Step 1: Upload & parse fresh CV
        setCurrentStep('uploading');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('save_to_profile', saveToProfile ? 'true' : 'false');

        const uploadRes = await fetchWithAuth('/api/cv/upload', {
          method: 'POST',
          body: formData,
        });

        cvDocumentId = uploadRes.cv_document_id;
      }

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

  const isFormValid =
    (cvChoice === 'saved' ? Boolean(profileCv) : Boolean(file)) &&
    Boolean(jobTitle.trim()) &&
    Boolean(jobDescription.trim());

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
          Choose your base CV, specify the target company and position, and paste the vacancy requirements.
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
                : cvChoice === 'saved'
                ? 'Using your saved profile CV and preparing analysis...'
                : 'Extracting clean structural sections and preparing analysis...'}
            </p>
          </div>

          <div className="max-w-xs mx-auto space-y-2 text-xs text-slate-400">
            {cvChoice === 'upload' && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`w-4 h-4 ${currentStep !== 'idle' ? 'text-indigo-600' : 'text-slate-300'}`} />
                <span className={currentStep !== 'idle' ? 'text-slate-700 font-medium' : ''}>Document Upload & Parsing</span>
              </div>
            )}
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
          {/* Section 1: Choose or Upload CV */}
          <div className="glass-card p-6 sm:p-7 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>1. Select Base CV</span>
              </label>
              {profileCv && (
                <span className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>Profile CV Available</span>
                </span>
              )}
            </div>

            {loadingCv ? (
              <div className="p-8 text-center text-slate-400 space-y-2 border border-slate-100 rounded-2xl bg-slate-50/50">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                <p className="text-xs">Checking for saved profile CV...</p>
              </div>
            ) : profileCv ? (
              /* Profile CV exists -> Show Choice Screen */
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option A: Use Saved CV */}
                  <div
                    onClick={() => setCvChoice('saved')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      cvChoice === 'saved'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          cvChoice === 'saved' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <BookmarkCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Use Saved Profile CV</p>
                          <p className="text-[11px] text-slate-500 truncate max-w-[170px]" title={profileCv.filename}>
                            {profileCv.filename}
                          </p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="cvChoice"
                        checked={cvChoice === 'saved'}
                        onChange={() => setCvChoice('saved')}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(profileCv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Instant Ready
                      </span>
                    </div>
                  </div>

                  {/* Option B: Upload Different CV */}
                  <div
                    onClick={() => setCvChoice('upload')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      cvChoice === 'upload'
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          cvChoice === 'upload' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          <Upload className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">Upload Different CV</p>
                          <p className="text-[11px] text-slate-500">PDF or DOCX document</p>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="cvChoice"
                        checked={cvChoice === 'upload'}
                        onChange={() => setCvChoice('upload')}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Max 10MB</span>
                      <span className="font-medium text-slate-500">Custom upload</span>
                    </div>
                  </div>
                </div>

                {/* If Option B is selected, render upload input and replace checkbox */}
                {cvChoice === 'upload' && (
                  <div className="pt-2 space-y-3">
                    <CvUploadInput
                      file={file}
                      onFileSelect={setFile}
                      onError={setErrorMsg}
                    />

                    {/* Opt-in to overwrite profile CV */}
                    <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 cursor-pointer select-none hover:bg-slate-100/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={saveToProfile}
                        onChange={(e) => setSaveToProfile(e.target.checked)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800">
                          Save this as my profile CV
                        </span>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Replaces your current saved profile CV for future applications.
                        </p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            ) : (
              /* No Profile CV -> Direct Upload with save checkbox */
              <div className="space-y-3">
                <CvUploadInput
                  file={file}
                  onFileSelect={setFile}
                  onError={setErrorMsg}
                />

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 cursor-pointer select-none hover:bg-indigo-50 transition-colors">
                  <input
                    type="checkbox"
                    checked={saveToProfile}
                    onChange={(e) => setSaveToProfile(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-indigo-300"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-indigo-950">
                      Save this as my profile CV
                    </span>
                    <p className="text-indigo-700/80 text-[11px] mt-0.5">
                      Save this so you don't have to upload it next time you tailor an application.
                    </p>
                  </div>
                </label>
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
            disabled={!isFormValid}
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
