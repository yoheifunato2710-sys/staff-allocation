import React from 'react';

export default function PlaceholderScreen({ title, onBack }) {
  return (
    <div className="min-h-screen bg-slate-950 p-5 relative overflow-hidden">
      <div className="absolute top-20 right-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto relative">
        <div className="flex justify-between items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button onClick={onBack} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm font-medium transition-all">
            ← メインメニュー
          </button>
        </div>

        <div className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-20 text-center border border-slate-800">
          <div className="text-6xl mb-4">🚧</div>
          <div className="text-slate-400 text-xl">後続のステップで作成します</div>
        </div>
      </div>
    </div>
  );
}
