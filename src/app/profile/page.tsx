'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import TermsModal from '@/components/TermsModal';
import CvUploadInput from '@/components/cv/CvUploadInput';
import { 
  User, 
  Mail, 
  Lock, 
  Briefcase, 
  MapPin, 
  Phone, 
  Linkedin, 
  Github, 
  Globe, 
  FileText, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Sparkles,
  ShieldCheck,
  Calendar,
  Trash2,
  RefreshCw,
  Upload
} from 'lucide-react';

interface ProfileCvData {
  id: string;
  filename: string;
  created_at: string;
  storage_path?: string;
}

export default function ProfilePage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [name, setName] = useState('');
  const [headline, setHeadline] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [bio, setBio] = useState('');

  // Profile CV State
  const [profileCv, setProfileCv] = useState<ProfileCvData | null>(null);
  const [loadingCv, setLoadingCv] = useState(true);
  const [isReplacingCv, setIsReplacingCv] = useState(false);
  const [cvUploadFile, setCvUploadFile] = useState<File | null>(null);
  const [cvActionLoading, setCvActionLoading] = useState(false);
  const [cvSuccessMsg, setCvSuccessMsg] = useState<string | null>(null);
  const [cvErrorMsg, setCvErrorMsg] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const router = useRouter();

  const loadProfileCv = useCallback(async () => {
    try {
      setLoadingCv(true);
      const res = await fetchWithAuth('/api/user/cv');
      if (res.has_profile_cv && res.cv) {
        setProfileCv(res.cv);
      } else {
        setProfileCv(null);
      }
    } catch (err) {
      console.error('Failed to load profile CV:', err);
    } finally {
      setLoadingCv(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (profile) {
      setName(profile.name || '');
      setHeadline(profile.headline || '');
      setPhone(profile.phone || '');
      setLocation(profile.location || '');
      setLinkedinUrl(profile.linkedin_url || '');
      setGithubUrl(profile.github_url || '');
      setPortfolioUrl(profile.portfolio_url || '');
      setBio(profile.bio || '');

      if (!profile.terms_agreed) {
        setShowTermsModal(true);
      }
    }

    loadProfileCv();
  }, [authLoading, user, profile, router, loadProfileCv]);

  const handleUploadProfileCv = async (fileToUpload: File) => {
    setCvActionLoading(true);
    setCvErrorMsg(null);
    setCvSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('save_to_profile', 'true');

      await fetchWithAuth('/api/cv/upload', {
        method: 'POST',
        body: formData,
      });

      setCvSuccessMsg('Profile CV saved successfully!');
      setCvUploadFile(null);
      setIsReplacingCv(false);
      await loadProfileCv();
      setTimeout(() => setCvSuccessMsg(null), 4000);
    } catch (err: any) {
      setCvErrorMsg(err.message || 'Failed to upload profile CV.');
    } finally {
      setCvActionLoading(false);
    }
  };

  const handleRemoveProfileCv = async () => {
    if (!confirm('Are you sure you want to remove this CV from your profile? This unlinks it from your default profile settings without affecting past application histories.')) {
      return;
    }

    setCvActionLoading(true);
    setCvErrorMsg(null);
    setCvSuccessMsg(null);

    try {
      await fetchWithAuth('/api/user/cv', {
        method: 'DELETE',
      });
      setProfileCv(null);
      setIsReplacingCv(false);
      setCvUploadFile(null);
      setCvSuccessMsg('Profile CV removed from your profile.');
      setTimeout(() => setCvSuccessMsg(null), 4000);
    } catch (err: any) {
      setCvErrorMsg(err.message || 'Failed to remove profile CV.');
    } finally {
      setCvActionLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetchWithAuth('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          headline: headline.trim() || null,
          phone: phone.trim() || null,
          location: location.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          github_url: githubUrl.trim() || null,
          portfolio_url: portfolioUrl.trim() || null,
          bio: bio.trim() || null,
        }),
      });

      await refreshProfile();
      setSuccessMsg(res.message || 'Personal profile updated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Profile save error:', err);
      setErrorMsg(err.message || 'Failed to update personal information.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Loading personal information...</p>
      </div>
    );
  }

  const initials = (name || profile?.email || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Terms & Conditions Modal */}
      <TermsModal
        isOpen={showTermsModal}
        onAccepted={() => setShowTermsModal(false)}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
            <User className="w-3.5 h-3.5" />
            <span>Account Settings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1.5">
            Personal Information
          </h1>
          <p className="text-sm text-slate-500">
            Manage your display identity, job role, contact details, and portfolio links
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs text-emerald-700 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{errorMsg}</p>
        </div>
      )}

      {/* My Profile CV Section */}
      <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <FileText className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                My Saved Profile CV
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Save a default CV here to automatically reuse it across applications without re-uploading
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider hidden sm:inline">
            Single Slot
          </span>
        </div>

        {cvSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{cvSuccessMsg}</span>
            </div>
            <button onClick={() => setCvSuccessMsg(null)} className="text-emerald-700 hover:underline">
              ✕
            </button>
          </div>
        )}

        {cvErrorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1">{cvErrorMsg}</p>
          </div>
        )}

        {loadingCv ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs">Loading profile CV...</p>
          </div>
        ) : profileCv && !isReplacingCv ? (
          <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm truncate">{profileCv.filename}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-indigo-100 text-indigo-800 shrink-0">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Saved on {new Date(profileCv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsReplacingCv(true);
                  setCvUploadFile(null);
                }}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors inline-flex items-center gap-1.5 shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Replace</span>
              </button>

              <button
                type="button"
                onClick={handleRemoveProfileCv}
                disabled={cvActionLoading}
                className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition-colors inline-flex items-center gap-1.5"
                title="Remove from profile (keeps past applications intact)"
              >
                {cvActionLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Remove</span>
              </button>
            </div>
          </div>
        ) : isReplacingCv ? (
          <div className="space-y-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Upload New Replacement CV
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsReplacingCv(false);
                  setCvUploadFile(null);
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            </div>

            <CvUploadInput
              file={cvUploadFile}
              onFileSelect={setCvUploadFile}
              onError={setCvErrorMsg}
              disabled={cvActionLoading}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsReplacingCv(false);
                  setCvUploadFile(null);
                }}
                disabled={cvActionLoading}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => cvUploadFile && handleUploadProfileCv(cvUploadFile)}
                disabled={!cvUploadFile || cvActionLoading}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {cvActionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Save & Replace Profile CV</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Empty state: No profile CV */
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Save a CV here to skip uploading it every time you start a new application.
            </p>
            <CvUploadInput
              file={cvUploadFile}
              onFileSelect={setCvUploadFile}
              onError={setCvErrorMsg}
              disabled={cvActionLoading}
            />
            {cvUploadFile && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleUploadProfileCv(cvUploadFile)}
                  disabled={cvActionLoading}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {cvActionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save as Profile CV</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Card Header */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white font-extrabold text-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              {initials}
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 truncate">
                {name || profile?.email?.split('@')[0]}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {headline || 'Professional / Candidate'}
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase tracking-wider">
                  {profile?.role || 'User'}
                </span>
                {profile?.terms_agreed && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    T&C Agreed
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Core Personal Information */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-600" />
            <span>1. Identity & Contact</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Email (Read-Only) */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Email Address</span>
                <span className="text-[10px] text-slate-400 font-normal lowercase flex items-center gap-1">
                  <Lock className="w-3 h-3" /> non-editable
                </span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-500 bg-slate-100/70 cursor-not-allowed select-none"
                />
              </div>
            </div>

            {/* Full / Display Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Full / Display Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* Target Job Role / Professional Headline */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Job Role / Headline
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Full-Stack Engineer"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Location / City
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco, CA / Jakarta"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Social & Portfolio Links */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-5">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            <span>2. Portfolio & Social Links</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* LinkedIn */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                LinkedIn Profile URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Linkedin className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* GitHub */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                GitHub Profile URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Github className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>

            {/* Portfolio Website */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Personal Website / Portfolio
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Globe className="w-4 h-4" />
                </div>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://myportfolio.dev"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Professional Bio */}
        <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>3. Professional Bio & Overview</span>
          </h3>

          <textarea
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Brief career summary, key achievements, or areas of technical passion..."
            className="w-full p-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 text-sm text-slate-900 placeholder:text-slate-400 transition-all bg-slate-50/50 focus:bg-white resize-y"
          />
        </div>

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Profile...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Personal Information</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
