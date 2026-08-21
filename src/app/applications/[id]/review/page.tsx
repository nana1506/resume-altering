'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useTransition } from 'react';
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
  HelpCircle,
  Undo2
} from 'lucide-react';

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
  const [suggestions, setSuggestions] = useState<SuggestedChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      if (!applicationId) return;
      try {
        const data = await fetchWithAuth(`/api/applications/${applicationId}`);
        setApplication(data.application);
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

    // Optimistic UI update
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, checked: newChecked } : s))
    );

    // Call API in background without blocking
    fetchWithAuth(`/api/changes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: newChecked }),
    }).catch((err) => {
      console.error('Failed to update change:', err);
      // Revert on failure
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, checked: !newChecked } : s))
      );
    });
  };

  // Select all or Deselect all
  const setAllChecked = (checkedStatus: boolean) => {
    // Optimistic UI update
    setSuggestions((prev) => prev.map((s) => ({ ...s, checked: checkedStatus })));

    // Fire PATCH updates
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

    // Call API in background
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

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">Loading AI suggestions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header Info */}
      <div className="glass-card p-6 rounded-3xl space-y-3 border-indigo-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Keyword Matching Checklist</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {application?.job_title || 'Tailored Job Application'}
            </h1>
          </div>
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>{application?.cv_documents?.filename || 'Uploaded CV'}</span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600">
          Review each suggested bullet improvement below. Checked items will be applied to your new CV. Click any highlighted suggestion to edit the wording inline.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="flex-1">{errorMsg}</p>
        </div>
      )}

      {/* Checklist Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3">
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

        <span className="text-xs font-semibold text-slate-500">
          <strong className="text-indigo-600">{checkedCount}</strong> of {suggestions.length} changes selected
        </span>
      </div>

      {/* Suggestion Checklist Rows */}
      {suggestions.length === 0 ? (
        <div className="glass-card p-10 rounded-2xl text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <h3 className="font-bold text-slate-900">No major keyword gaps found!</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Your CV already aligns strongly with this job description, or no specific replacements were flagged.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((change, index) => {
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
                            {isUserModified ? 'Your Custom Edit:' : 'AI Suggested Text:'}
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
