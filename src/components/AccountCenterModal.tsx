import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  Download,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
  User as UserIcon,
  WifiOff,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  HorrorArchiveState,
  SyncStatusState,
  UserSettings,
  WATCH_METHODS,
  WatchMethod,
} from '../types/horror';

import { validateNickname } from '../utils/nickname';

interface AccountCenterModalProps {
  isOpen: boolean;
  user: User | null;
  syncStatus: SyncStatusState;
  syncError: string | null;
  lastSyncedAt: string | null;
  pendingCount: number;
  settings: UserSettings;
  archiveState: HorrorArchiveState;
  onClose: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenPrivacy: () => void;
  onManualSync: () => Promise<void>;
  onUpdateSettings: (next: UserSettings) => Promise<{ ok: boolean; message?: string }>;
  onImportArchive: (jsonText: string) => { ok: boolean; message: string };
  onLogout: (clearLocalCache: boolean) => Promise<void>;
  onDeleteAccount: (currentPassword?: string) => Promise<{ ok: boolean; message?: string }>;
}

export const AccountCenterModal: React.FC<AccountCenterModalProps> = ({
  isOpen,
  user,
  syncStatus,
  syncError,
  lastSyncedAt,
  pendingCount,
  settings,
  archiveState,
  onClose,
  onOpenAuth,
  onOpenPrivacy,
  onManualSync,
  onUpdateSettings,
  onImportArchive,
  onLogout,
  onDeleteAccount,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editingName, setEditingName] = useState(settings.display_name || '');
  const [nameSavedHint, setNameSavedHint] = useState(false);
  const [nicknameError, setNicknameError] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const [backupNotice, setBackupNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [clearLocalOnLogout, setClearLocalOnLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [deleteStepOpen, setDeleteStepOpen] = useState(false);
  const [deleteKeyword, setDeleteKeyword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteNeedsPassword, setDeleteNeedsPassword] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setEditingName(settings.display_name || '');
    setNameSavedHint(false);
    setNicknameError('');
    setLogoutConfirmOpen(false);
    setDeleteStepOpen(false);
    setDeleteKeyword('');
    setDeletePassword('');
    setDeleteNeedsPassword(false);
    setDeleteError('');
  }, [isOpen, settings.display_name]);

  if (!isOpen) return null;

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return '尚未同步';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleExportJson = () => {
    const payload = JSON.stringify(archiveState, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `horror-diary-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setBackupNotice({ type: 'success', text: '已导出个人观影档案 JSON 备份文件。' });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const res = onImportArchive(reader.result);
        setBackupNotice({
          type: res.ok ? 'success' : 'error',
          text: res.message,
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveNickname = async () => {
    setNicknameError('');
    setNameSavedHint(false);
    const trimmed = editingName.trim();
    if (!trimmed) {
      setNicknameError('请输入 2–32 位英文与常用符号组合的昵称。');
      return;
    }
    const validation = validateNickname(trimmed);
    if (!validation.ok) {
      setNicknameError(validation.message);
      return;
    }

    setSavingNickname(true);
    try {
      const res = await onUpdateSettings({
        display_name: validation.nickname,
        default_watch_method: settings.default_watch_method ?? '独自',
      });
      if (!res.ok) {
        setNicknameError(res.message || '昵称保存失败，请重试。');
        return;
      }
      setEditingName(validation.nickname);
      setNameSavedHint(true);
      setTimeout(() => setNameSavedHint(false), 1800);
    } finally {
      setSavingNickname(false);
    }
  };

  const handleSelectWatchMethod = async (nextMethod: WatchMethod) => {
    await onUpdateSettings({
      display_name: settings.display_name,
      default_watch_method: nextMethod,
    });
  };

  const handleConfirmLogout = async () => {
    setLoggingOut(true);
    try {
      await onLogout(clearLocalOnLogout);
      setLogoutConfirmOpen(false);
      setClearLocalOnLogout(false);
    } finally {
      setLoggingOut(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    setDeleteError('');
    if (deleteKeyword.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('请先输入 DELETE 以确认永久删除账户。');
      return;
    }
    setDeleting(true);
    try {
      const res = await onDeleteAccount(deletePassword || undefined);
      if (!res.ok) {
        if (res.message?.includes('核验') || res.message?.includes('密码')) {
          setDeleteNeedsPassword(true);
        }
        setDeleteError(res.message || '账户删除失败，请稍后重试。');
        return;
      }
      setDeleteStepOpen(false);
      setDeleteKeyword('');
      setDeletePassword('');
      setDeleteNeedsPassword(false);
    } finally {
      setDeleting(false);
    }
  };

  const renderSyncBadge = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <div className="flex items-center gap-2 text-xs text-[#D6D1C7]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E24B55]" />
            <span>正在与云端同步档案...</span>
          </div>
        );
      case 'synced':
        return (
          <div className="flex items-center gap-2 text-xs text-[#C7C3BB]">
            <Cloud className="h-3.5 w-3.5 text-[#E24B55]" />
            <span>
              云端已同步 · 最近同步 {formatSyncTime(lastSyncedAt)}
            </span>
          </div>
        );
      case 'offline':
        return (
          <div className="flex items-center gap-2 text-xs text-[#D6D1C7]">
            <WifiOff className="h-3.5 w-3.5 text-[#9E9A93]" />
            <span>
              当前处于离线状态 · 修改已暂存本地（待同步 {pendingCount} 项），恢复网络后自动续传
            </span>
          </div>
        );
      case 'error':
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#E24B55]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>云端同步失败：{syncError || '网络或权限异常'}</span>
            </div>
            {pendingCount > 0 && (
              <p className="text-[11px] text-[#8C8881]">
                本地修改已安全保留（{pendingCount} 项待重试）。
              </p>
            )}
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 text-xs text-[#8C8881]">
            <CloudOff className="h-3.5 w-3.5" />
            <span>未登录 · 仅保存在当前设备本地</span>
          </div>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="个人中心与账户设置"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden bg-[#111114] border border-white/[0.12] text-[#F2EFE9] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold text-[#F2EFE9]">
              个人中心与云端同步
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭个人中心"
            className="p-2 rounded-xl text-[#8C8881] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Account Identity & Sync Status Card */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#16161A] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-full border border-white/[0.1] bg-[#1F1518] flex items-center justify-center shrink-0">
                  <UserIcon
                    className={`h-4 w-4 ${user ? 'text-[#E24B55]' : 'text-[#8C8881]'}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#F2EFE9] truncate">
                    {user
                      ? settings.display_name || user.displayName || user.email
                      : '游客模式'}
                  </div>
                  <div className="text-xs text-[#8C8881] truncate">
                    {user
                      ? user.email
                      : '无需登录即可完整使用，数据保存在当前设备'}
                  </div>
                </div>
              </div>

              {!user ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenAuth('login')}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#A31C24] hover:bg-[#BE222C] text-white text-xs font-medium px-3.5 py-2 min-h-[38px] transition-colors cursor-pointer"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    <span>登录 / 注册</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={syncStatus === 'syncing'}
                  onClick={() => void onManualSync()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#1D1D22] hover:border-[#C9303A] text-xs font-medium px-3.5 py-2 min-h-[38px] text-[#F2EFE9] disabled:opacity-60 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 text-[#E24B55] ${
                      syncStatus === 'syncing' ? 'animate-spin' : ''
                    }`}
                  />
                  <span>{syncStatus === 'error' ? '重试同步' : '立即同步'}</span>
                </button>
              )}
            </div>

            <div className="pt-3 border-t border-white/[0.06]">
              {renderSyncBadge()}
            </div>
          </section>

          {/* Local Archive Summary */}
          <section className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-white/[0.08] bg-[#141418] p-3.5">
              <div className="text-[11px] text-[#8C8881]">档案电影</div>
              <div className="mt-1 font-mono-num text-xl font-semibold text-[#F2EFE9]">
                {archiveState.movies.length}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#141418] p-3.5">
              <div className="text-[11px] text-[#8C8881]">已看记录</div>
              <div className="mt-1 font-mono-num text-xl font-semibold text-[#F2EFE9]">
                {archiveState.watchRecords.length}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#141418] p-3.5">
              <div className="text-[11px] text-[#8C8881]">待看片单</div>
              <div className="mt-1 font-mono-num text-xl font-semibold text-[#F2EFE9]">
                {archiveState.watchlist.length}
              </div>
            </div>
          </section>

          {/* Personal Preferences */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#16161A] p-4 sm:p-5 space-y-4">
            <h3 className="text-xs font-semibold text-[#F2EFE9]">个人档案设置</h3>

            {user && (
              <div className="space-y-1.5">
                <label
                  htmlFor="profile-nickname"
                  className="block text-[11px] text-[#8C8881]"
                >
                  账户唯一昵称（可用于登录）
                </label>
                <div className="flex gap-2">
                  <input
                    id="profile-nickname"
                    type="text"
                    maxLength={32}
                    value={editingName}
                    onChange={(e) => {
                      setEditingName(e.target.value);
                      if (nicknameError) setNicknameError('');
                      if (nameSavedHint) setNameSavedHint(false);
                    }}
                    placeholder="仅限英文与符号，如 midnight_owl"
                    className="flex-1 h-9 rounded-xl bg-[#0D0D10] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none px-3 text-xs text-[#F2EFE9]"
                  />
                  <button
                    type="button"
                    disabled={savingNickname}
                    onClick={() => void handleSaveNickname()}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/[0.1] bg-[#1D1D22] hover:border-[#C9303A] disabled:opacity-60 px-3.5 h-9 text-xs text-[#F2EFE9] transition-colors cursor-pointer"
                  >
                    {savingNickname ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#E24B55]" />
                    ) : nameSavedHint ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#E24B55]" />
                        <span>已保存</span>
                      </>
                    ) : (
                      <span>保存</span>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-[#76726B]">
                  仅允许英文字母与常用符号组合（2–32 位，不支持中文、数字或空格），不允许重复。
                </p>
                {nicknameError && (
                  <p className="text-[11px] text-[#E24B55]">{nicknameError}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[11px] text-[#8C8881]">默认观影方式</div>
              <div className="grid grid-cols-3 gap-2">
                {WATCH_METHODS.map((method) => {
                  const active = (settings.default_watch_method || '独自') === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => void handleSelectWatchMethod(method)}
                      className={`h-9 rounded-xl text-xs border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#A31C24] border-[#C9303A] text-white font-medium'
                          : 'bg-[#0D0D10] border-white/[0.08] text-[#8C8881] hover:text-white'
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Data Export & Backup */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#16161A] p-4 sm:p-5 space-y-3">
            <h3 className="text-xs font-semibold text-[#F2EFE9]">数据导出与本地备份</h3>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#1D1D22] hover:border-[#C9303A] text-xs font-medium px-3.5 py-2 min-h-[38px] text-[#F2EFE9] transition-colors cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#E24B55]" />
                <span>导出 JSON 备份</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-[#1D1D22] hover:border-white/25 text-xs font-medium px-3.5 py-2 min-h-[38px] text-[#F2EFE9] transition-colors cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5 text-[#9E9A93]" />
                <span>从备份恢复</span>
              </button>
            </div>
            {backupNotice && (
              <p
                className={`text-xs ${
                  backupNotice.type === 'success' ? 'text-[#D6D1C7]' : 'text-[#E24B55]'
                }`}
              >
                {backupNotice.text}
              </p>
            )}
          </section>

          {/* Logout & Account Deletion (Authenticated Only) */}
          {user && (
            <section className="rounded-2xl border border-white/[0.08] bg-[#16161A] p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-semibold text-[#F2EFE9]">账户会话与安全</h3>

              {!logoutConfirmOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={() => setLogoutConfirmOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.1] hover:border-white/25 bg-[#1D1D22] text-xs font-medium px-3.5 py-2 min-h-[38px] text-[#F2EFE9] transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 text-[#9E9A93]" />
                    <span>退出登录</span>
                  </button>

                  {!deleteStepOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteStepOpen(true);
                        setDeleteError('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl text-xs text-[#8C8881] hover:text-[#E24B55] px-2.5 py-2 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>删除账户</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-white/[0.1] bg-[#1A1A20] p-3.5 space-y-3">
                  <p className="text-xs text-[#D6D1C7] leading-relaxed">
                    退出登录后将清除当前账户的登录凭证并切换回<strong>游客模式</strong>。当前设备中已保存的电影档案属于本地缓存，退出时<strong>不会删除本地数据</strong>。
                  </p>
                  <label className="flex items-center gap-2 text-[11px] text-[#9E9A93] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clearLocalOnLogout}
                      onChange={(e) => setClearLocalOnLogout(e.target.checked)}
                      className="accent-[#A31C24]"
                    />
                    <span>同时清除本机缓存并重置为初始状态（默认不清除）</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={loggingOut}
                      onClick={handleConfirmLogout}
                      className="rounded-xl bg-[#A31C24] hover:bg-[#BE222C] text-white text-xs font-medium px-3.5 py-2 min-h-[36px] transition-colors cursor-pointer"
                    >
                      {loggingOut ? '退出中...' : '确认退出登录'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLogoutConfirmOpen(false);
                        setClearLocalOnLogout(false);
                      }}
                      className="rounded-xl text-xs text-[#8C8881] hover:text-white px-3 py-2 transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* Account Deletion Two-Step Guard */}
              {deleteStepOpen && (
                <div className="rounded-xl border border-[#9E1B24]/55 bg-[#1A1114] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#E24B55]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>永久删除账户与云端数据</span>
                  </div>
                  <p className="text-xs text-[#C7C3BB] leading-relaxed">
                    删除后，云端存储的全部观影记录、评分、待看片单与账户信息将被<strong>永久删除且无法恢复</strong>。本机仍可继续以游客模式使用。建议在删除前先导出备份：
                  </p>

                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#0D0D10] hover:border-[#C9303A] text-xs px-3 py-1.5 text-[#F2EFE9] transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5 text-[#E24B55]" />
                    <span>删除前先导出 JSON 备份</span>
                  </button>

                  <div className="space-y-2 pt-1">
                    <label className="block text-[11px] text-[#9E9A93]">
                      输入 <span className="font-mono-num text-[#F2EFE9]">DELETE</span> 完成二次确认
                    </label>
                    <input
                      type="text"
                      value={deleteKeyword}
                      onChange={(e) => setDeleteKeyword(e.target.value)}
                      placeholder="输入 DELETE"
                      className="w-full h-9 rounded-xl bg-[#0D0D10] border border-white/[0.12] focus:border-[#C9303A] focus:outline-none px-3 text-xs text-[#F2EFE9]"
                    />

                    {deleteNeedsPassword && (
                      <div className="space-y-1">
                        <label className="block text-[11px] text-[#E24B55]">
                          请输入当前登录密码以核验身份
                        </label>
                        <input
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="当前密码"
                          className="w-full h-9 rounded-xl bg-[#0D0D10] border border-[#C9303A]/60 focus:border-[#C9303A] focus:outline-none px-3 text-xs text-[#F2EFE9]"
                        />
                      </div>
                    )}
                  </div>

                  {deleteError && (
                    <p className="text-xs text-[#E24B55]">{deleteError}</p>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleConfirmDeleteAccount}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#A31C24] hover:bg-[#BE222C] text-white text-xs font-medium px-3.5 py-2 min-h-[36px] disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>确认永久删除账户</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteStepOpen(false);
                        setDeleteKeyword('');
                        setDeletePassword('');
                        setDeleteNeedsPassword(false);
                        setDeleteError('');
                      }}
                      className="rounded-xl text-xs text-[#8C8881] hover:text-white px-3 py-2 transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Privacy Policy Footer Link */}
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px] text-[#76726B]">
            <button
              type="button"
              onClick={onOpenPrivacy}
              className="inline-flex items-center gap-1.5 hover:text-[#D6D1C7] cursor-pointer"
            >
              <Shield className="h-3.5 w-3.5 text-[#C9303A]" />
              <span>查看隐私政策与用户协议</span>
            </button>
            <span>本地优先 · 账户隔离</span>
          </div>
        </div>
      </div>
    </div>
  );
};
