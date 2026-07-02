/**
 * ModuleLoader - 简化模块加载系统
 */
var ModuleLoader = (function() {
    var registry = {};
    var activeId = null;

    function register(mod) {
        if (!mod.id || typeof mod.activate !== 'function') return;
        registry[mod.id] = mod;
    }

    function activate(id) {
        if (activeId && registry[activeId] && registry[activeId].deactivate) {
            try { registry[activeId].deactivate(); } catch(e) {}
        }
        activeId = id;
        if (registry[id] && registry[id].activate) {
            registry[id].activate();
        }
    }

    function get(id) { return registry[id]; }
    function getActive() { return registry[activeId]; }

    return { register: register, activate: activate, get: get, getActive: getActive };
})();
