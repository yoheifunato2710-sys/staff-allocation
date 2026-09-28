import React from 'react';

const accentColors = {
  violet: 'group-hover:border-violet-400 group-hover:shadow-violet-200/60',
  cyan: 'group-hover:border-cyan-400 group-hover:shadow-cyan-200/60',
  emerald: 'group-hover:border-emerald-400 group-hover:shadow-emerald-200/60',
  amber: 'group-hover:border-amber-400 group-hover:shadow-amber-200/60',
  rose: 'group-hover:border-rose-400 group-hover:shadow-rose-200/60',
};

export default function MenuButton({ icon, title, detail, onClick, onPointerDown, accent }) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown?.();
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      className={`group relative flex items-center shrink-0 min-h-[44px] bg-slate-50 border-2 border-slate-400 hover:border-slate-500 px-5 py-1.5 rounded-xl transition-all duration-300 hover:shadow-md shadow-sm cursor-pointer select-none w-full text-left hover:-translate-y-0.5 ${accentColors[accent]}`}
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-slate-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
      <div className="relative flex items-center gap-3 w-full min-w-0">
        <span className="text-2xl transform group-hover:scale-105 transition-transform shrink-0 leading-none" aria-hidden>{icon}</span>
        <div className="text-left min-w-0 flex-1 overflow-hidden leading-none">
          <span className="text-2xl font-bold text-slate-900 block truncate leading-none">{title}</span>
          {detail && <span className="text-base text-stone-600 block line-clamp-2 mt-0.5 leading-tight">{detail}</span>}
        </div>
        <svg className="w-5 h-5 text-slate-600 group-hover:text-slate-800 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
