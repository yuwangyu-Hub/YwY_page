/* Spritely 本地版 — 视频/图片转精灵图集
 * 核心处理全部在浏览器内完成，无需后端、不上传文件。
 */

// ---------- 全局状态 ----------
const state = {
    rawFrames: [],        // 原始抽取帧 (canvas, 已限制最大边长)
    finalFrames: [],      // 处理后最终帧 (canvas, 统一尺寸)
    selected: new Set(),  // 选中的帧索引
    targetColor: null,    // 色键目标色 {r,g,b}
    chromaEnabled: false,
    haloEnabled: false,
    canvasSize: 256,
    cropMode: 'relative',
    position: 'center',
    tolerance: 50,
    expansion: 2,
    exportFps: 30,
    videoMode: true,
};

const MAX_DIM = 512;   // 抽取帧最大边长，控制内存/性能
const MAX_FRAMES = 600;

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const dropZone = $('dropZone');
const videoEl = $('videoEl');

// ---------- 工具函数 ----------
function cloneCanvas(c) {
    const n = document.createElement('canvas');
    n.width = c.width; n.height = c.height;
    n.getContext('2d').drawImage(c, 0, 0);
    return n;
}
function getImageData(c) { return c.getContext('2d').getImageData(0, 0, c.width, c.height); }
function canvasFromImageData(img) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function fmt(n) { return Math.round(n); }

// ---------- 文件上传 ----------
$('uploadBtn').onclick = () => fileInput.click();
dropZone.onclick = () => fileInput.click();
['dragover', 'dragenter'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('dragover'); }));
dropZone.addEventListener('drop', ev => handleFiles(ev.dataTransfer.files));
fileInput.onchange = () => handleFiles(fileInput.files);

async function handleFiles(fileList) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const videos = files.filter(f => f.type.startsWith('video/'));
    const images = files.filter(f => f.type.startsWith('image/'));

    state.selected.clear();
    if (videos.length) {
        state.videoMode = true;
        await setupVideo(videos[0]);
    } else if (images.length) {
        state.videoMode = false;
        $('settingsSection').style.display = 'none';
        const frames = await loadImages(images);
        state.rawFrames = frames;
        afterExtractionReady();
    } else {
        $('uploadInfo').textContent = '未识别到支持的视频或图片文件。';
    }
}

function loadImages(files) {
    return Promise.all(files.map(f => new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
            const capped = fitWithin(img.naturalWidth, img.naturalHeight, MAX_DIM);
            const c = document.createElement('canvas');
            c.width = capped.w; c.height = capped.h;
            c.getContext('2d').drawImage(img, 0, 0, capped.w, capped.h);
            URL.revokeObjectURL(img.src);
            res(c);
        };
        img.onerror = rej;
        img.src = URL.createObjectURL(f);
    })));
}

function fitWithin(w, h, max) {
    const scale = Math.min(1, max / Math.max(w, h));
    return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

async function setupVideo(file) {
    $('settingsSection').style.display = 'block';
    videoEl.src = URL.createObjectURL(file);
    await new Promise((res) => {
        if (videoEl.readyState >= 1) return res();
        videoEl.onloadedmetadata = res;
    });
    const dur = videoEl.duration || 5;
    $('endFrame').value = fmt(Math.min(5, dur));
    $('startFrame').value = 0;
    $('uploadInfo').textContent = `视频已加载：时长 ${dur.toFixed(2)}s，分辨率 ${videoEl.videoWidth}×${videoEl.videoHeight}`;
}

// ---------- 抽帧 ----------
$('startProcessing').onclick = async () => {
    if (state.videoMode) {
        const start = Math.max(0, parseFloat($('startFrame').value) || 0);
        const end = Math.min(videoEl.duration || 5, parseFloat($('endFrame').value) || 5);
        const every = Math.max(1, parseInt($('extractEvery').value) || 1);
        const fps = Math.max(1, parseInt($('exportFps').value) || 30);
        state.exportFps = fps;
        const frames = await extractFramesFromVideo(videoEl, start, end, every, fps);
        state.rawFrames = frames;
        afterExtractionReady();
    }
};

async function extractFramesFromVideo(video, start, end, everyN, fps) {
    $('processingBar').style.display = 'block';
    const step = 1 / fps;
    const times = [];
    let idx = 0;
    for (let t = start; t <= end + 1e-6; t += step) {
        if (idx % everyN === 0) times.push(Math.min(t, (video.duration || end) - 0.001));
        idx++;
    }
    if (times.length > MAX_FRAMES) times.length = MAX_FRAMES;
    $('frameCountInfo').textContent = `范围内总帧数: ${fmt((end - start) * fps)} 帧 · 将抽取: ~${times.length} 帧`;

    const frames = [];
    for (let i = 0; i < times.length; i++) {
        const c = await grabFrame(video, times[i]);
        frames.push(c);
        const p = Math.round(((i + 1) / times.length) * 100);
        $('processingFill').style.width = p + '%';
        $('processingText').textContent = `抽取中… ${p}% (${i + 1}/${times.length})`;
        // 让出主线程
        await new Promise(r => setTimeout(r, 0));
    }
    $('processingBar').style.display = 'none';
    return frames;
}

function grabFrame(video, t) {
    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return; done = true;
            video.removeEventListener('seeked', finish);
            const capped = fitWithin(video.videoWidth, video.videoHeight, MAX_DIM);
            const c = document.createElement('canvas');
            c.width = capped.w; c.height = capped.h;
            c.getContext('2d').drawImage(video, 0, 0, capped.w, capped.h);
            resolve(c);
        };
        video.addEventListener('seeked', finish);
        try { video.currentTime = t; } catch (e) {}
        // 兜底：若 seeked 未触发
        setTimeout(finish, 600);
    });
}

