# 图像调整工具 Bug 修复记录

**日期**: 2026-05-30  
**版本**: v5.21  
**文件**: `tools/image-adjuster/js/modules/image-adjuster.js`

---

## 问题描述

图像调整工具在加入无限画布功能后，使用变换工具（移动/缩放/旋转）操作精灵后再进行撤销或双击，会产生"复制精灵像素到左上角"的幽灵残影。

### 复现步骤
1. 导入素材 → 检测精灵
2. 进入变换模式，移动精灵
3. 撤销（或直接双击精灵）
4. 精灵被"复制"到左上角，覆盖正常精灵

---

## 根因分析

### 主因：`_onMouseDown` 每次点击都调用 `_refreshCurrentImage()`

**位置**: `_onMouseDown` 中 `if (found >= 0)` 块，第1883行

**问题**: 每次点击精灵（包括双击和已选中精灵的重复点击），都会调用 `_refreshCurrentImage()`。该函数从 `_originalImageData`（原始未变换的图像）重建整个 `processedImageData`：
1. 将原始图像数据（478×279）复制到已扩展的画布（如 800×500）
2. 原始图像中精灵在 `(1,1)-(476,277)` 位置，被复制到扩展画布的同样位置
3. 已通过变换移动走的精灵像素（在 `(100,100)-(575,376)`）被原始像素覆盖

**修复**: 只在精灵实际切换时（`found !== entry.selectedRegion`）才重建图像。

```javascript
// Before
this._refreshCurrentImage();

// After
if (found !== entry.selectedRegion) {
    this._refreshCurrentImage();
}
```

---

### 次因 1：`_growEntryCanvas` 缺乏边界检查

**位置**: `_growEntryCanvas` 函数

**问题**: 当 `_growCanvasIfNeeded` 修剪画布左侧空白区域时，`ox` 为负数（如 -200）。旧的像素拷贝循环直接将 `x + ox` 作为 `Uint8ClampedArray` 索引。负索引被 `Uint8ClampedArray` 静默钳制到 0，导致像素被写入 Index 0（左上角）。

**修复**: 添加边界检查，跳过越界像素。

```javascript
// Before
var di = ((y + oy) * newW + (x + ox)) * 4;
newData.data[di] = oldData[si];

// After
var nx = x + ox, ny = y + oy;
if (nx < 0 || nx >= newW || ny < 0 || ny >= newH) continue;
var di = (ny * newW + nx) * 4;
newData.data[di] = oldData[si];
```

同时为 region 像素偏移添加同样的边界检查。

---

### 次因 2：`_applyMoveTransform` 无操作时提前返回不清理 overlay

**位置**: `_applyMoveTransform` 函数

**问题**: 函数在 `dx=0 && dy=0` 时提前返回，不调用 `_drawOverlay()`。但 `_onMouseMove` 在此前已绘制了变换预览（虚线框），导致预览残留为"残影"。同时 `_saveUndoState()` 在提前返回前被调用，向撤销栈推入无意义的重复状态。

**修复**:
1. `_saveUndoState()` 移到 `dx/dy` 检查之后
2. 提前返回前调用 `_drawOverlay()` 清理预览

```javascript
// Before
this._saveUndoState();
// ...
if (dx === 0 && dy === 0) return;

// After
if (dx === 0 && dy === 0) { this._drawMain(); this._drawOverlay(); return; }
this._saveUndoState();
```

---

### 次因 3：`_onMouseUp` 变换分支缺少 overlay 清理

**位置**: `_onMouseUp` 函数

**问题**: 旋转和移动路径在应用变换后不调用 `_drawOverlay()`，导致 overlay 残留。缩放路径已有此调用，但移动和旋转没有。

**修复**: 在 `_onMouseUp` 的旋转和移动分支末尾添加 `this._drawOverlay()`。

---

### 次因 4：变换手柄命中区侵入精灵主体

**位置**: `_onMouseDown` 手柄检测

**问题**: 缩放手柄和旋转手柄的命中区不对称——向精灵内部延伸 12px，向外仅延伸 6px。双击精灵时若鼠标靠近右下角/右上角，会误触缩放手柄或旋转手柄。命中区范围是 `bxT+bwT-12` 到 `bxT+bwT+6`（18px宽，不对称）。

**修复**: 改为对称 8px（`bxT+bwT-8` 到 `bxT+bwT+8`），16px 对称命中区。

---

### 次因 5：点击立即激活拖拽导致双击误操作

**位置**: `_onMouseDown` 精灵主体检测

**问题**: 点击精灵主体时立即设置 `transformDrag=true`，双击的第一下就会进入拖拽状态。若双击间有微小鼠标移动（≥1px），会触发真实的移动操作。

**修复**: 改为延迟激活——点击时记录位置（`_dragPending='move'`），在 `_onMouseMove` 中检测移动距离 ≥3px 时才真正激活拖拽（`transformDrag=true`）。

---

### 次因 6：`_saveUndoState` 中 `bounds` 存引用被破坏

**位置**: `_saveUndoState` 函数

**问题**: `bounds: r.bounds` 存储的是对象引用。后续 `_growEntryCanvas` 通过 `r.bounds.x += ox` 就地修改了同一个对象，导致撤销快照中的 bounds 被破坏。

**修复**: 深拷贝 bounds。

```javascript
// Before
bounds: r.bounds,

// After
bounds: { x: r.bounds.x, y: r.bounds.y, w: r.bounds.w, h: r.bounds.h },
```

---

### 次因 7：撤销不恢复选中状态

**位置**: `_undo` 函数

**问题**: `_undo()` 总是设置 `entry.selectedRegion = -1`，撤销后精灵选择框消失，用户需要重新点击精灵才能选中。

**修复**: 在 `_saveUndoState` 快照中保存 `selectedRegion`，在 `_undo` 中恢复。

```javascript
// _saveUndoState - add to snapshot
selectedRegion: entry.selectedRegion,

// _undo - restore from snapshot
entry.selectedRegion = (snapshot.selectedRegion !== undefined && snapshot.selectedRegion < entry.regions.length) 
    ? snapshot.selectedRegion : -1;
```

---

### 次因 8：contrast/brightness 未参与撤销

**位置**: `_saveUndoState` / `_undo` 函数

**问题**: 撤销快照只保存/恢复了 `saturationBatch/Current`，`contrast` 和 `brightness` 的调整值在撤销后丢失。

**修复**: 在快照中增存 `contrastBatch/Current` 和 `brightnessBatch/Current`，撤销时恢复。

---

### 次因 9：`_drawOverlay` 清除不彻底

**位置**: `_drawOverlay` 函数

**问题**: `clearRect` 在某些浏览器合成场景下可能清除不完全。

**修复**: 改用 `putImageData`（空 ImageData）清除，绕过所有合成管道直接写像素。

---

## 修改统计

| 类别 | 数量 |
|------|------|
| 修改函数 | 10 |
| 新增状态字段 | 3 (`_dragPending`, `_dragStartX/Y`, `_dragStartImgX/Y`) |
| 修改总计 | 约 60 行 |

---

## 测试验证

- [x] 移动 + 撤销 + 双击：无幽灵
- [x] 缩放 + 撤销 + 双击：无幽灵
- [x] 旋转 + 撤销 + 双击：无幽灵
- [x] 移动 + 双击（不撤销）：无幽灵
- [x] 撤销后精灵自动保持选中：已确认
- [x] 双击不再误触缩放手柄：已确认
- [x] 双击不再触发微小移动：已确认
