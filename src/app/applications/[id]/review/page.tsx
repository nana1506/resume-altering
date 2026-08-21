'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchWithAuth } from '@/lib/api';
import { 
  Sparkles, 
  CheckSquare, 
  Square, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Edit3, 
  Save, 
  Undo2,
  Building2,
  Check,
  AlertTriangle,
  XCircle,
  BarChart3,
  Filter
} from 'lucide-react';

interface KeywordItem {
  keyword: string;
  category?: string;
  status: 'exists' | 'different_terms' | 'not_exists';
  details: string;
}

interface SuggestedChange {
  id: string;
  application_id: string;
  section: string;
  original_text: string;
  suggested_text: string;
  reason: string;
  checked: boolean;
  final_text: string | null;
}

interface ApplicationData {
  id: string;
  job_title: string;
  company_name?: string;
  job_description_text: string;
  cv_documents?: {
    filename: string;
  };
}

export default function ReviewChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params?.id as string;

  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchLabel, setMatchLabel] = useState<string>('');
  const [matchSummary, setMatchSummary] = useState<string>('');
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestedChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  // Keyword filter
  const [keywordFilter, setKeywordFilter] = useState<'all' | 'exists' | 'different_terms' | 'not_exists'>('all');

  useEffect(() => {
    async function loadData() {
      if (!applicationId) return;
      try {
        const data = await fetchWithAuth(`/api/applications/${applicationId}`);
        setApplication(data.application);
        setMatchScore(data.match_score ?? null);
        setMatchLabel(data.match_label || '');
        setMatchSummary(data.match_summary || '');
        setKeywords(data.keywords_analysis || []);
        setSuggestions(data.suggested_changes || []);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load suggestions');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [applicationId]);

  // Optimistic PATCH call for checkbox toggle
  const toggleCheckbox = (id: string) => {
    const currentItem = suggestions.find((s) => s.id === id);
    if (!currentItem) return;

    const newChecked = !currentItem.checked;

    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, checked: newChecked } : s))
    );

    fetchWithAuth(`/api/changes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: newChecked }),
    }).catch((err) => {
      console.error('Failed to update change:', err);
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, checked: !newChecked } : s))
      );
    });
  };

  // Select all or Deselect all
  const setAllChecked = (checkedStatus: boolean) => {
    setSuggestions((prev) => prev.map((s) => ({ ...s, checked: checkedStatus })));

    suggestions.forEach((s) => {
      if (s.checked !== checkedStatus) {
        fetchWithAuth(`/api/changes/${s.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checked: checkedStatus }),
        }).catch(console.error);
      }
    });
  };

  // Start inline editing
  const startEditing = (change: SuggestedChange) => {
    setEditingId(change.id);
    setEditText(change.final_text ?? change.suggested_text);
  };

  // Save inline edit
  const saveEditing = (id: string) => {
    const trimmed = editText.trim();
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, final_text: trimmed } : s))
    );
    setEditingId(null);

    fetchWithAuth(`/api/changes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_text: trimmed }),
    }).catch((err) => {
      console.error('Failed to save inline edit:', err);
    });
  };

  // Reset to original Gemini suggested text
  const resetToOriginalSuggested = (id: string) => {
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, final_text: null } : s))
    );
    setEditingId(null);

    fetchWithAuth(`/api/changes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ final_text: null }),
    }).catch(console.error);
  };

  // Generate CV
  const handleGenerateCV = async () => {
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      await fetchWithAuth(`/api/applications/${applicationId}/generate`, {
        method: 'POST',
      });
      router.push(`/applications/${applicationId}/result`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate tailored CV.');
      setIsGenerating(false);
    }
  };

  const checkedCount = suggestions.filter((s) => s.checked).length;
  const allChecked = suggestions.length > 0 && checkedCount === suggestions.length;

  const existsCount = keywords.filter((k) => k.status === 'exists').length;
  const diffTermsCount = keywords.filter((k) => k.status === 'different_terms').length;
  const notExistsCount = keywords.filter((k) => k.status === 'not_exists').length;

  const filteredKeywords = keywords.filter((k) => {
    if (keywordFilter === 'all') return true;
    return k.status === keywordFilter;
  });

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Loading ATS keyword analysis & suggestions...</p>
      </div>
    );
  }

  // Determine score color theme
  const score = matchScore ?? 70;
  const isHighMatch = score >= 80;
  const isModerateMatch = score >= 60 && score < 80;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-3 border-indigo-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Target Alignment Review</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{application?.job_title || 'Tailored Job Application'}</span>
            </h1>
            {application?.company_name && (
              <p className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{application.company_name}</span>
              </p>
            )}
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>{application?.cv_documents?.filename || 'Uploaded CV'}</span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{errorMsg}</p>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 1: ATS MATCH SCORE & SUMMARY                      */}
      {/* ========================================================= */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-6 border-indigo-100/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Score Ring / Badge */}
            <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-md ${
              isHighMatch
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-emerald-500/20'
                : isModerateMatch
                ? 'bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-indigo-500/20'
                : 'bg-gradient-to-tr from-amber-600 to-rose-500 text-white shadow-amber-500/20'
            }`}>
              <span className="text-3xl font-extrabold tracking-tight">{score}%</span>
              <span className="text-[10px] uppercase font-bold tracking-wider opacity-90">ATS Fit</span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-slate-900">
                  {matchLabel || (isHighMatch ? 'Strong Match' : isModerateMatch ? 'Moderate Match' : 'Low Match')}
                </span>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  isHighMatch
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isModerateMatch
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {isHighMatch ? 'High Candidate Alignment' : isModerateMatch ? 'Solid Base with Key Gaps' : 'Needs Significant Keyword Alignment'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                {matchSummary || 'Gemini analyzed your background against the vacancy requirements. Applying the suggested bullet changes below will maximize your ATS pass rate.'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Keyword Status Metric Badges */}
        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-emerald-800 font-medium">Found in CV</p>
              <p className="text-lg font-bold text-emerald-950">{existsCount} keywords</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-amber-800 font-medium">Different Terms</p>
              <p className="text-lg font-bold text-amber-950">{diffTermsCount} keywords</p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
              <XCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-rose-800 font-medium">Missing in CV</p>
              <p className="text-lg font-bold text-rose-950">{notExistsCount} keywords</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 2: JOB VACANCY KEYWORD GAP ANALYSIS               */}
      {/* ========================================================= */}
      {keywords.length > 0 && (
        <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                <span>Job Vacancy Keyword Breakdown</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Skills and qualifications extracted directly from the job vacancy
              </p>
            </div>

            {/* Keyword Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setKeywordFilter('all')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                  keywordFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({keywords.length})
              </button>

              <button
                type="button"
                onClick={() => setKeywordFilter('exists')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                  keywordFilter === 'exists'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                <Check className="w-3 h-3" />
                <span>Found ({existsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordFilter('different_terms')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                  keywordFilter === 'different_terms'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Different Terms ({diffTermsCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setKeywordFilter('not_exists')}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 ${
                  keywordFilter === 'not_exists'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                <XCircle className="w-3 h-3" />
                <span>Missing ({notExistsCount})</span>
              </button>
            </div>
          </div>

          {/* Keywords Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredKeywords.map((item, idx) => {
              const isExists = item.status === 'exists';
              const isDiffTerms = item.status === 'different_terms';

              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                    isExists
                      ? 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/70'
                      : isDiffTerms
                      ? 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70'
                      : 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-slate-900 text-sm">{item.keyword}</div>
                    {isExists && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                        <Check className="w-3 h-3" />
                        Found in CV
                      </span>
                    )}
                    {isDiffTerms && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        Different Term
                      </span>
                    )}
                    {!isExists && !isDiffTerms && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full shrink-0">
                        <XCircle className="w-3 h-3" />
                        Missing
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{item.details}</p>

                  {item.category && (
                    <span className="inline-block text-[10px] font-medium text-slate-400">
                      {item.category}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 3: ACTIONABLE SUGGESTIONS CHECKLIST               */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Tailored Keyword Improvement Checklist</h3>
            <p className="text-xs text-slate-500">
              Check the items you wish to include in your generated CV. Click any text to edit inline.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAllChecked(!allChecked)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-600 transition-colors"
          >
            {allChecked ? (
              <>
                <CheckSquare className="w-4 h-4 text-indigo-600" />
                <span>Deselect All</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 text-slate-400" />
                <span>Select All</span>
              </>
            )}
          </button>
        </div>

        {suggestions.length === 0 ? (
          <div className="glass-card p-10 rounded-2xl text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-900">No major keyword gaps found!</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Your CV already aligns strongly with this job vacancy.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((change) => {
              const isEditing = editingId === change.id;
              const displayText = change.final_text ?? change.suggested_text;
              const isUserModified = change.final_text !== null && change.final_text !== change.suggested_text;

              return (
                <div
                  key={change.id}
                  className={`glass-card rounded-2xl p-5 transition-all border ${
                    change.checked
                      ? 'border-indigo-200 bg-white shadow-sm ring-1 ring-indigo-500/10'
                      : 'border-slate-200 bg-slate-50/60 opacity-70'
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Checkbox Button */}
                    <button
                      type="button"
                      onClick={() => toggleCheckbox(change.id)}
                      className="mt-1 text-indigo-600 focus:outline-none shrink-0"
                      title={change.checked ? "Uncheck change" : "Apply change"}
                    >
                      {change.checked ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600 fill-indigo-50" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-400" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Section Badge & Match Reason */}
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {change.section || 'General Section'}
                        </span>

                        {change.reason && (
                          <div className="inline-flex items-center gap-1 text-xs text-indigo-700 bg-indigo-50/80 px-2.5 py-0.5 rounded-lg border border-indigo-100/80">
                            <Sparkles className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-xs">{change.reason}</span>
                          </div>
                        )}
                      </div>

                      {/* Original vs Suggested Text (Mobile-first stacked layout) */}
                      <div className="space-y-2">
                        {/* Original text (struck-through / dimmed) */}
                        {change.original_text && change.original_text.trim() && (
                          <div className="p-2.5 rounded-xl bg-slate-100/70 border border-slate-200/70 text-xs text-slate-500 line-through">
                            <span className="font-semibold text-slate-600 mr-1 not-italic">[Original]:</span>
                            {change.original_text}
                          </div>
                        )}

                        {/* Suggested / User edited text */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-indigo-900 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              {isUserModified ? 'Your Custom Edit:' : 'AI Suggested Enhancement:'}
                            </span>
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => startEditing(change)}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit inline</span>
                              </button>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="space-y-2">
                              <textarea
                                rows={3}
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full p-3 rounded-xl border-2 border-indigo-500 focus:outline-none text-sm text-slate-900 bg-white shadow-sm"
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => saveEditing(change.id)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                  <span>Save Changes</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                                >
                                  Cancel
                                </button>
                                {isUserModified && (
                                  <button
                                    type="button"
                                    onClick={() => resetToOriginalSuggested(change.id)}
                                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-rose-600 inline-flex items-center gap-1 ml-auto"
                                  >
                                    <Undo2 className="w-3 h-3" />
                                    <span>Reset to AI</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div
                              onClick={() => startEditing(change)}
                              className="p-3 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-200/80 text-sm text-slate-900 cursor-pointer transition-colors group relative"
                              title="Click to edit"
                            >
                              <p className="leading-relaxed">{displayText}</p>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate CV Action Card */}
      <div className="sticky bottom-4 z-20 glass-panel p-4 sm:p-5 rounded-2xl border border-indigo-200 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-900 text-sm sm:text-base">Ready to build your tailored CV?</h4>
          <p className="text-xs text-slate-500">
            {checkedCount} approved enhancement{checkedCount === 1 ? '' : 's'} will be formatted into an ATS-friendly PDF.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateCV}
          disabled={isGenerating}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 shrink-0"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Rendering PDF...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generate CV ({checkedCount} changes)</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
