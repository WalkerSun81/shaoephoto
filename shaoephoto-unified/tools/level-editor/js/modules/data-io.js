/**
 * Data IO Module - 数据导入导出模块
 */
var DataIOModule = (function() {
    var autoSaveInterval = null;

    var module = {
        id: 'data-io',
        name: '数据导入导出',

        activate: function() {
            console.log('Data IO activated');
            bindEvents();
            loadFromLocalStorage();
            startAutoSave();
        },

        deactivate: function() {
            console.log('Data IO deactivated');
            stopAutoSave();
        },

        save: function() {
            saveToLocalStorage();
        },

        load: function() {
            loadFromLocalStorage();
        },

        exportJSON: function() {
            var data = collectAllData();
            Serializer.exportToFile(data, 'level_' + (data.level.id || 'new') + '.json');
        },

        importJSON: function(file) {
            Serializer.importFromFile(file).then(function(data) {
                applyLoadedData(data);
                if (typeof animalUtils !== 'undefined' && animalUtils.showTypewriterToast) {
                    animalUtils.showTypewriterToast('导入成功');
                }
            }).catch(function(error) {
                console.error('Import failed:', error);
                alert('导入失败: ' + error.message);
            });
        },

        exportGameFormat: function() {
            var data = collectAllData();
            var gameData = Serializer.toGameFormat(data);
            Serializer.exportToFile(gameData, 'GameJsonCfg_' + (data.level.id || 'new') + '.json');
        },

        exportGameMerge: function(existingGameJson) {
            var data = collectAllData();
            var merged = Serializer.exportGameMergeFile(data, existingGameJson);
            Serializer.exportToFile(merged, 'GameJsonCfg.json');
        },

        importGameJsonCfg: function(file) {
            return Serializer.importGameJsonCfgFile(file);
        }
    };

    function bindEvents() {
        var btnSave = document.getElementById('btnSave');
        var btnLoad = document.getElementById('btnLoad');
        var btnExport = document.getElementById('btnExport');

        if (btnSave) {
            btnSave.addEventListener('click', function() {
                saveToLocalStorage();
                if (typeof animalUtils !== 'undefined' && animalUtils.showTypewriterToast) {
                    animalUtils.showTypewriterToast('保存成功');
                }
            });
        }

        if (btnLoad) {
            btnLoad.addEventListener('click', function() {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = function(e) {
                    if (e.target.files.length > 0) {
                        module.importJSON(e.target.files[0]);
                    }
                };
                input.click();
            });
        }

        if (btnExport) {
            btnExport.addEventListener('click', function() {
                showExportMenu();
            });
        }
    }

    function showExportMenu() {
        var menu = document.createElement('div');
        menu.className = 'export-menu';
        menu.innerHTML = '<button class="export-item" data-format="json">导出编辑器格式</button>' +
            '<button class="export-item" data-format="game">导出游戏格式</button>';

        var btnExport = document.getElementById('btnExport');
        var rect = btnExport.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = rect.bottom + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.zIndex = '1000';

        document.body.appendChild(menu);

        menu.querySelectorAll('.export-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var format = item.dataset.format;
                if (format === 'json') {
                    module.exportJSON();
                } else if (format === 'game') {
                    module.exportGameFormat();
                }
                document.body.removeChild(menu);
            });
        });

        setTimeout(function() {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target) && e.target !== btnExport) {
                    if (menu.parentNode) document.body.removeChild(menu);
                    document.removeEventListener('click', closeMenu);
                }
            });
        }, 100);
    }

    function collectAllData() {
        // 同步各模块数据
        var level = state.level;
        if (typeof LevelConfigModule !== 'undefined') {
            level = LevelConfigModule.getConfig();
        }
        var diffPoints = state.diffPoints;
        if (typeof WorkflowEditorModule !== 'undefined') {
            diffPoints = WorkflowEditorModule.getDiffPoints();
        }

        return {
            level: level,
            canvas: state.canvas,
            assets: state.assets,
            nodes: CanvasEngine.getNodes(),
            diffPoints: diffPoints,
            talkMsgs: state.talkMsgs,
            talks: state.talks
        };
    }

    function applyLoadedData(data) {
        if (data.level) {
            state.level = data.level;
            if (typeof LevelConfigModule !== 'undefined') {
                LevelConfigModule.setConfig(data.level);
            }
        }
        if (data.nodes) {
            CanvasEngine.setNodes(data.nodes);
        }
        if (data.diffPoints) {
            state.diffPoints = data.diffPoints;
            if (typeof WorkflowEditorModule !== 'undefined') {
                WorkflowEditorModule.setDiffPoints(data.diffPoints);
            }
        }
        if (data.talkMsgs) {
            state.talkMsgs = data.talkMsgs;
        }
        if (data.talks) {
            state.talks = data.talks;
        }
    }

    function saveToLocalStorage() {
        var data = collectAllData();
        Serializer.saveToLocalStorage('level-editor-data', data);
    }

    function loadFromLocalStorage() {
        var data = Serializer.loadFromLocalStorage('level-editor-data');
        if (data) {
            applyLoadedData(data);
        }
    }

    function startAutoSave() {
        autoSaveInterval = setInterval(function() {
            saveToLocalStorage();
        }, 60000);
    }

    function stopAutoSave() {
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
            autoSaveInterval = null;
        }
    }

    return module;
})();

if (typeof window !== 'undefined') {
    window.DataIOModule = DataIOModule;
}
