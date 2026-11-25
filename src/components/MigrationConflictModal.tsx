import React, { useState } from 'react';
import { Cloud, GitMerge, HardDrive, Loader2 } from 'lucide-react';
import { MigrationResolution } from '../types/horror';

interface MigrationConflictModalProps {
  isOpen: boolean;
  userEmail: string | null;
  localMovieCount: number;
  localRecordCount: number;
  localWatchlistCount: number;
  cloudMovieCount: number;
  cloudRecordCount: number;
  cloudWatchlistCount: number;
  onResolve: (resolution: MigrationResolution) => Promise<void>;
}

export const MigrationConflictModal: React.FC<MigrationConflictModalProps> = ({
  isOpen,
  userEmail,
  localMovieCount,
  localRecordCount,
  localWatchlistCount,
  cloudMovieCount,
  cloudRecordCount,
  cloudWatchlistCount,
  onResolve,
}) => {
  const [selected, setSelected] = useState<MigrationResolution>('merge');
  const [applying, setApplying] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setApplying(true);
    try {
      await onResolve(selected);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="选择本地与云端数据同步方式"
    >
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-[#111114] border border-[#9E1B24]/50 text-[#F2EFE9] p-5 sm:p-6 space-y-5 shadow-2xl">
        <div className="space-y-1.5 border-b border-white/[0.08] pb-4">
          <div className="text-[11px] font-medium text-[#E24B55]">
            检测到云端与本机均存在观影档案
          </div>
          <h2 className="font-display text-2xl font-semibold">
            请选择如何处理本地与云端数据
          </h2>
          <p className="text-xs text-[#9E9A93] leading-relaxed">
            账户 {userEmail || ''} 云端已有观影记录，同时本机游客模式也存在记录。为确保任何记录不被意外覆盖，请确认合并方式：
          </p>
        </div>

        {/* Comparison Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-[#16161A] p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#8C8881]">
              <HardDrive className="h-3.5 w-3.5 text-[#D6D1C7]" />
              <span>当前设备本地</span>
            </div>
            <div className="font-mono-num text-sm font-semibold text-[#F2EFE9]">
              {localMovieCount} 部电影
            </div>
            <div className="font-mono-num text-[11px] text-[#8C8881]">
              已看 {localRecordCount} · 待看 {localWatchlistCount}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#16161A] p-3.5 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#8C8881]">
              <Cloud className="h-3.5 w-3.5 text-[#C9303A]" />
              <span>云端账户档案</span>
            </div>
            <div className="font-mono-num text-sm font-semibold text-[#F2EFE9]">
              {cloudMovieCount} 部电影
            </div>
            <div className="font-mono-num text-[11px] text-[#8C8881]">
              已看 {cloudRecordCount} · 待看 {cloudWatchlistCount}
            </div>
          </div>
        </div>

        {/* 3 Choices */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setSelected('merge')}
            className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
              selected === 'merge'
                ? 'border-[#C9303A] bg-[#1A1316]'
                : 'border-white/[0.08] bg-[#16161A] hover:border-white/20'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F2EFE9]">
                <GitMerge className="h-3.5 w-3.5 text-[#E24B55]" />
                <span>智能合并去重（推荐）</span>
              </span>
              <span className="text-[10px] text-[#E24B55] font-medium">最安全</span>
            </div>
            <p className="mt-1 text-[11px] text-[#8C8881] leading-relaxed">
              保留两边所有不重复的电影、观影记录与待看片单；同名同年份电影自动去重，冲突字段保留最新修改时间版本。
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelected('prefer_cloud')}
            className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
              selected === 'prefer_cloud'
                ? 'border-[#C9303A] bg-[#1A1316]'
                : 'border-white/[0.08] bg-[#16161A] hover:border-white/20'
            }`}
          >
            <div className="text-xs font-semibold text-[#F2EFE9]">
              仅保留云端数据（同步至当前设备）
            </div>
            <p className="mt-1 text-[11px] text-[#8C8881]">
              放弃本机当前未同步的游客记录，完整使用云端已有档案。
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelected('prefer_local')}
            className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
              selected === 'prefer_local'
                ? 'border-[#C9303A] bg-[#1A1316]'
                : 'border-white/[0.08] bg-[#16161A] hover:border-white/20'
            }`}
          >
            <div className="text-xs font-semibold text-[#F2EFE9]">
              以本机数据为准（覆盖云端档案）
            </div>
            <p className="mt-1 text-[11px] text-[#8C8881]">
              将当前设备的数据完整覆盖至云端账户。
            </p>
          </button>
        </div>

        <button
          type="button"
          disabled={applying}
          onClick={handleConfirm}
          className="w-full h-11 rounded-xl bg-[#A31C24] hover:bg-[#BE222C] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>确认并执行同步</span>
        </button>
      </div>
    </div>
  );
};
