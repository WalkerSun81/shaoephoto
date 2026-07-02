/**
 * 关卡编辑器 - 主入口 v2.0
 * 找茬关卡制作流程：
 *   欢迎页 → 基本信息 → 画布设置 → 编辑器（拖素材 → 点击添加差异点 → 导出）
 */

// ===== 全局状态 =====
var state = {
    mode: 'new',
    pageHistory: [],
    level: {
        id: 0, name: '', img: '', levelType: 0, next: 0,
        difficulty: 0, title: '', type: 0,
        tipsText: '', placeHolders: [], tipsText1: '', placeHolders1: [],
        time: 120, passEvent: [], passEventNum: [],
        passValue: 0, passValueStart: 0, passImg: '', passText: '',
        failValue: 0, failValueStart: 0, endValue: 0, endValueStart: 0,
        bottomTpye: 0, bottomEvent: [], adItems: [],
        talkPos: [], talkMsgPos: [], talkSlot: [], levelPos: [],
        tipType: 0, ansType: 0, ansImg: '', ansText: '',
        workEndTime: 0, workEndTime2: 0, endAniTime: 0, endAniTime2: 0, uiTips: ''
    },
    canvas: { width: 720, height: 1280, bgColor: '#ffffff' },
    assets: [],
    nodes: [],
    diffPoints: [],
    talkMsgs: [],
    talks: null,
    bottomInfos: [],
    diffPointCount: 8,
    editMode: 'select'  // 'select' | 'addDiff'
};

// ===== 页面导航 =====
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    var target = document.getElementById(pageId);
    if (target) {
        target.classList.add('active');
        if (target.classList.contains('page-editor')) initEditor();
    }
}

function goNext(currentPageId, nextPageId) {
    state.pageHistory.push(currentPageId);
    showPage(nextPageId);
}

// ===== 欢迎页 =====
function initWelcome() {
    document.getElementById('btnNewProject').addEventListener('click', function() {
        state.mode = 'new';
        goNext('pageWelcome', 'pageBasicInfo');
    });

    document.getElementById('btnOpenProject').addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            if (e.target.files.length > 0) loadProject(e.target.files[0]);
        };
        input.click();
    });

    var btnImportGame = document.getElementById('btnImportGame');
    if (btnImportGame) {
        btnImportGame.addEventListener('click', function() {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                if (e.target.files.length > 0) loadGameJsonCfg(e.target.files[0]);
            };
            input.click();
        });
    }

    loadRecentList();
}

function loadRecentList() {
    var container = document.getElementById('recentItems');
    var data = Serializer.loadFromLocalStorage('level-editor-data');
    if (data && data.level && data.level.id) {
        container.innerHTML = '<div class="recent-item" data-id="' + data.level.id + '">' +
            '<span class="recent-item-name">' + (data.level.name || '关卡 ' + data.level.id) + '</span>' +
            '<span class="recent-item-id">ID: ' + data.level.id + '</span></div>';
        container.querySelector('.recent-item').addEventListener('click', function() {
            state.mode = 'edit';
            loadFromStorage();
        });
    } else {
        container.innerHTML = '<p style="color:var(--text-light);font-size:0.85em;">暂无最近项目</p>';
    }
}

function loadProject(file) {
    Serializer.importFromFile(file).then(function(data) {
        applyLoadedData(data);
        state.mode = 'edit';
        navigateToEditor();
    });
}

function loadGameJsonCfg(file) {
    Serializer.importGameJsonCfgFile(file).then(function(gameData) {
        var levelIds = Object.keys(gameData.Level || {});
        if (levelIds.length === 0) { alert('未找到关卡数据'); return; }
        if (levelIds.length === 1) {
            importGameLevel(gameData, parseInt(levelIds[0]));
        } else {
            showLevelSelectModal(gameData, levelIds);
        }
    }).catch(function(err) { alert('导入失败: ' + err.message); });
}

function showLevelSelectModal(gameData, levelIds) {
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = '<div class="modal-overlay"></div><div class="modal-content modal-sm">' +
        '<div class="modal-header"><h3>选择关卡</h3><button class="modal-close">&times;</button></div>' +
        '<div class="modal-body" id="levelSelectBody"></div></div>';
    document.body.appendChild(modal);

    var body = document.getElementById('levelSelectBody');
    var html = '<p style="margin-bottom:12px;color:var(--text-light);">找到 ' + levelIds.length + ' 个关卡：</p>';
    for (var i = 0; i < levelIds.length; i++) {
        var lid = levelIds[i];
        var level = gameData.Level[lid];
        html += '<div class="recent-item level-select-item" data-id="' + lid + '">' +
            '<span class="recent-item-name">' + (level.name || '关卡') + '</span>' +
            '<span class="recent-item-id">ID: ' + lid + '</span></div>';
    }
    body.innerHTML = html;
    modal.classList.remove('hidden');

    body.querySelectorAll('.level-select-item').forEach(function(item) {
        item.addEventListener('click', function() {
            importGameLevel(gameData, parseInt(item.dataset.id));
            modal.remove();
        });
    });
    modal.querySelector('.modal-close').addEventListener('click', function() { modal.remove(); });
    modal.querySelector('.modal-overlay').addEventListener('click', function() { modal.remove(); });
}

