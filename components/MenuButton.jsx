import React from 'react';

const accentColors = {
  violet: 'group-hover:border-violet-400 group-hover:shadow-violet-200/60',
  cyan: 'group-hover:border-cyan-400 group-hover:shadow-cyan-200/60',
  emerald: 'group-hover:border-emerald-400 group-hover:shadow-emerald-200/60',
  amber: 'group-hover:border-amber-400 group-hover:shadow-amber-200/60',
  rose: 'group-hover:border-rose-400 group-hover:shadow-rose-200/60',
  indigo: 'group-hover:border-indigo-400 group-hover:shadow-indigo-200/60'
};

export default function MenuButton({ icon, title, detail, onClick, accent, compact, className = '' }) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`group relative flex items-center bg-slate-50 border border-slate-400 hover:border-slate-500 px-3 py-2.5 rounded-lg transition-all duration-300 hover:shadow-md shadow-sm min-h-[56px] ${accentColors[accent]} hover:-translate-y-0.5 ${className}`.trim()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
        <div className="relative flex items-center gap-2 w-full min-w-0">
          <span className="text-xl transform group-hover:scale-105 transition-transform shrink-0 leading-none">{icon}</span>
          <div className="text-left min-w-0 flex-1 overflow-hidden py-0 leading-none">
            <span className="text-2xl font-bold text-slate-900 block truncate leading-none">{title}</span>
            {detail ? <span className="text-sm text-stone-600 block line-clamp-2 mt-px leading-tight">{detail}</span> : null}
          </div>
          <svg className="w-4 h-4 text-slate-600 group-hover:text-slate-800 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`group relative bg-slate-50 border-2 border-slate-400 hover:border-slate-500 p-6 rounded-2xl transition-all duration-500 hover:shadow-xl shadow-sm ${accentColors[accent]} hover:-translate-y-1`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
      <div className="relative">
        <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-500">{icon}</div>
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
        <div className="absolute bottom-6 right-6 text-slate-700 group-hover:text-slate-900 transform group-hover:translate-x-1 transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}
