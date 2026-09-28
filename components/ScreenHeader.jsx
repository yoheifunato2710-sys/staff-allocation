import React from 'react';

export default function ScreenHeader({ title, onBack, children, className = 'mb-4', titleClassName = 'text-3xl' }) {
  return (
    <div className={`flex justify-between items-center gap-4 shrink-0 ${className}`}>
      <h2 className={`${titleClassName} font-bold text-stone-800`}>{title}</h2>
      <div className="flex items-center gap-2">
        {children}
        <button type="button" onClick={onBack} className="btn-header">← メインメニュー</button>
      </div>
    </div>
  );
}
