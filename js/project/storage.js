// sessionStorage 存取：关闭标签页/浏览器即清理（产品语义见 README）。
// Uint8Array 编码为 base64 存储；总量 < 100KB，远低于 ~5MB 配额。

const KEY = 'pixel-studio.project.v1';

export function saveProject(project) {
  try {
    const data = {
      version: 1,
      code: project.code,
      sprites: bytesToBase64(project.sprites),
      map: bytesToBase64(project.map),
      sfx: project.sfx || null,   // 小对象，直接 JSON
      music: project.music || null,
      palette: project.palette || 'pico8',
    };
    sessionStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('自动保存失败', e);
    return false;
  }
}

export function loadProject() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (d.version !== 1 || typeof d.code !== 'string') return null;
    const sprites = base64ToBytes(d.sprites);
    const map = base64ToBytes(d.map);
    if (!sprites || sprites.length !== 16384 || !map || map.length !== 8192) return null;
    return {
      version: 1, code: d.code, sprites, map,
      sfx: d.sfx || null,
      music: d.music || null,
      palette: typeof d.palette === 'string' ? d.palette : 'pico8',
    };
  } catch (e) {
    console.warn('读取存档失败', e);
    return null;
  }
}

export function clearProject() {
  sessionStorage.removeItem(KEY);
}

// ---------- base64 ----------
export function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToBytes(b64) {
  if (typeof b64 !== 'string') return null;
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
}
