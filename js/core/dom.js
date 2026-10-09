// 极简 DOM 工具（取代全局 $，作用域受限于传入的根节点）

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v !== null && v !== undefined) {
      node.setAttribute(k, v);
    }
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

// 事件作用域：unmount 时一次 abort 撤销所有监听
export function makeScope() {
  const ac = new AbortController();
  return {
    signal: ac.signal,
    listen(target, type, fn, opts = {}) {
      target.addEventListener(type, fn, { ...opts, signal: ac.signal });
    },
    abort() { ac.abort(); },
  };
}

export function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
