/**
 * PNG压缩工具 v1.0 - 启动入口
 */
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof PngCompressor !== 'undefined') {
            ModuleLoader.register(PngCompressor);
        }
        ModuleLoader.activate('png-compressor');
    });
})();
