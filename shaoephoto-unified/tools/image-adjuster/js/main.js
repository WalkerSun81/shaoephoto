/**
 * 图像调整工具 v5.21 - 启动入口
 */
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        // 注册模块
        if (typeof ImageAdjuster !== 'undefined') {
            ModuleLoader.register(ImageAdjuster);
        }

        // 激活主模块
        ModuleLoader.activate('image-adjuster');
    });
})();
