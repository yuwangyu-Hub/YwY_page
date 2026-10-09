// Lua 预置 API：坐标环绕、相机、颜色状态、绘制函数全是 Lua 语义，
// JS 边界只暴露最快路径的底层原语（见 api.js）。

export const PRELUDE = `-- Pixel Studio prelude (Lua)
cam = { x = 0, y = 0 }
col = 6
cur = { x = 0, y = 0 }
prevbtn = {}

local function wx(x) return (math.floor(x) % 128 + 128) % 128 end
local function wy(y) return (math.floor(y) % 128 + 128) % 128 end
local function rpset(x, y) _pset(wx(x), wy(y), col) end

function cls(c) col = c or col; _cls(c or 0) end

function pset(x, y, c)
  if c then col = c end
  _pset(wx(x + cam.x), wy(y + cam.y), col)
end

function pget(x, y) return _pget(wx(x + cam.x), wy(y + cam.y)) end
function sget(x, y) return _sget(wx(x), wy(y)) end
function sset(x, y, c) _sset(wx(x), wy(y), c or col) end
function mget(x, y) return _mget(math.floor(x), math.floor(y)) end
function mset(x, y, v) _mset(math.floor(x), math.floor(y), v) end

function spr(n, x, y, w, h)
  _spr(n, math.floor(x + cam.x), math.floor(y + cam.y), w or 1, h or 1)
end

function map(celx, cely, sx, sy, celw, celh)
  _mapdraw(celx or 0, cely or 0, sx or 0, sy or 0, celw or 16, celh or 16)
end
mapdraw = map

function rectfill(x0, y0, x1, y1, c)
  if c then col = c end
  _rectfill(math.floor(x0 + cam.x), math.floor(y0 + cam.y),
            math.floor(x1 + cam.x), math.floor(y1 + cam.y), col)
end

function rect(x0, y0, x1, y1, c)
  if c then col = c end
  local a, b, cc, d = math.floor(x0 + cam.x), math.floor(y0 + cam.y),
                      math.floor(x1 + cam.x), math.floor(y1 + cam.y)
  for x = a, cc do rpset(x, b) rpset(x, d) end
  for y = b, d do rpset(a, y) rpset(cc, y) end
end

function line(x0, y0, x1, y1, c)
  if c then col = c end
  local a, b = math.floor(x0 + cam.x), math.floor(y0 + cam.y)
  local cc, d = math.floor(x1 + cam.x), math.floor(y1 + cam.y)
  local dx = math.abs(cc - a); local dy = -math.abs(d - b)
  local sx = a < cc and 1 or -1; local sy = b < d and 1 or -1
  local err = dx + dy
  while true do
    rpset(a, b)
    if a == cc and b == d then break end
    local e2 = 2 * err
    if e2 >= dy then err = err + dy; a = a + sx end
    if e2 <= dx then err = err + dx; b = b + sy end
  end
end

function circ(x, y, r, c)
  if c then col = c end
  local cx, cy = math.floor(x + cam.x), math.floor(y + cam.y)
  r = math.floor(r)
  if r <= 0 then rpset(cx, cy) return end
  local qx, qy = r, 0
  local err = 1 - r
  while qx >= qy do
    rpset(cx + qx, cy + qy) rpset(cx - qx, cy + qy)
    rpset(cx + qx, cy - qy) rpset(cx - qx, cy - qy)
    rpset(cx + qy, cy + qx) rpset(cx - qy, cy + qx)
    rpset(cx + qy, cy - qx) rpset(cx - qy, cy - qx)
    qy = qy + 1
    if err < 0 then err = err + 2 * qy + 1
    else qx = qx - 1; err = err + 2 * (qy - qx) + 1 end
  end
end

function circfill(x, y, r, c)
  if c then col = c end
  local cx, cy = math.floor(x + cam.x), math.floor(y + cam.y)
  r = math.floor(r)
  for dy = -r, r do
    local dx = math.floor(math.sqrt(r * r - dy * dy))
    for px = cx - dx, cx + dx do _pset((px % 128 + 128) % 128, ((cy + dy) % 128 + 128) % 128, col) end
  end
end

function btn(i) return _btn(i) end

function btnp(i)
  local cur = _btn(i)
  local was = prevbtn[i] or false
  prevbtn[i] = cur
  return cur and not was
end

function print(s, x, y, c)
  if c then col = c end
  _print(tostring(s), math.floor((x or cur.x) + cam.x), math.floor((y or cur.y) + cam.y), col)
end

function cursor(x, y) cur.x = x or 0; cur.y = y or 0 end
function color(c) col = c or col end
function camera(x, y) cam.x = x or 0; cam.y = y or 0 end
function pal(a, b) end   -- 调色映射二期实现，先无操作容错
function palt(a, b) end
function time() return _time() end
t = time

-- 数学速记（sin 为 PICO-8 习惯：以"圈"为单位、方向反转）
flr = math.floor
abs = math.abs
min = math.min
max = math.max
function mid(a, b, c)
  local m = { a, b, c }
  table.sort(m)
  return m[2]
end
sin = function(x) return -math.sin((x or 0) * 2 * math.pi) end
cos = function(x) return math.cos((x or 0) * 2 * math.pi) end
atan2 = math.atan
rnd = function(n)
  if type(n) == 'table' then
    local keys = {}
    for k in pairs(n) do keys[#keys + 1] = k end
    if #keys == 0 then return nil end
    return n[keys[math.random(#keys)]]
  end
  return math.random() * (n or 1)
end
srand = function(s) math.randomseed(s or 0) end

-- 集合
function all(t)
  local i = 0
  return function()
    i = i + 1
    if t[i] ~= nil then return t[i] end
  end
end
function sadd(t, v) t[#t + 1] = v; return v end
function sdel(t, v)
  for i = 1, #t do
    if t[i] == v then table.remove(t, i) return true end
  end
  return false
end
function foreach(t, f)
  for i = 1, #t do f(t[i]) end
end

-- 音频：一期静音占位，二期由真实 WebAudio 原语替换（游戏代码零改动）
function sfx(n) _sfx(n or -1) end
function music(n) _music(n or -1) end
`;
