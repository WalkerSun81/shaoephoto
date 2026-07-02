# ShaoePhoto Unified

统一的图像处理工具集平台，将三个独立工具整合到一个入口。

## 功能工具

| 工具 | 版本 | 说明 |
|------|------|------|
| 抠图工具 | v5.11-3 | 精灵图拆分与合并，支持套索、网格线、保护笔刷 |
| 预制体生成 | v5.21 | Cocos Creator 食物预制体批量生成，支持碰撞体编辑 |
| 图像调整 | v5.21 | 批量图像处理，支持饱和度、对比度、亮度调整 |

## 目录结构

```
shaoephoto-unified/
├── index.html                    # 统一入口
├── css/
│   ├── base.css                  # 苹果风格基础样式
│   ├── launcher.css              # 工具选择界面样式
│   └── plugins/
│       ├── tile-tool.css         # 抠图工具样式
│       ├── prefab-maker.css      # 预制体工具样式
│       └── image-adjuster.css    # 图像调整工具样式
├── js/
│   ├── core/
│   │   ├── plugin-system.js      # 统一插件系统
│   │   ├── plugin-adapter.js     # 插件适配器
│   │   └── ui-utils.js           # 公共UI工具
│   ├── plugins/
│   │   ├── tile-tool.js          # 抠图工具
│   │   ├── prefab-maker.js       # 预制体工具
│   │   └── image-adjuster.js     # 图像调整工具
│   └── main.js                   # 启动入口
└── README.md
```

## 使用方法

1. 直接在浏览器中打开 `index.html`
2. 在工具选择界面点击需要使用的工具
3. 使用工具功能
4. 点击左上角"返回"按钮回到工具选择界面

## 插件开发

### 插件接口规范

```javascript
{
  id: 'tool-id',           // 唯一标识
  name: '工具名称',        // 显示名称
  icon: '🔧',             // 图标
  description: '工具描述',  // 简短描述
  version: '1.0.0',       // 版本号

  // 生命周期
  activate: function(container) {},
  deactivate: function() {},
  destroy: function() {},

  // 可选
  saveState: function() {},
  loadState: function(data) {}
}
```

### 添加新工具

1. 在 `js/plugins/` 目录下创建新的 JS 文件
2. 实现插件接口
3. 在 `index.html` 中引入 JS 文件
4. 在 `js/main.js` 的 `PLUGIN_META` 中添加元数据
5. 在 `registerPlugins()` 函数中注册插件

## 设计风格

采用苹果风格设计语言：
- 毛玻璃效果
- 圆角设计
- 平滑动画
- 响应式布局

## 技术特点

- **插件隔离**：每个工具独立运行，互不影响
- **容器隔离**：工具在指定容器内渲染
- **状态持久化**：自动保存工具状态到 localStorage
- **扩展性强**：支持后续添加新工具

## 浏览器兼容性

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 许可证

内部项目，仅供个人使用。
