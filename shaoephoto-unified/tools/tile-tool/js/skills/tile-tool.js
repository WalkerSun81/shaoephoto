/**
 * ============================================
 *   ShaoePhoto - 精灵图拆分工具
 * ============================================
 */

var TileToolSkill = {

    // ===== 基本信息 =====
    id: 'tile-tool',
    name: '抠图',
    icon: '抠',
    description: '异形拆分+合并拼图，支持套索辅助内扣',
    key: '8',

    // ===== 内部状态 =====
    _overlay: null,
    _toastEl: null,
    _magnifierEl: null,
    _magCanvas: null,
    _magCtx: null,
    _mainCanvas: null,
    _mainCtx: null,
    _overlayCanvas: null,
    _overlayCtx: null,
    _pendingLoad: null,
    _resizeObserver: null,

    // ===== 事件引用（用于清理） =====
    _onKeyDown: null,
    _onPaste: null,
    _onTransformMouseMove: null,
    _onTransformMouseUp: null,
    _onHeaderDown: null,
    _onDocMouseMove: null,
    _onDocMouseUp: null,

    // ===== 常量 =====
    REGION_COLORS: [
        '#e94560','#00c853','#2979ff','#ffab00','#aa00ff',
        '#00bcd4','#ff6d00','#64dd17','#d500f9','#304ffe',
        '#ff1744','#00e676','#2979ff','#ffc400','#d500f9',
        '#18ffff','#ff9100','#76ff03','#ea80fc','#448aff'
    ],
    MAG_SIZE: 140,
    MAG_ZOOM: 8,
    DB_NAME: 'TileToolDB',
    DB_VER: 1,
    STORE: 'settings',

    // ===== 状态对象 =====
    state: null,

    _initState: function() {
        this.state = {
            mode: 'split',
            splitMode: 'irregular',
            originalImage: null,
            processedImageData: null,
            irColorPickMode: null,
            removeBgColor: { r: 255, g: 255, b: 255 },
            removeBgHueTol: 30,
            removeBgFeather: 10,
            removeBgSpill: true,
            undoStack: [],
            undoStackSize: 20,
            canvasBgMode: 'checkerboard',
            irBgColor: { r: 255, g: 255, b: 255 },
            irOutlineColor: { r: 0, g: 0, b: 0 },
            innerBgColor: { r: 255, g: 255, b: 255 },
            innerOutlineColor: { r: 0, g: 0, b: 0 },
            innerBgSpill: true,
            regions: [],
            selectedRegion: -1,
            innerSelectedRegions: {},
            scale: 1,
            mergeImages: [],
            dragging: false,
            dragType: null,
            dragStart: null,
            lassoMode: null,
            lassoPoints: [],
            lassoRegions: [],
            mergeSelectActive: false,
            mergeRect: null,
            lassoDrawing: false,
            innerProtectMask: null,
            innerProtectActive: false,
            bgProtectMask: null,
            bgProtectActive: false,
            bgProtectBrushSize: 40,
            canvasPanning: false,
            panStartX: 0,
            panStartY: 0,
            gridLineDragging: false,
            gridLineType: null,  // 'col' or 'row'
            gridLineIndex: -1,
            overlayVisible: true,
            strokeColor: '#000000',
            strokeWidth: 2,
            strokeInnerWidth: 0,
            transformMode: null,
            transformDrag: false,
            transformStart: null,
            transformInitBounds: null,
            _scaleFromCorner: null,
            _isRotating: false,
            _rotateStartAngle: 0,
            _rotateCenter: null,
            _rotateInitBounds: null,
            // 拆分下载对话框
            splitDownload: {
                dialogEl: null,
                groupSize: 1,
                namePrefix: '',
                spriteItems: [],
                selectedDirHandle: null,
                groupNames: {}
            }
        };
    },

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;

        // 如果已有 overlay，只更新子工具栏
        if (this._overlay) {
            SkillSystem.renderSubTools();
            return;
        }

        this._initState();
        this._createOverlay();
        SkillSystem.renderSubTools();

        if (this._pendingLoad) {
            var data = this._pendingLoad;
            this._pendingLoad = null;
            if (data.mode) this.state.mode = data.mode;
            if (data.detectSensitivity !== undefined) {
                var el2 = this._overlay.querySelector('#detectSensitivity');
                if (el2) el2.value = data.detectSensitivity;
                var valEl2 = this._overlay.querySelector('#detectSensVal');
                if (valEl2) valEl2.textContent = data.detectSensitivity;
            }
            if (data.outlineTolerance !== undefined) {
                var el3 = this._overlay.querySelector('#outlineTolerance');
                if (el3) el3.value = data.outlineTolerance;
                var valEl3 = this._overlay.querySelector('#outlineTolVal');
                if (valEl3) valEl3.textContent = data.outlineTolerance;
            }
            if (data.minArea !== undefined) {
                var el4 = this._overlay.querySelector('#minArea');
                if (el4) el4.value = data.minArea;
                var valEl4 = this._overlay.querySelector('#minAreaVal');
                if (valEl4) valEl4.textContent = data.minArea;
            }
            if (data.dilatePx !== undefined) {
                var el5 = this._overlay.querySelector('#dilatePx');
                if (el5) el5.value = data.dilatePx;
                var valEl5 = this._overlay.querySelector('#dilatePxVal');
                if (valEl5) valEl5.textContent = data.dilatePx;
            }
            if (data.innerTolerance !== undefined) {
                var el6 = this._overlay.querySelector('#innerTolerance');
                if (el6) el6.value = data.innerTolerance;
                var valEl6 = this._overlay.querySelector('#innerTolVal');
                if (valEl6) valEl6.textContent = data.innerTolerance;
            }
            if (data.innerDilatePx !== undefined) {
                var el7 = this._overlay.querySelector('#innerDilatePx');
                if (el7) el7.value = data.innerDilatePx;
                var valEl7 = this._overlay.querySelector('#innerDilatePxVal');
                if (valEl7) valEl7.textContent = data.innerDilatePx;
            }
            if (data.trimTransparent !== undefined) {
                var el10 = this._overlay.querySelector('#trimTransparent');
                if (el10) el10.checked = data.trimTransparent;
            }
            if (data.splitFormat) {
                var el11 = this._overlay.querySelector('#splitFormat');
                if (el11) el11.value = data.splitFormat;
            }
            if (data.removeBgHueTol !== undefined) {
                var el12 = this._overlay.querySelector('#removeBgHueTol');
                if (el12) el12.value = data.removeBgHueTol;
                var valEl12 = this._overlay.querySelector('#removeBgHueTolVal');
                if (valEl12) valEl12.textContent = data.removeBgHueTol;
            }
            if (data.removeBgFeather !== undefined) {
                var el13 = this._overlay.querySelector('#removeBgFeather');
                if (el13) el13.value = data.removeBgFeather;
                var valEl13 = this._overlay.querySelector('#removeBgFeatherVal');
                if (valEl13) valEl13.textContent = data.removeBgFeather;
            }
            if (data.removeBgSpill !== undefined) {
                var el14 = this._overlay.querySelector('#removeBgSpill');
                if (el14) el14.checked = data.removeBgSpill;
            }
            if (data.strokeColor) {
                var el15 = this._overlay.querySelector('#strokeColor');
                if (el15) {
                    el15.value = data.strokeColor;
                    var hexEl = this._overlay.querySelector('#strokeColorHex');
                    if (hexEl) hexEl.textContent = data.strokeColor.toUpperCase();
                }
            }
            if (data.strokeWidth !== undefined) {
                var el16 = this._overlay.querySelector('#strokeWidth');
                if (el16) el16.value = data.strokeWidth;
                var valEl16 = this._overlay.querySelector('#strokeWidthVal');
                if (valEl16) valEl16.textContent = data.strokeWidth;
            }
            if (data.strokeInnerWidth !== undefined) {
                var el17 = this._overlay.querySelector('#strokeInnerWidth');
                if (el17) el17.value = data.strokeInnerWidth;
                var valEl17 = this._overlay.querySelector('#strokeInnerWidthVal');
                if (valEl17) valEl17.textContent = data.strokeInnerWidth;
            }
            this._switchMode(data.mode || 'split');
        }
    },

    deactivate: function() {
        // 不做任何操作，窗口保持打开，只有关闭按钮才销毁
    },

    // ===== 子工具栏 =====

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '关',
                action: function() {
                    self._destroy();
                    if (typeof SkillSystem !== 'undefined') {
                        SkillSystem.deactivate();
                    }
                }
            }
        ];
    },

    // ===== 真正销毁（关闭按钮调用） =====
    _destroy: function() {
        // 清理键盘事件
        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        if (this._onBeforeUnload) {
            window.removeEventListener('beforeunload', this._onBeforeUnload);
            this._onBeforeUnload = null;
        }
        if (this._onPaste) {
            document.removeEventListener('paste', this._onPaste);
            this._onPaste = null;
        }
        if (this._onTransformMouseMove) {
            document.removeEventListener('mousemove', this._onTransformMouseMove);
            this._onTransformMouseMove = null;
        }
        if (this._onTransformMouseUp) {
            document.removeEventListener('mouseup', this._onTransformMouseUp);
            this._onTransformMouseUp = null;
        }
        if (this._onHeaderDown) {
            document.removeEventListener('mousedown', this._onHeaderDown, true);
            this._onHeaderDown = null;
        }
        if (this._onDocMouseMove) {
            document.removeEventListener('mousemove', this._onDocMouseMove);
            this._onDocMouseMove = null;
        }
        if (this._onDocMouseUp) {
            document.removeEventListener('mouseup', this._onDocMouseUp);
            this._onDocMouseUp = null;
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        // 关闭拆分下载对话框（如果打开）
        this._closeSplitDownloadDialog();
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._mainCanvas = null;
        this._protectCache = null;
        this._protectCacheDirty = true;
        this._mainCtx = null;
        this._overlayCanvas = null;
        this._overlayCtx = null;
        this._brushCanvas = null;
        this._brushCtx = null;
        this._toastEl = null;
        this._magnifierEl = null;
        this._magCanvas = null;
        this._magCtx = null;
        this._initState();
    },

    // ===== IndexedDB 辅助方法 =====

    _openDB: function() {
        var self = this;
        return new Promise(function(res, rej) {
            var r = indexedDB.open(self.DB_NAME, self.DB_VER);
            r.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(self.STORE)) db.createObjectStore(self.STORE);
            };
            r.onsuccess = function(e) { res(e.target.result); };
            r.onerror = function(e) { rej(e); };
        });
    },

    // ===== 保存/恢复 =====

    save: function() {
        var s = this.state;
        return {
            mode: s.mode,
            detectSensitivity: this._getVal('#detectSensitivity'),
            outlineTolerance: this._getVal('#outlineTolerance'),
            minArea: this._getVal('#minArea'),
            dilatePx: this._getVal('#dilatePx'),
            innerTolerance: this._getVal('#innerTolerance'),
            innerDilatePx: this._getVal('#innerDilatePx'),
            trimTransparent: this._getChecked('#trimTransparent'),
            splitFormat: this._getVal('#splitFormat'),
            removeBgHueTol: this._getVal('#removeBgHueTol'),
            removeBgFeather: this._getVal('#removeBgFeather'),
            removeBgSpill: this._getChecked('#removeBgSpill'),
            strokeColor: this._getVal('#strokeColor'),
            strokeWidth: this._getVal('#strokeWidth'),
            strokeInnerWidth: this._getVal('#strokeInnerWidth')
        };
    },

    load: function(data) {
        if (!data) return;
        this._pendingLoad = data;
    },

    _getVal: function(sel) {
        if (!this._overlay) return undefined;
        var el = this._overlay.querySelector(sel);
        return el ? el.value : undefined;
    },

    _getChecked: function(sel) {
        if (!this._overlay) return undefined;
        var el = this._overlay.querySelector(sel);
        return el ? el.checked : undefined;
    },

    // ========================================
    //   CSS 样式
    // ========================================

    _getCSS: function() {
        return [
            ':root {',
            '  --bg: #1a1a2e; --bg2: #16213e; --bg3: #0f3460;',
            '  --accent: #e94560; --accent2: #533483; --text: #eee; --text2: #aaa;',
            '  --border: #333; --success: #00c853; --warn: #ffab00;',
            '}',
            '.tt-overlay { position:fixed; top:0;left:0;right:0;bottom:0; z-index:9999; display:flex; flex-direction:column; background:#1a1a2e; color:#eee; font-family:"Segoe UI",system-ui,sans-serif; overflow:hidden; user-select:none; }',
            '.tt-header { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; background:#16213e; border-bottom:1px solid #333; flex-shrink:0; user-select:none; }',
            '.tt-header h1 { font-size:18px; background:linear-gradient(135deg,#e94560,#ff6b9d); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:0; }',
            '.tt-mode-tabs { display:flex; gap:4px; background:#1a1a2e; border-radius:8px; padding:3px; }',
            '.tt-mode-tab { padding:7px 18px; border:none; border-radius:6px; cursor:pointer; background:transparent; color:#aaa; font-size:13px; font-weight:500; transition:.2s; }',
            '.tt-mode-tab.active { background:#e94560; color:#fff; }',
            '.tt-mode-tab:hover:not(.active) { background:rgba(255,255,255,.08); }',
            '.tt-toggle-overlay-btn { background:rgba(255,255,255,.08); border:1px solid #555; color:#aaa; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:15px; line-height:1; transition:.2s; }',
            '.tt-toggle-overlay-btn:hover { background:rgba(255,255,255,.15); color:#fff; }',
            '.tt-toggle-overlay-btn.active { background:#e94560; border-color:#e94560; color:#fff; }',
            '.tt-app { display:flex; flex:1; overflow:hidden; min-height:0; }',
            '.tt-sidebar { width:300px; min-width:300px; background:#16213e; border-right:1px solid #333; overflow-y:auto; padding:14px; }',
            '.tt-main { flex:1; display:flex; align-items:center; justify-content:center; overflow:auto; position:relative; background:repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%,transparent 0% 50%) 0 0/20px 20px; min-width:0; }',
            '.tt-panel { display:none; }',
            '.tt-panel.active { display:block; }',
            '.tt-section { margin-bottom:16px; padding:10px; border:1px dashed #444; border-radius:8px; background:rgba(255,255,255,.02); }',
            '.tt-section-title { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#aaa; margin-bottom:7px; display:flex; align-items:center; gap:6px; }',
            '.tt-section-title::before { content:""; width:3px; height:12px; background:#e94560; border-radius:2px; }',
            '.tt-step-title { font-size:13px; font-weight:bold; color:#e94560; margin:0 0 8px; padding:6px 10px; background:rgba(233,69,96,0.1); border-radius:6px; border-left:3px solid #e94560; }',
            '.tt-step-num { display:inline-block; width:22px; height:22px; line-height:22px; text-align:center; background:#e94560; color:#fff; border-radius:50%; font-size:12px; margin-right:6px; }',
            '.tt-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:7px 14px; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500; transition:.2s; width:100%; }',
            '.tt-btn-primary { background:#e94560; color:#fff; }',
            '.tt-btn-primary:hover { background:#d63851; transform:translateY(-1px); }',
            '.tt-btn-secondary { background:rgba(255,255,255,.08); color:#eee; border:1px solid #333; }',
            '.tt-btn-secondary:hover { background:rgba(255,255,255,.12); }',
            '.tt-btn-success { background:#00c853; color:#fff; }',
            '.tt-btn-success:hover { background:#00a844; }',
            '.tt-btn-sm { padding:5px 10px; font-size:11px; width:auto; }',
            '.tt-btn-group { display:flex; gap:6px; }',
            '.tt-btn-group .tt-btn { flex:1; }',
            '.tt-input-group { margin-bottom:9px; }',
            '.tt-input-group label { display:block; font-size:11px; color:#aaa; margin-bottom:3px; }',
            '.tt-input-group input[type="range"] { width:100%; accent-color:#e94560; }',
            '.tt-input-group input[type="number"], .tt-input-group input[type="text"], .tt-input-group select { width:100%; padding:5px 9px; background:#1a1a2e; border:1px solid #333; border-radius:4px; color:#eee; font-size:12px; }',
            '.tt-toggle { position:relative; display:inline-block; width:36px; height:20px; cursor:pointer; }',
            '.tt-toggle input { opacity:0; width:0; height:0; }',
            '.tt-toggle-slider { position:absolute; top:0; left:0; right:0; bottom:0; background:#333; border-radius:10px; transition:.2s; }',
            '.tt-toggle-slider::before { content:""; position:absolute; width:16px; height:16px; left:2px; bottom:2px; background:#fff; border-radius:50%; transition:.2s; }',
            '.tt-toggle input:checked + .tt-toggle-slider { background:#e94560; }',
            '.tt-toggle input:checked + .tt-toggle-slider::before { transform:translateX(16px); }',
            '.tt-grid-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }',
            '.tt-grid-row label:first-child { font-size:11px; color:#aaa; flex-shrink:0; }',
            '.tt-grid-row input[type="number"] { width:70px; padding:4px 8px; background:#1a1a2e; border:1px solid #333; border-radius:4px; color:#eee; font-size:12px; text-align:right; }',
            '.tt-grid-input-wrap { display:flex; align-items:center; gap:4px; }',
            '.tt-grid-input-wrap span { color:#888; font-size:11px; }',
            '.tt-range-row { display:flex; align-items:center; gap:8px; }',
            '.tt-range-row input[type="range"] { flex:1; }',
            '.tt-range-val { min-width:36px; text-align:center; font-size:11px; color:#e94560; font-weight:600; }',
            '.tt-upload-zone { border:2px dashed #333; border-radius:10px; padding:24px 16px; text-align:center; cursor:pointer; transition:.2s; margin-bottom:10px; }',
            '.tt-upload-zone:hover, .tt-upload-zone.dragover { border-color:#e94560; background:rgba(233,69,96,.05); }',
            '.tt-upload-zone .tt-icon { font-size:32px; margin-bottom:6px; }',
            '.tt-upload-zone p { font-size:12px; color:#aaa; }',
            '.tt-upload-zone input { display:none; }',
            '.tt-canvas-wrapper { position:relative; display:inline-block; overflow:auto; max-width:100%; max-height:100%; }',
            '.tt-canvas-wrapper canvas { display:block; }',
            '.tt-canvas-hint { position:absolute; top:0; left:0; right:0; padding:4px 10px; background:rgba(0,0,0,0.7); color:#aaa; font-size:10px; text-align:center; pointer-events:none; z-index:15; backdrop-filter:blur(4px); }',
            '.tt-overlay-canvas { position:absolute; top:0; left:0; cursor:crosshair; }',
            '.tt-info-bar { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.7); backdrop-filter:blur(8px); padding:5px 14px; border-radius:20px; font-size:11px; color:#aaa; display:flex; gap:14px; z-index:10; }',
            '.tt-info-bar span { display:flex; align-items:center; gap:4px; }',
            '.tt-info-bar .tt-val { color:#e94560; font-weight:600; }',
            '.tt-checkbox-row { display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; margin-bottom:7px; }',
            '.tt-checkbox-row input { accent-color:#e94560; }',
            '.tt-color-pick-row { display:flex; align-items:center; gap:8px; }',
            '.tt-color-pick-row input[type="color"] { width:30px; height:26px; border:none; border-radius:4px; cursor:pointer; background:transparent; }',
            '.tt-region-list { max-height:180px; overflow-y:auto; }',
            '.tt-region-item { display:flex; align-items:center; gap:6px; padding:4px 5px; border-radius:4px; font-size:11px; cursor:pointer; transition:.15s; border-left:3px solid transparent; }',
            '.tt-region-item:hover { background:rgba(255,255,255,.06); }',
            '.tt-region-item.selected { background:rgba(233,69,96,.15); border-left-color:#e94560; }',
            '.tt-region-item.inner-checked { background:rgba(0,200,83,.12); border-left-color:#00c853; }',
            '.tt-region-item.inner-checked .tt-info { color:#00c853; font-weight:600; }',
            '.tt-region-item .tt-color-dot { width:12px; height:12px; border-radius:3px; flex-shrink:0; }',
            '.tt-region-item .tt-info { flex:1; color:#aaa; }',
            '.tt-region-item .tt-del { width:18px; height:18px; background:transparent; border:none; color:#aaa; cursor:pointer; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; }',
            '.tt-region-item .tt-del:hover { background:#e94560; color:#fff; }',
            '.tt-region-item .tt-inner-cb { width:16px; height:16px; accent-color:#00c853; cursor:pointer; flex-shrink:0; }',
            '.tt-toast { position:fixed; bottom:20px; right:20px; background:#0f3460; color:#fff; padding:9px 18px; border-radius:8px; font-size:12px; z-index:99999; transform:translateX(120%); transition:.3s; border-left:3px solid #00c853; pointer-events:none; }',
            '.tt-toast.show { transform:translateX(0); }',
            '.tt-toast.error { border-left-color:#e94560; }',
            '.tt-empty-state { text-align:center; color:#aaa; }',
            '.tt-empty-state .tt-icon { font-size:44px; margin-bottom:10px; opacity:.5; }',
            '.tt-empty-state p { font-size:13px; }',
            '.tt-merge-grid { display:grid; gap:4px; padding:8px; }',
            '.tt-merge-item { position:relative; border-radius:6px; overflow:hidden; background:#1a1a2e; }',
            '.tt-merge-item img { display:block; width:100%; height:100%; object-fit:contain; }',
            '.tt-merge-item .tt-idx { position:absolute; top:2px; left:2px; background:rgba(0,0,0,.6); color:#fff; font-size:10px; padding:1px 5px; border-radius:3px; }',
            '.tt-merge-item .tt-del-btn { position:absolute; top:2px; right:2px; width:18px; height:18px; background:#e94560; color:#fff; border:none; border-radius:50%; font-size:11px; cursor:pointer; display:none; align-items:center; justify-content:center; }',
            '.tt-merge-item:hover .tt-del-btn { display:flex; }',
            '.tt-magnifier { display:none; position:fixed; width:140px; height:140px; border-radius:50%; border:3px solid #e94560; box-shadow:0 4px 20px rgba(0,0,0,.6); pointer-events:none; z-index:99998; overflow:hidden; background:#000; }',
            '.tt-magnifier canvas { display:block; }',
            '.tt-magnifier-cross-h, .tt-magnifier-cross-v { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(255,255,255,.5); pointer-events:none; }',
            '.tt-magnifier-cross-h { width:12px; height:2px; }',
            '.tt-magnifier-cross-v { width:2px; height:12px; }',
            '::-webkit-scrollbar { width:6px; }',
            '::-webkit-scrollbar-track { background:transparent; }',
            '::-webkit-scrollbar-thumb { background:#333; border-radius:3px; }',
            '.tt-sub-tabs{display:flex;gap:4px;margin-bottom:8px;}',
            '.tt-sub-tab{flex:1;padding:5px 8px;border-radius:4px;border:1px solid #1a3a6a;background:#0f3460;color:#aaa;font-size:12px;cursor:pointer;text-align:center;}',
            '.tt-sub-tab:hover{border-color:#e94560;color:#e94560;}',
            '.tt-sub-tab.active{background:#e94560;border-color:#e94560;color:#fff;}',
            '.lasso-active { background:#ffab00 !important; border-color:#ffab00 !important; color:#1a1a2e !important; font-weight:bold; }',
            '.tt-region-panel { width:220px; min-width:220px; background:rgba(22,33,62,0.95); border-left:1px solid #333; backdrop-filter:blur(8px); display:flex; flex-direction:column; overflow:hidden; }',
            '.tt-region-panel .tt-rp-header { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; font-size:12px; font-weight:bold; color:#eee; border-bottom:1px solid #333; flex-shrink:0; }',
            '.tt-region-panel .tt-rp-header .tt-rp-fold { background:transparent; border:none; color:#aaa; cursor:pointer; font-size:14px; padding:0 4px; }',
            '.tt-region-panel .tt-rp-header .tt-rp-fold:hover { color:#e94560; }',
            '.tt-region-panel .tt-rp-toolbar { display:flex; gap:2px; padding:4px 8px; border-bottom:1px solid rgba(255,255,255,.06); flex-shrink:0; }',
            '.tt-region-panel .tt-rp-toolbar button { background:rgba(255,255,255,.06); border:none; color:#aaa; font-size:10px; padding:3px 6px; border-radius:3px; cursor:pointer; }',
            '.tt-region-panel .tt-rp-toolbar button:hover { background:rgba(255,255,255,.12); color:#eee; }',
            '.tt-region-panel .tt-rp-footer { padding:6px 8px; border-top:1px solid rgba(255,255,255,.06); display:flex; gap:4px; flex-shrink:0; }',
            '.tt-region-panel .tt-rp-footer button { flex:1; background:rgba(255,255,255,.06); border:none; color:#aaa; font-size:10px; padding:4px 6px; border-radius:3px; cursor:pointer; }',
            '.tt-region-panel .tt-rp-footer button:hover { background:rgba(255,255,255,.12); color:#eee; }',
            '.tt-region-panel .tt-region-list { flex:1; overflow-y:auto; padding:4px 0; }',
            '.tt-region-panel .tt-region-list .tt-empty { font-size:11px; color:#555; text-align:center; padding:20px 10px; }',
            '.tt-region-panel.collapsed .tt-rp-toolbar, .tt-region-panel.collapsed .tt-region-list, .tt-region-panel.collapsed .tt-rp-footer { display:none; }',
            '.tt-region-panel.collapsed { width:36px; min-width:36px; }',
            '.tt-region-panel.collapsed .tt-rp-header { writing-mode:vertical-rl; padding:10px 8px; gap:8px; }',
            /* 拆分下载对话框 */
            '.tt-splitdlg-backdrop { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:10000; }',
            '.tt-splitdlg { width:800px; max-width:95vw; max-height:85vh; background:var(--bg); border:1px solid var(--border); border-radius:12px; display:flex; flex-direction:column; box-shadow:0 20px 60px rgba(0,0,0,0.5); }',
            '.tt-splitdlg-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }',
            '.tt-splitdlg-header h2 { font-size:18px; color:var(--accent); margin:0; }',
            '.tt-splitdlg-close { width:32px; height:32px; background:transparent; border:none; color:var(--text2); font-size:22px; cursor:pointer; border-radius:6px; display:flex; align-items:center; justify-content:center; }',
            '.tt-splitdlg-close:hover { background:rgba(255,255,255,0.08); color:var(--text); }',
            '.tt-splitdlg-body { display:flex; flex:1; overflow:hidden; min-height:0; }',
            '.tt-splitdlg-settings { width:280px; min-width:280px; padding:14px; border-right:1px solid var(--border); overflow-y:auto; }',
            '.tt-splitdlg-spritelist { flex:1; padding:14px; display:flex; flex-direction:column; min-width:0; overflow:hidden; }',
            '.tt-splitdlg-table-wrap { flex:1; overflow-y:auto; margin-top:8px; border:1px solid var(--border); border-radius:6px; }',
            '.tt-splitdlg-table { width:100%; border-collapse:collapse; font-size:12px; }',
            '.tt-splitdlg-table th { position:sticky; top:0; background:var(--bg2); color:var(--text2); font-weight:600; text-align:left; padding:8px 10px; border-bottom:1px solid var(--border); z-index:1; }',
            '.tt-splitdlg-table td { padding:6px 10px; border-bottom:1px solid rgba(255,255,255,0.04); color:var(--text); }',
            '.tt-splitdlg-table tr:hover td { background:rgba(255,255,255,0.03); }',
            '.tt-splitdlg-row { cursor:default; }',
            '.tt-splitdlg-row.tt-splitdlg-dragging { opacity:0.4; }',
            '.tt-splitdlg-row.tt-splitdlg-drag-over td { background:rgba(233,69,96,0.15); border-top:2px dashed #e94560; }',
            '.tt-splitdlg-drag-handle { display:inline-block; padding:0 4px; cursor:grab; color:var(--text2); font-size:14px; user-select:none; }',
            '.tt-splitdlg-drag-handle:hover { color:var(--text); }',
            '.tt-splitdlg-drag-handle:active { cursor:grabbing; }',
            '.tt-splitdlg-thumb { border-radius:3px; }',
            '.tt-splitdlg-table input[type="text"], .tt-splitdlg-table input[type="number"] { width:100%; padding:3px 6px; background:var(--bg2); border:1px solid transparent; border-radius:3px; color:var(--text); font-size:12px; }',
            '.tt-splitdlg-table input:focus { border-color:var(--accent); outline:none; background:var(--bg); }',
            '.tt-splitdlg-inner-dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:#00c853; margin-left:4px; vertical-align:middle; cursor:help; }',
            '.tt-splitdlg-group-header td { background:var(--bg2); color:var(--accent); font-weight:600; font-size:10px; text-transform:uppercase; letter-spacing:1px; padding:6px 10px; }',
            '.tt-splitdlg-footer { display:flex; justify-content:flex-end; gap:10px; padding:12px 20px; border-top:1px solid var(--border); flex-shrink:0; }'
        ].join('\n');
    },

    // ========================================
    //   创建弹出窗口
    // ========================================

    _createOverlay: function() {
        var self = this;

        // Create overlay container - full-screen
        var overlay = document.createElement('div');
        overlay.className = 'tt-overlay';
        overlay.id = 'tt-card';
        overlay.setAttribute('data-skill-id', 'tile-tool');

        // Inject styles
        var styleEl = document.createElement('style');
        styleEl.textContent = this._getCSS();
        overlay.appendChild(styleEl);

        // Header
        var header = document.createElement('div');
        header.className = 'tt-header';
        header.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
                '<div style="display:flex;align-items:center;gap:4px">' +
                    '<button class="tt-toggle-overlay-btn" data-action="goHome" title="返回首页"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>' +
                    '<button class="tt-toggle-overlay-btn active" data-action="toggleOverlay">轮廓线开关</button>' +
                    '<button class="tt-toggle-overlay-btn" data-action="globalUndo" title="撤销上一步操作">↩ 撤销</button>' +
                    '<button class="tt-toggle-overlay-btn" data-action="toggleCanvasBg">切换画布背景</button>' +
                    '<button class="tt-toggle-overlay-btn" data-action="deleteSelectedSprite" style="color:#e94560;">🗑 删除</button>' +
                '</div>' +
                '<span style="font-size:16px;font-weight:bold;color:#eee;">ShaoePhoto</span>' +
            '</div>';
        overlay.appendChild(header);

        // App container
        var app = document.createElement('div');
        app.className = 'tt-app';

        // Sidebar
        var sidebar = document.createElement('div');
        sidebar.className = 'tt-sidebar';
        sidebar.innerHTML = this._buildSidebarHTML();
        app.appendChild(sidebar);

        // Main area
        var main = document.createElement('div');
        main.className = 'tt-main';
        main.id = 'ttMainArea';
        main.innerHTML = this._buildMainHTML();
        app.appendChild(main);

        overlay.appendChild(app);

        // Toast
        var toast = document.createElement('div');
        toast.className = 'tt-toast';
        toast.id = 'ttToast';
        overlay.appendChild(toast);

        // Magnifier
        var mag = document.createElement('div');
        mag.className = 'tt-magnifier';
        mag.id = 'ttMagnifier';
        mag.innerHTML =
            '<canvas id="ttMagCanvas" width="140" height="140"></canvas>' +
            '<div class="tt-magnifier-cross-h"></div>' +
            '<div class="tt-magnifier-cross-v"></div>';
        overlay.appendChild(mag);

        // Append to document body (position:fixed, not canvas layer)
        document.body.appendChild(overlay);
        this._overlay = overlay;
        this._toastEl = toast;

        // Init overlay toggle button state
        var toggleBtn = overlay.querySelector('[data-action="toggleOverlay"]');
        if (toggleBtn) toggleBtn.classList.add('active');

        this._magnifierEl = mag;
        this._magCanvas = overlay.querySelector('#ttMagCanvas');
        this._magCtx = this._magCanvas.getContext('2d');

        // Get canvas refs
        this._mainCanvas = overlay.querySelector('#ttMainCanvas');
        this._mainCtx = this._mainCanvas.getContext('2d');
        this._overlayCanvas = overlay.querySelector('#ttOverlayCanvas');
        this._overlayCtx = this._overlayCanvas.getContext('2d');

        // Create brush canvas (on top of overlay, for brush drawing)
        var brushCanvas = document.createElement('canvas');
        brushCanvas.id = 'ttBrushCanvas';
        brushCanvas.className = 'tt-overlay-canvas';
        brushCanvas.style.pointerEvents = 'none';
        overlay.querySelector('.tt-canvas-wrapper').appendChild(brushCanvas);
        this._brushCanvas = brushCanvas;
        this._brushCtx = brushCanvas.getContext('2d');

        // Bind events
        this._bindEvents(overlay);
    },

    _buildSidebarHTML: function() {
        return '' +
        '<!-- SPLIT PANEL -->' +
        '<div class="tt-panel active" id="ttSplitPanel">' +
            '<div class="tt-sub-tabs">' +
                '<button class="tt-sub-tab active" data-split-mode="irregular">异形</button>' +
                '<button class="tt-sub-tab" data-split-mode="grid">方形</button>' +
            '</div>' +
            '<div class="tt-section">' +
                '<div class="tt-step-title">上传图片</div>' +
                '<div class="tt-upload-zone" id="ttSplitUpload">' +
                    '<div class="tt-icon">📁</div>' +
                    '<p>点击或拖拽上传素材图</p>' +
                    '<p style="font-size:10px;margin-top:3px">支持 PNG / JPG / WebP</p>' +
                    '<input type="file" id="ttSplitFile" accept="image/*">' +
                '</div>' +
            '</div>' +
            '<!-- GRID MODE PANEL -->' +
            '<div id="ttGridPanel" style="display:none">' +
                '<div class="tt-step-title">方形分割设置</div>' +
                '<div class="tt-grid-row"><label>行数</label><input type="number" id="ttGridRows" value="3" min="1" max="100"></div>' +
                '<div class="tt-grid-row"><label>列数</label><input type="number" id="ttGridCols" value="3" min="1" max="100"></div>' +
                '<div class="tt-grid-row"><label>分割线宽度</label><div class="tt-grid-input-wrap"><input type="number" id="ttGridLineWidth" min="0" max="100" value="1"><span>px</span></div></div>' +
                '<div class="tt-grid-row"><label>边缘轮廓</label><label class="tt-toggle" id="ttGridEdgeToggle"><input type="checkbox" id="ttGridEdge"><span class="tt-toggle-slider"></span></label></div>' +
                '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="tt-btn tt-btn-primary" data-action="gridSplit">方形分割</button></div>' +
            '</div>' +
            '<!-- IRREGULAR MODE -->' +
            '<div id="ttIrregularPanel">' +
                '<div class="tt-section">' +
                    '<div class="tt-step-title">标记背景色/轮廓色 & 异形检测</div>' +
                    '<p style="font-size:11px;color:#aaa;margin-bottom:7px">先标注背景色和轮廓色，再检测</p>' +
                    '<div class="tt-input-group">' +
                        '<label>背景色</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="irBgColor" value="#ffffff">' +
                            '<span id="irBgColorHex" style="font-size:11px;color:#aaa">#FFFFFF</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="bg" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>轮廓色</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="irOutlineColor" value="#000000">' +
                            '<span id="irOutlineColorHex" style="font-size:11px;color:#aaa">#000000</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="outline" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>轮廓色容差</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="outlineTolerance" min="1" max="100" value="80">' +
                            '<span class="tt-range-val" id="outlineTolVal">80</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>检测灵敏度</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="detectSensitivity" min="1" max="100" value="30">' +
                            '<span class="tt-range-val" id="detectSensVal">30</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>最小区域面积 (px²)</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="minArea" min="10" max="5000" value="100" step="10">' +
                            '<span class="tt-range-val" id="minAreaVal">100</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>轮廓外扩 (px)</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="dilatePx" min="-5" max="10" value="-1">' +
                            '<span class="tt-range-val" id="dilatePxVal">-1</span>' +
                        '</div>' +
                    '</div>' +
                    '<button class="tt-btn tt-btn-primary" data-action="smartDetect" style="width:100%;margin-top:8px">粗略扣图</button>' +
                '</div>' +
                '<div id="ttIrregularSteps">' +
                '<!-- REMOVE BG MODULE -->' +
                '<div class="tt-section">' +
                    '<div class="tt-step-title">消除背景色</div>' +
                    '<p style="font-size:11px;color:#aaa;margin-bottom:7px">选取要清除的背景色，一键移除</p>' +
                    '<div class="tt-input-group">' +
                        '<label>背景色</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="removeBgColor" value="#ffffff">' +
                            '<span id="removeBgColorHex" style="font-size:11px;color:#aaa">#FFFFFF</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="removeBg" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>色相范围 (°)</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="removeBgHueTol" min="1" max="180" value="30">' +
                            '<span class="tt-range-val" id="removeBgHueTolVal">30</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>边缘柔化 (°)</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="removeBgFeather" min="0" max="60" value="10">' +
                            '<span class="tt-range-val" id="removeBgFeatherVal">10</span>' +
                        '</div>' +
                    '</div>' +
                    '<label class="tt-checkbox-row">' +
                        '<input type="checkbox" id="removeBgSpill" checked>' +
                        '去绿溢出（去除前景边缘的绿色反射）' +
                    '</label>' +
                    '<div style="display:flex;gap:4px;margin-top:6px">' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="bgProtectBrush" style="border-color:#ffab00;flex:1">🖌️ 保护笔刷</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="clearBgProtect" style="flex:0">清除</button>' +
                    '</div>' +
                    '<div style="display:flex;gap:4px;margin:4px 0">' +
                        '<span style="font-size:10px;color:#888;line-height:22px;">笔刷大小:</span>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="bgBrushSize" data-size="20" style="flex:1;font-size:10px">小</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="bgBrushSize" data-size="30" style="flex:1;font-size:10px">中</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm lasso-active" data-action="bgBrushSize" data-size="40" style="flex:1;font-size:10px">大</button>' +
                    '</div>' +
                    '<p style="font-size:10px;color:#888;margin:2px 0 6px">笔刷涂过的像素在消除背景色时不会被清除</p>' +
                    '<button class="tt-btn tt-btn-primary" data-action="removeBgColor" style="width:100%">清除背景色</button>' +
                '</div>' +
                '<div class="tt-section" id="ttInnerBgSection">' +
                    '<div class="tt-step-title">内扣设置 & 去除内部背景</div>' +
                    '<div class="tt-input-group">' +
                        '<label>内部背景色</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="innerBgColor" value="#ffffff">' +
                            '<span id="innerBgColorHex" style="font-size:11px;color:#aaa">#FFFFFF</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="innerBg" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>内部轮廓色（可选）</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="innerOutlineColor" value="#000000">' +
                            '<span id="innerOutlineColorHex" style="font-size:11px;color:#aaa">#000000</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="innerOutline" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>内部容差</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="innerTolerance" min="1" max="100" value="65">' +
                            '<span class="tt-range-val" id="innerTolVal">65</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>内扣轮廓外扩 (px)</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="innerDilatePx" min="-5" max="10" value="1">' +
                            '<span class="tt-range-val" id="innerDilatePxVal">1</span>' +
                        '</div>' +
                    '</div>' +
                    '<label class="tt-checkbox-row">' +
                        '<input type="checkbox" id="innerBgSpill" checked>' +
                        '去绿溢出（去除前景边缘的绿色反射）' +
                    '</label>' +
                    '<div style="margin-top:8px">' +
                        '<p style="font-size:11px;color:#aaa;margin-bottom:6px">保护区域：用套索圈出不想被删除的区域</p>' +
                        '<div class="tt-btn-group" style="margin-bottom:4px">' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="innerProtectLasso" style="border-color:#00c853">🛡️ 保护套索</button>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="clearInnerProtect">清除保护</button>' +
                        '</div>' +
                    '</div>' +
                    '<button class="tt-btn tt-btn-primary" data-action="applyInnerBgRemove" style="width:100%;margin-top:8px">精致抠图</button>' +
                '</div>' +
                '<div class="tt-section" id="ttRestoreSection">' +
                    '<div class="tt-step-title">手动框选删除</div>' +
                    '<p style="font-size:11px;color:#aaa;margin:0 0 7px">用套索圈出要删除的区域，按"确认删除"将区域内像素变透明</p>' +
                    '<div class="tt-btn-group">' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="lassoMode" data-lasso="lasso">框选</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="clearLasso">清除选区</button>' +
                        '<button class="tt-btn tt-btn-danger tt-btn-sm" data-action="applyLassoDelete">确认删除</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="applyRestore">恢复选区</button>' +
                    '</div>' +
                '</div>' +
                '</div>' +
            '</div>' +
            '<!-- TRANSFORM MODULE -->' +
            '<div class="tt-section">' +
                '<div class="tt-step-title">移动 / 缩放 / 旋转</div>' +
                '<p style="font-size:11px;color:#aaa;margin-bottom:7px">拖主体移动，拖<span style="color:#ffab00">黄块</span>缩放，拖<span style="color:#e94560">红块</span>旋转</p>' +
                '<div class="tt-btn-group">' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="transformMode" data-transform="move">变换</button>' +
                '</div>' +
            '</div>' +
            '<!-- AUTO STROKE -->' +
            '<div class="tt-section">' +
                '<div class="tt-step-title">描边修复</div>' +
                '<p style="font-size:11px;color:#aaa;margin-bottom:7px">对精灵边缘自动描边，修补轮廓瑕疵</p>' +
                '<div class="tt-input-group">' +
                    '<label>描边颜色</label>' +
                    '<div class="tt-color-pick-row">' +
                        '<input type="color" id="strokeColor" value="#000000">' +
                        '<span id="strokeColorHex" style="font-size:11px;color:#aaa">#000000</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>向外描边像素</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="strokeWidth" min="1" max="20" value="2">' +
                        '<span class="tt-range-val" id="strokeWidthVal">2</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>向内填充像素</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="strokeInnerWidth" min="0" max="10" value="0">' +
                        '<span class="tt-range-val" id="strokeInnerWidthVal">0</span>' +
                    '</div>' +
                '</div>' +
                '<button class="tt-btn tt-btn-primary" data-action="applyAutoStroke">自动描边</button>' +
            '</div>' +
            '<!-- MERGE SPRITES -->' +
            '<div class="tt-section">' +
                '<div class="tt-step-title">组合精灵</div>' +
                '<p style="font-size:11px;color:#aaa;margin-bottom:7px">点击"框选"后在画布上拖拽，松手即自动合并区域内像素和精灵</p>' +
                '<div class="tt-btn-group" style="flex-wrap:wrap;gap:4px">' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="mergeSelect">框选</button>' +
                '</div>' +
            '</div>' +
            '<!-- COMMON OUTPUT -->' +
            '<div class="tt-section">' +
                '<div class="tt-step-title">输出 & 下载</div>' +
                '<div class="tt-input-group">' +
                    '<label>输出格式</label>' +
                    '<select id="splitFormat" style="width:100%;padding:5px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#eee">' +
                        '<option value="png">PNG (无损，推荐异形)</option>' +
                        '<option value="webp">WebP</option>' +
                    '</select>' +
                '</div>' +
                '<label class="tt-checkbox-row">' +
                    '<input type="checkbox" id="trimTransparent" checked>' +
                    '裁剪透明边缘' +
                '</label>' +
                '<div class="tt-btn-group" style="flex-wrap:wrap;gap:4px;margin-top:8px">' +
                    '<button class="tt-btn tt-btn-success" data-action="splitAndDownload" id="ttSplitBtn" disabled>拆分下载</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    _buildMainHTML: function() {
        return '' +
        '<div id="ttSplitView" style="display:flex;flex-direction:row;align-items:stretch;width:100%;height:100%;position:relative;overflow:hidden">' +
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:0;position:relative">' +
                '<div class="tt-canvas-hint" id="ttCanvasHint" style="display:none">右键拖拽：平移画布 &nbsp;|&nbsp; 滚轮：缩放</div>' +
                '<div class="tt-empty-state" id="ttSplitEmpty">' +
                    '<div class="tt-icon">🖼️</div>' +
                    '<p>上传一张素材图开始拆分</p>' +
                '</div>' +
                '<div class="tt-canvas-wrapper" id="ttCanvasWrapper" style="display:none">' +
                    '<canvas id="ttMainCanvas"></canvas>' +
                    '<canvas id="ttOverlayCanvas" class="tt-overlay-canvas"></canvas>' +
                '</div>' +
            '</div>' +
            '<div class="tt-region-panel" id="ttRegionPanel" style="display:none">' +
                '<div class="tt-rp-header">' +
                    '<span>图层</span>' +
                    '<button class="tt-rp-fold" data-action="toggleRegionPanel" title="折叠/展开">−</button>' +
                '</div>' +
                '<div class="tt-rp-toolbar">' +
                    '<button data-action="selectAllRegions" data-select="true">全选</button>' +
                    '<button data-action="selectAllRegions" data-select="false">全不选</button>' +
                    '<button data-action="invertRegionSelection">反选</button>' +
                '</div>' +
                '<div class="tt-region-list" id="ttRegionList">' +
                    '<div class="tt-empty">暂无检测区域</div>' +
                '</div>' +
                '<div class="tt-rp-footer">' +
                    '<button data-action="clearAllRegions">清空</button>' +
                    '<button data-action="undoLastRegion">撤销</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="tt-info-bar" id="ttInfoBar" style="display:none">' +
            '<span>尺寸: <span class="tt-val" id="ttInfoSize">-</span></span>' +
            '<span id="ttInfoBoxLabel">选框: <span class="tt-val" id="ttInfoBoxes">0</span></span>' +
            '<span>缩放: <span class="tt-val" id="ttInfoZoom">100%</span></span>' +
        '</div>';
    },

    // ========================================
    //   事件绑定
    // ========================================

    _bindEvents: function(overlay) {
        var self = this;

        // Stop propagation for all mousedown/wheel inside overlay
        overlay.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        overlay.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: false });

        // 页面刷新/关闭前
        this._onBeforeUnload = function() {};
        window.addEventListener('beforeunload', this._onBeforeUnload);

        // ResizeObserver: 监听 resize:both 大小变化，重绘 canvas
        this._resizeObserver = new ResizeObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].target === overlay) {
                    self._onOverlayResize();
                    break;
                }
            }
        });
        this._resizeObserver.observe(overlay);

        // Mode tabs
        overlay.querySelectorAll('.tt-mode-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                self._switchMode(this.getAttribute('data-mode'));
            });
        });

        // Split sub-mode tabs (irregular / grid)
        overlay.querySelectorAll('.tt-sub-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var mode = this.getAttribute('data-split-mode');
                self.state.splitMode = mode;
                overlay.querySelectorAll('.tt-sub-tab').forEach(function(t) {
                    t.classList.toggle('active', t.getAttribute('data-split-mode') === mode);
                });
                var gridPanel = overlay.querySelector('#ttGridPanel');
                var irregularPanel = overlay.querySelector('#ttIrregularPanel');
                var irregularSteps = overlay.querySelector('#ttIrregularSteps');
                if (mode === 'grid') {
                    if (gridPanel) gridPanel.style.display = 'block';
                    if (irregularPanel) irregularPanel.style.display = 'none';
                    if (irregularSteps) irregularSteps.style.display = 'none';
                } else {
                    if (gridPanel) gridPanel.style.display = 'none';
                    if (irregularPanel) irregularPanel.style.display = 'block';
                    if (irregularSteps) irregularSteps.style.display = 'block';
                }
            });
        });

        // Split file upload
        var splitFileInput = overlay.querySelector('#ttSplitFile');
        var splitUploadZone = overlay.querySelector('#ttSplitUpload');
        splitUploadZone.addEventListener('click', function() { splitFileInput.click(); });
        splitFileInput.addEventListener('change', function(e) {
            if (e.target.files[0]) self._loadSplitImage(e.target.files[0]);
        });
        splitUploadZone.addEventListener('dragover', function(e) {
            e.preventDefault(); e.stopPropagation();
            splitUploadZone.classList.add('dragover');
        });
        splitUploadZone.addEventListener('dragleave', function(e) {
            e.stopPropagation();
            splitUploadZone.classList.remove('dragover');
        });
        splitUploadZone.addEventListener('drop', function(e) {
            e.preventDefault(); e.stopPropagation();
            splitUploadZone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) self._loadSplitImage(e.dataTransfer.files[0]);
        });

        // Range inputs - update display values
        var rangePairs = [
            ['outlineTolerance', 'outlineTolVal'],
            ['detectSensitivity', 'detectSensVal'],
            ['minArea', 'minAreaVal'],
            ['dilatePx', 'dilatePxVal'],
            ['innerTolerance', 'innerTolVal'],
            ['innerDilatePx', 'innerDilatePxVal'],
            ['removeBgHueTol', 'removeBgHueTolVal'],
            ['removeBgFeather', 'removeBgFeatherVal'],
            ['strokeWidth', 'strokeWidthVal'],
            ['strokeInnerWidth', 'strokeInnerWidthVal']
        ];
        rangePairs.forEach(function(pair) {
            var range = overlay.querySelector('#' + pair[0]);
            var val = overlay.querySelector('#' + pair[1]);
            if (range && val) {
                range.addEventListener('input', function() {
                    val.textContent = this.value;
                });
            }
        });

        // Stroke color hex display
        var strokeColorInput = overlay.querySelector('#strokeColor');
        var strokeColorHex = overlay.querySelector('#strokeColorHex');
        if (strokeColorInput && strokeColorHex) {
            strokeColorInput.addEventListener('input', function() {
                strokeColorHex.textContent = this.value.toUpperCase();
            });
        }

        // Action buttons (delegated)
        overlay.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            switch (action) {
                case 'irColorPick':
                    self._enableIrColorPick(btn.getAttribute('data-pick-type'));
                    break;
                case 'smartDetect': self._smartDetectIrregular(); break;
                case 'gridSplit': self._doGridSplit(); break;
                case 'applyInnerBgRemove': self._applyInnerBgRemove(); break;
                case 'selectAllRegions':
                    var selectAll = btn.getAttribute('data-select') === 'true';
                    self._selectAllRegions(selectAll);
                    self._showToast(selectAll ? '已全选' : '已取消全选');
                    break;
                case 'invertRegionSelection':
                    self._invertRegionSelection();
                    self._showToast('已反选');
                    break;
                case 'clearAllRegions':
                    self._clearAllRegions();
                    self._showToast('已清空区域');
                    break;
                case 'undoLastRegion':
                    self._undoLastRegion();
                    self._showToast('已撤销');
                    break;
                case 'removeBgColor': self._removeBackgroundColor(); break;
                case 'bgProtectBrush': self._toggleBgProtectBrush(); break;
                case 'bgBrushSize': self._setBgBrushSize(btn); break;
                case 'clearBgProtect': self._clearBgProtectBrush(); break;
                case 'goHome': window.location.href = '../../index.html'; break;
                case 'undoRemoveBg': self._undoRemoveBg(); break;
                case 'toggleCanvasBg': self._toggleCanvasBg(); break;
                case 'deleteSelectedSprite': self._deleteSelectedSprite(); break;
                case 'toggleOverlay': self._toggleOverlay(); break;
                case 'globalUndo': self._undoRemoveBg(); break;
                case 'toggleRegionPanel':
                    var rp = overlay.querySelector('#ttRegionPanel');
                    if (rp) rp.classList.toggle('collapsed');
                    break;
                case 'applyAutoStroke': self._applyAutoStroke(); break;
                case 'splitAndDownload':
                    self._openSplitDownloadDialog();
                    break;
                case 'transformMode':
                    var tMode = btn.getAttribute('data-transform');
                    if (self.state.transformMode === tMode) {
                        self.state.transformMode = null;
                        self.state.transformDrag = false;
                        self.state._isRotating = false;
                        self._overlayCanvas.style.cursor = 'pointer';
                        self._showToast('已退出变换模式');
                    } else {
                        if (self.state.selectedRegion < 0) {
                            self._showToast('请先在右侧图层选中一个精灵', true);
                            break;
                        }
                        self.state.transformMode = tMode;
                        self._overlayCanvas.style.cursor = 'grab';
                        self._showToast('已进入变换模式：拖主体移动，黄块缩放，红块旋转');
                    }
                    overlay.querySelectorAll('[data-action="transformMode"]').forEach(function(b) {
                        b.classList.toggle('lasso-active', b.getAttribute('data-transform') === self.state.transformMode);
                    });
                    self._drawOverlay();
                    break;
                case 'lassoMode':
                    var mode = btn.getAttribute('data-lasso');
                    // 进入套索模式时退出笔刷模式
                    if (self.state.bgProtectActive) {
                        self.state.bgProtectActive = false;
                        var bb = self._q('[data-action="bgProtectBrush"]');
                        if (bb) bb.classList.remove('lasso-active');
                    }
                    if (self.state.lassoMode === mode) {
                        self.state.lassoMode = null;
                        self._overlayCanvas.style.cursor = 'pointer';
                        self._showToast('已退出框选模式');
                    } else {
                        self.state.lassoMode = mode;
                        self._overlayCanvas.style.cursor = 'crosshair';
                        self._showToast('已进入框选模式，在画布上拖动绘制选区');
                    }
                    overlay.querySelectorAll('[data-action="lassoMode"]').forEach(function(b) {
                        b.classList.toggle('lasso-active', b.getAttribute('data-lasso') === self.state.lassoMode);
                    });
                    break;
                case 'innerProtectLasso':
                    self.state.innerProtectActive = !self.state.innerProtectActive;
                    if (self.state.innerProtectActive) {
                        self.state.lassoMode = 'lasso';
                        self._overlayCanvas.style.cursor = 'crosshair';
                        self._showToast('已进入保护套索模式，圈出不想被删除的区域');
                    } else {
                        self.state.lassoMode = null;
                        self._overlayCanvas.style.cursor = 'pointer';
                        self._showToast('已退出保护套索模式');
                    }
                    overlay.querySelector('[data-action="innerProtectLasso"]').classList.toggle('lasso-active', self.state.innerProtectActive);
                    break;
                case 'clearInnerProtect':
                    self.state.innerProtectMask = null;
                    self._protectCacheDirty = true;
                    self._protectCache = null;
                    self.state.innerProtectActive = false;
                    self.state.lassoMode = null;
                    self._overlayCanvas.style.cursor = 'pointer';
                    overlay.querySelector('[data-action="innerProtectLasso"]').classList.remove('lasso-active');
                    if (self._brushCanvas) self._brushCtx.clearRect(0, 0, self._brushCanvas.width, self._brushCanvas.height);
                    self._showToast('保护区域已清除');
                    break;
                case 'clearLasso':
                    self.state.lassoRegions = [];
                    self.state.lassoPoints = [];
                    if (self._brushCanvas) self._brushCtx.clearRect(0, 0, self._brushCanvas.width, self._brushCanvas.height);
                    self._showToast('套索已清除');
                    break;
                case 'applyRestore':
                    self._applyRestore();
                    break;
                case 'applyLassoDelete':
                    self._applyLassoDelete();
                    break;
                case 'mergeSelect':
                    self._toggleMergeSelect(!self.state.mergeSelectActive);
                    break;
            }
        });

        // Overlay canvas events
        this._overlayCanvas.addEventListener('mousedown', function(e) { self._onOverlayMouseDown(e); });
        this._overlayCanvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        this._overlayCanvas.addEventListener('mouseleave', function(e) {
            self._hideMagnifier();
            if (self.state.dragging) { self.state.dragging = false; self.state.dragType = null; }
            // 注意：canvasPanning 不在这里清除，因为 mousemove/mouseup 绑定在 document 上
        });
        // Transform drag: mousemove/mouseup on document to catch releases outside canvas
        this._onTransformMouseMove = function(e) { self._onOverlayMouseMove(e); };
        this._onTransformMouseUp = function(e) { self._onOverlayMouseUp(e); };
        document.addEventListener('mousemove', this._onTransformMouseMove);
        document.addEventListener('mouseup', this._onTransformMouseUp);

        // 滚轮缩放图片（以鼠标为中心），绑定到 main area 以覆盖画布周围的空白区
        var wheelTarget = self._q('#ttMainArea') || self._overlayCanvas;
        var _wheelThrottle = 0;
        wheelTarget.addEventListener('wheel', function(e) {
            if (!self.state.originalImage) return;
            e.preventDefault();
            e.stopPropagation();
            var now = Date.now();
            if (now - _wheelThrottle < 20) return;
            _wheelThrottle = now;

            var delta = e.deltaY > 0 ? -1 : 1;
            var factor = delta > 0 ? 1.15 : 1 / 1.15;
            var oldScale = self.state.scale;
            var newScale = Math.max(0.1, Math.min(4, oldScale * factor));
            if (newScale === oldScale) return;

            var wrapper = self._q('#ttCanvasWrapper');
            var wrapperRect = wrapper.getBoundingClientRect();

            // 鼠标在 wrapper 内容区中的位置（含滚动偏移）
            var mouseInWrapperX = e.clientX - wrapperRect.left + wrapper.scrollLeft;
            var mouseInWrapperY = e.clientY - wrapperRect.top + wrapper.scrollTop;

            // 鼠标指向的原图坐标（使用当前 canvas 的 CSS 尺寸修正比例）
            var imgX = mouseInWrapperX / oldScale;
            var imgY = mouseInWrapperY / oldScale;

            // 更新 scale 和 canvas 尺寸
            self.state.scale = newScale;
            var img = self.state.originalImage;
            self._mainCanvas.width = Math.round(img.width * newScale);
            self._mainCanvas.height = Math.round(img.height * newScale);
            self._overlayCanvas.width = self._mainCanvas.width;
            self._overlayCanvas.height = self._mainCanvas.height;

            // Sync brush canvas (redraw lasso regions at new scale)
            if (self._brushCanvas) {
                self._brushCanvas.width = self._mainCanvas.width;
                self._brushCanvas.height = self._mainCanvas.height;
                self._redrawLassoRegions();
            }

            self._drawMain();
            self._drawOverlay();

            // 缩放后，原图坐标在 canvas 上的新位置
            var newCanvasX = imgX * newScale;
            var newCanvasY = imgY * newScale;

            // 调整滚动，使该位置仍在鼠标下方
            wrapper.scrollLeft = newCanvasX - (e.clientX - wrapperRect.left);
            wrapper.scrollTop = newCanvasY - (e.clientY - wrapperRect.top);

            var zoomEl = self._q('#ttInfoZoom');
            if (zoomEl) zoomEl.textContent = Math.round(newScale * 100) + '%';
        }, { passive: false });

        // Keyboard events
        this._onKeyDown = function(e) {
            self._handleKeyDown(e);
        };
        document.addEventListener('keydown', this._onKeyDown);

        // Paste support (Ctrl+V paste image)
        this._onPaste = function(e) {
            var items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') === 0) {
                    var file = items[i].getAsFile();
                    self._loadSplitImage(file);
                    break;
                }
            }
        };
        document.addEventListener('paste', this._onPaste);
    },

    // ========================================
    //   ResizeObserver 回调
    // ========================================

    _onOverlayResize: function() {
        if (this.state.originalImage && this.state.mode === 'split') {
            this._fitImageToView(this.state.originalImage);
            this._drawMain();
            this._drawOverlay();
        }
    },

    // ========================================
    //   工具函数
    // ========================================

    _showToast: function(msg, isError) {
        var t = this._toastEl;
        if (!t) return;
        t.textContent = msg;
        t.className = 'tt-toast' + (isError ? ' error' : '');
        setTimeout(function() { t.classList.add('show'); }, 10);
        setTimeout(function() { t.classList.remove('show'); }, 2500);
    },

    _escapeHtml: function(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    },

    _hexToRgb: function(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16)
        };
    },

    _rgbToHex: function(r, g, b) {
        return '#' + [r, g, b].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
    },

    _q: function(sel) {
        return this._overlay ? this._overlay.querySelector(sel) : null;
    },

    // ========================================
    //   模式切换
    // ========================================

    _switchMode: function(mode) {
        this.state.mode = mode;
        var self = this;
        this._overlay.querySelectorAll('.tt-mode-tab').forEach(function(t) {
            t.classList.toggle('active', t.getAttribute('data-mode') === mode);
        });
        this._overlay.querySelectorAll('.tt-panel').forEach(function(p) { p.classList.remove('active'); });
        this._overlay.querySelector('#ttSplitPanel').classList.add('active');
        this._overlay.querySelector('#ttSplitView').style.display = 'flex';
        this._overlay.querySelector('#ttInfoBar').style.display = (mode === 'split' && this.state.originalImage) ? 'flex' : 'none';
    },

    // ========================================
    //   图片加载
    // ========================================

    _loadSplitImage: function(file) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                self.state.originalImage = img;
                self.state.processedImageData = null;
                self.state.undoStack = [];
                self.state.regions = [];
                self.state.selectedRegion = -1;
                self.state.innerSelectedRegions = {};
                self._gridColLines = null;
                self._gridRowLines = null;
                self._gridRegions = null;
                self._fitImageToView(img);
                self._drawMain();
                self._drawOverlay();
                self._updateRegionListUI();
                self._q('#ttSplitEmpty').style.display = 'none';
                self._q('#ttCanvasWrapper').style.display = 'inline-block';
                self._q('#ttCanvasHint').style.display = 'block';
                // 3秒后自动隐藏提示
                setTimeout(function() {
                    var hint = self._q('#ttCanvasHint');
                    if (hint) hint.style.display = 'none';
                }, 3000);
                self._q('#ttInfoBar').style.display = 'flex';
                self._q('#ttInfoSize').textContent = img.width + ' \u00d7 ' + img.height;
                self._q('#ttSplitBtn').disabled = false;
                self._q('#ttSplitFile').value = '';
                self._showToast('图片加载成功 (' + img.width + '\u00d7' + img.height + ')');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _fitImageToView: function(img) {
        var area = this._q('#ttMainArea');
        var maxW = area.clientWidth - 60;
        var maxH = area.clientHeight - 80;
        var scale = Math.min(1, maxW / img.width, maxH / img.height);
        this.state.scale = scale;
        this._mainCanvas.width = Math.round(img.width * scale);
        this._mainCanvas.height = Math.round(img.height * scale);
        this._overlayCanvas.width = this._mainCanvas.width;
        this._overlayCanvas.height = this._mainCanvas.height;
        // Sync brush canvas
        if (this._brushCanvas) {
            this._brushCanvas.width = this._mainCanvas.width;
            this._brushCanvas.height = this._mainCanvas.height;
            this._redrawLassoRegions();
        }
        this._q('#ttInfoZoom').textContent = Math.round(scale * 100) + '%';
    },

    // ========================================
    //   轮廓追踪（Moore-Neighbor 算法）
    // ========================================

    _traceRegionOutline: function(region, w, h) {
        // 缓存检查
        if (region._outlineCache && region._outlineBitmap === region.pixelSet) {
            return region._outlineCache;
        }

        var pixelSet = region.pixelSet;
        if (!pixelSet) return [];

        var b = region.bounds;
        var bw = b.w, bh = b.h;
        var bx = b.x, by = b.y;

        // 1. 只在 region.bounds 范围内扫描找第一个边缘像素
        var startX = -1, startY = -1;
        for (var ly = 0; ly < bh && startX === -1; ly++) {
            for (var lx = 0; lx < bw && startX === -1; lx++) {
                var gx = lx + bx, gy = ly + by;
                if (!pixelSet[gy * w + gx]) continue;
                // 检查是否是边缘像素
                if (gx === 0 || gx === w - 1 || gy === 0 || gy === h - 1 ||
                    !pixelSet[gy * w + (gx - 1)] || !pixelSet[gy * w + (gx + 1)] ||
                    !pixelSet[(gy - 1) * w + gx] || !pixelSet[(gy + 1) * w + gx]) {
                    startX = gx;
                    startY = gy;
                }
            }
        }

        if (startX === -1) return [];

        // 2. Moore-Neighbor 追踪
        var dx = [1, 1, 0, -1, -1, -1, 0, 1];
        var dy = [0, 1, 1, 1, 0, -1, -1, -1];

        var points = [];
        var cx = startX, cy = startY;
        var dir = 5;
        var maxIter = w * h * 4;
        var iter = 0;

        do {
            points.push({ x: cx, y: cy });

            var found = false;
            for (var i = 0; i < 8; i++) {
                var nd = (dir + 7 + i) % 8;
                var nx = cx + dx[nd];
                var ny = cy + dy[nd];
                if (nx >= 0 && nx < w && ny >= 0 && ny < h && pixelSet[ny * w + nx]) {
                    cx = nx;
                    cy = ny;
                    dir = (nd + 4) % 8;
                    found = true;
                    break;
                }
            }

            if (!found) break;
            iter++;
            if (iter > maxIter) break;
        } while (cx !== startX || cy !== startY);

        region._outlineCache = points;
        region._outlineBitmap = pixelSet;

        return points;
    },

    _drawMain: function() {
        var img = this.state.originalImage;
        if (!img) return;
        this._mainCtx.clearRect(0, 0, this._mainCanvas.width, this._mainCanvas.height);
        this._mainCtx.imageSmoothingEnabled = true;
        if (this.state.processedImageData) {
            var tmpC = document.createElement('canvas');
            tmpC.width = img.width;
            tmpC.height = img.height;
            tmpC.getContext('2d').putImageData(this.state.processedImageData, 0, 0);
            this._mainCtx.drawImage(tmpC, 0, 0, this._mainCanvas.width, this._mainCanvas.height);
        } else {
            this._mainCtx.drawImage(img, 0, 0, this._mainCanvas.width, this._mainCanvas.height);
        }
    },

    // ========================================
    //   覆盖层绘制
    // ========================================

    _drawOverlay: function() {
        this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
        if (!this.state.overlayVisible) { console.log('[DRAW] overlay hidden, skip'); return; }
        console.log('[DRAW] mode=' + this.state.splitMode + ' overlayVis=' + this.state.overlayVisible);
        if (this.state.splitMode === 'grid') {
            this._drawGridOverlay();
        } else {
            this._drawIrregularOverlay();
        }
        // 绘制合并框选区
        if (this.state.mergeRect) {
            this._drawMergeRect();
        }
        // 绘制背景色保护笔刷区域
        if (this.state.bgProtectMask) {
            this._drawBgProtectBrush();
        }
        var el = this._q('#ttInfoBoxes');
        if (el) el.textContent = this.state.splitMode === 'grid' ? (this._gridRegions ? this._gridRegions.length : 0) : this.state.regions.length;
    },

    _drawGridOverlay: function() {
        if (!this._gridColLines && !this._gridRowLines) return;
        var ctx = this._overlayCtx;
        var scale = this.state.scale;
        var lw = Math.max(1, (this._gridLineWidth || 0) * scale);
        var cw = this._mainCanvas.width, ch = this._mainCanvas.height;
        ctx.clearRect(0, 0, cw, ch);

        // 列分割线
        var self = this;
        if (this._gridColLines) this._gridColLines.forEach(function(ox, i) {
            var x = Math.round(ox * scale);
            var isHover = self.state.gridLineDragging && self.state.gridLineType === 'col' && self.state.gridLineIndex === i;
            ctx.strokeStyle = isHover ? '#ffab00' : 'rgba(233, 69, 96, 0.8)';
            ctx.lineWidth = isHover ? lw + 2 : lw;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
        });

        // 行分割线
        if (this._gridRowLines) this._gridRowLines.forEach(function(oy, i) {
            var y = Math.round(oy * scale);
            var isHover = self.state.gridLineDragging && self.state.gridLineType === 'row' && self.state.gridLineIndex === i;
            ctx.strokeStyle = isHover ? '#ffab00' : 'rgba(233, 69, 96, 0.8)';
            ctx.lineWidth = isHover ? lw + 2 : lw;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
        });

        // 边框
        if (this._gridHasEdge) {
            ctx.strokeStyle = 'rgba(233, 69, 96, 0.8)';
            ctx.lineWidth = lw;
            ctx.strokeRect(0, 0, cw, ch);
        }

        // 绘制区域编号标签
        if (this._gridRegions) {
            this._gridRegions.forEach(function(region, i) {
                var color = self.REGION_COLORS[i % self.REGION_COLORS.length];
                ctx.fillStyle = color;
                var label = 'R' + region.row + 'C' + region.col;
                ctx.font = '10px sans-serif';
                var tw = ctx.measureText(label).width;
                ctx.fillRect(region.x + 2, region.y + 2, tw + 6, 14);
                ctx.fillStyle = '#fff';
                ctx.fillText(label, region.x + 4, region.y + 13);
            });
        }
    },

    _drawIrregularOverlay: function() {
        var regions = this.state.regions;
        if (regions.length === 0) return;
        var img = this.state.originalImage;
        var w = img.width, h = img.height;
        var s = this.state.scale;
        var ctx = this._overlayCtx;
        var self = this;

        var offC = document.createElement('canvas');
        offC.width = w; offC.height = h;
        var offCtx = offC.getContext('2d');
        var imgData = offCtx.createImageData(w, h);
        var d = imgData.data;

        regions.forEach(function(region, ri) {
            var isSelected = ri === self.state.selectedRegion;
            var isInnerChecked = !!self.state.innerSelectedRegions[ri];
            var color = self._hexToRgb(region.color);
            var alpha = isSelected ? 100 : isInnerChecked ? 80 : 40;

            var pixelSet = new Uint8Array(w * h);
            region.pixels.forEach(function(p) {
                pixelSet[p[1] * w + p[0]] = 1;
            });

            region.pixels.forEach(function(p) {
                var idx = (p[1] * w + p[0]) * 4;
                d[idx] = color.r;
                d[idx + 1] = color.g;
                d[idx + 2] = color.b;
                d[idx + 3] = alpha;
            });

            region.pixels.forEach(function(p) {
                var isEdge = false;
                for (var dy = -1; dy <= 1 && !isEdge; dy++) {
                    for (var dx = -1; dx <= 1 && !isEdge; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        var nx = p[0] + dx, ny = p[1] + dy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h || !pixelSet[ny * w + nx]) {
                            isEdge = true;
                        }
                    }
                }
                if (isEdge) {
                    var idx = (p[1] * w + p[0]) * 4;
                    if (isInnerChecked) {
                        d[idx] = 0; d[idx + 1] = 200; d[idx + 2] = 83; d[idx + 3] = 230;
                    } else {
                        d[idx] = isSelected ? 255 : color.r;
                        d[idx + 1] = isSelected ? 255 : color.g;
                        d[idx + 2] = isSelected ? 255 : color.b;
                        d[idx + 3] = isSelected ? 220 : 160;
                    }
                }
            });
        });

        offCtx.putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offC, 0, 0, self._overlayCanvas.width, self._overlayCanvas.height);

        // Bounding box for inner-checked regions
        regions.forEach(function(region, ri) {
            if (!self.state.innerSelectedRegions[ri]) return;
            var b = region.bounds;
            var bx = b.x * s, by = b.y * s, bw = b.w * s, bh = b.h * s;
            ctx.strokeStyle = '#00c853';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
            ctx.setLineDash([]);
            var cm = 8;
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(bx - 2, by - 2 + cm); ctx.lineTo(bx - 2, by - 2); ctx.lineTo(bx - 2 + cm, by - 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + bw + 2 - cm, by - 2); ctx.lineTo(bx + bw + 2, by - 2); ctx.lineTo(bx + bw + 2, by - 2 + cm); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 2, by + bh + 2 - cm); ctx.lineTo(bx - 2, by + bh + 2); ctx.lineTo(bx - 2 + cm, by + bh + 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + bw + 2 - cm, by + bh + 2); ctx.lineTo(bx + bw + 2, by + bh + 2); ctx.lineTo(bx + bw + 2, by + bh + 2 - cm); ctx.stroke();
            ctx.fillStyle = '#00c853';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('\u2713', bx + bw + 5, by + 12);
        });

        // Labels
        regions.forEach(function(region, ri) {
            var isSelected = ri === self.state.selectedRegion;
            var lx = (region.bounds.x + 2) * s;
            var ly = (region.bounds.y - 2) * s;
            ctx.fillStyle = region.color;
            var label = '#' + (ri + 1) + ' ' + region.bounds.w + '-' + region.bounds.h + 'px ' + region.area + 'px';
            ctx.font = (isSelected ? 'bold ' : '') + '10px sans-serif';
            var tw = ctx.measureText(label).width;
            ctx.fillRect(lx - 1, ly - 12, tw + 6, 14);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, lx + 2, ly - 1);
        });

        // Transform handles
        if (self.state.transformMode === 'move' && self.state.selectedRegion >= 0) {
            var sr = regions[self.state.selectedRegion];
            if (sr) {
                var bx = sr.bounds.x * s, by = sr.bounds.y * s;
                var bw = sr.bounds.w * s, bh = sr.bounds.h * s;
                // 缩放手柄 - 右下角黄色方块
                var shx = bx + bw, shy = by + bh;
                ctx.fillStyle = '#ffab00';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.fillRect(shx - 6, shy - 6, 12, 12);
                ctx.strokeRect(shx - 6, shy - 6, 12, 12);
                // 旋转手柄 - 右上角红色方块
                var rhx = bx + bw, rhy = by;
                ctx.fillStyle = '#e94560';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                ctx.fillRect(rhx - 6, rhy - 6, 12, 12);
                ctx.strokeRect(rhx - 6, rhy - 6, 12, 12);
                // 旋转圆心 - 小十字标记
                var cc = self._computeSpriteCentroid(sr);
                if (cc) {
                    var ccx = cc.cx * s, ccy = cc.cy * s;
                    ctx.strokeStyle = '#e94560';
                    ctx.lineWidth = 1;
                    ctx.setLineDash([3, 3]);
                    ctx.beginPath(); ctx.arc(ccx, ccy, 6, 0, Math.PI * 2); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(ccx - 4, ccy); ctx.lineTo(ccx + 4, ccy); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(ccx, ccy - 4); ctx.lineTo(ccx, ccy + 4); ctx.stroke();
                    ctx.setLineDash([]);
                }
            }
        }

    },

    // ========================================
    //   放大镜
    // ========================================

    _showMagnifier: function(e) {
        if (!this.state.originalImage) return;
        this._magnifierEl.style.display = 'block';
        var rect = this._overlayCanvas.getBoundingClientRect();
        // 用 CSS 尺寸和像素尺寸的比值修正坐标
        var cssW = rect.width, cssH = rect.height;
        var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
        var ratioX = pxW / cssW, ratioY = pxH / cssH;
        var mx = (e.clientX - rect.left) * ratioX, my = (e.clientY - rect.top) * ratioY;
        var s = this.state.scale;
        var ox = Math.floor(mx / s), oy = Math.floor(my / s);
        var img = this.state.originalImage;
        var magCtx = this._magCtx;
        var MAG_SIZE = this.MAG_SIZE;
        var MAG_ZOOM = this.MAG_ZOOM;
        var MAG_RADIUS = Math.floor(MAG_SIZE / MAG_ZOOM / 2);

        magCtx.imageSmoothingEnabled = false;
        magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
        magCtx.fillStyle = '#000';
        magCtx.fillRect(0, 0, MAG_SIZE, MAG_SIZE);

        var srcX = ox - MAG_RADIUS;
        var srcY = oy - MAG_RADIUS;
        var srcW = MAG_RADIUS * 2;
        var srcH = MAG_RADIUS * 2;

        var tmpC = document.createElement('canvas');
        tmpC.width = img.width; tmpC.height = img.height;
        tmpC.getContext('2d').drawImage(img, 0, 0);
        magCtx.drawImage(tmpC, srcX, srcY, srcW, srcH, 0, 0, MAG_SIZE, MAG_SIZE);

        magCtx.strokeStyle = 'rgba(255,255,255,0.15)';
        magCtx.lineWidth = 0.5;
        var cellSize = MAG_ZOOM;
        for (var i = 0; i <= srcW; i++) {
            magCtx.beginPath(); magCtx.moveTo(i * cellSize, 0); magCtx.lineTo(i * cellSize, MAG_SIZE); magCtx.stroke();
        }
        for (var j = 0; j <= srcH; j++) {
            magCtx.beginPath(); magCtx.moveTo(0, j * cellSize); magCtx.lineTo(MAG_SIZE, j * cellSize); magCtx.stroke();
        }

        magCtx.strokeStyle = 'rgba(233,69,96,0.8)';
        magCtx.lineWidth = 2;
        magCtx.strokeRect(MAG_RADIUS * cellSize, MAG_RADIUS * cellSize, cellSize, cellSize);

        var left = e.clientX + 20;
        var top = e.clientY - MAG_SIZE - 10;
        if (left + MAG_SIZE > window.innerWidth) left = e.clientX - MAG_SIZE - 20;
        if (top < 0) top = e.clientY + 20;
        this._magnifierEl.style.left = left + 'px';
        this._magnifierEl.style.top = top + 'px';
    },

    _hideMagnifier: function() {
        if (this._magnifierEl) this._magnifierEl.style.display = 'none';
    },

    // ========================================
    //   背景移除
    // ========================================

    _enableIrColorPick: function(type) {
        if (!this.state.originalImage) {
            this._showToast('请先上传图片', true);
            return;
        }
        this.state.irColorPickMode = type;
        this._overlayCanvas.style.cursor = 'crosshair';
        var labels = { bg: '背景区域', outline: '轮廓线', innerBg: '内部背景', innerOutline: '内部轮廓线' };
        this._showToast('点击图片上的' + (labels[type] || type) + '取色');
    },

    // ========================================
    //   Overlay Canvas 交互
    // ========================================

    _onOverlayMouseDown: function(e) {
        // 右键拖拽画布
        if (e.button === 2) {
            this.state.canvasPanning = true;
            this.state.panStartX = e.clientX;
            this.state.panStartY = e.clientY;
            this._overlayCanvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        var rect = this._overlayCanvas.getBoundingClientRect();
        // 用 CSS 尺寸和像素尺寸的比值修正坐标
        var cssW = rect.width, cssH = rect.height;
        var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
        var ratioX = pxW / cssW, ratioY = pxH / cssH;
        var mx = (e.clientX - rect.left) * ratioX;
        var my = (e.clientY - rect.top) * ratioY;
        var s = this.state.scale;
        var self = this;

        // 网格线拖拽检测
        if ((this._gridColLines && this._gridColLines.length > 0) || (this._gridRowLines && this._gridRowLines.length > 0)) {
            var hit = this._hitTestGridLine(mx, my);
            if (hit) {
                this.state.gridLineDragging = true;
                this.state.gridLineType = hit.type;
                this.state.gridLineIndex = hit.index;
                this._overlayCanvas.style.cursor = hit.type === 'col' ? 'col-resize' : 'row-resize';
                this._drawGridOverlay();
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        // Irregular color pick mode
        if (this.state.irColorPickMode) {
            var type = this.state.irColorPickMode;
            this.state.irColorPickMode = null;
            this._hideMagnifier();
            this._overlayCanvas.style.cursor = 'pointer';
            var ox2 = Math.floor(mx / s), oy2 = Math.floor(my / s);
            var tmpC2 = document.createElement('canvas');
            tmpC2.width = this.state.originalImage.width; tmpC2.height = this.state.originalImage.height;
            tmpC2.getContext('2d').drawImage(this.state.originalImage, 0, 0);
            var pd2 = tmpC2.getContext('2d').getImageData(ox2, oy2, 1, 1).data;
            var hex2 = self._rgbToHex(pd2[0], pd2[1], pd2[2]);
            var rgb = { r: pd2[0], g: pd2[1], b: pd2[2] };
            if (type === 'bg') {
                self.state.irBgColor = rgb;
                self._q('#irBgColor').value = hex2;
                self._q('#irBgColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取背景色: ' + hex2.toUpperCase());
            } else if (type === 'outline') {
                self.state.irOutlineColor = rgb;
                self._q('#irOutlineColor').value = hex2;
                self._q('#irOutlineColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取轮廓色: ' + hex2.toUpperCase());
            } else if (type === 'innerBg') {
                self.state.innerBgColor = rgb;
                self._q('#innerBgColor').value = hex2;
                self._q('#innerBgColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取内部背景色: ' + hex2.toUpperCase());
            } else if (type === 'innerOutline') {
                self.state.innerOutlineColor = rgb;
                self._q('#innerOutlineColor').value = hex2;
                self._q('#innerOutlineColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取内部轮廓色: ' + hex2.toUpperCase());
            } else if (type === 'removeBg') {
                self.state.removeBgColor = rgb;
                self._q('#removeBgColor').value = hex2;
                self._q('#removeBgColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取要清除的背景色: ' + hex2.toUpperCase());
            }
            return;
        }

        // Transform: scale handle hit test
        // Transform: 变换模式（拖拽移动，右下角手柄缩放）
        if (this.state.transformMode === 'move' && this.state.selectedRegion >= 0) {
            var srT = this.state.regions[this.state.selectedRegion];
            if (srT) {
                var bxT = srT.bounds.x * s, byT = srT.bounds.y * s;
                var bwT = srT.bounds.w * s, bhT = srT.bounds.h * s;
                // 先检测右上角红色旋转手柄
                if (mx >= bxT + bwT - 12 && mx <= bxT + bwT + 6 && my >= byT - 6 && my <= byT + 6) {
                    this.state._isRotating = true;
                    this.state._rotateCenter = this._computeSpriteCentroid(srT);
                    if (this.state._rotateCenter) {
                        this.state._rotateStartAngle = Math.atan2(
                            (my / s) - this.state._rotateCenter.cy,
                            (mx / s) - this.state._rotateCenter.cx
                        );
                    }
                    this.state._rotateInitBounds = { x: srT.bounds.x, y: srT.bounds.y, w: srT.bounds.w, h: srT.bounds.h };
                    this._overlayCanvas.style.cursor = 'grabbing';
                    return;
                }
                // 再检测右下角黄色缩放手柄→记录缩放模式
                if (mx >= bxT + bwT - 12 && mx <= bxT + bwT + 6 && my >= byT + bhT - 12 && my <= byT + bhT + 6) {
                    this.state._scaleFromCorner = 'br';
                    this.state.transformDrag = true;
                    this.state.transformStart = { mx: mx, my: my, imgX: mx / s, imgY: my / s };
                    this.state.transformInitBounds = { x: srT.bounds.x, y: srT.bounds.y, w: srT.bounds.w, h: srT.bounds.h };
                    this._overlayCanvas.style.cursor = 'grabbing';
                    return;
                }
                // 再检测精灵主体（移动）
                var oxT = Math.floor(mx / s), oyT = Math.floor(my / s);
                if (oxT >= srT.bounds.x && oxT < srT.bounds.x + srT.bounds.w &&
                    oyT >= srT.bounds.y && oyT < srT.bounds.y + srT.bounds.h) {
                    this.state.transformDrag = true;
                    this.state.transformStart = { mx: mx, my: my, imgX: mx / s, imgY: my / s };
                    this._overlayCanvas.style.cursor = 'grabbing';
                    return;
                }
            }
        }

        // 背景保护笔刷：在画布上拖拽涂保护区域
        if (this.state.bgProtectActive) {
            this.state.bgProtectActive = 'painting';
            this._paintBgProtect(mx / s, my / s);
            return;
        }

        // Merge select mode：点击开始拖拽新框（清除旧框）
        if (this.state.mergeSelectActive) {
            this.state.mergeRect = { x1: mx, y1: my, x2: mx, y2: my };
            return;
        }

        // Lasso mode
        if (this.state.lassoMode === 'lasso') {
            this.state.lassoDrawing = true;
            this.state.lassoPoints = [{x: mx, y: my}];
            return;
        }
        if (this.state.lassoMode === 'eraser') {
            this._eraseLassoAt(mx, my);
            return;
        }

        // Irregular mode: click to select region
        var ox3 = Math.floor(mx / s), oy3 = Math.floor(my / s);
            var found = -1;
            for (var i = this.state.regions.length - 1; i >= 0; i--) {
                var r = this.state.regions[i];
                if (ox3 >= r.bounds.x && ox3 < r.bounds.x + r.bounds.w &&
                    oy3 >= r.bounds.y && oy3 < r.bounds.y + r.bounds.h) {
                    if (r.pixelSet && r.pixelSet[oy3 * this.state.originalImage.width + ox3]) {
                        found = i;
                        break;
                    }
                }
            }
            this.state.selectedRegion = found;
            if (found >= 0) {
                if (this.state.innerSelectedRegions[found]) {
                    delete this.state.innerSelectedRegions[found];
                } else {
                    this.state.innerSelectedRegions[found] = true;
                }
            }
            this._drawOverlay();
            this._updateRegionListUI();
    },

    _onOverlayMouseMove: function(e) {
        var rect = this._overlayCanvas.getBoundingClientRect();
        var cssW = rect.width, cssH = rect.height;
        var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
        var ratioX = pxW / cssW, ratioY = pxH / cssH;
        var mx = (e.clientX - rect.left) * ratioX;
        var my = (e.clientY - rect.top) * ratioY;
        var s = this.state.scale;

        // 放大镜：仅在取色模式下跟随鼠标
        if (this.state.irColorPickMode) {
            this._showMagnifier(e);
        } else {
            this._hideMagnifier();
        }

        // Transform drag: rotate preview (虚线旋转框 + 实时角度)
        if (this.state._isRotating && this.state._rotateCenter) {
            this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
            if (this.state.overlayVisible) this._drawIrregularOverlay();
            var rc = this.state._rotateCenter;
            var currentAngle = Math.atan2((my / s) - rc.cy, (mx / s) - rc.cx);
            var deltaAngle = currentAngle - this.state._rotateStartAngle;
            var ctxR = this._overlayCtx;
            var rcx = rc.cx * s, rcy = rc.cy * s;
            var ibR = this.state._rotateInitBounds;
            if (ibR) {
                ctxR.save();
                ctxR.translate(rcx, rcy);
                ctxR.rotate(deltaAngle);
                ctxR.strokeStyle = '#e94560';
                ctxR.lineWidth = 2;
                ctxR.setLineDash([5, 3]);
                ctxR.strokeRect(
                    (ibR.x - rc.cx) * s, (ibR.y - rc.cy) * s,
                    ibR.w * s, ibR.h * s
                );
                ctxR.setLineDash([]);
                ctxR.restore();
                // 角度文字
                var degs = (deltaAngle * 180 / Math.PI);
                ctxR.fillStyle = '#e94560';
                ctxR.font = 'bold 13px sans-serif';
                ctxR.fillText(degs.toFixed(1) + '°', rcx + 12, rcy - 10);
            }
            return;
        }

        // Transform drag: move preview (虚线框 + 实时尺寸，松手才实际移动)
        if (this.state.transformDrag && this.state.transformMode === "move" && !this.state._scaleFromCorner && this.state.selectedRegion >= 0) {
            this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
            if (this.state.overlayVisible) this._drawIrregularOverlay();
            var sr4 = this.state.regions[this.state.selectedRegion];
            if (sr4 && this.state.transformStart) {
                var dx3 = (mx / s) - this.state.transformStart.imgX;
                var dy3 = (my / s) - this.state.transformStart.imgY;
                var offX = Math.round(dx3), offY = Math.round(dy3);
                var ctx4 = this._overlayCtx;
                var s4 = this.state.scale;
                var px4 = (sr4.bounds.x + offX) * s4, py4 = (sr4.bounds.y + offY) * s4;
                ctx4.strokeStyle = "#ffab00";
                ctx4.lineWidth = 2;
                ctx4.setLineDash([6, 4]);
                ctx4.strokeRect(px4, py4, sr4.bounds.w * s4, sr4.bounds.h * s4);
                ctx4.setLineDash([]);
                ctx4.fillStyle = "#ffab00";
                ctx4.font = "bold 12px sans-serif";
                ctx4.fillText(sr4.bounds.w + "-" + sr4.bounds.h + "px " + sr4.area + "px", px4, py4 - 16);
            }
            return;
        }
        // Transform drag: scale preview (虚线框 + 实时尺寸，松手才实际缩放)
        if (this.state.transformDrag && this.state._scaleFromCorner && this.state.selectedRegion >= 0) {
            this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
            if (this.state.overlayVisible) this._drawIrregularOverlay();
            var sr5 = this.state.regions[this.state.selectedRegion];
            if (sr5 && this.state.transformInitBounds) {
                var ib5 = this.state.transformInitBounds;
                var nw5 = Math.max(4, (mx / s) - ib5.x);
                var nh5 = Math.max(4, (my / s) - ib5.y);
                var sf5 = Math.max(nw5 / ib5.w, nh5 / ib5.h);
                var pW5 = Math.round(ib5.w * sf5);
                var pH5 = Math.round(ib5.h * sf5);
                var ctx5 = this._overlayCtx;
                var ss5 = this.state.scale;
                ctx5.strokeStyle = "#ffab00";
                ctx5.lineWidth = 2;
                ctx5.setLineDash([4, 3]);
                ctx5.strokeRect(ib5.x * ss5, ib5.y * ss5, pW5 * ss5, pH5 * ss5);
                ctx5.setLineDash([]);
                var hx5 = (ib5.x + pW5) * ss5, hy5 = (ib5.y + pH5) * ss5;
                ctx5.fillStyle = "#ffab00";
                ctx5.fillRect(hx5 - 6, hy5 - 6, 12, 12);
                ctx5.strokeStyle = "#fff";
                ctx5.lineWidth = 1.5;
                ctx5.strokeRect(hx5 - 6, hy5 - 6, 12, 12);
                ctx5.fillStyle = "#ffab00";
                ctx5.font = "bold 12px sans-serif";
                ctx5.fillText(pW5 + "-" + pH5 + "px " + Math.round(sr5.area * sf5 * sf5) + "px", ib5.x * ss5, ib5.y * ss5 - 16);
            }
            return;
        }

        // 网格线拖拽：在 mousemove 中实时移动分割线
        if (this.state.gridLineDragging) {
            this.state.gridLineDragging = false;
            this.state.gridLineType = null;
            this.state.gridLineIndex = -1;
            this._overlayCanvas.style.cursor = 'pointer';
            this._recalcGridRegions();
            this._drawGridOverlay();
            return;
        }
        // 右键画布平移
        if (this.state.canvasPanning) {
            var wrapper2 = this._q('#ttCanvasWrapper');
            if (wrapper2) {
                var ddx = this.state.panStartX - e.clientX;
                var ddy = this.state.panStartY - e.clientY;
                wrapper2.scrollLeft += ddx;
                wrapper2.scrollTop += ddy;
                this.state.panStartX = e.clientX;
                this.state.panStartY = e.clientY;
            }
            return;
        }
        this.state.dragging = false;
        this.state.dragType = null;
        // 背景保护笔刷：拖拽中持续绘制
        if (this.state.bgProtectActive === 'painting') {
            this._paintBgProtect(mx / s, my / s);
            return;
        }
        // 合并框选：实时绘制矩形
        if (this.state.mergeRect) {
            this.state.mergeRect.x2 = mx;
            this.state.mergeRect.y2 = my;
            this._drawOverlay();
            this._drawMergeRect();
            return;
        }

        // 套索绘制：持续添加点并实时绘制
        if (this.state.lassoDrawing) {
            this.state.lassoPoints.push({x: mx, y: my});
            this._drawLassoPreview();
            return;
        }
        // 背景保护笔刷：绘制笔刷圆圈预览（在 brushCanvas 上，不破坏 overlay）
        if (this.state.bgProtectActive && this._brushCanvas) {
            this._redrawLassoRegions();
            var br = this.state.bgProtectBrushSize / 2 * this.state.scale;
            var ctxB = this._brushCtx;
            ctxB.strokeStyle = 'rgba(255,171,0,0.8)';
            ctxB.lineWidth = 2;
            ctxB.setLineDash([4, 4]);
            ctxB.beginPath(); ctxB.arc(mx, my, br, 0, Math.PI * 2); ctxB.stroke();
            ctxB.setLineDash([]);
            ctxB.fillStyle = 'rgba(255,171,0,0.1)';
            ctxB.fill();
            return;
        }
        // 没有拖拽状态时恢复光标
        if (this.state.lassoMode) {
            this._overlayCanvas.style.cursor = 'crosshair';
        } else if (!this.state.irColorPickMode) {
            this._overlayCanvas.style.cursor = 'pointer';
        }
    },

    // ========================================
    //   Transform 鼠标松开
    // ========================================

    _onOverlayMouseUp: function(e) {
        // Rotate apply
        if (this.state._isRotating && this.state._rotateCenter) {
            this.state._isRotating = false;
            var rectR = this._overlayCanvas.getBoundingClientRect();
            var rx = (e.clientX - rectR.left) * (this._overlayCanvas.width / rectR.width);
            var ry = (e.clientY - rectR.top) * (this._overlayCanvas.height / rectR.height);
            var rcx = this.state._rotateCenter;
            var currentAngle = Math.atan2((ry / this.state.scale) - rcx.cy, (rx / this.state.scale) - rcx.cx);
            var deltaAngle = currentAngle - this.state._rotateStartAngle;
            this._applyRotateTransform(deltaAngle);
            this.state._rotateCenter = null;
            this.state._rotateStartAngle = 0;
            this.state._rotateInitBounds = null;
            this._overlayCanvas.style.cursor = 'pointer';
            return;
        }
        if (this.state.transformDrag) {
            this.state.transformDrag = false;
            if (this.state._scaleFromCorner && this.state.selectedRegion >= 0 && this.state.transformInitBounds) {
                var rectU = this._overlayCanvas.getBoundingClientRect();
                var cx = (e.clientX - rectU.left) * (this._overlayCanvas.width / rectU.width);
                var cy = (e.clientY - rectU.top) * (this._overlayCanvas.height / rectU.height);
                this._applyScaleTransform(cx / this.state.scale, cy / this.state.scale);
                this.state._scaleFromCorner = null;
                this.state.transformStart = null;
                this.state.transformInitBounds = null;
                this._overlayCanvas.style.cursor = 'pointer';
                this._drawOverlay();
                return;
            }
            if (this.state.transformMode === 'move' && this.state.selectedRegion >= 0) {
                var rectU2 = this._overlayCanvas.getBoundingClientRect();
                var cx2 = (e.clientX - rectU2.left) * (this._overlayCanvas.width / rectU2.width);
                var cy2 = (e.clientY - rectU2.top) * (this._overlayCanvas.height / rectU2.height);
                this._applyMoveTransform(cx2 / this.state.scale, cy2 / this.state.scale);
            }
            this.state._scaleFromCorner = null;
            this.state.transformStart = null;
            this.state.transformInitBounds = null;
            this._overlayCanvas.style.cursor = 'pointer';
            return;
        }
        if (this.state.gridLineDragging) {
            this.state.gridLineDragging = false;
            this.state.gridLineType = null;
            this.state.gridLineIndex = -1;
            this._overlayCanvas.style.cursor = 'pointer';
            this._recalcGridRegions();
            this._drawGridOverlay();
            return;
        }
        if (this.state.canvasPanning) {
            this.state.canvasPanning = false;
            this._overlayCanvas.style.cursor = 'pointer';
            return;
        }
        this.state.dragging = false;
        this.state.dragType = null;
        // 背景保护笔刷松手
        if (this.state.bgProtectActive === 'painting') {
            this.state.bgProtectActive = true;
            return;
        }
        // 合并框选松手：有效拖拽则自动执行组合，无效点击则清除
        if (this.state.mergeRect) {
            var mr = this.state.mergeRect;
            if (Math.abs(mr.x2 - mr.x1) >= 5 && Math.abs(mr.y2 - mr.y1) >= 5) {
                this._mergeSelectedSprites();
            } else {
                this.state.mergeRect = null;
                this._drawOverlay();
            }
            return;
        }
        if (this.state.lassoDrawing) {
            this.state.lassoDrawing = false;
            this._finishLasso();
            return;
        }
        // 没有拖拽状态时恢复光标
        if (this.state.lassoMode) {
            this._overlayCanvas.style.cursor = 'crosshair';
        } else if (!this.state.irColorPickMode) {
            this._overlayCanvas.style.cursor = 'pointer';
        }
    },

    _drawLassoPreview: function() {
        if (!this._brushCanvas) return;
        var self = this;
        var fillColor = 'rgba(255, 50, 50, 0.35)';
        var strokeColor = 'rgba(255, 50, 50, 0.8)';
        this._brushCtx.clearRect(0, 0, this._brushCanvas.width, this._brushCanvas.height);

        // Draw protect area (innerProtectMask) in green - 使用缓存
        if (this.state.innerProtectMask && this.state.originalImage) {
            if (!this._protectCache || this._protectCacheDirty) {
                var w = self.state.originalImage.width;
                var h = self.state.originalImage.height;
                var protC = document.createElement('canvas');
                protC.width = w; protC.height = h;
                var protCtx = protC.getContext('2d');
                var protImg = protCtx.createImageData(w, h);
                var protD = protImg.data;
                for (var pi = 0; pi < w * h; pi++) {
                    if (self.state.innerProtectMask[pi]) {
                        var idx = pi * 4;
                        protD[idx] = 0; protD[idx + 1] = 200; protD[idx + 2] = 83;
                        protD[idx + 3] = 80;
                    }
                }
                protCtx.putImageData(protImg, 0, 0);
                this._protectCache = protC;
                this._protectCacheDirty = false;
            }
            self._brushCtx.imageSmoothingEnabled = false;
            self._brushCtx.drawImage(this._protectCache, 0, 0, this._protectCache.width, this._protectCache.height,
               0, 0, self._brushCanvas.width, self._brushCanvas.height);
        }

        // Draw all completed lasso regions
        this.state.lassoRegions.forEach(function(lr) {
            if (lr.imgPoints.length < 3) return;
            var s = self.state.scale;
            self._brushCtx.beginPath();
            self._brushCtx.moveTo(lr.imgPoints[0].x * s, lr.imgPoints[0].y * s);
            for (var i = 1; i < lr.imgPoints.length; i++) {
                self._brushCtx.lineTo(lr.imgPoints[i].x * s, lr.imgPoints[i].y * s);
            }
            self._brushCtx.closePath();
            self._brushCtx.fillStyle = fillColor;
            self._brushCtx.fill();
            self._brushCtx.strokeStyle = strokeColor;
            self._brushCtx.lineWidth = 1.5;
            self._brushCtx.stroke();
        });
        // Draw current in-progress lasso line
        if (this.state.lassoPoints.length > 1) {
            this._brushCtx.beginPath();
            this._brushCtx.moveTo(this.state.lassoPoints[0].x, this.state.lassoPoints[0].y);
            for (var j = 1; j < this.state.lassoPoints.length; j++) {
                this._brushCtx.lineTo(this.state.lassoPoints[j].x, this.state.lassoPoints[j].y);
            }
            this._brushCtx.strokeStyle = 'rgba(255, 200, 50, 0.9)';
            this._brushCtx.lineWidth = 2;
            this._brushCtx.stroke();
        }
    },

    _finishLasso: function() {
        if (this.state.lassoPoints.length < 3) {
            this.state.lassoPoints = [];
            this._drawLassoPreview();
            return;
        }
        var s = this.state.scale;
        var img = this.state.originalImage;
        // Convert canvas coords to image coords
        var imgPoints = this.state.lassoPoints.map(function(p) {
            return { x: p.x / s, y: p.y / s };
        });
        // Use canvas path to determine which pixels are inside the selection
        var pathC = document.createElement('canvas');
        pathC.width = img.width; pathC.height = img.height;
        var pathCtx = pathC.getContext('2d');
        pathCtx.beginPath();
        pathCtx.moveTo(imgPoints[0].x, imgPoints[0].y);
        for (var i = 1; i < imgPoints.length; i++) {
            pathCtx.lineTo(imgPoints[i].x, imgPoints[i].y);
        }
        pathCtx.closePath();
        pathCtx.fillStyle = '#fff';
        pathCtx.fill();
        var pathData = pathCtx.getImageData(0, 0, img.width, img.height).data;
        var mask = new Uint8Array(img.width * img.height);
        for (var j = 0; j < img.width * img.height; j++) {
            if (pathData[j * 4 + 3] > 128) mask[j] = 1;
        }
        // 保护套索模式：合并到 innerProtectMask 而不是加到 lassoRegions
        if (this.state.innerProtectActive) {
            if (!this.state.innerProtectMask) {
                this.state.innerProtectMask = new Uint8Array(img.width * img.height);
                this._protectCacheDirty = true;
            }
            for (var pj = 0; pj < img.width * img.height; pj++) {
                if (mask[pj]) this.state.innerProtectMask[pj] = 1;
            }
            this._protectCacheDirty = true;
            this.state.lassoPoints = [];
            this._drawLassoPreview();
            this._showToast('保护区域已添加');
        } else {
            this.state.lassoRegions.push({
                canvasPoints: this.state.lassoPoints.slice(),
                imgPoints: imgPoints,
                mask: mask
            });
            this.state.lassoPoints = [];
            this._drawLassoPreview();
            this._showToast('套索选区已创建');
        }
    },

    _applyRestore: function() {
        if (!this.state.lassoRegions || this.state.lassoRegions.length === 0) {
            this._showToast('请先用套索圈出要恢复的区域', true);
            return;
        }
        this._saveUndoState();
        var img = this.state.originalImage;
        var w = img.width, h = img.height;
        var self = this;

        // 合并所有套索区域的 mask
        var combinedMask = new Uint8Array(w * h);
        this.state.lassoRegions.forEach(function(lr) {
            for (var i = 0; i < w * h; i++) {
                if (lr.mask[i]) combinedMask[i] = 1;
            }
        });

        // 获取原图像素数据
        var tmpC = document.createElement('canvas');
        tmpC.width = w; tmpC.height = h;
        var tmpCtx = tmpC.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        var origData = tmpCtx.getImageData(0, 0, w, h).data;

        var totalRestored = 0;
        this.state.regions.forEach(function(region) {
            var b = region.bounds;
            var newPixels = [];
            region.pixels.forEach(function(p) {
                newPixels.push(p);
            });
            // 在套索范围内，检查哪些像素不在当前 region 中，如果在原图上有颜色就补回
            for (var y = b.y; y < b.y + b.h && y < h; y++) {
                for (var x = b.x; x < b.x + b.w && x < w; x++) {
                    var idx = y * w + x;
                    if (!combinedMask[idx]) continue;
                    // 如果这个像素不在 region 中，补回
                    if (!region.pixelSet[idx]) {
                        var pi = idx * 4;
                        var a = origData[pi + 3];
                        if (a > 10) { // 原图有内容才补
                            newPixels.push([x, y]);
                            totalRestored++;
                        }
                    }
                }
            }
            // 重建 pixelSet 和 bounds
            region.pixels = newPixels;
            region.pixelSet = new Uint8Array(w * h);
            newPixels.forEach(function(p) { region.pixelSet[p[1] * w + p[0]] = 1; });
            if (newPixels.length > 0) {
                var eMinX = w, eMaxX = 0, eMinY = h, eMaxY = 0;
                newPixels.forEach(function(p) {
                    if (p[0] < eMinX) eMinX = p[0]; if (p[0] > eMaxX) eMaxX = p[0];
                    if (p[1] < eMinY) eMinY = p[1]; if (p[1] > eMaxY) eMaxY = p[1];
                });
                region.bounds = { x: eMinX, y: eMinY, w: eMaxX - eMinX + 1, h: eMaxY - eMinY + 1 };
            }
            region.area = newPixels.length;
        });

        // 清除套索
        this.state.lassoRegions = [];
        if (this._brushCanvas) this._brushCtx.clearRect(0, 0, this._brushCanvas.width, this._brushCanvas.height);
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已恢复 ' + totalRestored + ' 个像素');
    },

    _applyLassoDelete: function() {
        if (!this.state.lassoRegions || this.state.lassoRegions.length === 0) {
            this._showToast('请先用套索框选要删除的区域', true);
            return;
        }
        if (!this.state.processedImageData) {
            this._showToast('没有可操作的图像数据', true);
            return;
        }

        this._saveUndoState();

        var imageData = this.state.processedImageData;
        var data = imageData.data;
        var w = imageData.width, h = imageData.height;

        // 合并所有套索区域的 mask
        var combinedMask = new Uint8Array(w * h);
        this.state.lassoRegions.forEach(function(lr) {
            for (var i = 0; i < w * h; i++) {
                if (lr.mask[i]) combinedMask[i] = 1;
            }
        });

        var totalDeleted = 0;
        // 套索范围内的所有非透明像素全部设为透明（不区分 region）
        for (var j = 0; j < w * h; j++) {
            if (combinedMask[j] && data[j * 4 + 3] > 0) {
                data[j * 4 + 3] = 0;
                totalDeleted++;
            }
        }
        // 同步更新 region 数据
        if (this.state.regions.length > 0) {
            for (var ri = 0; ri < this.state.regions.length; ri++) {
                var region = this.state.regions[ri];
                var newPixels = [];
                region.pixels.forEach(function(p) {
                    var idx = p[1] * w + p[0];
                    if (!combinedMask[idx]) newPixels.push(p);
                });
                region.pixels = newPixels;
                region.pixelSet = new Uint8Array(w * h);
                newPixels.forEach(function(p) { region.pixelSet[p[1] * w + p[0]] = 1; });
                if (newPixels.length > 0) {
                    var eMinX = w, eMaxX = 0, eMinY = h, eMaxY = 0;
                    newPixels.forEach(function(p) {
                        if (p[0] < eMinX) eMinX = p[0]; if (p[0] > eMaxX) eMaxX = p[0];
                        if (p[1] < eMinY) eMinY = p[1]; if (p[1] > eMaxY) eMaxY = p[1];
                    });
                    region.bounds = { x: eMinX, y: eMinY, w: eMaxX - eMinX + 1, h: eMaxY - eMinY + 1 };
                }
                region.area = newPixels.length;
            }
        }

        // 清除套索
        this.state.lassoRegions = [];
        if (this._brushCanvas) this._brushCtx.clearRect(0, 0, this._brushCanvas.width, this._brushCanvas.height);
        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已删除 ' + totalDeleted + ' 个像素');
    },

    _eraseLassoAt: function(x, y) {
        var s = this.state.scale;
        var imgX = x / s, imgY = y / s;
        var img = this.state.originalImage;
        var px = Math.floor(imgX), py = Math.floor(imgY);
        if (px < 0 || px >= img.width || py < 0 || py >= img.height) return;
        for (var i = this.state.lassoRegions.length - 1; i >= 0; i--) {
            if (this.state.lassoRegions[i].mask[py * img.width + px]) {
                this.state.lassoRegions.splice(i, 1);
                this._drawLassoPreview();
                this._showToast('已删除套索选区');
                return;
            }
        }
    },

    _redrawLassoRegions: function() {
        if (!this._brushCanvas) return;
        var fillColor = 'rgba(255, 50, 50, 0.35)';
        var strokeColor = 'rgba(255, 50, 50, 0.8)';
        this._brushCtx.clearRect(0, 0, this._brushCanvas.width, this._brushCanvas.height);
        var s = this.state.scale;
        var self = this;

        // Draw protect area in green - 使用缓存
        if (this.state.innerProtectMask && this.state.originalImage) {
            if (!this._protectCache || this._protectCacheDirty) {
                var w = self.state.originalImage.width;
                var h = self.state.originalImage.height;
                var protC = document.createElement('canvas');
                protC.width = w; protC.height = h;
                var protCtx = protC.getContext('2d');
                var protImg = protCtx.createImageData(w, h);
                var protD = protImg.data;
                for (var pi = 0; pi < w * h; pi++) {
                    if (self.state.innerProtectMask[pi]) {
                        var idx = pi * 4;
                        protD[idx] = 0; protD[idx + 1] = 200; protD[idx + 2] = 83;
                        protD[idx + 3] = 80;
                    }
                }
                protCtx.putImageData(protImg, 0, 0);
                this._protectCache = protC;
                this._protectCacheDirty = false;
            }
            self._brushCtx.imageSmoothingEnabled = false;
            self._brushCtx.drawImage(this._protectCache, 0, 0, this._protectCache.width, this._protectCache.height,
               0, 0, self._brushCanvas.width, self._brushCanvas.height);
        }

        this.state.lassoRegions.forEach(function(lr) {
            if (lr.imgPoints.length < 3) return;
            self._brushCtx.beginPath();
            self._brushCtx.moveTo(lr.imgPoints[0].x * s, lr.imgPoints[0].y * s);
            for (var i = 1; i < lr.imgPoints.length; i++) {
                self._brushCtx.lineTo(lr.imgPoints[i].x * s, lr.imgPoints[i].y * s);
            }
            self._brushCtx.closePath();
            self._brushCtx.fillStyle = fillColor;
            self._brushCtx.fill();
            self._brushCtx.strokeStyle = strokeColor;
            self._brushCtx.lineWidth = 1.5;
            self._brushCtx.stroke();
        });
    },

    _updateCursor: function(e) {
        if (this.state.irColorPickMode) {
            this._overlayCanvas.style.cursor = 'crosshair'; return;
        }
        this._overlayCanvas.style.cursor = 'pointer';
    },

    _zoomCanvas: function(factor) {
        var self = this;
        var oldScale = this.state.scale;
        var newScale = Math.max(0.1, Math.min(4, oldScale * factor));
        if (newScale === oldScale) return;

        // 以 wrapper 中心为缩放焦点
        var wrapper = this._q('#ttCanvasWrapper');
        if (!wrapper) return;
        var wrapperRect = wrapper.getBoundingClientRect();
        var cx = wrapperRect.width / 2;
        var cy = wrapperRect.height / 2;

        var imgX = (cx + wrapper.scrollLeft) / oldScale;
        var imgY = (cy + wrapper.scrollTop) / oldScale;

        this.state.scale = newScale;
        var img = this.state.originalImage;
        this._mainCanvas.width = Math.round(img.width * newScale);
        this._mainCanvas.height = Math.round(img.height * newScale);
        this._overlayCanvas.width = this._mainCanvas.width;
        this._overlayCanvas.height = this._mainCanvas.height;

        if (this._brushCanvas) {
            this._brushCanvas.width = this._mainCanvas.width;
            this._brushCanvas.height = this._mainCanvas.height;
            this._redrawLassoRegions();
        }

        this._drawMain();
        this._drawOverlay();

        wrapper.scrollLeft = imgX * newScale - cx;
        wrapper.scrollTop = imgY * newScale - cy;

        var zoomEl = this._q('#ttInfoZoom');
        if (zoomEl) zoomEl.textContent = Math.round(newScale * 100) + '%';
    },

    // ========================================
    //   键盘事件
    // ========================================

    _handleKeyDown: function(e) {
        if (!this._overlay) return;
        if (!this._overlay.parentNode) return;
        var tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        // ESC 关闭
        if (e.key === 'Escape') {
            this._destroy();
            if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
            return;
        }

        if (this.state.mode !== 'split') return;

        if ((e.key === 'Delete' || e.key === 'Backspace') && this.state.selectedRegion >= 0) {
            this.state.regions.splice(this.state.selectedRegion, 1);
            this.state.selectedRegion = -1;
            this._drawOverlay();
            this._updateRegionListUI();
            e.preventDefault();
        }

        // Ctrl+= / Ctrl+- 缩放
        if ((e.key === '=' || e.key === '+') && (e.ctrlKey || e.metaKey) && this.state.originalImage) {
            e.preventDefault();
            this._zoomCanvas(1.15);
        }
        if ((e.key === '-' || e.key === '_') && (e.ctrlKey || e.metaKey) && this.state.originalImage) {
            e.preventDefault();
            this._zoomCanvas(1 / 1.15);
        }
    },

    // ========================================
    //   消除背景色
    // ========================================

    _removeBackgroundColor: function() {
        if (!this.state.originalImage) {
            this._showToast('请先上传图片', true);
            return;
        }
        var img = this.state.originalImage;
        var hueTol = parseInt(this._q('#removeBgHueTol').value);
        var feather = parseInt(this._q('#removeBgFeather').value);
        var doSpill = this._q('#removeBgSpill').checked;
        var bgRgb = this.state.removeBgColor;

        // 保存当前状态用于撤销
        this._saveUndoState();

        var bgHsv = this._rgbToHsv(bgRgb.r, bgRgb.g, bgRgb.b);
        var bgH = bgHsv.h;
        var tmpC = document.createElement('canvas');
        tmpC.width = img.width;
        tmpC.height = img.height;
        var tmpCtx = tmpC.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        var imageData = tmpCtx.getImageData(0, 0, img.width, img.height);
        var data = imageData.data;
        var removedCount = 0;

        // 构建精灵区域保护 mask（w×h, 1=保护）
        var w = img.width, h = img.height;
        var protectionMask = null;
        if (this.state.regions.length > 0) {
            protectionMask = new Uint8Array(w * h);
            for (var ri = 0; ri < this.state.regions.length; ri++) {
                var ps = this.state.regions[ri].pixelSet;
                if (ps) {
                    for (var pj = 0; pj < ps.length; pj++) {
                        if (ps[pj]) protectionMask[pj] = 1;
                    }
                }
            }
        } else {
            this._showToast('未检测到精灵区域，请先执行异形检测', true);
        }

        // 笔刷保护 mask（像素级保护，笔刷涂过的像素不消除背景色）
        var brushProtect = this.state.bgProtectMask;

        for (var i = 0; i < data.length; i += 4) {
            // 跳过精灵区域内的像素（区域保护）
            if (protectionMask && protectionMask[i >> 2]) continue;
            // 跳过笔刷保护过的像素
            if (brushProtect && brushProtect[i >> 2]) continue;

            var r = data[i], g = data[i + 1], b = data[i + 2];
            var hsv = this._rgbToHsv(r, g, b);
            var hDiff = Math.abs(hsv.h - bgH);
            if (hDiff > 180) hDiff = 360 - hDiff;

            if (hDiff < hueTol && hsv.s > 10) {
                // 在色相范围内且有一定饱和度 → 背景，全透明
                data[i + 3] = 0;
                removedCount++;
            } else if (hDiff < hueTol + feather && hsv.s > 5) {
                // 边缘羽化区 → 渐变透明
                var alpha = Math.round(((hDiff - hueTol) / feather) * 255);
                alpha = Math.max(0, Math.min(255, alpha));
                data[i + 3] = alpha;
                // 对边缘做去绿溢出
                if (doSpill && g > r && g > b) {
                    data[i + 1] = Math.round(g * 0.4 + (r + b) / 2 * 0.6);
                }
            } else if (doSpill && g > r * 1.2 && g > b * 1.2 && hsv.h > 45 && hsv.h < 180) {
                // 前景像素有绿幕溢出 → 去绿
                data[i + 1] = Math.round(g * 0.5 + (r + b) / 4);
            }
        }

        this.state.processedImageData = imageData;
        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已清除 ' + removedCount + ' 个像素');
    },

    _rgbToHsv: function(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, v = max;
        var d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    },

    _saveUndoState: function() {
        if (!this.state.processedImageData) return;
        var src = this.state.processedImageData;
        var snapshot = {
            imageData: new ImageData(
                new Uint8ClampedArray(src.data),
                src.width,
                src.height
            ),
            regionData: this.state.regions.map(function(r) {
                return {
                    pixels: r.pixels.slice(),
                    bounds: r.bounds,
                    area: r.area,
                    color: r.color,
                    id: r.id
                };
            }),
            innerProtectMask: this.state.innerProtectMask ? new Uint8Array(this.state.innerProtectMask) : null
        };
        this.state.undoStack.push(snapshot);
        if (this.state.undoStack.length > this.state.undoStackSize) {
            this.state.undoStack.shift();
        }
    },

    _undoRemoveBg: function() {
        var stack = this.state.undoStack;
        if (stack.length === 0) {
            this._showToast('没有可撤销的操作', true);
            return;
        }
        var snapshot = stack.pop();
        this.state.processedImageData = snapshot.imageData;
        // 恢复 regions
        if (snapshot.regionData) {
            var w = snapshot.imageData.width;
            this.state.regions = snapshot.regionData.map(function(r) {
                var pixels = r.pixels.map(function(p) { return [p[0], p[1]]; });
                var ps = new Uint8Array(w * snapshot.imageData.height);
                pixels.forEach(function(p) { ps[p[1] * w + p[0]] = 1; });
                return {
                    id: r.id,
                    pixels: pixels,
                    pixelSet: ps,
                    bounds: r.bounds,
                    area: r.area,
                    color: r.color
                };
            });
        }
        this.state.selectedRegion = -1;
        this.state.innerSelectedRegions = {};
        this.state.innerProtectMask = snapshot.innerProtectMask || null;
        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._redrawLassoRegions();
        this._showToast('已撤销');
    },

    // ========================================
    //   自动描边
    // ========================================

    _applyAutoStroke: function() {
        if (!this.state.processedImageData) {
            this._showToast('请先处理图片（消除背景色或扣图）', true);
            return;
        }
        if (this.state.selectedRegion < 0) {
            this._showToast('请先在右侧图层选中一个精灵', true);
            return;
        }

        var region = this.state.regions[this.state.selectedRegion];
        if (!region || !region.pixels.length) {
            this._showToast('选中的精灵没有有效像素', true);
            return;
        }

        this._saveUndoState();

        var imageData = this.state.processedImageData;
        var data = imageData.data;
        var w = imageData.width, h = imageData.height;

        var c = this._q('#strokeColor').value;
        var sr = parseInt(c.substr(1, 2), 16);
        var sg = parseInt(c.substr(3, 2), 16);
        var sb = parseInt(c.substr(5, 2), 16);
        var sw = parseInt(this._q('#strokeWidth').value);
        var iw = parseInt(this._q('#strokeInnerWidth') ? this._q('#strokeInnerWidth').value : '0');

        // 只构建选中精灵的 mask
        var mask = new Uint8Array(w * h);
        var ps = region.pixelSet;
        if (ps) {
            for (var pj = 0; pj < ps.length; pj++) {
                if (ps[pj]) mask[pj] = 1;
            }
        }

        // 在选中精灵的 bounds + 扩展范围内操作
        var PAD = sw + 2;
        var scanX1 = Math.max(0, region.bounds.x - PAD);
        var scanY1 = Math.max(0, region.bounds.y - PAD);
        var scanX2 = Math.min(w, region.bounds.x + region.bounds.w + PAD);
        var scanY2 = Math.min(h, region.bounds.y + region.bounds.h + PAD);

        var dirs4 = [[-1,0],[1,0],[0,-1],[0,1]];
        var strokeMask = new Uint8Array(w * h);

        // 种子：与精灵相邻的非精灵像素
        var queue = [];
        var head = 0;
        var distances = new Uint16Array(w * h);

        for (var sy = scanY1; sy < scanY2; sy++) {
            for (var sx = scanX1; sx < scanX2; sx++) {
                var idx = sy * w + sx;
                if (mask[idx]) continue;
                var adjacent = false;
                for (var d = 0; d < 4; d++) {
                    var nx = sx + dirs4[d][0], ny = sy + dirs4[d][1];
                    if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx]) {
                        adjacent = true; break;
                    }
                }
                if (adjacent && !strokeMask[idx]) {
                    strokeMask[idx] = 1;
                    distances[idx] = 1;
                    queue.push(idx);
                }
            }
        }

        // BFS 扩展 sw 层
        while (head < queue.length) {
            var cur = queue[head++];
            var curDist = distances[cur];
            if (curDist >= sw) continue;
            var cx = cur % w, cy = (cur / w) | 0;
            for (var d2 = 0; d2 < 4; d2++) {
                var nx2 = cx + dirs4[d2][0], ny2 = cy + dirs4[d2][1];
                if (nx2 < 0 || nx2 >= w || ny2 < 0 || ny2 >= h) continue;
                var nIdx = ny2 * w + nx2;
                if (mask[nIdx] || strokeMask[nIdx]) continue;
                strokeMask[nIdx] = 1;
                distances[nIdx] = curDist + 1;
                queue.push(nIdx);
            }
        }

        // 向内填充：从精灵边缘向内扩展 iw 层，覆盖内抠误删的边缘像素
        if (iw > 0) {
            // 精灵内部的透明像素（内抠误删），距离精灵边缘 ≤ iw
            for (var sy3 = region.bounds.y; sy3 < region.bounds.y + region.bounds.h; sy3++) {
                for (var sx3 = region.bounds.x; sx3 < region.bounds.x + region.bounds.w; sx3++) {
                    var idx3 = sy3 * w + sx3;
                    if (!mask[idx3]) continue;     // 只在精灵区域内操作
                    if (data[idx3 * 4 + 3] > 0) continue; // 已有像素跳过
                    // 检查是否靠近精灵边缘（在 iw 距离内）
                    var minDist = iw + 1;
                    for (var dd = 0; dd < 4; dd++) {
                        var dnx = sx3 + dirs4[dd][0], dny = sy3 + dirs4[dd][1];
                        if (dnx < 0 || dnx >= w || dny < 0 || dny >= h) { minDist = 1; break; }
                        if (!mask[dny * w + dnx]) { minDist = 1; break; }
                    }
                    if (minDist === 1) {
                        // 边缘像素，BFS 向内填充
                        var innerQueue = [idx3];
                        var innerHead = 0;
                        var innerDist = new Uint16Array(w * h);
                        innerDist[idx3] = 1;
                        while (innerHead < innerQueue.length) {
                            var ic = innerQueue[innerHead++];
                            if (innerDist[ic] > iw) continue;
                            // 标记为描边
                            strokeMask[ic] = 1;
                            var icx = ic % w, icy = (ic / w) | 0;
                            for (var idd = 0; idd < 4; idd++) {
                                var inx = icx + dirs4[idd][0], iny = icy + dirs4[idd][1];
                                if (inx < 0 || inx >= w || iny < 0 || iny >= h) continue;
                                var ini = iny * w + inx;
                                if (!mask[ini]) continue;
                                if (strokeMask[ini] || innerDist[ini]) continue;
                                innerDist[ini] = innerDist[ic] + 1;
                                innerQueue.push(ini);
                            }
                        }
                    }
                }
            }
        }

        // 应用描边颜色
        var count = 0;
        for (var pk = 0; pk < w * h; pk++) {
            if (strokeMask[pk]) {
                var pi = pk * 4;
                data[pi] = sr;
                data[pi + 1] = sg;
                data[pi + 2] = sb;
                data[pi + 3] = 255;
                count++;
            }
        }

        // 将描边像素加入精灵的像素列表，使描边跟随精灵一起移动/缩放
        var newPixels = [];
        for (var sp = 0; sp < w * h; sp++) {
            if (strokeMask[sp]) {
                var sx = sp % w, sy = (sp / w) | 0;
                if (!region.pixelSet[sp]) {
                    region.pixelSet[sp] = 1;
                    newPixels.push([sx, sy]);
                }
            }
        }
        if (newPixels.length > 0) {
            region.pixels = region.pixels.concat(newPixels);
            region.area = region.pixels.length;
            // 重算 bounds（描边在精灵外部，bounds 需外扩）
            var nMinX = w, nMaxX = 0, nMinY = h, nMaxY = 0;
            region.pixels.forEach(function(p) {
                if (p[0] < nMinX) nMinX = p[0];
                if (p[0] > nMaxX) nMaxX = p[0];
                if (p[1] < nMinY) nMinY = p[1];
                if (p[1] > nMaxY) nMaxY = p[1];
            });
            region.bounds = { x: nMinX, y: nMinY, w: nMaxX - nMinX + 1, h: nMaxY - nMinY + 1 };
        }

        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('描边完成，已处理 ' + count + ' 个像素');
    },

    _applyMoveTransform: function(mouseImgX, mouseImgY) {
        if (this.state.selectedRegion < 0 || !this.state.transformStart) return;
        this._saveUndoState();
        var region = this.state.regions[this.state.selectedRegion];
        if (!region) return;
        var dx = Math.round(mouseImgX - this.state.transformStart.imgX);
        var dy = Math.round(mouseImgY - this.state.transformStart.imgY);
        if (dx === 0 && dy === 0) return;

        var w = this.state.originalImage.width, h = this.state.originalImage.height;
        var imgData = this.state.processedImageData;
        var data = imgData.data;

        // 构建其他精灵保护 mask
        var otherMask = new Uint8Array(w * h);
        for (var oi = 0; oi < this.state.regions.length; oi++) {
            if (oi === this.state.selectedRegion) continue;
            var ops = this.state.regions[oi].pixelSet;
            if (ops) {
                for (var oj = 0; oj < ops.length; oj++) {
                    if (ops[oj]) otherMask[oj] = 1;
                }
            }
        }

        // 先缓存所有源像素的 RGBA 值（在清除之前）
        var srcPixels = [];
        region.pixels.forEach(function(p) {
            var srcIdx = (p[1] * w + p[0]) * 4;
            srcPixels.push({
                x: p[0], y: p[1],
                r: data[srcIdx], g: data[srcIdx + 1], b: data[srcIdx + 2], a: data[srcIdx + 3]
            });
        });

        // 清除原来位置的像素（不碰其他精灵的像素）
        region.pixels.forEach(function(p) {
            var pi = (p[1] * w + p[0]) * 4;
            if (!otherMask[p[1] * w + p[0]]) {
                data[pi + 3] = 0;
            }
        });

        // 将像素移动到新位置
        var newPixels = [];
        var newPS = new Uint8Array(w * h);
        srcPixels.forEach(function(sp) {
            var nx = sp.x + dx, ny = sp.y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
            if (otherMask[ny * w + nx]) return;
            var tgtIdx = (ny * w + nx) * 4;
            data[tgtIdx] = sp.r;
            data[tgtIdx + 1] = sp.g;
            data[tgtIdx + 2] = sp.b;
            data[tgtIdx + 3] = sp.a;
            if (!newPS[ny * w + nx]) {
                newPS[ny * w + nx] = 1;
                newPixels.push([nx, ny]);
            }
        });

        // 更新 region
        region.pixels = newPixels;
        region.pixelSet = newPS;
        var mnX = w, mxX = 0, mnY = h, mxY = 0;
        newPixels.forEach(function(p) {
            if (p[0] < mnX) mnX = p[0]; if (p[0] > mxX) mxX = p[0];
            if (p[1] < mnY) mnY = p[1]; if (p[1] > mxY) mxY = p[1];
        });
        region.bounds = { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
        region.area = newPixels.length;

        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已移动 ' + newPixels.length + ' 个像素');
    },

    _applyScaleTransform: function(mouseImgX, mouseImgY) {
        if (this.state.selectedRegion < 0 || !this.state.transformInitBounds || !this.state.processedImageData) return;
        this._saveUndoState();
        var region = this.state.regions[this.state.selectedRegion];
        if (!region) return;
        var ib = this.state.transformInitBounds;
        var imgData = this.state.processedImageData;
        var data = imgData.data;
        var w = imgData.width, h = imgData.height;
        var oldPixels = region.pixels;
        var oldW = ib.w, oldH = ib.h;

        var newW = Math.max(4, mouseImgX - ib.x);
        var newH = Math.max(4, mouseImgY - ib.y);
        var sf = Math.max(newW / oldW, newH / oldH);
        // 限制缩放比例，避免缩放到图像之外
        sf = Math.max(0.05, Math.min(10, sf));
        var dstW = Math.round(oldW * sf);
        var dstH = Math.round(oldH * sf);

        // 构建其他精灵的保护 mask
        var otherMask = new Uint8Array(w * h);
        for (var oi = 0; oi < this.state.regions.length; oi++) {
            if (oi === this.state.selectedRegion) continue;
            var ops = this.state.regions[oi].pixelSet;
            if (ops) {
                for (var oj = 0; oj < ops.length; oj++) {
                    if (ops[oj]) otherMask[oj] = 1;
                }
            }
        }

        // 先复制精灵区域的像素快照（必须在清除 data 之前做，因为 imgData.data === data）
        var snapshotData = new Uint8ClampedArray(imgData.data);
        var srcC = document.createElement('canvas');
        srcC.width = oldW; srcC.height = oldH;
        var srcCtx = srcC.getContext('2d');
        // 从快照抠出精灵区域
        var snapImageData = new ImageData(snapshotData, w, h);
        var tempC = document.createElement('canvas');
        tempC.width = w; tempC.height = h;
        tempC.getContext('2d').putImageData(snapImageData, 0, 0);
        srcCtx.drawImage(tempC, ib.x, ib.y, oldW, oldH, 0, 0, oldW, oldH);
        // 把非精灵背景设为透明（基于 pixelSet）
        var srcImgData = srcCtx.getImageData(0, 0, oldW, oldH);
        var srcPx = srcImgData.data;
        for (var si = 0; si < oldW * oldH; si++) {
            var gx = ib.x + (si % oldW), gy = ib.y + Math.floor(si / oldW);
            if (!region.pixelSet || !region.pixelSet[gy * w + gx]) {
                srcPx[si * 4 + 3] = 0;
            }
        }
        srcCtx.putImageData(srcImgData, 0, 0);

        // 清除当前 region 整个 bounds 范围内的像素（缩放后旧范围可能有残留）
        for (var cy = ib.y; cy < ib.y + ib.h && cy < h; cy++) {
            for (var cx = ib.x; cx < ib.x + ib.w && cx < w; cx++) {
                if (!otherMask[cy * w + cx]) {
                    var ci = (cy * w + cx) * 4;
                    data[ci + 3] = 0;
                }
            }
        }

        // canvas 缩放（浏览器原生高质量缩放）
        var dstC = document.createElement('canvas');
        dstC.width = dstW; dstC.height = dstH;
        var dstCtx = dstC.getContext('2d');
        dstCtx.imageSmoothingEnabled = true;
        dstCtx.drawImage(srcC, 0, 0, dstW, dstH);
        // 读缩放结果写回 processedImageData
        var dstImgData = dstCtx.getImageData(0, 0, dstW, dstH);
        var dstPx = dstImgData.data;
        var newPixels = [];
        var newPS = new Uint8Array(w * h);
        for (var sy = 0; sy < dstH; sy++) {
            for (var sx = 0; sx < dstW; sx++) {
                var dpi = (sy * dstW + sx) * 4;
                var da = dstPx[dpi + 3];
                if (da < 10) continue; // 透明像素跳过
                var dx2 = ib.x + sx, dy2 = ib.y + sy;
                if (dx2 < 0 || dx2 >= w || dy2 < 0 || dy2 >= h) continue;
                // 不覆盖其他精灵的像素
                if (otherMask[dy2 * w + dx2]) continue;
                var tgtIdx = (dy2 * w + dx2) * 4;
                data[tgtIdx] = dstPx[dpi];
                data[tgtIdx + 1] = dstPx[dpi + 1];
                data[tgtIdx + 2] = dstPx[dpi + 2];
                data[tgtIdx + 3] = da;
                if (!newPS[dy2 * w + dx2]) {
                    newPS[dy2 * w + dx2] = 1;
                    newPixels.push([dx2, dy2]);
                }
            }
        }

        // 更新 region
        region.pixels = newPixels;
        region.pixelSet = newPS;
        var mnX = w, mxX = 0, mnY = h, mxY = 0;
        newPixels.forEach(function(p) {
            if (p[0] < mnX) mnX = p[0]; if (p[0] > mxX) mxX = p[0];
            if (p[1] < mnY) mnY = p[1]; if (p[1] > mxY) mxY = p[1];
        });
        region.bounds = { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
        region.area = newPixels.length;

        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('缩放完成: ' + region.bounds.w + '-' + region.bounds.h + 'px');
    },

    _computeSpriteCentroid: function(region) {
        if (!region || !region.pixels || region.pixels.length === 0) return null;
        var sumX = 0, sumY = 0;
        var len = region.pixels.length;
        for (var i = 0; i < len; i++) {
            sumX += region.pixels[i][0];
            sumY += region.pixels[i][1];
        }
        return { cx: sumX / len, cy: sumY / len };
    },

    _applyRotateTransform: function(radians) {
        if (Math.abs(radians) < 0.005 || this.state.selectedRegion < 0 || !this.state.processedImageData) return;
        this._saveUndoState();
        var region = this.state.regions[this.state.selectedRegion];
        if (!region || !region.pixels.length) return;

        var centroid = this._computeSpriteCentroid(region);
        if (!centroid) return;
        var cx = centroid.cx, cy = centroid.cy;
        var cos = Math.cos(radians), sin = Math.sin(radians);

        var imgData = this.state.processedImageData;
        var data = imgData.data;
        var w = imgData.width, h = imgData.height;
        var bx = region.bounds.x, by = region.bounds.y, bw = region.bounds.w, bh = region.bounds.h;

        // 1. 计算旋转后包围盒尺寸
        var corners = [[bx, by], [bx + bw - 1, by], [bx, by + bh - 1], [bx + bw - 1, by + bh - 1]];
        var minRX = Infinity, maxRX = -Infinity, minRY = Infinity, maxRY = -Infinity;
        for (var ci = 0; ci < corners.length; ci++) {
            var rx = cos * (corners[ci][0] - cx) - sin * (corners[ci][1] - cy) + cx;
            var ry = sin * (corners[ci][0] - cx) + cos * (corners[ci][1] - cy) + cy;
            if (rx < minRX) minRX = rx; if (rx > maxRX) maxRX = rx;
            if (ry < minRY) minRY = ry; if (ry > maxRY) maxRY = ry;
        }
        var destX = Math.floor(minRX), destY = Math.floor(minRY);
        var destW = Math.ceil(maxRX) - destX + 1;
        var destH = Math.ceil(maxRY) - destY + 1;

        // 2. 提取精灵区域到源 canvas
        var snapshotData = new Uint8ClampedArray(imgData.data);
        var tempC = document.createElement('canvas');
        tempC.width = w; tempC.height = h;
        tempC.getContext('2d').putImageData(new ImageData(snapshotData, w, h), 0, 0);
        var srcC = document.createElement('canvas');
        srcC.width = bw; srcC.height = bh;
        var srcCtx = srcC.getContext('2d');
        srcCtx.drawImage(tempC, bx, by, bw, bh, 0, 0, bw, bh);
        // 非精灵像素设为透明
        var srcImgData = srcCtx.getImageData(0, 0, bw, bh);
        var srcPx = srcImgData.data;
        for (var si = 0; si < bw * bh; si++) {
            var gx = bx + (si % bw), gy = by + Math.floor(si / bw);
            if (!region.pixelSet || !region.pixelSet[gy * w + gx]) {
                srcPx[si * 4 + 3] = 0;
            }
        }
        srcCtx.putImageData(srcImgData, 0, 0);

        // 3. 构建 otherMask
        var otherMask = new Uint8Array(w * h);
        for (var oi = 0; oi < this.state.regions.length; oi++) {
            if (oi === this.state.selectedRegion) continue;
            var ops = this.state.regions[oi].pixelSet;
            if (ops) {
                for (var oj = 0; oj < ops.length; oj++) {
                    if (ops[oj]) otherMask[oj] = 1;
                }
            }
        }

        // 4. Canvas 旋转
        var dstC = document.createElement('canvas');
        dstC.width = destW; dstC.height = destH;
        var dstCtx = dstC.getContext('2d');
        dstCtx.imageSmoothingEnabled = true;
        dstCtx.translate(cx - destX, cy - destY);
        dstCtx.rotate(radians);
        dstCtx.drawImage(srcC, bx - cx, by - cy);

        // 5. 清除旧精灵区域
        for (var py = by; py < by + bh && py < h; py++) {
            for (var px = bx; px < bx + bw && px < w; px++) {
                var pi2 = py * w + px;
                if (!otherMask[pi2] && region.pixelSet[pi2]) {
                    data[pi2 * 4 + 3] = 0;
                }
            }
        }

        // 6. 写回旋转后像素
        var dstImgData = dstCtx.getImageData(0, 0, destW, destH);
        var dstPx = dstImgData.data;
        var newPixels = [];
        var newPS = new Uint8Array(w * h);
        for (var dy = 0; dy < destH; dy++) {
            for (var dx = 0; dx < destW; dx++) {
                var dpi = (dy * destW + dx) * 4;
                var da = dstPx[dpi + 3];
                if (da < 10) continue;
                var wx = destX + dx, wy = destY + dy;
                if (wx < 0 || wx >= w || wy < 0 || wy >= h) continue;
                if (otherMask[wy * w + wx]) continue;
                var tgtIdx = (wy * w + wx) * 4;
                data[tgtIdx] = dstPx[dpi];
                data[tgtIdx + 1] = dstPx[dpi + 1];
                data[tgtIdx + 2] = dstPx[dpi + 2];
                data[tgtIdx + 3] = da;
                if (!newPS[wy * w + wx]) {
                    newPS[wy * w + wx] = 1;
                    newPixels.push([wx, wy]);
                }
            }
        }

        // 7. 更新 region
        region.pixels = newPixels;
        region.pixelSet = newPS;
        var mnX = w, mxX = 0, mnY = h, mxY = 0;
        newPixels.forEach(function(p) {
            if (p[0] < mnX) mnX = p[0]; if (p[0] > mxX) mxX = p[0];
            if (p[1] < mnY) mnY = p[1]; if (p[1] > mxY) mxY = p[1];
        });
        region.bounds = { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
        region.area = newPixels.length;
        region._outlineCache = null;

        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已旋转 ' + (radians * 180 / Math.PI).toFixed(1) + '°');
    },

    _toggleCanvasBg: function() {
        var modes = ['checkerboard', 'dark', 'light'];
        var currentIdx = modes.indexOf(this.state.canvasBgMode);
        this.state.canvasBgMode = modes[(currentIdx + 1) % modes.length];
        var mainEl = this._q('#ttMainArea');
        if (!mainEl) return;
        switch (this.state.canvasBgMode) {
            case 'dark':
                mainEl.style.background = '#1a1a2e';
                this._showToast('画布背景: 深色');
                break;
            case 'light':
                mainEl.style.background = '#d4d4d4';
                this._showToast('画布背景: 亮色');
                break;
            default:
                mainEl.style.background = '';
                this._showToast('画布背景: 棋盘格');
                break;
        }
    },

    // ========================================
    //   删除选中精灵
    // ========================================

    _deleteSelectedSprite: function() {
        if (this.state.mode !== 'split') {
            this._showToast('仅在拆分模式下可用', true);
            return;
        }

        var isGrid = this.state.splitMode === 'grid';

        if (isGrid) {
            if (!this._gridRegions || this._gridRegions.length === 0) {
                this._showToast('没有可删除的方形素材', true);
                return;
            }
            this._gridRegions.splice(this._gridRegions.length - 1, 1);
            this._showToast('已删除最后一个方形素材');
            if (this.state.splitDownload && this.state.splitDownload.dialogEl) {
                this._rebuildSpriteList();
            }
            return;
        }

        // 异形模式：批量删除精灵（连带像素）
        if (this.state.regions.length === 0) {
            this._showToast('没有可删除的精灵', true);
            return;
        }

        // 收集要删除的索引（勾选的精灵，无勾选时取当前选中）
        var delSet = {};
        var hasChecked = false;
        for (var di = 0; di < this.state.regions.length; di++) {
            if (this.state.innerSelectedRegions[di]) {
                delSet[di] = true;
                hasChecked = true;
            }
        }
        if (!hasChecked && this.state.selectedRegion >= 0) {
            delSet[this.state.selectedRegion] = true;
        }
        if (Object.keys(delSet).length === 0) {
            this._showToast('请先在右侧图层勾选或点击选中要删除的精灵', true);
            return;
        }

        // 保存撤销状态
        this._saveUndoState();

        // 收集要删除的像素（删除前先收集，避免 regions 变动后索引失效）
        var w = this.state.originalImage ? this.state.originalImage.width : 0;
        var h = this.state.originalImage ? this.state.originalImage.height : 0;
        var imgData = this.state.processedImageData;
        var pixelsToClear = [];

        for (var di2 = 0; di2 < this.state.regions.length; di2++) {
            if (delSet[di2] && this.state.regions[di2] && this.state.regions[di2].pixelSet) {
                var ps = this.state.regions[di2].pixelSet;
                for (var pj = 0; pj < ps.length; pj++) {
                    if (ps[pj]) pixelsToClear.push(pj);
                }
            }
        }

        // 清除像素（不碰保留精灵的像素）
        if (imgData && pixelsToClear.length > 0) {
            var data = imgData.data;
            for (var pi = 0; pi < pixelsToClear.length; pi++) {
                var idx4 = pixelsToClear[pi] * 4;
                data[idx4] = 0;
                data[idx4 + 1] = 0;
                data[idx4 + 2] = 0;
                data[idx4 + 3] = 0;
            }
        }

        // 重建 regions：只保留没被标记删除的
        var newRegions = [];
        for (var di3 = 0; di3 < this.state.regions.length; di3++) {
            if (!delSet[di3]) {
                newRegions.push(this.state.regions[di3]);
            }
        }
        this.state.regions = newRegions;

        // 清理状态
        this.state.selectedRegion = -1;
        this.state.innerSelectedRegions = {};

        // 刷新 UI
        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已删除 ' + Object.keys(delSet).length + ' 个精灵（含像素）');

        // 如果拆分下载对话框已打开，刷新精灵列表
        if (this.state.splitDownload && this.state.splitDownload.dialogEl) {
            this._rebuildSpriteList();
        }
    },

    // ========================================
    //   组合精灵
    // ========================================

    _toggleMergeSelect: function(active) {
        this.state.mergeSelectActive = active;
        this.state.mergeRect = null;
        var btn = this._q('[data-action="mergeSelect"]');
        if (btn) btn.classList.toggle('lasso-active', active);
        this._overlayCanvas.style.cursor = active ? 'crosshair' : 'pointer';
        if (!active) {
            this._drawOverlay();
        }
        this._showToast(active ? '请在画布上拖拽框选要合并的范围' : '已取消框选');
    },

    _drawMergeRect: function() {
        var mr = this.state.mergeRect;
        if (!mr) return;
        var s = this.state.scale;
        var x = Math.min(mr.x1, mr.x2);
        var y = Math.min(mr.y1, mr.y2);
        var w = Math.abs(mr.x2 - mr.x1);
        var h = Math.abs(mr.y2 - mr.y1);
        var ctx = this._overlayCtx;
        ctx.strokeStyle = '#00c853';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(0, 200, 83, 0.08)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#00c853';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(Math.round(w / s) + '×' + Math.round(h / s) + 'px', x + 4, y - 6);
    },

    _mergeSelectedSprites: function() {
        if (!this.state.mergeRect || !this.state.originalImage || !this.state.processedImageData) {
            this._showToast('请先在画布上框选一个范围', true);
            return;
        }

        var s = this.state.scale;
        var mr = this.state.mergeRect;
        var selX = Math.round(Math.min(mr.x1, mr.x2) / s);
        var selY = Math.round(Math.min(mr.y1, mr.y2) / s);
        var selW = Math.round(Math.abs(mr.x2 - mr.x1) / s);
        var selH = Math.round(Math.abs(mr.y2 - mr.y1) / s);
        var selRight = selX + selW;
        var selBottom = selY + selH;

        var w = this.state.originalImage.width;
        var h = this.state.originalImage.height;
        var imgData = this.state.processedImageData;
        var data = imgData.data;

        // 第一步：扫描框选范围内所有不透明像素
        var pixelSet = new Uint8Array(w * h);
        var pixelList = [];

        for (var py = selY; py < selBottom && py < h; py++) {
            for (var px = selX; px < selRight && px < w; px++) {
                var idx = py * w + px;
                if (data[idx * 4 + 3] > 0 && !pixelSet[idx]) {
                    pixelSet[idx] = 1;
                    pixelList.push([px, py]);
                }
            }
        }

        // 第二步：找出与框选区域相交的精灵，把它们的全部像素也纳入
        var delRegions = {};
        for (var ri = 0; ri < this.state.regions.length; ri++) {
            var r = this.state.regions[ri];
            var b = r.bounds;
            // 检测精灵 bounds 与框选区是否相交
            if (b.x < selRight && (b.x + b.w) > selX && b.y < selBottom && (b.y + b.h) > selY) {
                delRegions[ri] = true;
                // 把该精灵的所有像素加入（去重）
                if (r.pixels) {
                    r.pixels.forEach(function(p) {
                        var idx2 = p[1] * w + p[0];
                        if (!pixelSet[idx2]) {
                            pixelSet[idx2] = 1;
                            pixelList.push([p[0], p[1]]);
                        }
                    });
                }
            }
        }

        if (pixelList.length === 0) {
            this._showToast('框选范围内没有有效像素', true);
            return;
        }

        // 计算新精灵的 bounds
        var minX = w, maxX = 0, minY = h, maxY = 0;
        pixelList.forEach(function(p) {
            if (p[0] < minX) minX = p[0];
            if (p[0] > maxX) maxX = p[0];
            if (p[1] < minY) minY = p[1];
            if (p[1] > maxY) maxY = p[1];
        });

        // 保存撤销状态
        this._saveUndoState();

        // 构建新精灵
        var newPixelSet = new Uint8Array(w * h);
        pixelList.forEach(function(p) { newPixelSet[p[1] * w + p[0]] = 1; });

        var newRegion = {
            id: Date.now(),
            pixels: pixelList,
            pixelSet: newPixelSet,
            bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
            area: pixelList.length,
            color: this.REGION_COLORS[this.state.regions.length % this.REGION_COLORS.length]
        };

        // 重建 regions：删除被合并的精灵，追加新精灵
        var keepRegions = [];
        for (var ri2 = 0; ri2 < this.state.regions.length; ri2++) {
            if (!delRegions[ri2]) {
                keepRegions.push(this.state.regions[ri2]);
            }
        }
        keepRegions.push(newRegion);
        this.state.regions = keepRegions;

        // 清理状态
        this.state.selectedRegion = -1;
        this.state.innerSelectedRegions = {};
        this.state.mergeRect = null;
        this._toggleMergeSelect(false);

        // 刷新 UI
        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        var delCount = Object.keys(delRegions).length;
        this._showToast('已合并框选区域' + (delCount > 0 ? ' + ' + delCount + ' 个精灵' : '') + ' 生成新精灵 (' + pixelList.length + ' 像素)');

        // 如果拆分下载对话框已打开，刷新精灵列表
        if (this.state.splitDownload && this.state.splitDownload.dialogEl) {
            this._rebuildSpriteList();
        }
    },

    // ========================================
    //   背景色保护笔刷
    // ========================================

    _toggleBgProtectBrush: function() {
        this.state.bgProtectActive = this.state.bgProtectActive ? false : true;
        // 进入笔刷模式时退出套索模式
        if (this.state.bgProtectActive) {
            this.state.lassoMode = null;
            this.state.lassoPoints = [];
            this.state.lassoDrawing = false;
            this.state.innerProtectActive = false;
            var lassoBtns = this._overlay.querySelectorAll('[data-action="lassoMode"]');
            lassoBtns.forEach(function(b) { b.classList.remove('lasso-active'); });
            var innerBtn = this._overlay.querySelector('[data-action="innerProtectLasso"]');
            if (innerBtn) innerBtn.classList.remove('lasso-active');
        }
        var btn = this._q('[data-action="bgProtectBrush"]');
        if (btn) btn.classList.toggle('lasso-active', !!this.state.bgProtectActive);
        this._overlayCanvas.style.cursor = this.state.bgProtectActive ? 'none' : 'pointer';
        this._showToast(this.state.bgProtectActive ? '笔刷模式：在画布上涂抹要保护的区域' : '已退出笔刷模式');
        if (!this.state.bgProtectActive && !this.state.bgProtectMask) {
            this._drawOverlay();
        }
    },

    _clearBgProtectBrush: function() {
        this.state.bgProtectMask = null;
        this._showToast('已清除保护笔刷区域');
        this._drawOverlay();
    },

    _setBgBrushSize: function(btn) {
        var size = parseInt(btn.getAttribute('data-size'));
        if (!size) return;
        this.state.bgProtectBrushSize = size;
        // 更新所有大小按钮的高亮
        var parent = btn.parentNode;
        if (parent) {
            parent.querySelectorAll('[data-action="bgBrushSize"]').forEach(function(b) {
                b.classList.toggle('lasso-active', parseInt(b.getAttribute('data-size')) === size);
            });
        }
        this._showToast('笔刷大小: ' + (size <= 20 ? '小' : size <= 30 ? '中' : '大'));
    },

    _paintBgProtect: function(imgX, imgY) {
        if (!this.state.originalImage) return;
        var w = this.state.originalImage.width;
        var h = this.state.originalImage.height;
        var px = Math.round(imgX);
        var py = Math.round(imgY);
        var r = Math.round(this.state.bgProtectBrushSize / 2);

        if (!this.state.bgProtectMask) {
            this.state.bgProtectMask = new Uint8Array(w * h);
        }

        // 在圆形笔刷范围内标记保护
        for (var dy = -r; dy <= r; dy++) {
            for (var dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                var cx = px + dx;
                var cy = py + dy;
                if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
                    this.state.bgProtectMask[cy * w + cx] = 1;
                }
            }
        }
        this._drawOverlay();
    },

    _drawBgProtectBrush: function() {
        if (!this.state.bgProtectMask || !this.state.originalImage) return;
        var w = this.state.originalImage.width;
        var h = this.state.originalImage.height;
        var s = this.state.scale;
        var ctx = this._overlayCtx;

        // 用临时 canvas 绘制保护区域叠加层
        var tmpC = document.createElement('canvas');
        tmpC.width = w; tmpC.height = h;
        var tmpCtx = tmpC.getContext('2d');
        var imgData = tmpCtx.createImageData(w, h);
        var d = imgData.data;
        var mask = this.state.bgProtectMask;
        for (var i = 0; i < w * h; i++) {
            if (mask[i]) {
                var idx4 = i * 4;
                d[idx4] = 255; d[idx4 + 1] = 171; d[idx4 + 2] = 0; d[idx4 + 3] = 80;
            }
        }
        tmpCtx.putImageData(imgData, 0, 0);
        ctx.drawImage(tmpC, 0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
    },

    _toggleOverlay: function() {
        this.state.overlayVisible = !this.state.overlayVisible;
        var btn = this._q('[data-action="toggleOverlay"]');
        if (btn) {
            btn.classList.toggle('active', this.state.overlayVisible);
        }
        this._drawOverlay();
        this._showToast(this.state.overlayVisible ? '轮廓线已显示' : '轮廓线已隐藏');
    },

    // ========================================
    //   异形模式：迭代 BFS
    // ========================================

    _smartDetectIrregular: function() {
        if (!this.state.originalImage) { this._showToast('请先上传图片', true); return; }
        this._showToast('正在分析图片（迭代BFS）...');
        var self = this;
        setTimeout(function() {
            try {
                var t0 = performance.now();
                var result = self._runIterativeBFS();
                var elapsed = (performance.now() - t0).toFixed(0);
                if (result.regions.length === 0) {
                    self._showToast('未检测到素材区域，请调高灵敏度', true);
                    return;
                }
                self.state.regions = result.regions;
                self.state.selectedRegion = -1;
                self.state.overlayVisible = true;
                // 确保 processedImageData 存在（用于移动/缩放等操作）
                if (!self.state.processedImageData) {
                    var tmpC2 = document.createElement('canvas');
                    tmpC2.width = self.state.originalImage.width;
                    tmpC2.height = self.state.originalImage.height;
                    tmpC2.getContext('2d').drawImage(self.state.originalImage, 0, 0);
                    self.state.processedImageData = tmpC2.getContext('2d').getImageData(0, 0, self.state.originalImage.width, self.state.originalImage.height);
                }
                self._drawOverlay();
                self._drawMain();
                self._updateRegionListUI();
                self._showToast('检测到 ' + result.regions.length + ' 个异形区域 (' + elapsed + 'ms)');
            } catch (e) {
                console.error(e);
                self._showToast('检测出错: ' + e.message, true);
            }
        }, 50);
    },

    _runIterativeBFS: function() {
        var img = this.state.originalImage;
        var w = img.width, h = img.height;
        var sensitivity = parseInt(this._q('#detectSensitivity').value);
        var minArea = parseInt(this._q('#minArea').value);

        var tmpC = document.createElement('canvas');
        tmpC.width = w; tmpC.height = h;
        var tmpCtx = tmpC.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        var imageData = tmpCtx.getImageData(0, 0, w, h);
        var data = imageData.data;

        // 检测是否有透明像素
        var hasTransparentPixels = false;
        for (var ti = 3; ti < data.length; ti += 4) {
            if (data[ti] < 128) { hasTransparentPixels = true; break; }
        }

        var hasBg = this.state.irBgColor !== null;
        var hasOutline = this.state.irOutlineColor !== null;

        // 透明背景图：忽略背景色设置，透明像素直接作为背景
        var useAlphaAsBg = hasTransparentPixels;

        if (!hasBg && !useAlphaAsBg) {
            this._showToast('请先取背景色', true);
            return { regions: [] };
        }

        var bgColor = this.state.irBgColor;
        var outlineColor = this.state.irOutlineColor;
        var tol = sensitivity * 2.5;
        var outlineTol = tol * (parseInt(this._q('#outlineTolerance').value) / 100);

        var mask = new Uint8Array(w * h);
        var brightnessThreshold = 80;
        for (var i = 0; i < w * h; i++) {
            var pi = i * 4;
            var r = data[pi], g = data[pi + 1], b = data[pi + 2], a = data[pi + 3];

            // 完全透明像素作为背景（保留半透明边缘抗锯齿像素）
            if (useAlphaAsBg && a < 1) {
                mask[i] = 0;
                continue;
            }

            if (hasOutline) {
                var odr = r - outlineColor.r, odg = g - outlineColor.g, odb = b - outlineColor.b;
                var oDist = Math.sqrt(odr * odr + odg * odg + odb * odb);
                if (oDist <= outlineTol) {
                    mask[i] = 2;
                    continue;
                }
            }

            if (useAlphaAsBg) {
                // 透明背景图：非透明像素都是前景
                mask[i] = 1;
            } else {
                // 非透明背景图：用亮度判断
                var brightness = r * 0.299 + g * 0.587 + b * 0.114;
                mask[i] = brightness >= brightnessThreshold ? 0 : 1;
            }
        }

        for (var j = 0; j < w * h; j++) {
            if (mask[j] === 0) mask[j] = 3;
        }

        var bgQueue = [];
        var bgHead = 0;
        for (var x = 0; x < w; x++) {
            if (mask[x] === 3) { mask[x] = 0; bgQueue.push(x, 0); }
            var bIdx = (h - 1) * w + x;
            if (mask[bIdx] === 3) { mask[bIdx] = 0; bgQueue.push(x, h - 1); }
        }
        for (var y = 1; y < h - 1; y++) {
            var lIdx = y * w;
            if (mask[lIdx] === 3) { mask[lIdx] = 0; bgQueue.push(0, y); }
            var rIdx = y * w + w - 1;
            if (mask[rIdx] === 3) { mask[rIdx] = 0; bgQueue.push(w - 1, y); }
        }

        var BG_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        while (bgHead < bgQueue.length) {
            var cx = bgQueue[bgHead++];
            var cy = bgQueue[bgHead++];
            for (var d = 0; d < 4; d++) {
                var nx = cx + BG_DIRS[d][0], ny = cy + BG_DIRS[d][1];
                if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx] === 3) {
                    mask[ny * w + nx] = 0;
                    bgQueue.push(nx, ny);
                }
            }
        }

        for (var k = 0; k < w * h; k++) {
            if (mask[k] >= 1) mask[k] = 1;
        }

        // Dilate/Erode
        var dilateN = parseInt(this._q('#dilatePx').value);
        if (dilateN > 0) {
            for (var pass = 0; pass < dilateN; pass++) {
                var dilated = new Uint8Array(w * h);
                dilated.set(mask);
                for (var dy2 = 0; dy2 < h; dy2++) {
                    for (var dx2 = 0; dx2 < w; dx2++) {
                        if (mask[dy2 * w + dx2] === 1) continue;
                        if ((dx2 > 0 && mask[dy2 * w + dx2 - 1] === 1) ||
                            (dx2 < w - 1 && mask[dy2 * w + dx2 + 1] === 1) ||
                            (dy2 > 0 && mask[(dy2 - 1) * w + dx2] === 1) ||
                            (dy2 < h - 1 && mask[(dy2 + 1) * w + dx2] === 1)) {
                            dilated[dy2 * w + dx2] = 1;
                        }
                    }
                }
                mask.set(dilated);
            }
        } else if (dilateN < 0) {
            var erodeN = -dilateN;
            for (var pass2 = 0; pass2 < erodeN; pass2++) {
                var eroded = new Uint8Array(w * h);
                eroded.set(mask);
                for (var dy3 = 0; dy3 < h; dy3++) {
                    for (var dx3 = 0; dx3 < w; dx3++) {
                        if (mask[dy3 * w + dx3] === 0) continue;
                        if ((dx3 === 0 || mask[dy3 * w + dx3 - 1] === 0) ||
                            (dx3 === w - 1 || mask[dy3 * w + dx3 + 1] === 0) ||
                            (dy3 === 0 || mask[(dy3 - 1) * w + dx3] === 0) ||
                            (dy3 === h - 1 || mask[(dy3 + 1) * w + dx3] === 0)) {
                            eroded[dy3 * w + dx3] = 0;
                        }
                    }
                }
                mask.set(eroded);
            }
        }

        // Morphological closing
        var closedMask = new Uint8Array(w * h);
        closedMask.set(mask);

        var dilated2 = new Uint8Array(w * h);
        for (var cy2 = 0; cy2 < h; cy2++) {
            for (var cx2 = 0; cx2 < w; cx2++) {
                if (closedMask[cy2 * w + cx2] === 1) { dilated2[cy2 * w + cx2] = 1; continue; }
                var found = false;
                for (var ddy = -1; ddy <= 1 && !found; ddy++) {
                    for (var ddx = -1; ddx <= 1 && !found; ddx++) {
                        if (ddx === 0 && ddy === 0) continue;
                        var nnx = cx2 + ddx, nny = cy2 + ddy;
                        if (nnx >= 0 && nnx < w && nny >= 0 && nny < h && closedMask[nny * w + nnx] === 1) {
                            found = true;
                        }
                    }
                }
                dilated2[cy2 * w + cx2] = found ? 1 : 0;
            }
        }

        for (var cy3 = 0; cy3 < h; cy3++) {
            for (var cx3 = 0; cx3 < w; cx3++) {
                if (dilated2[cy3 * w + cx3] === 0) continue;
                var allFg = true;
                for (var ddy2 = -1; ddy2 <= 1 && allFg; ddy2++) {
                    for (var ddx2 = -1; ddx2 <= 1 && allFg; ddx2++) {
                        var nnx2 = cx3 + ddx2, nny2 = cy3 + ddy2;
                        if (nnx2 >= 0 && nnx2 < w && nny2 >= 0 && nny2 < h && dilated2[nny2 * w + nnx2] === 0) {
                            allFg = false;
                        }
                    }
                }
                closedMask[cy3 * w + cx3] = allFg ? 1 : 0;
            }
        }

        // BFS on closed mask
        var regions = [];
        var regionId = 0;
        var DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        var self = this;

        while (true) {
            var startX = -1, startY = -1;
            var outerBreak = false;
            for (var sy = 0; sy < h && !outerBreak; sy++) {
                for (var sx = 0; sx < w; sx++) {
                    if (closedMask[sy * w + sx] === 1) {
                        startX = sx; startY = sy;
                        outerBreak = true;
                        break;
                    }
                }
            }
            if (startX === -1) break;

            var regionPixels = [];
            var queue = [startX, startY];
            var head = 0;
            closedMask[startY * w + startX] = 2;
            var minX = startX, maxX = startX, minY = startY, maxY = startY;

            while (head < queue.length) {
                var qx = queue[head++];
                var qy = queue[head++];
                regionPixels.push([qx, qy]);
                if (qx < minX) minX = qx;
                if (qx > maxX) maxX = qx;
                if (qy < minY) minY = qy;
                if (qy > maxY) maxY = qy;

                for (var di = 0; di < 8; di++) {
                    var dnx = qx + DIRS[di][0], dny = qy + DIRS[di][1];
                    if (dnx >= 0 && dnx < w && dny >= 0 && dny < h && closedMask[dny * w + dnx] === 1) {
                        closedMask[dny * w + dnx] = 2;
                        queue.push(dnx, dny);
                    }
                }
            }

            var exactPixels = [];
            var pixelSet = new Uint8Array(w * h);
            regionPixels.forEach(function(p) { pixelSet[p[1] * w + p[0]] = 1; });

            var expandQueue = [];
            var expandHead = 0;
            regionPixels.forEach(function(p) {
                if (mask[p[1] * w + p[0]] === 1) {
                    exactPixels.push(p);
                } else {
                    expandQueue.push(p[0], p[1]);
                }
            });

            var visited = new Uint8Array(w * h);
            regionPixels.forEach(function(p) { visited[p[1] * w + p[0]] = 1; });

            while (expandHead < expandQueue.length) {
                var ecx = expandQueue[expandHead++];
                var ecy = expandQueue[expandHead++];
                for (var edi = 0; edi < 8; edi++) {
                    var enx = ecx + DIRS[edi][0], eny = ecy + DIRS[edi][1];
                    if (enx >= 0 && enx < w && eny >= 0 && eny < h && !visited[eny * w + enx]) {
                        visited[eny * w + enx] = 1;
                        if (mask[eny * w + enx] === 1) {
                            exactPixels.push([enx, eny]);
                            expandQueue.push(enx, eny);
                        }
                    }
                }
            }

            var area = exactPixels.length;

            if (area >= minArea) {
                var exactPixelSet = new Uint8Array(w * h);
                exactPixels.forEach(function(p) { exactPixelSet[p[1] * w + p[0]] = 1; });

                var eMinX = w, eMaxX = 0, eMinY = h, eMaxY = 0;
                exactPixels.forEach(function(p) {
                    if (p[0] < eMinX) eMinX = p[0];
                    if (p[0] > eMaxX) eMaxX = p[0];
                    if (p[1] < eMinY) eMinY = p[1];
                    if (p[1] > eMaxY) eMaxY = p[1];
                });

                regions.push({
                    id: regionId++,
                    pixels: exactPixels,
                    pixelSet: exactPixelSet,
                    bounds: { x: eMinX, y: eMinY, w: eMaxX - eMinX + 1, h: eMaxY - eMinY + 1 },
                    area: area,
                    color: self.REGION_COLORS[regions.length % self.REGION_COLORS.length]
                });
            }

            regionPixels.forEach(function(p) { closedMask[p[1] * w + p[0]] = 0; });
            exactPixels.forEach(function(p) { mask[p[1] * w + p[0]] = 0; });
        }

        return { regions: regions };
    },

    // ========================================
    //   区域列表 UI
    // ========================================

    _updateRegionListUI: function() {
        var container = this._q('#ttRegionList');
        var self = this;
        var panel = this._q('#ttRegionPanel');

        if (this.state.regions.length === 0) {
            container.innerHTML = '<div class="tt-empty">暂无检测区域</div>';
            if (panel) panel.style.display = 'none';
            return;
        }
        if (panel) panel.style.display = 'flex';
        container.innerHTML = '';

        this.state.regions.forEach(function(r, i) {
            var div = document.createElement('div');
            var isChecked = !!self.state.innerSelectedRegions[i];
            var isSelected = i === self.state.selectedRegion;
            var cls = 'tt-region-item';
            if (isSelected) cls += ' selected';
            if (isChecked) cls += ' inner-checked';
            div.className = cls;
            div.innerHTML =
                '<input type="checkbox" class="tt-inner-cb" ' + (isChecked ? 'checked' : '') + ' title="勾选后进行内轮廓抠图">' +
                '<span class="tt-color-dot" style="background:' + r.color + '"></span>' +
                '<span class="tt-info">#' + (i + 1) + ' ' + r.bounds.w + '-' + r.bounds.h + 'px ' + (r.area || 0) + 'px</span>' +
                '<button class="tt-del" data-region-del="' + i + '">\u00d7</button>';

            var cb = div.querySelector('.tt-inner-cb');
            cb.addEventListener('click', function(e) {
                e.stopPropagation();
                if (cb.checked) self.state.innerSelectedRegions[i] = true;
                else delete self.state.innerSelectedRegions[i];
                div.classList.toggle('inner-checked', cb.checked);
                self._drawOverlay();
            });

            div.addEventListener('click', function(e) {
                e.stopPropagation();
                if (self.state.innerSelectedRegions[i]) {
                    delete self.state.innerSelectedRegions[i];
                } else {
                    self.state.innerSelectedRegions[i] = true;
                }
                self.state.selectedRegion = i;
                self._updateRegionListUI();
                self._drawOverlay();
            });

            div.querySelector('.tt-del').addEventListener('click', function(e) {
                e.stopPropagation();
                self._removeRegion(i);
            });

            container.appendChild(div);
        });
    },

    _selectAllRegions: function(selectAll) {
        this.state.innerSelectedRegions = {};
        if (selectAll) {
            var self = this;
            this.state.regions.forEach(function(_, i) { self.state.innerSelectedRegions[i] = true; });
        }
        this._updateRegionListUI();
        this._drawOverlay();
    },

    _invertRegionSelection: function() {
        var newSet = {};
        var self = this;
        this.state.regions.forEach(function(_, i) {
            if (!self.state.innerSelectedRegions[i]) newSet[i] = true;
        });
        this.state.innerSelectedRegions = newSet;
        this._updateRegionListUI();
        this._drawOverlay();
    },

    _removeRegion: function(i) {
        this.state.regions.splice(i, 1);
        if (this.state.selectedRegion >= this.state.regions.length) this.state.selectedRegion = -1;
        if (this.state.selectedRegion === i) this.state.selectedRegion = -1;
        this._drawOverlay();
        this._updateRegionListUI();
    },

    _clearAllRegions: function() {
        this.state.regions = [];
        this.state.selectedRegion = -1;
        this.state.innerSelectedRegions = {};
        this._drawOverlay();
        this._updateRegionListUI();
    },

    _undoLastRegion: function() {
        if (this.state.regions.length > 0) {
            this.state.regions.pop();
            this.state.selectedRegion = -1;
            this._drawOverlay();
            this._updateRegionListUI();
        }
    },

    // ========================================
    //   内轮廓抠图
    // ========================================

    _applyInnerBgRemove: function() {
        if (!this.state.innerBgColor) { this._showToast('请先取内部背景色', true); return; }
        if (this.state.regions.length === 0) { this._showToast('请先检测外轮廓区域', true); return; }
        var hasSelection = false;
        for (var k in this.state.innerSelectedRegions) { hasSelection = true; break; }
        if (!hasSelection) { this._showToast('请先勾选要抠图的区域', true); return; }

        this._saveUndoState();

        var img = this.state.originalImage;
        var w = img.width, h = img.height;
        var innerTol = parseInt(this._q('#innerTolerance').value);
        var innerBg = this.state.innerBgColor;
        var innerOutline = this.state.innerOutlineColor;
        var hasInnerOutline = innerOutline && (innerOutline.r !== 0 || innerOutline.g !== 0 || innerOutline.b !== 0);
        var doSpill = this._q('#innerBgSpill').checked;

        // HSV 色度键参数
        var bgHsv = this._rgbToHsv(innerBg.r, innerBg.g, innerBg.b);
        var bgH = bgHsv.h;
        var hueTol = innerTol * 0.8;
        var feather = Math.min(8, innerTol * 0.15);

        // 使用 processedImageData（如果存在）而非原始图片，保留步骤 4 的透明度变化
        var srcData = this.state.processedImageData;
        var data;
        if (srcData) {
            data = srcData.data;
        } else {
            var tmpC = document.createElement('canvas');
            tmpC.width = w; tmpC.height = h;
            var tmpCtx = tmpC.getContext('2d');
            tmpCtx.drawImage(img, 0, 0);
            data = tmpCtx.getImageData(0, 0, w, h).data;
        }

        var totalRemoved = 0;
        var self = this;

        for (var ri in this.state.innerSelectedRegions) {
            if (!this.state.innerSelectedRegions[ri]) continue;
            var region = this.state.regions[ri];
            if (!region) continue;
            var b = region.bounds;
            var localW = b.w, localH = b.h;

            var localMask = new Uint8Array(localW * localH);
            region.pixels.forEach(function(p) {
                localMask[(p[1] - b.y) * localW + (p[0] - b.x)] = 1;
            });

            // 如果该区域有套索，只在套索范围内检测内部背景
            var lassoRestrict = null;
            if (self.state.lassoRegions.length > 0) {
                lassoRestrict = new Uint8Array(localW * localH);
                self.state.lassoRegions.forEach(function(lr) {
                    for (var ly = 0; ly < localH; ly++) {
                        for (var lx = 0; lx < localW; lx++) {
                            var gx = lx + b.x, gy = ly + b.y;
                            if (lr.mask[gy * w + gx]) lassoRestrict[ly * localW + lx] = 1;
                        }
                    }
                });
                // 检查该区域是否真的被套索覆盖
                var hasLassoCoverage = false;
                for (var ci = 0; ci < localW * localH; ci++) {
                    if (localMask[ci] === 1 && lassoRestrict[ci] === 1) { hasLassoCoverage = true; break; }
                }
                if (!hasLassoCoverage) lassoRestrict = null;
            }

            for (var ly = 0; ly < localH; ly++) {
                for (var lx = 0; lx < localW; lx++) {
                    if (localMask[ly * localW + lx] !== 1) continue;
                    if (lassoRestrict && !lassoRestrict[ly * localW + lx]) continue;
                    var px = lx + b.x, py = ly + b.y;
                    var pi = (py * w + px) * 4;
                    var r = data[pi], g = data[pi + 1], bl = data[pi + 2];

                    // 轮廓色检测（RGB 距离）
                    if (hasInnerOutline) {
                        var odr = r - innerOutline.r, odg = g - innerOutline.g, odb = bl - innerOutline.b;
                        var oDist = Math.sqrt(odr * odr + odg * odg + odb * odb);
                        if (oDist <= innerTol * 2) {
                            localMask[ly * localW + lx] = 3;
                            continue;
                        }
                    }

                    // HSV 色度键背景色检测
                    var hsv = self._rgbToHsv(r, g, bl);
                    var hDiff = Math.abs(hsv.h - bgH);
                    if (hDiff > 180) hDiff = 360 - hDiff;

                    if (hDiff < hueTol && hsv.s > 20 && hsv.v > 20) {
                        localMask[ly * localW + lx] = 2;
                    } else if (hDiff < hueTol + feather && hsv.s > 12 && hsv.v > 15) {
                        // 边缘柔化区也标记为背景
                        localMask[ly * localW + lx] = 2;
                    }
                }
            }

            // 删除内部背景色像素（跳过边缘 3px 保护精灵轮廓）
            var edgeGuard = 3;
            var newPixels = [];
            region.pixels.forEach(function(p) {
                var lx3 = p[0] - b.x, ly3 = p[1] - b.y;
                // 跳过精灵边缘一圈，保护轮廓
                if (lx3 < edgeGuard || lx3 >= localW - edgeGuard ||
                    ly3 < edgeGuard || ly3 >= localH - edgeGuard) {
                    newPixels.push(p);
                    return;
                }
                if (localMask[ly3 * localW + lx3] === 2) {
                    var pi2 = (p[1] * w + p[0]) * 4;
                    // 如果在保护区域内，跳过删除
                    if (self.state.innerProtectMask && self.state.innerProtectMask[p[1] * w + p[0]]) {
                        newPixels.push(p);
                        return;
                    }
                    data[pi2 + 3] = 0;
                    totalRemoved++;
                } else {
                    newPixels.push(p);
                }
            });

            region.pixels = newPixels;
            region.pixelSet = new Uint8Array(w * h);
            newPixels.forEach(function(p) { region.pixelSet[p[1] * w + p[0]] = 1; });
            if (newPixels.length > 0) {
                var eMinX = w, eMaxX = 0, eMinY = h, eMaxY = 0;
                newPixels.forEach(function(p) {
                    if (p[0] < eMinX) eMinX = p[0]; if (p[0] > eMaxX) eMaxX = p[0];
                    if (p[1] < eMinY) eMinY = p[1]; if (p[1] > eMaxY) eMaxY = p[1];
                });
                region.bounds = { x: eMinX, y: eMinY, w: eMaxX - eMinX + 1, h: eMaxY - eMinY + 1 };
            }
            region.area = newPixels.length;
        }

        // 保存处理后的图像数据
        this.state.processedImageData = srcData || (function() {
            var tmpC = document.createElement('canvas');
            tmpC.width = w; tmpC.height = h;
            var tmpCtx = tmpC.getContext('2d');
            tmpCtx.drawImage(img, 0, 0);
            var d = tmpCtx.getImageData(0, 0, w, h);
            var src = data;
            for (var si = 0; si < src.length; si++) d.data[si] = src[si];
            return d;
        })();

        this.state.innerSelectedRegions = {};
        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已移除 ' + totalRemoved + ' 个内部背景像素');
    },

    // ========================================
    //   方形模式：均匀网格分割
    // ========================================

    _doGridSplit: function() {
        if (!this.state.originalImage) { this._showToast('请先上传图片', true); return; }
        var rows = parseInt(this._getVal('#ttGridRows')) || 3;
        var cols = parseInt(this._getVal('#ttGridCols')) || 3;
        var lineWidth = parseInt(this._getVal('#ttGridLineWidth')) || 0;
        var hasEdge = this._getChecked('#ttGridEdge');

        var img = this.state.originalImage;

        // 适配视图（和异形模式一致）
        this._fitImageToView(img);
        var scale = this.state.scale;

        // 绘制主图
        this._mainCtx.drawImage(img, 0, 0, this._mainCanvas.width, this._mainCanvas.height);

        // 存储分割线位置（原图像素坐标）
        var cw = this._mainCanvas.width, ch = this._mainCanvas.height;
        this._gridRows = rows;
        this._gridCols = cols;
        this._gridLineWidth = lineWidth;
        this._gridHasEdge = hasEdge;
        this._gridColLines = [];  // 列分割线的原图 x 坐标
        this._gridRowLines = [];  // 行分割线的原图 y 坐标
        for (var c = 1; c < cols; c++) {
            this._gridColLines.push(Math.round(c * img.width / cols));
        }
        for (var r = 1; r < rows; r++) {
            this._gridRowLines.push(Math.round(r * img.height / rows));
        }

        this._recalcGridRegions();
        this._drawGridOverlay();

        // 更新信息栏
        var sizeEl = this._q('#ttInfoSize');
        if (sizeEl) sizeEl.textContent = img.width + ' \u00d7 ' + img.height;
        var boxLabel = this._q('#ttInfoBoxLabel');
        if (boxLabel) boxLabel.innerHTML = '网格: <span class="tt-val">' + rows + '\u00d7' + cols + '</span>';
        var infoBar = this._q('#ttInfoBar');
        if (infoBar) infoBar.style.display = 'flex';

        this._showToast('方形分割: ' + rows + '\u00d7' + cols + ' = ' + this._gridRegions.length + ' 块（可拖拽分割线调整）');
    },

    // 根据分割线位置重新计算区域
    _recalcGridRegions: function() {
        var img = this.state.originalImage;
        if (!img) return;
        var scale = this.state.scale;
        var lw = this._gridLineWidth * scale;
        var hasEdge = this._gridHasEdge;
        var cols = this._gridCols;
        var rows = this._gridRows;

        // 构建所有边界（原图坐标）
        var colBounds = [0];
        this._gridColLines.forEach(function(x) { colBounds.push(x); });
        colBounds.push(img.width);
        var rowBounds = [0];
        this._gridRowLines.forEach(function(y) { rowBounds.push(y); });
        rowBounds.push(img.height);

        this._gridRegions = [];
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var ox = colBounds[c], oy = rowBounds[r];
                var ow = colBounds[c + 1] - ox, oh = rowBounds[r + 1] - oy;
                if (ow <= 0 || oh <= 0) continue;

                // 缩放到画布坐标
                var sx = ox * scale, sy = oy * scale;
                var sw = ow * scale, sh = oh * scale;

                // 排除分割线区域（画布坐标）
                var fx = sx, fy = sy, fw = sw, fh = sh;
                if (lw > 0) {
                    if (c > 0 || !hasEdge) fx = sx + (c > 0 ? lw : 0);
                    if (r > 0 || !hasEdge) fy = sy + (r > 0 ? lw : 0);
                    if (c < cols - 1 || !hasEdge) fw = sw - (c > 0 ? lw : 0) - (c < cols - 1 ? lw : 0);
                    if (r < rows - 1 || !hasEdge) fh = sh - (r > 0 ? lw : 0) - (r < rows - 1 ? lw : 0);
                }

                if (fw > 0 && fh > 0) {
                    this._gridRegions.push({
                        x: fx, y: fy, w: fw, h: fh, row: r, col: c,
                        ox: ox, oy: oy, ow: ow, oh: oh
                    });
                }
            }
        }
    },

    // 网格线拖拽：检测鼠标是否靠近分割线
    _hitTestGridLine: function(canvasX, canvasY) {
        var scale = this.state.scale;
        var threshold = 8; // 像素

        // 检测列线
        for (var i = 0; i < this._gridColLines.length; i++) {
            var x = Math.round(this._gridColLines[i] * scale);
            if (Math.abs(canvasX - x) < threshold && canvasY >= 0 && canvasY <= this._mainCanvas.height) {
                return { type: 'col', index: i };
            }
        }
        // 检测行线
        for (var j = 0; j < this._gridRowLines.length; j++) {
            var y = Math.round(this._gridRowLines[j] * scale);
            if (Math.abs(canvasY - y) < threshold && canvasX >= 0 && canvasX <= this._mainCanvas.width) {
                return { type: 'row', index: j };
            }
        }
        return null;
    },

    _gridSplitAndDownload: function() {
        if (!this._gridRegions || !this._gridRegions.length) { this._showToast('请先执行方形分割', true); return; }
        var img = this.state.originalImage;
        var format = this._getVal('#splitFormat') || 'png';

        if (typeof JSZip === 'undefined') {
            this._showToast('JSZip 库未加载，无法创建 ZIP', true);
            return;
        }

        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        var srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0);

        var zip = new JSZip();
        var self = this;
        this._gridRegions.forEach(function(region) {
            var tileCanvas = document.createElement('canvas');
            tileCanvas.width = region.ow; tileCanvas.height = region.oh;
            var tileCtx = tileCanvas.getContext('2d');
            tileCtx.drawImage(srcCanvas, region.ox, region.oy, region.ow, region.oh, 0, 0, region.ow, region.oh);
            var ext = format === 'webp' ? 'webp' : 'png';
            var mime = format === 'webp' ? 'image/webp' : 'image/png';
            var dataUrl = tileCanvas.toDataURL(mime);
            var base64 = dataUrl.split(',')[1];
            zip.file('tile_r' + region.row + '_c' + region.col + '.' + ext, base64, {base64: true});
        });

        zip.generateAsync({type: 'blob'}).then(function(blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'tiles_grid_split.zip';
            a.click();
            URL.revokeObjectURL(a.href);
            self._showToast('已下载 ' + self._gridRegions.length + ' 张方形素材');
        });
    },

    _gridPushToMerge: function() {
        if (!this._gridRegions || !this._gridRegions.length) { this._showToast('请先执行方形分割', true); return; }
        var img = this.state.originalImage;
        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        var srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0);

        var self = this;
        var loaded = 0;
        var total = this._gridRegions.length;

        this._gridRegions.forEach(function(region) {
            var tileCanvas = document.createElement('canvas');
            tileCanvas.width = region.ow; tileCanvas.height = region.oh;
            var tileCtx = tileCanvas.getContext('2d');
            tileCtx.drawImage(srcCanvas, region.ox, region.oy, region.ow, region.oh, 0, 0, region.ow, region.oh);
            var tileImg = new Image();
            tileImg.src = tileCanvas.toDataURL('image/png');
            tileImg.onload = function() {
                if (!self.state.mergeImages) self.state.mergeImages = [];
                self.state.mergeImages.push({
                    name: 'r' + region.row + '_c' + region.col,
                    img: tileImg,
                    dataUrl: tileImg.src
                });
                loaded++;
                if (loaded === total) {
                    self._updateMergePreview();
                    self._switchMode('merge');
                    self._showToast('已推送 ' + total + ' 张方形素材到合并页面');
                }
            };
        });
    },

    // ========================================
    //   拆分下载对话框
    // ========================================

    _openSplitDownloadDialog: function() {
        var self = this;

        // 确认有精灵可导出
        var isGrid = this.state.splitMode === 'grid';
        if (isGrid) {
            if (!this._gridRegions || !this._gridRegions.length) {
                this._showToast('请先执行方形分割', true);
                return;
            }
        } else {
            if (!this.state.regions || this.state.regions.length === 0) {
                this._showToast('请先检测区域', true);
                return;
            }
        }

        // 已有对话框则先关闭
        this._closeSplitDownloadDialog();

        // 构建 DOM 并附加到 overlay
        var dialog = this._buildSplitDownloadDialogHTML();
        this._overlay.appendChild(dialog);
        this.state.splitDownload.dialogEl = dialog;

        // 尝试恢复缓存
        var img = this.state.originalImage;
        var cache = null;
        if (img) {
            try {
                var cacheKey = 'sds_' + img.width + 'x' + img.height;
                var raw = localStorage.getItem(cacheKey);
                if (raw) cache = JSON.parse(raw);
            } catch(e) {}
        }

        this.state.splitDownload.selectedDirHandle = null;
        this.state.splitDownload.groupSize = cache ? (cache.groupSize || 1) : 1;
        this.state.splitDownload.namePrefix = cache ? (cache.namePrefix || '') : '';
        this.state.splitDownload.groupNames = cache ? (cache.groupNames || {}) : {};

        // 恢复保存目录句柄
        if (img && typeof indexedDB !== 'undefined') {
            var cacheKey2 = 'sds_' + img.width + 'x' + img.height;
            var openReq = indexedDB.open('SplitDownloadDirCache', 1);
            openReq.onupgradeneeded = function(e) {
                e.target.result.createObjectStore('handles');
            };
            openReq.onsuccess = function(e) {
                var db = e.target.result;
                var tx = db.transaction('handles', 'readonly');
                var getReq = tx.objectStore('handles').get(cacheKey2);
                getReq.onsuccess = function() {
                    if (getReq.result) {
                        self.state.splitDownload.selectedDirHandle = getReq.result;
                        var pathEl = self._qInDlg('#ttSplitDlgDirPath');
                        if (pathEl) pathEl.textContent = getReq.result.name;
                    }
                    db.close();
                };
            };
        }

        // 生成精灵列表（使用缓存的 spriteItems 恢复排序和选中状态）
        this._rebuildSpriteList(cache ? cache.spriteItems : null);

        // 绑定事件
        this._bindSplitDownloadEvents(dialog);

        // 同步表单值
        var groupInput = dialog.querySelector('#ttSplitDlgGroupSize');
        if (groupInput) groupInput.value = String(this.state.splitDownload.groupSize);
        var prefixInput = dialog.querySelector('#ttSplitDlgNamePrefix');
        if (prefixInput) prefixInput.value = this.state.splitDownload.namePrefix;
    },

    _buildSplitDownloadDialogHTML: function() {
        var html = '' +
        '<div class="tt-splitdlg-backdrop">' +
          '<div class="tt-splitdlg">' +
            '<div class="tt-splitdlg-header">' +
              '<h2>拆分下载</h2>' +
              '<button class="tt-splitdlg-close" data-action="closeSplitDownload">&times;</button>' +
            '</div>' +
            '<div class="tt-splitdlg-body">' +
              '<!-- 左侧设置 -->' +
              '<div class="tt-splitdlg-settings">' +
                '<!-- 保存位置 -->' +
                '<div class="tt-section">' +
                  '<div class="tt-section-title">保存位置</div>' +
                  '<div style="display:flex;align-items:center;gap:8px;">' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="selectSaveDir" id="ttSplitDlgSelectDir" style="width:auto;">📁 选择文件夹</button>' +
                    '<span id="ttSplitDlgDirPath" style="font-size:11px;color:#aaa;">未选择</span>' +
                  '</div>' +
                '</div>' +
                '<!-- 临近分组 -->' +
                '<div class="tt-section">' +
                  '<div class="tt-section-title">临近分组</div>' +
                  '<div class="tt-input-group">' +
                    '<label>每组精灵数量 (0 或 1 = 不分组)</label>' +
                    '<input type="number" id="ttSplitDlgGroupSize" value="1" min="0" max="999">' +
                  '</div>' +
                '</div>' +
                '<!-- 默认命名头 -->' +
                '<div class="tt-section">' +
                  '<div class="tt-section-title">默认命名头</div>' +
                  '<div class="tt-input-group">' +
                    '<label>文件名前缀</label>' +
                    '<input type="text" id="ttSplitDlgNamePrefix" value="" placeholder="例如: hero">' +
                  '</div>' +
                '</div>' +
                '<!-- 内扣提示 -->' +
                '<div class="tt-section" id="ttSplitDlgInnerInfo" style="display:none;">' +
                  '<div class="tt-section-title">内扣区域</div>' +
                  '<p style="font-size:11px;color:#aaa;">已处理的内部空洞将保留在导出图片中。带有 <span style="color:#00c853;">●</span> 标记的精灵已启用内扣。</p>' +
                '</div>' +
              '</div>' +
              '<!-- 右侧精灵列表 -->' +
              '<div class="tt-splitdlg-spritelist">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">' +
                  '<div class="tt-section-title" style="margin-bottom:0;">' +
                    '精灵列表 (<span id="ttSplitDlgSpriteCount">0</span>)' +
                  '</div>' +
                  '<div style="display:flex;gap:6px;">' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="selectAll" style="width:auto;font-size:11px;">全选</button>' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="selectNone" style="width:auto;font-size:11px;">全不选</button>' +
                  '</div>' +
                '</div>' +
                '<div class="tt-splitdlg-table-wrap">' +
                  '<table class="tt-splitdlg-table">' +
                    '<thead><tr>' +
                      '<th style="width:28px;"></th>' +
                      '<th style="width:28px;"></th>' +
                      '<th style="width:50px;">编号</th>' +
                      '<th style="width:60px;">缩略图</th>' +
                      '<th style="width:68px;">尺寸</th>' +
                      '<th>素材名</th>' +
                      '<th style="width:28px;"></th>' +
                    '</tr></thead>' +
                    '<tbody id="ttSplitDlgTableBody"></tbody>' +
                  '</table>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="tt-splitdlg-footer">' +
              '<button class="tt-btn tt-btn-secondary" data-action="closeSplitDownload">取消</button>' +
              '<button class="tt-btn tt-btn-success" data-action="executeSplitDownload" id="ttSplitDlgSaveBtn">保存</button>' +
            '</div>' +
          '</div>' +
        '</div>';
        var div = document.createElement('div');
        div.innerHTML = html;
        return div.firstElementChild;
    },

    _closeSplitDownloadDialog: function() {
        // 保存当前设置到缓存
        var img = this.state.originalImage;
        if (img) {
            try {
                var cacheKey = 'sds_' + img.width + 'x' + img.height;
                var cache = {
                    groupSize: this.state.splitDownload.groupSize,
                    namePrefix: this.state.splitDownload.namePrefix,
                    dirHandle: null,
                    spriteItems: this.state.splitDownload.spriteItems.map(function(it) {
                        return {
                            sourceIndex: it.sourceIndex,
                            filename: it.filename,
                            selected: it.selected,
                            displayIndex: it.displayIndex,
                            innerEnabled: it.innerEnabled
                        };
                    }),
                    groupNames: this.state.splitDownload.groupNames
                };
                // 单独保存 directory handle（IndexedDB 支持存储 FileSystemDirectoryHandle）
                var dirHandle = this.state.splitDownload.selectedDirHandle;
                if (dirHandle && typeof indexedDB !== 'undefined') {
                    var storeReq = indexedDB.open('SplitDownloadDirCache', 1);
                    storeReq.onupgradeneeded = function(e) {
                        e.target.result.createObjectStore('handles');
                    };
                    storeReq.onsuccess = function(e) {
                        var db = e.target.result;
                        var tx = db.transaction('handles', 'readwrite');
                        tx.objectStore('handles').put(dirHandle, cacheKey);
                        tx.oncomplete = function() { db.close(); };
                    };
                }
                localStorage.setItem(cacheKey, JSON.stringify(cache));
            } catch(e) {}
        }
        var dlg = this.state.splitDownload.dialogEl;
        if (dlg && dlg.parentNode) {
            dlg.parentNode.removeChild(dlg);
        }
        this.state.splitDownload.dialogEl = null;
        this.state.splitDownload.selectedDirHandle = null;
        this.state.splitDownload.spriteItems = [];
    },

    _bindSplitDownloadEvents: function(dialog) {
        var self = this;

        // 关闭按钮 / 取消
        dialog.querySelectorAll('[data-action="closeSplitDownload"]').forEach(function(el) {
            el.addEventListener('click', function() {
                self._closeSplitDownloadDialog();
            });
        });

        // 点击遮罩关闭
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) {
                self._closeSplitDownloadDialog();
            }
        });

        // 选择文件夹
        var dirBtn = dialog.querySelector('[data-action="selectSaveDir"]');
        if (dirBtn) {
            dirBtn.addEventListener('click', function() {
                self._selectSaveDirectory();
            });
        }

        // 分组大小变化
        var groupInput = dialog.querySelector('#ttSplitDlgGroupSize');
        if (groupInput) {
            groupInput.addEventListener('input', function() {
                self._onGroupSizeChange(this.value);
            });
        }

        // 命名头变化
        var prefixInput = dialog.querySelector('#ttSplitDlgNamePrefix');
        if (prefixInput) {
            prefixInput.addEventListener('input', function() {
                self._onNamePrefixChange(this.value);
            });
        }

        // 全选 / 全不选
        var selectAllBtn = dialog.querySelector('[data-action="selectAll"]');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', function() {
                self._toggleAllSelected(true);
            });
        }
        var selectNoneBtn = dialog.querySelector('[data-action="selectNone"]');
        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', function() {
                self._toggleAllSelected(false);
            });
        }

        // 保存按钮
        var saveBtn = dialog.querySelector('[data-action="executeSplitDownload"]');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._executeSplitDownload();
            });
        }

        // 阻止对话框内的事件冒泡到 overlay
        dialog.addEventListener('mousedown', function(e) { e.stopPropagation(); });
        dialog.addEventListener('wheel', function(e) { e.stopPropagation(); });
    },

    _selectSaveDirectory: function() {
        var self = this;
        try {
            if (typeof window.showDirectoryPicker !== 'function') {
                this._showToast('您的浏览器不支持文件夹选择，将使用 ZIP 下载', true);
                return;
            }
            window.showDirectoryPicker().then(function(handle) {
                self.state.splitDownload.selectedDirHandle = handle;
                var pathEl = self._qInDlg('#ttSplitDlgDirPath');
                if (pathEl) pathEl.textContent = handle.name;
            }).catch(function(err) {
                if (err.name !== 'AbortError') {
                    self._showToast('选择文件夹失败: ' + err.message, true);
                }
            });
        } catch(e) {
            this._showToast('文件夹选择不可用，将使用 ZIP 下载', true);
        }
    },

    _qInDlg: function(selector) {
        var dlg = this.state.splitDownload.dialogEl;
        return dlg ? dlg.querySelector(selector) : null;
    },

    _onGroupSizeChange: function(value) {
        var n = parseInt(value) || 0;
        if (n < 0) n = 0;
        this.state.splitDownload.groupSize = n;
        this._rebuildSpriteList();
    },

    _onNamePrefixChange: function(value) {
        this.state.splitDownload.namePrefix = value.trim();
        this._rebuildSpriteList();
    },

    _rebuildSpriteList: function(cachedItems) {
        var dlg = this.state.splitDownload.dialogEl;
        if (!dlg) return;

        var groupSize = this.state.splitDownload.groupSize;
        var prefix = this.state.splitDownload.namePrefix || 'sprite';
        var isGrid = this.state.splitMode === 'grid';
        var useGroups = groupSize > 1;

        var existingItems = this.state.splitDownload.spriteItems;

        // 如果有缓存数据，用缓存恢复精灵列表（排序和选中状态）
        if (cachedItems && cachedItems.length > 0 && (!existingItems || existingItems.length === 0)) {
            var totalCount = isGrid ? (this._gridRegions ? this._gridRegions.length : 0)
                                    : (this.state.regions ? this.state.regions.length : 0);
            var restored = [];
            for (var ci = 0; ci < cachedItems.length; ci++) {
                var ciData = cachedItems[ci];
                if (ciData.sourceIndex < totalCount) {
                    restored.push({
                        sourceIndex: ciData.sourceIndex,
                        filename: ciData.filename || '',
                        selected: ciData.selected !== false,
                        displayIndex: ciData.displayIndex,
                        innerEnabled: ciData.innerEnabled || false,
                        thumbDataUrl: ''
                    });
                }
            }
            // 补全缓存中缺失的新精灵
            for (var ni = 0; ni < totalCount; ni++) {
                if (!restored.some(function(r) { return r.sourceIndex === ni; })) {
                    restored.push({
                        sourceIndex: ni,
                        filename: '',
                        selected: true,
                        innerEnabled: false,
                        thumbDataUrl: ''
                    });
                }
            }
            this.state.splitDownload.spriteItems = restored;
            existingItems = restored;
        }

        if (existingItems && existingItems.length > 0) {
            // 保留用户排序，只重新计算文件名和刷新缩略图
            for (var i = 0; i < existingItems.length; i++) {
                var thumbSize = 44;
                var filename;
                if (useGroups) {
                    var groupNum = Math.floor(i / groupSize) + 1;
                    var inGroupNum = (i % groupSize) + 1;
                    var gName = this.state.splitDownload.groupNames && this.state.splitDownload.groupNames[groupNum];
                    var gLabel = gName || String(groupNum);
                    filename = prefix + '_' + gLabel + '-' + inGroupNum;
                } else {
                    filename = prefix + '_' + (i + 1);
                }
                existingItems[i].filename = filename;
                try {
                    existingItems[i].thumbDataUrl = this._generateThumbnailDataUrl(existingItems[i].sourceIndex, isGrid, thumbSize);
                } catch(e) {}
            }
            this._renderSpriteTable(existingItems, dlg, useGroups, groupSize);
            return;
        }

        // 首次打开：按原始区域顺序构建
        var totalCount = isGrid ? (this._gridRegions ? this._gridRegions.length : 0)
                                : (this.state.regions ? this.state.regions.length : 0);
        var items = [];
        var thumbSize = 44;

        for (var i2 = 0; i2 < totalCount; i2++) {
            var filename2;
            if (useGroups) {
                var groupNum2 = Math.floor(i2 / groupSize) + 1;
                var inGroupNum2 = (i2 % groupSize) + 1;
                filename2 = prefix + '_' + groupNum2 + '-' + inGroupNum2;
            } else {
                filename2 = prefix + '_' + (i2 + 1);
            }
            var innerEnabled = false;
            if (!isGrid) {
                innerEnabled = !!this.state.innerSelectedRegions[i2];
            }
            var thumbDataUrl = '';
            try {
                thumbDataUrl = this._generateThumbnailDataUrl(i2, isGrid, thumbSize);
            } catch(e) {}
            items.push({
                index: i2,
                sourceIndex: i2,
                filename: filename2,
                innerEnabled: innerEnabled,
                thumbDataUrl: thumbDataUrl,
                isGrid: isGrid,
                selected: true
            });
        }

        this.state.splitDownload.spriteItems = items;
        this._renderSpriteTable(items, dlg, useGroups, groupSize);
    },

    // 根据当前 spriteItems 顺序重新计算分组和文件名
    _reassignFromSpriteOrder: function() {
        var items = this.state.splitDownload.spriteItems;
        var groupSize = this.state.splitDownload.groupSize;
        var prefix = this.state.splitDownload.namePrefix || 'sprite';
        var useGroups = groupSize > 1;

        for (var i = 0; i < items.length; i++) {
            var filename;
            if (useGroups) {
                var groupNum = Math.floor(i / groupSize) + 1;
                var inGroupNum = (i % groupSize) + 1;
                var gName = this.state.splitDownload.groupNames && this.state.splitDownload.groupNames[groupNum];
                var gLabel = gName || String(groupNum);
                filename = prefix + '_' + gLabel + '-' + inGroupNum;
            } else {
                filename = prefix + '_' + (i + 1);
            }
            items[i].filename = filename;
        }

        var dlg = this.state.splitDownload.dialogEl;
        if (dlg) {
            this._renderSpriteTable(items, dlg, useGroups, groupSize);
        }
    },

    _renderSpriteTable: function(items, dlg, useGroups, groupSize) {
        var self = this;
        var tbody = dlg.querySelector('#ttSplitDlgTableBody');
        var html = '';
        var lastGroup = -1;
        var totalCols = 8; // checkbox + drag + 编号 + 缩略图 + 尺寸 + 素材名 + 内扣

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (useGroups) {
                var curGroup = Math.floor(i / groupSize) + 1;
                if (curGroup !== lastGroup) {
                    html += '<tr class="tt-splitdlg-group-header"><td colspan="' + totalCols + '">' +
                        '<input type="text" class="tt-splitdlg-group-name" value="' + (self.state.splitDownload.groupNames && self.state.splitDownload.groupNames[curGroup] ? self._escapeHtml(self.state.splitDownload.groupNames[curGroup]) : '组 ' + curGroup) + '" data-group-num="' + curGroup + '" style="background:transparent;border:none;color:var(--accent);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:1px;width:120px;">' +
                        '</td></tr>';
                    lastGroup = curGroup;
                }
            }
            var checked = item.selected !== false ? ' checked' : '';
            var innerDot = item.innerEnabled ? '<span class="tt-splitdlg-inner-dot" title="已启用内扣"></span>' : '';
            var thumb = item.thumbDataUrl
                ? '<img src="' + item.thumbDataUrl + '" class="tt-splitdlg-thumb" draggable="false" style="width:auto;height:44px;max-width:60px;object-fit:contain;display:block;">'
                : '<div class="tt-splitdlg-thumb" style="width:44px;height:44px;background:rgba(255,255,255,0.03);display:flex;align-items:center;justify-content:center;color:#555;font-size:10px;">-</div>';
            // 计算素材尺寸
            var sizeText = '';
            var isGrid = self.state.splitMode === 'grid';
            if (isGrid) {
                var gr = self._gridRegions && self._gridRegions[item.sourceIndex];
                if (gr) sizeText = gr.ow + '×' + gr.oh;
            } else {
                var ir = self.state.regions && self.state.regions[item.sourceIndex];
                if (ir && ir.bounds) sizeText = ir.bounds.w + '×' + ir.bounds.h;
            }

            html += '<tr class="tt-splitdlg-row" draggable="true" data-sprite-list-idx="' + i + '">' +
                '<td style="width:28px;text-align:center;"><input type="checkbox" class="tt-splitdlg-cb" data-sprite-cb-idx="' + i + '"' + checked + '></td>' +
                '<td><span class="tt-splitdlg-drag-handle" title="拖动排序">≡</span></td>' +
                '<td style="width:50px;text-align:center;color:var(--text2);">' + (i + 1) + '</td>' +
                '<td style="width:60px;padding:3px 4px;">' + thumb + '</td>' +
                '<td style="width:68px;text-align:center;color:var(--text2);font-size:10px;white-space:nowrap;">' + sizeText + '</td>' +
                '<td><input type="text" value="' + self._escapeHtml(item.filename) + '" data-sprite-idx="' + i + '" data-field="filename"></td>' +
                '<td style="width:28px;">' + innerDot + '</td>' +
                '</tr>';
        }

        tbody.innerHTML = html;

        // 绑定勾选框事件
        var checkboxes = dlg.querySelectorAll('.tt-splitdlg-cb');
        checkboxes.forEach(function(cb) {
            cb.addEventListener('change', function() {
                var idx = parseInt(this.getAttribute('data-sprite-cb-idx'));
                if (idx >= 0 && idx < items.length) {
                    items[idx].selected = this.checked;
                    self._updateSelectedCount(dlg, items);
                }
            });
        });

        this._updateSelectedCount(dlg, items);

        var hasInner = items.some(function(it) { return it.innerEnabled; });
        var innerInfo = dlg.querySelector('#ttSplitDlgInnerInfo');
        if (innerInfo) innerInfo.style.display = hasInner ? 'block' : 'none';

        this._bindTableEditEvents(dlg);
        this._bindDragSortEvents(dlg);
    },

    _updateSelectedCount: function(dlg, items) {
        var selectedCount = 0;
        for (var i = 0; i < items.length; i++) {
            if (items[i].selected !== false) selectedCount++;
        }
        var countEl = dlg.querySelector('#ttSplitDlgSpriteCount');
        if (countEl) countEl.textContent = selectedCount + '/' + items.length;
    },

    _toggleAllSelected: function(checked) {
        var items = this.state.splitDownload.spriteItems;
        var dlg = this.state.splitDownload.dialogEl;
        if (!dlg || !items) return;

        for (var i = 0; i < items.length; i++) {
            items[i].selected = checked;
        }

        // 同步所有勾选框
        var checkboxes = dlg.querySelectorAll('.tt-splitdlg-cb');
        checkboxes.forEach(function(cb) {
            cb.checked = checked;
        });

        this._updateSelectedCount(dlg, items);
    },

    _bindDragSortEvents: function(dlg) {
        var self = this;
        var dragSrcIdx = -1;

        var rows = dlg.querySelectorAll('tr.tt-splitdlg-row');
        rows.forEach(function(row) {
            row.addEventListener('dragstart', function(e) {
                dragSrcIdx = parseInt(this.getAttribute('data-sprite-list-idx'));
                if (isNaN(dragSrcIdx)) return;
                this.classList.add('tt-splitdlg-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(dragSrcIdx));
            });

            row.addEventListener('dragend', function() {
                this.classList.remove('tt-splitdlg-dragging');
                // 清除所有指示器
                dlg.querySelectorAll('.tt-splitdlg-drag-over').forEach(function(el) {
                    el.classList.remove('tt-splitdlg-drag-over');
                });
                dragSrcIdx = -1;
            });

            row.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                var targetIdx = parseInt(this.getAttribute('data-sprite-list-idx'));
                if (isNaN(targetIdx) || targetIdx === dragSrcIdx) return;
                // 清除其他行的指示器
                dlg.querySelectorAll('.tt-splitdlg-drag-over').forEach(function(el) {
                    el.classList.remove('tt-splitdlg-drag-over');
                });
                this.classList.add('tt-splitdlg-drag-over');
            });

            row.addEventListener('dragleave', function() {
                this.classList.remove('tt-splitdlg-drag-over');
            });

            row.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('tt-splitdlg-drag-over');
                var targetIdx = parseInt(this.getAttribute('data-sprite-list-idx'));
                if (isNaN(targetIdx) || isNaN(dragSrcIdx) || targetIdx === dragSrcIdx) return;

                // 移动 spriteItems 中的元素
                var items = self.state.splitDownload.spriteItems;
                var moved = items.splice(dragSrcIdx, 1)[0];
                items.splice(targetIdx, 0, moved);

                // 按新顺序重新分配分组和文件名
                self._reassignFromSpriteOrder();
            });
        });
    },

    _bindTableEditEvents: function(dlg) {
        var self = this;
        var inputs = dlg.querySelectorAll('#ttSplitDlgTableBody input');
        inputs.forEach(function(inp) {
            inp.addEventListener('blur', function() {
                self._onTableFieldChange(this);
            });
            inp.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            });
        });
        // Group name inputs
        var groupInputs = dlg.querySelectorAll('.tt-splitdlg-group-name');
        groupInputs.forEach(function(inp) {
            inp.addEventListener('blur', function() {
                self._onGroupNameChange(this);
            });
            inp.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            });
        });
    },

    _onGroupNameChange: function(inputEl) {
        var groupNum = parseInt(inputEl.getAttribute('data-group-num'));
        var value = inputEl.value.trim();
        if (!groupNum) return;
        if (!this.state.splitDownload.groupNames) this.state.splitDownload.groupNames = {};
        if (value) {
            this.state.splitDownload.groupNames[groupNum] = value;
        } else {
            delete this.state.splitDownload.groupNames[groupNum];
        }
        this._reassignFromSpriteOrder();
    },

    _onTableFieldChange: function(inputEl) {
        var idx = parseInt(inputEl.getAttribute('data-sprite-idx'));
        var field = inputEl.getAttribute('data-field');
        var value = inputEl.value.trim();
        var items = this.state.splitDownload.spriteItems;
        if (idx >= 0 && idx < items.length) {
            if (field === 'filename') {
                items[idx].filename = value;
            } else if (field === 'index') {
                var newIndex = parseInt(value);
                if (!isNaN(newIndex) && newIndex > 0) {
                    items[idx].displayIndex = newIndex;
                }
            }
        }
    },

    _executeSplitDownload: function() {
        var items = this.state.splitDownload.spriteItems;
        if (!items || items.length === 0) {
            this._showToast('没有精灵可保存', true);
            return;
        }

        var dirHandle = this.state.splitDownload.selectedDirHandle;
        var format = this._q('#splitFormat') ? this._q('#splitFormat').value : 'png';
        var trim = this._q('#trimTransparent') ? this._q('#trimTransparent').checked : true;
        var mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        var ext = format === 'webp' ? '.webp' : '.png';
        var isGrid = this.state.splitMode === 'grid';

        // 生成所有精灵的 dataUrl，然后按 selected 筛选
        var allDataUrls = this._generateSpriteDataUrls(isGrid, mimeType, trim);
        var selectedItems = [];
        var selectedDataUrls = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].selected !== false) {
                selectedItems.push(items[i]);
                selectedDataUrls.push(allDataUrls[i]);
            }
        }

        if (selectedItems.length === 0) {
            this._showToast('没有选中任何精灵', true);
            return;
        }

        if (dirHandle) {
            this._saveToDirectory(dirHandle, selectedItems, selectedDataUrls, ext);
        } else if (typeof JSZip !== 'undefined') {
            this._saveToZip(selectedItems, selectedDataUrls, ext);
        } else {
            this._showToast('请先选择保存文件夹', true);
        }
    },

    _generateThumbnailDataUrl: function(spriteIndex, isGrid, thumbSize) {
        var img = this.state.originalImage;
        thumbSize = thumbSize || 48;
        var thumbCanvas = document.createElement('canvas');
        var thumbCtx = thumbCanvas.getContext('2d');

        if (isGrid) {
            var region = this._gridRegions[spriteIndex];
            if (!region) return '';
            // 直接按比例缩放
            var srcCanvas = document.createElement('canvas');
            srcCanvas.width = img.width; srcCanvas.height = img.height;
            var srcCtx = srcCanvas.getContext('2d');
            srcCtx.drawImage(img, 0, 0);

            var scale = Math.min(thumbSize / region.ow, thumbSize / region.oh);
            thumbCanvas.width = Math.round(region.ow * scale);
            thumbCanvas.height = Math.round(region.oh * scale);
            thumbCtx.drawImage(srcCanvas, region.ox, region.oy, region.ow, region.oh, 0, 0, thumbCanvas.width, thumbCanvas.height);
        } else {
            var region = this.state.regions[spriteIndex];
            if (!region) return '';
            var b = region.bounds;

            var srcCanvas2 = document.createElement('canvas');
            srcCanvas2.width = img.width; srcCanvas2.height = img.height;
            var srcCtx2 = srcCanvas2.getContext('2d');
            if (this.state.processedImageData) {
                srcCtx2.putImageData(this.state.processedImageData, 0, 0);
            } else {
                srcCtx2.drawImage(img, 0, 0);
            }
            var srcData = srcCtx2.getImageData(0, 0, img.width, img.height);

            // 逐像素精确复制
            var tileCanvas = document.createElement('canvas');
            tileCanvas.width = b.w; tileCanvas.height = b.h;
            var tileCtx = tileCanvas.getContext('2d');
            var tileData = tileCtx.createImageData(b.w, b.h);
            var td = tileData.data;
            var sd = srcData.data;

            region.pixels.forEach(function(p) {
                var sx = (p[1] * img.width + p[0]) * 4;
                var dx = ((p[1] - b.y) * b.w + (p[0] - b.x)) * 4;
                td[dx] = sd[sx];
                td[dx + 1] = sd[sx + 1];
                td[dx + 2] = sd[sx + 2];
                td[dx + 3] = sd[sx + 3];
            });
            tileCtx.putImageData(tileData, 0, 0);

            var scale = Math.min(thumbSize / b.w, thumbSize / b.h);
            thumbCanvas.width = Math.round(b.w * scale);
            thumbCanvas.height = Math.round(b.h * scale);
            thumbCtx.drawImage(tileCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        }

        return thumbCanvas.toDataURL('image/png');
    },

    _generateSpriteDataUrls: function(isGrid, mimeType, trim) {
        var img = this.state.originalImage;
        var items = this.state.splitDownload.spriteItems;

        // 按 spriteItems 的顺序生成 dataURL（尊重用户拖拽排序）
        if (isGrid) {
            var srcCanvas = document.createElement('canvas');
            srcCanvas.width = img.width; srcCanvas.height = img.height;
            var srcCtx = srcCanvas.getContext('2d');
            srcCtx.drawImage(img, 0, 0);

            return items.map(function(item) {
                var region = this._gridRegions[item.sourceIndex];
                if (!region) return { dataUrl: '' };
                var tileCanvas = document.createElement('canvas');
                tileCanvas.width = region.ow; tileCanvas.height = region.oh;
                var tileCtx = tileCanvas.getContext('2d');
                tileCtx.drawImage(srcCanvas, region.ox, region.oy, region.ow, region.oh, 0, 0, region.ow, region.oh);
                return { dataUrl: tileCanvas.toDataURL(mimeType, 0.95) };
            }, this);
        } else {
            var srcCanvas2 = document.createElement('canvas');
            srcCanvas2.width = img.width; srcCanvas2.height = img.height;
            var srcCtx2 = srcCanvas2.getContext('2d');
            if (this.state.processedImageData) {
                srcCtx2.putImageData(this.state.processedImageData, 0, 0);
            } else {
                srcCtx2.drawImage(img, 0, 0);
            }
            var srcData = srcCtx2.getImageData(0, 0, img.width, img.height);

            return items.map(function(item) {
                var region = this.state.regions[item.sourceIndex];
                if (!region) return { dataUrl: '' };
                var b = region.bounds;

                // 逐像素精确复制精灵像素
                var tileCanvas = document.createElement('canvas');
                tileCanvas.width = b.w; tileCanvas.height = b.h;
                var tileCtx = tileCanvas.getContext('2d');
                var tileData = tileCtx.createImageData(b.w, b.h);
                var td = tileData.data;
                var sd = srcData.data;

                region.pixels.forEach(function(p) {
                    var sx = (p[1] * img.width + p[0]) * 4;
                    var dx = ((p[1] - b.y) * b.w + (p[0] - b.x)) * 4;
                    td[dx] = sd[sx];
                    td[dx + 1] = sd[sx + 1];
                    td[dx + 2] = sd[sx + 2];
                    td[dx + 3] = sd[sx + 3];
                });

                tileCtx.putImageData(tileData, 0, 0);
                var finalCanvas = trim ? this._trimCanvas(tileCanvas) : tileCanvas;
                return { dataUrl: finalCanvas.toDataURL(mimeType, 0.95) };
            }, this);
        }
    },

    _saveToDirectory: function(dirHandle, items, dataUrls, ext) {
        var self = this;
        var saved = 0;
        var failed = 0;

        (async function() {
            // 先验证并请求保存目录权限
            try {
                var permStatus = await dirHandle.queryPermission({ mode: 'readwrite' });
                if (permStatus !== 'granted') {
                    permStatus = await dirHandle.requestPermission({ mode: 'readwrite' });
                    if (permStatus !== 'granted') {
                        self._showToast('没有保存目录的写入权限', true);
                        self._closeSplitDownloadDialog();
                        return;
                    }
                }
            } catch(permErr) {
                self._showToast('获取目录权限失败，请重新选择文件夹', true);
                self._closeSplitDownloadDialog();
                return;
            }

            for (var i = 0; i < items.length; i++) {
                var filename = items[i].filename + ext;
                try {
                    var resp = await fetch(dataUrls[i].dataUrl);
                    var blob = await resp.blob();
                    var fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                    var writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    saved++;
                } catch(e) {
                    failed++;
                    console.error('保存失败 ' + filename + ':', e);
                }
            }

            if (failed === 0) {
                self._showToast('已保存 ' + saved + ' 个文件到 ' + dirHandle.name);
            } else {
                self._showToast('保存完成: ' + saved + ' 成功, ' + failed + ' 失败', true);
            }
            self._closeSplitDownloadDialog();
        })();
    },

    _saveToZip: function(items, dataUrls, ext) {
        var self = this;
        if (typeof JSZip === 'undefined') {
            this._showToast('JSZip 库未加载，无法创建 ZIP', true);
            return;
        }

        var zip = new JSZip();
        for (var i = 0; i < items.length; i++) {
            var filename = items[i].filename + ext;
            var base64 = dataUrls[i].dataUrl.split(',')[1];
            zip.file(filename, base64, { base64: true });
        }

        zip.generateAsync({ type: 'blob' }).then(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'tiles_split.zip';
            a.click();
            URL.revokeObjectURL(url);
            self._showToast('已下载 ' + items.length + ' 张素材 (ZIP)');
            self._closeSplitDownloadDialog();
        });
    },

    // ========================================
    //   拆分并下载
    // ========================================

    _splitAndDownload: function() {
        var self = this;
        var items = this.state.regions;
        if (items.length === 0) { this._showToast('请先检测区域', true); return; }

        var img = this.state.originalImage;
        var format = this._q('#splitFormat').value;
        var trim = this._q('#trimTransparent').checked;
        var mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        var ext = format === 'webp' ? '.webp' : '.png';

        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        var srcCtx = srcCanvas.getContext('2d');
        if (this.state.processedImageData) {
            srcCtx.putImageData(this.state.processedImageData, 0, 0);
        } else {
            srcCtx.drawImage(img, 0, 0);
        }
        var srcData = srcCtx.getImageData(0, 0, img.width, img.height);

        if (typeof JSZip === 'undefined') {
            this._showToast('JSZip 库未加载，无法创建 ZIP', true);
            return;
        }

        var zip = new JSZip();

        this.state.regions.forEach(function(region, i) {
            var b = region.bounds;
            var tileCanvas = document.createElement('canvas');
            tileCanvas.width = b.w; tileCanvas.height = b.h;
            var tileCtx = tileCanvas.getContext('2d');
            var tileData = tileCtx.createImageData(b.w, b.h);
            var td = tileData.data;
            var sd = srcData.data;

            region.pixels.forEach(function(p) {
                var sx = (p[1] * img.width + p[0]) * 4;
                var dx = ((p[1] - b.y) * b.w + (p[0] - b.x)) * 4;
                td[dx] = sd[sx];
                td[dx + 1] = sd[sx + 1];
                td[dx + 2] = sd[sx + 2];
                td[dx + 3] = sd[sx + 3];
            });

            tileCtx.putImageData(tileData, 0, 0);
            var finalCanvas = trim ? self._trimCanvas(tileCanvas) : tileCanvas;
            var dataUrl = finalCanvas.toDataURL(mimeType, 0.95);
            zip.file('tile_' + String(i + 1).padStart(3, '0') + ext, dataUrl.split(',')[1], { base64: true });
        });

        zip.generateAsync({ type: 'blob' }).then(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'tiles_split.zip';
            a.click();
            URL.revokeObjectURL(url);
            self._showToast('已下载 ' + items.length + ' 张素材');
        });
    },

    _pushToMerge: function() {
        var self = this;
        var items = this.state.regions;
        if (items.length === 0) { this._showToast('请先检测区域', true); return; }

        var img = this.state.originalImage;
        var trim = this._q('#trimTransparent').checked;

        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        var srcCtx = srcCanvas.getContext('2d');
        if (this.state.processedImageData) {
            srcCtx.putImageData(this.state.processedImageData, 0, 0);
        } else {
            srcCtx.drawImage(img, 0, 0);
        }
        var srcData = srcCtx.getImageData(0, 0, img.width, img.height);

        var promises = items.map(function(region, i) {
            return new Promise(function(resolve) {
                var b = region.bounds;
                var tileCanvas = document.createElement('canvas');
                tileCanvas.width = b.w; tileCanvas.height = b.h;
                var tileCtx = tileCanvas.getContext('2d');
                var tileData = tileCtx.createImageData(b.w, b.h);
                var td = tileData.data;
                var sd = srcData.data;

                region.pixels.forEach(function(p) {
                    var sx = (p[1] * img.width + p[0]) * 4;
                    var dx = ((p[1] - b.y) * b.w + (p[0] - b.x)) * 4;
                    td[dx] = sd[sx];
                    td[dx + 1] = sd[sx + 1];
                    td[dx + 2] = sd[sx + 2];
                    td[dx + 3] = sd[sx + 3];
                });

                tileCtx.putImageData(tileData, 0, 0);
                var finalCanvas = trim ? self._trimCanvas(tileCanvas) : tileCanvas;
                var dataUrl = finalCanvas.toDataURL('image/png');
                var mergeImg = new Image();
                mergeImg.onload = function() {
                    resolve({ name: 'tile_' + String(i + 1).padStart(3, '0') + '.png', img: mergeImg, dataUrl: dataUrl });
                };
                mergeImg.src = dataUrl;
            });
        });

        Promise.all(promises).then(function(results) {
            self.state.mergeImages = self.state.mergeImages.concat(results);
            self._updateMergePreview();
            // 切换到合并面板
            self._switchMode('merge');
            self._showToast('已推送 ' + results.length + ' 张素材到合并页面');
        });
    },

    _trimCanvas: function(canvas) {
        var ctx = canvas.getContext('2d');
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var top = canvas.height, left = canvas.width, right = 0, bottom = 0;
        for (var y = 0; y < canvas.height; y++) {
            for (var x = 0; x < canvas.width; x++) {
                if (data[(y * canvas.width + x) * 4 + 3] > 0) {
                    if (y < top) top = y; if (y > bottom) bottom = y;
                    if (x < left) left = x; if (x > right) right = x;
                }
            }
        }
        if (top >= bottom || left >= right) return canvas;
        var w = right - left + 1, h = bottom - top + 1;
        var trimmed = document.createElement('canvas');
        trimmed.width = w; trimmed.height = h;
        trimmed.getContext('2d').drawImage(canvas, left, top, w, h, 0, 0, w, h);
        return trimmed;
    },

    // ========================================
    //   合并模式
    // ========================================

    _handleMergeFiles: function(files) {
        var self = this;
        var promises = Array.from(files).map(function(file) {
            return new Promise(function(resolve) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var img = new Image();
                    img.onload = function() {
                        resolve({ name: file.name, img: img, dataUrl: e.target.result });
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        });
        Promise.all(promises).then(function(results) {
            self.state.mergeImages = self.state.mergeImages.concat(results);
            self._updateMergePreview();
            self._showToast('已添加 ' + results.length + ' 张图片');
        });
    },

    _updateMergePreview: function() {
        var imgs = this.state.mergeImages;
        if (imgs.length === 0) {
            this._q('#ttMergeEmpty').style.display = 'block';
            this._q('#ttMergePreviewContainer').style.display = 'none';
            this._q('#ttMergeBtn').disabled = true;
            this._q('#ttMergeCount').textContent = '';
            return;
        }
        this._q('#ttMergeEmpty').style.display = 'none';
        this._q('#ttMergePreviewContainer').style.display = 'block';
        this._q('#ttMergeBtn').disabled = false;
        this._q('#ttMergeCount').textContent = '共 ' + imgs.length + ' 张素材';

        var cols = parseInt(this._q('#mergeCols').value);
        var padX = parseInt(this._q('#mergePadX').value);
        var padY = parseInt(this._q('#mergePadY').value);
        var padding = parseInt(this._q('#mergePadding').value);
        var grid = this._q('#ttMergeGrid');
        grid.style.gridTemplateColumns = 'repeat(' + Math.min(cols, imgs.length) + ', 80px)';
        grid.style.columnGap = padX + 'px';
        grid.style.rowGap = padY + 'px';
        grid.style.padding = padding + 'px';
        grid.innerHTML = '';
        var self = this;
        imgs.forEach(function(item, i) {
            var div = document.createElement('div');
            div.className = 'tt-merge-item';
            div.style.height = '80px';
            div.innerHTML =
                '<span class="tt-idx">' + (i + 1) + '</span>' +
                '<img src="' + item.dataUrl + '" title="' + item.name + '">' +
                '<button class="tt-del-btn" data-merge-del="' + i + '">\u00d7</button>';
            div.querySelector('.tt-del-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                self.state.mergeImages.splice(i, 1);
                self._updateMergePreview();
            });
            grid.appendChild(div);
        });
        this._q('#ttMergeBgColorGroup').style.display = this._q('#mergeBgTransparent').checked ? 'none' : 'block';
    },

    _clearMergeItems: function() {
        this.state.mergeImages = [];
        this._updateMergePreview();
    },

    _sortMergeItems: function(by) {
        if (by === 'name') {
            this.state.mergeImages.sort(function(a, b) { return a.name.localeCompare(b.name); });
        } else {
            this.state.mergeImages.sort(function(a, b) { return (b.img.width * b.img.height) - (a.img.width * a.img.height); });
        }
        this._updateMergePreview();
        this._showToast('已按' + (by === 'name' ? '名称' : '尺寸') + '排序');
    },

    _mergeAndDownload: function() {
        if (this.state.mergeImages.length === 0) return;
        var cols = parseInt(this._q('#mergeCols').value);
        var padX = parseInt(this._q('#mergePadX').value);
        var padY = parseInt(this._q('#mergePadY').value);
        var padding = parseInt(this._q('#mergePadding').value);
        var uniform = this._q('#mergeUniform').checked;
        var transparent = this._q('#mergeBgTransparent').checked;
        var bgColor = this._q('#mergeBgColor').value;
        var format = this._q('#mergeFormat').value;
        var mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        var ext = format === 'webp' ? '.webp' : '.png';
        var imgs = this.state.mergeImages;

        var cellW = 0, cellH = 0;
        if (uniform) imgs.forEach(function(item) { cellW = Math.max(cellW, item.img.width); cellH = Math.max(cellH, item.img.height); });

        var maxRowW = 0, totalH = 0, rowH = 0, rowW = 0, rowCount = 0;
        imgs.forEach(function(item, i) {
            var iw = uniform ? cellW : item.img.width, ih = uniform ? cellH : item.img.height;
            rowW += iw; rowH = Math.max(rowH, ih); rowCount++;
            if (rowCount === cols || i === imgs.length - 1) {
                maxRowW = Math.max(maxRowW, rowW + (rowCount - 1) * padX);
                totalH += rowH;
                if (i < imgs.length - 1) totalH += padY;
                rowW = 0; rowH = 0; rowCount = 0;
            }
        });
        var canvasW = maxRowW + padding * 2, canvasH = totalH + padding * 2;
        var canvas = document.createElement('canvas');
        canvas.width = canvasW; canvas.height = canvasH;
        var ctx = canvas.getContext('2d');
        if (!transparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvasW, canvasH); }

        var cx = padding, cy = padding, curRowH = 0, colIdx = 0;
        imgs.forEach(function(item, i) {
            var iw = uniform ? cellW : item.img.width, ih = uniform ? cellH : item.img.height;
            var ox = uniform ? cx + (cellW - item.img.width) / 2 : cx;
            var oy = uniform ? cy + (cellH - item.img.height) / 2 : cy;
            ctx.drawImage(item.img, ox, oy);
            curRowH = Math.max(curRowH, ih); cx += iw + padX; colIdx++;
            if (colIdx === cols) { cy += curRowH + padY; cx = padding; curRowH = 0; colIdx = 0; }
        });

        // Show result
        var resultCanvas = this._q('#ttMergeResultCanvas');
        resultCanvas.width = canvasW; resultCanvas.height = canvasH;
        resultCanvas.getContext('2d').drawImage(canvas, 0, 0);
        this._q('#ttMergeResultContainer').style.display = 'block';

        var dataUrl = canvas.toDataURL(mimeType, 0.95);
        var a = document.createElement('a');
        a.href = dataUrl; a.download = 'tilemap_merged' + ext; a.click();
        this._showToast('合并完成! (' + canvasW + '\u00d7' + canvasH + ')');
    }
};