function importGameLevel(gameData, levelId) {
    var imported = Serializer.fromGameFormat(gameData, levelId);
    state.level = imported.level || state.level;
    state.diffPoints = imported.diffPoints || [];
    state.talkMsgs = imported.talkMsgs || [];
    state.talks = imported.talks;
    state.diffPointCount = state.diffPoints.length || 8;
    state.mode = 'edit';
    navigateToEditor();
}

function loadFromStorage() {
    var data = Serializer.loadFromLocalStorage('level-editor-data');
    if (data) { applyLoadedData(data); navigateToEditor(); }
}

function applyLoadedData(data) {
    state.level = data.level || state.level;
    state.canvas = data.canvas || state.canvas;
    state.assets = data.assets || [];
    state.nodes = data.nodes || [];
    state.diffPoints = data.diffPoints || [];
    state.talkMsgs = data.talkMsgs || [];
    state.talks = data.talks || null;
    state.bottomInfos = data.bottomInfos || [];
    state.diffPointCount = data.diffPointCount || state.diffPoints.length || 8;
}

function navigateToEditor() {
    state.pageHistory = ['pageWelcome'];
    populateBasicInfo();
    state.pageHistory.push('pageBasicInfo');
    populateCanvasSetup();
    state.pageHistory.push('pageCanvasSetup');
    showPage('pageEditor');
}

// ===== 基本信息 =====
function initBasicInfo() {
    document.getElementById('btnStep1Next').addEventListener('click', function() {
        collectBasicInfo();
        goNext('pageBasicInfo', 'pageCanvasSetup');
    });
}

function collectBasicInfo() {
    state.level.id = parseInt(document.getElementById('levelId').value) || 0;
    state.level.name = document.getElementById('levelName').value;
    state.level.title = document.getElementById('levelTitle').value;
    state.level.levelType = parseInt(document.getElementById('levelType').value) || 0;
    state.level.difficulty = parseInt(document.getElementById('difficulty').value);
    state.level.time = parseInt(document.getElementById('timeLimit').value) || 0;
    state.diffPointCount = parseInt(document.getElementById('diffPointCount').value) || 8;
}

function populateBasicInfo() {
    document.getElementById('levelId').value = state.level.id || '';
    document.getElementById('levelName').value = state.level.name || '';
    document.getElementById('levelTitle').value = state.level.title || '';
    document.getElementById('levelType').value = state.level.levelType;
    document.getElementById('difficulty').value = state.level.difficulty;
    document.getElementById('timeLimit').value = state.level.time || 120;
    document.getElementById('diffPointCount').value = state.diffPointCount || 8;
}

// ===== 画布设置 =====
function initCanvasSetup() {
    document.querySelectorAll('.preset-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.getElementById('canvasWidth').value = btn.dataset.w;
            document.getElementById('canvasHeight').value = btn.dataset.h;
        });
    });
    document.getElementById('btnStep2Next').addEventListener('click', function() {
        state.canvas.width = parseInt(document.getElementById('canvasWidth').value) || 720;
        state.canvas.height = parseInt(document.getElementById('canvasHeight').value) || 1280;
        state.canvas.bgColor = document.getElementById('bgColor').value;
        goNext('pageCanvasSetup', 'pageEditor');
    });
}

function populateCanvasSetup() {
    document.getElementById('canvasWidth').value = state.canvas.width;
    document.getElementById('canvasHeight').value = state.canvas.height;
    document.getElementById('bgColor').value = state.canvas.bgColor;
}

// ===== 素材上传 =====
function initAssetUpload() {
    var uploadZone = document.getElementById('uploadZone');
    var fileInput = document.getElementById('fileInput');
    if (!uploadZone || !fileInput) return;

    uploadZone.addEventListener('click', function() { fileInput.click(); });
    uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); uploadZone.classList.add('dragover'); });
    uploadZone.addEventListener('dragleave', function() { uploadZone.classList.remove('dragover'); });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', function(e) { handleFiles(e.target.files); fileInput.value = ''; });
}

function handleFiles(files) {
    for (var i = 0; i < files.length; i++) {
        var file = files[i];
        if (!file.type.startsWith('image/')) continue;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                state.assets.push({ name: file.name, dataUrl: e.target.result, width: img.width, height: img.height });
                renderAssetList();
                updateGuide();
                renderWorkflowSteps();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function renderAssetList() {
    var container = document.getElementById('editorAssetList');
    if (!container) return;
    if (state.assets.length === 0) { container.innerHTML = '<p class="placeholder-text">暂无素材</p>'; return; }

    var html = '';
    state.assets.forEach(function(asset, idx) {
        html += '<div class="asset-item" data-idx="' + idx + '">' +
            '<img src="' + asset.dataUrl + '" alt="' + asset.name + '">' +
            '<div class="asset-item-name">' + asset.name + '</div>' +
            '<button class="asset-item-del" data-idx="' + idx + '">×</button></div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.asset-item-del').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            state.assets.splice(parseInt(btn.dataset.idx), 1);
            renderAssetList();
            renderWorkflowSteps();
        });
    });

    container.querySelectorAll('.asset-item').forEach(function(item) {
        item.setAttribute('draggable', 'true');
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', item.dataset.idx);
        });
    });
}

