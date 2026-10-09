// 音乐编辑器：4 pattern × 2 声部（主旋律/贝斯），乐曲链编排，整曲循环播放。
// 与音效编辑器相互独立——音乐用自己的波形数据，不引用音效槽。
import { el, makeScope, clearNode } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { createBlankMusic, createBlankPattern, CHANNEL_NAMES } from '../lib/music-data.js';
import { startMusic, stopMusic, isMusicPlaying } from '../audio/engine.js';
import { createStepGrid } from '../ui/stepgrid.js';

export function mount(host, { store }) {
  const scope = makeScope();

  // 首次进入：初始化乐曲
  if (!store.project.music || !Array.isArray(store.project.music.patterns)) {
    store.project.music = createBlankMusic();
    store.touch();
  }

  let curPat = 0;
  let curCh = 0;

  // ---------- DOM ----------
  const patBtns = [];
  const patRow = el('div', { class: 'slot-row' },
    ...store.project.music.patterns.map((_, i) => {
      const b = el('button', { class: 'btn small slot-btn' }, `P${i + 1}`);
      patBtns.push(b);
      scope.listen(b, 'click', () => selectPat(i));
      return b;
    }),
  );

  const chBtns = [];
  const chRow = el('div', { class: 'slot-row' },
    ...CHANNEL_NAMES.map((name, i) => {
      const b = el('button', { class: 'btn small slot-btn' }, name);
      chBtns.push(b);
      scope.listen(b, 'click', () => selectCh(i));
      return b;
    }),
  );

  const chainRow = el('div', { class: 'chain-row' });
  const addBtns = el('div', { class: 'btn-group' },
    ...store.project.music.patterns.map((_, i) => {
      const b = el('button', { class: 'btn small' }, `+ P${i + 1}`);
      scope.listen(b, 'click', () => {
        store.project.music.chain.push(i);
        renderChain();
        store.touch();
      });
      return b;
    }),
  );

  const speedLabel = el('span', { class: 'hint' });
  const speed = el('input', { type: 'range', min: '80', max: '240', value: '140', class: 'speed-slider' });
  scope.listen(speed, 'input', () => {
    store.project.music.speed = +speed.value;
    speedLabel.textContent = `${speed.value}ms/步`;
    store.touch();
  });

  const btnPlay = el('button', { class: 'btn primary' }, '▶ 播放整曲');
  const btnStop = el('button', { class: 'btn' }, '■ 停止');
  scope.listen(btnPlay, 'click', () => {
    startMusic(store.project.music);
    toast('▶ 乐曲循环播放中', 'ok');
  });
  scope.listen(btnStop, 'click', () => stopMusic());
  const btnClearChain = el('button', { class: 'btn small danger', style: 'margin-top:6px' }, '清空乐曲链');
  scope.listen(btnClearChain, 'click', () => {
    store.project.music.chain = [curPat];
    renderChain();
    store.touch();
    toast('乐曲链已重置为当前 Pattern', 'ok');
  });

  const grid = createStepGrid({
    getSteps: () => store.project.music.patterns[curPat][curCh],
    onEdit: (immediate) => store.touch(immediate),
    onCommit: () => store.touch(),
  });

  const view = el(
    'div',
    { class: 'music-view audio-view' },
    el('div', { class: 'audio-side' },
      el('h3', {}, 'Pattern'),
      patRow,
      el('h3', {}, '声部'),
      chRow,
      el('h3', {}, '乐曲链（按顺序循环）'),
      chainRow,
      addBtns,
      btnClearChain,
      el('h3', {}, '速度'),
      el('div', { class: 'speed-row' }, speed, speedLabel),
      el('h3', {}, '播放'),
      el('div', { class: 'btn-group' }, btnPlay, btnStop),
    ),
    el('div', { class: 'audio-main' },
      el('h3', {}, '步进编辑'),
      grid.el,
      el('div', { class: 'hint' }, `正在编辑 P${curPat + 1} · ${CHANNEL_NAMES[curCh]} · 声部间相互独立，音色用波形行切换`),
    ),
  );
  clearNode(host);
  host.append(view);

  function renderChain() {
    chainRow.innerHTML = '';
    const chain = store.project.music.chain;
    if (!chain.length) {
      chainRow.append(el('span', { class: 'hint' }, '（空——点下方 +P 添加）'));
    }
    chain.forEach((p, i) => {
      const b = el('button', { class: 'btn small chain-item', title: '点击移除' }, `P${p + 1}`);
      scope.listen(b, 'click', () => {
        chain.splice(i, 1);
        renderChain();
        store.touch();
      });
      chainRow.append(b);
      if (i < chain.length - 1) chainRow.append('→');
    });
  }

  function selectPat(i) {
    curPat = i;
    patBtns.forEach((b, j) => b.classList.toggle('active', j === i));
    grid.render();
    refreshHint();
  }

  function selectCh(i) {
    curCh = i;
    chBtns.forEach((b, j) => b.classList.toggle('active', j === i));
    grid.render();
    refreshHint();
  }

  function refreshHint() {
    view.querySelector('.audio-main .hint').textContent =
      `正在编辑 P${curPat + 1} · ${CHANNEL_NAMES[curCh]} · 声部间相互独立，音色用波形行切换`;
  }

  speed.value = store.project.music.speed || 140;
  speedLabel.textContent = `${speed.value}ms/步`;
  renderChain();
  selectPat(0);
  selectCh(0);

  return {
    unmount() {
      if (isMusicPlaying()) stopMusic(); // 离开编辑器停音乐，避免后台一直响
      scope.abort();
    },
  };
}
