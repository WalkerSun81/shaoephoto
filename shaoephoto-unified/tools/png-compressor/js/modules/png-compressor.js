/**
 * PNG压缩工具 v1.2 - 基于颜色量化的 PNG 图片压缩
 *
 * 核心原理：
 *   1. 将图片绘制到 Canvas
 *   2. 获取像素数据，用 Median Cut 算法减少颜色数
 *   3. 将量化后的像素写回 Canvas
 *   4. 用 canvas.toBlob('image/png') 编码（浏览器原生 PNG 编码器）
 *   5. 如果压缩后更大，保留原文件
 *
 * 工作流：上传素材 → 设置压缩参数 → 预览对比 → 批量导出
 */
var PngCompressor = {
    id: 'png-compressor',
    name: 'PNG压缩',

    _initState: function() {
        this.state = {
            imageList: [],
            activeImageIndex: -1,
            colorCount: 256,  // 默认256色，保证高质量
            outputFormat: 'png',
            webpQuality: 80,
            selectedDirHandle: null,
            isCompressing: false,
            qualityPreset: 'balanced',  // quality: 256色, balanced: 128色, compact: 64色
            dithering: 'light'  // none: 无抖动, light: 轻微抖动, standard: 标准Floyd-Steinberg
        };
    },

    _makeImageEntry: function(file, img, fileName) {
        // Generate thumbnail from original
        var thumbUrl = this._createThumbnail(img, 40, 40);
        return {
            file: file,
            fileName: fileName,
            originalImage: img,
            originalSize: file.size,
            originalWidth: img.width,
            originalHeight: img.height,
            thumbUrl: thumbUrl,
            compressedBlob: null,
            compressedSize: 0,
            compressedUrl: null,
            usedOriginal: false
        };
    },

    _createThumbnail: function(img, maxW, maxH) {
        var scale = Math.min(maxW / img.width, maxH / img.height, 1);
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/png');
    },

    _getCurrentEntry: function() {
        if (this.state.activeImageIndex < 0 || this.state.activeImageIndex >= this.state.imageList.length) return null;
        return this.state.imageList[this.state.activeImageIndex];
    },

    activate: function() {
        if (this._overlay) return;
        this._initState();
        this._createOverlay();
        this._loadDirHandle();
    },

    deactivate: function() {
        this._destroy();
    },

    _destroy: function() {
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        if (this.state) {
            this.state.imageList.forEach(function(entry) {
                if (entry.compressedUrl) URL.revokeObjectURL(entry.compressedUrl);
            });
        }
        this._overlay = null;
        this.state = null;
    },

    _createOverlay: function() {
        var div = document.createElement('div');
        div.className = 'tt-overlay';
        div.innerHTML = this._buildHTML();
        document.body.appendChild(div);
        this._overlay = div;
        this._bindEvents();
        this._showEmptyState();
    },

    _buildHTML: function() {
        return '' +
        '<div class="tt-header">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;width:100%;">' +
                '<div style="display:flex;align-items:center;gap:4px;">' +
                    '<button class="tt-toggle-overlay-btn" data-action="goHome" title="返回首页"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>' +
                    '<button class="tt-toggle-overlay-btn" data-action="compressAll">压缩全部</button>' +
                    '<button class="tt-toggle-overlay-btn" data-action="exportAll">导出全部</button>' +
                    '<span id="ttInfoText" style="font-size:11px;color:var(--text2);margin-left:8px;"></span>' +
                '</div>' +
                '<span style="font-size:16px;font-weight:bold;color:#eee;">PNG压缩工具</span>' +
            '</div>' +
        '</div>' +
        '<div class="tt-app">' +
            this._buildSidebarHTML() +
            this._buildMainHTML() +
        '</div>' +
        '<div class="tt-stats-bar" id="ttStatsBar">' +
            '<span>图片: <span class="tt-val" id="ttStatCount">0</span></span>' +
            '<span>原始: <span class="tt-val" id="ttStatOriginal">0 KB</span></span>' +
            '<span>压缩后: <span class="tt-val green" id="ttStatCompressed">0 KB</span></span>' +
            '<span>节省: <span class="tt-val green" id="ttStatSaved">0%</span></span>' +
        '</div>' +
        '<div class="tt-toast" id="ttToast"></div>';
    },

    _buildSidebarHTML: function() {
        return '' +
        '<div class="tt-sidebar">' +
            '<div class="tt-section">' +
                '<div class="tt-step-title">📁 上传素材</div>' +
                '<div class="tt-upload-zone" id="ttUploadZone">' +
                    '<div class="tt-icon">🖼️</div>' +
                    '<div>点击或拖拽 PNG 图片到此处</div>' +
                    '<div style="font-size:10px;margin-top:4px;color:var(--text2);">支持 PNG 格式，可多选</div>' +
                '</div>' +
                '<input type="file" id="ttFileInput" accept="image/png" multiple style="display:none">' +
            '</div>' +
            '<div class="tt-section" id="ttSettingsSection" style="display:none">' +
                '<div class="tt-step-title">⚙️ 压缩设置</div>' +
                '<div class="tt-input-group">' +
                    '<label>质量预设</label>' +
                    '<div class="tt-format-row">' +
                        '<div class="tt-format-btn" data-preset="quality">高质量 (256色)</div>' +
                        '<div class="tt-format-btn active" data-preset="balanced">均衡 (128色)</div>' +
                        '<div class="tt-format-btn" data-preset="compact">紧凑 (64色)</div>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>颜色数量 <span id="ttColorHint" style="color:var(--text2);font-size:10px;"></span></label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="ttColorCount" min="2" max="256" value="256">' +
                        '<span class="tt-range-val" id="ttColorCountVal">256</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>抖动强度 <span style="color:var(--text2);font-size:10px;">影响噪点和边缘</span></label>' +
                    '<div class="tt-format-row">' +
                        '<div class="tt-format-btn" data-dither="none">无抖动</div>' +
                        '<div class="tt-format-btn active" data-dither="light">轻微</div>' +
                        '<div class="tt-format-btn" data-dither="standard">标准</div>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>输出格式</label>' +
                    '<div class="tt-format-row">' +
                        '<div class="tt-format-btn active" data-format="png">PNG</div>' +
                        '<div class="tt-format-btn" data-format="webp">WebP</div>' +
                        '<div class="tt-format-btn" data-format="auto">自动</div>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group" id="ttWebpQualityGroup" style="display:none">' +
                    '<label>WebP 质量</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="ttWebpQuality" min="1" max="100" value="80">' +
                        '<span class="tt-range-val" id="ttWebpQualityVal">80</span>' +
                    '</div>' +
                '</div>' +
                '<button class="tt-btn tt-btn-primary" data-action="compressCurrent">压缩当前图片</button>' +
                '<button class="tt-btn tt-btn-secondary" data-action="compressAll">压缩全部图片</button>' +
            '</div>' +
            '<div class="tt-section" id="ttExportSection" style="display:none">' +
                '<div class="tt-step-title">💾 导出</div>' +
                '<button class="tt-btn tt-btn-primary" data-action="exportAll">导出全部压缩图片</button>' +
                '<button class="tt-btn tt-btn-secondary" data-action="exportCurrent">导出当前图片</button>' +
                '<div class="tt-progress-wrap" id="ttProgressWrap">' +
                    '<div class="tt-progress-bar" id="ttProgressBar"></div>' +
                '</div>' +
                '<div class="tt-progress-text" id="ttProgressText"></div>' +
            '</div>' +
        '</div>';
    },

    _buildMainHTML: function() {
        return '' +
        '<div class="tt-main" id="ttMain">' +
            '<div class="tt-empty-state" id="ttEmptyState">' +
                '<div class="tt-icon">🗜️</div>' +
                '<div>上传 PNG 图片开始压缩</div>' +
                '<div style="font-size:11px;margin-top:8px;color:var(--text2);">支持拖拽、点击上传、Ctrl+V 粘贴</div>' +
            '</div>' +
            '<div class="tt-preview-container" id="ttPreviewContainer" style="display:none">' +
                '<div class="tt-preview-images">' +
                    '<div class="tt-preview-box">' +
                        '<div class="tt-preview-label">原始图片</div>' +
                        '<canvas id="ttOriginalCanvas"></canvas>' +
                        '<div class="tt-preview-size original" id="ttOriginalSize">-</div>' +
                    '</div>' +
                    '<div class="tt-preview-box">' +
                        '<div class="tt-preview-label">压缩后</div>' +
                        '<canvas id="ttCompressedCanvas"></canvas>' +
                        '<div class="tt-preview-size compressed" id="ttCompressedSize">-</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="tt-right-panel" id="ttRightPanel">' +
                '<div class="tt-rp-header">' +
                    '<span>图片列表</span>' +
                    '<span id="ttImageCount" style="font-size:10px;color:var(--text2);">0 张</span>' +
                '</div>' +
                '<div class="tt-image-list" id="ttImageList"></div>' +
            '</div>' +
        '</div>';
    },

    _bindEvents: function() {
        var self = this;
        var overlay = this._overlay;

        var uploadZone = overlay.querySelector('#ttUploadZone');
        var fileInput = overlay.querySelector('#ttFileInput');

        uploadZone.addEventListener('click', function() { fileInput.click(); });
        fileInput.addEventListener('change', function(e) {
            self._handleFiles(e.target.files);
            fileInput.value = '';
        });

        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault(); e.stopPropagation();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault(); e.stopPropagation();
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault(); e.stopPropagation();
            uploadZone.classList.remove('dragover');
            self._handleFiles(e.dataTransfer.files);
        });

        document.addEventListener('paste', function(e) {
            var items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            var files = [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') >= 0) {
                    files.push(items[i].getAsFile());
                }
            }
            if (files.length) self._handleFiles(files);
        });

        overlay.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            switch (action) {
                case 'goHome': window.location.href = '../../index.html'; break;
                case 'compressCurrent': self._compressCurrent(); break;
                case 'compressAll': self._compressAll(); break;
                case 'exportCurrent': self._exportCurrent(); break;
                case 'exportAll': self._exportAll(); break;
            }
        });

        var colorSlider = overlay.querySelector('#ttColorCount');
        var colorVal = overlay.querySelector('#ttColorCountVal');
        colorSlider.addEventListener('input', function() {
            var val = parseInt(this.value);
            colorVal.textContent = val;
            self.state.colorCount = val;
            // 自动更新预设按钮状态
            var preset = 'custom';
            if (val >= 200) preset = 'quality';
            else if (val >= 100) preset = 'balanced';
            else if (val <= 80) preset = 'compact';
            self.state.qualityPreset = preset;
            overlay.querySelectorAll('.tt-format-btn[data-preset]').forEach(function(b) {
                b.classList.toggle('active', b.getAttribute('data-preset') === preset);
            });
        });

        var qualitySlider = overlay.querySelector('#ttWebpQuality');
        var qualityVal = overlay.querySelector('#ttWebpQualityVal');
        qualitySlider.addEventListener('input', function() {
            qualityVal.textContent = this.value;
            self.state.webpQuality = parseInt(this.value);
        });

        overlay.addEventListener('click', function(e) {
            var fmtBtn = e.target.closest('.tt-format-btn[data-format]');
            if (!fmtBtn) return;
            var format = fmtBtn.getAttribute('data-format');
            self.state.outputFormat = format;
            overlay.querySelectorAll('.tt-format-btn[data-format]').forEach(function(b) { b.classList.remove('active'); });
            fmtBtn.classList.add('active');
            overlay.querySelector('#ttWebpQualityGroup').style.display = format === 'webp' ? '' : 'none';
        });

        // 抖动选项处理
        overlay.addEventListener('click', function(e) {
            var ditherBtn = e.target.closest('.tt-format-btn[data-dither]');
            if (!ditherBtn) return;
            var dither = ditherBtn.getAttribute('data-dither');
            self.state.dithering = dither;
            overlay.querySelectorAll('.tt-format-btn[data-dither]').forEach(function(b) { b.classList.remove('active'); });
            ditherBtn.classList.add('active');
        });

        // 质量预设按钮处理
        overlay.addEventListener('click', function(e) {
            var presetBtn = e.target.closest('.tt-format-btn[data-preset]');
            if (!presetBtn) return;
            var preset = presetBtn.getAttribute('data-preset');
            var colorCount = 256;  // 默认高质量
            if (preset === 'balanced') colorCount = 128;
            else if (preset === 'compact') colorCount = 64;
            self.state.qualityPreset = preset;
            self.state.colorCount = colorCount;
            var slider = overlay.querySelector('#ttColorCount');
            var val = overlay.querySelector('#ttColorCountVal');
            slider.value = colorCount;
            val.textContent = colorCount;
            overlay.querySelectorAll('.tt-format-btn[data-preset]').forEach(function(b) { b.classList.remove('active'); });
            presetBtn.classList.add('active');
        });

        overlay.querySelector('#ttImageList').addEventListener('click', function(e) {
            var delBtn = e.target.closest('.tt-image-del');
            if (delBtn) {
                self._removeImage(parseInt(delBtn.getAttribute('data-index')));
                return;
            }
            var item = e.target.closest('.tt-image-item');
            if (item) {
                self._activateImage(parseInt(item.getAttribute('data-index')));
            }
        });
    },

    // ========================================
    //   File handling
    // ========================================

    _handleFiles: function(fileList) {
        var self = this;
        var pngFiles = [];
        for (var i = 0; i < fileList.length; i++) {
            var f = fileList[i];
            if (f.type === 'image/png' || f.name.toLowerCase().endsWith('.png')) {
                pngFiles.push(f);
            }
        }
        if (!pngFiles.length) {
            this._toast('请上传 PNG 格式的图片', true);
            return;
        }

        var loaded = 0;
        pngFiles.forEach(function(file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var img = new Image();
                img.onload = function() {
                    self.state.imageList.push(self._makeImageEntry(file, img, file.name));
                    loaded++;
                    if (loaded === pngFiles.length) self._onAllFilesLoaded();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    _onAllFilesLoaded: function() {
        this._overlay.querySelector('#ttSettingsSection').style.display = '';
        this._overlay.querySelector('#ttExportSection').style.display = '';
        this._overlay.querySelector('#ttRightPanel').style.display = 'flex';

        // Update color hint
        var hint = this._overlay.querySelector('#ttColorHint');
        if (this.state.imageList.length > 0) {
            var entry = this.state.imageList[0];
            var tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = entry.originalWidth;
            tmpCanvas.height = entry.originalHeight;
            var tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(entry.originalImage, 0, 0);
            var colors = this._countUniqueColors(tmpCtx.getImageData(0, 0, entry.originalWidth, entry.originalHeight).data);
            hint.textContent = '(当前图片约 ' + colors + ' 色)';
        }

        this._updateImageListUI();
        this._updateStats();
        if (this.state.activeImageIndex < 0 && this.state.imageList.length > 0) {
            this._activateImage(0);
        }
    },

    _removeImage: function(index) {
        var entry = this.state.imageList[index];
        if (entry) {
            if (entry.compressedUrl) URL.revokeObjectURL(entry.compressedUrl);
            this.state.imageList.splice(index, 1);
            if (this.state.activeImageIndex >= this.state.imageList.length) {
                this.state.activeImageIndex = this.state.imageList.length - 1;
            }
            if (this.state.activeImageIndex === index) {
                this.state.activeImageIndex = Math.min(index, this.state.imageList.length - 1);
            } else if (this.state.activeImageIndex > index) {
                this.state.activeImageIndex--;
            }
            this._updateImageListUI();
            this._updateStats();
            if (this.state.activeImageIndex >= 0) {
                this._activateImage(this.state.activeImageIndex);
            } else {
                this._showEmptyState();
            }
        }
    },

    _activateImage: function(index) {
        if (index < 0 || index >= this.state.imageList.length) return;
        this.state.activeImageIndex = index;
        this._updateImageListUI();
        this._updatePreview();
    },

    // ========================================
    //   Compression (Canvas-based)
    // ========================================

    _compressCurrent: function() {
        var entry = this._getCurrentEntry();
        if (!entry) return;
        var self = this;
        this._compressEntry(entry, function() {
            self._updatePreview();
            self._updateImageListUI();
            self._updateStats();
            if (entry.usedOriginal) {
                self._toast('该图片已高度优化，无法进一步压缩');
            } else {
                var pct = Math.round((1 - entry.compressedSize / entry.originalSize) * 100);
                self._toast('压缩完成，节省 ' + pct + '%');
            }
        });
    },

    _compressAll: function() {
        var self = this;
        if (!this.state.imageList.length || this.state.isCompressing) return;
        this.state.isCompressing = true;

        var total = this.state.imageList.length;
        var done = 0;
        var skipped = 0;
        var progressWrap = this._overlay.querySelector('#ttProgressWrap');
        var progressBar = this._overlay.querySelector('#ttProgressBar');
        var progressText = this._overlay.querySelector('#ttProgressText');
        progressWrap.style.display = '';
        progressText.style.display = '';

        function compressNext() {
            if (done >= total) {
                self.state.isCompressing = false;
                progressWrap.style.display = 'none';
                progressText.style.display = 'none';
                self._updatePreview();
                self._updateImageListUI();
                self._updateStats();
                var msg = '压缩完成，共 ' + total + ' 张';
                if (skipped > 0) msg += '（' + skipped + ' 张保留原文件）';
                self._toast(msg);
                return;
            }
            self._compressEntry(self.state.imageList[done], function() {
                if (self.state.imageList[done].usedOriginal) skipped++;
                done++;
                var pct = Math.round(done / total * 100);
                progressBar.style.width = pct + '%';
                progressText.textContent = done + ' / ' + total + ' (' + pct + '%)';
                setTimeout(compressNext, 20);
            });
        }
        compressNext();
    },

    _compressEntry: function(entry, callback) {
        var img = entry.originalImage;
        var w = img.width;
        var h = img.height;
        var self = this;

        console.log('[Compress] Starting:', entry.fileName, w + 'x' + h, 'original:', entry.originalSize, 'bytes');

        // Step 1: Draw original to canvas, get pixel data
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var imageData = ctx.getImageData(0, 0, w, h);

        // Step 2: Quantize colors with Floyd-Steinberg dithering
        var quantResult = this._quantizeToPalette(imageData.data, this.state.colorCount, w, h);
        console.log('[Compress] Quantized to', quantResult.palette.length, 'colors');

        // Step 3: Rebuild quantized image on canvas
        ctx.putImageData(this._rebuildImageData(ctx, w, h, quantResult), 0, 0);

        // Step 4: Encode based on format
        var format = this.state.outputFormat;
        console.log('[Compress] Output format:', format);

        if (format === 'png') {
            // PNG-8: use quantized palette for smaller file size
            self._encodePNG8Async(w, h, quantResult, function(blob) {
                console.log('[Compress] PNG-8 blob:', blob ? blob.size : 'null', 'bytes');
                self._applyBlob(entry, blob, callback);
            });
        } else if (format === 'webp') {
            canvas.toBlob(function(blob) {
                console.log('[Compress] WebP blob:', blob ? blob.size : 'null', 'bytes');
                self._applyBlob(entry, blob, callback);
            }, 'image/webp', self.state.webpQuality / 100);
        } else {
            // auto: try PNG-8 and WebP, pick smaller
            var pngBlob = null, webpBlob = null, pending = 2;

            self._encodePNG8Async(w, h, quantResult, function(blob) {
                pngBlob = blob;
                console.log('[Compress] PNG-8 result:', blob ? blob.size : 'null', 'bytes');
                if (--pending === 0) self._pickBest(entry, pngBlob, webpBlob, callback);
            });

            canvas.toBlob(function(blob) {
                webpBlob = blob;
                console.log('[Compress] WebP result:', blob ? blob.size : 'null', 'bytes');
                if (--pending === 0) self._pickBest(entry, pngBlob, webpBlob, callback);
            }, 'image/webp', self.state.webpQuality / 100);
        }
    },

    _rebuildImageData: function(ctx, w, h, quantResult) {
        var imageData = ctx.createImageData(w, h);
        var data = imageData.data;
        var pal = quantResult.palette;
        var idx = quantResult.indexedPixels;
        for (var i = 0; i < idx.length; i++) {
            var c = pal[idx[i]];
            data[i * 4] = c[0];
            data[i * 4 + 1] = c[1];
            data[i * 4 + 2] = c[2];
            data[i * 4 + 3] = c.length > 3 ? c[3] : 255;
        }
        return imageData;
    },

    _pickBest: function(entry, pngBlob, webpBlob, callback) {
        var best = null;
        [pngBlob, webpBlob].forEach(function(b) {
            if (b && b.size < entry.originalSize) {
                if (!best || b.size < best.size) best = b;
            }
        });
        this._applyBlob(entry, best, callback);
    },

    _applyBlob: function(entry, blob, callback) {
        if (entry.compressedUrl) URL.revokeObjectURL(entry.compressedUrl);

        if (blob && blob.size > 0 && blob.size < entry.originalSize) {
            entry.compressedBlob = blob;
            entry.compressedSize = blob.size;
            entry.compressedUrl = URL.createObjectURL(blob);
            entry.usedOriginal = false;
            var pct = Math.round((1 - blob.size / entry.originalSize) * 100);
            console.log('[Apply] Compressed:', entry.fileName, entry.originalSize, '->', blob.size, 'bytes', '-' + pct + '%');
        } else {
            entry.compressedBlob = entry.file;
            entry.compressedSize = entry.originalSize;
            entry.compressedUrl = URL.createObjectURL(entry.file);
            entry.usedOriginal = true;
            if (!blob) {
                console.warn('[Apply] Used original:', entry.fileName, 'reason: blob is null');
            } else if (blob.size === 0) {
                console.warn('[Apply] Used original:', entry.fileName, 'reason: blob is empty (0 bytes)');
            } else {
                console.log('[Apply] Used original:', entry.fileName, 'reason: compressed larger', blob.size, '> original', entry.originalSize);
            }
        }
        if (callback) callback();
    },

    // ========================================
    //   PNG-8 Palette Encoder (like UPNG.js)
    // ========================================

    // PNG-8 encoder using CompressionStream('deflate') for zlib format
    _encodePNG8Sync: function(w, h, quantResult) {
        // This is async internally but we use a workaround
        var self = this;
        var result = null;

        var palette = quantResult.palette;
        var indexedPixels = quantResult.indexedPixels;
        var hasAlpha = quantResult.hasAlpha;

        // Build filtered pixel data
        var rowSize = 1 + w;
        var rawData = new Uint8Array(rowSize * h);
        var offset = 0;
        for (var y = 0; y < h; y++) {
            rawData[offset++] = 0;
            for (var x = 0; x < w; x++) {
                rawData[offset++] = indexedPixels[y * w + x];
            }
        }

        // Store raw data for async compression
        this._pendingRawData = rawData;
        this._pendingPalette = palette;
        this._pendingHasAlpha = hasAlpha;
        this._pendingW = w;
        this._pendingH = h;

        return null; // Will be filled by async callback
    },

    // Async PNG-8 encoder using CompressionStream('deflate') - produces proper zlib format
    _encodePNG8Async: function(w, h, quantResult, callback) {
        var palette = quantResult.palette;
        var indexedPixels = quantResult.indexedPixels;
        var hasAlpha = quantResult.hasAlpha;

        var rowSize = 1 + w;
        var rawData = new Uint8Array(rowSize * h);
        var offset = 0;
        for (var y = 0; y < h; y++) {
            rawData[offset++] = 0;
            for (var x = 0; x < w; x++) {
                rawData[offset++] = indexedPixels[y * w + x];
            }
        }

        var self = this;
        console.log('[PNG-8] Starting encode:', w + 'x' + h, 'palette:', palette.length, 'colors', 'rawData:', rawData.length, 'bytes');

        // Use CompressionStream('deflate') which produces zlib format (header + DEFLATE + adler32)
        if (typeof CompressionStream !== 'undefined') {
            try {
                var blob = new Blob([rawData]);
                var stream = blob.stream();
                var cs = new CompressionStream('deflate');
                var compressed = stream.pipeThrough(cs);
                var reader = compressed.getReader();
                var chunks = [];

                reader.read().then(function process(result) {
                    if (result.done) {
                        var totalLen = 0;
                        for (var i = 0; i < chunks.length; i++) totalLen += chunks[i].length;
                        var zlibData = new Uint8Array(totalLen);
                        var offset = 0;
                        for (var i = 0; i < chunks.length; i++) {
                            zlibData.set(chunks[i], offset);
                            offset += chunks[i].length;
                        }
                        console.log('[PNG-8] CompressionStream success:', zlibData.length, 'bytes');
                        var png = self._assemblePNG(w, h, palette, hasAlpha, zlibData);
                        var blob = new Blob([png], { type: 'image/png' });
                        console.log('[PNG-8] Final PNG:', blob.size, 'bytes');
                        callback(blob);
                    } else {
                        chunks.push(result.value);
                        reader.read().then(process);
                    }
                }).catch(function(err) {
                    console.warn('[PNG-8] CompressionStream failed, using stored blocks:', err);
                    var deflated = self._deflateStoredBlocks(rawData);
                    var adler = self._adler32(rawData);
                    var zlibData = new Uint8Array(2 + deflated.length + 4);
                    zlibData[0] = 0x78; zlibData[1] = 0x01;
                    zlibData.set(deflated, 2);
                    zlibData[2 + deflated.length] = (adler >> 24) & 0xFF;
                    zlibData[3 + deflated.length] = (adler >> 16) & 0xFF;
                    zlibData[4 + deflated.length] = (adler >> 8) & 0xFF;
                    zlibData[5 + deflated.length] = adler & 0xFF;
                    console.log('[PNG-8] Stored blocks fallback:', zlibData.length, 'bytes');
                    var png = self._assemblePNG(w, h, palette, hasAlpha, zlibData);
                    var blob = new Blob([png], { type: 'image/png' });
                    console.log('[PNG-8] Final PNG:', blob.size, 'bytes');
                    callback(blob);
                });
            } catch (e) {
                console.warn('[PNG-8] CompressionStream not available:', e);
                var deflated = self._deflateStoredBlocks(rawData);
                var adler = self._adler32(rawData);
                var zlibData = new Uint8Array(2 + deflated.length + 4);
                zlibData[0] = 0x78; zlibData[1] = 0x01;
                zlibData.set(deflated, 2);
                zlibData[2 + deflated.length] = (adler >> 24) & 0xFF;
                zlibData[3 + deflated.length] = (adler >> 16) & 0xFF;
                zlibData[4 + deflated.length] = (adler >> 8) & 0xFF;
                zlibData[5 + deflated.length] = adler & 0xFF;
                console.log('[PNG-8] Stored blocks fallback:', zlibData.length, 'bytes');
                var png = self._assemblePNG(w, h, palette, hasAlpha, zlibData);
                var blob = new Blob([png], { type: 'image/png' });
                console.log('[PNG-8] Final PNG:', blob.size, 'bytes');
                callback(blob);
            }
        } else {
            console.log('[PNG-8] CompressionStream not supported, using stored blocks');
            var deflated = self._deflateStoredBlocks(rawData);
            var adler = self._adler32(rawData);
            var zlibData = new Uint8Array(2 + deflated.length + 4);
            zlibData[0] = 0x78; zlibData[1] = 0x01;
            zlibData.set(deflated, 2);
            zlibData[2 + deflated.length] = (adler >> 24) & 0xFF;
            zlibData[3 + deflated.length] = (adler >> 16) & 0xFF;
            zlibData[4 + deflated.length] = (adler >> 8) & 0xFF;
            zlibData[5 + deflated.length] = adler & 0xFF;
            console.log('[PNG-8] Stored blocks fallback:', zlibData.length, 'bytes');
            var png = self._assemblePNG(w, h, palette, hasAlpha, zlibData);
            var blob = new Blob([png], { type: 'image/png' });
            console.log('[PNG-8] Final PNG:', blob.size, 'bytes');
            callback(blob);
        }
    },

    _assemblePNG: function(w, h, palette, hasAlpha, zlibData) {
        var chunks = [];
        chunks.push(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

        var ihdr = new Uint8Array(13);
        ihdr[0] = (w >> 24) & 0xFF; ihdr[1] = (w >> 16) & 0xFF;
        ihdr[2] = (w >> 8) & 0xFF; ihdr[3] = w & 0xFF;
        ihdr[4] = (h >> 24) & 0xFF; ihdr[5] = (h >> 16) & 0xFF;
        ihdr[6] = (h >> 8) & 0xFF; ihdr[7] = h & 0xFF;
        ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
        chunks.push(this._makeChunk('IHDR', ihdr));

        var plte = new Uint8Array(palette.length * 3);
        for (var i = 0; i < palette.length; i++) {
            plte[i * 3] = palette[i][0];
            plte[i * 3 + 1] = palette[i][1];
            plte[i * 3 + 2] = palette[i][2];
        }
        chunks.push(this._makeChunk('PLTE', plte));

        if (hasAlpha) {
            var trns = new Uint8Array(palette.length);
            for (var i = 0; i < palette.length; i++) {
                trns[i] = palette[i].length > 3 ? palette[i][3] : 255;
            }
            chunks.push(this._makeChunk('tRNS', trns));
        }

        chunks.push(this._makeChunk('IDAT', zlibData));
        chunks.push(this._makeChunk('IEND', new Uint8Array(0)));

        var totalLen = 0;
        for (var i = 0; i < chunks.length; i++) totalLen += chunks[i].length;
        var png = new Uint8Array(totalLen);
        var pos = 0;
        for (var i = 0; i < chunks.length; i++) {
            png.set(chunks[i], pos);
            pos += chunks[i].length;
        }
        return png;
    },

    _adler32: function(data) {
        var a = 1, b = 0;
        for (var i = 0; i < data.length; i++) {
            a = (a + data[i]) % 65521;
            b = (b + a) % 65521;
        }
        return (b << 16) | a;
    },


    _makeChunk: function(type, data) {
        var len = data.length;
        var chunk = new Uint8Array(4 + 4 + len + 4);
        chunk[0] = (len >> 24) & 0xFF; chunk[1] = (len >> 16) & 0xFF;
        chunk[2] = (len >> 8) & 0xFF; chunk[3] = len & 0xFF;
        chunk[4] = type.charCodeAt(0); chunk[5] = type.charCodeAt(1);
        chunk[6] = type.charCodeAt(2); chunk[7] = type.charCodeAt(3);
        chunk.set(data, 8);
        var crc = PngCompressor._crc32(chunk.subarray(4, 8 + len));
        chunk[8 + len] = (crc >> 24) & 0xFF; chunk[9 + len] = (crc >> 16) & 0xFF;
        chunk[10 + len] = (crc >> 8) & 0xFF; chunk[11 + len] = crc & 0xFF;
        return chunk;
    },

    _crc32: function(data) {
        var table = PngCompressor._crc32Table;
        if (!table) {
            table = new Uint32Array(256);
            for (var i = 0; i < 256; i++) {
                var c = i;
                for (var j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                table[i] = c;
            }
            PngCompressor._crc32Table = table;
        }
        var crc = 0xFFFFFFFF;
        for (var i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    },

    // DEFLATE compression using browser's CompressionStream API
    _deflateCompressAsync: function(data, callback) {
        var self = this;
        // Try CompressionStream (Chrome 80+, Firefox 113+, Safari 16.4+)
        try {
            if (typeof CompressionStream !== 'undefined') {
                var blob = new Blob([data]);
                var stream = blob.stream();
                var cs = new CompressionStream('deflate-raw');
                var compressed = stream.pipeThrough(cs);
                var reader = compressed.getReader();
                var chunks = [];

                reader.read().then(function process(result) {
                    if (result.done) {
                        var totalLen = 0;
                        for (var i = 0; i < chunks.length; i++) totalLen += chunks[i].length;
                        var output = new Uint8Array(totalLen);
                        var offset = 0;
                        for (var i = 0; i < chunks.length; i++) {
                            output.set(chunks[i], offset);
                            offset += chunks[i].length;
                        }
                        callback(output);
                    } else {
                        chunks.push(result.value);
                        reader.read().then(process);
                    }
                }).catch(function(err) {
                    console.warn('CompressionStream failed, using stored blocks:', err);
                    callback(self._deflateStoredBlocks(data));
                });
                return;
            }
        } catch (e) {
            console.warn('CompressionStream not available:', e);
        }
        // Fallback: stored blocks (no compression, but valid DEFLATE)
        callback(this._deflateStoredBlocks(data));
    },

    _deflateStoredBlocks: function(data) {
        // DEFLATE stored blocks (no compression, but valid format)
        var MAX_BLOCK = 65535;
        var blocks = [];
        var offset = 0;

        while (offset < data.length) {
            var blockLen = Math.min(data.length - offset, MAX_BLOCK);
            var isFinal = (offset + blockLen >= data.length);
            var header = new Uint8Array(5);
            header[0] = isFinal ? 0x01 : 0x00;
            header[1] = blockLen & 0xFF;
            header[2] = (blockLen >> 8) & 0xFF;
            header[3] = (~blockLen) & 0xFF;
            header[4] = ((~blockLen) >> 8) & 0xFF;
            blocks.push(header);
            blocks.push(data.subarray(offset, offset + blockLen));
            offset += blockLen;
        }

        var totalLen = 0;
        for (var i = 0; i < blocks.length; i++) totalLen += blocks[i].length;
        var result = new Uint8Array(totalLen);
        var pos = 0;
        for (var i = 0; i < blocks.length; i++) {
            result.set(blocks[i], pos);
            pos += blocks[i].length;
        }
        console.log('[DEFLATE] Stored blocks:', data.length, '->', result.length, 'bytes (no compression)');
        return result;
    },

    // ========================================
    //   Color Quantization with Palette Output
    // ========================================

    _quantizeToPalette: function(data, targetColors, w, h) {
        var len = data.length;
        var pixelCount = w * h;
        var hasAlpha = false;

        // Check for transparency
        for (var i = 3; i < len; i += 4) {
            if (data[i] < 255) { hasAlpha = true; break; }
        }

        // Collect unique opaque colors
        var colorMap = {};
        var uniqueColors = [];
        for (var i = 0; i < len; i += 4) {
            if (data[i + 3] === 0) continue;
            var key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            if (!colorMap[key]) {
                colorMap[key] = true;
                uniqueColors.push([data[i], data[i + 1], data[i + 2]]);
            }
        }

        // If no quantization needed, build palette directly
        if (uniqueColors.length <= targetColors) {
            var palette = [];
            var indexedPixels = new Uint8Array(pixelCount);
            var colorIndex = {};

            if (hasAlpha) {
                palette.push([0, 0, 0, 0]); // transparent entry at index 0
            }
            for (var i = 0; i < uniqueColors.length; i++) {
                palette.push(uniqueColors[i]);
                var key = (uniqueColors[i][0] << 16) | (uniqueColors[i][1] << 8) | uniqueColors[i][2];
                colorIndex[key] = palette.length - 1;
            }
            var transparentIdx = 0;
            for (var i = 0; i < pixelCount; i++) {
                if (data[i * 4 + 3] === 0) {
                    indexedPixels[i] = transparentIdx;
                } else {
                    var key = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
                    indexedPixels[i] = colorIndex[key];
                }
            }
            return { palette: palette, indexedPixels: indexedPixels, hasAlpha: hasAlpha };
        }

        // Median cut
        var paletteSlots = hasAlpha ? targetColors - 1 : targetColors;
        if (paletteSlots < 1) paletteSlots = 1;
        var buckets = this._medianCut(uniqueColors, paletteSlots);

        // Build palette
        var palette = [];
        var transparentIdx = -1;
        if (hasAlpha) {
            palette.push([0, 0, 0, 0]); // transparent at index 0
            transparentIdx = 0;
        }
        for (var b = 0; b < buckets.length; b++) {
            palette.push(this._avgColor(buckets[b]));
        }

        // Dithering with indexed output
        var dithering = this.state.dithering;
        var buf = new Float32Array(pixelCount * 3);
        for (var i = 0; i < len; i += 4) {
            var pi = (i >> 2) * 3;
            buf[pi] = data[i];
            buf[pi + 1] = data[i + 1];
            buf[pi + 2] = data[i + 2];
        }

        // Dithering strength multiplier
        var ditherStrength = 1.0;
        if (dithering === 'none') ditherStrength = 0;
        else if (dithering === 'light') ditherStrength = 0.4;

        var indexedPixels = new Uint8Array(pixelCount);
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var pidx = y * w + x;
                var didx = pidx * 4;

                if (data[didx + 3] === 0) {
                    indexedPixels[pidx] = transparentIdx;
                    continue;
                }

                var pi = pidx * 3;
                var r = buf[pi], g = buf[pi + 1], b = buf[pi + 2];
                r = r < 0 ? 0 : (r > 255 ? 255 : r);
                g = g < 0 ? 0 : (g > 255 ? 255 : g);
                b = b < 0 ? 0 : (b > 255 ? 255 : b);

                var nearest = this._findNearest([r, g, b], palette);
                indexedPixels[pidx] = nearest.index;

                // Apply dithering with strength control
                if (ditherStrength > 0) {
                    var er = (r - nearest.color[0]) * ditherStrength;
                    var eg = (g - nearest.color[1]) * ditherStrength;
                    var eb = (b - nearest.color[2]) * ditherStrength;

                    this._diffuseError(buf, w, h, x + 1, y, er, eg, eb, 7 / 16);
                    this._diffuseError(buf, w, h, x - 1, y + 1, er, eg, eb, 3 / 16);
                    this._diffuseError(buf, w, h, x, y + 1, er, eg, eb, 5 / 16);
                    this._diffuseError(buf, w, h, x + 1, y + 1, er, eg, eb, 1 / 16);
                }
            }
        }

        return { palette: palette, indexedPixels: indexedPixels, hasAlpha: hasAlpha };
    },

    _diffuseError: function(buf, w, h, x, y, er, eg, eb, factor) {
        if (x < 0 || x >= w || y >= h) return;
        var pi = (y * w + x) * 3;
        buf[pi] += er * factor;
        buf[pi + 1] += eg * factor;
        buf[pi + 2] += eb * factor;
    },

    _medianCut: function(colors, targetCount) {
        var buckets = [colors];
        while (buckets.length < targetCount) {
            var maxRange = -1, maxIdx = 0;
            for (var i = 0; i < buckets.length; i++) {
                var r = this._colorRange(buckets[i]);
                if (r.max > maxRange) { maxRange = r.max; maxIdx = i; }
            }
            if (maxRange <= 0) break;

            var bucket = buckets.splice(maxIdx, 1)[0];
            var ch = this._colorRange(bucket).channel;
            bucket.sort(function(a, b) { return a[ch] - b[ch]; });
            var mid = Math.floor(bucket.length / 2);
            if (mid === 0) mid = 1;
            buckets.push(bucket.slice(0, mid));
            buckets.push(bucket.slice(mid));
        }
        return buckets;
    },

    _colorRange: function(colors) {
        var minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
        for (var i = 0; i < colors.length; i++) {
            var c = colors[i];
            if (c[0] < minR) minR = c[0]; if (c[0] > maxR) maxR = c[0];
            if (c[1] < minG) minG = c[1]; if (c[1] > maxG) maxG = c[1];
            if (c[2] < minB) minB = c[2]; if (c[2] > maxB) maxB = c[2];
        }
        var rR = maxR - minR, rG = maxG - minG, rB = maxB - minB;
        var max = rR, ch = 0;
        if (rG > max) { max = rG; ch = 1; }
        if (rB > max) { max = rB; ch = 2; }
        return { max: max, channel: ch };
    },

    _avgColor: function(colors) {
        var r = 0, g = 0, b = 0;
        for (var i = 0; i < colors.length; i++) {
            r += colors[i][0]; g += colors[i][1]; b += colors[i][2];
        }
        var n = colors.length || 1;
        return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    },

    _findNearest: function(color, palette) {
        var minDist = Infinity, nearestIdx = 0, nearestColor = palette[0];
        var start = 0;
        // Skip transparent entry if it exists (first entry with alpha=0)
        if (palette[0].length > 3 && palette[0][3] === 0) start = 1;

        // Perceptual weighting (human eye is more sensitive to green, then red, then blue)
        var wr = 0.299, wg = 0.587, wb = 0.114;

        for (var i = start; i < palette.length; i++) {
            var p = palette[i];
            var dr = color[0] - p[0], dg = color[1] - p[1], db = color[2] - p[2];
            // Weighted Euclidean distance for better perceptual matching
            var dist = wr * dr * dr + wg * dg * dg + wb * db * db;
            if (dist < minDist) { minDist = dist; nearestIdx = i; nearestColor = p; }
        }
        return { index: nearestIdx, color: nearestColor };
    },

    _countUniqueColors: function(data) {
        var colors = {};
        var count = 0;
        for (var i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            var key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            if (!colors[key]) { colors[key] = true; count++; }
        }
        return count;
    },

    // ========================================
    //   Preview
    // ========================================

    _updatePreview: function() {
        var entry = this._getCurrentEntry();
        if (!entry) { this._showEmptyState(); return; }

        this._overlay.querySelector('#ttEmptyState').style.display = 'none';
        this._overlay.querySelector('#ttPreviewContainer').style.display = '';

        var origCanvas = this._overlay.querySelector('#ttOriginalCanvas');
        var maxW = 400, maxH = 350;
        var scale = Math.min(maxW / entry.originalWidth, maxH / entry.originalHeight, 1);
        var dw = Math.round(entry.originalWidth * scale);
        var dh = Math.round(entry.originalHeight * scale);

        origCanvas.width = dw;
        origCanvas.height = dh;
        origCanvas.getContext('2d').drawImage(entry.originalImage, 0, 0, dw, dh);

        this._overlay.querySelector('#ttOriginalSize').innerHTML =
            this._formatSize(entry.originalSize) + ' (' + entry.originalWidth + '×' + entry.originalHeight + ')';

        var compCanvas = this._overlay.querySelector('#ttCompressedCanvas');
        var compSizeEl = this._overlay.querySelector('#ttCompressedSize');

        // Compressed preview - show overlay with compression info
        compCanvas.width = dw;
        compCanvas.height = dh;
        var compCtx = compCanvas.getContext('2d');

        if (entry.compressedBlob) {
            // Draw original as background reference
            compCtx.drawImage(entry.originalImage, 0, 0, dw, dh);
            compCtx.fillStyle = 'rgba(0,0,0,0.55)';
            compCtx.fillRect(0, 0, dw, dh);

            if (entry.usedOriginal) {
                compCtx.fillStyle = '#aaa';
                compCtx.font = 'bold 14px sans-serif';
                compCtx.textAlign = 'center';
                compCtx.fillText('已优化，保留原文件', dw / 2, dh / 2);
                compSizeEl.innerHTML = this._formatSize(entry.compressedSize) +
                    ' <span class="tt-percent" style="color:var(--text2);">(已优化)</span>';
            } else {
                var pct = Math.round((1 - entry.compressedSize / entry.originalSize) * 100);
                compCtx.fillStyle = '#00c853';
                compCtx.font = 'bold 28px sans-serif';
                compCtx.textAlign = 'center';
                compCtx.fillText('-' + pct + '%', dw / 2, dh / 2 - 8);
                compCtx.fillStyle = '#fff';
                compCtx.font = '13px sans-serif';
                compCtx.fillText(this._formatSize(entry.originalSize) + ' → ' + this._formatSize(entry.compressedSize), dw / 2, dh / 2 + 18);
                compSizeEl.innerHTML = this._formatSize(entry.compressedSize) +
                    ' <span class="tt-percent">(-' + pct + '%)</span>';
            }
        } else {
            compCtx.fillStyle = '#333';
            compCtx.fillRect(0, 0, dw, dh);
            compCtx.fillStyle = '#555';
            compCtx.font = '14px sans-serif';
            compCtx.textAlign = 'center';
            compCtx.fillText('点击"压缩"按钮', dw / 2, dh / 2);
            compSizeEl.textContent = '-';
        }
    },

    _showEmptyState: function() {
        if (!this._overlay) return;
        this._overlay.querySelector('#ttEmptyState').style.display = '';
        this._overlay.querySelector('#ttPreviewContainer').style.display = 'none';
    },

    // ========================================
    //   UI Updates
    // ========================================

    _updateImageListUI: function() {
        var list = this._overlay.querySelector('#ttImageList');
        var countEl = this._overlay.querySelector('#ttImageCount');
        var html = '';
        var self = this;

        this.state.imageList.forEach(function(entry, i) {
            var isActive = i === self.state.activeImageIndex;
            var sizeText = self._formatSize(entry.originalSize);
            var statusText = '';
            if (entry.compressedBlob) {
                if (entry.usedOriginal) {
                    statusText = ' → <span style="color:var(--text2);font-size:10px;">已优化</span>';
                } else {
                    var pct = Math.round((entry.originalSize - entry.compressedSize) / entry.originalSize * 100);
                    statusText = ' → <span class="tt-reduced">' + self._formatSize(entry.compressedSize) + ' (-' + pct + '%)</span>';
                }
            } else {
                statusText = ' <span style="color:var(--text2);font-size:10px;">待压缩</span>';
            }

            html += '' +
            '<div class="tt-image-item' + (isActive ? ' active' : '') + '" data-index="' + i + '">' +
                '<img class="tt-image-thumb" src="' + entry.thumbUrl + '" alt="" style="background:repeating-conic-gradient(#222 0% 25%, #2a2a4a 0% 50%) 0 0/10px 10px">' +
                '<div class="tt-image-info">' +
                    '<div class="tt-image-name">' + self._escapeHtml(entry.fileName) + '</div>' +
                    '<div class="tt-image-size">' + sizeText + statusText + '</div>' +
                '</div>' +
                '<button class="tt-image-del" data-index="' + i + '" title="移除">×</button>' +
            '</div>';
        });

        list.innerHTML = html;
        countEl.textContent = this.state.imageList.length + ' 张';
        this._overlay.querySelector('#ttInfoText').textContent =
            this.state.imageList.length > 0 ? '共 ' + this.state.imageList.length + ' 张图片' : '';
    },

    _updateStats: function() {
        var totalOrig = 0, totalComp = 0, compCount = 0;
        this.state.imageList.forEach(function(e) {
            totalOrig += e.originalSize;
            if (e.compressedBlob) { totalComp += e.compressedSize; compCount++; }
        });
        this._overlay.querySelector('#ttStatCount').textContent = this.state.imageList.length;
        this._overlay.querySelector('#ttStatOriginal').textContent = this._formatSize(totalOrig);
        if (compCount > 0) {
            this._overlay.querySelector('#ttStatCompressed').textContent = this._formatSize(totalComp);
            this._overlay.querySelector('#ttStatSaved').textContent =
                Math.round((totalOrig - totalComp) / totalOrig * 100) + '%';
        } else {
            this._overlay.querySelector('#ttStatCompressed').textContent = '0 KB';
            this._overlay.querySelector('#ttStatSaved').textContent = '0%';
        }
    },

    // ========================================
    //   Export
    // ========================================

    _exportCurrent: function() {
        var entry = this._getCurrentEntry();
        if (!entry || !entry.compressedBlob) { this._toast('请先压缩图片', true); return; }
        this._downloadBlob(entry.compressedBlob, this._getExportName(entry));
    },

    _exportAll: function() {
        var self = this;
        var toExport = this.state.imageList.filter(function(e) { return e.compressedBlob; });
        if (!toExport.length) { this._toast('没有可导出的压缩图片', true); return; }

        if (window.showDirectoryPicker) {
            this._selectDirForExport().then(function(dirHandle) {
                if (dirHandle) self._batchExportToDir(toExport, dirHandle);
            });
        } else {
            toExport.forEach(function(entry, i) {
                setTimeout(function() { self._downloadBlob(entry.compressedBlob, self._getExportName(entry)); }, i * 200);
            });
            this._toast('开始下载 ' + toExport.length + ' 个文件');
        }
    },

    _selectDirForExport: function() {
        var self = this;
        return window.showDirectoryPicker({ mode: 'readwrite' }).then(function(handle) {
            self.state.selectedDirHandle = handle;
            self._saveDirHandle(handle);
            return handle;
        }).catch(function() { return null; });
    },

    _batchExportToDir: function(entries, dirHandle) {
        var self = this;
        var total = entries.length, done = 0;
        var progressWrap = this._overlay.querySelector('#ttProgressWrap');
        var progressBar = this._overlay.querySelector('#ttProgressBar');
        var progressText = this._overlay.querySelector('#ttProgressText');
        progressWrap.style.display = '';
        progressText.style.display = '';

        function exportNext() {
            if (done >= total) {
                progressWrap.style.display = 'none';
                progressText.style.display = 'none';
                self._toast('导出完成，共 ' + total + ' 个文件');
                return;
            }
            var entry = entries[done];
            dirHandle.getFileHandle(self._getExportName(entry), { create: true })
                .then(function(fh) { return fh.createWritable(); })
                .then(function(w) { return w.write(entry.compressedBlob).then(function() { return w.close(); }); })
                .then(function() {
                    done++;
                    progressBar.style.width = Math.round(done / total * 100) + '%';
                    progressText.textContent = done + ' / ' + total;
                    setTimeout(exportNext, 10);
                })
                .catch(function() { done++; setTimeout(exportNext, 10); });
        }
        exportNext();
    },

    _getExportName: function(entry) {
        var base = entry.fileName.replace(/\.[^.]+$/, '');
        // Determine extension from actual blob type
        var ext = '.png';
        if (entry.compressedBlob && entry.compressedBlob.type === 'image/webp') {
            ext = '.webp';
        } else if (this.state.outputFormat === 'webp') {
            ext = '.webp';
        }
        return base + '_compressed' + ext;
    },

    _downloadBlob: function(blob, name) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    },

    // ========================================
    //   IndexedDB
    // ========================================

    _saveDirHandle: function(handle) {
        try {
            var req = indexedDB.open('PngCompressorDB', 1);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
            };
            req.onsuccess = function(e) {
                e.target.result.transaction('handles', 'readwrite').objectStore('handles').put(handle, 'exportDir');
            };
        } catch (e) {}
    },

    _loadDirHandle: function() {
        var self = this;
        try {
            var req = indexedDB.open('PngCompressorDB', 1);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
            };
            req.onsuccess = function(e) {
                var tx = e.target.result.transaction('handles', 'readonly');
                tx.objectStore('handles').get('exportDir').onsuccess = function() {
                    if (this.result) self.state.selectedDirHandle = this.result;
                };
            };
        } catch (e) {}
    },

    // ========================================
    //   Utilities
    // ========================================

    _formatSize: function(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    },

    _escapeHtml: function(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    _toast: function(msg, isError) {
        var el = this._overlay.querySelector('#ttToast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'tt-toast show' + (isError ? ' error' : '');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(function() { el.className = 'tt-toast'; }, 2500);
    }
};