// ===== 编辑器初始化 =====
function initEditor() {
    document.getElementById('editorTitle').textContent = state.level.name || '关卡编辑';

    var canvasEl = document.getElementById('mainCanvas');
    if (canvasEl) CanvasEngine.init(canvasEl);

    initEditorToolbar();
    initEditorPanels();
    initAssetUpload();
    initTalkMsgPanel();
    renderAssetList();
    renderNodeTree();
    renderDiffPointList();
    renderTalkMsgList();
    renderWorkflowSteps();
    updateGuide();
    syncDiffPointMarkers();
    populateTalksConfig();

    // 同步数据到模块（先 activate 再 setConfig）
    if (typeof WorkflowEditorModule !== 'undefined') {
        WorkflowEditorModule.setDiffPoints(state.diffPoints);
    }
    if (typeof LevelConfigModule !== 'undefined') {
        LevelConfigModule.activate();
        LevelConfigModule.setConfig(state.level);
    }
}

function initEditorPanels() {
    // 左侧面板 Tab 切换
    var leftPanel = document.querySelector('.panel-left');
    if (leftPanel) {
        leftPanel.querySelectorAll('.panel-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                leftPanel.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.remove('active'); });
                leftPanel.querySelectorAll('.panel-page').forEach(function(p) { p.classList.remove('active'); });
                tab.classList.add('active');
                var page = document.getElementById(tab.dataset.panel);
                if (page) page.classList.add('active');
            });
        });
    }

    // 右侧面板 Tab 切换
    var rightPanel = document.querySelector('.panel-right');
    if (rightPanel) {
        rightPanel.querySelectorAll('.panel-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                rightPanel.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.remove('active'); });
                rightPanel.querySelectorAll('.panel-page').forEach(function(p) { p.classList.remove('active'); });
                tab.classList.add('active');
                var page = document.getElementById(tab.dataset.panel);
                if (page) page.classList.add('active');
            });
        });
    }

    // 初始化通关配置面板
    if (typeof LevelConfigModule !== 'undefined') {
        LevelConfigModule.activate();
    }
}

function initEditorToolbar() {
    var btnSelect = document.getElementById('btnSelect');
    var btnRectSelect = document.getElementById('btnRectSelect');
    var btnLassoSelect = document.getElementById('btnLassoSelect');
    var btnFitView = document.getElementById('btnFitView');
    var btnUndo = document.getElementById('btnUndo');
    var btnRedo = document.getElementById('btnRedo');
    var btnSave = document.getElementById('btnSaveEditor');
    var btnExport = document.getElementById('btnExportEditor');

    if (btnSelect) btnSelect.addEventListener('click', function() { setEditMode('select'); });
    if (btnRectSelect) btnRectSelect.addEventListener('click', function() { setEditMode('rectSelect'); });
    if (btnLassoSelect) btnLassoSelect.addEventListener('click', function() { setEditMode('lassoSelect'); });
    if (btnFitView) btnFitView.addEventListener('click', function() { CanvasEngine.fitView(); });
    if (btnUndo) btnUndo.addEventListener('click', function() { HistoryManager.undo(); });
    if (btnRedo) btnRedo.addEventListener('click', function() { HistoryManager.redo(); });
    if (btnSave) btnSave.addEventListener('click', saveProject);
    if (btnExport) btnExport.addEventListener('click', showExportModal);

    // 设置视口尺寸
    CanvasEngine.setViewport(state.canvas.width, state.canvas.height);
}

// 画布回调：矩形框选完成
window.onRectSelect = function(rect) {
    openDiffPointModalForArea(rect, 'rect');
};

// 画布回调：套索绘区完成
window.onLassoSelect = function(points) {
    openDiffPointModalForArea(points, 'lasso');
};

function setEditMode(mode) {
    state.editMode = mode;
    var btns = ['btnSelect', 'btnRectSelect', 'btnLassoSelect'];
    btns.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    var activeBtn = { select: 'btnSelect', rectSelect: 'btnRectSelect', lassoSelect: 'btnLassoSelect' }[mode];
    if (activeBtn) document.getElementById(activeBtn).classList.add('active');

    CanvasEngine.setMode(mode);
    var canvas = document.getElementById('mainCanvas');
    if (canvas) canvas.style.cursor = (mode === 'rectSelect' || mode === 'lassoSelect') ? 'crosshair' : 'default';
}

// ===== 引导文字 =====
function updateGuide() {
    var guide = document.getElementById('canvasGuide');
    var step = document.getElementById('guideStep');
    if (!guide || !step) return;

    var nodes = CanvasEngine.getNodes();
    var dpCount = state.diffPoints.length;
    var target = state.diffPointCount;

    if (state.assets.length === 0) {
        step.innerHTML = '<span class="guide-icon">1</span><span class="guide-text">从左侧拖入背景图片到画布</span>';
    } else if (nodes.length === 0) {
        step.innerHTML = '<span class="guide-icon">1</span><span class="guide-text">将左侧素材拖到画布上作为背景</span>';
    } else if (dpCount < target) {
        step.innerHTML = '<span class="guide-icon">2</span><span class="guide-text">用 ▭矩形 或 ⬡套索 工具在画布上框选差异区域（' + dpCount + '/' + target + '）</span>';
    } else {
        step.innerHTML = '<span class="guide-icon">✓</span><span class="guide-text">差异点已全部添加！点击"导出"保存关卡</span>';
    }
    guide.style.display = '';
}

