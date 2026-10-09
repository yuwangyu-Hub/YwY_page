// 纯逻辑验证：复刻 app.js 中的核心算法，用假 ImageData 测试正确性
function makeImg(w, h, fill) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const p = fill(i % w, Math.floor(i / w)); data[i*4]=p[0]; data[i*4+1]=p[1]; data[i*4+2]=p[2]; data[i*4+3]=p[3]; }
  return { width: w, height: h, data };
}
function chromaKey(img, target, tol) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i]-target.r, dg=d[i+1]-target.g, db=d[i+2]-target.b;
    if (Math.sqrt(dr*dr+dg*dg+db*db) < tol) d[i+3]=0;
  }
  return img;
}
function computeBBox(img) {
  const d=img.data,w=img.width,h=img.height; let minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]>10){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; } }
  if(maxX<0) return null; return {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
}
function haloRemoval(img, expansion) {
  const d=img.data,w=img.width,h=img.height; let alpha=new Uint8Array(w*h);
  for(let i=0;i<alpha.length;i++) alpha[i]=d[i*4+3]>10?1:0;
  for(let k=0;k<expansion;k++){ const next=alpha.slice();
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=y*w+x;
      if(alpha[i]===1){ if((x>0&&alpha[i-1]===0)||(x<w-1&&alpha[i+1]===0)||(y>0&&alpha[i-w]===0)||(y<h-1&&alpha[i+w]===0)) next[i]=0; } }
    alpha=next; }
  for(let i=0;i<alpha.length;i++) if(alpha[i]===0) d[i*4+3]=0;
  return img;
}
function placeScale(srcW, srcH, size) { const s=Math.min(size/srcW,size/srcH); return {dw:Math.round(srcW*s), dh:Math.round(srcH*s)}; }

let pass=0, fail=0;
function assert(name, cond){ if(cond){pass++; console.log('✓',name);} else {fail++; console.log('✗ FAIL',name);} }

// 1. chromaKey: 绿色像素(0,255,0) 距离目标(0,255,0)为0 < 50 → 透明
let img = makeImg(2,1,()=>[0,255,0,255]);
chromaKey(img,{r:0,g:255,b:0},50);
assert('chromaKey 移除目标色→alpha=0', img.data[3]===0);
// 红色像素距离大 → 保留
img = makeImg(2,1,()=>[255,0,0,255]);
chromaKey(img,{r:0,g:255,b:0},50);
assert('chromaKey 保留远色→alpha=255', img.data[3]===255);

// 2. computeBBox: 3x3 中间十字不透明
img = makeImg(3,3,(x,y)=> ((x===1||y===1)?[255,255,255,255]:[0,0,0,0]));
let bb = computeBBox(img);
assert('bbox x=0', bb.x===0); assert('bbox y=0', bb.y===0); assert('bbox w=3', bb.w===3); assert('bbox h=3', bb.h===3);
// 全透明 → null
img = makeImg(3,3,()=>[0,0,0,0]);
assert('全透明 bbox=null', computeBBox(img)===null);

// 3. haloRemoval: 5x5，中心3x3不透明、外圈1px透明(模拟精灵+透明边)
// expansion=1 应把中心3x3的边缘像素(与透明相邻)腐蚀掉，仅剩正中心
img = makeImg(5,5,(x,y)=> ((x>=1&&x<=3&&y>=1&&y<=3)?[255,255,255,255]:[0,0,0,0]));
haloRemoval(img,1);
// 中心 (2,2) 应保持255
assert('halo 中心保留→255', img.data[(2*5+2)*4+3]===255);
// 中心边缘像素 (1,2) 与透明相邻 → 腐蚀为0
assert('halo 边缘腐蚀→0', img.data[(2*5+1)*4+3]===0);
// expansion=2 后中心也应被腐蚀
haloRemoval(img,1); // 已腐蚀到1x1，再扩1 → 全透明
assert('halo 二次腐蚀→全透明', img.data[(2*5+2)*4+3]===0);

// 4. placeInCanvas 缩放: 512x256 放 256 → 宽256 高128
let s = placeScale(512,256,256);
assert('缩放 宽=256', s.dw===256); assert('缩放 高=128', s.dh===128);
// 等比放大 100x50 放 200 → 200x100
s = placeScale(100,50,200);
assert('放大 宽=200', s.dw===200); assert('放大 高=100', s.dh===100);

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail?1:0);