// ---------- 抽取完成后的流程 ----------
function afterExtractionReady() {
    $('framesSection').style.display = 'block';
    $('step1').style.display = 'block';
    $('step2').style.display = 'block';
    $('step3').style.display = 'block';
    $('downloadSection').style.display = 'block';

    state.selected = new Set(state.rawFrames.map((_, i) => i));
    setupPickCanvas();
    setupPresetButtons();
    reprocess();
    $('uploadInfo').textContent = `已就绪：${state.rawFrames.length} 帧`;
}

// ---------- Step1 色键 ----------
function setupPickCanvas() {
    const pc = $('pickCanvas');
    const first = state.rawFrames[0];
    pc.width = first.width; pc.height = first.height;
    pc.getContext('2d').drawImage(first, 0, 0);
}
$('pickBtn').onclick = () => {
    const pc = $('pickCanvas');
    pc.style.outline = '2px solid #667eea';
    const handler = (e) => {
        const rect = pc.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left) / rect.width * pc.width);
        const y = Math.round((e.clientY - rect.top) / rect.height * pc.height);
        const d = pc.getContext('2d').getImageData(x, y, 1, 1).data;
        state.targetColor = { r: d[0], g: d[1], b: d[2] };
        $('targetSwatch').style.background = `rgb(${d[0]},${d[1]},${d[2]})`;
        $('targetRgb').textContent = `RGB(${d[0]}, ${d[1]}, ${d[2]})`;
        pc.removeEventListener('click', handler);
        pc.style.outline = 'none';
    };
    pc.addEventListener('click', handler);
};
$('tolerance').oninput = (e) => { state.tolerance = +e.target.value; $('tolVal').textContent = state.tolerance; };
$('applyChroma').onclick = () => {
    if (!state.targetColor) { alert('请先点击画面取色'); return; }
    state.chromaEnabled = true;
    reprocess();
};
$('cancelChroma').onclick = () => { state.chromaEnabled = false; reprocess(); };

// ---------- Step2 自动裁剪 ----------
function setupPresetButtons() {
    const presets = [24, 48, 96, 128, 192, 256, 512, 1024];
    const box = $('presetBtns');
    box.innerHTML = '';
    presets.forEach(p => {
        const b = document.createElement('button');
        b.textContent = p;
        b.className = (p === state.canvasSize) ? 'active' : '';
        b.onclick = () => {
            state.canvasSize = p;
            Array.from(box.children).forEach(c => c.classList.remove('active'));
            b.classList.add('active');
            reprocess();
        };
        box.appendChild(b);
    });
}
$('cropMode').onchange = (e) => { state.cropMode = e.target.value; reprocess(); };
$('position').onchange = (e) => { state.position = e.target.value; reprocess(); };
$('setManual').onclick = () => {
    const v = parseInt($('manualSize').value);
    if (v > 0) { state.canvasSize = v; setupPresetButtons(); reprocess(); }
};
$('applyCrop').onclick = () => reprocess();

