/**
 * Config Table Module - 配置表模块
 * 对齐游戏 7 张表：Level, EventInfo, TalkInfo, TalkMsg, Talks, Action, Views
 */
var ConfigTableModule = (function() {
    var panelContainer = null;
    var currentTable = 'Level';
    var tables = {
        Level: {},
        EventInfo: {},
        TalkInfo: {},
        TalkMsg: {},
        Talks: {},
        Action: {},
        Views: {}
    };

    var module = {
        id: 'config-table',
        name: '配置表',

        activate: function() {
            console.log('Config Table activated');
            panelContainer = document.getElementById('configTablePanel');
            refreshFromState();
            renderTable();
        },

        deactivate: function() {
            console.log('Config Table deactivated');
        },

        getTableData: function(tableName) {
            return tables[tableName] || {};
        },

        setTableData: function(tableName, data) {
            tables[tableName] = data || {};
            if (currentTable === tableName) {
                renderTable();
            }
        },

        /**
         * 从编辑器 state 刷新所有表数据
         */
        refreshFromState: function() {
            if (typeof Serializer !== 'undefined' && typeof state !== 'undefined') {
                var data = {
                    level: state.level,
                    diffPoints: state.diffPoints || [],
                    talkMsgs: state.talkMsgs || [],
                    talks: state.talks
                };
                var gameData = Serializer.toGameFormat(data);
                tables.Level = gameData.Level || {};
                tables.EventInfo = gameData.EventInfo || {};
                tables.TalkInfo = gameData.TalkInfo || {};
                tables.TalkMsg = gameData.TalkMsg || {};
                tables.Talks = gameData.Talks || {};
                tables.Action = gameData.Action || {};
                tables.Views = gameData.Views || {};
            }
        }
    };

    function renderTable() {
        if (!panelContainer) return;

        var html = '<div class="table-tabs">';
        var tableNames = Object.keys(tables);
        for (var i = 0; i < tableNames.length; i++) {
            var name = tableNames[i];
            html += '<button class="table-tab' + (name === currentTable ? ' active' : '') + '" data-table="' + name + '">' + name + '</button>';
        }
        html += '</div>';

        html += '<div class="table-content">';
        html += renderTableContent(currentTable);
        html += '</div>';

        panelContainer.innerHTML = html;

        // 绑定 Tab 切换
        var tabs = panelContainer.querySelectorAll('.table-tab');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function() {
                currentTable = tab.dataset.table;
                renderTable();
            });
        });
    }

    function renderTableContent(tableName) {
        var data = tables[tableName];
        var keys = Object.keys(data);

        if (keys.length === 0) {
            return '<p class="placeholder-text">暂无数据</p>';
        }

        var html = '<table class="config-table">';

        // 收集所有列
        var columns = new Set();
        for (var i = 0; i < keys.length; i++) {
            var item = data[keys[i]];
            var cols = Object.keys(item);
            for (var j = 0; j < cols.length; j++) {
                columns.add(cols[j]);
            }
        }

        var colArray = Array.from(columns);

        // 表头
        html += '<thead><tr>';
        for (var c = 0; c < colArray.length; c++) {
            html += '<th>' + colArray[c] + '</th>';
        }
        html += '</tr></thead>';

        // 表体
        html += '<tbody>';
        for (var k = 0; k < keys.length; k++) {
            var row = data[keys[k]];
            html += '<tr>';
            for (var m = 0; m < colArray.length; m++) {
                var val = row[colArray[m]];
                if (val === undefined || val === null) {
                    html += '<td></td>';
                } else if (typeof val === 'object') {
                    html += '<td>' + JSON.stringify(val) + '</td>';
                } else {
                    html += '<td>' + val + '</td>';
                }
            }
            html += '</tr>';
        }
        html += '</tbody></table>';

        return html;
    }

    return module;
})();

if (typeof window !== 'undefined') {
    window.ConfigTableModule = ConfigTableModule;
}
