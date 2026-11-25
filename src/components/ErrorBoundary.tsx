import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const raw = error instanceof Error ? error.message : String(error);
    return {
      hasError: true,
      message: raw,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0C] text-[#F2EFE9] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-[#9E1B24]/50 bg-[#121215] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-[#E24B55]">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <h1 className="font-display text-2xl font-semibold text-[#F2EFE9]">
                应用出现异常状态
              </h1>
            </div>
            <p className="text-xs text-[#9E9A93] leading-relaxed">
              你的本地观影档案仍安全保存在浏览器存储中。点击下方按钮重新加载界面。
            </p>
            {this.state.message && (
              <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0C] p-3 text-[11px] font-mono-num text-[#8C8881] break-all max-h-28 overflow-y-auto">
                {this.state.message}
              </div>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#A31C24] hover:bg-[#BE222C] text-white text-xs font-medium px-4 py-2.5 min-h-[40px] transition-colors cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>重新加载 Horror Diary</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
