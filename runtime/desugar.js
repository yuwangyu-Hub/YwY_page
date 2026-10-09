// PICO-8 语法糖解糖：标准 Lua 没有 += -= *= /= %= ..= 复合赋值，
// 但 PICO-8（及几乎所有教程）使用它们。加载用户代码前做源码级转换：
//   px-=1.5        →  px = px - 1.5
//   obj.speed+=0.2 →  obj.speed = obj.speed + 0.2
//   t[i]%=2        →  t[i] = t[i] % 2
// 纯函数、逐行安全（不改动行数，错误行号不变）。

const LHS = '[A-Za-z_]\\w*(?:\\s*\\.\\s*[A-Za-z_]\\w*|\\s*\\[[^\\]\\n]*\\])*';
const COMPOUND = new RegExp(
  `(?<!["'\\w])(${LHS})\\s*([+\\-*/%]|\\.\\.)=(?!=)`,
  'g',
);

export function desugarP8(code) {
  return String(code).replace(COMPOUND, (m, lhs, op) => `${lhs} = ${lhs} ${op} `);
}
