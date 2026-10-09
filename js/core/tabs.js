// 视图（tab）切换器：hash 路由 + 严格 mount/unmount 生命周期。
// 每个视图定义：{ mount(host, ctx), unmount() }，mount 可返回对象（含 unmount）。
// 动态 import() 实现视图级代码分割。

const VALID = new Set(['code', 'sprite', 'map', 'run', 'sfx', 'music']);
const LOADERS = {
  code: () => import('../views/code.js'),
  sprite: () => import('../views/sprite.js'),
  map: () => import('../views/map.js'),
  run: () => import('../views/run.js'),
  sfx: () => import('../views/sfx.js'),
  music: () => import('../views/music.js'),
};

export function currentHash() {
  const h = location.hash.replace(/^#/, '');
  return VALID.has(h) ? h : 'code';
}

export function makeTabManager({ barEl, containerEl, defs }) {
  let active = null;      // 当前视图名
  let instance = null;    // 当前视图实例（含 unmount）
  let sharedCtx = {};     // 共享上下文（store/tabs），mount 时与 params 合并注入视图

  function buttons() {
    for (const name of Object.keys(defs)) {
      const b = barEl.querySelector(`[data-tab="${name}"]`);
      if (b) b.classList.toggle('active', name === active);
    }
  }

  async function switchTo(name, params = {}) {
    if (!VALID.has(name) || name === active) {
      if (name === active && params.rerun) instance?.api?.rerun?.();
      return;
    }
    // 先卸载旧的
    if (instance) {
      try { instance.unmount?.(); } catch (e) { console.error('unmount 失败', e); }
      instance = null;
    }
    active = name;
    if (currentHash() !== name) location.hash = name;
    buttons();
    const mod = await LOADERS[name]();
    instance = mod.mount(containerEl, { ...sharedCtx, ...params }) || {};
    if (!instance.unmount) console.warn(`视图 ${name} 未返回 unmount`);
  }

  window.addEventListener('hashchange', () => {
    const h = currentHash();
    if (h !== active) switchTo(h);
  });

  buttons();
  return {
    switchTo,
    get active() { return active; },
    setContext(ctx) { sharedCtx = ctx; },
  };
}
