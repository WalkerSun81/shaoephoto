/**
 * 图像调整工具 v5.21 - 批量图像处理工具
 *
 * 核心工作流：
 *   上传素材 → 精灵检测 → 饱和度调整 → 输出图片
 */
var ImageAdjuster = {
    id: 'image-adjuster',
    name: '图像调整',

    REGION_COLORS: [
        '#e94560', '#00c853', '#ffab00', '#2979ff', '#ff4081',
        '#00e5ff', '#76ff03', '#ff6d00', '#d500f9', '#00bfa5'
    ],

    // ========================================
    //   State
    // ========================================

    _initState: function() {
        this.state = {
            imageList: [],
            activeImageIndex: -1,
            irBgColor: { r: 255, g: 255, b: 255 },
            irOutlineColor: { r: 0, g: 0, b: 0 },
            scale: 1,
            overlayVisible: true,
            canvasBgMode: 'checkerboard',
            irColorPickMode: null,
            // 饱和度调整
            batchSaturationEnabled: false,
            batchSaturationVal: 0,
            currentSaturationVal: 0,
            // 对比度调整
            batchContrastEnabled: false,
            batchContrastVal: 0,
            currentContrastVal: 0,
            // 亮度调整
            batchBrightnessEnabled: false,
            batchBrightnessVal: 0,
            currentBrightnessVal: 0,
            _saturationDragging: false,
            // 输出
            selectedDirHandle: null,
            exportFileMode: 'original', // 'original' | 'rename'
            exportNamePrefix: 'sprite',
            exportStartNum: 1,
            undoStackSize: 20,
            // 无限画布
            offsetX: 0, offsetY: 0,
            panStartX: 0, panStartY: 0,
            panStartOffsetX: 0, panStartOffsetY: 0,
            isPanning: false,
            // 变换模式（移动/缩放/旋转）
            transformMode: null,
            _isRotating: false,
            _rotateStartAngle: 0,
            _rotateCenter: null,
            _rotateInitBounds: null,
            _scaleFromCorner: null,
            transformDrag: false,
            transformStart: null,
            transformInitBounds: null,
            _dragPending: null,
            // 底图（背景参考图）
            bgRefImage: null,
            bgRefOpacity: 0.5,
            bgRefVisible: true,
            bgRefFileName: '',
            bgRefWorldX: 0,
            bgRefWorldY: 0,
            bgRefAdjusting: false,
            _bgRefDragStart: null
        };
    },

    _makeImageEntry: function(file, img, fileName) {
        return {
            file: file,
            fileName: fileName,
            originalImage: img,
            processedImageData: null,
            _originalImageData: null,
            canvasW: 0,
            canvasH: 0,
            regions: [],
            selectedRegion: -1,
            innerSelectedRegions: {},
            scale: 1,
            worldX: 0,
            worldY: 0,
            undoStack: [],
            overlayVisible: true,
            saturationBatch: 0,
            saturationCurrent: 0,
            contrastBatch: 0,
            contrastCurrent: 0,
            brightnessBatch: 0,
            brightnessCurrent: 0,
            edited: false
        };
    },

    _getCurrentEntry: function() {
        if (this.state.activeImageIndex < 0 || this.state.activeImageIndex >= this.state.imageList.length) return null;
        return this.state.imageList[this.state.activeImageIndex];
    },

    // ========================================
    //   Lifecycle
    // ========================================

    activate: function() {
        if (this._overlay) return;
        this._initState();
        this._createOverlay();
        this._loadExportLog();
        this._loadDirHandle();
    },

    deactivate: function() {
        this._destroy();
    },

    _destroy: function() {
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this.state = null;
    },

    // ========================================
    //   CSS
    // ========================================

    _getCSS: function() {
        return '' +
        '.lasso-active { background:#ffab00 !important; border-color:#ffab00 !important; color:#1a1a2e !important; font-weight:bold; }' +
        '.tt-slider-disabled { opacity:0.35; pointer-events:none; }' +
        '.tt-export-dlg-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:10000; display:flex; align-items:center; justify-content:center; }' +
        '.tt-export-dlg { background:var(--bg2); border:1px solid var(--border); border-radius:8px; width:680px; max-height:80vh; display:flex; flex-direction:column; box-shadow:0 8px 32px rgba(0,0,0,0.5); }' +
        '.tt-export-dlg-header { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--border); font-size:14px; font-weight:600; color:var(--accent); }' +
        '.tt-export-dlg-body { flex:1; overflow-y:auto; padding:16px; }' +
        '.tt-export-dlg-footer { display:flex; justify-content:flex-end; gap:8px; padding:12px 16px; border-top:1px solid var(--border); }' +
        '.tt-export-table { width:100%; border-collapse:collapse; font-size:11px; }' +
        '.tt-export-table th { text-align:left; padding:6px 8px; border-bottom:1px solid var(--border); color:var(--text2); font-weight:600; font-size:10px; text-transform:uppercase; }' +
        '.tt-export-table td { padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.03); vertical-align:middle; }' +
        '.tt-export-table input[type="text"] { width:100%; padding:2px 6px; background:var(--bg); border:1px solid var(--border); border-radius:3px; color:var(--text); font-size:11px; }' +
        '.tt-export-table input:focus { border-color:var(--accent); outline:none; }' +
        '.tt-export-table .tt-thumb-preview { width:36px; height:36px; object-fit:contain; border-radius:3px; background:repeating-conic-gradient(#222 0% 25%,#2a2a4a 0% 50%) 0 0 / 10px 10px; }' +
        '.tt-radio-row { display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; }' +
        '.tt-radio-row input[type="radio"] { accent-color:var(--accent); }' +
        '.tt-sat-label { display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--text2); margin-bottom:2px; }' +
        '.tt-sat-label .tt-sat-val { color:var(--accent); font-weight:600; min-width:32px; text-align:right; }' +
        '.tt-export-group-header td { padding:6px 8px; background:rgba(233,69,96,0.08); color:var(--accent); font-weight:600; font-size:11px; }' +
        '.tt-dragging { opacity:0.4; }' +
        '.tt-drag-over td { border-bottom:2px solid var(--accent) !important; }';
    },

    // ========================================
    //   UI Build
    // ========================================

    _createOverlay: function() {
        var self = this;
        var overlay = document.createElement('div');
        overlay.className = 'tt-overlay';
        overlay.id = 'tt-card';
        overlay.setAttribute('data-skill-id', 'image-adjuster');

        var styleEl = document.createElement('style');
        styleEl.textContent = this._getCSS();
        overlay.appendChild(styleEl);

        // Header
        var header = document.createElement('div');
        header.className = 'tt-header';
        header.innerHTML =
            '<div style="display:flex;align-items:center;width:100%;">' +
                '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
                    '<button class="tt-toggle-overlay-btn" data-action="goHome" title="返回首页"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>' +
                    '<button class="tt-toggle-overlay-btn active" data-action="toggleOverlay">轮廓线开关</button>' +
                    '<button class="tt-toggle-overlay-btn" data-action="undo" title="撤销上一步操作">↩ 撤销</button>' +
                '</div>' +
                '<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:12px;margin:0 16px;">' +
                    '<span id="ttHeaderInfo" style="font-size:12px;color:#888;white-space:nowrap;"></span>' +
                    '<div id="ttHeaderProgress" style="display:none;flex:1;max-width:300px;height:6px;background:#2a2a4a;border-radius:3px;overflow:hidden;">' +
                        '<div id="ttHeaderProgressBar" style="height:100%;width:0%;background:#00c853;border-radius:3px;transition:width 0.2s;"></div>' +
                    '</div>' +
                '</div>' +
                '<span style="font-size:16px;font-weight:bold;color:#eee;flex-shrink:0;">图像调整工具 v5.21</span>' +
            '</div>';
        overlay.appendChild(header);

        // App container
        var app = document.createElement('div');
        app.className = 'tt-app';
        app.innerHTML = this._buildSidebarHTML() + this._buildMainHTML();
        overlay.appendChild(app);

        // Toast
        var toast = document.createElement('div');
        toast.className = 'tt-toast';
        toast.id = 'ttToast';
        overlay.appendChild(toast);

        document.body.appendChild(overlay);
        this._overlay = overlay;
        this._toastEl = toast;

        this._headerInfo = overlay.querySelector('#ttHeaderInfo');
        this._headerProgress = overlay.querySelector('#ttHeaderProgress');
        this._headerProgressBar = overlay.querySelector('#ttHeaderProgressBar');
        this._mainCanvas = overlay.querySelector('#ttMainCanvas');
        this._mainCtx = this._mainCanvas.getContext('2d');
        this._overlayCanvas = overlay.querySelector('#ttOverlayCanvas');
        this._overlayCtx = this._overlayCanvas.getContext('2d');
        // 底图 canvas（背景参考图）— 最底层
        this._bgRefCanvas = document.createElement('canvas');
        this._bgRefCanvas.style.cssText = 'position:absolute;top:0;left:0;z-index:0;pointer-events:none;image-rendering:auto;';
        this._bgRefCtx = this._bgRefCanvas.getContext('2d');
        overlay.querySelector('#ttCanvasWrapper').appendChild(this._bgRefCanvas);
        // 网格 canvas（无限画布背景）
        this._gridCanvas = document.createElement('canvas');
        this._gridCanvas.style.cssText = 'position:absolute;top:0;left:0;z-index:0;pointer-events:none;';
        overlay.querySelector('#ttCanvasWrapper').appendChild(this._gridCanvas);

        this._bindEvents(overlay);

        // 恢复持久化 range 设置
        overlay.querySelectorAll('input[type="range"]').forEach(function(r) {
            if (r.id === 'batchSaturation' || r.id === 'currentSaturation') return;
            var savedVal = localStorage.getItem('vs5_pref_' + r.id);
            if (savedVal !== null) r.value = savedVal;
            var valEl = overlay.querySelector('#' + r.id + 'Val') || overlay.querySelector('[data-range-val="' + r.id + '"]');
            if (valEl) {
                valEl.textContent = r.value;
                r.addEventListener('input', function() {
                    valEl.textContent = this.value;
                    localStorage.setItem('vs5_pref_' + this.id, this.value);
                });
            }
        });
    },

    _buildSidebarHTML: function() {
        return '' +
        '<div class="tt-sidebar">' +
            '<!-- BGREF -->' +
            '<div class="tt-section" id="ttBgRefSection">' +
                '<div class="tt-step-title">底图（背景参考）</div>' +
                '<div class="tt-upload-zone" id="ttBgRefUploadZone">' +
                    '<div class="tt-icon">🗺️</div>' +
                    '<p>点击上传场景参考图</p>' +
                '</div>' +
                '<input type="file" id="ttBgRefFileInput" accept="image/*" style="display:none">' +
                '<div id="ttBgRefInfoSection" style="display:none">' +
                    '<img id="ttBgRefPreview" class="tt-bgref-preview">' +
                    '<div class="tt-bgref-info" id="ttBgRefFileInfo"></div>' +
                    '<div class="tt-input-group">' +
                        '<label>不透明度</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="bgRefOpacity" min="5" max="100" value="50">' +
                            '<span class="tt-range-val" id="bgRefOpacityVal">50%</span>' +
                        '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:6px;">' +
                        '<button class="tt-btn tt-btn-sm" data-action="toggleBgRef" id="ttToggleBgRefBtn">隐藏</button>' +
                        '<button class="tt-btn tt-btn-sm" data-action="adjustBgRef" id="ttAdjustBgRefBtn">调整位置</button>' +
                        '<button class="tt-btn tt-btn-sm tt-btn-danger" data-action="clearBgRef">清除</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<!-- UPLOAD -->' +
            '<div class="tt-section">' +
                '<div class="tt-step-title">上传素材</div>' +
                '<div class="tt-upload-zone" id="ttUploadZone">' +
                    '<div class="tt-icon">🖼️</div>' +
                    '<p>点击或拖拽上传素材图(支持多张)</p>' +
                '</div>' +
                '<input type="file" id="ttFileInput" accept="image/*" multiple style="display:none">' +
            '</div>' +
            '<!-- DETECT -->' +
            '<div class="tt-section" id="ttDetectSection" style="display:none">' +
                '<div class="tt-step-title">精灵检测</div>' +
                '<div class="tt-input-group">' +
                    '<label>检测灵敏度</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="detectSensitivity" min="5" max="100" value="32">' +
                        '<span class="tt-range-val" data-range-val="detectSensitivity">32</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>最小面积 (px)</label>' +
                    '<input type="number" id="minArea" value="50" min="1" max="10000">' +
                '</div>' +
                '<button class="tt-btn tt-btn-primary" data-action="smartDetect">智能检测</button>' +
            '</div>' +
            '<!-- SATURATION -->' +
            '<div class="tt-section" id="ttSaturationSection" style="display:none">' +
                '<div class="tt-step-title">饱和度调整</div>' +
                '<div class="tt-input-group">' +
                    '<label class="tt-checkbox-row" style="margin-bottom:4px;">' +
                        '<input type="checkbox" id="batchSaturationCheck"> 批量调整（全部精灵）' +
                    '</label>' +
                    '<div id="batchSaturationWrap" class="tt-slider-disabled">' +
                        '<label>批量饱和度</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="batchSaturation" min="-50" max="50" value="0" disabled>' +
                            '<span class="tt-range-val" id="batchSaturationVal">0</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">' +
                    '<label>当前精灵 <span id="currentSpriteLabel" style="color:var(--text2);font-size:10px;">(未选择)</span></label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="currentSaturation" min="-50" max="50" value="0">' +
                        '<span class="tt-range-val" id="currentSaturationVal">0</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<!-- CONTRAST -->' +
            '<div class="tt-section" id="ttContrastSection" style="display:none">' +
                '<div class="tt-step-title">对比度调整</div>' +
                '<div class="tt-input-group">' +
                    '<label class="tt-checkbox-row" style="margin-bottom:4px;">' +
                        '<input type="checkbox" id="batchContrastCheck"> 批量调整' +
                    '</label>' +
                    '<div id="batchContrastWrap" class="tt-slider-disabled">' +
                        '<label>批量对比度</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="batchContrast" min="-50" max="50" value="0" disabled>' +
                            '<span class="tt-range-val" id="batchContrastVal">0</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">' +
                    '<label>当前精灵 <span id="currentSpriteLabel2" style="color:var(--text2);font-size:10px;">(未选择)</span></label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="currentContrast" min="-50" max="50" value="0">' +
                        '<span class="tt-range-val" id="currentContrastVal">0</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<!-- BRIGHTNESS -->' +
            '<div class="tt-section" id="ttBrightnessSection" style="display:none">' +
                '<div class="tt-step-title">亮度调整</div>' +
                '<div class="tt-input-group">' +
                    '<label class="tt-checkbox-row" style="margin-bottom:4px;">' +
                        '<input type="checkbox" id="batchBrightnessCheck"> 批量调整' +
                    '</label>' +
                    '<div id="batchBrightnessWrap" class="tt-slider-disabled">' +
                        '<label>批量亮度</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="batchBrightness" min="-50" max="50" value="0" disabled>' +
                            '<span class="tt-range-val" id="batchBrightnessVal">0</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">' +
                    '<label>当前精灵 <span id="currentSpriteLabel3" style="color:var(--text2);font-size:10px;">(未选择)</span></label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="currentBrightness" min="-50" max="50" value="0">' +
                        '<span class="tt-range-val" id="currentBrightnessVal">0</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<!-- TRANSFORM -->' +
            '<div class="tt-section" id="ttTransformSection" style="display:none">' +
                '<div class="tt-step-title">变换工具</div>' +
                '<p style="font-size:11px;color:var(--text2);line-height:1.5;margin:0 0 8px 0;">进入后：<br>· 拖拽精灵主体 = 移动<br>· 右下角黄块 = 缩放<br>· 右上角红点 = 旋转</p>' +
                '<button class="tt-btn tt-btn-primary" data-action="toggleTransform" style="width:100%;">进入变换模式</button>' +
            '</div>' +
            '<!-- EXPORT -->' +
            '<div class="tt-section" id="ttExportSection" style="display:none">' +
                '<div class="tt-step-title">输出</div>' +
                '<button class="tt-btn tt-btn-primary" data-action="openExportDialog" style="margin-top:6px">📦 输出图片</button>' +
                '<div class="tt-progress-wrap" id="ttProgressWrap"><div class="tt-progress-bar" id="ttProgressBar"></div></div>' +
                '<div class="tt-progress-text" id="ttProgressText"></div>' +
            '</div>' +
        '</div>';
    },

    _buildMainHTML: function() {
        return '' +
        '<div class="tt-main" id="ttMainArea">' +
            '<div class="tt-empty-state" id="ttEmptyState">' +
                '<div class="tt-icon">🖼️</div>' +
                '<p>上传一张素材图开始调整</p>' +
            '</div>' +
            '<div class="tt-canvas-wrapper" id="ttCanvasWrapper" style="display:none">' +
                '<canvas id="ttMainCanvas"></canvas>' +
                '<canvas id="ttOverlayCanvas" class="tt-overlay-canvas"></canvas>' +
            '</div>' +
            '<div class="tt-right-panel" id="ttRightPanel" style="display:none">' +
                '<div class="tt-thumb-section" id="ttThumbnailSection">' +
                    '<div class="tt-rp-header"><span>图片列表 (<span id="ttThumbCount">0</span>张)</span></div>' +
                    '<div class="tt-thumb-list" id="ttThumbList"></div>' +
                '</div>' +
                '<div class="tt-log-panel" id="ttLogPanel" style="display:none;position:static;width:auto;border-left:none;flex-shrink:0;max-height:240px;">' +
                    '<div class="tt-log-header">' +
                        '<span>输出日志</span>' +
                        '<button data-action="clearLog">清除</button>' +
                    '</div>' +
                    '<div class="tt-log-list" id="ttLogList">' +
                        '<div class="tt-log-empty">暂无日志</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="tt-canvas-hint" id="ttCanvasHint" style="display:none">' +
                '滚轮: 缩放 &nbsp;|&nbsp; 右键/中键拖拽: 平移' +
            '</div>' +
        '</div>' +
        '';
    },

    // ========================================
    //   Export Dialog
    // ========================================

    _buildExportDialogHTML: function() {
        return '' +
        '<div class="tt-export-dlg-overlay" id="ttExportDlgOverlay">' +
            '<div class="tt-export-dlg">' +
                '<div class="tt-export-dlg-header">' +
                    '<span>📦 输出图片</span>' +
                    '<button data-action="closeExportDialog" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:16px;">✕</button>' +
                '</div>' +
                '<div class="tt-export-dlg-body">' +
                    '<!-- 保存位置 -->' +
                    '<div class="tt-section" style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border);">' +
                        '<div style="display:flex;align-items:center;gap:8px;">' +
                            '<button class="tt-btn tt-btn-sm" data-action="selectExportDir" style="width:auto;">📁 选择文件夹</button>' +
                            '<span id="exportDirPath" style="font-size:11px;color:#aaa;">未选择</span>' +
                        '</div>' +
                    '</div>' +
                    '<!-- 文件名规则 -->' +
                    '<div class="tt-section" style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border);">' +
                        '<div style="font-size:12px;font-weight:600;color:var(--accent);margin-bottom:8px;">文件名规则</div>' +
                        '<div class="tt-radio-row" style="margin-bottom:6px;">' +
                            '<input type="radio" name="exportFileMode" value="original" id="fmOriginal" checked>' +
                            '<label for="fmOriginal">保留原始文件名</label>' +
                        '</div>' +
                        '<div class="tt-radio-row" style="margin-bottom:6px;">' +
                            '<input type="radio" name="exportFileMode" value="rename" id="fmRename">' +
                            '<label for="fmRename">按规则重命名</label>' +
                        '</div>' +
                        '<div id="renameOptions" style="margin-left:24px;display:none;">' +
                            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                                '<div class="tt-input-group" style="width:140px;">' +
                                    '<label>文件名前缀</label>' +
                                    '<input type="text" id="exportNamePrefix" value="sprite">' +
                                '</div>' +
                                '<div class="tt-input-group" style="width:70px;">' +
                                    '<label>起始编号</label>' +
                                    '<input type="number" id="exportStartNum" value="1" min="1" max="9999">' +
                                '</div>' +
                                '<div class="tt-input-group" style="width:70px;">' +
                                    '<label>每组数量</label>' +
                                    '<input type="number" id="exportGroupSize" value="0" min="0" max="999">' +
                                '</div>' +
                                '<div class="tt-input-group" style="width:80px;">' +
                                    '<label>分组目录编号</label>' +
                                    '<input type="number" id="exportGroupId" value="0" min="0" max="99">' +
                                '</div>' +
                            '</div>' +
                            '<div style="font-size:10px;color:var(--text2);margin-top:4px;">每组数量0或1=不分组；分组目录编号0或1=不建子目录</div>' +
                        '</div>' +
                    '</div>' +
                    '<!-- 图片列表 -->' +
                    '<div>' +
                        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">' +
                            '<div style="font-size:12px;font-weight:600;color:var(--accent);">' +
                                '图片列表 (<span id="exportSpriteCount">0</span>)' +
                            '</div>' +
                            '<div style="display:flex;gap:6px;">' +
                                '<button class="tt-btn tt-btn-sm" data-action="exportSelectAll" style="width:auto;font-size:11px;">全选</button>' +
                                '<button class="tt-btn tt-btn-sm" data-action="exportSelectNone" style="width:auto;font-size:11px;">全不选</button>' +
                            '</div>' +
                        '</div>' +
                        '<table class="tt-export-table">' +
                            '<thead><tr>' +
                                '<th style="width:20px;"></th>' +
                                '<th style="width:28px;"></th>' +
                                '<th style="width:36px;">#</th>' +
                                '<th style="width:44px;">预览</th>' +
                                '<th style="width:60px;">尺寸</th>' +
                                '<th>文件名</th>' +
                            '</tr></thead>' +
                            '<tbody id="exportTableBody"></tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-export-dlg-footer">' +
                    '<button class="tt-btn tt-btn-secondary" data-action="closeExportDialog">取消</button>' +
                    '<button class="tt-btn tt-btn-primary" id="exportSaveBtn" disabled>保存</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    },

    // ========================================
    //   Events
    // ========================================

    _bindEvents: function(overlay) {
        var self = this;

        overlay.addEventListener('mousedown', function(e) { e.stopPropagation(); });
        overlay.addEventListener('wheel', function(e) { e.stopPropagation(); }, { passive: false });

        // 文件上传
        var uploadZone = overlay.querySelector('#ttUploadZone');
        var fileInput = overlay.querySelector('#ttFileInput');
        uploadZone.addEventListener('click', function() { fileInput.click(); });
        uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('dragover'); });
        uploadZone.addEventListener('dragleave', function() { this.classList.remove('dragover'); });
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault(); this.classList.remove('dragover');
            for (var fi = 0; fi < e.dataTransfer.files.length; fi++) {
                self._loadImage(e.dataTransfer.files[fi]);
            }
        });
        fileInput.addEventListener('change', function() {
            for (var fi = 0; fi < this.files.length; fi++) {
                self._loadImage(this.files[fi]);
            }
        });

        // 底图（背景参考）上传
        var bgRefUploadZone = overlay.querySelector('#ttBgRefUploadZone');
        var bgRefFileInput = overlay.querySelector('#ttBgRefFileInput');
        if (bgRefUploadZone && bgRefFileInput) {
            bgRefUploadZone.addEventListener('click', function() { bgRefFileInput.click(); });
            bgRefUploadZone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('dragover'); });
            bgRefUploadZone.addEventListener('dragleave', function() { this.classList.remove('dragover'); });
            bgRefUploadZone.addEventListener('drop', function(e) {
                e.preventDefault(); this.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) self._loadBgRefImage(e.dataTransfer.files[0]);
            });
            bgRefFileInput.addEventListener('change', function() {
                if (this.files.length > 0) self._loadBgRefImage(this.files[0]);
            });
        }

        // 底图不透明度滑块
        var bgRefOpacitySlider = overlay.querySelector('#bgRefOpacity');
        if (bgRefOpacitySlider) {
            bgRefOpacitySlider.addEventListener('input', function() {
                var val = parseInt(this.value) / 100;
                self.state.bgRefOpacity = val;
                var valEl = overlay.querySelector('#bgRefOpacityVal');
                if (valEl) valEl.textContent = Math.round(val * 100) + '%';
                self._drawBgRef();
            });
        }

        // Action buttons
        overlay.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            switch (action) {
                case 'toggleOverlay': self._toggleOverlay(); break;
                case 'undo': self._undo(); break;
                case 'smartDetect': self._smartDetect(); break;
                case 'openExportDialog': self._openExportDialog(); break;
                case 'undoSaturation': self._undoSaturationCurrent(); break;
                case 'resetSaturation': self._resetAllSaturation(); break;
                case 'toggleTransform': self._toggleTransform(); break;
                case 'clearLog': self._clearLog(); break;
                case 'toggleBgRef': self._toggleBgRef(); break;
                case 'adjustBgRef': self._adjustBgRef(); break;
                case 'goHome': window.location.href = '../../index.html'; break;
                case 'clearBgRef': self._clearBgRef(); break;
            }
        });

        // 饱和度批处理复选框
        var batchCheck = overlay.querySelector('#batchSaturationCheck');
        if (batchCheck) {
            batchCheck.addEventListener('change', function() {
                self.state.batchSaturationEnabled = this.checked;
                var wrap = overlay.querySelector('#batchSaturationWrap');
                var slider = overlay.querySelector('#batchSaturation');
                if (wrap) wrap.className = this.checked ? '' : 'tt-slider-disabled';
                if (slider) slider.disabled = !this.checked;
                if (!this.checked && self.state.batchSaturationVal !== 0) {
                    self.state.batchSaturationVal = 0;
                    slider.value = 0;
                    var valEl = overlay.querySelector('#batchSaturationVal');
                    if (valEl) valEl.textContent = '0';
                    self._applyBatchToAll(0);
                }
            });
        }

        // 饱和度滑块
        var batchSatSlider = overlay.querySelector('#batchSaturation');
        var curSatSlider = overlay.querySelector('#currentSaturation');
        if (batchSatSlider) {
            batchSatSlider.addEventListener('input', function() {
                var val = parseInt(this.value);
                self.state.batchSaturationVal = val;
                var valEl = overlay.querySelector('#batchSaturationVal');
                if (valEl) valEl.textContent = val > 0 ? '+' + val : String(val);
                self._applyBatchToAll(val);
            });
        }
        if (curSatSlider) {
            curSatSlider.addEventListener('input', function() {
                var val = parseInt(this.value);
                self.state.currentSaturationVal = val;
                var valEl = overlay.querySelector('#currentSaturationVal');
                if (valEl) valEl.textContent = val > 0 ? '+' + val : String(val);
                self._refreshCurrentImage();
            });
        }

        // 对比度批处理复选框
        var batchCtrCheck = overlay.querySelector('#batchContrastCheck');
        if (batchCtrCheck) {
            batchCtrCheck.addEventListener('change', function() {
                self.state.batchContrastEnabled = this.checked;
                var wrap = overlay.querySelector('#batchContrastWrap');
                var slider = overlay.querySelector('#batchContrast');
                if (wrap) wrap.className = this.checked ? '' : 'tt-slider-disabled';
                if (slider) slider.disabled = !this.checked;
                if (!this.checked && self.state.batchContrastVal !== 0) {
                    self.state.batchContrastVal = 0;
                    slider.value = 0;
                    var valEl = overlay.querySelector('#batchContrastVal');
                    if (valEl) valEl.textContent = '0';
                    self._applyBatchToAll(0, 'contrast');
                }
            });
        }
        var batchCtrSlider = overlay.querySelector('#batchContrast');
        var curCtrSlider = overlay.querySelector('#currentContrast');
        if (batchCtrSlider) {
            batchCtrSlider.addEventListener('input', function() {
                var val = parseInt(this.value);
                self.state.batchContrastVal = val;
                var valEl = overlay.querySelector('#batchContrastVal');
                if (valEl) valEl.textContent = val > 0 ? '+' + val : String(val);
                self._applyBatchToAll(val, 'contrast');
            });
        }
        if (curCtrSlider) {
            curCtrSlider.addEventListener('input', function() {
                var val = parseInt(this.value);
                self.state.currentContrastVal = val;
                var valEl = overlay.querySelector('#currentContrastVal');
                if (valEl) valEl.textContent = val > 0 ? '+' + val : String(val);
                self._refreshCurrentImage();
            });
        }

        // 亮度批处理复选框
        var batchBriCheck = overlay.querySelector('#batchBrightnessCheck');
        if (batchBriCheck) {
            batchBriCheck.addEventListener('change', function() {
                self.state.batchBrightnessEnabled = this.checked;
                var wrap = overlay.querySelector('#batchBrightnessWrap');
                var slider = overlay.querySelector('#batchBrightness');
                if (wrap) wrap.className = this.checked ? '' : 'tt-slider-disabled';
                if (slider) slider.disabled = !this.checked;
                if (!this.checked && self.state.batchBrightnessVal !== 0) {
                    self.state.batchBrightnessVal = 0;
                    slider.value = 0;
                    var valEl = overlay.querySelector('#batchBrightnessVal');
                    if (valEl) valEl.textContent = '0';
                    self._applyBatchToAll(0, 'brightness');
                }
            });
        }
        var batchBriSlider = overlay.querySelector('#batchBrightness');
        var curBriSlider = overlay.querySelector('#currentBrightness');
        if (batchBriSlider) {
            batchBriSlider.addEventListener('input', function() {
                var val = parseInt(this.value);
                self.state.batchBrightnessVal = val;
                var valEl = overlay.querySelector('#batchBrightnessVal');
                if (valEl) valEl.textContent = val > 0 ? '+' + val : String(val);
                self._applyBatchToAll(val, 'brightness');
            });
        }
        if (curBriSlider) {
            curBriSlider.addEventListener('input', function() {
                var val = parseInt(this.value);
                self.state.currentBrightnessVal = val;
                var valEl = overlay.querySelector('#currentBrightnessVal');
                if (valEl) valEl.textContent = val > 0 ? '+' + val : String(val);
                self._refreshCurrentImage();
            });
        }

        // Canvas events
        this._overlayCanvas.addEventListener('mousedown', function(e) {
            self._onMouseDown(e);
            // 饱和度滑块记录拖动开始
            self.state._saturationDragging = false;
        });
        this._overlayCanvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        document.addEventListener('mousemove', function(e) { self._onMouseMove(e); });
        document.addEventListener('mouseup', function(e) {
            self._onMouseUp(e);
            // 保存饱和度调整的撤销快照
            if (self.state._saturationDragging) {
                self.state._saturationDragging = false;
            }
        });

        // Wheel zoom
        var wrapper = overlay.querySelector('#ttCanvasWrapper');
        wrapper.addEventListener('wheel', function(e) {
            e.preventDefault();
            self._zoomCanvas(e.deltaY > 0 ? 0.92 : 1.08, e);
        }, { passive: false });

        // Keyboard
        document.addEventListener('keydown', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'Escape') { self._destroy(); return; }
            if ((e.key === '=' || e.key === '+') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault(); self._zoomCanvas(1.15, null);
            }
            if ((e.key === '-' || e.key === '_') && (e.ctrlKey || e.metaKey)) {
                e.preventDefault(); self._zoomCanvas(0.92, null);
            }
        });

        // Paste
        document.addEventListener('paste', function(e) {
            var items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') === 0) {
                    self._loadImage(items[i].getAsFile());
                    break;
                }
            }
        });

        this._onResize = function() {
            if (self._getCurrentEntry()) {
                self._fitImageToView();
            } else if (self.state.bgRefImage) {
                self._fitBgRefToView();
            }
        };
        window.addEventListener('resize', this._onResize);
    },

    // ========================================
    //   Image Loading
    // ========================================

    _loadImage: function(file) {
        var self = this;
        if (!file || !file.type.match(/image\//)) { this._showToast('请选择图片文件', true); return; }
        var fileName = file.name.replace(/\.[^.]+$/, '');
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var entry = self._makeImageEntry(file, img, fileName);
                self.state.imageList.push(entry);
                self.state.activeImageIndex = self.state.imageList.length - 1;
                var empty = self._q('#ttEmptyState');
                if (empty) empty.style.display = 'none';
                self._activateImage(self.state.activeImageIndex);
                self._updateThumbnailListUI();
                self._showToast('已加载: ' + file.name);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _loadBgRefImage: function(file) {
        var self = this;
        if (!file || !file.type.match(/image\//)) { this._showToast('请选择图片文件', true); return; }
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                self.state.bgRefImage = img;
                self.state.bgRefFileName = file.name;
                self.state.bgRefVisible = true;
                // 确保 canvas wrapper 可见
                var wrapper = self._q('#ttCanvasWrapper');
                if (wrapper && wrapper.style.display === 'none') {
                    wrapper.style.display = 'block';
                    var empty = self._q('#ttEmptyState');
                    if (empty) empty.style.display = 'none';
                    var hint = self._q('#ttCanvasHint');
                    if (hint) hint.style.display = 'block';
                }
                // 如果没有精灵素材，以底图为基准适配视图
                if (self.state.imageList.length === 0) {
                    self._fitBgRefToView();
                }
                self._updateBgRefSidebar();
                self._drawBgRef();
                self._showToast('已加载底图: ' + file.name);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _updateBgRefSidebar: function() {
        var infoSection = this._q('#ttBgRefInfoSection');
        var uploadZone = this._q('#ttBgRefUploadZone');
        var previewEl = this._q('#ttBgRefPreview');
        var infoEl = this._q('#ttBgRefFileInfo');
        var opacitySlider = this._q('#bgRefOpacity');
        var opacityVal = this._q('#bgRefOpacityVal');
        var toggleBtn = this._q('#ttToggleBgRefBtn');
        if (this.state.bgRefImage) {
            if (uploadZone) uploadZone.style.display = 'none';
            if (infoSection) infoSection.style.display = 'block';
            if (previewEl) previewEl.src = this.state.bgRefImage.src;
            var img = this.state.bgRefImage;
            if (infoEl) infoEl.textContent = this.state.bgRefFileName + ' (' + img.width + '\u00d7' + img.height + ')';
            if (opacitySlider) opacitySlider.value = Math.round(this.state.bgRefOpacity * 100);
            if (opacityVal) opacityVal.textContent = Math.round(this.state.bgRefOpacity * 100) + '%';
            if (toggleBtn) toggleBtn.textContent = this.state.bgRefVisible ? '隐藏' : '显示';
        } else {
            if (uploadZone) uploadZone.style.display = '';
            if (infoSection) infoSection.style.display = 'none';
        }
    },

    _fitBgRefToView: function() {
        var img = this.state.bgRefImage;
        if (!img) return;
        var wrapper = this._q('#ttCanvasWrapper');
        if (!wrapper) return;
        var w = wrapper.clientWidth, h = wrapper.clientHeight;
        if (w <= 0 || h <= 0) return;
        var margin = 50;
        var s = Math.min((w - margin * 2) / img.width, (h - margin * 2) / img.height, 1);
        s = Math.max(0.1, s);
        this.state.scale = s;
        this.state.offsetX = Math.round((w - img.width * s) / 2);
        this.state.offsetY = Math.round((h - img.height * s) / 2);
        this._resizeCanvases();
    },

    _toggleBgRef: function() {
        this.state.bgRefVisible = !this.state.bgRefVisible;
        var btn = this._q('#ttToggleBgRefBtn');
        if (btn) btn.textContent = this.state.bgRefVisible ? '隐藏' : '显示';
        this._drawBgRef();
        this._showToast(this.state.bgRefVisible ? '底图已显示' : '底图已隐藏');
    },

    _adjustBgRef: function() {
        if (!this.state.bgRefImage) { this._showToast('请先上传底图', true); return; }
        this.state.bgRefAdjusting = !this.state.bgRefAdjusting;
        var btn = this._q('#ttAdjustBgRefBtn');
        if (btn) {
            btn.textContent = this.state.bgRefAdjusting ? '完成调整' : '调整位置';
            if (this.state.bgRefAdjusting) btn.classList.add('tt-btn-primary');
            else btn.classList.remove('tt-btn-primary');
        }
        if (this.state.bgRefAdjusting) {
            this._overlayCanvas.style.cursor = 'move';
            this._showToast('拖拽画布空白区域可移动底图位置');
        } else {
            this._overlayCanvas.style.cursor = 'crosshair';
        }
        this._drawBgRef();
    },

    _clearBgRef: function() {
        this.state.bgRefImage = null;
        this.state.bgRefFileName = '';
        this.state.bgRefVisible = true;
        this.state.bgRefOpacity = 0.5;
        this.state.bgRefWorldX = 0;
        this.state.bgRefWorldY = 0;
        this.state.bgRefAdjusting = false;
        this.state._bgRefDragStart = null;
        var adjustBtn = this._q('#ttAdjustBgRefBtn');
        if (adjustBtn) { adjustBtn.textContent = '调整位置'; adjustBtn.classList.remove('tt-btn-primary'); }
        this._overlayCanvas.style.cursor = 'crosshair';
        var opacitySlider = this._q('#bgRefOpacity');
        var opacityVal = this._q('#bgRefOpacityVal');
        if (opacitySlider) opacitySlider.value = 50;
        if (opacityVal) opacityVal.textContent = '50%';
        var fileInput = this._q('#ttBgRefFileInput');
        if (fileInput) fileInput.value = '';
        this._updateBgRefSidebar();
        this._drawBgRef();
        // 如果没有精灵素材则隐藏 canvas
        if (this.state.imageList.length === 0) {
            var wrapper = this._q('#ttCanvasWrapper');
            if (wrapper) wrapper.style.display = 'none';
            var empty = this._q('#ttEmptyState');
            if (empty) empty.style.display = 'block';
        }
        this._showToast('底图已清除');
    },

    _activateImage: function(index) {
        if (index < 0 || index >= this.state.imageList.length) return;
        this.state.activeImageIndex = index;
        var entry = this.state.imageList[index];

        var wrapper = this._q('#ttCanvasWrapper');
        var hint = this._q('#ttCanvasHint');
        if (wrapper) wrapper.style.display = 'block';
        if (hint) hint.style.display = 'block';
        this._q('#ttDetectSection').style.display = 'block';
        this._q('#ttSaturationSection').style.display = 'block';
        this._q('#ttContrastSection').style.display = 'block';
        this._q('#ttBrightnessSection').style.display = 'block';
        this._q('#ttTransformSection').style.display = 'block';
        this._q('#ttExportSection').style.display = 'block';
        var rPanel = this._q('#ttRightPanel');
        if (rPanel) rPanel.style.display = 'flex';

        // 恢复该图片的饱和度滑块值
        this._syncSaturationUI(entry);

        // 画布状态（缩放/偏移）全局共享，切换图片时不重置
        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._updateThumbnailListUI();
    },

    _syncSaturationUI: function(entry) {
        if (!entry) entry = this._getCurrentEntry();
        if (!entry) return;

        // 饱和度
        var cs = this._q('#currentSaturation');
        var cv = this._q('#currentSaturationVal');
        if (cs) { cs.value = entry.saturationCurrent; this.state.currentSaturationVal = entry.saturationCurrent; }
        if (cv) cv.textContent = entry.saturationCurrent > 0 ? '+' + entry.saturationCurrent : String(entry.saturationCurrent);

        // 对比度
        var ctrS = this._q('#currentContrast');
        var ctrV = this._q('#currentContrastVal');
        if (ctrS) { ctrS.value = entry.contrastCurrent; this.state.currentContrastVal = entry.contrastCurrent; }
        if (ctrV) ctrV.textContent = entry.contrastCurrent > 0 ? '+' + entry.contrastCurrent : String(entry.contrastCurrent);

        // 亮度
        var briS = this._q('#currentBrightness');
        var briV = this._q('#currentBrightnessVal');
        if (briS) { briS.value = entry.brightnessCurrent; this.state.currentBrightnessVal = entry.brightnessCurrent; }
        if (briV) briV.textContent = entry.brightnessCurrent > 0 ? '+' + entry.brightnessCurrent : String(entry.brightnessCurrent);
    },

    _updateThumbnailListUI: function() {
        var container = this._q('#ttThumbList');
        var countEl = this._q('#ttThumbCount');
        var list = this.state.imageList;
        var rPanel = this._q('#ttRightPanel');
        if (list.length === 0) { if (rPanel) rPanel.style.display = 'none'; return; }
        if (rPanel) rPanel.style.display = 'flex';
        if (countEl) countEl.textContent = list.length;
        container.innerHTML = '';
        var sorted = list.slice().sort(function(a, b) { return (a.fileName || '').localeCompare(b.fileName || ''); });
        var self = this;
        for (var i = 0; i < sorted.length; i++) {
            (function(idx, entry) {
                var div = document.createElement('div');
                var actualIdx = self.state.imageList.indexOf(entry);
                div.className = 'tt-thumb-item' + (actualIdx === self.state.activeImageIndex ? ' active' : '');
                var c = document.createElement('canvas');
                c.width = 32; c.height = 32;
                c.getContext('2d').drawImage(entry.originalImage, 0, 0, 32, 32);
                var dims = (entry.originalImage ? entry.originalImage.width + '\u00d7' + entry.originalImage.height : '');
                div.innerHTML = '<img src="' + c.toDataURL() + '" class="tt-thumb-img">' +
                    '<span class="tt-thumb-name">' + (entry.fileName || '') + '</span>' +
                    (entry.edited ? '<span class="tt-edited-dot" title="已编辑"></span>' : '') +
                    '<span class="tt-thumb-size">' + dims + '</span>' +
                    '<span class="tt-thumb-del" data-idx="' + actualIdx + '">x</span>';
                div.addEventListener('click', function(e) {
                    if (e.target.classList.contains('tt-thumb-del')) return;
                    var ei = self.state.imageList.indexOf(entry);
                    if (ei >= 0) self._activateImage(ei);
                });
                container.appendChild(div);
            })(i, sorted[i]);
        }
        container.querySelectorAll('.tt-thumb-del').forEach(function(el) {
            el.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(el.getAttribute('data-idx'));
                self._removeImage(idx);
            });
        });
    },

    _removeImage: function(index) {
        if (index < 0 || index >= this.state.imageList.length) return;
        this.state.imageList.splice(index, 1);
        if (this.state.imageList.length === 0) {
            this.state.activeImageIndex = -1;
            this._q('#ttDetectSection').style.display = 'none';
            this._q('#ttSaturationSection').style.display = 'none';
            this._q('#ttContrastSection').style.display = 'none';
            this._q('#ttBrightnessSection').style.display = 'none';
            this._q('#ttExportSection').style.display = 'none';
            // 如果有底图则保留 canvas 可见
            if (this.state.bgRefImage) {
                var wrapper = this._q('#ttCanvasWrapper');
                if (wrapper) wrapper.style.display = 'block';
                var hint = this._q('#ttCanvasHint');
                if (hint) hint.style.display = 'block';
                this._fitBgRefToView();
            } else {
                var wrapper = this._q('#ttCanvasWrapper');
                if (wrapper) wrapper.style.display = 'none';
                var empty = this._q('#ttEmptyState');
                if (empty) empty.style.display = 'block';
            }
            this._updateThumbnailListUI();
            return;
        }
        if (index <= this.state.activeImageIndex) {
            this.state.activeImageIndex = Math.max(0, this.state.activeImageIndex - 1);
        }
        this._activateImage(this.state.activeImageIndex);
        this._updateThumbnailListUI();
    },

    // ========================================
    //   Canvas
    // ========================================

    _fitImageToView: function() {
        var entry = this._getCurrentEntry();
        if (!entry) return;
        var img = entry.originalImage;
        if (!img) return;
        var wrapper = this._q('#ttCanvasWrapper');
        if (!wrapper) return;
        var w = wrapper.clientWidth, h = wrapper.clientHeight;
        if (w <= 0 || h <= 0) return;
        var margin = 50;
        var s = Math.min((w - margin * 2) / img.width, (h - margin * 2) / img.height, 1);
        s = Math.max(0.1, s);
        this.state.scale = s;
        entry.scale = s;
        // 图像置于世界原点，相机偏移使其居中于视口
        entry.worldX = 0;
        entry.worldY = 0;
        this.state.offsetX = Math.round((w - img.width * s) / 2);
        this.state.offsetY = Math.round((h - img.height * s) / 2);
        this._resizeCanvases();
    },

    _resizeCanvases: function() {
        var wrapper = this._q('#ttCanvasWrapper');
        if (!wrapper) return;
        var w = wrapper.clientWidth;
        var h = wrapper.clientHeight;
        this._mainCanvas.width = w;
        this._mainCanvas.height = h;
        this._overlayCanvas.width = w;
        this._overlayCanvas.height = h;
        if (this._gridCanvas) { this._gridCanvas.width = w; this._gridCanvas.height = h; }
        if (this._bgRefCanvas) { this._bgRefCanvas.width = w; this._bgRefCanvas.height = h; }
        this._drawBgRef();
        this._drawGrid();
        this._drawMain();
        this._drawOverlay();
    },

    _zoomCanvas: function(factor, e) {
        var entry = this._getCurrentEntry(); if (!entry) return;
        var img = entry.originalImage;
        if (!img) return;
        var oldScale = this.state.scale;
        var newScale = Math.max(0.05, Math.min(8, oldScale * factor));
        if (newScale === oldScale) return;
        var wrapper = this._q('#ttCanvasWrapper');
        var rect = wrapper.getBoundingClientRect();
        if (e) {
            var sx = (e.clientX - rect.left);
            var sy = (e.clientY - rect.top);
        } else {
            var sx = wrapper.clientWidth / 2;
            var sy = wrapper.clientHeight / 2;
        }
        // 保持焦点世界坐标不变
        var worldX = (sx - this.state.offsetX) / oldScale;
        var worldY = (sy - this.state.offsetY) / oldScale;
        this.state.scale = newScale;
        this.state.offsetX = sx - worldX * newScale;
        this.state.offsetY = sy - worldY * newScale;
        this._resizeCanvases();
    },

    // ========================================
    //   Infinite Canvas
    // ========================================

    _screenToWorld: function(screenX, screenY) {
        var rect = this._overlayCanvas.getBoundingClientRect();
        return {
            x: (screenX - rect.left - this.state.offsetX) / this.state.scale,
            y: (screenY - rect.top - this.state.offsetY) / this.state.scale
        };
    },

    _worldToScreen: function(worldX, worldY) {
        var rect = this._overlayCanvas.getBoundingClientRect();
        return {
            x: worldX * this.state.scale + this.state.offsetX + rect.left,
            y: worldY * this.state.scale + this.state.offsetY + rect.top
        };
    },

    _drawBgRef: function() {
        if (!this._bgRefCanvas || !this._bgRefCtx) return;
        var w = this._bgRefCanvas.width, h = this._bgRefCanvas.height;
        this._bgRefCtx.clearRect(0, 0, w, h);
        if (!this.state.bgRefImage || !this.state.bgRefVisible) return;
        var img = this.state.bgRefImage;
        var s = this.state.scale;
        var dx = this.state.offsetX + this.state.bgRefWorldX * s;
        var dy = this.state.offsetY + this.state.bgRefWorldY * s;
        var sw = Math.round(img.width * s);
        var sh = Math.round(img.height * s);
        this._bgRefCtx.globalAlpha = this.state.bgRefOpacity;
        this._bgRefCtx.imageSmoothingEnabled = true;
        this._bgRefCtx.drawImage(img, dx, dy, sw, sh);
        this._bgRefCtx.globalAlpha = 1;
        // 调整模式指示
        if (this.state.bgRefAdjusting) {
            this._bgRefCtx.strokeStyle = '#2979ff';
            this._bgRefCtx.lineWidth = 2;
            this._bgRefCtx.setLineDash([6, 3]);
            this._bgRefCtx.strokeRect(dx, dy, sw, sh);
            this._bgRefCtx.setLineDash([]);
        }
    },

    _drawGrid: function() {
        if (!this._gridCanvas) return;
        var w = this._gridCanvas.width, h = this._gridCanvas.height;
        var ctx = this._gridCanvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        var s = this.state.scale;
        var GRID_SMALL = 50, GRID_BIG = 250;
        var sg = GRID_SMALL * s, bg = GRID_BIG * s;
        if (sg < 4) return;

        // 小网格
        if (sg > 8) {
            ctx.strokeStyle = 'rgba(255,220,180,0.025)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            var sx = this.state.offsetX % sg, sy = this.state.offsetY % sg;
            for (var x = sx; x < w; x += sg) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
            for (var y = sy; y < h; y += sg) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
            ctx.stroke();
        }

        // 大网格
        if (bg > 15) {
            ctx.strokeStyle = 'rgba(255,220,180,0.05)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            var bsx = this.state.offsetX % bg, bsy = this.state.offsetY % bg;
            for (var x = bsx; x < w; x += bg) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
            for (var y = bsy; y < h; y += bg) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
            ctx.stroke();
        }

        // 原点标记
        var ox = this.state.offsetX, oy = this.state.offsetY;
        if (ox > -20 && ox < w + 20 && oy > -20 && oy < h + 20) {
            ctx.strokeStyle = 'rgba(240,160,80,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ox - 8, oy); ctx.lineTo(ox + 8, oy);
            ctx.moveTo(ox, oy - 8); ctx.lineTo(ox, oy + 8);
            ctx.stroke();
        }
    },

    // ========================================
    //   Drawing
    // ========================================

    _drawMain: function() {
        var entry = this._getCurrentEntry(); if (!entry) return;
        var img = entry.originalImage;
        if (!img) return;
        this._mainCtx.clearRect(0, 0, this._mainCanvas.width, this._mainCanvas.height);
        this._mainCtx.imageSmoothingEnabled = true;
        var s = this.state.scale;
        var dx = entry.worldX * s + this.state.offsetX;
        var dy = entry.worldY * s + this.state.offsetY;
        if (entry.processedImageData) {
            var cw = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || img.width);
            var ch = entry.processedImageData ? entry.processedImageData.height : (entry.canvasH || img.height);
            var tmpC = document.createElement('canvas');
            tmpC.width = cw;
            tmpC.height = ch;
            tmpC.getContext('2d').putImageData(entry.processedImageData, 0, 0);
            this._mainCtx.drawImage(tmpC, dx, dy, Math.round(cw * s), Math.round(ch * s));
        } else {
            var sw = Math.round(img.width * s);
            var sh = Math.round(img.height * s);
            this._mainCtx.drawImage(img, dx, dy, sw, sh);
        }
    },

    _drawOverlay: function() {
        var entry = this._getCurrentEntry(); if (!entry) { this._clearCanvases(); return; }
        // 用 putImageData 做最底层清除
        var cw = this._overlayCanvas.width, ch = this._overlayCanvas.height;
        if (cw > 0 && ch > 0) {
            if (!this._emptyOverlayData || this._emptyOverlayData.width !== cw || this._emptyOverlayData.height !== ch) {
                this._emptyOverlayData = this._overlayCtx.createImageData(cw, ch);
            }
            this._overlayCtx.putImageData(this._emptyOverlayData, 0, 0);
        }
        this._overlayCtx.globalAlpha = 1;
        this._overlayCtx.globalCompositeOperation = 'source-over';
        if (!entry.overlayVisible || !entry.regions.length) return;

        var regions = entry.regions;
        var s = this.state.scale;
        var dx = entry.worldX * s + this.state.offsetX;
        var dy = entry.worldY * s + this.state.offsetY;
        var ctx = this._overlayCtx;
        var self = this;

        var img = entry.originalImage;
        var w = entry.processedImageData ? entry.processedImageData.width : (img ? img.width : 0);
        var h = entry.processedImageData ? entry.processedImageData.height : (img ? img.height : 0);
        if (w === 0) return;

        var offC = document.createElement('canvas');
        offC.width = w; offC.height = h;
        var offCtx = offC.getContext('2d');
        var imgData = offCtx.createImageData(w, h);
        var d = imgData.data;

        regions.forEach(function(region, ri) {
            var color = self.REGION_COLORS[ri % self.REGION_COLORS.length];
            var isSelected = ri === entry.selectedRegion;
            var pixelSet = region.pixelSet;

            region.pixels.forEach(function(p) {
                var isEdge = false;
                for (var dy2 = -1; dy2 <= 1 && !isEdge; dy2++) {
                    for (var dx2 = -1; dx2 <= 1 && !isEdge; dx2++) {
                        if (dx2 === 0 && dy2 === 0) continue;
                        var nx = p[0] + dx2, ny = p[1] + dy2;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h || !pixelSet[ny * w + nx]) {
                            isEdge = true;
                        }
                    }
                }
                if (isEdge) {
                    var idx = (p[1] * w + p[0]) * 4;
                    d[idx] = isSelected ? 255 : (parseInt(color.slice(1,3),16) || 0);
                    d[idx + 1] = isSelected ? 255 : (parseInt(color.slice(3,5),16) || 0);
                    d[idx + 2] = isSelected ? 255 : (parseInt(color.slice(5,7),16) || 0);
                    d[idx + 3] = isSelected ? 220 : 160;
                }
            });
        });

        offCtx.putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        var sw = Math.round(w * s);
        var sh = Math.round(h * s);
        ctx.drawImage(offC, dx, dy, sw, sh);

        // 选中精灵的边框 + 编号
        if (entry.selectedRegion >= 0 && entry.selectedRegion < regions.length) {
            var sr = regions[entry.selectedRegion];
            var b = sr.bounds;
            var bx = dx + b.x * s, by = dy + b.y * s, bw = b.w * s, bh = b.h * s;
            ctx.strokeStyle = '#ffab00';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(bx - 6, by - 6, bw + 12, bh + 12);
            ctx.setLineDash([]);
            ctx.font = 'bold 11px sans-serif';
            var lbl1 = '#' + (entry.selectedRegion + 1) + ' ' + b.w + '\u00d7' + b.h + 'px ' + sr.area + 'px';
            var tw1 = ctx.measureText(lbl1).width;
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(bx - 4, by - 19, tw1 + 8, 14);
            ctx.fillStyle = '#ffab00';
            ctx.fillText(lbl1, bx, by - 8);

            // 变换模式手柄
            if (this.state.transformMode === 'move') {
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
                var cc = this._computeSpriteCentroid(sr);
                if (cc) {
                    var ccx = dx + cc.cx * s, ccy = dy + cc.cy * s;
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

    _clearCanvases: function() {
        if (this._mainCtx) this._mainCtx.clearRect(0, 0, this._mainCanvas.width, this._mainCanvas.height);
        if (this._overlayCtx) this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
    },

    _toggleOverlay: function() {
        var entry = this._getCurrentEntry(); if (!entry) return;
        entry.overlayVisible = !entry.overlayVisible;
        var btn = this._q('[data-action="toggleOverlay"]');
        if (btn) btn.classList.toggle('active', entry.overlayVisible);
        this._drawOverlay();
        this._showToast(entry.overlayVisible ? '轮廓线已显示' : '轮廓线已隐藏');
    },

    _toggleTransform: function() {
        var entry = this._getCurrentEntry();
        if (!entry || entry.regions.length === 0) { this._showToast('请先检测精灵区域', true); return; }
        this.state.transformMode = this.state.transformMode === 'move' ? null : 'move';
        var btn = this._q('[data-action="toggleTransform"]');
        if (btn) {
            btn.textContent = this.state.transformMode === 'move' ? '退出变换模式' : '进入变换模式';
            if (this.state.transformMode === 'move') {
                btn.classList.add('tt-btn-primary');
            } else {
                btn.classList.remove('tt-btn-primary');
            }
        }
        this._drawOverlay();
        this._showToast(this.state.transformMode === 'move' ? '已进入变换模式' : '已退出变换模式');
    },

    // ========================================
    //   Smart Detect
    // ========================================

    _smartDetect: function() {
        var list = this.state.imageList;
        if (list.length === 0) { this._showToast('请先上传图片', true); return; }
        this._showToast('正在批量分析 ' + list.length + ' 张图片...');
        var self = this;
        setTimeout(function() {
            try {
                var totalDetected = 0;
                for (var ei = 0; ei < list.length; ei++) {
                    var entry = list[ei];
                    if (!entry.originalImage) continue;
                    if (entry.regions.length > 0) { totalDetected += entry.regions.length; continue; }
                    var result = self._runBFS(entry);
                    if (result && result.regions.length > 0) {
                        entry.regions = result.regions;
                        entry.selectedRegion = result.regions.length > 0 ? 0 : -1;
                        entry.overlayVisible = true;
                        if (!entry.processedImageData) {
                            var tmpC = document.createElement('canvas');
                            tmpC.width = entry.originalImage.width;
                            tmpC.height = entry.originalImage.height;
                            tmpC.getContext('2d').drawImage(entry.originalImage, 0, 0);
                            entry.processedImageData = tmpC.getContext('2d').getImageData(0, 0, entry.originalImage.width, entry.originalImage.height);
                            entry.canvasW = entry.originalImage.width;
                            entry.canvasH = entry.originalImage.height;
                        }
                        totalDetected += result.regions.length;
                    }
                }
                // 激活有检测结果的图片
                var cur = self._getCurrentEntry();
                if (!cur || cur.regions.length === 0) {
                    for (var si = 0; si < list.length; si++) {
                        if (list[si].regions.length > 0) {
                            self._activateImage(si);
                            break;
                        }
                    }
                } else {
                    self._activateImage(self.state.activeImageIndex);
                }
                self._showToast('检测完成，共 ' + totalDetected + ' 个精灵');
            } catch (e) {
                console.error(e);
                self._showToast('检测出错: ' + e.message, true);
            }
        }, 50);
    },

    _runBFS: function(optEntry) {
        var entry = optEntry || this._getCurrentEntry(); if (!entry) return [];
        var img = entry.originalImage;
        var w = img.width, h = img.height;
        var sensitivity = parseInt(this._q('#detectSensitivity').value) || 32;
        var minArea = parseInt(this._q('#minArea').value) || 50;

        var tmpC = document.createElement('canvas');
        tmpC.width = w; tmpC.height = h;
        var tmpCtx = tmpC.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        var imageData = tmpCtx.getImageData(0, 0, w, h);
        var data = imageData.data;

        // 检测是否有透明像素
        var hasTransparentPixels = false;
        for (var ti = 3; ti < data.length; ti += 4) {
            if (data[ti] < 1) { hasTransparentPixels = true; break; }
        }

        var bgColor = this.state.irBgColor;
        var tol = sensitivity * 2.5;

        var mask = new Uint8Array(w * h);
        for (var i = 0; i < w * h; i++) {
            var pi = i * 4;
            var r = data[pi], g = data[pi + 1], b = data[pi + 2], a = data[pi + 3];
            if (hasTransparentPixels && a < 1) {
                mask[i] = 0; continue;
            }
            if (hasTransparentPixels) {
                mask[i] = 1;
            } else {
                var dr = r - bgColor.r, dg = g - bgColor.g, db = b - bgColor.b;
                var dist = Math.sqrt(dr * dr + dg * dg + db * db);
                mask[i] = dist > tol ? 1 : 0;
            }
        }

        // 标记背景
        for (var j = 0; j < w * h; j++) { if (mask[j] === 0) mask[j] = 3; }
        var bgQueue = []; var bgHead = 0;
        for (var x = 0; x < w; x++) {
            if (mask[x] === 3) { mask[x] = 0; bgQueue.push(x, 0); }
            if (mask[(h-1) * w + x] === 3) { mask[(h-1) * w + x] = 0; bgQueue.push((h-1) * w + x, 0); }
        }
        for (var y = 0; y < h; y++) {
            if (mask[y * w] === 3) { mask[y * w] = 0; bgQueue.push(y * w, 0); }
            if (mask[y * w + w - 1] === 3) { mask[y * w + w - 1] = 0; bgQueue.push(y * w + w - 1, 0); }
        }
        var bgDirs = [[-1,0],[1,0],[0,-1],[0,1]];
        while (bgHead < bgQueue.length) {
            var ci = bgQueue[bgHead++];
            var cDist = bgQueue[bgHead++];
            if (cDist >= 50) continue;
            var cx = ci % w, cy = (ci / w) | 0;
            for (var bd = 0; bd < 4; bd++) {
                var nx = cx + bgDirs[bd][0], ny = cy + bgDirs[bd][1];
                if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                var ni = ny * w + nx;
                if (mask[ni] === 3) { mask[ni] = 0; bgQueue.push(ni, cDist + 1); }
            }
        }

        // 膨胀 + 腐蚀
        var dilatePx = 1;
        var closedMask = new Uint8Array(w * h);
        var DIRS8 = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
        for (var yi = 0; yi < h; yi++) {
            for (var xi = 0; xi < w; xi++) {
                var cur = yi * w + xi;
                if (mask[cur] === 1) {
                    closedMask[cur] = 1;
                    for (var dd = 0; dd < 8; dd++) {
                        var dnx = xi + DIRS8[dd][0], dny = yi + DIRS8[dd][1];
                        if (dnx >= 0 && dnx < w && dny >= 0 && dny < h && mask[dny * w + dnx] === 0) {
                            closedMask[cur] = 0; break;
                        }
                    }
                }
            }
        }
        for (var di = 0; di < dilatePx; di++) {
            var dilated = new Uint8Array(closedMask);
            for (var yi2 = 0; yi2 < h; yi2++) {
                for (var xi2 = 0; xi2 < w; xi2++) {
                    if (closedMask[yi2 * w + xi2]) continue;
                    for (var dd2 = 0; dd2 < 8; dd2++) {
                        var dnx2 = xi2 + DIRS8[dd2][0], dny2 = yi2 + DIRS8[dd2][1];
                        if (dnx2 >= 0 && dnx2 < w && dny2 >= 0 && dny2 < h && closedMask[dny2 * w + dnx2]) {
                            dilated[yi2 * w + xi2] = 1; break;
                        }
                    }
                }
            }
            closedMask = dilated;
        }
        for (var ei = 0; ei < dilatePx; ei++) {
            var eroded = new Uint8Array(closedMask);
            for (var yi3 = 0; yi3 < h; yi3++) {
                for (var xi3 = 0; xi3 < w; xi3++) {
                    if (!closedMask[yi3 * w + xi3]) continue;
                    for (var dd3 = 0; dd3 < 8; dd3++) {
                        var dnx3 = xi3 + DIRS8[dd3][0], dny3 = yi3 + DIRS8[dd3][1];
                        if (dnx3 < 0 || dnx3 >= w || dny3 < 0 || dny3 >= h || !closedMask[dny3 * w + dnx3]) {
                            eroded[yi3 * w + xi3] = 0; break;
                        }
                    }
                }
            }
            closedMask = eroded;
        }

        // BFS 提取精灵
        var visited = new Uint8Array(w * h);
        var regions = [];
        var regionId = 0;

        for (var yi4 = 0; yi4 < h; yi4++) {
            for (var xi4 = 0; xi4 < w; xi4++) {
                var startIdx = yi4 * w + xi4;
                if (closedMask[startIdx] !== 1 || visited[startIdx]) continue;

                var regionPixels = [];
                var queue = [startIdx]; var head = 0;
                visited[startIdx] = 1;

                while (head < queue.length) {
                    var curIdx = queue[head++];
                    regionPixels.push(curIdx);
                    var cx2 = curIdx % w, cy2 = (curIdx / w) | 0;
                    for (var d8 = 0; d8 < 8; d8++) {
                        var nnx = cx2 + DIRS8[d8][0], nny = cy2 + DIRS8[d8][1];
                        if (nnx < 0 || nnx >= w || nny < 0 || nny >= h) continue;
                        var nni = nny * w + nnx;
                        if (closedMask[nni] === 1 && !visited[nni]) {
                            visited[nni] = 1;
                            queue.push(nni);
                        }
                    }
                }

                var area = regionPixels.length;
                if (area < minArea) continue;

                var pixelCoords = regionPixels.map(function(pi) { return [pi % w, (pi / w) | 0]; });
                var pixelSet = new Uint8Array(w * h);
                pixelCoords.forEach(function(p) { pixelSet[p[1] * w + p[0]] = 1; });

                var eMinX = w, eMaxX = 0, eMinY = h, eMaxY = 0;
                pixelCoords.forEach(function(p) {
                    if (p[0] < eMinX) eMinX = p[0];
                    if (p[0] > eMaxX) eMaxX = p[0];
                    if (p[1] < eMinY) eMinY = p[1];
                    if (p[1] > eMaxY) eMaxY = p[1];
                });

                regions.push({
                    id: regionId++,
                    pixels: pixelCoords,
                    pixelSet: pixelSet,
                    bounds: { x: eMinX, y: eMinY, w: eMaxX - eMinX + 1, h: eMaxY - eMinY + 1 },
                    area: area,
                    color: this.REGION_COLORS[regions.length % this.REGION_COLORS.length]
                });
            }
        }

        return { regions: regions };
    },

    // ========================================
    //   Saturation Adjustment
    // ========================================

    _initOriginalImageData: function(entry) {
        if (!entry) entry = this._getCurrentEntry();
        if (!entry || !entry.originalImage) return null;
        if (entry._originalImageData) return entry._originalImageData;
        var tmpC = document.createElement('canvas');
        tmpC.width = entry.originalImage.width;
        tmpC.height = entry.originalImage.height;
        tmpC.getContext('2d').drawImage(entry.originalImage, 0, 0);
        entry._originalImageData = tmpC.getContext('2d').getImageData(0, 0, tmpC.width, tmpC.height);
        return entry._originalImageData;
    },

    _hsvToRgb: function(h, s, v) {
        h /= 360;
        s /= 100;
        v /= 100;
        var i = Math.floor(h * 6);
        var f = h * 6 - i;
        var p = v * (1 - s);
        var q = v * (1 - f * s);
        var t = v * (1 - (1 - f) * s);
        var r, g, b;
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    },

    _adjustSaturationInRegion: function(imageData, region, delta) {
        if (delta === 0 || !region || !region.pixelSet) return;
        var data = imageData.data;
        var w = imageData.width;
        var self = this;

        region.pixels.forEach(function(p) {
            var idx = (p[1] * w + p[0]) * 4;
            if (data[idx + 3] < 1) return;
            var r = data[idx], g = data[idx + 1], b = data[idx + 2];
            var hsv = self._rgbToHsv(r, g, b);
            var newS = Math.max(0, Math.min(100, hsv.s + delta));
            var rgb = self._hsvToRgb(hsv.h, newS, hsv.v);
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
        });
    },

    _adjustSaturationFull: function(imageData, delta) {
        if (delta === 0) return;
        var data = imageData.data;
        var total = imageData.width * imageData.height;
        var self = this;
        for (var i = 0; i < total; i++) {
            var idx = i * 4;
            if (data[idx + 3] < 1) continue;
            var r = data[idx], g = data[idx + 1], b = data[idx + 2];
            var hsv = self._rgbToHsv(r, g, b);
            var newS = Math.max(0, Math.min(100, hsv.s + delta));
            var rgb = self._hsvToRgb(hsv.h, newS, hsv.v);
            data[idx] = rgb.r;
            data[idx + 1] = rgb.g;
            data[idx + 2] = rgb.b;
        }
    },

    _clamp: function(v, min, max) { return v < min ? min : (v > max ? max : v); },

    _adjustContrastInRegion: function(imageData, region, delta) {
        if (delta === 0 || !region || !region.pixelSet) return;
        var data = imageData.data;
        var w = imageData.width;
        var factor = (100 + delta) / 100;
        var self = this;
        region.pixels.forEach(function(p) {
            var idx = (p[1] * w + p[0]) * 4;
            if (data[idx + 3] < 1) return;
            data[idx] = self._clamp(Math.round((data[idx] - 128) * factor + 128), 0, 255);
            data[idx + 1] = self._clamp(Math.round((data[idx + 1] - 128) * factor + 128), 0, 255);
            data[idx + 2] = self._clamp(Math.round((data[idx + 2] - 128) * factor + 128), 0, 255);
        });
    },

    _adjustContrastFull: function(imageData, delta) {
        if (delta === 0) return;
        var data = imageData.data;
        var total = imageData.width * imageData.height;
        var factor = (100 + delta) / 100;
        var self = this;
        for (var i = 0; i < total; i++) {
            var idx = i * 4;
            if (data[idx + 3] < 1) continue;
            data[idx] = self._clamp(Math.round((data[idx] - 128) * factor + 128), 0, 255);
            data[idx + 1] = self._clamp(Math.round((data[idx + 1] - 128) * factor + 128), 0, 255);
            data[idx + 2] = self._clamp(Math.round((data[idx + 2] - 128) * factor + 128), 0, 255);
        }
    },

    _adjustBrightnessInRegion: function(imageData, region, delta) {
        if (delta === 0 || !region || !region.pixelSet) return;
        var data = imageData.data;
        var w = imageData.width;
        var self = this;
        region.pixels.forEach(function(p) {
            var idx = (p[1] * w + p[0]) * 4;
            if (data[idx + 3] < 1) return;
            data[idx] = self._clamp(data[idx] + delta, 0, 255);
            data[idx + 1] = self._clamp(data[idx + 1] + delta, 0, 255);
            data[idx + 2] = self._clamp(data[idx + 2] + delta, 0, 255);
        });
    },

    _adjustBrightnessFull: function(imageData, delta) {
        if (delta === 0) return;
        var data = imageData.data;
        var total = imageData.width * imageData.height;
        var self = this;
        for (var i = 0; i < total; i++) {
            var idx = i * 4;
            if (data[idx + 3] < 1) continue;
            data[idx] = self._clamp(data[idx] + delta, 0, 255);
            data[idx + 1] = self._clamp(data[idx + 1] + delta, 0, 255);
            data[idx + 2] = self._clamp(data[idx + 2] + delta, 0, 255);
        }
    },

    _applyAdjustToEntry: function(dstData, entry, batchSat, batchCtr, batchBri, curSat, curCtr, curBri) {
        var hasRegions = entry.regions.length > 0;
        var self = this;

        var apply = function(fnRegion, fnFull, val) {
            if (val === 0) return;
            if (hasRegions) {
                for (var ri = 0; ri < entry.regions.length; ri++) {
                    fnRegion.call(self, dstData, entry.regions[ri], val);
                }
            } else {
                fnFull.call(self, dstData, val);
            }
        };

        // 顺序：亮度 → 对比度 → 饱和度
        apply(self._adjustBrightnessInRegion, self._adjustBrightnessFull, batchBri);
        apply(self._adjustContrastInRegion, self._adjustContrastFull, batchCtr);
        apply(self._adjustSaturationInRegion, self._adjustSaturationFull, batchSat);

        // 当前精灵叠加（顺序一致）
        apply(self._adjustBrightnessInRegion, self._adjustBrightnessFull, curBri);
        apply(self._adjustContrastInRegion, self._adjustContrastFull, curCtr);
        apply(self._adjustSaturationInRegion, self._adjustSaturationFull, curSat);
    },

    // 批量调整：作用到图片列表里的所有图片
    _applyBatchToAll: function(delta, type) {
        var list = this.state.imageList;
        for (var ei = 0; ei < list.length; ei++) {
            var entry = list[ei];
            this._initOriginalImageData(entry);
            if (!entry._originalImageData) continue;

            var cw = entry.canvasW || entry._originalImageData.width;
            var ch = entry.canvasH || entry._originalImageData.height;
            var dstData = new ImageData(cw, ch);

            // 复制原图数据
            var srcData = entry._originalImageData.data;
            var sw = entry._originalImageData.width;
            var sh = entry._originalImageData.height;
            for (var y = 0; y < sh; y++) {
                for (var x = 0; x < sw; x++) {
                    var si = (y * sw + x) * 4;
                    var di = (y * cw + x) * 4;
                    dstData.data[di] = srcData[si];
                    dstData.data[di + 1] = srcData[si + 1];
                    dstData.data[di + 2] = srcData[si + 2];
                    dstData.data[di + 3] = srcData[si + 3];
                }
            }

            // 更新对应类型的 batch 值
            if (type === 'saturation') entry.saturationBatch = delta;
            else if (type === 'contrast') entry.contrastBatch = delta;
            else if (type === 'brightness') entry.brightnessBatch = delta;

            this._applyAdjustToEntry(dstData, entry,
                entry.saturationBatch, entry.contrastBatch, entry.brightnessBatch,
                entry.saturationCurrent, entry.contrastCurrent, entry.brightnessCurrent);
            entry.processedImageData = dstData;
            entry.canvasW = cw;
            entry.canvasH = ch;
            entry.edited = true;
        }

        this._drawMain();
        this._drawOverlay();
    },

    // 重新计算当前图片（全部 batch + current 叠加）
    _refreshCurrentImage: function() {
        var entry = this._getCurrentEntry();
        if (!entry) return;

        this._initOriginalImageData(entry);
        if (!entry._originalImageData) return;

        var cw = entry.canvasW || entry._originalImageData.width;
        var ch = entry.canvasH || entry._originalImageData.height;
        var dstData = new ImageData(cw, ch);

        // 从原图复制像素（仅在原图范围内）
        var srcData = entry._originalImageData.data;
        var sw = entry._originalImageData.width;
        var sh = entry._originalImageData.height;
        for (var y = 0; y < sh; y++) {
            for (var x = 0; x < sw; x++) {
                var si = (y * sw + x) * 4;
                var di = (y * cw + x) * 4;
                dstData.data[di] = srcData[si];
                dstData.data[di + 1] = srcData[si + 1];
                dstData.data[di + 2] = srcData[si + 2];
                dstData.data[di + 3] = srcData[si + 3];
            }
        }
        // 如果画布已扩展，从当前 processedImageData 复制扩展区域的像素
        if (entry.processedImageData && (cw > sw || ch > sh)) {
            var curData = entry.processedImageData.data;
            var curW = entry.processedImageData.width;
            for (var y = 0; y < ch; y++) {
                for (var x = 0; x < cw; x++) {
                    if (x < sw && y < sh) continue; // 原图范围已复制
                    if (x < curW && y < entry.processedImageData.height) {
                        var ci = (y * curW + x) * 4;
                        var di = (y * cw + x) * 4;
                        dstData.data[di] = curData[ci];
                        dstData.data[di + 1] = curData[ci + 1];
                        dstData.data[di + 2] = curData[ci + 2];
                        dstData.data[di + 3] = curData[ci + 3];
                    }
                }
            }
        }

        entry.saturationCurrent = this.state.currentSaturationVal;
        entry.contrastCurrent = this.state.currentContrastVal;
        entry.brightnessCurrent = this.state.currentBrightnessVal;

        this._applyAdjustToEntry(dstData, entry,
            entry.saturationBatch, entry.contrastBatch, entry.brightnessBatch,
            this.state.currentSaturationVal, this.state.currentContrastVal, this.state.currentBrightnessVal);
        entry.processedImageData = dstData;
        entry.canvasW = cw;
        entry.canvasH = ch;
        if (entry.saturationBatch !== 0 || entry.contrastBatch !== 0 || entry.brightnessBatch !== 0 ||
            this.state.currentSaturationVal !== 0 || this.state.currentContrastVal !== 0 || this.state.currentBrightnessVal !== 0) {
            entry.edited = true;
        }
        this._drawMain();
        this._drawOverlay();
    },

    _undoSaturationCurrent: function() {
        var entry = this._getCurrentEntry();
        if (!entry) return;

        this.state.currentSaturationVal = 0;
        entry.saturationCurrent = 0;
        var sl = this._q('#currentSaturation');
        var vl = this._q('#currentSaturationVal');
        if (sl) sl.value = 0;
        if (vl) vl.textContent = '0';
        this._refreshCurrentImage();
        this._showToast('已重置当前精灵饱和度');
    },

    _resetAllSaturation: function() {
        this.state.batchSaturationVal = 0;
        this.state.currentSaturationVal = 0;

        var slIds = ['batchSaturation', 'currentSaturation'];
        var vlIds = ['batchSaturationVal', 'currentSaturationVal'];
        for (var si = 0; si < slIds.length; si++) {
            var el = this._q('#' + slIds[si]);
            if (el && el.type === 'range') el.value = 0;
        }
        for (var vi = 0; vi < vlIds.length; vi++) {
            var el = this._q('#' + vlIds[vi]);
            if (el) el.textContent = '0';
        }

        // 全部图片仅重置饱和度，保留对比度和亮度
        for (var ei = 0; ei < this.state.imageList.length; ei++) {
            var entry = this.state.imageList[ei];
            entry.saturationBatch = 0;
            entry.saturationCurrent = 0;
            var srcData = this._initOriginalImageData(entry);
            if (srcData) {
                var cw = entry.canvasW || srcData.width;
                var ch = entry.canvasH || srcData.height;
                var dst = new ImageData(cw, ch);
                var sw = srcData.width, sh = srcData.height;
                for (var y = 0; y < sh; y++) {
                    for (var x = 0; x < sw; x++) {
                        var si = (y * sw + x) * 4;
                        var di = (y * cw + x) * 4;
                        dst.data[di] = srcData.data[si];
                        dst.data[di + 1] = srcData.data[si + 1];
                        dst.data[di + 2] = srcData.data[si + 2];
                        dst.data[di + 3] = srcData.data[si + 3];
                    }
                }
                this._applyAdjustToEntry(dst, entry,
                    0, entry.contrastBatch, entry.brightnessBatch,
                    0, entry.contrastCurrent, entry.brightnessCurrent);
                entry.processedImageData = dst;
                entry.canvasW = cw;
                entry.canvasH = ch;
            }
        }

        this._drawMain();
        this._drawOverlay();
        this._showToast('已重置全部调整');
    },

    // ========================================
    //   Mouse Interactions
    // ========================================

    _onMouseDown: function(e) {
        // 底图调整模式：左键拖拽移动底图（优先处理，无需精灵）
        if (this.state.bgRefAdjusting && e.button === 0) {
            this.state._bgRefDragStart = {
                x: e.clientX,
                y: e.clientY,
                worldX: this.state.bgRefWorldX,
                worldY: this.state.bgRefWorldY
            };
            this._overlayCanvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        var entry = this._getCurrentEntry(); if (!entry) return;

        // 双击防护：第二次点击距上次 < 400ms 且 < 6px 时标记为双击
        var now = Date.now();
        var clickDist = this._lastClickTime ? Math.sqrt((e.clientX - this._lastClickX) * (e.clientX - this._lastClickX) + (e.clientY - this._lastClickY) * (e.clientY - this._lastClickY)) : Infinity;
        var isDblClick = (now - this._lastClickTime < 400 && clickDist < 6);
        this._lastClickTime = now;
        this._lastClickX = e.clientX;
        this._lastClickY = e.clientY;

        // 右键/中键/空格+左键 = 画布平移
        if (e.button === 1 || e.button === 2 || (e.button === 0 && (e.altKey || e.metaKey))) {
            e.preventDefault();
            this.state.isPanning = true;
            this.state.panStartX = e.clientX;
            this.state.panStartY = e.clientY;
            this.state.panStartOffsetX = this.state.offsetX;
            this.state.panStartOffsetY = this.state.offsetY;
            this._overlayCanvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button === 2) {
            e.preventDefault();
            return;
        }

        var s = this.state.scale;
        var worldPos = this._screenToWorld(e.clientX, e.clientY);
        var wx = worldPos.x, wy = worldPos.y;
        var ix = wx - entry.worldX;  // 图像内坐标
        var iy = wy - entry.worldY;

        // Transform: 变换模式（拖拽移动，右下角缩放，右上角旋转）
        // 双击时不进入变换模式，避免双击产生误操作（残影）
        if (!isDblClick && this.state.transformMode === 'move' && entry.selectedRegion >= 0) {
            var srT = entry.regions[entry.selectedRegion];
            if (srT) {
                var imgScrX = entry.worldX * s + this.state.offsetX;
                var imgScrY = entry.worldY * s + this.state.offsetY;
                var bxT = imgScrX + srT.bounds.x * s, byT = imgScrY + srT.bounds.y * s;
                var bwT = srT.bounds.w * s, bhT = srT.bounds.h * s;
                var scrX = wx * s + this.state.offsetX, scrY = wy * s + this.state.offsetY;
                // 先检测右上角红色旋转手柄（8px 对称命中区，避免侵入精灵主体）
                if (scrX >= bxT + bwT - 8 && scrX <= bxT + bwT + 8 && scrY >= byT - 8 && scrY <= byT + 8) {
                    this.state._isRotating = true;
                    this.state._rotateCenter = this._computeSpriteCentroid(srT);
                    if (this.state._rotateCenter) {
                        this.state._rotateStartAngle = Math.atan2(
                            iy - this.state._rotateCenter.cy,
                            ix - this.state._rotateCenter.cx
                        );
                    }
                    this.state._rotateInitBounds = { x: srT.bounds.x, y: srT.bounds.y, w: srT.bounds.w, h: srT.bounds.h };
                    this._overlayCanvas.style.cursor = 'grabbing';
                    return;
                }
                // 再检测右下角黄色缩放手柄（8px 对称命中区，避免侵入精灵主体）
                if (scrX >= bxT + bwT - 8 && scrX <= bxT + bwT + 8 && scrY >= byT + bhT - 8 && scrY <= byT + bhT + 8) {
                    this.state._scaleFromCorner = 'br';
                    this.state.transformDrag = true;
                    this.state.transformStart = { imgX: ix, imgY: iy };
                    this.state.transformInitBounds = { x: srT.bounds.x, y: srT.bounds.y, w: srT.bounds.w, h: srT.bounds.h };
                    this._overlayCanvas.style.cursor = 'grabbing';
                    return;
                }
                // 再检测精灵主体（移动）—— 精确像素检测，避免误抓重叠精灵
                var oxT = Math.floor(ix), oyT = Math.floor(iy);
                if (oxT >= srT.bounds.x && oxT < srT.bounds.x + srT.bounds.w &&
                    oyT >= srT.bounds.y && oyT < srT.bounds.y + srT.bounds.h) {
                    var psT = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || entry.originalImage.width);
                    if (srT.pixelSet) {
                        var pxIdxT = oyT * psT + oxT;
                        if (pxIdxT >= 0 && pxIdxT < srT.pixelSet.length && !srT.pixelSet[pxIdxT]) {
                            // 不在当前精灵像素上，不拦截，让选取逻辑切换精灵
                        } else {
                            this.state._dragPending = 'move';
                            this.state._dragStartX = e.clientX;
                            this.state._dragStartY = e.clientY;
                            this.state._dragStartImgX = ix;
                            this.state._dragStartImgY = iy;
                            this._overlayCanvas.style.cursor = 'pointer';
                            return;
                        }
                    } else {
                        this.state._dragPending = 'move';
                        this.state._dragStartX = e.clientX;
                        this.state._dragStartY = e.clientY;
                        this.state._dragStartImgX = ix;
                        this.state._dragStartImgY = iy;
                        this._overlayCanvas.style.cursor = 'pointer';
                        return;
                    }
                }
            }
        }

        // 选取精灵
        var found = -1;
        var pxStride = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || entry.originalImage.width);
        for (var i = entry.regions.length - 1; i >= 0; i--) {
            var r = entry.regions[i];
            if (Math.floor(ix) >= r.bounds.x && Math.floor(ix) < r.bounds.x + r.bounds.w &&
                Math.floor(iy) >= r.bounds.y && Math.floor(iy) < r.bounds.y + r.bounds.h) {
                var psi = Math.floor(iy) * pxStride + Math.floor(ix);
                if (r.pixelSet && psi < r.pixelSet.length && r.pixelSet[psi]) {
                    found = i; break;
                }
            }
        }

        if (found >= 0 && found !== entry.selectedRegion) {
            entry.saturationCurrent = this.state.currentSaturationVal;
        }

        entry.selectedRegion = found;
        this._drawOverlay();
        this._updateRegionListUI();

        var label = this._q('#currentSpriteLabel');
        if (label) {
            label.textContent = found >= 0 ? '# ' + (found + 1) : '(未选择)';
        }

        if (found >= 0) {
            this.state.currentSaturationVal = entry.saturationCurrent || 0;
            this.state.currentContrastVal = entry.contrastCurrent || 0;
            this.state.currentBrightnessVal = entry.brightnessCurrent || 0;

            var pairs = [
                ['currentSaturation','currentSaturationVal'],
                ['currentContrast','currentContrastVal'],
                ['currentBrightness','currentBrightnessVal']
            ];
            var vals = [this.state.currentSaturationVal, this.state.currentContrastVal, this.state.currentBrightnessVal];
            for (var pi = 0; pi < pairs.length; pi++) {
                var sl = this._q('#' + pairs[pi][0]);
                var vl = this._q('#' + pairs[pi][1]);
                if (sl) sl.value = vals[pi];
                if (vl) vl.textContent = vals[pi] > 0 ? '+' + vals[pi] : String(vals[pi]);
            }
            // 只在精灵切换时重建图像，避免重复点击时从原始图像恢复而覆盖变换后的数据
            if (found !== entry.selectedRegion) {
                this._refreshCurrentImage();
            }
        }
    },

    _onMouseMove: function(e) {
        // 底图调整拖拽
        if (this.state._bgRefDragStart) {
            var s = this.state.scale;
            this.state.bgRefWorldX = this.state._bgRefDragStart.worldX + (e.clientX - this.state._bgRefDragStart.x) / s;
            this.state.bgRefWorldY = this.state._bgRefDragStart.worldY + (e.clientY - this.state._bgRefDragStart.y) / s;
            this._drawBgRef();
            return;
        }

        var entry = this._getCurrentEntry(); if (!entry) return;

        // 延迟激活拖拽：需移动 ≥ 3px 才真正开始变换
        if (this.state._dragPending === 'move') {
            var dragDist = Math.sqrt((e.clientX - this.state._dragStartX) * (e.clientX - this.state._dragStartX) + (e.clientY - this.state._dragStartY) * (e.clientY - this.state._dragStartY));
            if (dragDist >= 3) {
                this.state.transformDrag = true;
                this.state.transformStart = { imgX: this.state._dragStartImgX, imgY: this.state._dragStartImgY };
                this.state._dragPending = null;
                this._overlayCanvas.style.cursor = 'grabbing';
            } else {
                return;
            }
        }

        if (this.state.isPanning) {
            this.state.offsetX = this.state.panStartOffsetX + (e.clientX - this.state.panStartX);
            this.state.offsetY = this.state.panStartOffsetY + (e.clientY - this.state.panStartY);
            this._drawBgRef();
            this._drawGrid();
            this._drawMain();
            this._drawOverlay();
            return;
        }

        var s = this.state.scale;
        var worldPos = this._screenToWorld(e.clientX, e.clientY);
        var wx = worldPos.x, wy = worldPos.y;
        var ix = wx - entry.worldX;
        var iy = wy - entry.worldY;
        var imgScrX = entry.worldX * s + this.state.offsetX;
        var imgScrY = entry.worldY * s + this.state.offsetY;

        // Rotate preview
        if (this.state._isRotating && this.state._rotateCenter) {
            this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
            this._drawBgRef();
            this._drawGrid();
            this._drawOverlay();
            var rc = this.state._rotateCenter;
            var currentAngle = Math.atan2(iy - rc.cy, ix - rc.cx);
            var deltaAngle = currentAngle - this.state._rotateStartAngle;
            var ctxR = this._overlayCtx;
            var rcx = imgScrX + rc.cx * s, rcy = imgScrY + rc.cy * s;
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
                var degs = (deltaAngle * 180 / Math.PI);
                ctxR.fillStyle = '#e94560';
                ctxR.font = 'bold 13px sans-serif';
                ctxR.fillText(degs.toFixed(1) + '\u00b0', rcx + 12, rcy - 10);
            }
            return;
        }

        // Move preview
        if (this.state.transformDrag && this.state.transformMode === 'move' && !this.state._scaleFromCorner && entry.selectedRegion >= 0) {
            this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
            this._drawBgRef();
            this._drawGrid();
            this._drawOverlay();
            var sr4 = entry.regions[entry.selectedRegion];
            if (sr4 && this.state.transformStart) {
                var dx3 = ix - this.state.transformStart.imgX;
                var dy3 = iy - this.state.transformStart.imgY;
                var offXi = Math.round(dx3), offYi = Math.round(dy3);
                var ctx4 = this._overlayCtx;
                var px4 = imgScrX + (sr4.bounds.x + offXi) * s, py4 = imgScrY + (sr4.bounds.y + offYi) * s;
                ctx4.strokeStyle = '#ffab00';
                ctx4.lineWidth = 2;
                ctx4.setLineDash([6, 4]);
                ctx4.strokeRect(px4, py4, sr4.bounds.w * s, sr4.bounds.h * s);
                ctx4.setLineDash([]);
                ctx4.font = 'bold 12px sans-serif';
                var lbl4 = sr4.bounds.w + '-' + sr4.bounds.h + 'px ' + sr4.area + 'px';
                var tw4 = ctx4.measureText(lbl4).width;
                var ly4 = py4 - 24;
                ctx4.fillStyle = 'rgba(0,0,0,0.65)';
                ctx4.fillRect(px4 - 4, ly4 - 13, tw4 + 8, 16);
                ctx4.fillStyle = '#ffab00';
                ctx4.fillText(lbl4, px4, ly4);
            }
            return;
        }

        // Scale preview
        if (this.state.transformDrag && this.state._scaleFromCorner && entry.selectedRegion >= 0) {
            this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
            this._drawBgRef();
            this._drawGrid();
            this._drawOverlay();
            var sr5 = entry.regions[entry.selectedRegion];
            if (sr5 && this.state.transformInitBounds) {
                var ib5 = this.state.transformInitBounds;
                var nw5 = Math.max(4, ix - ib5.x);
                var nh5 = Math.max(4, iy - ib5.y);
                var sf5 = Math.max(nw5 / ib5.w, nh5 / ib5.h);
                var pW5 = Math.round(ib5.w * sf5);
                var pH5 = Math.round(ib5.h * sf5);
                var ctx5 = this._overlayCtx;
                ctx5.strokeStyle = '#ffab00';
                ctx5.lineWidth = 2;
                ctx5.setLineDash([4, 3]);
                ctx5.strokeRect(imgScrX + ib5.x * s, imgScrY + ib5.y * s, pW5 * s, pH5 * s);
                ctx5.setLineDash([]);
                var hx5 = imgScrX + (ib5.x + pW5) * s, hy5 = imgScrY + (ib5.y + pH5) * s;
                ctx5.fillStyle = '#ffab00';
                ctx5.fillRect(hx5 - 6, hy5 - 6, 12, 12);
                ctx5.strokeStyle = '#fff';
                ctx5.lineWidth = 1.5;
                ctx5.strokeRect(hx5 - 6, hy5 - 6, 12, 12);
                ctx5.font = 'bold 12px sans-serif';
                var lbl5 = pW5 + '-' + pH5 + 'px ' + Math.round(sr5.area * sf5 * sf5) + 'px';
                var tw5 = ctx5.measureText(lbl5).width;
                var ly5 = imgScrY + ib5.y * s - 24;
                ctx5.fillStyle = 'rgba(0,0,0,0.65)';
                ctx5.fillRect(imgScrX + ib5.x * s - 4, ly5 - 13, tw5 + 8, 16);
                ctx5.fillStyle = '#ffab00';
                ctx5.fillText(lbl5, imgScrX + ib5.x * s, ly5);
            }
            return;
        }

        this._overlayCanvas.style.cursor = 'pointer';
    },

    _onMouseUp: function(e) {
        // 底图调整拖拽结束
        if (this.state._bgRefDragStart) {
            this.state._bgRefDragStart = null;
            this._overlayCanvas.style.cursor = this.state.bgRefAdjusting ? 'move' : 'crosshair';
            return;
        }

        var entry = this._getCurrentEntry(); if (!entry) return;

        if (this.state.isPanning) {
            this.state.isPanning = false;
            this._overlayCanvas.style.cursor = this.state.transformMode === 'move' ? 'pointer' : 'pointer';
            return;
        }

        var s = this.state.scale;
        var worldPos = this._screenToWorld(e.clientX, e.clientY);
        var wx = worldPos.x, wy = worldPos.y;
        var ix = wx - entry.worldX;
        var iy = wy - entry.worldY;

        // Rotate apply
        if (this.state._isRotating && this.state._rotateCenter) {
            this.state._isRotating = false;
            var rcxC = this.state._rotateCenter;
            var currentAngle = Math.atan2(iy - rcxC.cy, ix - rcxC.cx);
            var deltaAngle = currentAngle - this.state._rotateStartAngle;
            // 防止误触旋转手柄：检查鼠标是否在手柄位置附近（未拖拽）
            var rib = this.state._rotateInitBounds;
            if (rib) {
                var rHandleX = rib.x + rib.w, rHandleY = rib.y;
                var rDist = Math.sqrt((ix - rHandleX) * (ix - rHandleX) + (iy - rHandleY) * (iy - rHandleY));
            }
            this._applyRotateTransform(deltaAngle);
            this.state._rotateCenter = null;
            this.state._rotateStartAngle = 0;
            this.state._rotateInitBounds = null;
            this._overlayCanvas.style.cursor = 'pointer';
            this._drawOverlay();
            return;
        }

        // 纯点击（未拖拽）：清理待激活状态
        if (this.state._dragPending && !this.state.transformDrag) {
            this.state._dragPending = null;
            this._overlayCanvas.style.cursor = 'pointer';
            this._drawOverlay();
            return;
        }

        // Scale / Move apply
        if (this.state.transformDrag) {
            this.state.transformDrag = false;
            if (this.state._scaleFromCorner && entry.selectedRegion >= 0 && this.state.transformInitBounds) {
                this._applyScaleTransform(ix, iy);
                this.state._scaleFromCorner = null;
                this.state.transformStart = null;
                this.state.transformInitBounds = null;
                this._overlayCanvas.style.cursor = 'pointer';
                this._drawOverlay();
                return;
            }
            if (this.state.transformMode === 'move' && entry.selectedRegion >= 0) {
                this._applyMoveTransform(ix, iy);
            }
            this.state._scaleFromCorner = null;
            this.state.transformStart = null;
            this.state.transformInitBounds = null;
            this._overlayCanvas.style.cursor = 'pointer';
            this._drawOverlay();
            return;
        }
    },

    // ========================================
    //   Transform Functions
    // ========================================

    _ensureProcessedImageData: function(entry) {
        if (entry.processedImageData) return;
        this._initOriginalImageData(entry);
        if (!entry._originalImageData) return;
        entry.processedImageData = new ImageData(
            new Uint8ClampedArray(entry._originalImageData.data),
            entry._originalImageData.width,
            entry._originalImageData.height
        );
        entry.canvasW = entry._originalImageData.width;
        entry.canvasH = entry._originalImageData.height;
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

    _growEntryCanvas: function(entry, newW, newH, ox, oy) {
        var cw = entry.processedImageData.width, ch = entry.processedImageData.height;
        if (cw <= 0 || ch <= 0) return false;
        var oldData = entry.processedImageData.data;

        var newData = new ImageData(newW, newH);
        for (var y = 0; y < ch; y++) {
            for (var x = 0; x < cw; x++) {
                var si = (y * cw + x) * 4;
                if (oldData[si + 3] > 0) {
                    var nx = x + ox, ny = y + oy;
                    // 边界检查：防止 Uint8ClampedArray 负索引静默钳制到 0，导致像素复制到左上角
                    if (nx < 0 || nx >= newW || ny < 0 || ny >= newH) continue;
                    var di = (ny * newW + nx) * 4;
                    newData.data[di] = oldData[si];
                    newData.data[di + 1] = oldData[si + 1];
                    newData.data[di + 2] = oldData[si + 2];
                    newData.data[di + 3] = oldData[si + 3];
                }
            }
        }

        entry.regions.forEach(function(r) {
            var np = [];
            var nps = new Uint8Array(newW * newH);
            r.pixels.forEach(function(p) {
                var nx = p[0] + ox, ny = p[1] + oy;
                if (nx < 0 || nx >= newW || ny < 0 || ny >= newH) return;  // 同样做边界检查
                np.push([nx, ny]);
                nps[ny * newW + nx] = 1;
            });
            r.pixels = np;
            r.pixelSet = nps;
            r.bounds.x += ox;
            r.bounds.y += oy;
        });

        entry.processedImageData = newData;
        entry.canvasW = newW;
        entry.canvasH = newH;
        entry.worldX -= ox;
        entry.worldY -= oy;
        return true;
    },


    _growCanvasIfNeeded: function(entry) {
        if (!entry.processedImageData || !entry.regions.length) return;
        var cw = entry.processedImageData.width, ch = entry.processedImageData.height;
        if (cw <= 0 || ch <= 0) return;

        var minX = cw, minY = ch, maxX = 0, maxY = 0;
        entry.regions.forEach(function(r) {
            if (r.pixels.length === 0) return;
            if (r.bounds.x < minX) minX = r.bounds.x;
            if (r.bounds.y < minY) minY = r.bounds.y;
            if (r.bounds.x + r.bounds.w > maxX) maxX = r.bounds.x + r.bounds.w;
            if (r.bounds.y + r.bounds.h > maxY) maxY = r.bounds.y + r.bounds.h;
        });
        if (minX >= 0 && minY >= 0 && maxX <= cw && maxY <= ch) return;

        var pad = 300;
        var newMinX = minX - pad;
        var newMinY = minY - pad;
        var newW = maxX + pad - newMinX;
        var newH = maxY + pad - newMinY;
        var ox = 0 - newMinX;
        var oy = 0 - newMinY;

        this._growEntryCanvas(entry, newW, newH, ox, oy);
    },

    _applyMoveTransform: function(mouseImgX, mouseImgY) {
        var entry = this._getCurrentEntry(); if (!entry) return;
        if (entry.selectedRegion < 0 || !this.state.transformStart) return;
        this._ensureProcessedImageData(entry);
        if (!entry.processedImageData) return;
        var region = entry.regions[entry.selectedRegion];
        if (!region) return;
        var dx = Math.round(mouseImgX - this.state.transformStart.imgX);
        var dy = Math.round(mouseImgY - this.state.transformStart.imgY);
        if (dx === 0 && dy === 0) { this._drawMain(); this._drawOverlay(); return; }
        this._saveUndoState();

        var w = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || entry.originalImage.width);
        var h = entry.processedImageData ? entry.processedImageData.height : (entry.canvasH || entry.originalImage.height);

        // 预扩展：如果移动方向会超出画布，先扩大
        var newMinX = region.bounds.x + dx;
        var newMinY = region.bounds.y + dy;
        var needLeft = 0, needTop = 0, needRight = 0, needBottom = 0;
        if (newMinX < 0) needLeft = -newMinX;
        if (newMinY < 0) needTop = -newMinY;
        if (newMinX + region.bounds.w > w) needRight = (newMinX + region.bounds.w) - w;
        if (newMinY + region.bounds.h > h) needBottom = (newMinY + region.bounds.h) - h;
        if (needLeft || needTop || needRight || needBottom) {
            var pad = 100;
            var expOx = needLeft + pad;
            var expOy = needTop + pad;
            this._growEntryCanvas(entry,
                w + needLeft + needRight + pad * 2,
                h + needTop + needBottom + pad * 2,
                expOx, expOy);
            // 修正 transformStart 到新图像坐标系
            this.state.transformStart.imgX += expOx;
            this.state.transformStart.imgY += expOy;
        }

        (function(){
            var dd = entry.processedImageData.data, ww = entry.processedImageData.width, cc = 0;
            for (var yy = 0; yy < Math.min(200, entry.processedImageData.height); yy++)
                for (var xx = 0; xx < Math.min(300, ww); xx++)
                    if (dd[(yy*ww+xx)*4+3] > 0) cc++;
        })();

        // 重新获取扩展后的尺寸和数据
        w = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || entry.originalImage.width);
        h = entry.processedImageData ? entry.processedImageData.height : (entry.canvasH || entry.originalImage.height);
        var data = entry.processedImageData.data;
        region = entry.regions[entry.selectedRegion];

        // 构建其他精灵保护 mask
        var otherMask = new Uint8Array(w * h);
        for (var oi = 0; oi < entry.regions.length; oi++) {
            if (oi === entry.selectedRegion) continue;
            var ops = entry.regions[oi].pixelSet;
            if (ops) {
                for (var oj = 0; oj < ops.length; oj++) {
                    if (ops[oj]) otherMask[oj] = 1;
                }
            }
        }

        // 缓存源像素
        var srcPixels = [];
        region.pixels.forEach(function(p) {
            var srcIdx = (p[1] * w + p[0]) * 4;
            srcPixels.push({
                x: p[0], y: p[1],
                r: data[srcIdx], g: data[srcIdx + 1], b: data[srcIdx + 2], a: data[srcIdx + 3]
            });
        });

        // 保存旧 bounds 用于清空
        var oldBx = region.bounds.x, oldBy = region.bounds.y, oldBw = region.bounds.w, oldBh = region.bounds.h;

        // 清除旧区域（扩展 1px 覆盖边缘像素，避免残留）
        var clBy = Math.max(0, oldBy - 1);
        var clEy = Math.min(h, oldBy + oldBh + 1);
        var clBx = Math.max(0, oldBx - 1);
        var clEx = Math.min(w, oldBx + oldBw + 1);
        for (var py = clBy; py < clEy; py++) {
            for (var px = clBx; px < clEx; px++) {
                if (!otherMask[py * w + px]) {
                    var pi2 = (py * w + px) * 4;
                    data[pi2] = 0; data[pi2 + 1] = 0; data[pi2 + 2] = 0; data[pi2 + 3] = 0;
                }
            }
        }

        // 将像素移动到新位置（画布已足够大，不会越界）
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

        region.pixels = newPixels;
        region.pixelSet = newPS;
        var mnX = w, mxX = 0, mnY = h, mxY = 0;
        newPixels.forEach(function(p) {
            if (p[0] < mnX) mnX = p[0]; if (p[0] > mxX) mxX = p[0];
            if (p[1] < mnY) mnY = p[1]; if (p[1] > mxY) mxY = p[1];
        });
        region.bounds = { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 };
        region.area = newPixels.length;

        this._growCanvasIfNeeded(entry);
        // DEBUG: 检查幽灵像素
        (function(){
            var dd = entry.processedImageData.data, ww = entry.processedImageData.width, cc = 0;
            for (var yy = 0; yy < Math.min(200, entry.processedImageData.height); yy++)
                for (var xx = 0; xx < Math.min(300, ww); xx++)
                    if (dd[(yy*ww+xx)*4+3] > 0) cc++;
        })();
        this._drawMain();
        this._drawOverlay();
        this._showToast('\u5df2\u79fb\u52a8 ' + newPixels.length + ' \u4e2a\u50cf\u7d20');
    },

    _applyScaleTransform: function(mouseImgX, mouseImgY) {
        var entry = this._getCurrentEntry(); if (!entry) return;
        if (entry.selectedRegion < 0 || !this.state.transformInitBounds) return;
        this._ensureProcessedImageData(entry);
        if (!entry.processedImageData) return;
        var region = entry.regions[entry.selectedRegion];
        if (!region) return;
        var ib = this.state.transformInitBounds;
        var oldW = ib.w, oldH = ib.h;
        // 防止误触缩放手柄：检查鼠标是否在手柄位置附近（未拖拽）
        var handleX = ib.x + oldW, handleY = ib.y + oldH;
        var distFromHandle = Math.sqrt((mouseImgX - handleX) * (mouseImgX - handleX) + (mouseImgY - handleY) * (mouseImgY - handleY));
        this._saveUndoState();

        var newW = Math.max(4, mouseImgX - ib.x);
        var newH = Math.max(4, mouseImgY - ib.y);
        var sf = Math.max(newW / oldW, newH / oldH);
        sf = Math.max(0.05, Math.min(10, sf));
        var dstW = Math.round(oldW * sf);
        var dstH = Math.round(oldH * sf);

        // 预扩展：如果缩放后超出画布，先扩大
        var cw = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || entry.originalImage.width);
        var ch = entry.processedImageData ? entry.processedImageData.height : (entry.canvasH || entry.originalImage.height);
        var needRight = Math.max(0, (ib.x + dstW) - cw);
        var needBottom = Math.max(0, (ib.y + dstH) - ch);
        if (needRight || needBottom) {
            var pad = 200;
            this._growEntryCanvas(entry,
                Math.max(cw, ib.x + dstW + pad),
                Math.max(ch, ib.y + dstH + pad),
                0, 0);
            region = entry.regions[entry.selectedRegion];
        }

        var w = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || entry.originalImage.width);
        var h = entry.processedImageData ? entry.processedImageData.height : (entry.canvasH || entry.originalImage.height);
        var data = entry.processedImageData.data;

        var newW = Math.max(4, mouseImgX - ib.x);
        var newH = Math.max(4, mouseImgY - ib.y);
        var sf = Math.max(newW / oldW, newH / oldH);
        sf = Math.max(0.05, Math.min(10, sf));
        var dstW = Math.round(oldW * sf);
        var dstH = Math.round(oldH * sf);

        // 构建其他精灵的保护 mask
        var otherMask = new Uint8Array(w * h);
        for (var oi = 0; oi < entry.regions.length; oi++) {
            if (oi === entry.selectedRegion) continue;
            var ops = entry.regions[oi].pixelSet;
            if (ops) {
                for (var oj = 0; oj < ops.length; oj++) {
                    if (ops[oj]) otherMask[oj] = 1;
                }
            }
        }

        // 从 processedImageData 快照提取源精灵区域
        var snapshotData = new Uint8ClampedArray(data);
        var srcC = document.createElement('canvas');
        srcC.width = oldW; srcC.height = oldH;
        var srcCtx = srcC.getContext('2d');
        var snapImageData = new ImageData(snapshotData, w, h);
        var tempC = document.createElement('canvas');
        tempC.width = w; tempC.height = h;
        tempC.getContext('2d').putImageData(snapImageData, 0, 0);
        srcCtx.drawImage(tempC, ib.x, ib.y, oldW, oldH, 0, 0, oldW, oldH);
        var srcImgData = srcCtx.getImageData(0, 0, oldW, oldH);
        var srcPx = srcImgData.data;
        for (var si = 0; si < oldW * oldH; si++) {
            var gx = ib.x + (si % oldW), gy = ib.y + Math.floor(si / oldW);
            if (!region.pixelSet || !region.pixelSet[gy * w + gx]) {
                srcPx[si * 4 + 3] = 0;
            }
        }
        srcCtx.putImageData(srcImgData, 0, 0);

        // 清除当前 region 整个 bounds 范围内像素（扩展 1px 覆盖边缘）
        var clBy = Math.max(0, ib.y - 1);
        var clEy = Math.min(h, ib.y + ib.h + 1);
        var clBx = Math.max(0, ib.x - 1);
        var clEx = Math.min(w, ib.x + ib.w + 1);
        for (var cy = clBy; cy < clEy; cy++) {
            for (var cx = clBx; cx < clEx; cx++) {
                if (!otherMask[cy * w + cx]) {
                    var ci = (cy * w + cx) * 4;
                    data[ci] = 0; data[ci + 1] = 0; data[ci + 2] = 0; data[ci + 3] = 0;
                }
            }
        }

        // canvas 缩放（浏览器原生高质量缩放）
        var dstC = document.createElement('canvas');
        dstC.width = dstW; dstC.height = dstH;
        var dstCtx = dstC.getContext('2d');
        dstCtx.imageSmoothingEnabled = true;
        dstCtx.drawImage(srcC, 0, 0, dstW, dstH);
        var dstImgData = dstCtx.getImageData(0, 0, dstW, dstH);
        var dstPx = dstImgData.data;
        var newPixels = [];
        var newPS = new Uint8Array(w * h);
        for (var sy = 0; sy < dstH; sy++) {
            for (var sx = 0; sx < dstW; sx++) {
                var dpi = (sy * dstW + sx) * 4;
                var da = dstPx[dpi + 3];
                if (da < 10) continue;
                var dx2 = ib.x + sx, dy2 = ib.y + sy;
                if (dx2 < 0 || dx2 >= w || dy2 < 0 || dy2 >= h) continue;
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

        this._growCanvasIfNeeded(entry);
        entry.edited = true;
        this._drawMain();
        this._drawOverlay();
        this._showToast('\u7f29\u653e\u5b8c\u6210: ' + region.bounds.w + '-' + region.bounds.h + 'px');
    },

    _applyRotateTransform: function(radians) {
        var entry = this._getCurrentEntry(); if (!entry) return;
        if (entry.selectedRegion < 0) return;
        this._saveUndoState();
        this._ensureProcessedImageData(entry);
        if (!entry.processedImageData) return;
        var region = entry.regions[entry.selectedRegion];
        if (!region || !region.pixels.length) return;

        var centroid = this._computeSpriteCentroid(region);
        if (!centroid) return;
        var cx = centroid.cx, cy = centroid.cy;
        var cos = Math.cos(radians), sin = Math.sin(radians);

        var w = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || entry.originalImage.width);
        var h = entry.processedImageData ? entry.processedImageData.height : (entry.canvasH || entry.originalImage.height);
        var data = entry.processedImageData.data;
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

        // 预扩展：旋转后包围盒可能超出画布
        var needLeft = destX < 0 ? -destX : 0;
        var needTop = destY < 0 ? -destY : 0;
        var needRight = Math.max(0, (destX + destW) - w);
        var needBottom = Math.max(0, (destY + destH) - h);
        if (needLeft || needTop || needRight || needBottom) {
            var pad = 200;
            this._growEntryCanvas(entry,
                w + needLeft + needRight + pad * 2,
                h + needTop + needBottom + pad * 2,
                needLeft + pad, needTop + pad);
            // 重新获取扩展后的数据
            w = entry.processedImageData ? entry.processedImageData.width : (entry.canvasW || entry.originalImage.width);
            h = entry.processedImageData ? entry.processedImageData.height : (entry.canvasH || entry.originalImage.height);
            data = entry.processedImageData.data;
            region = entry.regions[entry.selectedRegion];
            // 重新计算质心和包围盒
            centroid = this._computeSpriteCentroid(region);
            if (!centroid) return;
            cx = centroid.cx; cy = centroid.cy;
            bx = region.bounds.x; by = region.bounds.y; bw = region.bounds.w; bh = region.bounds.h;
            // 重新计算旋转后包围盒
            corners = [[bx, by], [bx + bw - 1, by], [bx, by + bh - 1], [bx + bw - 1, by + bh - 1]];
            minRX = Infinity; maxRX = -Infinity; minRY = Infinity; maxRY = -Infinity;
            for (ci = 0; ci < corners.length; ci++) {
                rx = cos * (corners[ci][0] - cx) - sin * (corners[ci][1] - cy) + cx;
                ry = sin * (corners[ci][0] - cx) + cos * (corners[ci][1] - cy) + cy;
                if (rx < minRX) minRX = rx; if (rx > maxRX) maxRX = rx;
                if (ry < minRY) minRY = ry; if (ry > maxRY) maxRY = ry;
            }
            destX = Math.floor(minRX); destY = Math.floor(minRY);
            destW = Math.ceil(maxRX) - destX + 1;
            destH = Math.ceil(maxRY) - destY + 1;
            cos = Math.cos(radians); sin = Math.sin(radians);
        }

        // 2. 提取精灵区域到源 canvas
        var snapshotData = new Uint8ClampedArray(data);
        var tempC = document.createElement('canvas');
        tempC.width = w; tempC.height = h;
        tempC.getContext('2d').putImageData(new ImageData(snapshotData, w, h), 0, 0);
        var srcC = document.createElement('canvas');
        srcC.width = bw; srcC.height = bh;
        var srcCtx = srcC.getContext('2d');
        srcCtx.drawImage(tempC, bx, by, bw, bh, 0, 0, bw, bh);
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
        for (var oi = 0; oi < entry.regions.length; oi++) {
            if (oi === entry.selectedRegion) continue;
            var ops = entry.regions[oi].pixelSet;
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
                    data[pi2 * 4] = 0; data[pi2 * 4 + 1] = 0; data[pi2 * 4 + 2] = 0; data[pi2 * 4 + 3] = 0;
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

        this._growCanvasIfNeeded(entry);
        entry.edited = true;
        this._drawMain();
        this._drawOverlay();
        this._showToast('\u5df2\u65cb\u8f6c ' + (radians * 180 / Math.PI).toFixed(1) + '\u00b0');
    },

    // ========================================
    //   Region List UI
    // ========================================

    _updateRegionListUI: function() {},

    // ========================================
    //   Undo
    // ========================================

    _saveUndoState: function() {
        var entry = this._getCurrentEntry(); if (!entry) return;
        if (!entry.processedImageData) return;
        var src = entry.processedImageData;
        var snapshot = {
            imageData: new ImageData(new Uint8ClampedArray(src.data), src.width, src.height),
            selectedRegion: entry.selectedRegion,
            saturationBatch: entry.saturationBatch,
            saturationCurrent: entry.saturationCurrent,
            contrastBatch: entry.contrastBatch,
            contrastCurrent: entry.contrastCurrent,
            brightnessBatch: entry.brightnessBatch,
            brightnessCurrent: entry.brightnessCurrent,
            worldX: entry.worldX,
            worldY: entry.worldY,
            canvasW: entry.canvasW,
            canvasH: entry.canvasH,
            regionData: entry.regions.map(function(r) {
                return {
                    pixels: r.pixels.slice(),
                    bounds: { x: r.bounds.x, y: r.bounds.y, w: r.bounds.w, h: r.bounds.h },
                    area: r.area,
                    color: r.color,
                    id: r.id
                };
            })
        };
        entry.undoStack.push(snapshot);
        if (entry.undoStack.length > this.state.undoStackSize) {
            entry.undoStack.shift();
        }
    },

    _undo: function() {
        var entry = this._getCurrentEntry(); if (!entry) return;
        var stack = entry.undoStack;
        if (stack.length === 0) { this._showToast('没有可撤销的操作', true); return; }
        var snapshot = stack.pop();
        if (snapshot.imageData) {
            entry.processedImageData = snapshot.imageData;
            entry.canvasW = snapshot.canvasW || snapshot.imageData.width;
            entry.canvasH = snapshot.canvasH || snapshot.imageData.height;
            entry.worldX = snapshot.worldX !== undefined ? snapshot.worldX : 0;
            entry.worldY = snapshot.worldY !== undefined ? snapshot.worldY : 0;
            entry.saturationBatch = snapshot.saturationBatch || 0;
            entry.saturationCurrent = snapshot.saturationCurrent || 0;
            entry.contrastBatch = snapshot.contrastBatch || 0;
            entry.contrastCurrent = snapshot.contrastCurrent || 0;
            entry.brightnessBatch = snapshot.brightnessBatch || 0;
            entry.brightnessCurrent = snapshot.brightnessCurrent || 0;
            if (snapshot.regionData) {
                var pdW = entry.processedImageData.width;
                var pdH = entry.processedImageData.height;
                entry.regions = snapshot.regionData.map(function(r) {
                    var pixels = [];
                    var ps = new Uint8Array(pdW * pdH);
                    r.pixels.forEach(function(p) {
                        var nx = p[0], ny = p[1];
                        // 跳过超出当前画布尺寸的像素（数据维度不匹配时防止越界）
                        if (nx < 0 || nx >= pdW || ny < 0 || ny >= pdH) return;
                        pixels.push([nx, ny]);
                        ps[ny * pdW + nx] = 1;
                    });
                    // 重新计算 bounds 以匹配实际匹素
                    var mnX = pdW, mxX = 0, mnY = pdH, mxY = 0;
                    if (pixels.length > 0) {
                        pixels.forEach(function(p) {
                            if (p[0] < mnX) mnX = p[0];
                            if (p[0] > mxX) mxX = p[0];
                            if (p[1] < mnY) mnY = p[1];
                            if (p[1] > mxY) mxY = p[1];
                        });
                    }
                    return {
                        id: r.id,
                        pixels: pixels,
                        pixelSet: ps,
                        bounds: pixels.length > 0 ? { x: mnX, y: mnY, w: mxX - mnX + 1, h: mxY - mnY + 1 } : r.bounds,
                        area: pixels.length,
                        color: r.color
                    };
                });
            }
        }
        // 恢复撤销前的选中状态
        entry.selectedRegion = (snapshot.selectedRegion !== undefined && snapshot.selectedRegion < entry.regions.length) ? snapshot.selectedRegion : -1;
        entry.innerSelectedRegions = {};
        this._syncSaturationUI(entry);
        this._drawBgRef();
        this._drawGrid();
        this._drawMain();
        this._drawOverlay();
        this._showToast('已撤销');
    },

    // ========================================
    //   Export
    // ========================================

    _openExportDialog: function() {
        var self = this;
        if (this.state.imageList.length === 0) {
            this._showToast('请先上传图片', true);
            return;
        }

        // 关闭已有对话框
        var existing = document.getElementById('ttExportDlgOverlay');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        var html = this._buildExportDialogHTML();
        var temp = document.createElement('div');
        temp.innerHTML = html;
        var dialog = temp.firstElementChild;
        document.body.appendChild(dialog);

        // 保存引用
        this._exportDialogData = { dialog: dialog, items: [], groupNames: {} };

        // 构建精灵列表
        this._rebuildExportSpriteList();

        // 绑定事件
        this._bindExportDialogEvents(dialog);
    },

    _rebuildExportSpriteList: function() {
        var self = this;
        var dialog = this._exportDialogData.dialog;
        if (!dialog) return;

        // 收集所有图片的所有精灵
        var allItems = [];
        var list = this.state.imageList;
        var prefix = dialog.querySelector('#exportNamePrefix').value || 'sprite';
        var startNum = parseInt(dialog.querySelector('#exportStartNum').value) || 1;

        for (var ei = 0; ei < list.length; ei++) {
            var entry = list[ei];
            var regions = entry.regions;
            // 构建源图像 canvas（处理后的实际数据）
            var srcCanvas = null;
            if (entry.processedImageData) {
                srcCanvas = document.createElement('canvas');
                srcCanvas.width = entry.processedImageData.width;
                srcCanvas.height = entry.processedImageData.height;
                srcCanvas.getContext('2d').putImageData(entry.processedImageData, 0, 0);
            }
            if (!regions || regions.length === 0) {
                // 没有检测精灵的图片，把整张图作为一个输出项
                var thumbCanvas = document.createElement('canvas');
                thumbCanvas.width = 36;
                thumbCanvas.height = 36;
                var tCtx0 = thumbCanvas.getContext('2d');
                if (srcCanvas) {
                    tCtx0.drawImage(srcCanvas, 0, 0, 36, 36);
                } else {
                    tCtx0.drawImage(entry.originalImage, 0, 0, 36, 36);
                }

                allItems.push({
                    entryIdx: ei,
                    regionIdx: -1,
                    fileName: entry.fileName || 'image',
                    selected: true,
                    thumbDataUrl: thumbCanvas.toDataURL(),
                    sizeText: (srcCanvas ? srcCanvas.width : entry.originalImage.width) + '\u00d7' + (srcCanvas ? srcCanvas.height : entry.originalImage.height),
                    exportName: (entry.fileName || 'image') + '.png'
                });
            } else {
                var srcInfo = srcCanvas || entry.originalImage;
                for (var ri = 0; ri < regions.length; ri++) {
                    var region = regions[ri];
                    var thumbCanvas = document.createElement('canvas');
                    thumbCanvas.width = Math.min(36, region.bounds.w);
                    thumbCanvas.height = Math.min(36, region.bounds.h);
                    var tCtx = thumbCanvas.getContext('2d');

                    // 从实际图像数据截取精灵区域
                    tCtx.drawImage(srcInfo,
                        region.bounds.x, region.bounds.y, region.bounds.w, region.bounds.h,
                        0, 0, thumbCanvas.width, thumbCanvas.height);

                    allItems.push({
                        entryIdx: ei,
                        regionIdx: ri,
                        fileName: entry.fileName || 'image',
                        selected: true,
                        thumbDataUrl: thumbCanvas.toDataURL(),
                        sizeText: region.bounds.w + '\u00d7' + region.bounds.h + ' ' + region.area + 'px',
                        exportName: null // 会在下面根据模式生成
                    });
                }
            }
        }

        this._exportDialogData.items = allItems;
        this._renderExportTable(dialog, allItems);
    },

    _renderExportTable: function(dialog, items) {
        var self = this;
        var tbody = dialog.querySelector('#exportTableBody');
        var countEl = dialog.querySelector('#exportSpriteCount');
        if (countEl) countEl.textContent = items.length;

        // 确定文件名模式
        var fmRename = dialog.querySelector('#fmRename');
        var mode = (fmRename && fmRename.checked) ? 'rename' : 'original';
        var prefix = dialog.querySelector('#exportNamePrefix').value || 'sprite';
        var startNum = parseInt(dialog.querySelector('#exportStartNum').value) || 1;
        var groupSize = parseInt(dialog.querySelector('#exportGroupSize').value) || 0;
        var useGroups = groupSize > 1;

        // 生成文件名
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (mode === 'original') {
                item.exportName = item.fileName + '.png';
            } else {
                if (useGroups) {
                    var g = Math.floor(i / groupSize) + 1;
                    var gi = (i % groupSize) + 1;
                    var ogNames = self._exportDialogData ? self._exportDialogData.groupNames : {};
                    var ogLabel = ogNames[g] || String(g);
                    item.exportName = prefix + '_' + ogLabel + '-' + gi + '.png';
                } else {
                    item.exportName = prefix + '_' + String(startNum + i) + '.png';
                }
            }
        }

        var html = '';
        var lastGroup = -1;
        var totalCols = 6;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            // 组标头（可编辑）
            if (useGroups) {
                var curGroup = Math.floor(i / groupSize) + 1;
                if (curGroup !== lastGroup) {
                    var groupNames = self._exportDialogData ? self._exportDialogData.groupNames : {};
                    var gLabel = groupNames[curGroup] || '\u7ec4 ' + curGroup;
                    html += '<tr class="tt-export-group-header"><td colspan="' + totalCols + '">' +
                        '<input type="text" class="tt-export-group-name" value="' + self._escapeHtml(gLabel) + '" data-group-num="' + curGroup + '" style="background:transparent;border:none;color:var(--accent);font-weight:600;font-size:11px;outline:none;">' +
                        '</td></tr>';
                    lastGroup = curGroup;
                }
            }
            html += '<tr draggable="true" class="tt-export-row" data-idx="' + i + '">' +
                '<td style="text-align:center;cursor:grab;color:var(--text2);font-size:14px;user-select:none;">≡</td>' +
                '<td style="text-align:center;"><input type="checkbox" class="export-item-cb" data-idx="' + i + '"' + (item.selected ? ' checked' : '') + '></td>' +
                '<td style="color:var(--text2);text-align:center;white-space:nowrap;">' + (i + 1) + (self.state.imageList[item.entryIdx] && self.state.imageList[item.entryIdx].edited ? ' <span class="tt-edited-dot" title="已编辑"></span>' : '') + '</td>' +
                '<td><img src="' + item.thumbDataUrl + '" class="tt-thumb-preview"></td>' +
                '<td style="color:var(--text2);font-size:10px;white-space:nowrap;">' + item.sizeText + '</td>' +
                '<td><input type="text" class="export-filename-input" value="' + self._escapeHtml(item.exportName) + '" data-idx="' + i + '"></td>' +
                '</tr>';
        }
        tbody.innerHTML = html;

        // 绑定复选框事件
        tbody.querySelectorAll('.export-item-cb').forEach(function(cb) {
            cb.addEventListener('change', function() {
                var idx = parseInt(this.getAttribute('data-idx'));
                if (idx >= 0 && idx < items.length) {
                    items[idx].selected = this.checked;
                }
                self._updateExportSaveBtn(dialog, items);
            });
        });

        // 绑定文件名编辑事件
        tbody.querySelectorAll('.export-filename-input').forEach(function(inp) {
            inp.addEventListener('change', function() {
                var idx = parseInt(this.getAttribute('data-idx'));
                if (idx >= 0 && idx < items.length) {
                    items[idx].exportName = this.value;
                }
            });
        });

        // 绑定拖拽排序
        self._bindExportDragSort(dialog, items);

        // 绑定组名编辑
        self._bindExportGroupNames(dialog, items);

        // 更新保存目录显示
        var dirHandle = this.state.selectedDirHandle;
        if (dirHandle) {
            var pathEl = dialog.querySelector('#exportDirPath');
            if (pathEl) pathEl.textContent = '\u2713 ' + dirHandle.name;
        }

        this._updateExportSaveBtn(dialog, items);
    },

    _reassignExportFilenames: function(dialog, items) {
        var self = this;
        var fmRename = dialog.querySelector('#fmRename');
        var mode = (fmRename && fmRename.checked) ? 'rename' : 'original';
        var prefix = dialog.querySelector('#exportNamePrefix').value || 'sprite';
        var startNum = parseInt(dialog.querySelector('#exportStartNum').value) || 1;
        var groupSize = parseInt(dialog.querySelector('#exportGroupSize').value) || 0;
        var useGroups = groupSize > 1;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (mode === 'original') {
                item.exportName = item.fileName + '.png';
            } else {
                if (useGroups) {
                    var g = Math.floor(i / groupSize) + 1;
                    var gi = (i % groupSize) + 1;
                    var groupNames = self._exportDialogData ? self._exportDialogData.groupNames : {};
                    var gLabel = groupNames[g] || String(g);
                    item.exportName = prefix + '_' + gLabel + '-' + gi + '.png';
                } else {
                    item.exportName = prefix + '_' + String(startNum + i) + '.png';
                }
            }
        }
        this._renderExportTable(dialog, items);
    },

    _bindExportGroupNames: function(dialog, items) {
        var self = this;
        dialog.querySelectorAll('.tt-export-group-name').forEach(function(inp) {
            inp.addEventListener('change', function() {
                var groupNum = parseInt(this.getAttribute('data-group-num'));
                var value = this.value.trim();
                if (!groupNum) return;
                if (!self._exportDialogData) self._exportDialogData = { groupNames: {} };
                if (!self._exportDialogData.groupNames) self._exportDialogData.groupNames = {};
                if (value) {
                    self._exportDialogData.groupNames[groupNum] = value;
                } else {
                    delete self._exportDialogData.groupNames[groupNum];
                }
                self._reassignExportFilenames(dialog, items);
            });
        });
    },

    _bindExportDragSort: function(dialog, items) {
        var self = this;
        var dragSrcIdx = -1;

        var rows = dialog.querySelectorAll('tr.tt-export-row');
        rows.forEach(function(row) {
            row.addEventListener('dragstart', function(e) {
                dragSrcIdx = parseInt(this.getAttribute('data-idx'));
                if (isNaN(dragSrcIdx)) return;
                this.classList.add('tt-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(dragSrcIdx));
            });

            row.addEventListener('dragend', function() {
                this.classList.remove('tt-dragging');
                dialog.querySelectorAll('.tt-drag-over').forEach(function(el) {
                    el.classList.remove('tt-drag-over');
                });
                dragSrcIdx = -1;
            });

            row.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                var targetIdx = parseInt(this.getAttribute('data-idx'));
                if (isNaN(targetIdx) || targetIdx === dragSrcIdx) return;
                dialog.querySelectorAll('.tt-drag-over').forEach(function(el) {
                    el.classList.remove('tt-drag-over');
                });
                this.classList.add('tt-drag-over');
            });

            row.addEventListener('dragleave', function() {
                this.classList.remove('tt-drag-over');
            });

            row.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('tt-drag-over');
                var targetIdx = parseInt(this.getAttribute('data-idx'));
                if (isNaN(targetIdx) || isNaN(dragSrcIdx) || targetIdx === dragSrcIdx) return;

                var moved = items.splice(dragSrcIdx, 1)[0];
                items.splice(targetIdx, 0, moved);

                self._reassignExportFilenames(dialog, items);
            });
        });
    },

    _updateExportSaveBtn: function(dialog, items) {
        var selected = 0;
        for (var i = 0; i < items.length; i++) {
            if (items[i].selected) selected++;
        }
        var btn = dialog.querySelector('#exportSaveBtn');
        if (btn) {
            btn.disabled = selected === 0;
            btn.textContent = selected > 0 ? '保存 (' + selected + '个)' : '保存';
        }
        var countEl = dialog.querySelector('#exportSpriteCount');
        if (countEl) countEl.textContent = selected + '/' + items.length;
    },

    _bindExportDialogEvents: function(dialog) {
        var self = this;

        // 关闭
        dialog.querySelectorAll('[data-action="closeExportDialog"]').forEach(function(el) {
            el.addEventListener('click', function() {
                self._closeExportDialog();
            });
        });
        dialog.addEventListener('click', function(e) {
            if (e.target === dialog) self._closeExportDialog();
        });

        // 选择目录
        var dirBtn = dialog.querySelector('[data-action="selectExportDir"]');
        if (dirBtn) {
            dirBtn.addEventListener('click', function() {
                self._selectDirForExport();
            });
        }

        // 文件名模式切换
        dialog.querySelectorAll('input[name="exportFileMode"]').forEach(function(radio) {
            radio.addEventListener('change', function() {
                var renameOpts = dialog.querySelector('#renameOptions');
                if (renameOpts) renameOpts.style.display = this.value === 'rename' ? 'block' : 'none';
                self._rebuildExportSpriteList();
            });
        });

        // 前缀/起始编号/每组数量变化
        var prefixInput = dialog.querySelector('#exportNamePrefix');
        var startNumInput = dialog.querySelector('#exportStartNum');
        var groupSizeInput = dialog.querySelector('#exportGroupSize');
        if (prefixInput) prefixInput.addEventListener('input', function() { self._rebuildExportSpriteList(); });
        if (startNumInput) startNumInput.addEventListener('input', function() { self._rebuildExportSpriteList(); });
        if (groupSizeInput) groupSizeInput.addEventListener('input', function() { self._rebuildExportSpriteList(); });

        // 全选/全不选
        dialog.querySelectorAll('[data-action="exportSelectAll"]').forEach(function(el) {
            el.addEventListener('click', function() { self._toggleExportAll(true); });
        });
        dialog.querySelectorAll('[data-action="exportSelectNone"]').forEach(function(el) {
            el.addEventListener('click', function() { self._toggleExportAll(false); });
        });

        // 保存
        var saveBtn = dialog.querySelector('#exportSaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self._executeExport();
            });
        }
    },

    _toggleExportAll: function(checked) {
        var items = this._exportDialogData.items;
        var dialog = this._exportDialogData.dialog;
        if (!items || !dialog) return;
        for (var i = 0; i < items.length; i++) items[i].selected = checked;
        dialog.querySelectorAll('.export-item-cb').forEach(function(cb) {
            cb.checked = checked;
        });
        this._renderExportTable(dialog, items);
    },

    _closeExportDialog: function() {
        var dialog = this._exportDialogData ? this._exportDialogData.dialog : null;
        if (dialog && dialog.parentNode) dialog.parentNode.removeChild(dialog);
        this._exportDialogData = null;
    },

    _selectDirForExport: function() {
        var self = this;
        if (typeof window.showDirectoryPicker !== 'function') {
            this._showToast('浏览器不支持文件夹选择', true);
            return;
        }
        window.showDirectoryPicker({ mode: 'readwrite' }).then(function(handle) {
            self.state.selectedDirHandle = handle;
            var pathEl = self._qInDlg('#exportDirPath');
            if (pathEl) pathEl.textContent = '\u2713 ' + handle.name;
            // 持久化
            self._cacheDirHandle(handle);
        }).catch(function(err) {
            if (err.name !== 'AbortError') {
                self._showToast('选择文件夹失败', true);
            }
        });
    },

    _qInDlg: function(sel) {
        var dlg = this._exportDialogData ? this._exportDialogData.dialog : null;
        return dlg ? dlg.querySelector(sel) : null;
    },

    _cacheDirHandle: function(handle) {
        if (typeof indexedDB === 'undefined') return;
        var openReq = indexedDB.open('IAExportDirCache', 1);
        openReq.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
        openReq.onsuccess = function(e) {
            var db = e.target.result;
            var tx = db.transaction('handles', 'readwrite');
            tx.objectStore('handles').put(handle, 'exportDir');
            tx.oncomplete = function() { db.close(); };
        };
    },

    _loadDirHandle: function() {
        if (typeof indexedDB === 'undefined') return;
        var self = this;
        var openReq = indexedDB.open('IAExportDirCache', 1);
        openReq.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
        openReq.onsuccess = function(e) {
            var db = e.target.result;
            var tx = db.transaction('handles', 'readonly');
            var getReq = tx.objectStore('handles').get('exportDir');
            getReq.onsuccess = function() {
                if (getReq.result) {
                    self.state.selectedDirHandle = getReq.result;
                }
                db.close();
            };
        };
    },

    _executeExport: function() {
        var self = this;
        var items = this._exportDialogData ? this._exportDialogData.items : null;
        var dirHandle = this.state.selectedDirHandle;
        if (!items || items.length === 0) {
            this._showToast('没有可输出的内容', true);
            return;
        }
        if (!dirHandle) {
            this._showToast('请先选择保存文件夹', true);
            return;
        }

        // 筛选选中的
        var selected = [];
        for (var i = 0; i < items.length; i++) {
            if (items[i].selected) selected.push(items[i]);
        }
        if (selected.length === 0) {
            this._showToast('没有选中任何项目', true);
            return;
        }

        this._showToast('正在输出 ' + selected.length + ' 个文件...');

        setTimeout(function() {
            self._batchExportImages(dirHandle, selected);
        }, 100);
    },

    _batchExportImages: async function(dirHandle, items) {
        var self = this;
        var saved = 0;
        var failed = 0;

        // 权限检查
        try {
            var perm = await dirHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                perm = await dirHandle.requestPermission({ mode: 'readwrite' });
                if (perm !== 'granted') {
                    self._showToast('没有目录写入权限', true);
                    return;
                }
            }
        } catch(e) {
            self._showToast('权限获取失败', true);
            return;
        }

        var info = self._headerInfo;
        var progWrap = self._headerProgress;
        var progBar = self._headerProgressBar;

        var updateProgress = function(pct, text) {
            if (progWrap) progWrap.style.display = pct > 0 && pct < 100 ? 'block' : 'none';
            if (progBar) progBar.style.width = pct + '%';
            if (info) { info.textContent = text; info.style.color = pct >= 100 ? '#00c853' : '#888'; }
        };

        try {
            updateProgress(1, '准备输出...');

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var filename = item.exportName;
                updateProgress(Math.round((i + 1) / items.length * 100), filename);

                var entry = self.state.imageList[item.entryIdx];
                if (!entry) { failed++; continue; }

                try {
                    // 生成精灵图像数据
                    var dataUrl = self._generateSpriteDataUrl(entry, item.regionIdx, 'image/png');
                    var resp = await fetch(dataUrl);
                    var blob = await resp.blob();

                    // 获取目标目录（分组编号>1时建子目录）
                    var dlg = self._exportDialogData ? self._exportDialogData.dialog : null;
                    var groupIdEl = dlg ? dlg.querySelector('#exportGroupId') : null;
                    var groupId = groupIdEl ? (parseInt(groupIdEl.value) || 0) : 0;
                    var targetDir = dirHandle;
                    if (groupId > 1) {
                        var subDirName = 'output_' + String(groupId).padStart(2, '0');
                        try {
                            targetDir = await dirHandle.getDirectoryHandle(subDirName, { create: true });
                        } catch(e) {
                            targetDir = await dirHandle.getDirectoryHandle(subDirName, { create: true });
                        }
                    }

                    var fileHandle = await targetDir.getFileHandle(filename, { create: true });
                    var writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    saved++;
                } catch(e) {
                    failed++;
                    console.error('输出失败 ' + filename + ':', e);
                }
            }

            updateProgress(100, '\u2713 完成！' + saved + '个文件');
            self._showToast('\u2713 输出完成！共 ' + saved + ' 个文件' + (failed > 0 ? ' (' + failed + '失败)' : ''));
            self._addLog('\u2713 批量输出', 'ok', saved);
            if (failed > 0) self._addLog('\u2717 ' + failed + '个失败', 'fail', 0);
            self._closeExportDialog();

            setTimeout(function() {
                updateProgress(0, '');
                if (progWrap) progWrap.style.display = 'none';
            }, 5000);
        } catch(e) {
            console.error(e);
            updateProgress(0, '');
            if (progWrap) progWrap.style.display = 'none';
            self._showToast('输出失败: ' + e.message, true);
            self._addLog('\u2717 失败: ' + e.message, 'fail', 0);
        }
    },

    _generateSpriteDataUrl: function(entry, regionIdx, mimeType) {
        mimeType = mimeType || 'image/png';
        var imgData = entry.processedImageData;
        var imgW = imgData ? imgData.width : entry.originalImage.width;
        var imgH = imgData ? imgData.height : entry.originalImage.height;

        if (regionIdx < 0) {
            // 输出整张图
            var c = document.createElement('canvas');
            c.width = imgW;
            c.height = imgH;
            var ctx = c.getContext('2d');
            if (imgData) {
                ctx.putImageData(imgData, 0, 0);
            } else {
                ctx.drawImage(entry.originalImage, 0, 0);
            }
            return c.toDataURL(mimeType, 0.95);
        }

        var region = entry.regions[regionIdx];
        if (!region) return '';

        var b = region.bounds;
        var c = document.createElement('canvas');
        c.width = b.w;
        c.height = b.h;
        var ctx = c.getContext('2d');

        if (imgData) {
            // 从 processedImageData 中截取
            var srcC = document.createElement('canvas');
            srcC.width = imgW;
            srcC.height = imgH;
            srcC.getContext('2d').putImageData(imgData, 0, 0);
            ctx.drawImage(srcC, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
        } else {
            ctx.drawImage(entry.originalImage, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
        }

        return c.toDataURL(mimeType, 0.95);
    },

    // ========================================
    //   Export Log
    // ========================================

    _getLogKey: function() {
        return 'ia_export_log';
    },

    _loadExportLog: function() {
        var raw = localStorage.getItem(this._getLogKey());
        var logs = raw ? JSON.parse(raw) : [];
        this._renderLogPanel(logs);
    },

    _addLog: function(status, statusClass, count) {
        var raw = localStorage.getItem(this._getLogKey());
        var logs = raw ? JSON.parse(raw) : [];
        logs.unshift({
            id: logs.length + 1,
            name: '批量输出',
            time: new Date().toLocaleString(),
            status: status + (count > 0 ? ' (' + count + '个)' : ''),
            statusClass: statusClass
        });
        if (logs.length > 100) logs = logs.slice(0, 100);
        localStorage.setItem(this._getLogKey(), JSON.stringify(logs));
        this._renderLogPanel(logs);
    },

    _clearLog: function() {
        localStorage.removeItem(this._getLogKey());
        this._renderLogPanel([]);
        this._showToast('日志已清除');
    },

    _renderLogPanel: function(logs) {
        var panel = this._overlay ? this._overlay.querySelector('#ttLogPanel') : null;
        var list = this._overlay ? this._overlay.querySelector('#ttLogList') : null;
        var rPanel = this._overlay ? this._overlay.querySelector('#ttRightPanel') : null;
        if (!panel || !list) return;
        panel.style.display = 'block';
        if (rPanel) rPanel.style.display = 'flex';
        if (logs.length === 0) {
            list.innerHTML = '<div class="tt-log-empty">暂无日志</div>';
            return;
        }
        var html = '';
        for (var i = 0; i < logs.length; i++) {
            var l = logs[i];
            html += '<div class="tt-log-item">' +
                '<span class="tt-log-name">#' + l.id + ' ' + l.name + '</span><br>' +
                '<span class="tt-log-time">' + l.time + '</span> ' +
                '<span class="tt-log-status ' + l.statusClass + '">' + l.status + '</span>' +
            '</div>';
        }
        list.innerHTML = html;
    },

    // ========================================
    //   Utilities
    // ========================================

    _q: function(sel) {
        return this._overlay ? this._overlay.querySelector(sel) : null;
    },

    _showToast: function(msg, isError) {
        var t = this._toastEl;
        if (!t) return;
        t.textContent = msg;
        t.className = 'tt-toast' + (isError ? ' error' : '');
        setTimeout(function() { t.classList.add('show'); }, 10);
        setTimeout(function() { t.classList.remove('show'); }, 2500);
    },

    _rgbToHsv: function(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, v = max;
        var d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) { h = 0; }
        else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    },

    _dataURLToBlob: function(dataURL) {
        var parts = dataURL.split(',');
        var mime = parts[0].match(/:(.*?);/)[1];
        var bytes = atob(parts[1]);
        var buf = new ArrayBuffer(bytes.length);
        var view = new Uint8Array(buf);
        for (var i = 0; i < bytes.length; i++) view[i] = bytes.charCodeAt(i);
        return new Blob([buf], { type: mime });
    },

    _escapeHtml: function(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
};
