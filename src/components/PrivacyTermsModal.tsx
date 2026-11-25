import React from 'react';
import { ShieldCheck, X } from 'lucide-react';

interface PrivacyTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="隐私政策与用户协议"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl max-h-[88vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden bg-[#111114] border border-white/[0.12] text-[#F2EFE9] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#C9303A]" />
            <h2 className="font-display text-xl font-semibold">
              隐私政策与用户协议
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

        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-[#B8B4AC] leading-relaxed">
          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-[#F2EFE9]">
              1. 游客模式与本地优先原则
            </h3>
            <p>
              Horror Diary 默认以游客模式运行。未注册或未登录时，你的电影档案、评分、观后感、Scare
              Meter 与待看列表仅保存在当前浏览器的本地存储中，不会上传至任何远端服务器。
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-[#F2EFE9]">
              2. 账户信息与最小化收集
            </h3>
            <p>
              当你主动选择注册或登录账户以开启云端同步时，我们仅收集实现身份验证与跨设备同步所必需的信息：注册邮箱、系统分配的唯一账户标识（UID）及可选昵称。我们不收集手机号、通讯录、地理位置或与观影记录无关的个人信息。
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-[#F2EFE9]">
              3. 密码安全与数据隔离
            </h3>
            <p>
              账户密码通过行业标准的加密身份认证服务（Firebase Authentication）处理与托管，应用与云端数据库绝不以明文存储密码。所有云端观影记录均通过 HTTPS 传输，并按账户 UID 严格隔离，任何其他用户均无法读取、检索或修改你的个人档案。
            </p>
          </section>

          <section className="space-y-1.5">
            <h3 className="text-sm font-semibold text-[#F2EFE9]">
              4. 数据导出、退出与账户删除权
            </h3>
            <p>
              你可以随时在个人中心或档案页导出完整的 JSON 数据备份。退出登录时不会擅自删除你本机已缓存的观影记录；若你主动申请删除账户，系统将永久清空云端数据库中的全部观影记录及账户信息，删除后你仍可以游客模式继续使用本应用。
            </p>
          </section>
        </div>

        <div className="px-5 py-3.5 border-t border-white/[0.08] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#A31C24] hover:bg-[#BE222C] text-white text-xs font-medium px-5 py-2.5 min-h-[40px] transition-colors cursor-pointer"
          >
            我已阅读并了解
          </button>
        </div>
      </div>
    </div>
  );
};
