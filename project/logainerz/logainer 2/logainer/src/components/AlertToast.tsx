import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  X 
} from 'lucide-react';
import { useLogistics, ToastAlert } from '../context/LogisticsContext';

export const AlertToastContainer: React.FC = () => {
  const { toasts, removeToast } = useLogistics();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isCritical = toast.type === 'CRITICAL';
        const isWarning = toast.type === 'WARNING';
        const isSuccess = toast.type === 'SUCCESS';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-5 transition-all ${
              isCritical
                ? 'bg-rose-950/90 border-rose-500/60 text-white shadow-glow-rose'
                : isWarning
                ? 'bg-amber-950/90 border-amber-500/60 text-white shadow-glow-amber'
                : isSuccess
                ? 'bg-emerald-950/90 border-emerald-500/60 text-white shadow-glow-emerald'
                : 'glass-panel text-white border-cyan-500/40 shadow-glow-cyan'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <div className="mt-0.5">
                  {isCritical && <AlertOctagon className="w-5 h-5 text-rose-400 animate-pulse" />}
                  {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                  {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {!isCritical && !isWarning && !isSuccess && <Info className="w-5 h-5 text-cyan-400" />}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold">{toast.title}</div>
                  <div className="text-[11px] text-slate-200 leading-snug">{toast.message}</div>
                  <div className="text-[9px] text-slate-400 font-mono">{toast.timestamp}</div>
                </div>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-0.5"
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
