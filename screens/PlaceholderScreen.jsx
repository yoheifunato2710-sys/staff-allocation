import React from 'react';

export default function PlaceholderScreen({ title, onBack }) {
  return (
    <div className="min-h-screen bg-violet-400 p-5 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto relative">
        <div className="flex justify-between items-center gap-4 mb-4">
          <h2 className="text-3xl font-bold text-stone-800">{title}</h2>
<button onClick={onBack} className="px-4 py-2.5 bg-stone-50 hover:bg-slate-100 border-2 border-slate-400 rounded-xl text-stone-800 text-lg font-medium transition-all shadow-sm">
          ← メインメニュー
          </button>
        </div>

        <div className="bg-stone-50 rounded-2xl p-12 text-center border-2 border-slate-400 shadow-sm">
          <div className="text-6xl mb-4">🚧</div>
          <div className="text-stone-600 text-2xl">後続のステップで作成します</div>
        </div>
      </div>
    </div>
  );
}
