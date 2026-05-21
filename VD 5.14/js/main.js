/**
 * VD5.21 - 启动入口
 */
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        // 注册模块
        if (typeof PrefabMaker !== 'undefined') {
            ModuleLoader.register(PrefabMaker);
        }

        // 激活主模块
        ModuleLoader.activate('prefab-maker');
    });
})();
