// 单一可订阅 store：整个工作台共享同一份 project。
// 数据就地基内可变（Uint8Array 直接改），改完调用 touch() 通知订阅者并触发自动保存。

export function createStore(project, { onPersist } = {}) {
  const listeners = new Set();
  let timer = null;

  function flushPersist() {
    timer = null;
    if (onPersist) onPersist(project);
  }

  return {
    project,
    // 修改数据后调用：通知订阅者 + 防抖 300ms 自动保存
    touch(immediate = false) {
      listeners.forEach((l) => l(project));
      if (!onPersist) return;
      if (immediate) { if (timer) clearTimeout(timer); flushPersist(); return; }
      if (timer) clearTimeout(timer);
      timer = setTimeout(flushPersist, 300);
    },
    // 只订阅不保存（如运行视图想感知数据变化）
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
    replaceProject(newProject) {
      this.project = project = newProject;
      listeners.forEach((l) => l(newProject));
      if (onPersist) { if (timer) clearTimeout(timer); flushPersist(); }
    },
  };
}