// ===== 差异点模态框 =====
var pendingDiffPos = null;
var pendingDiffArea = null; // { type: 'rect'|'lasso', data: {...} }
var pendingOldImage = null;
var pendingNewImage = null;

function openDiffPointModal(canvasPos) {
    pendingDiffPos = canvasPos;
    pendingDiffArea = null;
    pendingOldImage = null;
    pendingNewImage = null;
    showDiffPointModal();
}

function openDiffPointModalForArea(areaData, areaType) {
    pendingDiffPos = null;
    pendingDiffArea = { type: areaType, data: areaData };
    pendingOldImage = null;
    pendingNewImage = null;
    showDiffPointModal();
}

function showDiffPointModal() {

    var modal = document.getElementById('diffPointModal');
    var nextId = state.diffPoints.length + 1;

    document.getElementById('dpName').value = '差异点 ' + nextId;
    document.getElementById('dpText').value = '';
    document.getElementById('dpOldImagePreview').textContent = '未选择';
    document.getElementById('dpNewImagePreview').textContent = '未选择';
    document.getElementById('dpTriggerType').value = 'click';
    document.getElementById('dpCorrectResult').value = 'Collect';
    document.getElementById('dpCorrectWorks').value = '3';
    document.getElementById('dpWrongResult').value = 'Fail';
    document.getElementById('dpWrongWorks').value = '2';

    modal.classList.remove('hidden');

    // 选择变体A图片
    document.getElementById('btnSelectOldImage').onclick = function() {
        selectImage(function(dataUrl, fileName) {
            pendingOldImage = dataUrl;
            document.getElementById('dpOldImagePreview').textContent = fileName;
        });
    };

    // 选择变体B图片
    document.getElementById('btnSelectNewImage').onclick = function() {
        selectImage(function(dataUrl, fileName) {
            pendingNewImage = dataUrl;
            document.getElementById('dpNewImagePreview').textContent = fileName;
        });
    };

    // 确定按钮
    document.getElementById('btnDiffPointSave').onclick = function() {
        createDiffPointAtPos();
        modal.classList.add('hidden');
    };

    // 取消按钮
    document.getElementById('btnDiffPointCancel').onclick = function() {
        modal.classList.add('hidden');
    };

    // 关闭按钮
    modal.querySelector('.modal-close').onclick = function() { modal.classList.add('hidden'); };
    modal.querySelector('.modal-overlay').onclick = function() { modal.classList.add('hidden'); };
}

