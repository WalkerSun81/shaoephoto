# 预制体检查标准

## 1. 文件完整性

| 检查项 | 标准 | 方法 |
|--------|------|------|
| prefab 文件存在 | `f{id}_{morph}.prefab` 非空 | 文件大小 > 1KB |
| prefab.meta 存在 | 同目录下对应 `.meta` | 文件存在 |
| PNG 文件存在 | `img/{id}/{morph}.png` | 文件存在，可正常打开 |
| PNG.meta 存在 | 同目录下对应 `.meta` | 文件存在 |

## 2. Sprite 数据

| 检查项 | 标准 | 说明 |
|--------|------|------|
| sprite 尺寸合理 | `width ≈ 原图宽 - 2px` | 边界裁剪 1-2px 正常 |
| sprite 尺寸 > 0 | 最小 > 4px | 过小说明素材有问题 |
| `pixelsToUnit` = 100 | 标准值 | 影响物理计算 |
| `pivotX/Y` = 0.5 | 中心锚点 | 碰撞体偏移以此为基准 |
| UUID 一致性 | prefab 引用的 UUID 与 PNG.meta 中的一致 | 不匹配会导致素材丢失 |

## 3. 碰撞体数据

| 检查项 | 正常 | 异常 |
|--------|------|------|
| **Polygon** 顶点数 | 3-8 个点 | 只 2 个点（退化为线段）或空 |
| **Box** 尺寸 | `0.4 ~ 0.95` 倍 sprite 尺寸 | > sprite 尺寸（穿模）或 < 10px（过小） |
| **Circle** 半径 | `0.2 ~ 0.5` 倍 min(w,h) | > min(w,h)（超出精灵边界） |
| **偏移量** | `|offset| < sprite尺寸/2` | 偏移值过大导致碰撞体脱离精灵 |
| **零偏移 Box** | 不应含 `_offset: {x:0, y:0}` | 显式零偏移可能让 Cocos 误解析 |

## 4. JSON 格式

| 检查项 | 标准 |
|--------|------|
| `__type__` 正确 | `cc.BoxCollider2D` / `cc.CircleCollider2D` / `cc.PolygonCollider2D` |
| `node.__id__` = 1 | 碰撞体挂载在根节点 |
| `_group` = 2 | 物理分组 |
| `__prefab.fileId` 有值 | UUID 不为空 |
| 无残留/多余字段 | 非零偏移时才应有 `offset` |
| **Cocos 3.x 属性名** | Box=`_size`, Circle=`_radius`, Polygon=`_points`; 偏移=`offset`(非`_offset`) |

## 5. 验证方法

1. 在工具中打开对应图片 → 确认碰撞体预览与预期一致
2. 导出预制体
3. 打开 JSON：
   - 检查 `__type__` 与碰撞体类型匹配
   - 检查 `_size`(Box) / `_radius`(Circle) / `_points`(Polygon) 数值在合理范围
   - 确认零偏移 Box/Circle 不包含 `offset` 字段
4. 导入 Cocos Creator → 确认碰撞体在 Scene 中显示正常

## 6. 常见异常速查

| 现象 | 可能原因 |
|------|----------|
| 碰撞体变为小点 | `_contentSize`(旧) → `_size`(新) / `_offset`(旧) → `offset`(新) 属性名不匹配 Cocos 3.x |
| 碰撞体偏移到精灵外 | 手动编辑的偏移值过大 |
| 碰撞体比精灵大 | 未手动编辑时 colliderScale 设太高 |
| 素材丢失 | UUID 不匹配 |
| 碰撞体形状不对 | `_detectColliderType` 返回了错误的类型 |
