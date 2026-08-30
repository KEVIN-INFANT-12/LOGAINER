import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  X 
} from 'lucide-react';
import { useLogistics } from '../context/LogisticsContext';

export const AlertToastContainer: React.FC = () => {
  const { toasts, removeToast } = useLogistics();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isCritical = toast.type === 'CRITICAL' || toast.type === 'error';
        const isWarning = toast.type === 'WARNING' || toast.type === 'warning';
        const isSuccess = toast.type === 'SUCCESS' || toast.type === 'success';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-modal border animate-in slide-in-from-right-5 transition-all bg-white ${
              isCritical
                ? 'border-red-200 border-l-4 border-l-red-600'
                : isWarning
                ? 'border-amber-200 border-l-4 border-l-amber-500'
                : isSuccess
                ? 'border-emerald-200 border-l-4 border-l-emerald-600'
                : 'border-slate-200 border-l-4 border-l-teal-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {isCritical && <AlertOctagon className="w-5 h-5 text-red-600" />}
                  {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {!isCritical && !isWarning && !isSuccess && <Info className="w-5 h-5 text-teal-700" />}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-900">{toast.title}</div>
                  <div className="text-[11px] text-slate-600 leading-snug">{toast.message}</div>
                  <div className="text-[9px] text-slate-400 font-mono">{toast.timestamp}</div>
                </div>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
