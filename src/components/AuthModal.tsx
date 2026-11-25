import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  checkNicknameAvailability,
  loginWithIdentifier,
  mapAuthErrorMessage,
  registerWithEmail,
  sendPasswordReset,
} from '../services/cloudSync';
import { validateNickname } from '../utils/nickname';

type AuthMode = 'login' | 'register' | 'forgot';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthMode;
  onClose: () => void;
  onOpenPrivacy: () => void;
  onAuthSuccess: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onOpenPrivacy,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState<{
    state: 'idle' | 'checking' | 'available' | 'invalid';
    message?: string;
  }>({ state: 'idle' });
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setErrorMsg('');
    setInfoMsg('');
    setPassword('');
    setConfirmPassword('');
    setNicknameStatus({ state: 'idle' });
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleNicknameChange = (value: string) => {
    setDisplayName(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setNicknameStatus({ state: 'idle' });
      return;
    }
    const validation = validateNickname(trimmed);
    if (!validation.ok) {
      setNicknameStatus({ state: 'invalid', message: validation.message });
    } else {
      setNicknameStatus({ state: 'idle' });
    }
  };

  const handleNicknameBlur = async () => {
    if (mode !== 'register') return;
    const trimmed = displayName.trim();
    if (!trimmed) {
      setNicknameStatus({ state: 'idle' });
      return;
    }
    const validation = validateNickname(trimmed);
    if (!validation.ok) {
      setNicknameStatus({ state: 'invalid', message: validation.message });
      return;
    }
    setNicknameStatus({ state: 'checking', message: '正在检查昵称是否可用...' });
    try {
      const avail = await checkNicknameAvailability(trimmed);
      if (avail.available) {
        setNicknameStatus({
          state: 'available',
          message: '该昵称可用，注册后将与账户唯一绑定。',
        });
      } else {
        setNicknameStatus({
          state: 'invalid',
          message: avail.message || '该昵称已被占用，不允许重复昵称。',
        });
      }
    } catch {
      setNicknameStatus({ state: 'idle' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setErrorMsg(
        mode === 'register'
          ? '请输入邮箱地址。'
          : '请输入邮箱地址或英文符号昵称。'
      );
      return;
    }

    if (mode === 'forgot') {
      setSubmitting(true);
      try {
        await sendPasswordReset(trimmedIdentifier);
        setInfoMsg(
          '密码重置邮件已发送至该账户绑定的邮箱，请查收并按提示重设密码。'
        );
      } catch (err) {
        setErrorMsg(mapAuthErrorMessage(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('密码长度至少为 6 位。');
      return;
    }

    if (mode === 'register') {
      const trimmedNick = displayName.trim();
      if (trimmedNick) {
        const validation = validateNickname(trimmedNick);
        if (!validation.ok) {
          setNicknameStatus({ state: 'invalid', message: validation.message });
          setErrorMsg(validation.message);
          return;
        }
      }
      if (confirmPassword && confirmPassword !== password) {
        setErrorMsg('两次输入的密码不一致，请核对。');
        return;
      }
      if (!agreedTerms) {
        setErrorMsg('请先阅读并同意隐私政策与用户协议。');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await registerWithEmail(trimmedIdentifier, password, displayName);
      } else {
        await loginWithIdentifier(trimmedIdentifier, password);
      }
      onAuthSuccess();
      onClose();
    } catch (err) {
      setErrorMsg(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === 'register'
          ? '注册 Horror Diary 账户'
          : mode === 'forgot'
            ? '找回密码'
            : '登录 Horror Diary 账户'
      }
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[#111114] border border-white/[0.12] text-[#F2EFE9] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {mode === 'forgot' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                aria-label="返回登录"
                className="p-1.5 rounded-lg text-[#8C8881] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="font-display text-2xl font-semibold">
              {mode === 'register'
                ? '创建云端档案账户'
                : mode === 'forgot'
                  ? '重置登录密码'
                  : '登录个人档案'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-2 rounded-xl text-[#8C8881] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switch Tabs (Login / Register) */}
        {mode !== 'forgot' && (
          <div className="grid grid-cols-2 border-b border-white/[0.08] bg-[#0D0D10]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={`py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'border-[#C9303A] text-white bg-[#161215]'
                  : 'border-transparent text-[#8C8881] hover:text-white'
              }`}
            >
              账户登录
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setInfoMsg('');
              }}
              className={`py-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'border-[#C9303A] text-white bg-[#161215]'
                  : 'border-transparent text-[#8C8881] hover:text-white'
              }`}
            >
              注册新账户
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <p className="text-xs text-[#9E9A93] leading-relaxed">
            {mode === 'register'
              ? '注册后自动登录，可将本机已记录的恐怖片档案安全同步至云端并实现跨设备访问。'
              : mode === 'forgot'
                ? '输入你的注册邮箱或唯一昵称，系统将向绑定邮箱发送一封密码重置链接。'
                : '支持使用注册邮箱或已绑定的唯一昵称登录，在多个设备间同步观影档案。'}
          </p>

          {errorMsg && (
            <div className="rounded-xl border border-[#C9303A]/55 bg-[#9E1B24]/15 px-3.5 py-2.5 text-xs text-[#F2EFE9] leading-relaxed">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="rounded-xl border border-white/[0.12] bg-[#19191E] px-3.5 py-2.5 text-xs text-[#D6D1C7] leading-relaxed">
              {infoMsg}
            </div>
          )}

          {/* Email or Nickname */}
          <div className="space-y-1.5">
            <label
              htmlFor="auth-email"
              className="block text-xs font-medium text-[#C7C3BB]"
            >
              {mode === 'register' ? '邮箱地址' : '邮箱或昵称'}
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-[#6F6C66] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-email"
                type={mode === 'register' ? 'email' : 'text'}
                autoComplete={mode === 'register' ? 'email' : 'username'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  mode === 'register'
                    ? 'name@example.com'
                    : 'name@example.com 或英文符号昵称'
                }
                className="w-full h-11 rounded-xl bg-[#16161A] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none pl-10 pr-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label
                htmlFor="auth-nickname"
                className="block text-xs font-medium text-[#C7C3BB]"
              >
                唯一昵称 <span className="text-[#6F6C66] font-normal">（选填，可用于登录）</span>
              </label>
              <div className="relative">
                <UserIcon className="h-4 w-4 text-[#6F6C66] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-nickname"
                  type="text"
                  maxLength={32}
                  value={displayName}
                  onChange={(e) => handleNicknameChange(e.target.value)}
                  onBlur={() => void handleNicknameBlur()}
                  placeholder="例如：midnight_owl 或 ghost!"
                  className="w-full h-11 rounded-xl bg-[#16161A] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none pl-10 pr-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                />
              </div>
              <p className="text-[11px] text-[#76726B] leading-relaxed">
                仅允许英文字母与常用符号组合（2–32 位，不支持中文、数字或空格），全站不可重复。
              </p>
              {nicknameStatus.state === 'checking' && (
                <p className="text-[11px] text-[#9E9A93] flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{nicknameStatus.message}</span>
                </p>
              )}
              {nicknameStatus.state === 'available' && (
                <p className="text-[11px] text-[#D6D1C7] flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-[#E24B55]" />
                  <span>{nicknameStatus.message}</span>
                </p>
              )}
              {nicknameStatus.state === 'invalid' && nicknameStatus.message && (
                <p className="text-[11px] text-[#E24B55]">
                  {nicknameStatus.message}
                </p>
              )}
            </div>
          )}

          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-[#C7C3BB]"
                >
                  密码
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg('');
                      setInfoMsg('');
                    }}
                    className="text-[11px] text-[#9E9A93] hover:text-[#E24B55] cursor-pointer"
                  >
                    忘记密码？
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="h-4 w-4 text-[#6F6C66] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={
                    mode === 'register' ? 'new-password' : 'current-password'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位密码"
                  className="w-full h-11 rounded-xl bg-[#16161A] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none pl-10 pr-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-xs font-medium text-[#C7C3BB]"
                >
                  确认密码{' '}
                  <span className="text-[#6F6C66] font-normal">（选填）</span>
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-[#6F6C66] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码以确认"
                    className="w-full h-11 rounded-xl bg-[#16161A] border border-white/[0.1] focus:border-[#C9303A] focus:outline-none pl-10 pr-3.5 text-sm text-[#F2EFE9] placeholder:text-[#6F6C66]"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-[#9E9A93] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 accent-[#A31C24] cursor-pointer"
                />
                <span>
                  我已阅读并同意{' '}
                  <button
                    type="button"
                    onClick={onOpenPrivacy}
                    className="text-[#E24B55] hover:underline cursor-pointer"
                  >
                    隐私政策与用户协议
                  </button>
                </span>
              </label>
            </>
          )}

          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-[#A31C24] hover:bg-[#BE222C] disabled:opacity-60 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {mode === 'register'
                  ? '注册并开启云端同步'
                  : mode === 'forgot'
                    ? '发送密码重置邮件'
                    : '登录账户'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full h-10 rounded-xl border border-white/[0.08] hover:border-white/20 text-xs text-[#8C8881] hover:text-white transition-colors cursor-pointer"
            >
              暂不登录，继续以游客模式使用
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
