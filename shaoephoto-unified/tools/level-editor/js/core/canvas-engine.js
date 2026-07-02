/**
 * Canvas Engine - 画布引擎
 * 支持：节点渲染、拖拽、缩放、视口框、矩形框选、套索绘区
 */
var CanvasEngine = (function() {
    var canvas = null;
    var ctx = null;
    var nodes = [];
    var selectedNode = null;
    var hoveredNode = null;
    var transform = { x: 0, y: 0, scale: 1 };
    var isDragging = false;
    var isPanning = false;
    var dragStart = { x: 0, y: 0 };
    var mode = 'select'; // select, move, addDiff, rectSelect, lassoSelect

    // 视口框（设计区域）
    var viewport = { width: 720, height: 1280 };

    // 矩形框选状态
    var rectSelect = { active: false, startX: 0, startY: 0, endX: 0, endY: 0 };

    // 套索绘区状态
    var lassoSelect = { active: false, points: [] };

    function init(canvasEl) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        resize();
        bindEvents();
        render();
    }

    function resize() {
        var container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        // 自动居中视口
        fitView();
    }

    function bindEvents() {
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel);
        canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // 素材拖放
        canvas.addEventListener('dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        canvas.addEventListener('drop', function(e) {
            e.preventDefault();
            var assetIdx = parseInt(e.dataTransfer.getData('text/plain'));
            if (isNaN(assetIdx)) return;
            var pos = getMousePos(e);
            var canvasPos = screenToCanvas(pos);
            if (typeof onAssetDrop === 'function') onAssetDrop(assetIdx, canvasPos);
        });

        window.addEventListener('resize', resize);
    }

    function onMouseDown(e) {
        var pos = getMousePos(e);

        // 中键或 Alt+左键：平移
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            isPanning = true;
            dragStart = { x: pos.x - transform.x, y: pos.y - transform.y };
            canvas.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) return;

        // 矩形框选模式
        if (mode === 'rectSelect') {
            var cp = screenToCanvas(pos);
            rectSelect.active = true;
            rectSelect.startX = cp.x;
            rectSelect.startY = cp.y;
            rectSelect.endX = cp.x;
            rectSelect.endY = cp.y;
            return;
        }

        // 套索模式
        if (mode === 'lassoSelect') {
            var cp2 = screenToCanvas(pos);
            lassoSelect.active = true;
            lassoSelect.points = [{ x: cp2.x, y: cp2.y }];
            return;
        }

        // 选择模式
        if (mode === 'select' || mode === 'addDiff') {
            var node = getNodeAtPos(pos);
            selectNode(node);
            if (node) {
                isDragging = true;
                dragStart = { x: pos.x - node.x * transform.scale - transform.x, y: pos.y - node.y * transform.scale - transform.y };
            }
        }
    }

    function onMouseMove(e) {
        var pos = getMousePos(e);

        if (isPanning) {
            transform.x = pos.x - dragStart.x;
            transform.y = pos.y - dragStart.y;
            render();
            return;
        }

        // 矩形框选拖拽
        if (rectSelect.active) {
            var cp = screenToCanvas(pos);
            rectSelect.endX = cp.x;
            rectSelect.endY = cp.y;
            render();
            return;
        }

        // 套索拖拽
        if (lassoSelect.active) {
            var cp2 = screenToCanvas(pos);
            lassoSelect.points.push({ x: cp2.x, y: cp2.y });
            render();
            return;
        }

        // 节点拖拽
        if (isDragging && selectedNode) {
            var canvasPos = screenToCanvas(pos);
            selectedNode.x = canvasPos.x - (dragStart.x - transform.x) / transform.scale;
            selectedNode.y = canvasPos.y - (dragStart.y - transform.y) / transform.scale;
            render();
            if (typeof onNodeMoved === 'function') onNodeMoved(selectedNode);
            return;
        }

        // hover 检测
        var node = getNodeAtPos(pos);
        if (node !== hoveredNode) {
            hoveredNode = node;
            canvas.style.cursor = node ? 'pointer' : (mode === 'lassoSelect' ? 'crosshair' : 'default');
            render();
        }
    }

    function onMouseUp(e) {
        if (isPanning) { isPanning = false; canvas.style.cursor = 'default'; return; }

        // 矩形框选完成
        if (rectSelect.active) {
            rectSelect.active = false;
            var x = Math.min(rectSelect.startX, rectSelect.endX);
            var y = Math.min(rectSelect.startY, rectSelect.endY);
            var w = Math.abs(rectSelect.endX - rectSelect.startX);
            var h = Math.abs(rectSelect.endY - rectSelect.startY);
            if (w > 5 && h > 5 && typeof onRectSelect === 'function') {
                onRectSelect({ x: x, y: y, width: w, height: h });
            }
            render();
            return;
        }

        // 套索完成
        if (lassoSelect.active) {
            lassoSelect.active = false;
            if (lassoSelect.points.length > 3 && typeof onLassoSelect === 'function') {
                onLassoSelect(lassoSelect.points.slice());
            }
            lassoSelect.points = [];
            render();
            return;
        }

        isDragging = false;
    }

    function onWheel(e) {
        e.preventDefault();
        var pos = getMousePos(e);
        var delta = e.deltaY > 0 ? 0.9 : 1.1;
        var newScale = Math.max(0.1, Math.min(5, transform.scale * delta));
        transform.x = pos.x - (pos.x - transform.x) * (newScale / transform.scale);
        transform.y = pos.y - (pos.y - transform.y) * (newScale / transform.scale);
        transform.scale = newScale;
        updateZoomDisplay();
        render();
    }

    function getMousePos(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function screenToCanvas(pos) {
        return {
            x: (pos.x - transform.x) / transform.scale,
            y: (pos.y - transform.y) / transform.scale
        };
    }

    function canvasToScreen(pos) {
        return {
            x: pos.x * transform.scale + transform.x,
            y: pos.y * transform.scale + transform.y
        };
    }

    function getNodeAtPos(pos) {
        var cp = screenToCanvas(pos);
        for (var i = nodes.length - 1; i >= 0; i--) {
            var n = nodes[i];
            if (cp.x >= n.x && cp.x <= n.x + n.width && cp.y >= n.y && cp.y <= n.y + n.height) return n;
        }
        return null;
    }

    function selectNode(node) {
        selectedNode = node;
        render();
        if (typeof onNodeSelected === 'function') onNodeSelected(node);
    }

    function addNode(node) { nodes.push(node); render(); return node; }

    function removeNode(node) {
        var idx = nodes.indexOf(node);
        if (idx > -1) { nodes.splice(idx, 1); if (selectedNode === node) selectedNode = null; render(); }
    }

    // ===== 渲染 =====
    function render() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawGrid();
        ctx.save();
        ctx.translate(transform.x, transform.y);
        ctx.scale(transform.scale, transform.scale);

        // 绘制视口框（设计区域）
        drawViewportFrame();

        // 绘制节点
        for (var i = 0; i < nodes.length; i++) drawNode(nodes[i]);

        // 绘制矩形框选预览
        if (rectSelect.active) drawRectSelectPreview();

        // 绘制套索预览
        if (lassoSelect.active && lassoSelect.points.length > 1) drawLassoPreview();

        ctx.restore();
    }

    function drawGrid() {
        var gridSize = 20 * transform.scale;
        var offsetX = transform.x % gridSize;
        var offsetY = transform.y % gridSize;
        ctx.strokeStyle = '#e0d8c8';
        ctx.lineWidth = 1;
        for (var x = offsetX; x < canvas.width; x += gridSize) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
        for (var y = offsetY; y < canvas.height; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
    }

    function drawViewportFrame() {
        // 设计区域虚线框
        ctx.save();
        ctx.strokeStyle = '#2979ff';
        ctx.lineWidth = 2 / transform.scale;
        ctx.setLineDash([8 / transform.scale, 4 / transform.scale]);
        ctx.strokeRect(0, 0, viewport.width, viewport.height);
        ctx.setLineDash([]);

        // 半透明遮罩（设计区域外）
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        // 上
        ctx.fillRect(-2000, -2000, 6000, 2000);
        // 下
        ctx.fillRect(-2000, viewport.height, 6000, 2000);
        // 左
        ctx.fillRect(-2000, 0, 2000, viewport.height);
        // 右
        ctx.fillRect(viewport.width, 0, 2000, viewport.height);

        // 角标
        ctx.fillStyle = '#2979ff';
        ctx.font = (12 / transform.scale) + 'px sans-serif';
        ctx.fillText(viewport.width + ' × ' + viewport.height, 4, -4);

        ctx.restore();
    }

    function drawNode(node) {
        var isDp = node._isDiffPoint;
        if (isDp) {
            ctx.strokeStyle = node === selectedNode ? '#ff9800' : '#ffb74d';
            ctx.lineWidth = node === selectedNode ? 3 / transform.scale : 2 / transform.scale;
        } else {
            ctx.strokeStyle = node === selectedNode ? '#82D5BB' : (node === hoveredNode ? '#a8e6cf' : '#d4c9a8');
            ctx.lineWidth = (node === selectedNode ? 3 : 1) / transform.scale;
        }

        if (node.imageData) {
            if (!node._img) { node._img = new Image(); node._img.src = node.imageData; }
            if (node._img.complete && node._img.naturalWidth > 0) {
                ctx.drawImage(node._img, node.x, node.y, node.width, node.height);
            } else {
                ctx.fillStyle = node.color || '#ffffff';
                ctx.fillRect(node.x, node.y, node.width, node.height);
            }
        } else if (node._lassoPath && node._lassoPath.length > 2) {
            // 套索区域：绘制多边形填充
            ctx.fillStyle = 'rgba(255, 152, 0, 0.25)';
            ctx.beginPath();
            ctx.moveTo(node._lassoPath[0].x, node._lassoPath[0].y);
            for (var i = 1; i < node._lassoPath.length; i++) ctx.lineTo(node._lassoPath[i].x, node._lassoPath[i].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // 绘制标签
            if (node.name) {
                var cx = 0, cy = 0;
                node._lassoPath.forEach(function(p) { cx += p.x; cy += p.y; });
                cx /= node._lassoPath.length; cy /= node._lassoPath.length;
                ctx.fillStyle = '#5a4a3a';
                ctx.font = (12 / transform.scale) + 'px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(node.name, cx, cy + 4);
            }
            return;
        } else {
            ctx.fillStyle = node.color || '#ffffff';
            ctx.fillRect(node.x, node.y, node.width, node.height);
        }

        ctx.strokeRect(node.x, node.y, node.width, node.height);

        if (node.name) {
            ctx.fillStyle = '#5a4a3a';
            ctx.font = (12 / transform.scale) + 'px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(node.name, node.x + node.width / 2, node.y + node.height + 14 / transform.scale);
        }
    }

    function drawRectSelectPreview() {
        var x = Math.min(rectSelect.startX, rectSelect.endX);
        var y = Math.min(rectSelect.startY, rectSelect.endY);
        var w = Math.abs(rectSelect.endX - rectSelect.startX);
        var h = Math.abs(rectSelect.endY - rectSelect.startY);
        ctx.strokeStyle = '#ff5722';
        ctx.lineWidth = 2 / transform.scale;
        ctx.setLineDash([6 / transform.scale, 4 / transform.scale]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 87, 34, 0.15)';
        ctx.fillRect(x, y, w, h);
    }

    function drawLassoPreview() {
        ctx.strokeStyle = '#ff5722';
        ctx.lineWidth = 2 / transform.scale;
        ctx.setLineDash([6 / transform.scale, 4 / transform.scale]);
        ctx.beginPath();
        ctx.moveTo(lassoSelect.points[0].x, lassoSelect.points[0].y);
        for (var i = 1; i < lassoSelect.points.length; i++) ctx.lineTo(lassoSelect.points[i].x, lassoSelect.points[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255, 87, 34, 0.15)';
        ctx.fill();
    }

    function fitView() {
        if (!canvas) return;
        // 以视口框为中心
        var padding = 60;
        var contentW = viewport.width + padding * 2;
        var contentH = viewport.height + padding * 2;
        var scaleX = canvas.width / contentW;
        var scaleY = canvas.height / contentH;
        transform.scale = Math.min(scaleX, scaleY, 1.5);
        transform.x = (canvas.width - viewport.width * transform.scale) / 2;
        transform.y = (canvas.height - viewport.height * transform.scale) / 2;
        updateZoomDisplay();
        render();
    }

    function updateZoomDisplay() {
        var el = document.getElementById('zoomLevel');
        if (el) el.textContent = Math.round(transform.scale * 100) + '%';
    }

    function setMode(newMode) { mode = newMode; }
    function getSelectedNode() { return selectedNode; }
    function getNodes() { return nodes; }
    function setNodes(newNodes) { nodes = newNodes; render(); }
    function setViewport(w, h) { viewport.width = w; viewport.height = h; render(); }
    function getViewport() { return viewport; }

    function markDiffPointNodes(ids) {
        for (var i = 0; i < nodes.length; i++) nodes[i]._isDiffPoint = ids.indexOf(nodes[i].id) >= 0;
        render();
    }

    function clear() {
        nodes = []; selectedNode = null; hoveredNode = null;
        transform = { x: 0, y: 0, scale: 1 };
        render();
    }

    return {
        init: init, resize: resize, render: render,
        addNode: addNode, removeNode: removeNode, selectNode: selectNode,
        getSelectedNode: getSelectedNode, getNodes: getNodes, setNodes: setNodes,
        setMode: setMode, fitView: fitView, clear: clear,
        canvasToScreen: canvasToScreen, screenToCanvas: screenToCanvas,
        getMousePos: getMousePos, markDiffPointNodes: markDiffPointNodes,
        setViewport: setViewport, getViewport: getViewport
    };
})();

if (typeof window !== 'undefined') window.CanvasEngine = CanvasEngine;
