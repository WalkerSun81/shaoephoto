/**
 * Node Tree Module - 节点树模块
 */
var NodeTreeModule = (function() {
    var treeContainer = null;
    var selectedNode = null;

    /**
     * 模块接口
     */
    var module = {
        id: 'node-tree',
        name: '节点树',

        activate: function() {
            console.log('Node Tree activated');
            initTree();
            bindEvents();
        },

        deactivate: function() {
            console.log('Node Tree deactivated');
        }
    };

    /**
     * 初始化树
     */
    function initTree() {
        treeContainer = document.getElementById('nodeTree');
        renderTree();
    }

    /**
     * 绑定事件
     */
    function bindEvents() {
        var btnAddNode = document.getElementById('btnAddNode');
        if (btnAddNode) {
            btnAddNode.addEventListener('click', function() {
                addNewNode();
            });
        }
    }

    /**
     * 渲染节点树
     */
    function renderTree() {
        if (!treeContainer) return;

        var nodes = CanvasEngine.getNodes();
        treeContainer.innerHTML = '';

        if (nodes.length === 0) {
            treeContainer.innerHTML = '<p class="placeholder-text">暂无节点</p>';
            return;
        }

        var rootNodes = nodes.filter(function(n) { return !n.parentId; });
        rootNodes.forEach(function(node) {
            renderTreeNode(node, nodes, treeContainer);
        });
    }

    /**
     * 渲染单个树节点
     */
    function renderTreeNode(node, allNodes, container) {
        var nodeEl = document.createElement('div');
        nodeEl.className = 'tree-node' + (selectedNode === node ? ' selected' : '');
        nodeEl.innerHTML = '<span class="node-icon">📦</span>' + node.name;
        nodeEl.dataset.nodeId = node.id;

        nodeEl.addEventListener('click', function() {
            selectNode(node);
        });

        container.appendChild(nodeEl);

        // Render children
        var children = allNodes.filter(function(n) { return n.parentId === node.id; });
        if (children.length > 0) {
            var childrenEl = document.createElement('div');
            childrenEl.className = 'tree-children';
            children.forEach(function(child) {
                renderTreeNode(child, allNodes, childrenEl);
            });
            container.appendChild(childrenEl);
        }
    }

    /**
     * 选择节点
     */
    function selectNode(node) {
        selectedNode = node;
        CanvasEngine.selectNode(node);
        renderTree();

        // Update property panel
        if (typeof PropertyPanelModule !== 'undefined') {
            PropertyPanelModule.showNodeProperties(node);
        }
    }

    /**
     * 添加新节点
     */
    function addNewNode() {
        var nodes = CanvasEngine.getNodes();
        var nodeIndex = nodes.length;
        var newNode = {
            id: 'node_' + Date.now(),
            name: '节点 ' + (nodeIndex * 2 + 1),  // 奇数序列: 1, 3, 5, 7...
            x: 100 + nodeIndex * 20,
            y: 100 + nodeIndex * 20,
            width: 120,
            height: 80
        };

        // Add to history (execute will call addNode)
        HistoryManager.execute(
            function() {
                CanvasEngine.addNode(newNode);
                renderTree();
                selectNode(newNode);
            },
            function() {
                CanvasEngine.removeNode(newNode);
                renderTree();
            },
            '添加节点: ' + newNode.name
        );
    }

    /**
     * 删除选中节点
     */
    function deleteSelectedNode() {
        if (!selectedNode) return;

        var node = selectedNode;
        selectedNode = null;

        HistoryManager.execute(
            function() {
                CanvasEngine.removeNode(node);
                renderTree();
            },
            function() {
                CanvasEngine.addNode(node);
                renderTree();
            },
            '删除节点: ' + node.name
        );
    }

    /**
     * 刷新树
     */
    function refresh() {
        renderTree();
    }

    return module;
})();

if (typeof window !== 'undefined') {
    window.NodeTreeModule = NodeTreeModule;
}
