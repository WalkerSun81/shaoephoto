/**
 * Level Config Module - 通关配置模块
 * 对齐 ZCLevelCfg，35+ 字段，分 6 组显示
 */
var LevelConfigModule = (function() {
    var panelContainer = null;
    var levelConfig = createDefaultConfig();
    var talksConfig = null;

    /**
     * 创建默认配置（ZCLevelCfg 全字段）
     */
    function createDefaultConfig() {
        return {
            id: 0,
            name: '',
            img: '',
            levelType: 0,
            next: 0,
            difficulty: 0,
            title: '',
            type: 0,
            tipsText: '',
            placeHolders: [],
            tipsText1: '',
            placeHolders1: [],
            time: 0,
            passEvent: [],
            passEventNum: [],
            passValue: 0,
            passValueStart: 0,
            passImg: '',
            passText: '',
            failValue: 0,
            failValueStart: 0,
            endValue: 0,
            endValueStart: 0,
            bottomTpye: 0,
            bottomEvent: [],
            adItems: [],
            talkPos: [],
            talkMsgPos: [],
            talkSlot: [],
            levelPos: [],
            tipType: 0,
            ansType: 0,
            ansImg: '',
            ansText: '',
            workEndTime: 0,
            workEndTime2: 0,
            endAniTime: 0,
            endAniTime2: 0,
            uiTips: ''
        };
    }

    /**
     * 模块接口
     */
    var module = {
        id: 'level-config',
        name: '通关配置',

        activate: function() {
            console.log('Level Config activated');
            panelContainer = document.getElementById('levelConfigContent');
            renderConfig();
        },

        deactivate: function() {
            console.log('Level Config deactivated');
        },

        getConfig: function() {
            return levelConfig;
        },

        setConfig: function(config) {
            levelConfig = config || createDefaultConfig();
            if (panelContainer) renderConfig();
        },

        getTalksConfig: function() {
            return talksConfig;
        },

        setTalksConfig: function(talks) {
            talksConfig = talks;
        }
    };

    /**
     * 渲染配置面板（6 个折叠组）
     */
    function renderConfig() {
        if (!panelContainer) return;

        var html = '';

        // 组1：基础信息
        html += renderGroup('基础信息', 'basic', true, [
            { label: '关卡ID', key: 'id', type: 'number', value: levelConfig.id },
            { label: '关卡名称', key: 'name', type: 'text', value: levelConfig.name },
            { label: '关卡标题', key: 'title', type: 'text', value: levelConfig.title },
            { label: '封面图', key: 'img', type: 'text', value: levelConfig.img, hint: '资源名' },
            { label: '玩法类型', key: 'type', type: 'select', value: levelConfig.type, options: [
                { value: 0, label: '标准找茬' }, { value: 2, label: '拖动操作' }, { value: 3, label: '收集类' }
            ]},
            { label: '关卡类型', key: 'levelType', type: 'select', value: levelConfig.levelType, options: [
                { value: 0, label: '默认' }, { value: 1, label: '标准' }, { value: 2, label: '拼图' },
                { value: 3, label: '怀旧' }, { value: 4, label: '找到并上色' }, { value: 5, label: '救援' }
            ]},
            { label: '难度', key: 'difficulty', type: 'select', value: levelConfig.difficulty, options: [
                { value: 0, label: '简单' }, { value: 1, label: '普通' }, { value: 2, label: '困难' }
            ]},
            { label: '下一关ID', key: 'next', type: 'number', value: levelConfig.next }
        ]);

        // 组2：通关条件
        html += renderGroup('通关条件', 'pass', false, [
            { label: '时间限制', key: 'time', type: 'number', value: levelConfig.time, hint: '秒，0=无限制' },
            { label: '通关事件', key: 'passEvent', type: 'text', value: JSON.stringify(levelConfig.passEvent), hint: '事件ID列表，JSON数组' },
            { label: '事件数量条件', key: 'passEventNum', type: 'text', value: JSON.stringify(levelConfig.passEventNum), hint: 'JSON数组' },
            { label: '通关值', key: 'passValue', type: 'number', value: levelConfig.passValue },
            { label: '通关起始值', key: 'passValueStart', type: 'number', value: levelConfig.passValueStart },
            { label: '失败值', key: 'failValue', type: 'number', value: levelConfig.failValue },
            { label: '失败起始值', key: 'failValueStart', type: 'number', value: levelConfig.failValueStart },
            { label: '结束值', key: 'endValue', type: 'number', value: levelConfig.endValue },
            { label: '结束起始值', key: 'endValueStart', type: 'number', value: levelConfig.endValueStart },
            { label: '通关图片', key: 'passImg', type: 'text', value: levelConfig.passImg },
            { label: '通关文本', key: 'passText', type: 'text', value: levelConfig.passText }
        ]);

        // 组3：提示与答案
        html += renderGroup('提示与答案', 'tips', false, [
            { label: '提示类型', key: 'tipType', type: 'select', value: levelConfig.tipType, options: [
                { value: 0, label: '无提示' }, { value: 1, label: '文字提示' }, { value: 5, label: '高亮提示' }
            ]},
            { label: '提示文本', key: 'tipsText', type: 'text', value: levelConfig.tipsText },
            { label: '提示占位符', key: 'placeHolders', type: 'text', value: JSON.stringify(levelConfig.placeHolders), hint: 'JSON数组' },
            { label: '提示文本2', key: 'tipsText1', type: 'text', value: levelConfig.tipsText1 },
            { label: '占位符2', key: 'placeHolders1', type: 'text', value: JSON.stringify(levelConfig.placeHolders1), hint: 'JSON数组' },
            { label: '答案类型', key: 'ansType', type: 'select', value: levelConfig.ansType, options: [
                { value: 0, label: '无答案' }, { value: 1, label: '图片答案' }, { value: 2, label: '文字答案' }
            ]},
            { label: '答案图片', key: 'ansImg', type: 'text', value: levelConfig.ansImg },
            { label: '答案文本', key: 'ansText', type: 'text', value: levelConfig.ansText }
        ]);

        // 组4：底部UI
        html += renderGroup('底部UI', 'bottom', false, [
            { label: '底部类型', key: 'bottomTpye', type: 'number', value: levelConfig.bottomTpye, hint: '对应 BottomInfo 表' },
            { label: '底部事件', key: 'bottomEvent', type: 'text', value: JSON.stringify(levelConfig.bottomEvent), hint: 'JSON数组' },
            { label: '广告位', key: 'adItems', type: 'text', value: JSON.stringify(levelConfig.adItems), hint: 'JSON数组' }
        ]);

        // 组5：对话配置
        html += renderGroup('对话配置', 'talk', false, [
            { label: '对话位置', key: 'talkPos', type: 'text', value: JSON.stringify(levelConfig.talkPos), hint: 'JSON二维数组' },
            { label: '消息位置', key: 'talkMsgPos', type: 'text', value: JSON.stringify(levelConfig.talkMsgPos), hint: 'JSON二维数组' },
            { label: '对话槽位', key: 'talkSlot', type: 'text', value: JSON.stringify(levelConfig.talkSlot), hint: 'JSON数组' },
            { label: '关卡位置', key: 'levelPos', type: 'text', value: JSON.stringify(levelConfig.levelPos), hint: 'JSON数组' }
        ]);

        // 组6：高级
        html += renderGroup('高级', 'advanced', false, [
            { label: '工作结束时间', key: 'workEndTime', type: 'number', value: levelConfig.workEndTime },
            { label: '工作结束时间2', key: 'workEndTime2', type: 'number', value: levelConfig.workEndTime2 },
            { label: '结束动画时间', key: 'endAniTime', type: 'number', value: levelConfig.endAniTime },
            { label: '结束动画时间2', key: 'endAniTime2', type: 'number', value: levelConfig.endAniTime2 },
            { label: 'UI提示', key: 'uiTips', type: 'text', value: levelConfig.uiTips }
        ]);

        panelContainer.innerHTML = html;
        bindConfigEvents();
    }

    /**
     * 渲染一个折叠组
     */
    function renderGroup(title, groupId, expanded, items) {
        var html = '<div class="config-group' + (expanded ? ' expanded' : '') + '" data-group="' + groupId + '">';
        html += '<div class="config-group-header" data-group="' + groupId + '">';
        html += '<span class="config-group-arrow">' + (expanded ? '▼' : '▶') + '</span>';
        html += '<span class="config-group-title">' + title + '</span>';
        html += '</div>';
        html += '<div class="config-group-body" style="' + (expanded ? '' : 'display:none') + '">';

        for (var i = 0; i < items.length; i++) {
            html += renderItem(items[i]);
        }

        html += '</div></div>';
        return html;
    }

    /**
     * 渲染单个配置项
     */
    function renderItem(item) {
        var html = '<div class="config-row">';
        html += '<label class="config-label">' + item.label + '</label>';

        if (item.type === 'select') {
            html += '<select class="config-input" data-key="' + item.key + '">';
            for (var i = 0; i < item.options.length; i++) {
                var opt = item.options[i];
                html += '<option value="' + opt.value + '"' + (opt.value === item.value ? ' selected' : '') + '>' + opt.label + '</option>';
            }
            html += '</select>';
        } else {
            html += '<input class="config-input" type="' + item.type + '" data-key="' + item.key + '" value="' + escapeAttr(item.value) + '">';
        }

        if (item.hint) {
            html += '<span class="config-hint">' + item.hint + '</span>';
        }

        html += '</div>';
        return html;
    }

    /**
     * 绑定事件
     */
    function bindConfigEvents() {
        // 折叠切换
        var headers = panelContainer.querySelectorAll('.config-group-header');
        headers.forEach(function(header) {
            header.addEventListener('click', function() {
                var group = header.parentElement;
                var body = group.querySelector('.config-group-body');
                var arrow = header.querySelector('.config-group-arrow');
                var expanded = group.classList.toggle('expanded');
                body.style.display = expanded ? '' : 'none';
                arrow.textContent = expanded ? '▼' : '▶';
            });
        });

        // 输入变化
        var inputs = panelContainer.querySelectorAll('.config-input');
        inputs.forEach(function(input) {
            input.addEventListener('change', function() {
                var key = input.dataset.key;
                var value = input.value;

                if (input.type === 'number') {
                    value = parseFloat(value) || 0;
                }

                // JSON 数组字段
                var jsonFields = ['passEvent', 'passEventNum', 'placeHolders', 'placeHolders1',
                    'bottomEvent', 'adItems', 'talkPos', 'talkMsgPos', 'talkSlot', 'levelPos'];
                if (jsonFields.indexOf(key) >= 0) {
                    try {
                        value = JSON.parse(value);
                    } catch (e) {
                        // 保持原始字符串
                    }
                }

                levelConfig[key] = value;
            });
        });
    }

    /**
     * 转义属性值
     */
    function escapeAttr(val) {
        if (val === null || val === undefined) return '';
        var str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return module;
})();

if (typeof window !== 'undefined') {
    window.LevelConfigModule = LevelConfigModule;
}