function selectImage(callback) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        if (e.target.files.length > 0) {
            var file = e.target.files[0];
            var reader = new FileReader();
            reader.onload = function(ev) {
                callback(ev.target.result, file.name);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
}

function createDiffPointAtPos() {
    var nextId = state.diffPoints.length + 1;
    var name = document.getElementById('dpName').value || ('差异点 ' + nextId);
    var text = document.getElementById('dpText').value || name;
    var triggerType = document.getElementById('dpTriggerType').value;
    var correctResult = document.getElementById('dpCorrectResult').value;
    var correctWorks = parseInt(document.getElementById('dpCorrectWorks').value);
    var wrongResult = document.getElementById('dpWrongResult').value;
    var wrongWorks = parseInt(document.getElementById('dpWrongWorks').value);

    var newNode, oldNodeId = null;

    if (pendingDiffArea) {
        // 区域模式：矩形或套索
        if (pendingDiffArea.type === 'rect') {
            var r = pendingDiffArea.data;
            newNode = {
                id: 'node_' + Date.now(),
                name: name,
                x: Math.round(r.x), y: Math.round(r.y),
                width: Math.round(r.width), height: Math.round(r.height),
                color: '#ffffff', _isDiffPoint: true
            };
            if (pendingNewImage) newNode.imageData = pendingNewImage;
        } else if (pendingDiffArea.type === 'lasso') {
            var pts = pendingDiffArea.data;
            // 计算 bounding box
            var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            pts.forEach(function(p) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
            newNode = {
                id: 'node_' + Date.now(),
                name: name,
                x: Math.round(minX), y: Math.round(minY),
                width: Math.round(maxX - minX), height: Math.round(maxY - minY),
                color: '#ffffff', _isDiffPoint: true,
                _lassoPath: pts
            };
            if (pendingNewImage) newNode.imageData = pendingNewImage;
        }
        CanvasEngine.addNode(newNode);
    } else if (pendingDiffPos) {
        // 点击模式
        newNode = createImageNodeAtPos(pendingDiffPos, pendingNewImage, name, true);
    } else {
        return;
    }

    // 创建变体A节点（原始图片，如果有）
    if (pendingOldImage) {
        var pos = pendingDiffPos || { x: newNode.x + newNode.width / 2, y: newNode.y + newNode.height / 2 };
        var oldNode = createImageNodeAtPos(pos, pendingOldImage, name + '(原始)', false);
        oldNodeId = oldNode.id;
    }

    // 构建 result 数组：[正确分支, 错误分支]
    var correctVal = correctResult === 'Collect' ? 1 : 1;
    var wrongVal = wrongResult === 'Fail' ? -1 : 1;
    var correctResultType = 1; // 正确
    var wrongResultType = 0;   // 错误

    // 创建差异点配置
    var dp = {
        id: 'dp_' + Date.now(),
        eventId: nextId,
        name: name,
        text: text,
        kong: '', ui: '', number: 0, pos: [],
        oldNodes: oldNodeId ? [oldNodeId] : [],
        newNodes: [newNode.id],
        trigger: { type: triggerType, count: 1, time: 0.5 },
        executors: [{ type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 }],
        results: [
            { result: correctResult, val: correctVal, resultType: correctResultType },
            { result: wrongResult, val: wrongVal, resultType: wrongResultType }
        ],
        // 分支配置
        correctResult: correctResult,
        correctWorks: correctWorks,
        wrongResult: wrongResult,
        wrongWorks: wrongWorks,
        // 对话相关
        talkMsgs: [], talkPos: [], curTalkPos: 0, curTalkTime: 0,
        curTalkMusic: '', talk: 0, nexttalk: 0, talkResult: [], works: []
    };

    if (typeof WorkflowEditorModule !== 'undefined') {
        WorkflowEditorModule.addDiffPoint(dp);
        state.diffPoints = WorkflowEditorModule.getDiffPoints();
    }

    // 自动更新通关条件
    state.level.passEvent = state.diffPoints.map(function(d) { return d.eventId; });
    state.level.passValue = state.diffPoints.length;

    // 刷新 UI
    renderDiffPointList();
    renderNodeTree();
    renderWorkflowSteps();
    syncDiffPointMarkers();
    updateGuide();

    // 切回选择模式
    setEditMode('select');

    if (typeof animalUtils !== 'undefined' && animalUtils.showTypewriterToast) {
        animalUtils.showTypewriterToast('已添加差异点: ' + name);
    }
}

function createImageNodeAtPos(pos, imageData, name, isDiffPoint) {
    var nodeWidth = 100;
    var nodeHeight = 100;
    var newNode = {
        id: 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: name,
        x: Math.round(pos.x - nodeWidth / 2),
        y: Math.round(pos.y - nodeHeight / 2),
        width: nodeWidth,
        height: nodeHeight,
        color: '#ffffff',
        _isDiffPoint: isDiffPoint
    };

    if (imageData) {
        newNode.imageData = imageData;
        var img = new Image();
        img.onload = function() {
            var maxSz = 150;
            var sc = Math.min(maxSz / img.width, maxSz / img.height, 1);
            newNode.width = Math.round(img.width * sc);
            newNode.height = Math.round(img.height * sc);
            newNode.x = Math.round(pos.x - newNode.width / 2);
            newNode.y = Math.round(pos.y - newNode.height / 2);
            CanvasEngine.render();
        };
        img.src = imageData;
    }

    CanvasEngine.addNode(newNode);
    return newNode;
}

// ===== 节点树 =====
function renderNodeTree() {
    var container = document.getElementById('nodeTree');
    if (!container) return;
    var nodes = CanvasEngine.getNodes();
    var selected = CanvasEngine.getSelectedNode();

    if (nodes.length === 0) {
        container.innerHTML = '<p class="placeholder-text">拖入素材后自动生成节点</p>';
        return;
    }

    var html = '';
    nodes.forEach(function(node) {
        var isDp = node._isDiffPoint;
        var cls = 'tree-node' + (selected === node ? ' selected' : '');
        html += '<div class="' + cls + '" data-id="' + node.id + '">';
        html += (isDp ? '🔶 ' : '📦 ') + node.name;
        html += '</div>';
    });
    container.innerHTML = html;

    container.querySelectorAll('.tree-node').forEach(function(el) {
        el.addEventListener('click', function() {
            var nodeId = el.dataset.id;
            var node = findNodeById(nodeId);
            if (node) {
                CanvasEngine.selectNode(node);
                renderNodeTree();
                // 切换到属性 Tab
                var rightPanel = document.querySelector('.panel-right');
                if (rightPanel) {
                    rightPanel.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.remove('active'); });
                    rightPanel.querySelectorAll('.panel-page').forEach(function(p) { p.classList.remove('active'); });
                    var propTab = rightPanel.querySelector('[data-panel="propPanel"]');
                    if (propTab) propTab.classList.add('active');
                    var propPage = document.getElementById('propPanel');
                    if (propPage) propPage.classList.add('active');
                }
                if (typeof PropertyPanelModule !== 'undefined') {
                    PropertyPanelModule.showNodeProperties(node);
                }
            }
        });
    });
}

