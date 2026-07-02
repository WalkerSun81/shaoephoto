/**
 * VD5.21 PrefabMaker - Cocos Creator 食物预制体生成工具
 *
 * 核心工作流：
 *   上传素材 → 精灵检测 + 碰撞体生成 → 设置参数 → 输出预制体
 */
var PrefabMaker = {
    id: 'prefab-maker',
    name: '预制体',

    // Cocos 自定义组件 UUID（从参考预制体复制）
    FOOD_VIEW_TYPE: '91d2dE3MThBZoDm8jSoohcR',
    WATER_FLOAT_TYPE: 'a98ba4YLOdKoaztyx05oUFz',

    REGION_COLORS: [
        '#e94560', '#00c853', '#ffab00', '#2979ff', '#ff4081',
        '#00e5ff', '#76ff03', '#ff6d00', '#d500f9', '#00bfa5'
    ],

    // ========================================
    //   State
    // ========================================

    _initState: function() {
        this.state = {
            mode: 'split',
            imageList: [],
            activeImageIndex: -1,
            irBgColor: { r: 255, g: 255, b: 255 },
            irOutlineColor: { r: 0, g: 0, b: 0 },
            scale: 1,
            overlayVisible: true,
            strokeColor: '#000000',
            strokeWidth: 2,
            strokeInnerWidth: 0,
            transformMode: null,
            transformDrag: false,
            transformStart: null,
            transformInitBounds: null,
            _scaleFromCorner: null,
            canvasBgMode: 'checkerboard',
            irColorPickMode: null,
            lassoMode: null,
            lassoPoints: [],
            lassoRegions: [],
            lassoDrawing: false,
            // 碰撞体设置
            colliderType: 'auto',
            colliderSimplifyEpsilon: 3,
            colliderEditActive: false,
            colliderDraggedPoints: null,
            colliderDragIdx: -1,
            colliderDragMode: null,
            colliderDragCorner: -1,
            colliderDragStart: null,
            // 预制体输出
            exportConfig: {
                foodGroup: 1,
                startFoodId: 1,
                morphCount: 2,
                clickAreaScale: 1.0,
                rotation: -49
            }
        };
    },

    _makeImageEntry: function(file, img, fileName, foodId, morphIndex) {
        return {
            file: file,
            fileName: fileName,
            foodId: foodId,
            morphIndex: morphIndex,
            originalImage: img,
            processedImageData: null,
            regions: [],
            selectedRegion: -1,
            innerSelectedRegions: {},
            scale: 1,
            _imgOx: 0,
            _imgOy: 0,
            undoStack: [],
            colliderCustomPoints: {},
            colliderEditActive: false,
            colliderTargetCount: 6,
            colliderType: 'auto',
            colliderBoxCustom: {},
            colliderCircleCustom: {},
            clickAreaScale: 1.0,
            clickAreaRotation: 0,
            colliderDragMode: null,
            colliderDragCorner: -1,
            colliderDragStart: null,
            overlayVisible: true
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
        return '.lasso-active { background:#ffab00 !important; border-color:#ffab00 !important; color:#1a1a2e !important; font-weight:bold; }';
    },

    // ========================================
    //   UI Build
    // ========================================

    _createOverlay: function() {
        var self = this;
        var overlay = document.createElement('div');
        overlay.className = 'tt-overlay';
        overlay.id = 'tt-card';
        overlay.setAttribute('data-skill-id', 'prefab-maker');

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
                '<span style="font-size:16px;font-weight:bold;color:#eee;flex-shrink:0;">VD5.21 Prefab Maker</span>' +
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

        this._bindEvents(overlay);

        // 恢复持久化设置，并更新所有 range 输入
        overlay.querySelectorAll('input[type="range"]').forEach(function(r) {
            var savedVal = localStorage.getItem('vs5_pref_' + r.id);
            if (savedVal !== null) r.value = savedVal;
            var valEl = overlay.querySelector('#' + r.id + 'Val') || overlay.querySelector('[data-range-val="' + r.id + '"]');
            if (valEl) {
                valEl.textContent = r.id === 'colliderScale' ? r.value + '%' : (r.id === 'exportRotation' ? r.value + '°' : r.value);
                r.addEventListener('input', function() {
                    valEl.textContent = this.id === 'colliderScale' ? this.value + '%' : (this.id === 'exportRotation' ? this.value + '°' : this.value);
                    localStorage.setItem('vs5_pref_' + this.id, this.value);
                    if ((this.id === 'colliderSimplify' || this.id === 'colliderScale' || this.id === 'exportClickAreaScale' || this.id === 'exportRotation')) {
                        var e = self._getCurrentEntry();
                        if (e) {
                            if (this.id === 'exportClickAreaScale') e.clickAreaScale = parseFloat(this.value) || 1.0;
                            if (this.id === 'exportRotation') e.clickAreaRotation = parseInt(this.value) || 0;
                            if (e.regions.length > 0) self._drawOverlay();
                        }
                    }
                });
            }
        });

        // 碰撞体类型下拉变化时刷新预览
        var colliderTypeSel = overlay.querySelector('#colliderType');
        if (colliderTypeSel) {
            colliderTypeSel.addEventListener('change', function() {
                var e = self._getCurrentEntry();
                if (e) {
                    e.colliderType = this.value;
                    if (e.regions.length > 0) {
                        // 切换类型时自动进入编辑模式
                        if (!e.colliderEditActive) {
                            self._toggleColliderEdit();
                        } else {
                            self._drawOverlay();
                        }
                    }
                }
            });
        }
    },

    _buildSidebarHTML: function() {
        return '' +
        '<div class="tt-sidebar">' +
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
                '<div class="tt-input-group">' +
                    '<label>碰撞体缩放</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="colliderScale" min="50" max="100" value="90">' +
                        '<span class="tt-range-val" data-range-val="colliderScale">90%</span>' +
                    '</div>' +
                '</div>' +
                '<button class="tt-btn tt-btn-primary" data-action="smartDetect">智能检测</button>' +
                '<div style="margin-top:6px">' +
                    '<button class="tt-btn tt-btn-sm" data-action="transformMode" data-transform="move">✋ 变换模式（移动/缩放）</button>' +
                '</div>' +
            '</div>' +

            '<!-- COLLIDER SETTINGS -->' +
            '<div class="tt-section" id="ttColliderSection" style="display:none">' +
                '<div class="tt-step-title">碰撞体设置</div>' +
                '<div class="tt-input-group">' +
                    '<label>碰撞体类型</label>' +
                    '<select id="colliderType">' +
                        '<option value="polygon">多边形 (Polygon)</option>' +
                        '<option value="box">方形 (Box)</option>' +
                        '<option value="circle">圆形 (Circle)</option>' +
                        '<option value="auto" selected>自动检测</option>' +
                    '</select>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>顶点简化度</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="colliderSimplify" min="3" max="8" value="6">' +
                        '<span class="tt-range-val" data-range-val="colliderSimplify">6</span>' +
                    '</div>' +
                '</div>' +
                '<button class="tt-btn tt-btn-sm" data-action="toggleColliderEdit" style="margin-top:4px">编辑</button>' +
            '</div>' +

            '<!-- EXPORT -->' +
            '<div class="tt-section" id="ttExportSection" style="display:none">' +
                '<div class="tt-step-title">预制体输出</div>' +
                '<div class="tt-input-group">' +
                    '<label>分组编号 (foodXBD)</label>' +
                    '<input type="number" id="exportFoodGroup" value="1" min="1" max="99">' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>起始食物ID</label>' +
                    '<input type="number" id="exportStartFoodId" value="1" min="1" max="999">' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>当前形态 (1 或 2)</label>' +
                    '<input type="number" id="exportMorphIndex" value="1" min="1" max="2">' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>clickArea 缩放</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="exportClickAreaScale" min="0.5" max="2.0" step="0.05" value="1.0">' +
                        '<span class="tt-range-val" data-range-val="exportClickAreaScale">1.0</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>clickArea 旋转</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="exportRotation" min="-180" max="180" value="0">' +
                        '<span class="tt-range-val" data-range-val="exportRotation">0°</span>' +
                    '</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:6px;margin-top:8px">' +
                    '<button class="tt-btn tt-btn-primary" data-action="exportSelectDir" style="flex:1;margin-top:0">📁 选择目录</button>' +
                    '<span id="exportDirPath" style="font-size:10px;color:#e94560;flex:1;word-break:break-all;">未选择输出目录</span>' +
                '</div>' +
                '<button class="tt-btn tt-btn-primary" data-action="exportPrefab" style="margin-top:6px" id="exportBtn" disabled>📦 输出 →未选择目录</button>' +
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
                '<p>上传一张素材图开始制作</p>' +
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
                '滚轮: 缩放 &nbsp;|&nbsp; 右键拖拽: 平移' +
            '</div>' +
        '</div>' +
        '';
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

        // Action buttons
        overlay.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            switch (action) {
                case 'goHome': window.location.href = '../../index.html'; break;
                case 'toggleOverlay': self._toggleOverlay(); break;
                case 'undo': self._undo(); break;
                case 'smartDetect': self._smartDetect(); break;
                case 'selectAllRegions':
                    var sel = btn.getAttribute('data-select') === 'true';
                    self._selectAllRegions(sel);
                    break;
                case 'invertRegionSelection':
                    self._invertRegionSelection();
                    break;
                case 'exportSelectDir': self._selectExportDir(); break;
                case 'exportPrefab': self._executeExport(); break;
                case 'toggleColliderEdit': self._toggleColliderEdit(); break;
                case 'clearLog': self._clearLog(); break;
                case 'transformMode':
                    var tMode = btn.getAttribute('data-transform');
                    if (self.state.transformMode === tMode) {
                        self.state.transformMode = null;
                        self._overlayCanvas.style.cursor = 'pointer';
                        btn.classList.remove('lasso-active');
                        self._showToast('已退出变换模式');
                    } else {
                        var entry = self._getCurrentEntry();
                        if (!entry || entry.selectedRegion < 0) {
                            self._showToast('请先在右侧精灵列表选中一个精灵', true);
                            break;
                        }
                        self.state.transformMode = tMode;
                        self._overlayCanvas.style.cursor = 'grab';
                        btn.classList.add('lasso-active');
                        self._showToast('已进入变换模式，拖拽移动或右下角缩放');
                    }
                    break;
            }
        });

        // Canvas events
        this._overlayCanvas.addEventListener('mousedown', function(e) { self._onMouseDown(e); });
        this._overlayCanvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        document.addEventListener('mousemove', function(e) { self._onMouseMove(e); });
        document.addEventListener('mouseup', function(e) { self._onMouseUp(e); });

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

            // 碰撞体类型快捷键: 1=多边形 2=方形 3=圆形  ~=轮换
            var typeKeys = { '1': 'polygon', '2': 'box', '3': 'circle' };
            if (typeKeys[e.key] || e.code === 'Backquote') {
                var ctEntry = self._getCurrentEntry();
                if (ctEntry) {
                    var newType;
                    if (typeKeys[e.key]) {
                        newType = typeKeys[e.key];
                    } else {
                        var cycle = ['polygon', 'box', 'circle'];
                        var cur = ctEntry.colliderType || 'auto';
                        var idx = cycle.indexOf(cur);
                        newType = cycle[(idx + 1) % cycle.length];
                    }
                    ctEntry.colliderType = newType;
                    var ctSel3 = self._q('#colliderType');
                    if (ctSel3) ctSel3.value = newType;
                    if (!ctEntry.colliderEditActive) self._toggleColliderEdit();
                    else self._drawOverlay();
                    e.preventDefault();
                }
                return;
            }

            if (e.key === 'Tab') {
                var list = self.state.imageList;
                if (list.length > 1) {
                    var nextIdx = (self.state.activeImageIndex + 1) % list.length;
                    self._activateImage(nextIdx);
                    e.preventDefault();
                }
                return;
            }

            if ((e.key === 'Delete' || e.key === 'Backspace')) {
                var entry = self._getCurrentEntry();
                if (!entry || entry.selectedRegion < 0) return;
                entry.regions.splice(entry.selectedRegion, 1);
                entry.selectedRegion = -1;
                self._drawOverlay();
                self._updateRegionListUI();
                e.preventDefault();
            }
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

        this._onResize = function() { self._fitImageToView(); };
        window.addEventListener('resize', this._onResize);
    },

    // ========================================
    //   Image Loading
    // ========================================

    _loadImage: function(file) {
        var self = this;
        if (!file || !file.type.match(/image\//)) { this._showToast('请选择图片文件', true); return; }
        var match = file.name.match(/img_(\d+)(?:-(\d+))?/i);
        var foodId = match ? parseInt(match[1]) || 1 : 1;
        var morphIdx = match ? parseInt(match[2]) || 1 : 1;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var entry = self._makeImageEntry(file, img, file.name, foodId, morphIdx);
                self.state.imageList.push(entry);
                // 按 foodId 排序，morphIndex 为次要排序
                self.state.imageList.sort(function(a, b) { return a.foodId - b.foodId || a.morphIndex - b.morphIndex; });
                self.state.activeImageIndex = self.state.imageList.indexOf(entry);
                var empty = self._q('#ttEmptyState');
                if (empty) empty.style.display = 'none';
                self._activateImage(self.state.activeImageIndex);
                self._updateThumbnailListUI();
                self._showToast('已加载: ' + file.name + (match ? ' | ID=' + foodId + ' 形态=' + morphIdx : ''));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _activateImage: function(index) {
        if (index < 0 || index >= this.state.imageList.length) return;
        // 保存当前 entry 的设置到 UI 控件
        var oldEntry = this._getCurrentEntry();
        if (oldEntry) {
            var slider = this._q('#colliderSimplify');
            if (slider) oldEntry.colliderTargetCount = parseInt(slider.value) || 6;
            var ctSel = this._q('#colliderType');
            if (ctSel) oldEntry.colliderType = ctSel.value;
            var clickScaleEl = this._q('#exportClickAreaScale');
            if (clickScaleEl) oldEntry.clickAreaScale = parseFloat(clickScaleEl.value) || 1.0;
            var clickRotEl = this._q('#exportRotation');
            if (clickRotEl) oldEntry.clickAreaRotation = parseInt(clickRotEl.value) || 0;
        }
        this.state.activeImageIndex = index;
        var entry = this.state.imageList[index];
        // 恢复当前 entry 的设置到 UI 控件
        var slider = this._q('#colliderSimplify');
        if (slider) {
            slider.value = entry.colliderTargetCount || 6;
            var valEl = this._overlay ? this._overlay.querySelector('[data-range-val="colliderSimplify"]') : null;
            if (valEl) valEl.textContent = slider.value;
        }
        var ctSel2 = this._q('#colliderType');
        if (ctSel2) ctSel2.value = entry.colliderType || 'auto';
        var clickScaleEl2 = this._q('#exportClickAreaScale');
        if (clickScaleEl2) { clickScaleEl2.value = entry.clickAreaScale || 1.0; localStorage.setItem('vs5_pref_exportClickAreaScale', clickScaleEl2.value); var csv = this._overlay ? this._overlay.querySelector('[data-range-val="exportClickAreaScale"]') : null; if (csv) csv.textContent = clickScaleEl2.value; }
        var clickRotEl2 = this._q('#exportRotation');
        if (clickRotEl2) { clickRotEl2.value = entry.clickAreaRotation || 0; localStorage.setItem('vs5_pref_exportRotation', clickRotEl2.value); var crv = this._overlay ? this._overlay.querySelector('[data-range-val="exportRotation"]') : null; if (crv) crv.textContent = clickRotEl2.value + '°'; }
        var wrapper = this._q('#ttCanvasWrapper');
        var hint = this._q('#ttCanvasHint');
        if (wrapper) wrapper.style.display = 'block';
        if (hint) hint.style.display = 'block';
        this._q('#ttDetectSection').style.display = 'block';
        this._q('#ttColliderSection').style.display = 'block';
        this._q('#ttExportSection').style.display = 'block';
        var rPanel = this._q('#ttRightPanel');
        if (rPanel) rPanel.style.display = 'flex';
        // 更新输出参数
        var fiEl = this._q('#exportStartFoodId');
        if (fiEl) fiEl.value = entry.foodId;
        var miEl = this._q('#exportMorphIndex');
        if (miEl) miEl.value = entry.morphIndex;
        this._fitImageToView();
        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
        this._updateThumbnailListUI();
        // 自动开启编辑
        if (entry.regions.length > 0 && !entry.colliderEditActive) {
            this._toggleColliderEdit();
        }
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
        var self = this;
        // 按 foodId 数字排序，morphIndex 次要
        var curEntry = self.state.imageList[self.state.activeImageIndex];
        self.state.imageList.sort(function(a, b) { return a.foodId - b.foodId || a.morphIndex - b.morphIndex; });
        if (curEntry) self.state.activeImageIndex = self.state.imageList.indexOf(curEntry);
        var sorted = self.state.imageList;
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
                    '<span class="tt-thumb-name">' + entry.fileName + '</span>' +
                    '<span class="tt-thumb-size">' + dims + '</span>' +
                    '<span class="tt-thumb-badge">M' + entry.morphIndex + '</span>' +
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
            var wrapper = this._q('#ttCanvasWrapper');
            if (wrapper) wrapper.style.display = 'none';
            var empty = this._q('#ttEmptyState');
            if (empty) empty.style.display = 'block';
            this._q('#ttDetectSection').style.display = 'none';
            this._q('#ttColliderSection').style.display = 'none';
            this._q('#ttExportSection').style.display = 'none';
            this._updateThumbnailListUI();
            return;
        }
        if (index <= this.state.activeImageIndex) {
            this.state.activeImageIndex = Math.max(0, this.state.activeImageIndex - 1);
        }
        this._activateImage(this.state.activeImageIndex);
        this._updateThumbnailListUI();
    },

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
        // 计算图片在画布中的居中偏移
        entry._imgOx = Math.round((w - img.width * s) / 2);
        entry._imgOy = Math.round((h - img.height * s) / 2);
        this._resizeCanvases();
    },

    _resizeCanvases: function() {
        var entry = this._getCurrentEntry();
        if (!entry) return;
        var img = entry.originalImage;
        if (!img) return;
        var wrapper = this._q('#ttCanvasWrapper');
        var w = wrapper ? wrapper.clientWidth : img.width;
        var h = wrapper ? wrapper.clientHeight : img.height;
        this._mainCanvas.width = w;
        this._mainCanvas.height = h;
        this._overlayCanvas.width = w;
        this._overlayCanvas.height = h;
        this._drawMain();
        this._drawOverlay();
    },

    _zoomCanvas: function(factor, e) {
        var entry = this._getCurrentEntry(); if (!entry) return;

        var img = entry.originalImage;
        if (!img) return;
        var oldScale = this.state.scale;
        var newScale = Math.max(0.1, Math.min(4, oldScale * factor));
        if (newScale === oldScale) return;

        var wrapper = this._q('#ttCanvasWrapper');
        if (e) {
            var rect = wrapper.getBoundingClientRect();
            var imgX = (e.clientX - rect.left + wrapper.scrollLeft) / oldScale;
            var imgY = (e.clientY - rect.top + wrapper.scrollTop) / oldScale;
            this.state.scale = newScale;
            this._resizeCanvases();
            wrapper.scrollLeft = imgX * newScale - (e.clientX - rect.left);
            wrapper.scrollTop = imgY * newScale - (e.clientY - rect.top);
        } else {
            var cx = wrapper.clientWidth / 2 + wrapper.scrollLeft;
            var cy = wrapper.clientHeight / 2 + wrapper.scrollTop;
            var imgX = cx / oldScale, imgY = cy / oldScale;
            this.state.scale = newScale;
            this._resizeCanvases();
            wrapper.scrollLeft = imgX * newScale - wrapper.clientWidth / 2;
            wrapper.scrollTop = imgY * newScale - wrapper.clientHeight / 2;
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
        var ox = entry._imgOx || 0;
        var oy = entry._imgOy || 0;
        var sw = Math.round(img.width * this.state.scale);
        var sh = Math.round(img.height * this.state.scale);
        if (entry.processedImageData) {
            var tmpC = document.createElement('canvas');
            tmpC.width = img.width;
            tmpC.height = img.height;
            tmpC.getContext('2d').putImageData(entry.processedImageData, 0, 0);
            this._mainCtx.drawImage(tmpC, ox, oy, sw, sh);
        } else {
            this._mainCtx.drawImage(img, ox, oy, sw, sh);
        }
    },

    _drawOverlay: function() {
        var entry = this._getCurrentEntry(); if (!entry) { this._clearCanvases(); return; }

        this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
        if (!entry.overlayVisible || !entry.regions.length) return;

        var regions = entry.regions;
        var s = this.state.scale;
        var ox = entry._imgOx || 0;
        var oy = entry._imgOy || 0;
        var ctx = this._overlayCtx;
        var self = this;

        // 构建像素叠加层
        var img = entry.originalImage;
        var w = img ? img.width : 0, h = img ? img.height : 0;
        if (w === 0) return;

        var offC = document.createElement('canvas');
        offC.width = w; offC.height = h;
        var offCtx = offC.getContext('2d');
        var imgData = offCtx.createImageData(w, h);
        var d = imgData.data;

        regions.forEach(function(region, ri) {
            var color = self.REGION_COLORS[ri % self.REGION_COLORS.length];
            var isSelected = ri === entry.selectedRegion;
            var isInnerChecked = !!entry.innerSelectedRegions[ri];
            var pixelSet = region.pixelSet;

            // 绘制精灵边缘高亮
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
                        d[idx] = isSelected ? 255 : color.r || parseInt(color.slice(1,3),16);
                        d[idx + 1] = isSelected ? 255 : color.g || parseInt(color.slice(3,5),16);
                        d[idx + 2] = isSelected ? 255 : color.b || parseInt(color.slice(5,7),16);
                        d[idx + 3] = isSelected ? 220 : 160;
                    }
                }
            });
        });

        offCtx.putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = true;
        var sw = Math.round(w * s);
        var sh = Math.round(h * s);
        ctx.drawImage(offC, ox, oy, sw, sh);

        // 选中精灵的边框 + 编号
        if (entry.selectedRegion >= 0 && entry.selectedRegion < regions.length) {
            var sr = regions[entry.selectedRegion];
            var b = sr.bounds;
            var bx = ox + b.x * s, by = oy + b.y * s, bw = b.w * s, bh = b.h * s;
            ctx.strokeStyle = '#ffab00';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffab00';
            ctx.font = 'bold 11px sans-serif';
            var label = '#' + (entry.selectedRegion + 1) + ' ' + b.w + '-' + b.h + 'px';
            if (entry.fileName || "") label += ' ' + entry.fileName || "";
            ctx.fillText(label, bx, by - 8);

            // clickArea 预览（始终显示，蓝色半透明旋转框 = Cocos 点击区域）
            var clickScale = (entry.clickAreaScale != null) ? entry.clickAreaScale : (parseFloat(this._q('#exportClickAreaScale').value) || 1.0);
            var rotZ = (entry.clickAreaRotation != null) ? entry.clickAreaRotation : (parseFloat(this._q('#exportRotation').value) || 0);
            var cw = Math.round(b.w * clickScale);
            var ch = Math.round(b.h * clickScale);
            var cxc = ox + b.x * s + b.w * s / 2;
            var cyc = oy + b.y * s + b.h * s / 2;
            ctx.save();
            ctx.translate(cxc, cyc);
            ctx.rotate(rotZ * Math.PI / 180);
            ctx.strokeStyle = 'rgba(41, 121, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(-cw * s / 2, -ch * s / 2, cw * s, ch * s);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(41, 121, 255, 0.08)';
            ctx.fillRect(-cw * s / 2, -ch * s / 2, cw * s, ch * s);
            ctx.restore();
            ctx.fillStyle = '#2979ff';
            ctx.font = '10px sans-serif';
            ctx.fillText('ClickArea ' + cw + '-' + ch + 'px 旋转' + rotZ + '°', bx, by - 20);

            // 碰撞体预览（根据类型渲染）
            if (entry.regions.length > 0) {
                var colliderType = this._q('#colliderType').value;
                if (colliderType === 'auto' && sr) {
                    colliderType = this._detectColliderType(sr);
                }
                var centerX = b.x + b.w / 2;
                var centerY = b.y + b.h / 2;
                var isEdit = entry.colliderEditActive;
                ctx.strokeStyle = '#00c853';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);

                if (colliderType === 'box') {
                    var boxParams = this._getBoxParams(entry, sr);
                    var boxCX = centerX + boxParams.ox;
                    var boxCY = centerY - boxParams.oy;
                    var bx0 = ox + (boxCX - boxParams.w / 2) * s;
                    var by0 = oy + (boxCY - boxParams.h / 2) * s;
                    ctx.strokeRect(bx0, by0, boxParams.w * s, boxParams.h * s);
                    if (isEdit) {
                        ctx.fillStyle = '#00c853';
                        for (var hci = 0; hci < 4; hci++) {
                            var hpt = this._getBoxCornerImagePos(sr, boxParams, hci);
                            ctx.fillRect(ox + hpt.x * s - 4, oy + hpt.y * s - 4, 8, 8);
                        }
                    }
                    var label = 'BoxCollider ' + Math.round(boxParams.w) + 'x' + Math.round(boxParams.h);
                    if (boxParams.ox !== 0 || boxParams.oy !== 0) label += ' 偏移(' + boxParams.ox + ',' + boxParams.oy + ')';
                    ctx.fillStyle = '#00c853';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.fillText(label, bx + 4, by + bh + 14);
                } else if (colliderType === 'circle') {
                    var circleParams = this._getCircleParams(entry, sr);
                    var circCX = centerX + circleParams.ox;
                    var circCY = centerY - circleParams.oy;
                    ctx.beginPath();
                    ctx.arc(ox + circCX * s, oy + circCY * s, circleParams.r * s, 0, Math.PI * 2);
                    ctx.stroke();
                    // 十字参考线
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(ox + circCX * s - circleParams.r * s, oy + circCY * s);
                    ctx.lineTo(ox + circCX * s + circleParams.r * s, oy + circCY * s);
                    ctx.moveTo(ox + circCX * s, oy + circCY * s - circleParams.r * s);
                    ctx.lineTo(ox + circCX * s, oy + circCY * s + circleParams.r * s);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    if (isEdit) {
                        // 黄色半径 handle（右侧边缘）
                        ctx.fillStyle = '#ffd600';
                        ctx.fillRect(ox + (circCX + circleParams.r) * s - 4, oy + circCY * s - 4, 8, 8);
                    }
                    var label2 = 'CircleCollider r=' + Math.round(circleParams.r);
                    if (circleParams.ox !== 0 || circleParams.oy !== 0) label2 += ' 偏移(' + circleParams.ox + ',' + circleParams.oy + ')';
                    ctx.fillStyle = '#00c853';
                    ctx.font = 'bold 10px sans-serif';
                    ctx.fillText(label2, bx + 4, by + bh + 14);
                } else {
                    // 多边形预览
                    var colliderPoints = [];
                    try { colliderPoints = this._extractColliderPoints(sr); } catch(e) { console.error('collider error', e); }
                    if (colliderPoints.length >= 3) {
                        ctx.beginPath();
                        for (var pi = 0; pi < colliderPoints.length; pi++) {
                            var px2 = ox + (centerX + colliderPoints[pi].x) * s;
                            var py2 = oy + (centerY - colliderPoints[pi].y) * s;
                            if (pi === 0) ctx.moveTo(px2, py2);
                            else ctx.lineTo(px2, py2);
                        }
                        ctx.closePath();
                        ctx.stroke();
                        // 顶点圆点 + 始终显示编号
                        colliderPoints.forEach(function(pt, idx) {
                            var cx3 = ox + (centerX + pt.x) * s;
                            var cy3 = oy + (centerY - pt.y) * s;
                            var r = isEdit ? 7 : 5;
                            ctx.fillStyle = '#00c853';
                            ctx.beginPath();
                            ctx.arc(cx3, cy3, r, 0, Math.PI * 2);
                            ctx.fill();
                            ctx.fillStyle = '#fff';
                            ctx.beginPath();
                            ctx.arc(cx3, cy3, isEdit ? 4 : 3, 0, Math.PI * 2);
                            ctx.fill();
                            // 始终显示编号
                            ctx.fillStyle = '#fff';
                            ctx.font = 'bold 10px sans-serif';
                            ctx.textAlign = 'center';
                            ctx.fillText(idx + 1, cx3, cy3 + 3);
                            ctx.textAlign = 'start';
                        });
                        // 编辑模式下显示提示
                        if (isEdit) {
                            ctx.fillStyle = 'rgba(0,200,83,0.15)';
                            ctx.fillRect(bx, by + bh + 6, 160, 18);
                            ctx.fillStyle = '#00c853';
                            ctx.font = '10px sans-serif';
                            ctx.fillText('拖拽绿色圆点调整碰撞体', bx + 4, by + bh + 18);
                        }
                    }
                }
            }
        }
    },

    // ========================================
    //   Smart Detect (移植自 tile-tool BFS)
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
                        }
                        totalDetected += result.regions.length;
                    }
                }
                // 激活当前或第一个有检测结果的图片
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
                // 自动开启编辑顶点
                var activeEntry = self._getCurrentEntry();
                if (activeEntry && activeEntry.regions.length > 0 && !activeEntry.colliderEditActive) {
                    self._toggleColliderEdit();
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

        // 8-连通 BFS 提取精灵
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
    //   Region List UI
    // ========================================

    _updateRegionListUI: function() {},
    _selectAllRegions: function(select) {},
    _invertRegionSelection: function() {},

    // ========================================
    //   Mouse Interactions
    // ========================================

    _onMouseDown: function(e) {
        var entry = this._getCurrentEntry(); if (!entry) return;

        if (e.button === 2) {
            this.state.canvasPanning = { startX: e.clientX, startY: e.clientY };
            this._overlayCanvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        var rect = this._overlayCanvas.getBoundingClientRect();
        var cssW = rect.width, cssH = rect.height;
        var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
        var ratioX = pxW / cssW, ratioY = pxH / cssH;
        var mx = (e.clientX - rect.left) * ratioX - (entry._imgOx || 0);
        var my = (e.clientY - rect.top) * ratioY - (entry._imgOy || 0);
        var s = this.state.scale;

        // 碰撞体编辑模式
        if (entry.colliderEditActive && entry.selectedRegion >= 0) {
            var now = Date.now();
            var sr = entry.regions[entry.selectedRegion];
            var ct = this._q('#colliderType').value;
            if (ct === 'auto' && sr) ct = this._detectColliderType(sr);

            if (ct === 'polygon') {
                var hitIdx = this._hitTestColliderPoint(mx, my);
                // 双击顶点 → 删除
                if (hitIdx >= 0) {
                    if (this.state._lastClickTime && (now - this.state._lastClickTime) < 350 && hitIdx === this.state._lastClickIdx) {
                        var pts = this._extractColliderPoints(sr);
                        if (pts.length > 3) {
                            pts.splice(hitIdx, 1);
                            entry.colliderCustomPoints[sr.id] = pts;
                            this._syncColliderSlider(pts.length);
                            this._drawOverlay();
                            this._showToast('已删除顶点 #' + (hitIdx + 1));
                        } else {
                            this._showToast('至少保留 3 个顶点', true);
                        }
                        this.state._lastClickTime = 0;
                        this.state._lastClickIdx = -1;
                        return;
                    }
                    this.state._lastClickTime = now;
                    this.state._lastClickIdx = hitIdx;
                    entry.colliderDragIdx = hitIdx;
                    entry.colliderDragMode = 'vertex';
                    this._overlayCanvas.style.cursor = 'grabbing';
                    return;
                }
                // 双击线段 → 插入顶点
                var segHit = this._hitTestColliderSegment(mx, my);
                if (segHit) {
                    if (this.state._lastSegClickTime && (now - this.state._lastSegClickTime) < 350 && segHit.segIdx === this.state._lastSegIdx) {
                        var pts2 = this._extractColliderPoints(sr);
                        if (pts2.length < 8) {
                            pts2.splice(segHit.segIdx + 1, 0, segHit.insertPt);
                            entry.colliderCustomPoints[sr.id] = pts2;
                            this._syncColliderSlider(pts2.length);
                            this._drawOverlay();
                            this._showToast('已插入顶点 #' + (segHit.segIdx + 2));
                        } else {
                            this._showToast('最多 8 个顶点', true);
                        }
                        this.state._lastSegClickTime = 0;
                        this.state._lastSegIdx = -1;
                        return;
                    }
                    this.state._lastSegClickTime = now;
                    this.state._lastSegIdx = segHit.segIdx;
                    return;
                }
                // 单击空白处清除双击状态
                this.state._lastClickTime = 0;
                this.state._lastClickIdx = -1;
                this.state._lastSegClickTime = 0;
                this.state._lastSegIdx = -1;
            } else if (ct === 'box') {
                var boxCorner = this._hitTestBoxCorner(mx, my);
                if (boxCorner >= 0) {
                    entry.colliderDragMode = 'boxCorner';
                    entry.colliderDragCorner = boxCorner;
                    var bp = this._getBoxParams(entry, sr);
                    entry.colliderDragStart = { mx: mx, my: my, params: { ox: bp.ox, oy: bp.oy, w: bp.w, h: bp.h } };
                    this._overlayCanvas.style.cursor = 'nesw-resize';
                    return;
                }
                var boxBody = this._hitTestBoxBody(mx, my);
                if (boxBody) {
                    entry.colliderDragMode = 'boxMove';
                    var bp2 = this._getBoxParams(entry, sr);
                    entry.colliderDragStart = { mx: mx / s, my: my / s, params: { ox: bp2.ox, oy: bp2.oy } };
                    this._overlayCanvas.style.cursor = 'move';
                    return;
                }
            } else if (ct === 'circle') {
                var circHandle = this._hitTestCircleHandle(mx, my);
                if (circHandle) {
                    entry.colliderDragMode = 'circleRadius';
                    var cp = this._getCircleParams(entry, sr);
                    entry.colliderDragStart = { mx: mx, my: my, params: { r: cp.r } };
                    this._overlayCanvas.style.cursor = 'ew-resize';
                    return;
                }
                var circBody = this._hitTestCircleBody(mx, my);
                if (circBody) {
                    entry.colliderDragMode = 'circleMove';
                    var cp2 = this._getCircleParams(entry, sr);
                    entry.colliderDragStart = { mx: mx / s, my: my / s, params: { ox: cp2.ox, oy: cp2.oy } };
                    this._overlayCanvas.style.cursor = 'move';
                    return;
                }
            }
        }

        // Transform mode (移动/缩放)
        if (this.state.transformMode === 'move' && entry.selectedRegion >= 0) {
            var sr = entry.regions[entry.selectedRegion];
            if (sr) {
                var bx = sr.bounds.x * s, by = sr.bounds.y * s;
                var bw = sr.bounds.w * s, bh = sr.bounds.h * s;
                // 缩放手柄
                if (mx >= bx + bw - 12 && mx <= bx + bw + 6 && my >= by + bh - 12 && my <= by + bh + 6) {
                    this.state._scaleFromCorner = 'br';
                    this.state.transformDrag = true;
                    this.state.transformStart = { mx: mx, my: my, imgX: mx / s, imgY: my / s };
                    this.state.transformInitBounds = { x: sr.bounds.x, y: sr.bounds.y, w: sr.bounds.w, h: sr.bounds.h };
                    this._overlayCanvas.style.cursor = 'grabbing';
                    return;
                }
                // 精灵主体（移动）
                var px = Math.floor(mx / s), py = Math.floor(my / s);
                if (px >= sr.bounds.x && px < sr.bounds.x + sr.bounds.w &&
                    py >= sr.bounds.y && py < sr.bounds.y + sr.bounds.h) {
                    this.state.transformDrag = true;
                    this.state.transformStart = { mx: mx, my: my, imgX: mx / s, imgY: my / s };
                    this._overlayCanvas.style.cursor = 'grabbing';
                    return;
                }
            }
        }

        // 选取精灵
        var found = -1;
        for (var i = entry.regions.length - 1; i >= 0; i--) {
            var r = entry.regions[i];
            if (Math.floor(mx / s) >= r.bounds.x && Math.floor(mx / s) < r.bounds.x + r.bounds.w &&
                Math.floor(my / s) >= r.bounds.y && Math.floor(my / s) < r.bounds.y + r.bounds.h) {
                if (r.pixelSet && r.pixelSet[Math.floor(my / s) * entry.originalImage.width + Math.floor(mx / s)]) {
                    found = i; break;
                }
            }
        }
        entry.selectedRegion = found;
        this._drawOverlay();
        this._updateRegionListUI();
    },

    _onMouseMove: function(e) {
        var entry = this._getCurrentEntry(); if (!entry) return;

        if (this.state.canvasPanning) {
            var wrapper = this._q('#ttCanvasWrapper');
            if (wrapper) {
                wrapper.scrollLeft += this.state.canvasPanning.startX - e.clientX;
                wrapper.scrollTop += this.state.canvasPanning.startY - e.clientY;
                this.state.canvasPanning = { startX: e.clientX, startY: e.clientY };
            }
            return;
        }

        var rect = this._overlayCanvas.getBoundingClientRect();
        var cssW = rect.width, cssH = rect.height;
        var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
        var mx = (e.clientX - rect.left) * (pxW / cssW) - (entry._imgOx || 0);
        var my = (e.clientY - rect.top) * (pxH / cssH) - (entry._imgOy || 0);
        var s = this.state.scale;

        // 碰撞体拖拽中
        if (entry.colliderEditActive && entry.selectedRegion >= 0) {
            var srDrag = entry.regions[entry.selectedRegion];
            if (srDrag) {
                var bDr = srDrag.bounds;
                var centerXDr = bDr.x + bDr.w / 2;
                var centerYDr = bDr.y + bDr.h / 2;
                var imgXDr = mx / s;
                var imgYDr = my / s;

                if (entry.colliderDragMode === 'vertex') {
                    var newPt = {
                        x: Math.round((imgXDr - centerXDr) * 10) / 10,
                        y: Math.round(-(imgYDr - centerYDr) * 10) / 10
                    };
                    var points = this._extractColliderPoints(srDrag);
                    if (entry.colliderDragIdx < points.length) {
                        points[entry.colliderDragIdx] = newPt;
                        if (!entry.colliderCustomPoints) entry.colliderCustomPoints = {};
                        entry.colliderCustomPoints[srDrag.id] = points;
                        this._drawOverlay();
                    }
                    return;
                }

                if (entry.colliderDragMode === 'boxCorner') {
                    var ds = entry.colliderDragStart;
                    var oppCorner = (entry.colliderDragCorner + 2) % 4;
                    var oppParams = { ox: ds.params.ox, oy: ds.params.oy, w: ds.params.w, h: ds.params.h };
                    var oppPtImg = this._getBoxCornerImagePos(srDrag, oppParams, oppCorner);
                    var newCX = (imgXDr + oppPtImg.x) / 2;
                    var newCY = (imgYDr + oppPtImg.y) / 2;
                    var newW = Math.max(4, Math.abs(imgXDr - oppPtImg.x));
                    var newH = Math.max(4, Math.abs(imgYDr - oppPtImg.y));
                    var newOX = Math.round((newCX - centerXDr) * 10) / 10;
                    var newOY = Math.round(-(newCY - centerYDr) * 10) / 10;
                    if (!entry.colliderBoxCustom) entry.colliderBoxCustom = {};
                    entry.colliderBoxCustom[srDrag.id] = { ox: newOX, oy: newOY, w: Math.round(newW), h: Math.round(newH) };
                    this._drawOverlay();
                    return;
                }

                if (entry.colliderDragMode === 'boxMove') {
                    var ds2 = entry.colliderDragStart;
                    var dImgX = imgXDr - ds2.mx;
                    var dImgY = imgYDr - ds2.my;
                    var newOX2 = Math.round((ds2.params.ox + dImgX) * 10) / 10;
                    var newOY2 = Math.round((ds2.params.oy - dImgY) * 10) / 10;
                    if (!entry.colliderBoxCustom) entry.colliderBoxCustom = {};
                    var curBp = this._getBoxParams(entry, srDrag);
                    entry.colliderBoxCustom[srDrag.id] = { ox: newOX2, oy: newOY2, w: curBp.w, h: curBp.h };
                    this._drawOverlay();
                    return;
                }

                if (entry.colliderDragMode === 'circleRadius') {
                    var cp = this._getCircleParams(entry, srDrag);
                    var circCX = centerXDr + cp.ox;
                    var circCY = centerYDr - cp.oy;
                    var dist = Math.sqrt((imgXDr - circCX) * (imgXDr - circCX) + (imgYDr - circCY) * (imgYDr - circCY));
                    var newR = Math.max(2, Math.round(dist));
                    if (!entry.colliderCircleCustom) entry.colliderCircleCustom = {};
                    entry.colliderCircleCustom[srDrag.id] = { ox: cp.ox, oy: cp.oy, r: newR };
                    this._drawOverlay();
                    return;
                }

                if (entry.colliderDragMode === 'circleMove') {
                    var ds4 = entry.colliderDragStart;
                    var dImgX2 = imgXDr - ds4.mx;
                    var dImgY2 = imgYDr - ds4.my;
                    var newOX3 = Math.round((ds4.params.ox + dImgX2) * 10) / 10;
                    var newOY3 = Math.round((ds4.params.oy - dImgY2) * 10) / 10;
                    if (!entry.colliderCircleCustom) entry.colliderCircleCustom = {};
                    var curCp = this._getCircleParams(entry, srDrag);
                    entry.colliderCircleCustom[srDrag.id] = { ox: newOX3, oy: newOY3, r: curCp.r };
                    this._drawOverlay();
                    return;
                }
            }
        }

        // Transform drag preview
        if (this.state.transformDrag) {
            this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
            if (entry.overlayVisible) {
                this._drawOverlay();
                // 不覆盖绘制，直接在 overlay 上画预览框
            }
            var sr = entry.regions[entry.selectedRegion];
            if (sr) {
                var ctx = this._overlayCtx;
                if (this.state._scaleFromCorner && this.state.transformInitBounds) {
                    var ib = this.state.transformInitBounds;
                    var nw = Math.max(4, (mx / s) - ib.x);
                    var nh = Math.max(4, (my / s) - ib.y);
                    var sf = Math.max(nw / ib.w, nh / ib.h);
                    var pw = Math.round(ib.w * sf);
                    var ph = Math.round(ib.h * sf);
                    ctx.strokeStyle = '#ffab00';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 3]);
                    ctx.strokeRect(ib.x * s, ib.y * s, pw * s, ph * s);
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#ffab00';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillText(pw + '-' + ph + 'px', ib.x * s, ib.y * s - 16);
                } else {
                    var dx = (mx / s) - this.state.transformStart.imgX;
                    var dy = (my / s) - this.state.transformStart.imgY;
                    var ox = Math.round(dx), oy = Math.round(dy);
                    ctx.strokeStyle = '#ffab00';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([6, 4]);
                    ctx.strokeRect((sr.bounds.x + ox) * s, (sr.bounds.y + oy) * s, sr.bounds.w * s, sr.bounds.h * s);
                    ctx.setLineDash([]);
                }
            }
            return;
        }

        this._overlayCanvas.style.cursor = 'pointer';
    },

    _onMouseUp: function(e) {
        var entry = this._getCurrentEntry(); if (!entry) return;

        // 碰撞体拖拽松手
        if (entry.colliderDragMode) {
            entry.colliderDragMode = null;
            entry.colliderDragIdx = -1;
            entry.colliderDragCorner = -1;
            entry.colliderDragStart = null;
            this._overlayCanvas.style.cursor = 'pointer';
            return;
        }

        if (this.state.canvasPanning) {
            this.state.canvasPanning = null;
            this._overlayCanvas.style.cursor = 'pointer';
            return;
        }
        if (this.state.transformDrag) {
            this.state.transformDrag = false;
            if (this.state._scaleFromCorner && entry.selectedRegion >= 0 && this.state.transformInitBounds) {
                var rect = this._overlayCanvas.getBoundingClientRect();
                var cx = (e.clientX - rect.left) * (this._overlayCanvas.width / rect.width);
                var cy = (e.clientY - rect.top) * (this._overlayCanvas.height / rect.height);
                this._applyScaleTransform(cx / this.state.scale, cy / this.state.scale);
                this.state._scaleFromCorner = null;
            } else if (this.state.transformMode === 'move' && entry.selectedRegion >= 0) {
                var rect2 = this._overlayCanvas.getBoundingClientRect();
                var cx2 = (e.clientX - rect2.left) * (this._overlayCanvas.width / rect2.width);
                var cy2 = (e.clientY - rect2.top) * (this._overlayCanvas.height / rect2.height);
                this._applyMoveTransform(cx2 / this.state.scale, cy2 / this.state.scale);
            }
            this.state.transformStart = null;
            this.state.transformInitBounds = null;
            this._overlayCanvas.style.cursor = 'pointer';
        }
    },

    // ========================================
    //   Transform
    // ========================================

    _saveUndoState: function() {
        var entry = this._getCurrentEntry(); if (!entry) return;

        if (!entry.processedImageData) return;
        var src = entry.processedImageData;
        var snapshot = {
            imageData: new ImageData(new Uint8ClampedArray(src.data), src.width, src.height),
            regionData: entry.regions.map(function(r) {
                return {
                    pixels: r.pixels.slice(),
                    bounds: r.bounds,
                    area: r.area,
                    color: r.color,
                    id: r.id
                };
            }),
            innerProtectMask: null
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
            if (snapshot.regionData) {
                var w = snapshot.imageData.width;
                entry.regions = snapshot.regionData.map(function(r) {
                    var pixels = r.pixels.map(function(p) { return [p[0], p[1]]; });
                    var ps = new Uint8Array(w * snapshot.imageData.height);
                    pixels.forEach(function(p) { ps[p[1] * w + p[0]] = 1; });
                    return {
                        id: r.id, pixels: pixels, pixelSet: ps,
                        bounds: r.bounds, area: r.area, color: r.color
                    };
                });
            }
        }
        entry.selectedRegion = -1;
        entry.innerSelectedRegions = {};
        this._drawMain();
        this._drawOverlay();
        self._updateRegionListUI();
        this._showToast('已撤销');
    },

    _applyMoveTransform: function(mouseImgX, mouseImgY) {
        var entry = this._getCurrentEntry(); if (!entry) return;

        if (entry.selectedRegion < 0 || !this.state.transformStart) return;
        this._saveUndoState();
        var region = entry.regions[entry.selectedRegion];
        if (!region) return;
        var dx = Math.round(mouseImgX - this.state.transformStart.imgX);
        var dy = Math.round(mouseImgY - this.state.transformStart.imgY);
        if (dx === 0 && dy === 0) return;

        var w = entry.originalImage.width, h = entry.originalImage.height;
        var imgData = entry.processedImageData;
        var data = imgData.data;

        // 其它精灵保护 mask
        var otherMask = new Uint8Array(w * h);
        for (var oi = 0; oi < entry.regions.length; oi++) {
            if (oi === entry.selectedRegion) continue;
            var ops = entry.regions[oi].pixelSet;
            if (ops) { for (var oj = 0; oj < ops.length; oj++) { if (ops[oj]) otherMask[oj] = 1; } }
        }

        // 缓存源像素
        var srcPixels = [];
        region.pixels.forEach(function(p) {
            var si = (p[1] * w + p[0]) * 4;
            srcPixels.push({ x: p[0], y: p[1], r: data[si], g: data[si+1], b: data[si+2], a: data[si+3] });
        });

        // 清除原位置
        region.pixels.forEach(function(p) {
            var pi = (p[1] * w + p[0]) * 4;
            if (!otherMask[p[1] * w + p[0]]) data[pi + 3] = 0;
        });

        // 写新位置
        var newPixels = [];
        var newPS = new Uint8Array(w * h);
        srcPixels.forEach(function(sp) {
            var nx = sp.x + dx, ny = sp.y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) return;
            if (otherMask[ny * w + nx]) return;
            var ti = (ny * w + nx) * 4;
            data[ti] = sp.r; data[ti+1] = sp.g; data[ti+2] = sp.b; data[ti+3] = sp.a;
            if (!newPS[ny * w + nx]) { newPS[ny * w + nx] = 1; newPixels.push([nx, ny]); }
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

        this._drawMain();
        this._drawOverlay();
        this._updateRegionListUI();
    },

    _applyScaleTransform: function(mouseImgX, mouseImgY) {
        var entry = this._getCurrentEntry(); if (!entry) return;

        if (entry.selectedRegion < 0 || !this.state.transformInitBounds || !entry.processedImageData) return;
        this._saveUndoState();
        var region = entry.regions[entry.selectedRegion];
        if (!region) return;
        var ib = this.state.transformInitBounds;
        var imgData = entry.processedImageData;
        var data = imgData.data;
        var w = imgData.width, h = imgData.height;

        var newW = Math.max(4, mouseImgX - ib.x);
        var newH = Math.max(4, mouseImgY - ib.y);
        var sf = Math.max(newW / ib.w, newH / ib.h);
        sf = Math.max(0.05, Math.min(10, sf));
        var dstW = Math.round(ib.w * sf);
        var dstH = Math.round(ib.h * sf);

        // 其它精灵保护
        var otherMask = new Uint8Array(w * h);
        for (var oi = 0; oi < entry.regions.length; oi++) {
            if (oi === entry.selectedRegion) continue;
            var ops = entry.regions[oi].pixelSet;
            if (ops) { for (var oj = 0; oj < ops.length; oj++) { if (ops[oj]) otherMask[oj] = 1; } }
        }

        // 快照 + 抠出精灵
        var snapshotData = new Uint8ClampedArray(imgData.data);
        var srcC = document.createElement('canvas');
        srcC.width = ib.w; srcC.height = ib.h;
        var srcCtx = srcC.getContext('2d');
        var snapImageData = new ImageData(snapshotData, w, h);
        var tempC = document.createElement('canvas');
        tempC.width = w; tempC.height = h;
        tempC.getContext('2d').putImageData(snapImageData, 0, 0);
        srcCtx.drawImage(tempC, ib.x, ib.y, ib.w, ib.h, 0, 0, ib.w, ib.h);
        // 去掉非精灵像素
        var srcImgData = srcCtx.getImageData(0, 0, ib.w, ib.h);
        var srcPx = srcImgData.data;
        for (var si = 0; si < ib.w * ib.h; si++) {
            var gx = ib.x + (si % ib.w), gy = ib.y + Math.floor(si / ib.w);
            if (!region.pixelSet || !region.pixelSet[gy * w + gx]) srcPx[si * 4 + 3] = 0;
        }
        srcCtx.putImageData(srcImgData, 0, 0);

        // 清除旧范围
        for (var cy = ib.y; cy < ib.y + ib.h && cy < h; cy++) {
            for (var cx2 = ib.x; cx2 < ib.x + ib.w && cx2 < w; cx2++) {
                if (!otherMask[cy * w + cx2]) data[(cy * w + cx2) * 4 + 3] = 0;
            }
        }

        // 缩放
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
                data[tgtIdx+1] = dstPx[dpi+1];
                data[tgtIdx+2] = dstPx[dpi+2];
                data[tgtIdx+3] = da;
                if (!newPS[dy2 * w + dx2]) {
                    newPS[dy2 * w + dx2] = 1;
                    newPixels.push([dx2, dy2]);
                }
            }
        }

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

    _toggleOverlay: function() {
        var entry = this._getCurrentEntry(); if (!entry) return;

        entry.overlayVisible = !entry.overlayVisible;
        var btn = this._q('[data-action="toggleOverlay"]');
        if (btn) btn.classList.toggle('active', entry.overlayVisible);
        this._drawOverlay();
        this._showToast(entry.overlayVisible ? '轮廓线已显示' : '轮廓线已隐藏');
    },

    // ========================================
    //   Collider Generation (核心新增)
    // ========================================

    _detectColliderType: function(region) {
        var colliderSetting = this._q('#colliderType').value;
        if (colliderSetting !== 'auto') return colliderSetting;

        var b = region.bounds;
        var aspectRatio = b.w / b.h;
        if (aspectRatio > 0.8 && aspectRatio < 1.2) return 'box';
        var fillRate = region.area / (b.w * b.h);
        if (fillRate > 0.7 && aspectRatio > 0.7 && aspectRatio < 1.4) return 'circle';
        return 'polygon';
    },

    // ========================================
    //   碰撞体编辑（Box/Circle/Polygon）
    // ========================================

    _getBoxDefaultParams: function(region) {
        var b = region.bounds;
        var scale = (parseInt(this._q('#colliderScale').value) || 100) / 100;
        return { ox: 0, oy: 0, w: Math.round(b.w * 0.9 * scale), h: Math.round(b.h * 0.9 * scale) };
    },

    _getCircleDefaultParams: function(region) {
        var b = region.bounds;
        var scale = (parseInt(this._q('#colliderScale').value) || 100) / 100;
        return { ox: 0, oy: 0, r: Math.round(Math.min(b.w, b.h) * 0.45 * scale) };
    },

    _getBoxParams: function(entry, region) {
        if (!entry || !region) return this._getBoxDefaultParams(region);
        var custom = entry.colliderBoxCustom[region.id];
        return custom || this._getBoxDefaultParams(region);
    },

    _getCircleParams: function(entry, region) {
        if (!entry || !region) return this._getCircleDefaultParams(region);
        var custom = entry.colliderCircleCustom[region.id];
        return custom || this._getCircleDefaultParams(region);
    },

    _getBoxCornerImagePos: function(region, params, cornerIdx) {
        var b = region.bounds;
        var cx = b.x + b.w / 2 + params.ox;
        var cy = b.y + b.h / 2 - params.oy;
        var hw = params.w / 2, hh = params.h / 2;
        switch (cornerIdx) {
            case 0: return { x: cx - hw, y: cy - hh }; // TL
            case 1: return { x: cx + hw, y: cy - hh }; // TR
            case 2: return { x: cx + hw, y: cy + hh }; // BR
            case 3: return { x: cx - hw, y: cy + hh }; // BL
        }
    },

    _toggleColliderEdit: function() {
        var entry = this._getCurrentEntry(); if (!entry) return;

        entry.colliderEditActive = !entry.colliderEditActive;
        var btn = this._q('[data-action="toggleColliderEdit"]');
        if (btn) btn.classList.toggle('lasso-active', entry.colliderEditActive);
        if (entry.colliderEditActive) {
            var ct = this._q('#colliderType').value;
            if (ct === 'auto' && entry.selectedRegion >= 0) {
                var sr = entry.regions[entry.selectedRegion];
                if (sr) ct = this._detectColliderType(sr);
            }
            if (ct === 'box') this._showToast('拖拽绿色方块调整尺寸，拖拽内部移动碰撞体');
            else if (ct === 'circle') this._showToast('拖拽黄色圆点调整半径，拖拽内部移动碰撞体');
            else this._showToast('拖拽绿色圆点调整碰撞体');
        } else {
            this._showToast('已退出编辑模式');
        }
        this._drawOverlay();
    },

    _syncColliderSlider: function(count) {
        var entry = this._getCurrentEntry(); if (!entry) return;

        var slider = this._q('#colliderSimplify');
        var valEl = this._overlay ? (this._overlay.querySelector('[data-range-val="colliderSimplify"]')) : null;
        if (slider) slider.value = count;
        if (valEl) valEl.textContent = count;
    },

    _hitTestColliderPoint: function(mx, my) {
        var entry = this._getCurrentEntry(); if (!entry) return -1;

        if (entry.selectedRegion < 0 || !entry.colliderEditActive) return -1;
        var sr = entry.regions[entry.selectedRegion];
        if (!sr) return -1;
        var b = sr.bounds;
        var centerX = b.x + b.w / 2;
        var centerY = b.y + b.h / 2;
        var s = this.state.scale;
        var points = this._extractColliderPoints(sr);
        var hitRadius = 10;

        for (var i = 0; i < points.length; i++) {
            var px = (centerX + points[i].x) * s;
            var py = (centerY - points[i].y) * s;
            var dx = mx - px, dy = my - py;
            if (dx * dx + dy * dy < hitRadius * hitRadius) {
                return i;
            }
        }
        return -1;
    },

    _hitTestColliderSegment: function(mx, my) {
        var entry = this._getCurrentEntry(); if (!entry) return null;

        // 检测鼠标是否在碰撞体线段上，返回 {segIdx: 线段起始点索引, insertPt: Cocos坐标插入点}
        if (entry.selectedRegion < 0 || !entry.colliderEditActive) return null;
        var sr = entry.regions[entry.selectedRegion];
        if (!sr) return null;
        var b = sr.bounds;
        var centerX = b.x + b.w / 2;
        var centerY = b.y + b.h / 2;
        var s = this.state.scale;
        var points = this._extractColliderPoints(sr);
        if (points.length < 2) return null;
        var hitDist = 8; // 线段命中距离阈值(px)

        for (var i = 0; i < points.length; i++) {
            var j = (i + 1) % points.length;
            var ax = (centerX + points[i].x) * s;
            var ay = (centerY - points[i].y) * s;
            var bx = (centerX + points[j].x) * s;
            var by = (centerY - points[j].y) * s;

            // 点到线段距离
            var dx2 = bx - ax, dy2 = by - ay;
            var len2 = dx2 * dx2 + dy2 * dy2;
            if (len2 === 0) continue;
            var t = Math.max(0, Math.min(1, ((mx - ax) * dx2 + (my - ay) * dy2) / len2));
            var projX = ax + t * dx2, projY = ay + t * dy2;
            var dist = Math.sqrt((mx - projX) * (mx - projX) + (my - projY) * (my - projY));
            if (dist < hitDist) {
                // 计算插入点的 Cocos 坐标（在线段中点附近，使用鼠标对应图片坐标）
                var imgX = projX / s;
                var imgY = projY / s;
                var newPt = {
                    x: Math.round((imgX - centerX) * 10) / 10,
                    y: Math.round(-(imgY - centerY) * 10) / 10
                };
                return { segIdx: i, insertPt: newPt };
            }
        }
        return null;
    },

    _hitTestBoxCorner: function(mx, my) {
        var entry = this._getCurrentEntry(); if (!entry) return -1;
        if (entry.selectedRegion < 0 || !entry.colliderEditActive) return -1;
        var sr = entry.regions[entry.selectedRegion];
        if (!sr) return -1;
        var params = this._getBoxParams(entry, sr);
        var s = this.state.scale;
        var hitR = 12;
        for (var ci = 0; ci < 4; ci++) {
            var pt = this._getBoxCornerImagePos(sr, params, ci);
            var cx = pt.x * s, cy = pt.y * s;
            var dx = mx - cx, dy = my - cy;
            if (dx * dx + dy * dy < hitR * hitR) return ci;
        }
        return -1;
    },

    _hitTestBoxBody: function(mx, my) {
        var entry = this._getCurrentEntry(); if (!entry) return false;
        if (entry.selectedRegion < 0 || !entry.colliderEditActive) return false;
        var sr = entry.regions[entry.selectedRegion];
        if (!sr) return false;
        var params = this._getBoxParams(entry, sr);
        var s = this.state.scale;
        var b = sr.bounds;
        var cx = b.x + b.w / 2 + params.ox;
        var cy = b.y + b.h / 2 - params.oy;
        var hw = params.w / 2, hh = params.h / 2;
        var left = (cx - hw) * s, right = (cx + hw) * s;
        var top = (cy - hh) * s, bottom = (cy + hh) * s;
        return mx >= left && mx <= right && my >= top && my <= bottom;
    },

    _hitTestCircleHandle: function(mx, my) {
        var entry = this._getCurrentEntry(); if (!entry) return false;
        if (entry.selectedRegion < 0 || !entry.colliderEditActive) return false;
        var sr = entry.regions[entry.selectedRegion];
        if (!sr) return false;
        var params = this._getCircleParams(entry, sr);
        var s = this.state.scale;
        var b = sr.bounds;
        var cx = (b.x + b.w / 2 + params.ox + params.r) * s;
        var cy = (b.y + b.h / 2 - params.oy) * s;
        var hitR = 12;
        return (mx - cx) * (mx - cx) + (my - cy) * (my - cy) < hitR * hitR;
    },

    _hitTestCircleBody: function(mx, my) {
        var entry = this._getCurrentEntry(); if (!entry) return false;
        if (entry.selectedRegion < 0 || !entry.colliderEditActive) return false;
        var sr = entry.regions[entry.selectedRegion];
        if (!sr) return false;
        var params = this._getCircleParams(entry, sr);
        var s = this.state.scale;
        var b = sr.bounds;
        var cx = (b.x + b.w / 2 + params.ox) * s;
        var cy = (b.y + b.h / 2 - params.oy) * s;
        var r = params.r * s;
        return (mx - cx) * (mx - cx) + (my - cy) * (my - cy) < r * r;
    },

    _simplifyPolygon: function(points, epsilon) {
        // Ramer-Douglas-Peucker 算法
        if (points.length <= 2) return points;

        var maxDist = 0, maxIdx = 0;
        var first = points[0], last = points[points.length - 1];
        for (var i = 1; i < points.length - 1; i++) {
            var d = this._pointToLineDist(points[i], first, last);
            if (d > maxDist) { maxDist = d; maxIdx = i; }
        }

        if (maxDist > epsilon) {
            var left = this._simplifyPolygon(points.slice(0, maxIdx + 1), epsilon);
            var right = this._simplifyPolygon(points.slice(maxIdx), epsilon);
            return left.slice(0, -1).concat(right);
        }
        return [first, last];
    },

    _pointToLineDist: function(p, a, b) {
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var len2 = dx * dx + dy * dy;
        if (len2 === 0) return Math.sqrt((p[0]-a[0])*(p[0]-a[0]) + (p[1]-a[1])*(p[1]-a[1]));
        var t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy) / len2));
        var projX = a[0] + t * dx, projY = a[1] + t * dy;
        return Math.sqrt((p[0]-projX)*(p[0]-projX) + (p[1]-projY)*(p[1]-projY));
    },

    _traceRegionOutline: function(region, imgW, imgH) {
        // Moore-Neighbor 轮廓追踪
        var pixelSet = region.pixelSet;
        var bounds = region.bounds;
        var startX = -1, startY = -1;

        // 找到第一个边缘像素
        for (var y = bounds.y; y < bounds.y + bounds.h && startX < 0; y++) {
            for (var x = bounds.x; x < bounds.x + bounds.w && startX < 0; x++) {
                if (pixelSet[y * imgW + x]) {
                    // 检查是否为边缘
                    if (y === 0 || x === 0 || y >= imgH - 1 || x >= imgW - 1) { startX = x; startY = y; break; }
                    for (var dy = -1; dy <= 1; dy++) {
                        for (var dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            var nx = x + dx, ny = y + dy;
                            if (!pixelSet[ny * imgW + nx]) { startX = x; startY = y; break; }
                        }
                        if (startX >= 0) break;
                    }
                }
            }
        }
        if (startX < 0) return [];

        // Moore-Neighbor 追踪
        var outline = [];
        var cx2 = startX, cy2 = startY;
        var prevX = startX - 1, prevY = startY;
        // 8 方向（顺时针）
        var dirs = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
        var maxSteps = 100000;
        var steps = 0;

        do {
            outline.push([cx2, cy2]);
            steps++;
            if (steps > maxSteps) break;

            // 计算搜索起始方向（从上一个像素指向当前像素的方向的顺时针90度）
            var searchStart = 0;
            var dd = [cx2 - prevX, cy2 - prevY];
            for (var di = 0; di < 8; di++) {
                if (dirs[di][0] === dd[0] && dirs[di][1] === dd[1]) {
                    searchStart = (di + 7) % 8; // 逆时针转回一个方向
                    break;
                }
            }

            var found = false;
            for (var nd = 0; nd < 8; nd++) {
                var dirIdx = (searchStart + nd) % 8;
                var nxx = cx2 + dirs[dirIdx][0];
                var nyy = cy2 + dirs[dirIdx][1];
                if (nxx >= 0 && nxx < imgW && nyy >= 0 && nyy < imgH && pixelSet[nyy * imgW + nxx]) {
                    prevX = cx2; prevY = cy2;
                    cx2 = nxx; cy2 = nyy;
                    found = true;
                    break;
                }
            }
            if (!found) break;
        } while (cx2 !== startX || cy2 !== startY);

        return outline;
    },

    _extractColliderPoints: function(region) {
        var entry = this._getCurrentEntry();
        var img = entry ? entry.originalImage : null;
        if (!img) return [];
        var b = region.bounds;
        var pixelSet = region.pixelSet;
        var imgW = img.width, imgH = img.height;

        var targetCount = (entry && entry.colliderTargetCount) ? entry.colliderTargetCount : (parseInt(this._q('#colliderSimplify').value) || 6);
        targetCount = Math.max(3, Math.min(8, targetCount));

        var customPoints = entry ? entry.colliderCustomPoints : null;
        if (customPoints && customPoints[region.id]) {
            var cp = customPoints[region.id];
            if (cp.length >= 3) return cp;
        }

        var outline = this._traceRegionOutline(region, imgW, imgH);
        var centerX = b.x + b.w / 2;
        var centerY = b.y + b.h / 2;

        var toCocos = function(px, py) {
            return {
                x: Math.round((px - centerX) * 10) / 10,
                y: Math.round(-(py - centerY) * 10) / 10
            };
        };

        // 如果轮廓点太少，用 bounds 四角
        if (outline.length < 3) {
            var pts = [];
            var seen = {};
            var corners = [[b.x,b.y],[b.x+b.w-1,b.y],[b.x+b.w-1,b.y+b.h-1],[b.x,b.y+b.h-1]];
            for (var ci = 0; ci < corners.length; ci++) {
                var pt = toCocos(corners[ci][0], corners[ci][1]);
                var k = pt.x + ',' + pt.y;
                if (!seen[k]) { seen[k] = true; pts.push(pt); }
            }
            while (pts.length < targetCount) pts.push({ x: 0, y: 0 });
            return pts;
        }

        // 清理相邻重复
        var clean = [outline[0]];
        for (var ci2 = 1; ci2 < outline.length; ci2++) {
            var last = clean[clean.length - 1];
            if (last[0] !== outline[ci2][0] || last[1] !== outline[ci2][1]) {
                clean.push(outline[ci2]);
            }
        }
        while (clean.length >= 2 && clean[0][0] === clean[clean.length-1][0] && clean[0][1] === clean[clean.length-1][1]) {
            clean.pop();
        }

        // 如果清理后轮廓点还是太少，fallback
        if (clean.length < 3) {
            var pts2 = [];
            var seen2 = {};
            var corners2 = [[b.x,b.y],[b.x+b.w-1,b.y],[b.x+b.w-1,b.y+b.h-1],[b.x,b.y+b.h-1]];
            for (var ci3 = 0; ci3 < corners2.length; ci3++) {
                var pt2 = toCocos(corners2[ci3][0], corners2[ci3][1]);
                var k2 = pt2.x + ',' + pt2.y;
                if (!seen2[k2]) { seen2[k2] = true; pts2.push(pt2); }
            }
            while (pts2.length < targetCount) pts2.push({ x: 0, y: 0 });
            return pts2;
        }

        // 核心：对轮廓点做凸包，在凸包上均匀采 targetCount 个点
        var result = [];
        var keySet = {};

        var addPt = function(p) {
            var k = p.x + ',' + p.y;
            if (!keySet[k]) { keySet[k] = true; result.push(p); return true; }
            return false;
        };

        // 如果轮廓点不够，直接用四角
        if (clean.length < 3) {
            addPt(toCocos(b.x, b.y));
            addPt(toCocos(b.x + b.w - 1, b.y));
            addPt(toCocos(b.x + b.w - 1, b.y + b.h - 1));
            addPt(toCocos(b.x, b.y + b.h - 1));
            while (result.length < targetCount) result.push({ x: 0, y: 0 });
            return result;
        }

        // Monotone Chain 凸包（在图片像素坐标中计算）
        // 将 clean 数组转为点数组并排序
        var pts = clean.map(function(p) { return [p[0], p[1]]; });
        // 去重
        var ptsClean = [pts[0]];
        for (var ci = 1; ci < pts.length; ci++) {
            if (pts[ci][0] !== ptsClean[ptsClean.length-1][0] || pts[ci][1] !== ptsClean[ptsClean.length-1][1]) {
                ptsClean.push(pts[ci]);
            }
        }
        ptsClean.sort(function(a, b) { return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1]; });
        if (ptsClean.length < 3) {
            addPt(toCocos(b.x, b.y));
            addPt(toCocos(b.x+b.w-1, b.y));
            addPt(toCocos(b.x+b.w-1, b.y+b.h-1));
            addPt(toCocos(b.x, b.y+b.h-1));
            while (result.length < targetCount) result.push({ x: 0, y: 0 });
            return result;
        }

        var cross = function(o, a, b) {
            return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        };

        var lower = [];
        for (var li = 0; li < ptsClean.length; li++) {
            while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], ptsClean[li]) <= 0)
                lower.pop();
            lower.push(ptsClean[li]);
        }

        var upper = [];
        for (var ui = ptsClean.length - 1; ui >= 0; ui--) {
            while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], ptsClean[ui]) <= 0)
                upper.pop();
            upper.push(ptsClean[ui]);
        }

        lower.pop(); upper.pop();
        var hull = lower.concat(upper); // 凸包点（逆时针）

        // 在凸包上均匀采样 targetCount 个点
        var hLen = hull.length;
        for (var si = 0; si < targetCount; si++) {
            var idx = Math.floor(si * hLen / targetCount);
            if (idx >= hLen) idx = hLen - 1;
            addPt(toCocos(hull[idx][0], hull[idx][1]));
        }

        while (result.length < targetCount) result.push({ x: 0, y: 0 });

        // 碰撞体缩放：将顶点向中心等比例缩放
        var colliderScale = parseInt(this._q('#colliderScale').value) || 100;
        if (colliderScale !== 100 && result.length > 0) {
            var scaleFactor = colliderScale / 100;
            for (var si2 = 0; si2 < result.length; si2++) {
                result[si2].x = Math.round(result[si2].x * scaleFactor * 10) / 10;
                result[si2].y = Math.round(result[si2].y * scaleFactor * 10) / 10;
            }
        }

        return result;
    },

    // ========================================
    //   UUID Generation
    // ========================================

    _generateUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    },

    _generateDeterministicUUID: function(seed) {
        // 基于 seed 字符串生成可重复的 UUID（多个独立 hash 避免冲突）
        // 用 8 个独立累加器分别处理每个字符，然后填充 uuid 的 32 个 hex 位
        var acc = [0xf0e1d2c3, 0xb4a59687, 0x73625140, 0x99887766,
                   0x55443322, 0x11223344, 0x55667788, 0x99aabbcc];
        for (var i = 0; i < seed.length; i++) {
            var c = seed.charCodeAt(i);
            for (var j = 0; j < 8; j++) {
                acc[j] = Math.imul(acc[j] ^ c + j * 0x9e3779b9, 0x85ebca6b);
                acc[j] = (acc[j] ^ (acc[j] >>> 16)) & 0x7fffffff;
            }
        }
        var hex = '';
        for (var j = 0; j < 8; j++) {
            hex += ('0000000' + (acc[j] >>> 0).toString(16)).slice(-8);
        }
        // UUID v4 格式: 8-4-4-4-12
        return hex.slice(0,8) + '-' + hex.slice(8,12) + '-4' + hex.slice(13,16) +
               '-8' + hex.slice(17,20) + '-' + hex.slice(20,32);
    },

    // ========================================
    //   Prefab JSON Generation
    // ========================================

    _generatePrefabJson: function(foodId, morph, spriteUuid, colliderPoints, colliderType, bounds, clickAreaScale, colliderCustom, clickAreaRotation) {
        var name = 'f' + foodId + '_' + morph;
        var spriteRef = spriteUuid + '@f9941';
        var imgUuid = this._generateDeterministicUUID('img/' + name);
        var prefabUuid = this._generateDeterministicUUID('prefab/' + name);
        var foodViewUuid = this._generateDeterministicUUID('foodview/' + name);
        var waterFloatUuid = this._generateDeterministicUUID('waterfloat/' + name);
        var rigidUuid = this._generateDeterministicUUID('rigid/' + name);
        var colliderUuid = this._generateDeterministicUUID('collider/' + name);
        var uiTransformUuid = this._generateDeterministicUUID('ui/' + name);
        var viewUiUuid = this._generateDeterministicUUID('viewui/' + name);
        var imgUiUuid = this._generateDeterministicUUID('imgui/' + name);
        var clickUiUuid = this._generateDeterministicUUID('clickui/' + name);

        // clickArea 尺寸（基于精灵 bounds + 缩放）
        var clickW = Math.round(bounds.w * clickAreaScale);
        var clickH = Math.round(bounds.h * clickAreaScale);

        // clickArea 位置居中于精灵 bounds
        var clickX = Math.round((bounds.x + bounds.w / 2 - clickW / 2) * 10) / 10;
        var clickY = Math.round((bounds.y + bounds.h / 2 - clickH / 2) * 10) / 10;

        // Euler z = -49（可配置）
        var rotZ = (clickAreaRotation != null) ? clickAreaRotation : (parseFloat(this._q('#exportRotation').value) || 0);
        var rad = rotZ * Math.PI / 180;
        var cos = Math.cos(rad / 2);
        var sin = Math.sin(rad / 2);
        var quatZ = parseFloat((-sin).toFixed(4));
        var quatW = parseFloat(cos.toFixed(4));

        // 碰撞体类型
        var colliderTypeFinal = colliderType || 'polygon';
        var colliderObj = null;
        if (colliderTypeFinal === 'box') {
            var bw, bh, boxOffX, boxOffY;
            if (colliderCustom && colliderCustom.w) {
                bw = colliderCustom.w; bh = colliderCustom.h;
                boxOffX = colliderCustom.ox || 0; boxOffY = colliderCustom.oy || 0;
            } else {
                var boxScale = (parseInt(this._q('#colliderScale').value) || 100) / 100;
                bw = Math.round(bounds.w * 0.9 * boxScale); bh = Math.round(bounds.h * 0.9 * boxScale);
                boxOffX = 0; boxOffY = 0;
            }
            colliderObj = {
                __type__: 'cc.BoxCollider2D',
                _size: { __type__: 'cc.Size', width: bw, height: bh },
                node: { __id__: 1 },
                __prefab: { __type__: 'cc.CompPrefabInfo', fileId: colliderUuid },
                _group: 2,
                _restitution: 0.3
            };
            if (boxOffX !== 0 || boxOffY !== 0) colliderObj.offset = { __type__: 'cc.Vec2', x:boxOffX, y: boxOffY };
        } else if (colliderTypeFinal === 'circle') {
            var cr, circOffX, circOffY;
            if (colliderCustom && colliderCustom.r) {
                cr = colliderCustom.r; circOffX = colliderCustom.ox || 0; circOffY = colliderCustom.oy || 0;
            } else {
                var circScale = (parseInt(this._q('#colliderScale').value) || 100) / 100;
                cr = Math.round(Math.min(bounds.w, bounds.h) * 0.45 * circScale);
                circOffX = 0; circOffY = 0;
            }
            colliderObj = {
                __type__: 'cc.CircleCollider2D',
                _radius: cr,
                node: { __id__: 1 },
                __prefab: { __type__: 'cc.CompPrefabInfo', fileId: colliderUuid },
                _group: 2
            };
            if (circOffX !== 0 || circOffY !== 0) colliderObj.offset = { __type__: 'cc.Vec2', x:circOffX, y: circOffY };
        } else {
            colliderObj = {
                __type__: 'cc.PolygonCollider2D',
                _points: colliderPoints.length > 0 ? colliderPoints.map(function(p) {
                    return { __type__: 'cc.Vec2', x: p.x, y: p.y };
                }) : [
                    { __type__: 'cc.Vec2', x: -bounds.w/2, y: bounds.h/2 },
                    { __type__: 'cc.Vec2', x: bounds.w/2, y: bounds.h/2 },
                    { __type__: 'cc.Vec2', x: bounds.w/2, y: -bounds.h/2 },
                    { __type__: 'cc.Vec2', x: -bounds.w/2, y: -bounds.h/2 }
                ],
                node: { __id__: 1 },
                __prefab: { __type__: 'cc.CompPrefabInfo', fileId: colliderUuid },
                _group: 2
            };
        }

        // 完整的 _prefab info 格式（Cocos 3.8 要求）
        var makePrefabInfo = function(fileId) {
            return {
                __type__: 'cc.PrefabInfo',
                fileId: fileId,
                instance: null,
                targetOverrides: null,
                nestedPrefabInstanceRoots: null,
                root: { __id__: 1 },
                asset: { __id__: 0 }
            };
        };

        var json = [
            // [0] cc.Prefab
            { __type__: 'cc.Prefab', _name: name, root: { __id__: 1 }, node: { __id__: 4 }, clickArea: { __id__: 4 }, foodSprite: { __id__: 5 }, rigidBody2D: { __id__: 6 }, data: { __id__: 1 }, persistent: false },

            // [1] Root Node
            { __type__: 'cc.Node', _name: name, _layer: 1073741824, _children: [{ __id__: 2 }], _components: [
                { __type__: 'cc.UITransform', node: { __id__: 1 }, __prefab: { __type__: 'cc.CompPrefabInfo', fileId: uiTransformUuid }, _contentSize: { __type__: 'cc.Size', width: 200, height: 200 } },
                { __id__: 6 },
                { __type__: this.FOOD_VIEW_TYPE, node: { __id__: 1 }, __prefab: { __id__: 7 }, foodSprite: { __id__: 5 }, clickArea: { __id__: 4 } },
                { __type__: this.WATER_FLOAT_TYPE, node: { __id__: 1 }, __prefab: { __id__: 8 }, rigidBody2D: { __id__: 6 } },
                { __type__: 'cc.UIOpacity', node: { __id__: 1 }, __prefab: { __type__: 'cc.CompPrefabInfo', fileId: this._generateDeterministicUUID('uiopacity/'+name) } },
                colliderObj
            ], _prefab: makePrefabInfo(prefabUuid) },

            // [2] view Node
            { __type__: 'cc.Node', _name: 'view', _layer: 1073741824, _parent: { __id__: 1 }, _children: [{ __id__: 3 }, { __id__: 4 }], _components: [
                { __type__: 'cc.UITransform', node: { __id__: 2 }, __prefab: { __type__: 'cc.CompPrefabInfo', fileId: viewUiUuid } }
            ], _prefab: makePrefabInfo(this._generateDeterministicUUID('viewprefab/'+name)) },

            // [3] img Node
            { __type__: 'cc.Node', _name: 'img', _layer: 1073741824, _parent: { __id__: 2 }, _components: [
                { __type__: 'cc.UITransform', node: { __id__: 3 }, __prefab: { __type__: 'cc.CompPrefabInfo', fileId: imgUiUuid }, _contentSize: { __type__: 'cc.Size', width: bounds.w, height: bounds.h } },
                { __id__: 5 }
            ], _prefab: makePrefabInfo(this._generateDeterministicUUID('imgprefab/'+name)) },

            // [4] clickArea Node
            { __type__: 'cc.Node', _name: 'clickArea', _layer: 1073741824, _parent: { __id__: 2 }, _components: [
                { __type__: 'cc.UITransform', node: { __id__: 4 }, __prefab: { __type__: 'cc.CompPrefabInfo', fileId: clickUiUuid }, _contentSize: { __type__: 'cc.Size', width: clickW, height: clickH } }
            ], _prefab: makePrefabInfo(this._generateDeterministicUUID('clickprefab/'+name)),
               _lpos: { __type__: 'cc.Vec3', x: clickX, y: clickY, z: 0 },
               _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: quatZ, w: quatW },
               _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: rotZ } },

            // [5] cc.Sprite
            { __type__: 'cc.Sprite', node: { __id__: 3 }, __prefab: { __type__: 'cc.CompPrefabInfo', fileId: this._generateDeterministicUUID('sprite/'+name) }, _spriteFrame: { __uuid__: spriteRef } },

            // [6] cc.RigidBody2D
            { __type__: 'cc.RigidBody2D', _allowSleep: false, _gravityScale: 0, node: { __id__: 1 }, __prefab: { __type__: 'cc.CompPrefabInfo', fileId: rigidUuid } },

            // [7] CompPrefabInfo for FoodView
            { __type__: 'cc.CompPrefabInfo', fileId: foodViewUuid },

            // [8] CompPrefabInfo for WaterFloat
            { __type__: 'cc.CompPrefabInfo', fileId: waterFloatUuid }
        ];

        return JSON.stringify(json, null, 2);
    },

    _generatePngMeta: function(filename, w, h) {
        var uuid = this._generateDeterministicUUID('png/' + filename);
        var texUuid = uuid + '@6c48a';
        var sfUuid = uuid + '@f9941';
        w = w || 100; h = h || 100;
        var hw = w / 2, hh = h / 2;
        return JSON.stringify({
            ver: '1.0.27',
            importer: 'image',
            imported: true,
            uuid: uuid,
            files: ['.json', '.png'],
            subMetas: {
                '6c48a': {
                    importer: 'texture',
                    uuid: texUuid,
                    displayName: '1',
                    id: '6c48a',
                    name: 'texture',
                    userData: {
                        wrapModeS: 'repeat',
                        wrapModeT: 'repeat',
                        minfilter: 'linear',
                        magfilter: 'linear',
                        mipfilter: 'none',
                        anisotropy: 0,
                        isUuid: true,
                        imageUuidOrDatabaseUri: uuid,
                        visible: false
                    },
                    ver: '1.0.22',
                    imported: true,
                    files: ['.json'],
                    subMetas: {}
                },
                'f9941': {
                    importer: 'sprite-frame',
                    uuid: sfUuid,
                    id: 'f9941',
                    name: 'spriteFrame',
                    displayName: '1',
                    userData: {
                        trimType: 'custom',
                        rotated: false,
                        trimX: 0,
                        trimY: 0,
                        width: w,
                        height: h,
                        borderTop: 0,
                        borderBottom: 0,
                        borderLeft: 0,
                        borderRight: 0,
                        trimThreshold: 1,
                        offsetX: 0,
                        offsetY: 0,
                        rawWidth: w,
                        rawHeight: h,
                        packable: true,
                        pixelsToUnit: 100,
                        pivotX: 0.5,
                        pivotY: 0.5,
                        meshType: 0,
                        vertices: {
                            rawPosition: [-hw, -hh, 0, hw, -hh, 0, -hw, hh, 0, hw, hh, 0],
                            indexes: [0, 1, 2, 2, 1, 3],
                            uv: [0, h, w, h, 0, 0, w, 0],
                            nuv: [0, 0, 1, 0, 0, 1, 1, 1],
                            minPos: [-hw, -hh, 0],
                            maxPos: [hw, hh, 0]
                        },
                        isUuid: true,
                        imageUuidOrDatabaseUri: texUuid,
                        atlasUuid: ''
                    },
                    ver: '1.0.12',
                    imported: true,
                    files: ['.json'],
                    subMetas: {}
                }
            },
            userData: {
                type: 'sprite-frame',
                fixAlphaTransparencyArtifacts: false,
                hasAlpha: true,
                redirect: texUuid
            }
        }, null, 2);
    },

    _generatePrefabMeta: function(filename) {
        var uuid = this._generateDeterministicUUID('prefabmeta/' + filename);
        return JSON.stringify({
            ver: '1.1.50',
            importer: 'prefab',
            imported: true,
            uuid: uuid,
            files: ['.json'],
            subMetas: {},
            userData: {
                syncNodeName: filename
            }
        }, null, 2);
    },

    _generateDirectoryMeta: function(name) {
        var uuid = this._generateDeterministicUUID('dirmeta/' + name);
        return JSON.stringify({
            ver: '1.0.27',
            importer: 'directory',
            imported: true,
            uuid: uuid,
            files: []
        }, null, 2);
    },

    // ========================================
    //   Mask Data Generation
    // ========================================

    _generateMaskData: function(region, imgW, imgH) {
        var pixelSet = region.pixelSet;
        var w = region.bounds.w;
        var h = region.bounds.h;
        if (w <= 0 || h <= 0) return { width: 0, height: 0, data: '' };

        // 生成 bounds 尺寸的 alpha mask
        var bytes = [];
        for (var y = region.bounds.y; y < region.bounds.y + h; y++) {
            for (var x = region.bounds.x; x < region.bounds.x + w; x++) {
                bytes.push(pixelSet[y * imgW + x] ? 255 : 0);
            }
        }

        // base64 编码
        var binary = '';
        for (var i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        var data = btoa(binary);

        return { width: w, height: h, data: data };
    },

    // ========================================
    //   Export
    // ========================================

    // ========================================
    //   目录选择 & 写入文件
    // ========================================

    _selectExportDir: function() {
        var self = this;
        if (typeof window.showDirectoryPicker !== 'function') {
            this._showToast('浏览器不支持文件夹选择，将使用 ZIP 下载', true);
            this._doZipExport();
            return;
        }
        window.showDirectoryPicker({ mode: 'readwrite' }).then(function(handle) {
            self._setExportDir(handle);
        }).catch(function(err) {
            if (err.name !== 'AbortError') {
                self._showToast('选择文件夹失败', true);
            }
        });
    },

    _setExportDir: function(handle) {
        this.state.selectedDirHandle = handle;
        var pathEl = this._q('#exportDirPath');
        if (pathEl) { pathEl.textContent = '✓ ' + handle.name; pathEl.style.color = '#eee'; }
        var btn = this._q('#exportBtn');
        if (btn) { btn.disabled = false; btn.textContent = '📦 输出 → ' + handle.name; }
        this._showToast('已选择目录: ' + handle.name);
        // 持久化到 IndexedDB（不依赖权限验证，直接存）
        if (typeof indexedDB !== 'undefined') {
            var self = this;
            var openReq = indexedDB.open('VS5ExportDirCache', 1);
            openReq.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
            openReq.onsuccess = function(e) {
                var db = e.target.result;
                var tx = db.transaction('handles', 'readwrite');
                tx.objectStore('handles').put(handle, 'exportDir');
                tx.oncomplete = function() { db.close(); };
            };
        }
    },

    _loadDirHandle: function() {
        if (typeof indexedDB === 'undefined') return;
        var self = this;
        var openReq = indexedDB.open('VS5ExportDirCache', 1);
        openReq.onupgradeneeded = function(e) { e.target.result.createObjectStore('handles'); };
        openReq.onsuccess = function(e) {
            var db = e.target.result;
            var tx = db.transaction('handles', 'readonly');
            var getReq = tx.objectStore('handles').get('exportDir');
            getReq.onsuccess = function() {
                if (getReq.result) {
                    self.state.selectedDirHandle = getReq.result;
                    var pathEl = self._q('#exportDirPath');
                    if (pathEl) { pathEl.textContent = '✓ ' + getReq.result.name; pathEl.style.color = '#eee'; }
                    var btn = self._q('#exportBtn');
                    if (btn) { btn.disabled = false; btn.textContent = '📦 输出 → ' + getReq.result.name; }
                }
                db.close();
            };
        };
    },

    _executeExport: function() {
        var self = this;
        if (this.state.imageList.length === 0) {
            this._showToast('请先上传图片', true);
            return;
        }

        var dirHandle = this.state.selectedDirHandle;
        if (!dirHandle) {
            this._showToast('请先选择保存目录', true);
            return;
        }

        this._showToast('正在批量生成预制体...');

        setTimeout(function() {
            try {
                self._batchExport(dirHandle);
            } catch(e) {
                console.error(e);
                self._showToast('导出失败: ' + e.message, true);
            }
        }, 100);
    },

    _ensureDir: async function(parentHandle, name) {
        // 获取或创建子目录
        try {
            return await parentHandle.getDirectoryHandle(name, { create: true });
        } catch(e) {
            return await parentHandle.getDirectoryHandle(name, { create: true });
        }
    },

    _writeFile: async function(dirHandle, filename, content) {
        var fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        var writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
    },

    _batchExport: async function(dirHandle) {
        var self = this;
        var foodGroup = parseInt(this._q('#exportFoodGroup').value) || 1;
        var startFoodId = parseInt(this._q('#exportStartFoodId').value) || 1;
        var clickAreaScaleGlobal = parseFloat(this._q('#exportClickAreaScale').value) || 1.0;

        var info = self._headerInfo;
        var progWrap = self._headerProgress;
        var progBar = self._headerProgressBar;

        var updateHeader = function(pct, text) {
            if (progWrap) progWrap.style.display = pct > 0 && pct < 100 ? 'block' : 'none';
            if (progBar) progBar.style.width = pct + '%';
            if (info) { info.textContent = text; info.style.color = pct >= 100 ? '#00c853' : '#888'; }
        };

        try {
            var perm = await dirHandle.queryPermission({ mode: 'readwrite' });
            if (perm !== 'granted') {
                perm = await dirHandle.requestPermission({ mode: 'readwrite' });
                if (perm !== 'granted') { self._showToast('没有目录写入权限', true); return; }
            }
        } catch(e) { self._showToast('权限获取失败', true); return; }

        try {
            updateHeader(1, '创建目录...');
            var prefabDir = await self._ensureDir(dirHandle, 'prefab');
            var imgDir = await self._ensureDir(dirHandle, 'img');
            var configDir = await self._ensureDir(dirHandle, 'config');

            var sortedList = self.state.imageList.slice().sort(function(a, b) { return a.fileName.localeCompare(b.fileName); });
            var configFoods = [];
            var saved = 0;
            var totalRegions = 0;
            for (var si = 0; si < sortedList.length; si++) totalRegions += sortedList[si].regions.length;
            if (totalRegions === 0) { self._showToast('请先检测精灵', true); updateHeader(0, ''); return; }

            for (var ei = 0; ei < sortedList.length; ei++) {
                var entry = sortedList[ei];
                if (entry.regions.length === 0) continue;
                // 切换到当前图片显示在画布
                var eiActual = self.state.imageList.indexOf(entry);
                if (eiActual >= 0) self._activateImage(eiActual);
                for (var ri = 0; ri < entry.regions.length; ri++) {
                    var region = entry.regions[ri];
                    var foodId = entry.foodId;
                    var morph = entry.morphIndex;
                    var nameBase = 'f' + foodId + '_' + morph;
                    updateHeader(Math.round((saved + 1) / totalRegions * 100), nameBase + ' 输出中...');

                    var cp = (entry.colliderCustomPoints && entry.colliderCustomPoints[region.id]) ? entry.colliderCustomPoints[region.id] : self._extractColliderPointsForExport(region, entry);
                    var actualColliderType = self._detectColliderType(region);
                    var imgUuid = self._generateDeterministicUUID('png/' + nameBase);
                    var colliderCustom = null;
                    if (actualColliderType === 'box') colliderCustom = entry.colliderBoxCustom[region.id] || null;
                    else if (actualColliderType === 'circle') colliderCustom = entry.colliderCircleCustom[region.id] || null;
                    var entryClickScale = (entry.clickAreaScale != null) ? entry.clickAreaScale : clickAreaScaleGlobal;
                    var entryClickRot = (entry.clickAreaRotation != null) ? entry.clickAreaRotation : null;
                    var prefabJson = self._generatePrefabJson(foodId, morph, imgUuid, cp, actualColliderType, region.bounds, entryClickScale, colliderCustom, entryClickRot);
                    await self._writeFile(prefabDir, nameBase + '.prefab', prefabJson);
                    await self._writeFile(prefabDir, nameBase + '.prefab.meta', self._generatePrefabMeta(nameBase));
                    var imgSubDir = await self._ensureDir(imgDir, String(foodId));
                    await self._writeFile(imgSubDir, morph + '.png', entry.file);
                    await self._writeFile(imgSubDir, morph + '.png.meta', self._generatePngMeta(nameBase, region.bounds.w, region.bounds.h));
                    var maskData = self._generateMaskDataForExport(region, entry.originalImage.width, entry.originalImage.height);
                    configFoods.push({ foodId: foodId, foodName: String(foodId), masks: [maskData] });
                    saved++;
                    // 每条记录
                    self._addLog('✓ ' + nameBase, 'ok', 1);
                }
            }

            updateHeader(98, '写入配置...');
            await self._writeFile(configDir, 'foodImageConfig.json', JSON.stringify({ version: '1.0.0', generatedAt: new Date().toISOString(), foods: configFoods }, null, 2));
            await self._writeFile(dirHandle, 'img.meta', self._generateDirectoryMeta('img_' + foodGroup));
            updateHeader(100, '✓ 完成！' + saved + '个预制体');
            self._showToast('✓ 批量输出完成！共 ' + saved + ' 个预制体');
            self._addLog('✓ 批量完成', 'ok', saved);
            setTimeout(function() { updateHeader(0, ''); if (progWrap) progWrap.style.display = 'none'; }, 8000);
        } catch(e) {
            console.error(e);
            updateHeader(0, '');
            if (progWrap) progWrap.style.display = 'none';
            self._showToast('写入失败: ' + e.message, true);
            self._addLog('✗ 失败: ' + e.message, 'fail', 0);
        }
    },

    _extractColliderPointsForExport: function(region, entry) {
        // 批量导出专用：不依赖 _getCurrentEntry()
        var customPoints = entry ? entry.colliderCustomPoints : null;
        if (customPoints && customPoints[region.id] && customPoints[region.id].length >= 3) {
            return customPoints[region.id];
        }
        // 走自动检测流程（复制 _extractColliderPoints 的核心逻辑）
        var img = entry ? entry.originalImage : null;
        if (!img) return [];
        var b = region.bounds;
        var imgW = img.width, imgH = img.height;
        var targetCount = (entry && entry.colliderTargetCount) ? entry.colliderTargetCount : (parseInt(this._q('#colliderSimplify').value) || 6);
        targetCount = Math.max(3, Math.min(8, targetCount));
        var outline = this._traceRegionOutline(region, imgW, imgH);
        var centerX = b.x + b.w / 2;
        var centerY = b.y + b.h / 2;
        var toCocos = function(px, py) {
            return { x: Math.round((px - centerX) * 10) / 10, y: Math.round(-(py - centerY) * 10) / 10 };
        };
        if (outline.length < 3) {
            var pts = [], seen = {};
            var corners = [[b.x,b.y],[b.x+b.w-1,b.y],[b.x+b.w-1,b.y+b.h-1],[b.x,b.y+b.h-1]];
            for (var ci = 0; ci < corners.length; ci++) {
                var pt = toCocos(corners[ci][0], corners[ci][1]);
                var k = pt.x + ',' + pt.y;
                if (!seen[k]) { seen[k] = true; pts.push(pt); }
            }
            while (pts.length < targetCount) pts.push({ x: 0, y: 0 });
            return pts;
        }
        var clean = [outline[0]];
        for (var ci2 = 1; ci2 < outline.length; ci2++) {
            var last = clean[clean.length - 1];
            if (last[0] !== outline[ci2][0] || last[1] !== outline[ci2][1]) clean.push(outline[ci2]);
        }
        while (clean.length >= 2 && clean[0][0] === clean[clean.length-1][0] && clean[0][1] === clean[clean.length-1][1]) clean.pop();
        if (clean.length < 3) {
            var pts2 = [], seen2 = {};
            var corners2 = [[b.x,b.y],[b.x+b.w-1,b.y],[b.x+b.w-1,b.y+b.h-1],[b.x,b.y+b.h-1]];
            for (var ci3 = 0; ci3 < corners2.length; ci3++) {
                var pt2 = toCocos(corners2[ci3][0], corners2[ci3][1]);
                var k2 = pt2.x + ',' + pt2.y;
                if (!seen2[k2]) { seen2[k2] = true; pts2.push(pt2); }
            }
            while (pts2.length < targetCount) pts2.push({ x: 0, y: 0 });
            return pts2;
        }
        var result = [], keySet = {};
        var addPt = function(p) {
            var k = p.x + ',' + p.y;
            if (!keySet[k]) { keySet[k] = true; result.push(p); return true; }
            return false;
        };
        if (clean.length < 3) {
            addPt(toCocos(b.x, b.y)); addPt(toCocos(b.x + b.w - 1, b.y));
            addPt(toCocos(b.x + b.w - 1, b.y + b.h - 1)); addPt(toCocos(b.x, b.y + b.h - 1));
            while (result.length < targetCount) result.push({ x: 0, y: 0 });
            return result;
        }
        // 凸包
        var sorted = clean.slice().sort(function(a, b) { return a[0] - b[0] || a[1] - b[1]; });
        var cross = function(o, a, b) { return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]); };
        var lower = [], upper = [];
        for (var sci = 0; sci < sorted.length; sci++) {
            while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], sorted[sci]) <= 0) lower.pop();
            lower.push(sorted[sci]);
        }
        for (var sci2 = sorted.length-1; sci2 >= 0; sci2--) {
            while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], sorted[sci2]) <= 0) upper.pop();
            upper.push(sorted[sci2]);
        }
        lower.pop(); upper.pop();
        var hull = lower.concat(upper);
        if (hull.length < 3) {
            addPt(toCocos(b.x, b.y)); addPt(toCocos(b.x + b.w - 1, b.y));
            addPt(toCocos(b.x + b.w - 1, b.y + b.h - 1)); addPt(toCocos(b.x, b.y + b.h - 1));
            while (result.length < targetCount) result.push({ x: 0, y: 0 });
            return result;
        }
        var hLen = hull.length;
        for (var si = 0; si < targetCount; si++) {
            var idx = Math.floor(si * hLen / targetCount);
            if (idx >= hLen) idx = hLen - 1;
            addPt(toCocos(hull[idx][0], hull[idx][1]));
        }
        while (result.length < targetCount) result.push({ x: 0, y: 0 });

        // 碰撞体缩放：将顶点向中心等比例缩放
        var colliderScale = parseInt(this._q('#colliderScale').value) || 100;
        if (colliderScale !== 100 && result.length > 0) {
            var scaleFactor = colliderScale / 100;
            for (var si2 = 0; si2 < result.length; si2++) {
                result[si2].x = Math.round(result[si2].x * scaleFactor * 10) / 10;
                result[si2].y = Math.round(result[si2].y * scaleFactor * 10) / 10;
            }
        }

        return result;
    },

    _generateMaskDataForExport: function(region, imgW, imgH) {
        // 批量导出专用：不依赖 _getCurrentEntry()
        var w = region.bounds.w, h = region.bounds.h;
        var bytes = new Uint8Array(w * h);
        var pixelSet = region.pixelSet;
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var gx = region.bounds.x + x, gy = region.bounds.y + y;
                if (gx >= 0 && gx < imgW && gy >= 0 && gy < imgH && pixelSet[gy * imgW + gx]) {
                    bytes[y * w + x] = 255;
                }
            }
        }
        var binary = '';
        for (var bi = 0; bi < bytes.length; bi++) binary += String.fromCharCode(bytes[bi]);
        return { width: w, height: h, data: btoa(binary) };
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

    // ========================================
    //   Export Log
    // ========================================

    _getLogKey: function() {
        return 'vs5_export_log';
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
            name: '批量导出',
            time: new Date().toLocaleString(),
            status: status + (count > 0 ? ' (' + count + '个)' : ''),
            statusClass: statusClass
        });
        // 最多保留 100 条
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
    }
};
