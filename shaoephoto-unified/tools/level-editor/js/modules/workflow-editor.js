/**
 * Workflow Editor Module - 差异点编辑器模块
 * 数据模型对齐 EventInfo + TalkInfo
 */
var WorkflowEditorModule = (function() {
    var listContainer = null;
    var diffPoints = [];
    var selectedDiffPoint = null;

    /**
     * 创建默认差异点
     */
    function createDefaultDiffPoint() {
        return {
            id: 'dp_' + Date.now(),
            eventId: 0,
            name: '',
            text: '',
            kong: '',
            ui: '',
            number: 0,
            pos: [],
            oldNodes: [],
            newNodes: [],
            trigger: { type: 'click', count: 1, time: 0.5 },
            executors: [{ type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 }],
            results: [{ result: 'Collect', val: 0 }],
            talkMsgs: [],
            talkPos: [],
            curTalkPos: 0,
            curTalkTime: 0,
            curTalkMusic: '',
            talk: 0,
            nexttalk: 0,
            talkResult: [],
            works: []
        };
    }

    /**
     * 模块接口
     */
    var module = {
        id: 'workflow-editor',
        name: '差异点编辑器',

        activate: function() {
            console.log('Workflow Editor activated');
            listContainer = document.getElementById('workflowList');
            bindEvents();
            renderList();
        },

        deactivate: function() {
            console.log('Workflow Editor deactivated');
        },

        getDiffPoints: function() {
            return diffPoints;
        },

        setDiffPoints: function(points) {
            diffPoints = points || [];
            if (!listContainer) {
                listContainer = document.getElementById('workflowList');
            }
            renderList();
        },

        addDiffPoint: function(dp) {
            dp.id = dp.id || ('dp_' + Date.now());
            diffPoints.push(dp);
            if (!listContainer) {
                listContainer = document.getElementById('workflowList');
            }
            renderList();
            return dp;
        },

        updateDiffPoint: function(id, fields) {
            var dp = module.getDiffPoint(id);
            if (dp) {
                for (var key in fields) {
                    if (fields.hasOwnProperty(key)) {
                        dp[key] = fields[key];
                    }
                }
                renderList();
                if (selectedDiffPoint && selectedDiffPoint.id === id) {
                    showDiffPointProperties(dp);
                }
            }
            return dp;
        },

        removeDiffPoint: function(id) {
            for (var i = 0; i < diffPoints.length; i++) {
                if (diffPoints[i].id === id) {
                    var removed = diffPoints.splice(i, 1)[0];
                    if (selectedDiffPoint && selectedDiffPoint.id === id) {
                        selectedDiffPoint = null;
                    }
                    renderList();
                    return removed;
                }
            }
            return null;
        },

        getDiffPoint: function(id) {
            for (var i = 0; i < diffPoints.length; i++) {
                if (diffPoints[i].id === id) return diffPoints[i];
            }
            return null;
        },

        getSelectedDiffPoint: function() {
            return selectedDiffPoint;
        },

        selectDiffPoint: function(dp) {
            selectedDiffPoint = dp;
            renderList();
            showDiffPointProperties(dp);
        },

        createDefault: function() {
            return createDefaultDiffPoint();
        }
    };

    /**
     * 绑定事件
     */
    function bindEvents() {
        var btnAdd = document.getElementById('btnAddWorkflow');
        if (btnAdd) {
            btnAdd.addEventListener('click', function() {
                if (typeof WorkflowTemplateModule !== 'undefined') {
                    WorkflowTemplateModule.showTemplateModal();
                }
            });
        }
    }

    /**
     * 渲染差异点列表
     */
    function renderList() {
        if (!listContainer) return;

        if (diffPoints.length === 0) {
            listContainer.innerHTML = '<p class="placeholder-text">暂无差异点<br>点击上方按钮添加</p>';
            return;
        }

        var html = '';
        for (var i = 0; i < diffPoints.length; i++) {
            var dp = diffPoints[i];
            var isSelected = selectedDiffPoint && selectedDiffPoint.id === dp.id;
            html += '<div class="diffpoint-item' + (isSelected ? ' selected' : '') + '" data-id="' + dp.id + '">';
            html += '<div class="diffpoint-item-header">';
            html += '<span class="diffpoint-item-title">' + (dp.name || '差异点 #' + dp.eventId) + '</span>';
            html += '<span class="diffpoint-badge">' + (dp.trigger ? dp.trigger.type : 'click') + '</span>';
            html += '</div>';
            html += '<div class="diffpoint-item-detail">';
            html += '<span class="diffpoint-event-tag">Event #' + dp.eventId + '</span>';
            if (dp.talkMsgs && dp.talkMsgs.length > 0) {
                html += ' <span class="diffpoint-talk-tag">Talk ' + dp.talk + '→' + dp.nexttalk + '</span>';
            }
            var nodeCount = (dp.oldNodes ? dp.oldNodes.length : 0) + (dp.newNodes ? dp.newNodes.length : 0);
            if (nodeCount > 0) {
                html += ' <span class="diffpoint-node-tag">' + nodeCount + '节点</span>';
            }
            html += '</div></div>';
        }

        listContainer.innerHTML = html;

        // 绑定点击事件
        var items = listContainer.querySelectorAll('.diffpoint-item');
        items.forEach(function(item) {
            item.addEventListener('click', function() {
                var id = item.dataset.id;
                var dp = module.getDiffPoint(id);
                if (dp) module.selectDiffPoint(dp);
            });
        });
    }

    /**
     * 在属性面板中显示差异点配置
     */
    function showDiffPointProperties(dp) {
        var panel = document.getElementById('propertyPanel');
        if (!panel) return;

        var html = '';

        // 事件信息区
        html += '<div class="prop-section">';
        html += '<div class="prop-section-title">事件信息</div>';
        html += createPropRow('事件ID', dp.eventId, 'number', 'eventId');
        html += createPropRow('名称', dp.name, 'text', 'name');
        html += createPropRow('描述', dp.text, 'text', 'text');
        html += createPropRow('UI标识', dp.ui, 'text', 'ui');
        html += createPropRow('数值', dp.number, 'number', 'number');
        html += '</div>';

        // 节点关联区
        html += '<div class="prop-section">';
        html += '<div class="prop-section-title">节点关联</div>';
        html += createPropRow('变体A节点', dp.oldNodes.join(','), 'text', 'oldNodes', '逗号分隔的节点ID');
        html += createPropRow('变体B节点', dp.newNodes.join(','), 'text', 'newNodes', '逗号分隔的节点ID');
        html += '</div>';

        // 触发器区
        html += '<div class="prop-section">';
        html += '<div class="prop-section-title">触发器</div>';
        html += createPropSelectRow('触发类型', dp.trigger.type, [
            { value: 'click', label: '点击' }, { value: 'drag', label: '拖动' }, { value: 'slide', label: '滑动' }
        ], 'trigger.type');
        html += createPropRow('触发次数', dp.trigger.count, 'number', 'trigger.count');
        html += createPropRow('连击间隔', dp.trigger.time, 'number', 'trigger.time');
        html += '</div>';

        // 执行器区
        var exec = dp.executors && dp.executors[0] ? dp.executors[0] : {};
        html += '<div class="prop-section">';
        html += '<div class="prop-section-title">执行器</div>';
        html += createPropSelectRow('执行类型', exec.type || 'node', [
            { value: 'node', label: '节点切换' }, { value: 'spine', label: 'Spine动画' }, { value: 'sound', label: '音效' }
        ], 'executors.0.type');
        html += createPropRow('消失时间', exec.disappearT || 0, 'number', 'executors.0.disappearT');
        html += createPropRow('出现时间', exec.appearT || 0, 'number', 'executors.0.appearT');
        html += createPropRow('音量', exec.soundVolume || 0, 'number', 'executors.0.soundVolume');
        html += '</div>';

        // 结果区
        var res = dp.results && dp.results[0] ? dp.results[0] : {};
        html += '<div class="prop-section">';
        html += '<div class="prop-section-title">结果</div>';
        html += createPropSelectRow('结果类型', res.result || 'Collect', [
            { value: 'Collect', label: '收集' }, { value: 'Pass', label: '通关' },
            { value: 'Fail', label: '失败' }, { value: 'EndTalk', label: '结束对话' }
        ], 'results.0.result');
        html += createPropRow('结果值', res.val || 0, 'number', 'results.0.val');
        html += '</div>';

        // 对话区（折叠）
        var hasTalk = dp.talkMsgs && dp.talkMsgs.length > 0;
        html += '<div class="prop-section">';
        html += '<div class="prop-section-title clickable" data-collapse="talk">对话配置 ' + (hasTalk ? '▼' : '▶') + '</div>';
        html += '<div class="prop-collapse" data-collapse="talk"' + (hasTalk ? '' : ' style="display:none"') + '>';
        html += createPropRow('对话消息IDs', (dp.talkMsgs || []).join(','), 'text', 'talkMsgs', '逗号分隔');
        html += createPropRow('对话位置', JSON.stringify(dp.talkPos || []), 'text', 'talkPos', 'JSON数组');
        html += createPropRow('当前位置', dp.curTalkPos || 0, 'number', 'curTalkPos');
        html += createPropRow('持续时间', dp.curTalkTime || 0, 'number', 'curTalkTime');
        html += createPropRow('音效', dp.curTalkMusic || '', 'text', 'curTalkMusic');
        html += createPropRow('当前轮次', dp.talk || 0, 'number', 'talk');
        html += createPropRow('下一轮次', dp.nexttalk || 0, 'number', 'nexttalk', '-1=结束');
        html += createPropRow('对话结果', JSON.stringify(dp.talkResult || []), 'text', 'talkResult', 'JSON二维数组');
        html += createPropRow('工作流分支', (dp.works || []).join(','), 'text', 'works', '逗号分隔');
        html += '</div></div>';

        // 删除按钮
        html += '<div class="prop-section">';
        html += '<button class="btn btn-danger btn-sm" id="btnDeleteDiffPoint">删除差异点</button>';
        html += '</div>';

        panel.innerHTML = html;
        bindDiffPointPropEvents(dp);
    }

    /**
     * 创建属性行
     */
    function createPropRow(label, value, type, key, hint) {
        var html = '<div class="prop-row">';
        html += '<span class="prop-label">' + label + '</span>';
        html += '<input class="prop-input" type="' + type + '" value="' + escapeAttr(value) + '" data-key="' + key + '">';
        if (hint) html += '<span class="prop-hint">' + hint + '</span>';
        html += '</div>';
        return html;
    }

    /**
     * 创建下拉属性行
     */
    function createPropSelectRow(label, value, options, key) {
        var html = '<div class="prop-row">';
        html += '<span class="prop-label">' + label + '</span>';
        html += '<select class="prop-input" data-key="' + key + '">';
        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            html += '<option value="' + opt.value + '"' + (opt.value == value ? ' selected' : '') + '>' + opt.label + '</option>';
        }
        html += '</select></div>';
        return html;
    }

    /**
     * 绑定差异点属性面板事件
     */
    function bindDiffPointPropEvents(dp) {
        // 折叠切换
        var collapsibles = document.querySelectorAll('.prop-section-title.clickable');
        collapsibles.forEach(function(title) {
            title.addEventListener('click', function() {
                var key = title.dataset.collapse;
                var body = document.querySelector('.prop-collapse[data-collapse="' + key + '"]');
                if (body) {
                    var visible = body.style.display !== 'none';
                    body.style.display = visible ? 'none' : '';
                    title.textContent = title.textContent.replace(/[▼▶]/, visible ? '▶' : '▼');
                }
            });
        });

        // 属性修改
        var inputs = document.querySelectorAll('.prop-input');
        inputs.forEach(function(input) {
            input.addEventListener('change', function() {
                var key = input.dataset.key;
                var value = input.value;

                if (input.type === 'number') {
                    value = parseFloat(value) || 0;
                }

                // 处理嵌套字段
                setNestedField(dp, key, value);

                // 刷新列表显示
                renderList();
            });
        });

        // 删除按钮
        var btnDelete = document.getElementById('btnDeleteDiffPoint');
        if (btnDelete) {
            btnDelete.addEventListener('click', function() {
                if (confirm('确定删除差异点 "' + (dp.name || '#' + dp.eventId) + '"?')) {
                    module.removeDiffPoint(dp.id);
                    var panel = document.getElementById('propertyPanel');
                    if (panel) panel.innerHTML = '<p class="placeholder-text">选择节点或差异点查看属性</p>';
                }
            });
        }
    }

    /**
     * 设置嵌套字段值
     */
    function setNestedField(obj, path, value) {
        // 处理数组字段
        var arrayFields = ['oldNodes', 'newNodes', 'talkMsgs', 'talkResult', 'works', 'talkPos'];
        if (arrayFields.indexOf(path) >= 0) {
            if (typeof value === 'string') {
                if (path === 'talkResult') {
                    try { obj[path] = JSON.parse(value); } catch (e) { obj[path] = []; }
                } else {
                    obj[path] = value.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
                }
            }
            return;
        }

        var parts = path.split('.');
        var current = obj;
        for (var i = 0; i < parts.length - 1; i++) {
            var key = isNaN(parts[i]) ? parts[i] : parseInt(parts[i]);
            if (!current[key]) current[key] = {};
            current = current[key];
        }
        var lastKey = parts[parts.length - 1];
        // 保持数字类型
        if (typeof current[lastKey] === 'number' || !isNaN(value)) {
            current[lastKey] = parseFloat(value) || 0;
        } else {
            current[lastKey] = value;
        }
    }

    function escapeAttr(val) {
        if (val === null || val === undefined) return '';
        var str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return module;
})();

if (typeof window !== 'undefined') {
    window.WorkflowEditorModule = WorkflowEditorModule;
}