// ===== 差异点列表（右侧面板） =====
function renderDiffPointList() {
    var container = document.getElementById('diffPointList');
    if (!container) return;

    var points = state.diffPoints;
    var target = state.diffPointCount;

    // 更新计数
    var countEl = document.getElementById('diffCount');
    if (countEl) countEl.textContent = points.length + '/' + target;

    if (points.length === 0) {
        container.innerHTML = '<p class="placeholder-text">添加背景图片后，点击 📌 按钮在画布上双击添加差异点</p>';
        return;
    }

    var html = '';
    points.forEach(function(dp, idx) {
        var node = findNodeById(dp.newNodes[0]);
        html += '<div class="diffpoint-card" data-id="' + dp.id + '">';
        html += '<div class="diffpoint-card-num">' + (idx + 1) + '</div>';
        if (node && node.imageData) {
            html += '<img class="diffpoint-card-img" src="' + node.imageData + '">';
        } else {
            html += '<div class="diffpoint-card-placeholder">📦</div>';
        }
        html += '<div class="diffpoint-card-info">';
        html += '<div class="diffpoint-card-name">' + dp.name + '</div>';
        html += '<div class="diffpoint-card-meta">' + dp.trigger.type + ' · #' + dp.eventId;
        if (dp.correctResult) html += ' · <span style="color:#4caf50">✓' + dp.correctResult + '</span>';
        if (dp.wrongResult) html += ' · <span style="color:#e74c3c">✗' + dp.wrongResult + '</span>';
        html += '</div></div>';
        html += '<button class="diffpoint-card-del" data-id="' + dp.id + '">×</button>';
        html += '</div>';
    });
    container.innerHTML = html;

    // 删除按钮
    container.querySelectorAll('.diffpoint-card-del').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            removeDiffPoint(btn.dataset.id);
        });
    });

    // 点击卡片高亮画布节点
    container.querySelectorAll('.diffpoint-card').forEach(function(card) {
        card.addEventListener('click', function() {
            var dp = findDiffPointById(card.dataset.id);
            if (dp && dp.newNodes[0]) {
                var node = findNodeById(dp.newNodes[0]);
                if (node) {
                    CanvasEngine.selectNode(node);
                    CanvasEngine.render();
                }
            }
        });
    });
}

function removeDiffPoint(dpId) {
    var dp = findDiffPointById(dpId);
    if (!dp) return;

    // 删除关联节点
    if (dp.newNodes) {
        dp.newNodes.forEach(function(nid) {
            var node = findNodeById(nid);
            if (node) CanvasEngine.removeNode(node);
        });
    }

    // 删除差异点
    if (typeof WorkflowEditorModule !== 'undefined') {
        WorkflowEditorModule.removeDiffPoint(dpId);
        state.diffPoints = WorkflowEditorModule.getDiffPoints();
    }

    // 更新通关条件
    state.level.passEvent = state.diffPoints.map(function(d) { return d.eventId; });
    state.level.passValue = state.diffPoints.length;

    renderDiffPointList();
    renderNodeTree();
    renderWorkflowSteps();
    syncDiffPointMarkers();
    updateGuide();
}

function findNodeById(id) {
    var nodes = CanvasEngine.getNodes();
    for (var i = 0; i < nodes.length; i++) { if (nodes[i].id === id) return nodes[i]; }
    return null;
}

function findDiffPointById(id) {
    for (var i = 0; i < state.diffPoints.length; i++) { if (state.diffPoints[i].id === id) return state.diffPoints[i]; }
    return null;
}

// ===== 同步差异点标记到画布 =====
function syncDiffPointMarkers() {
    var nodeIds = [];
    state.diffPoints.forEach(function(dp) {
        if (dp.newNodes) nodeIds = nodeIds.concat(dp.newNodes);
        if (dp.oldNodes) nodeIds = nodeIds.concat(dp.oldNodes);
    });
    CanvasEngine.markDiffPointNodes(nodeIds);
}

// ===== 素材拖放到画布 =====
window.onAssetDrop = function(assetIdx, canvasPos) {
    var asset = state.assets[assetIdx];
    if (!asset) return;

    var img = new Image();
    img.onload = function() {
        var maxSize = 400;
        var scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);

        var newNode = {
            id: 'node_' + Date.now(),
            name: asset.name.replace(/\.[^.]+$/, ''),
            x: Math.round(canvasPos.x - w / 2),
            y: Math.round(canvasPos.y - h / 2),
            width: w, height: h,
            color: '#ffffff',
            assetIdx: assetIdx,
            imageData: asset.dataUrl
        };

        HistoryManager.execute(
            function() { CanvasEngine.addNode(newNode); updateGuide(); renderWorkflowSteps(); },
            function() { CanvasEngine.removeNode(newNode); updateGuide(); renderWorkflowSteps(); },
            '添加素材: ' + newNode.name
        );
    };
    img.src = asset.dataUrl;
};

