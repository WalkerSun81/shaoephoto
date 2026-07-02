/**
 * Scene Canvas Module - 场景画布模块
 */
var SceneCanvasModule = (function() {
    var canvasContainer = null;
    var canvas = null;

    /**
     * 模块接口
     */
    var module = {
        id: 'scene-canvas',
        name: '场景画布',

        /**
         * 激活模块
         */
        activate: function() {
            console.log('Scene Canvas activated');
            initCanvas();
            bindToolbar();
        },

        /**
         * 停用模块
         */
        deactivate: function() {
            console.log('Scene Canvas deactivated');
        }
    };

    /**
     * 初始化画布
     */
    function initCanvas() {
        canvasContainer = document.getElementById('canvasContainer');
        canvas = document.getElementById('mainCanvas');

        if (canvas) {
            CanvasEngine.init(canvas);
        }
    }

    /**
     * 绑定工具栏
     */
    function bindToolbar() {
        var btnSelect = document.getElementById('btnSelect');
        var btnMove = document.getElementById('btnMove');
        var btnZoomIn = document.getElementById('btnZoomIn');
        var btnZoomOut = document.getElementById('btnZoomOut');
        var btnFitView = document.getElementById('btnFitView');

        if (btnSelect) {
            btnSelect.addEventListener('click', function() {
                setActiveTool('select');
                CanvasEngine.setMode('select');
            });
        }

        if (btnMove) {
            btnMove.addEventListener('click', function() {
                setActiveTool('move');
                CanvasEngine.setMode('move');
            });
        }

        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', function() {
                // TODO: Implement zoom in
            });
        }

        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', function() {
                // TODO: Implement zoom out
            });
        }

        if (btnFitView) {
            btnFitView.addEventListener('click', function() {
                CanvasEngine.fitView();
            });
        }
    }

    /**
     * 设置活动工具
     */
    function setActiveTool(tool) {
        var buttons = document.querySelectorAll('.tool-btn');
        buttons.forEach(function(btn) {
            btn.classList.remove('active');
        });

        var activeBtn = document.getElementById('btn' + tool.charAt(0).toUpperCase() + tool.slice(1));
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    /**
     * 添加节点到画布
     */
    function addNodeToCanvas(nodeData) {
        var node = {
            id: nodeData.id || 'node_' + Date.now(),
            name: nodeData.name || 'New Node',
            x: nodeData.x || 100,
            y: nodeData.y || 100,
            width: nodeData.width || 100,
            height: nodeData.height || 80,
            color: nodeData.color || '#ffffff',
            data: nodeData
        };

        CanvasEngine.addNode(node);
        return node;
    }

    /**
     * 从画布删除节点
     */
    function removeNodeFromCanvas(node) {
        CanvasEngine.removeNode(node);
    }

    return module;
})();

if (typeof window !== 'undefined') {
    window.SceneCanvasModule = SceneCanvasModule;
}
