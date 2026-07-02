/**
 * Module Loader - 模块加载器
 * 提供 register/activate 机制，管理工具模块的生命周期
 */
var ModuleLoader = (function() {
    var modules = {};
    var activeModule = null;

    /**
     * 注册模块
     * @param {Object} module - 模块对象，必须包含 id, name, activate 方法
     */
    function register(module) {
        if (!module || !module.id) {
            console.error('Module must have an id');
            return;
        }
        modules[module.id] = module;
        console.log('Module registered:', module.id);
    }

    /**
     * 激活模块
     * @param {string} moduleId - 模块ID
     */
    function activate(moduleId) {
        var module = modules[moduleId];
        if (!module) {
            console.error('Module not found:', moduleId);
            return;
        }

        // Deactivate current module
        if (activeModule && activeModule.deactivate) {
            activeModule.deactivate();
        }

        // Activate new module
        activeModule = module;
        if (module.activate) {
            module.activate();
        }
        console.log('Module activated:', moduleId);
    }

    /**
     * 获取模块
     * @param {string} moduleId - 模块ID
     * @returns {Object} 模块对象
     */
    function getModule(moduleId) {
        return modules[moduleId];
    }

    /**
     * 获取当前激活的模块
     * @returns {Object} 当前模块
     */
    function getActiveModule() {
        return activeModule;
    }

    /**
     * 获取所有已注册模块
     * @returns {Object} 模块映射
     */
    function getAllModules() {
        return modules;
    }

    return {
        register: register,
        activate: activate,
        getModule: getModule,
        getActiveModule: getActiveModule,
        getAllModules: getAllModules
    };
})();

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ModuleLoader = ModuleLoader;
}
