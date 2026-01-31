import React from 'react';

const accentColors = {
  violet: 'group-hover:border-violet-500/50 group-hover:shadow-violet-500/20',
  cyan: 'group-hover:border-cyan-500/50 group-hover:shadow-cyan-500/20',
  emerald: 'group-hover:border-emerald-500/50 group-hover:shadow-emerald-500/20',
  amber: 'group-hover:border-amber-500/50 group-hover:shadow-amber-500/20',
  rose: 'group-hover:border-rose-500/50 group-hover:shadow-rose-500/20',
  indigo: 'group-hover:border-indigo-500/50 group-hover:shadow-indigo-500/20'
};

export default function MenuButton({ icon, title, detail, onClick, accent, compact, className = '' }) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`group relative flex items-center bg-slate-900/50 border border-slate-800 hover:bg-slate-900/80 p-3 rounded-xl transition-all duration-300 hover:shadow-xl ${accentColors[accent]} backdrop-blur-sm hover:-translate-y-0.5 min-h-0 ${className}`.trim()}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        <div className="relative flex items-center gap-3 w-full min-w-0 pl-4">
          <span className="text-3xl transform group-hover:scale-110 transition-transform shrink-0">{icon}</span>
          <div className="text-left min-w-0 flex-1">
            <span className="text-xl font-bold text-white block truncate">{title}</span>
            {detail ? <span className="text-sm text-slate-500 block truncate mt-1">{detail}</span> : null}
          </div>
          <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`group relative bg-slate-900/50 border border-slate-800 hover:bg-slate-900/80 p-6 rounded-2xl transition-all duration-500 hover:shadow-2xl ${accentColors[accent]} backdrop-blur-sm hover:-translate-y-1`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
      <div className="relative">
        <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-500">{icon}</div>
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <div className="absolute bottom-6 right-6 text-slate-600 group-hover:text-slate-400 transform group-hover:translate-x-1 transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  );
}
