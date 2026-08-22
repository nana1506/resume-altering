import React from 'react';
import { Sparkles, TrendingUp, CheckCircle2, PlusCircle } from 'lucide-react';

// Hardcoded static sample data for logged-out preview
const SAMPLE_KEYWORDS = [
  { keyword: 'Python & FastAPI', status: 'matched' },
  { keyword: 'PostgreSQL', status: 'matched' },
  { keyword: 'REST API Design', status: 'matched' },
  { keyword: 'Git & CI/CD', status: 'matched' },
  { keyword: 'Docker Containers', status: 'added' },
  { keyword: 'Distributed Systems', status: 'added' },
];

export default function ScorePreview() {
  const beforeScore = 68;
  const afterScore = 95;
  const delta = afterScore - beforeScore;

  // SVG Gauge calculations (radius = 38, circumference = 238.76)
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const beforeOffset = circumference - (beforeScore / 100) * circumference;
  const afterOffset = circumference - (afterScore / 100) * circumference;

  return (
    <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-6 border border-slate-200/80 shadow-md relative overflow-hidden flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">
              See Your Match Score Improve
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time ATS alignment comparison for <strong className="text-slate-700">Senior Software Engineer</strong>
          </p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Sample Result
        </span>
      </div>

      {/* Radial Score Gauges Comparison */}
      <div className="grid grid-cols-2 gap-4 items-center bg-slate-50/70 p-4 rounded-2xl border border-slate-100 relative">
        {/* Before Score Gauge */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-slate-200"
                strokeWidth="8"
                fill="transparent"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-amber-500"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={beforeOffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-slate-800">{beforeScore}%</span>
              <span className="text-[10px] font-medium text-slate-500">Initial</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-600">Before Optimization</span>
        </div>

        {/* Delta Indicator Badge (Absolute Center on Desktop) */}
        <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex-col items-center bg-white px-2.5 py-1.5 rounded-full shadow-sm border border-emerald-200 text-emerald-700">
          <div className="flex items-center gap-1 font-bold text-xs">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+{delta}%</span>
          </div>
        </div>

        {/* After Score Gauge */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-slate-200"
                strokeWidth="8"
                fill="transparent"
              />
              {/* Progress circle with emerald gradient */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-emerald-500"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={afterOffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-xl font-extrabold text-emerald-600">{afterScore}%</span>
              <span className="text-[10px] font-medium text-slate-500">Optimized</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700">After Tailoring</span>
        </div>
      </div>

      {/* Keywords Gap Analysis Chips */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700">Detected Vacancy Keywords:</span>
          <span className="text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>All Core Gaps Resolved</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          {SAMPLE_KEYWORDS.map((item, idx) => (
            <span
              key={idx}
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border ${
                item.status === 'matched'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                  : 'bg-amber-50 text-amber-900 border-amber-200'
              }`}
            >
              {item.status === 'matched' ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              ) : (
                <PlusCircle className="w-3 h-3 text-amber-600 shrink-0" />
              )}
              <span>{item.keyword}</span>
              {item.status === 'added' && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-950 px-1 rounded">
                  Added
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Caption footer */}
      <div className="pt-2 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-500 italic">
          Every suggestion comes with a reason — you decide what to apply.
        </p>
      </div>
    </div>
  );
}
