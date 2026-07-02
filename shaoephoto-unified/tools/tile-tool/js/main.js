/**
 * ShaoePhoto - 启动入口
 */
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        var worldEl = document.getElementById('cos-world');
        var hotbarEl = document.createElement('div');
        var subtoolsEl = document.createElement('div');

        // 初始化游戏世界
        GameWorld.init(worldEl);

        // 初始化技能系统（使用虚拟元素，不显示 UI）
        SkillSystem.init(hotbarEl, subtoolsEl);

        // 动态加载插件
        loadPlugins().then(function() {
            PluginLoader.autoRegister();
            // 安装并激活 tile-tool
            SkillSystem.installPlugin('tile-tool');
            if (SkillSystem.getAll()['tile-tool']) {
                SkillSystem.activate('tile-tool');
            }
        });

        // 30 秒自动保存
        setInterval(autoSave, 30000);
        window.addEventListener('beforeunload', autoSave);
    });

    function loadPlugins() {
        if (typeof PLUGIN_LIST === 'undefined' || !PLUGIN_LIST.length) {
            return Promise.resolve();
        }
        var promises = PLUGIN_LIST.map(function(src) {
            return new Promise(function(resolve) {
                var s = document.createElement('script');
                s.src = src;
                s.onload = resolve;
                s.onerror = function() { console.warn('[PluginLoader] 加载失败: ' + src); resolve(); };
                document.head.appendChild(s);
            });
        });
        return Promise.all(promises);
    }

    function autoSave() {
        var state = {
            version: 5,
            world: GameWorld.getState(),
            activeSkill: SkillSystem.getActiveId(),
            installedPlugins: Object.keys(SkillSystem.getAll()),
            skillOrder: SkillSystem.getSkillOrder(),
            skills: {}
        };
        var all = SkillSystem.getAll();
        for (var id in all) {
            if (all[id].save) {
                try { state.skills[id] = all[id].save(); } catch(e) {}
            }
        }
        GameStorage.save(state);
    }
})();
