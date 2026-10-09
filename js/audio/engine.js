// WebAudio 芯片音源：方波/正弦/锯齿/三角 + 白噪声，指数衰减包络。
// 三类消费方：音效编辑器试播、音乐编辑器整曲播放、运行时 sfx()/music()。
// 模块级单例——整个应用共享一个 AudioContext 与一个乐曲播放器。

import { WAVES, midiOf } from '../lib/sfx-data.js';

let ctx = null;
let noiseBuf = null;

export function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error('浏览器不支持 WebAudio');
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function getNoise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// 单音：wave∈WAVES, midi 音高, t 绝对时间, dur 秒, vol 0-1
export function playTone({ wave = 'square', midi = 60, t, dur = 0.1, vol = 0.6 }) {
  const c = ensureCtx();
  const start = Math.max(t ?? c.currentTime, c.currentTime);
  const g = c.createGain();
  const peak = Math.max(0.001, vol * 0.22);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  g.connect(c.destination);

  if (wave === 'noise') {
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.loop = true;
    src.playbackRate.value = Math.pow(2, (midi - 69) / 12) / 4; // 音高→噪声密度
    src.connect(g);
    src.start(start);
    src.stop(start + dur + 0.05);
  } else {
    const o = c.createOscillator();
    o.type = WAVES.includes(wave) ? wave : 'square';
    o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    o.connect(g);
    o.start(start);
    o.stop(start + dur + 0.05);
  }
}

// ---------- 音效一次性播放 ----------
export function playSfx(sfx) {
  if (!sfx || !sfx.steps) return;
  const c = ensureCtx();
  const stepSec = (sfx.speed || 120) / 1000;
  sfx.steps.forEach((s, i) => {
    if (s.p < 0 || s.v <= 0) return;
    playTone({
      wave: WAVES[s.w] || 'square',
      midi: midiOf(s.p),
      t: c.currentTime + i * stepSec,
      dur: stepSec * 0.92,
      vol: s.v / 8,
    });
  });
}

// ---------- 乐曲循环播放（lookahead 调度） ----------
const player = { timer: 0, nextTime: 0, chainIdx: 0, stepIdx: 0, music: null };

function scheduleStep() {
  const c = ctx;
  const { music } = player;
  const stepSec = (music.speed || 140) / 1000;
  const lookahead = c.currentTime + 0.15;

  while (player.nextTime < lookahead) {
    const patIdx = music.chain[player.chainIdx] ?? 0;
    const pat = music.patterns[patIdx];
    if (!pat) { stopMusic(); return; }
    for (const ch of pat) {
      const s = ch[player.stepIdx];
      if (s && s.p >= 0 && s.v > 0) {
        playTone({
          wave: WAVES[s.w] || 'square',
          midi: midiOf(s.p),
          t: player.nextTime,
          dur: stepSec * 0.92,
          vol: s.v / 8,
        });
      }
    }
    player.nextTime += stepSec;
    player.stepIdx++;
    if (player.stepIdx >= 16) {
      player.stepIdx = 0;
      player.chainIdx = (player.chainIdx + 1) % music.chain.length;
    }
  }
}

export function startMusic(music) {
  if (!music || !music.chain || music.chain.length === 0) return;
  stopMusic();
  const c = ensureCtx();
  player.music = music;
  player.chainIdx = 0;
  player.stepIdx = 0;
  player.nextTime = c.currentTime + 0.06;
  scheduleStep();
  player.timer = setInterval(scheduleStep, 40);
}

export function stopMusic() {
  if (player.timer) { clearInterval(player.timer); player.timer = 0; }
  player.music = null;
}

export function isMusicPlaying() { return !!player.timer; }
