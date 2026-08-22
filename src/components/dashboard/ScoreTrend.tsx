'use client';

import React from 'react';
import { BarChart3, Building2, Calendar, ArrowUpRight, TrendingUp } from 'lucide-react';

export interface ScoreTrendItem {
  id: string;
  company?: string;
  role: string;
  label: string;
  score: number;
  date: string;
}

interface ScoreTrendProps {
  items: ScoreTrendItem[];
}

export default function ScoreTrend({ items }: ScoreTrendProps) {
  if (!items || items.length === 0) {
    return null;
  }

  // Cap to at most 8 most recent applications (items passed are in chronological order: oldest to newest)
  const displayItems = items.slice(-8);
  const isSingle = displayItems.length === 1;

  const oldest = displayItems[0];
  const latest = displayItems[displayItems.length - 1];
  const scoreDelta = latest.score - oldest.score;

  const getColorClass = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 80) return 'bg-violet-500';
    if (score >= 70) return 'bg-indigo-500';
    return 'bg-amber-500';
  };

  const getBadgeClass = (score: number) => {
    if (score >= 90) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 80) return 'bg-violet-50 text-violet-700 border-violet-200';
    if (score >= 70) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <div className="glass-card p-6 sm:p-7 rounded-3xl space-y-5 border border-slate-200/80 shadow-md relative overflow-hidden flex flex-col justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-base sm:text-lg">
              ATS Match Rating Progression
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time score improvements across your tailored target positions
          </p>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
          Progression
        </span>
      </div>

      {/* Visual Progress Chart */}
      <div className="space-y-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
          <span>Target Vacancy</span>
          <span>Match Rating</span>
        </div>

        {/* Progress Bar Rows */}
        <div className="space-y-2.5">
          {displayItems.map((item) => (
            <div key={item.id} className="space-y-1.5 bg-white p-2.5 rounded-xl border border-slate-100/90 shadow-2xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="text-xs font-bold text-slate-800">
                      {item.company || 'Direct Application'}
                    </span>
                    <span className="text-xs text-slate-500 ml-1.5 hidden sm:inline">
                      • {item.role}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {item.date}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getBadgeClass(item.score)}`}>
                    {item.score}%
                  </span>
                </div>
              </div>

              {/* Visual Percentage Bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getColorClass(item.score)} rounded-full transition-all duration-500`}
                  style={{ width: `${item.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Highlight Box */}
      {isSingle ? (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/60 text-indigo-900 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Initial baseline established at {latest.score}% ATS compatibility</span>
          </div>
          <span className="font-bold text-[11px] bg-indigo-100 px-2 py-0.5 rounded-full text-indigo-800 shrink-0">
            1 Application
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60 text-emerald-900 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {scoreDelta >= 0
                ? `ATS match score improved from ${oldest.score}% to ${latest.score}%`
                : `ATS match rating tracks between ${Math.min(...displayItems.map(i => i.score))}% and ${Math.max(...displayItems.map(i => i.score))}%`}
            </span>
          </div>
          {scoreDelta !== 0 && (
            <span className={`font-bold text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
              scoreDelta > 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'
            }`}>
              {scoreDelta > 0 ? `+${scoreDelta} pts` : `${scoreDelta} pts`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
