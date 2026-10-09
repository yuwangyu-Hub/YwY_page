// 代码 IDE：CodeMirror 5 + lua mode，Ctrl/Cmd+Enter 运行。
import { el, makeScope, clearNode } from '../core/dom.js';

export function mount(host, { store, tabs }) {
  const scope = makeScope();

  const btnRun = el('button', { class: 'btn primary' }, '▶ 运行');
  const hint = el('span', { class: 'hint' }, 'Ctrl / Cmd + Enter 运行 · 修改即时自动保存');
  const textarea = el('textarea', {});
  textarea.value = store.project.code;

  const view = el(
    'div',
    { class: 'code-view' },
    el('div', { class: 'code-toolbar' }, btnRun, hint),
    el('div', { class: 'code-editor-wrap' }, textarea),
  );
  clearNode(host);
  host.append(view);

  const cm = window.CodeMirror.fromTextArea(textarea, {
    mode: 'lua',
    theme: 'material-darker',
    lineNumbers: true,
    indentUnit: 2,
    tabSize: 2,
    lineWrapping: true,
  });
  cm.setValue(store.project.code || '');
  cm.on('change', () => {
    store.project.code = cm.getValue();
    store.touch();
  });

  const doRun = () => tabs.switchTo('run', { runNow: true });
  scope.listen(btnRun, 'click', doRun);
  cm.setOption('extraKeys', {
    'Ctrl-Enter': doRun,
    'Cmd-Enter': doRun,
  });

  setTimeout(() => cm.refresh(), 50);

  return {
    unmount() {
      cm.toTextArea();
      scope.abort();
    },
  };
}