// ---------- Step3 去光晕 ----------
$('expansion').oninput = (e) => { state.expansion = +e.target.value; $('expandVal').textContent = state.expansion; };
$('applyHalo').onclick = () => { state.haloEnabled = true; reprocess(); };

// ---------- 处理管线 ----------
function reprocess() {
    if (!state.rawFrames.length) return;
    let frames = state.rawFrames.map(c => cloneCanvas(c));

    if (state.chromaEnabled && state.targetColor) {
        frames = frames.map(c => canvasFromImageData(
            chromaKey(getImageData(c), state.targetColor, state.tolerance)));
    }
    frames = cropFrames(frames, state.cropMode, state.canvasSize, state.position);
    if (state.haloEnabled) {
        frames = frames.map(c => haloRemoval(c, state.expansion));
    }
    state.finalFrames = frames;
    renderFrameGrid();
    renderCropPreview();
    $('downloadInfo').textContent = `当前输出尺寸: ${state.canvasSize}×${state.canvasSize}px · 选中 ${state.selected.size} / ${frames.length} 帧`;
}

// 色键：与目标色距离 < tolerance 的像素变透明
function chromaKey(img, target, tol) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] - target.r, dg = d[i + 1] - target.g, db = d[i + 2] - target.b;
        if (Math.sqrt(dr * dr + dg * dg + db * db) < tol) d[i + 3] = 0;
    }
    return img;
}

function computeBBox(img) {
    const d = img.data, w = img.width, h = img.height;
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 10) {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function placeInCanvas(src, size, position) {
    const dest = document.createElement('canvas');
    dest.width = size; dest.height = size;
    const ctx = dest.getContext('2d');
    const scale = Math.min(size / src.width, size / src.height);
    const dw = Math.max(1, Math.round(src.width * scale));
    const dh = Math.max(1, Math.round(src.height * scale));
    let dx, dy;
    if (position === 'left') dx = 0; else if (position === 'right') dx = size - dw; else dx = (size - dw) / 2;
    if (position === 'top') dy = 0; else if (position === 'bottom') dy = size - dh; else dy = (size - dh) / 2;
    ctx.drawImage(src, dx, dy, dw, dh);
    return dest;
}

function cropFrames(frames, mode, size, position) {
    let region = null;
    if (mode === 'relative') region = computeBBox(getImageData(frames[0]));
    const out = [];
    for (const f of frames) {
        let r;
        if (mode === 'relative') r = region || { x: 0, y: 0, w: f.width, h: f.height };
        else if (mode === 'center') r = computeBBox(getImageData(f)) || { x: 0, y: 0, w: f.width, h: f.height };
        else r = { x: 0, y: 0, w: f.width, h: f.height };
        r = { x: Math.max(0, r.x), y: Math.max(0, r.y),
              w: Math.min(r.w, f.width - Math.max(0, r.x)), h: Math.min(r.h, f.height - Math.max(0, r.y)) };
        const sc = document.createElement('canvas');
        sc.width = r.w; sc.height = r.h;
        sc.getContext('2d').drawImage(f, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
        out.push(placeInCanvas(sc, size, position));
    }
    return out;
}

// 去光晕：对 alpha 做 N 次腐蚀（向外扩展透明）
function haloRemoval(canvas, expansion) {
    const img = getImageData(canvas);
    const d = img.data, w = img.width, h = img.height;
    let alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3] > 10 ? 1 : 0;
    for (let k = 0; k < expansion; k++) {
        const next = alpha.slice();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x;
            if (alpha[i] === 1) {
                if ((x > 0 && alpha[i - 1] === 0) || (x < w - 1 && alpha[i + 1] === 0) ||
                    (y > 0 && alpha[i - w] === 0) || (y < h - 1 && alpha[i + w] === 0)) {
                    next[i] = 0;
                }
            }
        }
        alpha = next;
    }
    for (let i = 0; i < alpha.length; i++) if (alpha[i] === 0) d[i * 4 + 3] = 0;
    return canvasFromImageData(img);
}

