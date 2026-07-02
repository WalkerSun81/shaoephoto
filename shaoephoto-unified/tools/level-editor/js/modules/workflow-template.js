/**
 * Workflow Template Module - 差异点模板模块
 * 模板结构适配 diffPoint 模型
 */
var WorkflowTemplateModule = (function() {
    var templates = {
        basic: [
            {
                id: 'click_switch',
                name: '点击切换',
                icon: '⚡',
                description: '点击节点后切换显示，收集一个事件',
                defaults: {
                    trigger: { type: 'click', count: 1, time: 0.5 },
                    executors: [{ type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 }],
                    results: [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talk: 0, nexttalk: 0, talkResult: [], works: []
                }
            },
            {
                id: 'click_spine',
                name: '点击动画',
                icon: '🎬',
                description: '点击后播放Spine动画',
                defaults: {
                    trigger: { type: 'click', count: 1, time: 0.5 },
                    executors: [{ type: 'spine', disappearT: 0, appearT: 0, soundVolume: 0 }],
                    results: [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talk: 0, nexttalk: 0, talkResult: [], works: []
                }
            },
            {
                id: 'click_sound',
                name: '点击音效',
                icon: '🔊',
                description: '点击后播放音效并切换',
                defaults: {
                    trigger: { type: 'click', count: 1, time: 0.5 },
                    executors: [
                        { type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 },
                        { type: 'sound', disappearT: 0, appearT: 0, soundVolume: 1 }
                    ],
                    results: [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talk: 0, nexttalk: 0, talkResult: [], works: []
                }
            },
            {
                id: 'drag_to_target',
                name: '拖动到目标',
                icon: '🖱️',
                description: '拖动物品到指定位置',
                defaults: {
                    trigger: { type: 'drag', count: 1, time: 0 },
                    executors: [{ type: 'node', disappearT: 0.3, appearT: 0.3, soundVolume: 0 }],
                    results: [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talk: 0, nexttalk: 0, talkResult: [], works: []
                }
            },
            {
                id: 'slide_switch',
                name: '滑动切换',
                icon: '👆',
                description: '滑动触发切换',
                defaults: {
                    trigger: { type: 'slide', count: 1, time: 0 },
                    executors: [{ type: 'node', disappearT: 0, appearT: 0, soundVolume: 0 }],
                    results: [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talk: 0, nexttalk: 0, talkResult: [], works: []
                }
            }
        ],
        advanced: [
            {
                id: 'click_condition',
                name: '条件点击',
                icon: '🔗',
                description: '需要先完成其他差异点',
                defaults: {
                    trigger: { type: 'click', count: 1, time: 0.5 },
                    executors: [{ type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 }],
                    results: [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talk: 0, nexttalk: 0,
                    talkResult: [[1, -1]], works: [2]
                }
            },
            {
                id: 'mutual_exclusive',
                name: '互斥选择',
                icon: '🔀',
                description: '二选一或三选一',
                defaults: {
                    trigger: { type: 'click', count: 1, time: 0.5 },
                    executors: [{ type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 }],
                    results: [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talk: 0, nexttalk: 0,
                    talkResult: [], works: [1, 4]
                }
            },
            {
                id: 'dialogue_event',
                name: '对话事件',
                icon: '💬',
                description: '带对话的差异点事件',
                defaults: {
                    trigger: { type: 'click', count: 1, time: 0.5 },
                    executors: [{ type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 }],
                    results: [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talk: 1, nexttalk: 2,
                    talkResult: [[0, 0]], works: [1, 4]
                }
            }
        ],
        custom: []
    };

    var module = {
        id: 'workflow-template',
        name: '差异点模板',

        activate: function() {
            console.log('Workflow Template activated');
            loadCustomTemplates();
        },

        deactivate: function() {
            console.log('Workflow Template deactivated');
        },

        showTemplateModal: function() {
            var modal = document.getElementById('templateModal');
            if (modal) {
                modal.classList.remove('hidden');
                renderTemplateGrid('basic');
                bindModalEvents();
            }
        },

        getTemplate: function(templateId) {
            var all = templates.basic.concat(templates.advanced, templates.custom);
            for (var i = 0; i < all.length; i++) {
                if (all[i].id === templateId) return all[i];
            }
            return null;
        },

        saveCustomTemplate: function(template) {
            templates.custom.push(template);
            saveCustomTemplates();
        }
    };

    /**
     * 渲染模板网格
     */
    function renderTemplateGrid(category) {
        var grid = document.getElementById('templateGrid');
        if (!grid) return;

        var list = templates[category] || [];
        var html = '';

        for (var i = 0; i < list.length; i++) {
            var t = list[i];
            html += '<div class="template-card" data-template-id="' + t.id + '">';
            html += '<div class="template-card-icon">' + t.icon + '</div>';
            html += '<div class="template-card-name">' + t.name + '</div>';
            html += '<div class="template-card-desc">' + t.description + '</div>';
            html += '</div>';
        }

        if (list.length === 0) {
            html = '<p class="placeholder-text">暂无模板</p>';
        }

        grid.innerHTML = html;

        // 绑定点击
        var cards = grid.querySelectorAll('.template-card');
        cards.forEach(function(card) {
            card.addEventListener('click', function() {
                var tid = card.dataset.templateId;
                var tpl = module.getTemplate(tid);
                if (tpl) showTemplateConfig(tpl);
            });
        });
    }

    /**
     * 绑定弹窗事件
     */
    function bindModalEvents() {
        var categoryBtns = document.querySelectorAll('.category-btn');
        categoryBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                categoryBtns.forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                renderTemplateGrid(btn.dataset.category);
            });
        });

        var closeBtn = document.querySelector('#templateModal .modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                document.getElementById('templateModal').classList.add('hidden');
            });
        }

        var overlay = document.querySelector('#templateModal .modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', function() {
                document.getElementById('templateModal').classList.add('hidden');
            });
        }
    }

    /**
     * 显示模板配置
     */
    function showTemplateConfig(template) {
        document.getElementById('templateModal').classList.add('hidden');

        var configModal = document.getElementById('templateConfigModal');
        if (!configModal) return;

        configModal.classList.remove('hidden');

        var title = document.getElementById('templateConfigTitle');
        if (title) title.textContent = '配置: ' + template.name;

        var form = document.getElementById('templateConfigForm');
        if (form) renderConfigForm(form, template);

        var btnApply = document.getElementById('btnTemplateApply');
        if (btnApply) {
            btnApply.onclick = function() {
                applyTemplate(template);
                configModal.classList.add('hidden');
            };
        }

        var btnCancel = document.getElementById('btnTemplateCancel');
        if (btnCancel) {
            btnCancel.onclick = function() {
                configModal.classList.add('hidden');
            };
        }

        var closeBtn = configModal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.onclick = function() {
                configModal.classList.add('hidden');
            };
        }
    }

    /**
     * 渲染配置表单
     */
    function renderConfigForm(form, template) {
        var html = '';

        // 事件ID
        html += '<div class="form-group">';
        html += '<label class="form-label">事件ID</label>';
        html += '<input class="form-input" type="number" id="tplEventId" value="0" min="0">';
        html += '<span class="form-hint">对应 EventInfo.event，留空自动生成</span>';
        html += '</div>';

        // 事件描述
        html += '<div class="form-group">';
        html += '<label class="form-label">事件描述</label>';
        html += '<input class="form-input" type="text" id="tplText" placeholder="差异点描述">';
        html += '</div>';

        // 触发类型
        html += '<div class="form-group">';
        html += '<label class="form-label">触发类型</label>';
        html += '<select class="form-select" id="tplTriggerType">';
        html += '<option value="click"' + (template.defaults.trigger.type === 'click' ? ' selected' : '') + '>点击</option>';
        html += '<option value="drag"' + (template.defaults.trigger.type === 'drag' ? ' selected' : '') + '>拖动</option>';
        html += '<option value="slide"' + (template.defaults.trigger.type === 'slide' ? ' selected' : '') + '>滑动</option>';
        html += '</select>';
        html += '</div>';

        // 触发次数（click 时显示）
        if (template.defaults.trigger.type === 'click') {
            html += '<div class="form-group" id="tplClickCountGroup">';
            html += '<label class="form-label">触发次数</label>';
            html += '<input class="form-input" type="number" id="tplClickCount" value="' + (template.defaults.trigger.count || 1) + '" min="1">';
            html += '</div>';
        }

        // 切换动画时间
        html += '<div class="form-group">';
        html += '<label class="form-label">动画时间</label>';
        html += '<input class="form-input" type="number" id="tplAnimTime" value="0.2" min="0" step="0.1">';
        html += '<span class="form-hint">消失/出现动画时间(秒)</span>';
        html += '</div>';

        // 事件值
        html += '<div class="form-group">';
        html += '<label class="form-label">事件值</label>';
        html += '<input class="form-input" type="number" id="tplEventVal" value="0" min="0">';
        html += '<span class="form-hint">用于 results[0].val</span>';
        html += '</div>';

        // 对话相关（高级模板）
        var hasTalk = template.defaults.talkMsgs || template.defaults.talk;
        if (hasTalk || template.id === 'dialogue_event') {
            html += '<div class="form-group">';
            html += '<label class="form-label">对话消息IDs</label>';
            html += '<input class="form-input" type="text" id="tplTalkMsgs" placeholder="逗号分隔">';
            html += '<span class="form-hint">TalkMsg 表中的 ID</span>';
            html += '</div>';

            html += '<div class="form-group">';
            html += '<label class="form-label">对话轮次</label>';
            html += '<div style="display:flex;gap:8px;">';
            html += '<input class="form-input" type="number" id="tplTalk" value="' + (template.defaults.talk || 0) + '" min="0" placeholder="当前">';
            html += '<span style="line-height:36px;">→</span>';
            html += '<input class="form-input" type="number" id="tplNextTalk" value="' + (template.defaults.nexttalk || 0) + '" min="-1" placeholder="下一轮次">';
            html += '</div>';
            html += '</div>';
        }

        form.innerHTML = html;
    }

    /**
     * 应用模板，创建 diffPoint
     */
    function applyTemplate(template) {
        var eventId = parseInt(document.getElementById('tplEventId').value) || 0;
        var text = document.getElementById('tplText').value || '';
        var triggerType = document.getElementById('tplTriggerType').value;
        var clickCountEl = document.getElementById('tplClickCount');
        var clickCount = clickCountEl ? parseInt(clickCountEl.value) || 1 : 1;
        var animTime = parseFloat(document.getElementById('tplAnimTime').value) || 0.2;
        var eventVal = parseInt(document.getElementById('tplEventVal').value) || 0;

        // 构建 diffPoint
        var dp = {
            id: 'dp_' + Date.now(),
            eventId: eventId,
            name: template.name,
            text: text,
            kong: '',
            ui: '',
            number: 0,
            pos: [],
            oldNodes: [],
            newNodes: [],
            trigger: {
                type: triggerType,
                count: clickCount,
                time: triggerType === 'click' ? 0.5 : 0
            },
            executors: template.defaults.executors.map(function(ex) {
                return {
                    type: ex.type,
                    disappearT: animTime,
                    appearT: animTime,
                    soundVolume: ex.soundVolume || 0
                };
            }),
            results: [{ result: 'Collect', val: eventVal }],
            talkMsgs: [],
            talkPos: [],
            curTalkPos: 0,
            curTalkTime: 0,
            curTalkMusic: '',
            talk: template.defaults.talk || 0,
            nexttalk: template.defaults.nexttalk || 0,
            talkResult: template.defaults.talkResult ? template.defaults.talkResult.slice() : [],
            works: template.defaults.works ? template.defaults.works.slice() : []
        };

        // 对话消息IDs
        var talkMsgsEl = document.getElementById('tplTalkMsgs');
        if (talkMsgsEl && talkMsgsEl.value) {
            dp.talkMsgs = talkMsgsEl.value.split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); });
        }

        var talkEl = document.getElementById('tplTalk');
        if (talkEl) dp.talk = parseInt(talkEl.value) || 0;

        var nextTalkEl = document.getElementById('tplNextTalk');
        if (nextTalkEl) dp.nexttalk = parseInt(nextTalkEl.value) || 0;

        // 添加到编辑器
        if (typeof WorkflowEditorModule !== 'undefined') {
            WorkflowEditorModule.addDiffPoint(dp);
        }

        // 同步到全局 state
        if (typeof state !== 'undefined') {
            state.diffPoints = WorkflowEditorModule.getDiffPoints();
        }

        // 刷新差异点列表和流程检查栏
        if (typeof renderDiffPointList === 'function') renderDiffPointList();
        if (typeof renderWorkflowSteps === 'function') renderWorkflowSteps();

        // 提示
        if (typeof animalUtils !== 'undefined' && animalUtils.showTypewriterToast) {
            animalUtils.showTypewriterToast('已创建差异点: ' + dp.name);
        }
    }

    /**
     * 加载自定义模板
     */
    function loadCustomTemplates() {
        var saved = localStorage.getItem('level-editor-custom-templates');
        if (saved) {
            try {
                templates.custom = JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load custom templates:', e);
            }
        }
    }

    function saveCustomTemplates() {
        localStorage.setItem('level-editor-custom-templates', JSON.stringify(templates.custom));
    }

    return module;
})();

if (typeof window !== 'undefined') {
    window.WorkflowTemplateModule = WorkflowTemplateModule;
}
