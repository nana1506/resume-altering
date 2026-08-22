import React from 'react';
import { BarChart3, Building2, Calendar, ArrowUpRight } from 'lucide-react';

// Hardcoded static sample data for logged-out preview
const SAMPLE_HISTORY = [
  {
    company: 'PT Telkom',
    role: 'Data Analyst',
    date: 'Jun 2026',
    score: 71,
    color: 'bg-indigo-400',
  },
  {
    company: 'Gojek',
    role: 'Senior Analyst',
    date: 'Jul 2026',
    score: 82,
    color: 'bg-indigo-500',
  },
  {
    company: 'Tokopedia',
    role: 'Lead Analyst',
    date: 'Jul 2026',
    score: 88,
    color: 'bg-violet-500',
  },
  {
    company: 'Traveloka',
    role: 'BI Architect',
    date: 'Aug 2026',
    score: 95,
    color: 'bg-emerald-500',
  },
];

export default function HistoryPreview() {
  return (
    <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-6 border border-slate-200/80 shadow-md relative overflow-hidden flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">
              Track Your Progress Over Time
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Application score improvements across targeted positions
          </p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          History Trend
        </span>
      </div>

      {/* Visual Progress Chart */}
      <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>Target Application</span>
          <span>Match Rating</span>
        </div>

        {/* Progress Bar Rows */}
        <div className="space-y-3">
          {SAMPLE_HISTORY.map((item, idx) => (
            <div key={idx} className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-100/90 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold text-slate-800">{item.company}</span>
                    <span className="text-xs text-slate-500 ml-1.5 hidden sm:inline">• {item.role}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {item.date}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      item.score >= 90
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : item.score >= 80
                        ? 'bg-violet-50 text-violet-700 border border-violet-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    {item.score}%
                  </span>
                </div>
              </div>

              {/* Visual Percentage Bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${item.color} rounded-full transition-all duration-500`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Highlight Box */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-emerald-800 text-xs">
        <div className="flex items-center gap-1.5 font-medium">
          <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          <span>Average ATS match rate increased from 71% to 95%</span>
        </div>
        <span className="font-bold text-[11px] bg-emerald-100 px-2 py-0.5 rounded-full text-emerald-900">
          +24 pts
        </span>
      </div>

      {/* Caption footer */}
      <div className="pt-2 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500 italic">
          See how each tailored CV compares to the last.
        </p>
      </div>
    </div>
  );
}
