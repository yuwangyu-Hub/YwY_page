// toast 通知（#toast-root 由 index.html 提供）

export function toast(message, type = '') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.append(root);
  }
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  root.append(item);
  setTimeout(() => {
    item.style.opacity = '0';
    item.style.transition = 'opacity .25s';
    setTimeout(() => item.remove(), 260);
  }, 2600);
}
