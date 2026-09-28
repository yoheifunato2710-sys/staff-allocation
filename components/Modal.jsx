import React from 'react';

export default function Modal({ title, onClose, padding = 'p-6', className = '', children }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className={`bg-stone-50 border-2 border-slate-400 rounded-2xl w-full shadow-xl flex flex-col ${padding} ${className}`}>
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="font-bold text-stone-800 text-xl">{title}</h3>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 transition-colors text-2xl font-bold leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
