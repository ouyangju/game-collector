"use client";

/**
 * 客户端工具：安全读取 JSON 响应 + 上传前压缩图片。
 *
 * 背景：EdgeOne 对单次请求体有约 6MB 上限，超过会被边缘层直接返回 HTML 错误页
 * （500 text/html），此时直接 res.json() 会抛 "Unexpected token '<'"。
 * 因此上传前先把图片压缩到阈值以下，并在解析前检查响应内容类型。
 */

/** EdgeOne 请求体约 6MB，预留余量，压缩目标定在 4MB */
export const UPLOAD_SAFE_BYTES = 4 * 1024 * 1024;
/** 允许选择的原始图片上限（压缩前） */
export const PICK_MAX_BYTES = 20 * 1024 * 1024;

/** 安全解析响应：先判断 HTTP 状态与 Content-Type，再解析 JSON */
export async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const type = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok || !type.includes("application/json")) {
    if (type.includes("text/html")) {
      throw new Error("服务器或边缘节点返回了错误页（可能是图片过大或临时故障），请压缩图片后重试");
    }
    let detail = "";
    try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
    throw new Error(detail || `请求失败（HTTP ${res.status}）`);
  }
  return (await res.json()) as Record<string, unknown>;
}

/**
 * 客户端压缩图片：长边不超过 maxEdge，输出 JPEG（保留透明度的 PNG 会转 JPEG 白底）。
 * 循环降低质量直到体积低于 UPLOAD_SAFE_BYTES。
 */
export async function compressImage(file: File, maxEdge = 1920): Promise<File> {
  // 小图且体积安全，无需压缩
  if (file.size <= UPLOAD_SAFE_BYTES) return file;

  const bitmap = await loadBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器不支持图片压缩");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    let quality = 0.85;
    let blob: Blob | null = null;
    for (let i = 0; i < 6; i++) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= UPLOAD_SAFE_BYTES) break;
      quality -= 0.12;
      if (quality < 0.2) break;
    }
    if (!blob || blob.size > UPLOAD_SAFE_BYTES) {
      throw new Error("图片过大，压缩后仍超过 4MB，请换一张更小的图片");
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).catch(() => loadViaImage(file));
  }
  return loadViaImage(file);
}

function loadViaImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片读取失败")); };
    img.src = url;
  });
}
