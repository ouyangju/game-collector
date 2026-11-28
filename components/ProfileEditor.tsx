"use client";

import { useRef, useState } from "react";
import UserAvatar from "./UserAvatar";
import { compressImage, parseJsonSafe } from "@/lib/client-utils";
import type { QQInfo, SessionUser } from "@/lib/types";

type Props = {
  me: SessionUser;
  // 管理员编辑他人时传入目标用户；为空表示编辑自己
  target?: { id: string; nickname: string; avatar: string | null; bio: string } | null;
  onClose: () => void;
  onSaved: (updated: { nickname: string; avatar: string | null; bio: string }, wasSelf: boolean) => Promise<void> | void;
};

export default function ProfileEditor({ me, target, onClose, onSaved }: Props) {
  const isSelf = !target || target.id === me.id;
  const [name, setName] = useState(target?.nickname || me.nickname);
  const [avatar, setAvatar] = useState<string | null>(target ? target.avatar ?? null : me.avatar ?? null);
  const [bio, setBio] = useState(target?.bio ?? me.bio ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [qq, setQq] = useState("");
  const [qqBusy, setQqBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const lookupQQ = async () => {
    const value = qq.trim();
    if (!/^\d{5,11}$/.test(value)) {
      setMsg("请输入 5–11 位有效的 QQ 号");
      return;
    }
    setQqBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/qq/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qq: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "读取失败");
      const info = json as QQInfo;
      // 姓名同时作为登录名，需符合 2–20 位中文/字母/数字/下划线/减号；
      // QQ 昵称常含表情和符号，这里先过滤，过滤后不足 2 位则保留原名字让用户手填。
      const safeName = info.nickname.replace(/[^\w\u4e00-\u9fa5-]/g, "").trim().slice(0, 20);
      if (safeName.length >= 2) setName(safeName);
      if (info.avatar) setAvatar(info.avatar);
      setMsg(info.avatar || safeName
        ? (safeName.length >= 2
            ? "已读取 QQ 资料，确认后点「保存」即可生效 ✅"
            : "已读取头像；昵称含特殊符号已跳过，请在上方手动填写姓名")
        : "读取成功，但没有可用资料，请手动填写");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "读取失败");
    } finally {
      setQqBusy(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", await compressImage(file));
      const suffix = isSelf ? "" : `?target_user_id=${encodeURIComponent(target!.id)}`;
      const res = await fetch(`/api/profile/avatar${suffix}`, { method: "POST", body: fd });
      const json = await parseJsonSafe(res);
      setAvatar(typeof json.url === "string" ? json.url : "");
      setMsg("头像已上传，点「保存」生效 ✅");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setMsg("姓名至少需要 2 个字");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const body: Record<string, unknown> = { nickname: trimmed, avatar, bio };
      if (!isSelf) body.user_id = target!.id;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "保存失败");
      await onSaved({ nickname: trimmed, avatar, bio }, isSelf);
      onClose();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-3 backdrop-blur-sm sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-butter-2 bg-cream p-5 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">{isSelf ? "✎ 编辑个人主页" : "✎ 编辑群友主页"}</h3>
          <button type="button" onClick={onClose} aria-label="关闭" className="rounded-lg px-2 py-1 text-muted hover:bg-butter/30 hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-xs text-muted">
          {isSelf
            ? "修改姓名后，登录所用账户名也会同步更改，请记住新名字。"
            : `正在以管理员身份编辑「${target?.nickname}」的主页。`}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <UserAvatar name={name || "我"} avatar={avatar} size={64} />
          <div className="min-w-0 flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-ghost w-full text-xs">
              📷 上传头像
            </button>
            {avatar ? (
              <button type="button" onClick={() => setAvatar(null)} className="mt-1 w-full text-center text-[11px] text-muted underline hover:text-red-600">
                恢复默认头像
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-butter-2 bg-white/70 p-3">
          <div className="text-sm font-medium">🫧 用 QQ 号一键填入</div>
          <p className="mt-0.5 text-[11px] text-muted">读取 QQ 昵称与头像填入下方，确认后保存。QQ 号本身不会被保存。</p>
          <div className="mt-2 flex gap-2">
            <input
              value={qq}
              onChange={(e) => setQq(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void lookupQQ(); }}
              inputMode="numeric"
              maxLength={11}
              placeholder="输入你的 QQ 号"
              className="input min-w-0 flex-1"
            />
            <button type="button" onClick={() => void lookupQQ()} disabled={qqBusy || busy} className="btn shrink-0 px-3 text-xs">
              {qqBusy ? "读取中…" : "读取"}
            </button>
          </div>
        </div>

        <label className="mt-5 block text-sm font-medium">姓名（显示名 = 登录名）</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder="2–20 个中文/字母/数字"
          className="input mt-2"
        />

        <label className="mt-4 block text-sm font-medium">个性签名</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={200}
          rows={3}
          placeholder="写一句介绍自己的话吧～"
          className="input mt-2 min-h-[84px] resize-y"
        />
        <div className="mt-1 text-right text-[11px] text-muted">{bio.length}/200</div>

        {msg ? <p className="mt-3 text-xs text-primary-dark">{msg}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">取消</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="btn">
            {busy ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