// ===== 底部流程检查栏 =====
function renderWorkflowSteps() {
    var footer = document.getElementById('editorFooter');
    if (!footer) return;

    var steps = [
        { id: 'basic',  label: '基本信息', check: function() { return state.level.id > 0 && !!state.level.name; } },
        { id: 'canvas', label: '画布设置', check: function() { return state.canvas.width > 0; } },
        { id: 'assets', label: '上传素材', check: function() { return state.assets.length > 0; } },
        { id: 'nodes',  label: '放入画布', check: function() { return CanvasEngine.getNodes().length > 0; } },
        { id: 'diff',   label: '添加差异点', check: function() { return state.diffPoints.length >= state.diffPointCount; } },
        { id: 'pass',   label: '通关条件', check: function() { return state.diffPoints.length > 0; } },
        { id: 'export', label: '导出', check: function() {
            return state.diffPoints.length >= state.diffPointCount && CanvasEngine.getNodes().length > 0;
        }}
    ];

    var doneCount = 0;
    var html = '<div class="workflow-steps">';
    for (var i = 0; i < steps.length; i++) {
        var step = steps[i];
        var done = step.check();
        if (done) doneCount++;
        if (i > 0) html += '<div class="step-line ' + (done ? 'line-done' : 'line-fail') + '"></div>';
        html += '<div class="step-item ' + (done ? 'step-completed' : 'step-incomplete') + '" data-step="' + step.id + '">';
        html += '<span class="step-icon ' + (done ? 'step-done' : 'step-fail') + '">' + (done ? '✓' : '✗') + '</span>';
        html += '<span class="step-label">' + step.label + '</span></div>';
    }
    html += '</div>';

    var pct = Math.round(doneCount / steps.length * 100);
    var progressClass = pct === 100 ? 'progress-full' : (pct > 0 ? 'progress-partial' : 'progress-empty');
    html += '<span class="step-progress ' + progressClass + '">' + doneCount + '/' + steps.length;
    if (pct === 100) html += ' 关卡就绪';
    html += '</span>';

    footer.innerHTML = html;

    footer.querySelectorAll('.step-item').forEach(function(item) {
        item.addEventListener('click', function() { handleStepClick(item.dataset.step); });
    });
}

function handleStepClick(stepId) {
    switch (stepId) {
        case 'basic': showPage('pageBasicInfo'); break;
        case 'canvas': showPage('pageCanvasSetup'); break;
        case 'assets':
            switchLeftTab('assetsPanel');
            break;
        case 'nodes':
            switchLeftTab('nodeTreePanel');
            break;
        case 'diff': setEditMode('rectSelect'); break;
        case 'pass':
            switchRightTab('levelConfigPanel');
            break;
        case 'export':
            var btn = document.getElementById('btnExportEditor');
            if (btn) { btn.style.animation = 'pulse 0.5s ease 2'; setTimeout(function() { btn.style.animation = ''; }, 1200); btn.click(); }
            break;
    }
}

function switchLeftTab(panelId) {
    var panel = document.querySelector('.panel-left');
    if (!panel) return;
    panel.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.panel === panelId); });
    panel.querySelectorAll('.panel-page').forEach(function(p) { p.classList.toggle('active', p.id === panelId); });
}

function switchRightTab(panelId) {
    var panel = document.querySelector('.panel-right');
    if (!panel) return;
    panel.querySelectorAll('.panel-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.panel === panelId); });
    panel.querySelectorAll('.panel-page').forEach(function(p) { p.classList.toggle('active', p.id === panelId); });
}

// ===== 导出 =====
function showExportModal() { document.getElementById('exportModal').classList.remove('hidden'); }

function initExportModal() {
    var modal = document.getElementById('exportModal');

    document.getElementById('btnExportJson').addEventListener('click', function() {
        collectAllState();
        Serializer.exportToFile(buildExportData(), 'level_' + (state.level.id || 'new') + '.json');
        modal.classList.add('hidden');
    });

    document.getElementById('btnExportGame').addEventListener('click', function() {
        collectAllState();
        Serializer.exportToFile(Serializer.toGameFormat(buildExportData()), 'GameJsonCfg_' + (state.level.id || 'new') + '.json');
        modal.classList.add('hidden');
    });

    document.getElementById('btnExportMerge').addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = function(e) {
            if (e.target.files.length > 0) {
                Serializer.importGameJsonCfgFile(e.target.files[0]).then(function(existingJson) {
                    collectAllState();
                    Serializer.exportToFile(Serializer.exportGameMergeFile(buildExportData(), existingJson), 'GameJsonCfg.json');
                    modal.classList.add('hidden');
                });
            }
        };
        input.click();
    });

    modal.querySelector('.modal-close').addEventListener('click', function() { modal.classList.add('hidden'); });
    modal.querySelector('.modal-overlay').addEventListener('click', function() { modal.classList.add('hidden'); });
}

function collectAllState() {
    collectBasicInfo();
    if (typeof WorkflowEditorModule !== 'undefined') state.diffPoints = WorkflowEditorModule.getDiffPoints();
}

function buildExportData() {
    return {
        level: state.level, canvas: state.canvas, assets: state.assets,
        nodes: CanvasEngine.getNodes(), diffPoints: state.diffPoints,
        talkMsgs: state.talkMsgs, talks: state.talks, bottomInfos: state.bottomInfos,
        diffPointCount: state.diffPointCount
    };
}

