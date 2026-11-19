import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, COVER_BUCKET } from "@/lib/supabase";
import { currentUser } from "@/lib/auth";
import { fetchQQAvatar, fetchQQNickname, isValidQQ } from "@/lib/qq";

export const runtime = "nodejs";

// POST /api/qq/lookup —— 输入 QQ 号，服务端查昵称 + 下载官方头像并转存到自有 Storage。
// QQ 号不落库；只返回昵称与本地化后的头像地址供前端填入资料表单。
export async function POST(req: NextRequest) {
  const user = await currentUser(req);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const qq = String(body.qq || "").trim();
  if (!isValidQQ(qq)) {
    return NextResponse.json({ error: "请输入 5–11 位有效的 QQ 号" }, { status: 400 });
  }

  const [{ nickname }, avatar] = await Promise.all([
    fetchQQNickname(qq),
    fetchQQAvatar(qq).catch(() => null),
  ]);

  let avatarUrl: string | null = null;
  if (avatar) {
    const sb = supabaseServer();
    const path = `avatars/qq_${user.id}_${qq}_${Date.now()}.${avatar.ext}`;
    const { error } = await sb.storage
      .from(COVER_BUCKET)
      .upload(path, avatar.bytes, {
        contentType: `image/${avatar.ext === "jpg" ? "jpeg" : avatar.ext}`,
        upsert: false,
      });
    if (!error) avatarUrl = sb.storage.from(COVER_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  if (!nickname && !avatarUrl) {
    return NextResponse.json(
      { error: "暂时无法读取该 QQ 的资料，请检查号码或稍后重试（也可手动填写昵称）" },
      { status: 502 }
    );
  }

  return NextResponse.json({ nickname, avatar: avatarUrl, qq });
}
