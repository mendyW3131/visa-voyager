import React from 'react';
import { DocumentItem } from '../types';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface ChecklistProps {
  items: DocumentItem[];
  onToggle: (id: string) => void;
}

export const Checklist: React.FC<ChecklistProps> = ({ items, onToggle }) => {
  const progress = Math.round((items.filter(i => i.completed).length / items.length) * 100) || 0;

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold text-slate-800">Required Documents</h3>
          <span className="text-sm font-medium text-blue-600">{progress}% Ready</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {items.map((item) => (
          <div 
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`p-4 rounded-xl border cursor-pointer transition-all group ${
              item.completed 
                ? 'bg-blue-50 border-blue-200' 
                : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className={`mt-1 ${item.completed ? 'text-blue-600' : 'text-slate-300 group-hover:text-blue-400'}`}>
                {item.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </div>
              <div>
                <h4 className={`font-medium ${item.completed ? 'text-blue-900' : 'text-slate-900'}`}>
                  {item.name}
                </h4>
                <p className={`text-sm mt-1 ${item.completed ? 'text-blue-700' : 'text-slate-500'}`}>
                  {item.description}
                </p>
                {item.isRequired && !item.completed && (
                  <div className="flex items-center mt-2 text-xs text-amber-600 font-medium">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Mandatory
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