// ===== 保存 =====
function saveProject() {
    collectAllState();
    Serializer.saveToLocalStorage('level-editor-data', buildExportData());
    renderWorkflowSteps();
    if (typeof animalUtils !== 'undefined' && animalUtils.showTypewriterToast) {
        animalUtils.showTypewriterToast('保存成功');
    }
}

// ===== 返回按钮 =====
function initBackButtons() {
    document.querySelectorAll('.back-btn[data-page]').forEach(function(btn) {
        btn.addEventListener('click', function() { showPage(btn.dataset.page); });
    });
}

// ===== 键盘快捷键 =====
function bindKeyboard() {
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); HistoryManager.undo(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); HistoryManager.redo(); }
        if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveProject(); }
        if (e.key === 'Escape') setEditMode('select');
        if (e.key === 'Delete') {
            var sel = CanvasEngine.getSelectedNode();
            if (sel) {
                // 检查是否关联差异点
                var linkedDp = null;
                for (var i = 0; i < state.diffPoints.length; i++) {
                    if (state.diffPoints[i].newNodes && state.diffPoints[i].newNodes.indexOf(sel.id) >= 0) {
                        linkedDp = state.diffPoints[i]; break;
                    }
                }
                if (linkedDp) removeDiffPoint(linkedDp.id);
                else { CanvasEngine.removeNode(sel); renderWorkflowSteps(); }
                updateGuide();
            }
        }
    });
}

// ===== TalkMsg 管理 =====
function renderTalkMsgList() {
    var container = document.getElementById('talkMsgList');
    if (!container) return;

    if (state.talkMsgs.length === 0) {
        container.innerHTML = '<p class="placeholder-text">暂无对话消息</p>';
        return;
    }

    var html = '';
    state.talkMsgs.forEach(function(msg, idx) {
        html += '<div class="talk-msg-item" data-idx="' + idx + '">';
        html += '<span class="talk-msg-id">#' + msg.id + '</span>';
        html += '<span class="talk-msg-text">' + (msg.text || '(空)') + '</span>';
        html += '<span class="talk-msg-time">' + (msg.time || 0) + 's</span>';
        html += '<button class="talk-msg-del" data-idx="' + idx + '">×</button>';
        html += '</div>';
    });
    container.innerHTML = html;

    // 删除按钮
    container.querySelectorAll('.talk-msg-del').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            state.talkMsgs.splice(parseInt(btn.dataset.idx), 1);
            renderTalkMsgList();
        });
    });

    // 点击编辑
    container.querySelectorAll('.talk-msg-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var idx = parseInt(item.dataset.idx);
            editTalkMsg(idx);
        });
    });
}

function initTalkMsgPanel() {
    var btnAdd = document.getElementById('btnAddTalkMsg');
    if (btnAdd) {
        btnAdd.addEventListener('click', function() {
            var maxId = 0;
            state.talkMsgs.forEach(function(m) { if (m.id > maxId) maxId = m.id; });
            state.talkMsgs.push({
                id: maxId + 1,
                text: '',
                time: 2,
                name: '',
                img: '',
                pos: [],
                type: 0,
                sound: '',
                soundVolume: 1
            });
            renderTalkMsgList();
            editTalkMsg(state.talkMsgs.length - 1);
        });
    }

    // Talks 配置输入
    ['talksStartTalk', 'talksTalk', 'talksNextTalk'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                if (!state.talks) state.talks = {};
                if (id === 'talksStartTalk') {
                    try { state.talks.startTalk = JSON.parse(el.value); } catch (e) { state.talks.startTalk = []; }
                } else if (id === 'talksTalk') {
                    state.talks.talk = parseInt(el.value) || 0;
                } else if (id === 'talksNextTalk') {
                    state.talks.nexttalk = parseInt(el.value) || 0;
                }
            });
        }
    });
}

function editTalkMsg(idx) {
    var msg = state.talkMsgs[idx];
    if (!msg) return;

    var newText = prompt('消息内容:', msg.text || '');
    if (newText !== null) {
        msg.text = newText;
        var newTime = prompt('显示时间(秒):', msg.time || 2);
        if (newTime !== null) msg.time = parseFloat(newTime) || 2;
        renderTalkMsgList();
    }
}

function populateTalksConfig() {
    if (!state.talks) return;
    var startTalkEl = document.getElementById('talksStartTalk');
    var talkEl = document.getElementById('talksTalk');
    var nextTalkEl = document.getElementById('talksNextTalk');
    if (startTalkEl) startTalkEl.value = JSON.stringify(state.talks.startTalk || []);
    if (talkEl) talkEl.value = state.talks.talk || 1;
    if (nextTalkEl) nextTalkEl.value = state.talks.nexttalk || 2;
}

// ===== 全局回调 =====
window.onNodeSelected = function(node) {
    renderNodeTree();
    if (typeof PropertyPanelModule !== 'undefined') {
        PropertyPanelModule.showNodeProperties(node);
    }
};
window.onNodeMoved = function(node) {
    if (typeof PropertyPanelModule !== 'undefined') {
        PropertyPanelModule.showNodeProperties(node);
    }
};

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', function() {
    initWelcome();
    initBasicInfo();
    initCanvasSetup();
    initExportModal();
    initBackButtons();
    bindKeyboard();
});
