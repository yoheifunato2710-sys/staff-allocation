import React, { useState } from 'react';

function moveItem(items, from, to) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** ドラッグで並べ替えできる一覧（職員・モダリティ共通）。children(item) で行の中身を描画する */
export default function SortableList({ items, setItems, selectedId, onSelect, listRef, children }) {
  const [dragFrom, setDragFrom] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const resetDrag = () => {
    setDragFrom(null);
    setDragOver(null);
  };

  return (
    <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-1 pr-1">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', String(index));
            e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
            setDragFrom(index);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOver(index);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragFrom !== null && dragFrom !== index) setItems((prev) => moveItem(prev, dragFrom, index));
            resetDrag();
          }}
          onDragEnd={resetDrag}
          onClick={() => onSelect(item)}
          className={`rounded-lg border-2 overflow-hidden shadow-sm cursor-grab active:cursor-grabbing transition-all ${
            dragFrom === index ? 'opacity-50' : ''
          } ${
            dragOver === index ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50/80' : ''
          } ${
            selectedId === item.id && dragOver !== index
              ? 'border-blue-500 bg-blue-50/80 ring-2 ring-blue-200'
              : 'border-slate-400 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-500'
          }`}
        >
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <div className="flex items-center shrink-0 text-slate-400" onClick={(e) => e.stopPropagation()} title="ドラッグで順序変更">
              <span className="text-base leading-none select-none">⋮⋮</span>
            </div>
            <span className="text-stone-700 text-sm font-semibold w-5 shrink-0">{index + 1}</span>
            {children(item)}
          </div>
        </div>
      ))}
    </div>
  );
}