// ---------- 帧网格预览 ----------
function renderFrameGrid() {
    const grid = $('frameGrid');
    grid.innerHTML = '';
    const zoom = (+$('frameZoom').value) / 100;
    const thumb = Math.max(40, Math.round(90 * zoom));
    state.finalFrames.forEach((f, i) => {
        const item = document.createElement('div');
        item.className = 'frame-item' + (state.selected.has(i) ? ' selected' : '');
        const c = document.createElement('canvas');
        c.width = thumb; c.height = Math.round(thumb * f.height / f.width);
        c.getContext('2d').drawImage(f, 0, 0, c.width, c.height);
        const idx = document.createElement('span'); idx.className = 'idx'; idx.textContent = i;
        const chk = document.createElement('span'); chk.className = 'check'; chk.textContent = state.selected.has(i) ? '✔' : '';
        item.appendChild(c); item.appendChild(idx); item.appendChild(chk);
        item.onclick = () => {
            if (state.selected.has(i)) state.selected.delete(i); else state.selected.add(i);
            item.classList.toggle('selected');
            chk.textContent = state.selected.has(i) ? '✔' : '';
            updateSelCount();
        };
        grid.appendChild(item);
    });
    updateSelCount();
}
function updateSelCount() {
    $('frameSelCount').textContent = `(${state.selected.size} / ${state.finalFrames.length} 已选)`;
}
$('frameZoom').oninput = renderFrameGrid;
$('selectAll').onclick = () => { state.selected = new Set(state.finalFrames.map((_, i) => i)); renderFrameGrid(); };
$('clearSel').onclick = () => { state.selected.clear(); renderFrameGrid(); };

// 动画预览
let animTimer = null;
$('playSelected').onclick = () => {
    const sel = getSelectedFrames();
    if (!sel.length) return;
    const ap = $('animPreview'); ap.style.display = 'block';
    const ac = $('animCanvas'); ac.width = state.canvasSize; ac.height = state.canvasSize;
    const ctx = ac.getContext('2d');
    let i = 0;
    clearInterval(animTimer);
    animTimer = setInterval(() => {
        ctx.clearRect(0, 0, ac.width, ac.height);
        ctx.drawImage(sel[i % sel.length], 0, 0);
        i++;
    }, 1000 / Math.max(1, state.exportFps));
};

function getSelectedFrames() {
    return state.finalFrames.filter((_, i) => state.selected.has(i));
}

function renderCropPreview() {
    const cv = $('cropPreview');
    const f = state.finalFrames[0];
    if (!f) return;
    cv.width = state.canvasSize; cv.height = state.canvasSize;
    cv.getContext('2d').drawImage(f, 0, 0);
}

// ---------- 导出 ----------
$('downloadSheet').onclick = () => {
    const sel = getSelectedFrames();
    if (!sel.length) { alert('请至少选择一帧'); return; }
    const n = sel.length;
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const size = state.canvasSize;
    const sheet = document.createElement('canvas');
    sheet.width = cols * size; sheet.height = rows * size;
    const ctx = sheet.getContext('2d');
    sel.forEach((f, i) => {
        ctx.drawImage(f, (i % cols) * size, Math.floor(i / cols) * size);
    });
    sheet.toBlob(b => downloadBlob(b, 'spritesheet.png'), 'image/png');
    $('downloadInfo').textContent = `已导出精灵图集：${cols}×${rows} 网格，共 ${n} 帧`;
};

$('downloadZip').onclick = async () => {
    const sel = getSelectedFrames();
    if (!sel.length) { alert('请至少选择一帧'); return; }
    const zip = new JSZip();
    const folder = zip.folder('sprites');
    let done = 0;
    for (let i = 0; i < sel.length; i++) {
        const blob = await new Promise(r => sel[i].toBlob(r, 'image/png'));
        folder.file(`frame_${String(i).padStart(4, '0')}.png`, blob);
        done++;
    }
    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, 'sprites_zip.zip');
    $('downloadInfo').textContent = `已导出逐帧 ZIP：${sel.length} 张 PNG`;
};

$('processAnother').onclick = () => {
    state.rawFrames = []; state.finalFrames = []; state.selected.clear();
    state.chromaEnabled = false; state.haloEnabled = false; state.targetColor = null;
    ['framesSection', 'step1', 'step2', 'step3', 'downloadSection', 'settingsSection'].forEach(id => $(id).style.display = 'none');
    $('frameGrid').innerHTML = ''; $('uploadInfo').textContent = '';
    fileInput.value = ''; videoEl.src = '';
};
