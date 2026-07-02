/**
 * Property Panel Module - 属性面板模块
 */
var PropertyPanelModule = (function() {
    var panelContainer = null;
    var currentNode = null;

    var module = {
        id: 'property-panel',
        name: '属性面板',

        activate: function() {
            console.log('Property Panel activated');
            panelContainer = document.getElementById('propertyPanel');
        },

        deactivate: function() {
            console.log('Property Panel deactivated');
        },

        showNodeProperties: function(node) {
            currentNode = node;
            renderProperties(node);
        }
    };

    function renderProperties(node) {
        if (!panelContainer) return;

        if (!node) {
            panelContainer.innerHTML = '<p class="placeholder-text">选择节点查看属性</p>';
            return;
        }

        // 检查该节点是否已被标记为差异点
        var linkedDp = findLinkedDiffPoint(node.id);

        var html = '';

        // 基本属性
        html += '<div class="property-group">';
        html += '<div class="property-group-title">基本属性</div>';
        html += createPropertyRow('ID', node.id, 'text', true);
        html += createPropertyRow('名称', node.name, 'text', false, 'name');
        html += '</div>';

        // 位置
        html += '<div class="property-group">';
        html += '<div class="property-group-title">位置</div>';
        html += createPropertyRow('X', Math.round(node.x), 'number', false, 'x');
        html += createPropertyRow('Y', Math.round(node.y), 'number', false, 'y');
        html += '</div>';

        // 尺寸
        html += '<div class="property-group">';
        html += '<div class="property-group-title">尺寸</div>';
        html += createPropertyRow('宽度', node.width, 'number', false, 'width');
        html += createPropertyRow('高度', node.height, 'number', false, 'height');
        html += '</div>';

        // 图片素材信息
        if (node.imageData) {
            html += '<div class="property-group">';
            html += '<div class="property-group-title">素材</div>';
            html += '<div class="prop-asset-preview"><img src="' + node.imageData + '" style="max-width:100%;max-height:80px;border-radius:4px;"></div>';
            html += '</div>';
        }

        // 差异点操作
        html += '<div class="property-group">';
        html += '<div class="property-group-title">差异点操作</div>';
        if (linkedDp) {
            html += '<div class="prop-dp-linked">';
            html += '<span class="prop-dp-badge">✓ 已关联差异点 #' + linkedDp.eventId + '</span>';
            html += '<span class="prop-dp-name">' + (linkedDp.name || linkedDp.trigger.type + ' 触发') + '</span>';
            html += '</div>';
            html += '<button class="btn btn-sm btn-secondary" onclick="PropertyPanelModule.unlinkDiffPoint(\'' + node.id + '\')">取消关联</button>';
        } else {
            html += '<button class="btn btn-sm btn-primary" onclick="PropertyPanelModule.markAsDiffPoint(\'' + node.id + '\')">标记为差异点</button>';
            html += '<span class="form-hint">点击后自动创建差异点配置</span>';
        }
        html += '</div>';

        // 删除
        html += '<div class="property-group">';
        html += '<button class="btn btn-danger btn-sm" onclick="PropertyPanelModule.deleteNode()">删除节点</button>';
        html += '</div>';

        panelContainer.innerHTML = html;

        // 绑定输入事件
        var inputs = panelContainer.querySelectorAll('.property-input');
        inputs.forEach(function(input) {
            input.addEventListener('change', function() {
                var key = input.dataset.key;
                if (!key || !currentNode) return;
                var value = input.value;
                if (input.type === 'number') value = parseFloat(value) || 0;
                currentNode[key] = value;
                CanvasEngine.render();
            });
        });
    }

    function createPropertyRow(label, value, type, readonly, key) {
        var html = '<div class="property-row">';
        html += '<span class="property-label">' + label + '</span>';
        html += '<input class="property-input" type="' + type + '" value="' + escapeAttr(value) + '"';
        if (readonly) html += ' readonly';
        if (key) html += ' data-key="' + key + '"';
        html += '>';
        html += '</div>';
        return html;
    }

    function escapeAttr(val) {
        if (val === null || val === undefined) return '';
        return String(val).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    /**
     * 查找节点关联的差异点
     */
    function findLinkedDiffPoint(nodeId) {
        if (typeof WorkflowEditorModule === 'undefined') return null;
        var points = WorkflowEditorModule.getDiffPoints();
        for (var i = 0; i < points.length; i++) {
            var dp = points[i];
            if (dp.oldNodes && dp.oldNodes.indexOf(nodeId) >= 0) return dp;
            if (dp.newNodes && dp.newNodes.indexOf(nodeId) >= 0) return dp;
        }
        return null;
    }

    /**
     * 将选中节点标记为差异点（一键创建）
     */
    function markAsDiffPoint(nodeId) {
        var nodes = CanvasEngine.getNodes();
        var node = null;
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === nodeId) { node = nodes[i]; break; }
        }
        if (!node) return;

        // 自动分配 eventId
        var existingPoints = [];
        if (typeof WorkflowEditorModule !== 'undefined') {
            existingPoints = WorkflowEditorModule.getDiffPoints();
        }
        var maxEventId = 0;
        for (var j = 0; j < existingPoints.length; j++) {
            if (existingPoints[j].eventId > maxEventId) maxEventId = existingPoints[j].eventId;
        }
        var newEventId = maxEventId + 1;

        var dp = {
            id: 'dp_' + Date.now(),
            eventId: newEventId,
            name: node.name || '差异点 ' + newEventId,
            text: '',
            kong: '', ui: '', number: 0, pos: [],
            oldNodes: [],
            newNodes: [nodeId],
            trigger: { type: 'click', count: 1, time: 0.5 },
            executors: [{ type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 }],
            results: [{ result: 'Collect', val: newEventId }],
            talkMsgs: [], talkPos: [], curTalkPos: 0, curTalkTime: 0,
            curTalkMusic: '', talk: 0, nexttalk: 0, talkResult: [], works: []
        };

        if (typeof WorkflowEditorModule !== 'undefined') {
            WorkflowEditorModule.addDiffPoint(dp);
            state.diffPoints = WorkflowEditorModule.getDiffPoints();
        }

        // 自动更新通关条件
        autoUpdatePassCondition();

        // 刷新 UI
        renderProperties(node);
        if (typeof renderDiffPointList === 'function') renderDiffPointList();
        if (typeof renderWorkflowSteps === 'function') renderWorkflowSteps();

        if (typeof animalUtils !== 'undefined' && animalUtils.showTypewriterToast) {
            animalUtils.showTypewriterToast('已标记为差异点 #' + newEventId);
        }
    }

    /**
     * 取消差异点关联
     */
    function unlinkDiffPoint(nodeId) {
        if (typeof WorkflowEditorModule === 'undefined') return;
        var points = WorkflowEditorModule.getDiffPoints();
        for (var i = 0; i < points.length; i++) {
            var dp = points[i];
            var idx1 = dp.oldNodes ? dp.oldNodes.indexOf(nodeId) : -1;
            var idx2 = dp.newNodes ? dp.newNodes.indexOf(nodeId) : -1;
            if (idx1 >= 0) dp.oldNodes.splice(idx1, 1);
            if (idx2 >= 0) dp.newNodes.splice(idx2, 1);

            // 如果差异点没有关联任何节点，删除它
            if ((!dp.oldNodes || dp.oldNodes.length === 0) && (!dp.newNodes || dp.newNodes.length === 0)) {
                WorkflowEditorModule.removeDiffPoint(dp.id);
            }
        }
        state.diffPoints = WorkflowEditorModule.getDiffPoints();
        autoUpdatePassCondition();

        if (currentNode) renderProperties(currentNode);
        if (typeof renderDiffPointList === 'function') renderDiffPointList();
        if (typeof renderWorkflowSteps === 'function') renderWorkflowSteps();
    }

    /**
     * 自动更新通关条件：passEvent 包含所有差异点的 eventId
     */
    function autoUpdatePassCondition() {
        var points = [];
        if (typeof WorkflowEditorModule !== 'undefined') {
            points = WorkflowEditorModule.getDiffPoints();
        }
        var eventIds = [];
        for (var i = 0; i < points.length; i++) {
            if (points[i].eventId) eventIds.push(points[i].eventId);
        }
        state.level.passEvent = eventIds;
        state.level.passValue = eventIds.length;

        // 刷新配置面板
        if (typeof LevelConfigModule !== 'undefined') {
            LevelConfigModule.setConfig(state.level);
        }
    }

    function deleteNode() {
        if (!currentNode) return;
        if (confirm('确定删除节点 "' + currentNode.name + '"?')) {
            // 先取消差异点关联
            unlinkDiffPoint(currentNode.id);
            CanvasEngine.removeNode(currentNode);
            currentNode = null;
            renderProperties(null);
            if (typeof renderNodeTree === 'function') renderNodeTree();
            if (typeof renderWorkflowSteps === 'function') renderWorkflowSteps();
        }
    }

    return module;
})();

if (typeof window !== 'undefined') {
    window.PropertyPanelModule = PropertyPanelModule;
}
