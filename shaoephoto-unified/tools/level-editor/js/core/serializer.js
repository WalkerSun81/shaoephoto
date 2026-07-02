/**
 * Serializer - 序列化/反序列化模块
 * 对齐游戏 5 张表：Level, EventInfo, TalkInfo, TalkMsg, Talks
 */
var Serializer = (function() {

    /**
     * 序列化编辑器数据
     */
    function serialize(data) {
        var wrapper = {
            version: '2.0.0',
            timestamp: Date.now(),
            data: data
        };
        return JSON.stringify(wrapper, null, 2);
    }

    /**
     * 反序列化编辑器数据（兼容 v1 和 v2 格式）
     */
    function deserialize(jsonStr) {
        try {
            var obj = JSON.parse(jsonStr);
            // v2 格式: { version: '2.0.0', data: {...} }
            if (obj.version && obj.version >= '2.0.0' && obj.data) {
                return obj.data;
            }
            // v1 格式: { version: '1.0.0', level: {...} }
            if (obj.version && obj.level) {
                return migrateV1toV2(obj);
            }
            // 直接是数据对象
            return obj;
        } catch (e) {
            console.error('Failed to deserialize:', e);
            return null;
        }
    }

    /**
     * v1 数据迁移到 v2 格式
     */
    function migrateV1toV2(v1Data) {
        return {
            level: v1Data.level || {},
            canvas: v1Data.canvas || { width: 720, height: 1280, bgColor: '#ffffff' },
            assets: v1Data.assets || [],
            nodes: v1Data.nodes || [],
            diffPoints: (v1Data.workflows || []).map(function(wf, idx) {
                return {
                    id: wf.id || ('dp_' + Date.now() + '_' + idx),
                    eventId: idx + 1,
                    name: wf.name || '',
                    text: wf.triggerDesc || '',
                    kong: '', name: wf.name || '', ui: '', number: 0, pos: [],
                    oldNodes: [], newNodes: [],
                    trigger: {
                        type: wf.triggerType || 'click',
                        count: (wf.config && wf.config.trigger) ? wf.config.trigger.count || 1 : 1,
                        time: (wf.config && wf.config.trigger) ? wf.config.trigger.time || 0.5 : 0.5
                    },
                    executors: (wf.config && wf.config.executors) ? wf.config.executors.map(function(ex) {
                        return {
                            type: ex.type || 'node',
                            disappearT: ex.disappearT || 0.2,
                            appearT: ex.appearT || 0.2,
                            soundVolume: ex.soundVolume || 0
                        };
                    }) : [{ type: 'node', disappearT: 0.2, appearT: 0.2 }],
                    results: (wf.config && wf.config.results) ? wf.config.results : [{ result: 'Collect', val: 0 }],
                    talkMsgs: [], talkPos: [], curTalkPos: 0, curTalkTime: 0,
                    curTalkMusic: '', talk: 0, nexttalk: 0, talkResult: [], works: []
                };
            }),
            talkMsgs: [],
            talks: null
        };
    }

    /**
     * 编辑器 state → 游戏格式 5 张表
     */
    function toGameFormat(stateData) {
        var result = {
            Level: {},
            EventInfo: {},
            TalkInfo: {},
            TalkMsg: {},
            Talks: {},
            Action: {},
            Views: {}
        };

        // === Level 表 ===
        if (stateData.level && stateData.level.id) {
            result.Level[stateData.level.id] = buildLevelRecord(stateData.level);
        }

        // === EventInfo / TalkInfo 表 ===
        var diffPoints = stateData.diffPoints || [];
        for (var i = 0; i < diffPoints.length; i++) {
            var dp = diffPoints[i];
            var eventId = dp.eventId || (stateData.level.id * 100 + i + 1);

            // EventInfo
            result.EventInfo[eventId] = buildEventInfoRecord(dp, stateData.level.id, eventId);

            // TalkInfo（仅有对话时生成）
            if (dp.talkMsgs && dp.talkMsgs.length > 0) {
                result.TalkInfo[eventId] = buildTalkInfoRecord(dp, stateData.level.id, eventId);
            }
        }

        // === TalkMsg 表 ===
        var talkMsgs = stateData.talkMsgs || [];
        for (var j = 0; j < talkMsgs.length; j++) {
            var msg = talkMsgs[j];
            if (msg.id !== undefined) {
                result.TalkMsg[msg.id] = buildTalkMsgRecord(msg);
            }
        }

        // === Talks 表 ===
        if (stateData.talks && stateData.level && stateData.level.id) {
            result.Talks[stateData.level.id] = buildTalksRecord(stateData.talks, stateData.level.id);
        }

        // === BottomInfo 表 ===
        var bottomInfos = stateData.bottomInfos || [];
        for (var b = 0; b < bottomInfos.length; b++) {
            var bi = bottomInfos[b];
            if (bi.id !== undefined) {
                result.BottomInfo[bi.id] = buildBottomInfoRecord(bi);
            }
        }

        return result;
    }

    /**
     * 构建 Level 记录
     */
    function buildLevelRecord(level) {
        return {
            id: level.id || 0,
            name: level.name || '',
            img: level.img || '',
            levelType: level.levelType || 0,
            next: level.next || 0,
            difficulty: level.difficulty || 0,
            title: level.title || '',
            type: level.type || 0,
            tipsText: level.tipsText || '',
            placeHolders: level.placeHolders || [],
            tipsText1: level.tipsText1 || '',
            placeHolders1: level.placeHolders1 || [],
            time: level.time || 0,
            passEvent: level.passEvent || [],
            passEventNum: level.passEventNum || [],
            passValue: level.passValue || 0,
            passValueStart: level.passValueStart || 0,
            passImg: level.passImg || '',
            passText: level.passText || '',
            failValue: level.failValue || 0,
            failValueStart: level.failValueStart || 0,
            endValue: level.endValue || 0,
            endValueStart: level.endValueStart || 0,
            bottomTpye: level.bottomTpye || 0,
            bottomEvent: level.bottomEvent || [],
            adItems: level.adItems || [],
            talkPos: level.talkPos || [],
            talkMsgPos: level.talkMsgPos || [],
            talkSlot: level.talkSlot || [],
            levelPos: level.levelPos || [],
            tipType: level.tipType || 0,
            ansType: level.ansType || 0,
            ansImg: level.ansImg || '',
            ansText: level.ansText || '',
            workEndTime: level.workEndTime || 0,
            workEndTime2: level.workEndTime2 || 0,
            endAniTime: level.endAniTime || 0,
            endAniTime2: level.endAniTime2 || 0,
            uiTips: level.uiTips || ''
        };
    }

    /**
     * 构建 EventInfo 记录
     */
    function buildEventInfoRecord(dp, levelId, eventId) {
        return {
            id: eventId,
            level: levelId,
            event: eventId,
            text: dp.text || '',
            kong: dp.kong || '',
            name: dp.name || '',
            ui: dp.ui || '',
            number: dp.number || 0,
            pos: dp.pos || []
        };
    }

    /**
     * 构建 TalkInfo 记录
     */
    function buildTalkInfoRecord(dp, levelId, eventId) {
        // 构建 result 数组：[[正确resultType, 正确val], [错误resultType, 错误val]]
        var result = [];
        if (dp.correctResult) {
            var correctResultType = 1; // 正确
            var correctVal = dp.correctResult === 'Collect' ? 1 : 1;
            result.push([correctResultType, correctVal]);
        }
        if (dp.wrongResult) {
            var wrongResultType = 0; // 错误
            var wrongVal = dp.wrongResult === 'Fail' ? -1 : 1;
            result.push([wrongResultType, wrongVal]);
        }
        if (result.length === 0 && dp.talkResult) {
            result = dp.talkResult;
        }

        // 构建 works 数组
        var works = [];
        if (dp.correctWorks) works.push(dp.correctWorks);
        if (dp.wrongWorks && dp.wrongWorks !== dp.correctWorks) works.push(dp.wrongWorks);
        if (works.length === 0 && dp.works) {
            works = dp.works;
        }

        return {
            id: eventId,
            level: levelId,
            event: eventId,
            text: dp.text || '',
            talkMsgs: dp.talkMsgs || [],
            talkPos: dp.talkPos || [],
            curTalkPos: dp.curTalkPos || 0,
            curTalkTime: dp.curTalkTime || 0,
            curTalkMusic: dp.curTalkMusic || '',
            talk: dp.talk || 0,
            nexttalk: dp.nexttalk || 0,
            result: result,
            works: works
        };
    }

    /**
     * 构建 TalkMsg 记录
     */
    function buildTalkMsgRecord(msg) {
        return {
            id: msg.id,
            text: msg.text || '',
            time: msg.time || 0,
            name: msg.name || '',
            img: msg.img || '',
            pos: msg.pos || [],
            type: msg.type || 0,
            sound: msg.sound || '',
            soundVolume: msg.soundVolume || 1
        };
    }

    /**
     * 构建 Talks 记录
     */
    function buildTalksRecord(talks, levelId) {
        return {
            id: levelId,
            level: levelId,
            startTalk: talks.startTalk || 0,
            endTalk: talks.endTalk || 0,
            talkPos: talks.talkPos || [],
            talkMsgPos: talks.talkMsgPos || [],
            talkSlot: talks.talkSlot || []
        };
    }

    /**
     * 构建 BottomInfo 记录
     */
    function buildBottomInfoRecord(bi) {
        return {
            id: bi.id,
            level: bi.level || 0,
            event: bi.event || 0,
            text: bi.text || '',
            kong: bi.kong || '',
            name: bi.name || '',
            ui: bi.ui || '',
            number: bi.number || 0,
            collectNum: bi.collectNum || 0,
            failResult: bi.failResult || []
        };
    }

    /**
     * 游戏格式 → 编辑器 state 子集
     * @param {Object} gameData - 完整 GameJsonCfg 对象
     * @param {number} levelId - 目标关卡ID
     */
    function fromGameFormat(gameData, levelId) {
        var result = {
            level: null,
            diffPoints: [],
            talkMsgs: [],
            talks: null
        };

        // Level
        result.level = (gameData.Level || {})[levelId] || {};

        // 收集该关卡的 EventInfo 和 TalkInfo
        var eventMap = {};  // eventId → eventInfo
        var talkMap = {};   // eventId → talkInfo

        var eventKeys = Object.keys(gameData.EventInfo || {});
        for (var i = 0; i < eventKeys.length; i++) {
            var ev = gameData.EventInfo[eventKeys[i]];
            if (ev.level === levelId) {
                eventMap[ev.event || ev.id] = ev;
            }
        }

        var talkKeys = Object.keys(gameData.TalkInfo || {});
        for (var j = 0; j < talkKeys.length; j++) {
            var ti = gameData.TalkInfo[talkKeys[j]];
            if (ti.level === levelId) {
                talkMap[ti.event || ti.id] = ti;
            }
        }

        // 合并为 diffPoints
        var allEventIds = Object.keys(eventMap);
        var usedTalkMsgIds = {};

        for (var k = 0; k < allEventIds.length; k++) {
            var eid = allEventIds[k];
            var evInfo = eventMap[eid];
            var talkInfo = talkMap[eid] || null;

            var dp = {
                id: 'dp_' + Date.now() + '_' + k,
                eventId: parseInt(eid) || 0,
                name: evInfo.name || '',
                text: evInfo.text || '',
                kong: evInfo.kong || '',
                ui: evInfo.ui || '',
                number: evInfo.number || 0,
                pos: evInfo.pos || [],
                oldNodes: [],
                newNodes: [],
                trigger: { type: 'click', count: 1, time: 0.5 },
                executors: [{ type: 'node', disappearT: 0.2, appearT: 0.2, soundVolume: 0 }],
                results: [{ result: 'Collect', val: parseInt(eid) || 0 }],
                talkMsgs: [], talkPos: [], curTalkPos: 0, curTalkTime: 0,
                curTalkMusic: '', talk: 0, nexttalk: 0, talkResult: [], works: []
            };

            if (talkInfo) {
                dp.talkMsgs = talkInfo.talkMsgs || [];
                dp.talkPos = talkInfo.talkPos || [];
                dp.curTalkPos = talkInfo.curTalkPos || 0;
                dp.curTalkTime = talkInfo.curTalkTime || 0;
                dp.curTalkMusic = talkInfo.curTalkMusic || '';
                dp.talk = talkInfo.talk || 0;
                dp.nexttalk = talkInfo.nexttalk || 0;
                dp.talkResult = talkInfo.result || [];
                dp.works = talkInfo.works || [];

                // 收集引用的 TalkMsg ID
                for (var m = 0; m < dp.talkMsgs.length; m++) {
                    usedTalkMsgIds[dp.talkMsgs[m]] = true;
                }
            }

            result.diffPoints.push(dp);
        }

        // TalkMsg
        var msgIds = Object.keys(usedTalkMsgIds);
        for (var n = 0; n < msgIds.length; n++) {
            var msgId = msgIds[n];
            var msgData = (gameData.TalkMsg || {})[msgId];
            if (msgData) {
                result.talkMsgs.push({
                    id: parseInt(msgId),
                    text: msgData.text || '',
                    time: msgData.time || 0,
                    name: msgData.name || '',
                    img: msgData.img || '',
                    pos: msgData.pos || [],
                    type: msgData.type || 0,
                    sound: msgData.sound || '',
                    soundVolume: msgData.soundVolume || 1
                });
            }
        }

        // Talks
        result.talks = (gameData.Talks || {})[levelId] || null;

        // BottomInfo
        result.bottomInfos = [];
        var bottomKeys = Object.keys(gameData.BottomInfo || {});
        for (var p = 0; p < bottomKeys.length; p++) {
            var bi = gameData.BottomInfo[bottomKeys[p]];
            if (bi.level === levelId) {
                result.bottomInfos.push({
                    id: bi.id,
                    level: bi.level,
                    event: bi.event,
                    text: bi.text || '',
                    kong: bi.kong || '',
                    name: bi.name || '',
                    ui: bi.ui || '',
                    number: bi.number || 0,
                    collectNum: bi.collectNum || 0,
                    failResult: bi.failResult || []
                });
            }
        }

        return result;
    }

    /**
     * 读取 GameJsonCfg 文件
     */
    function importGameJsonCfgFile(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (err) {
                    reject(new Error('JSON 解析失败: ' + err.message));
                }
            };
            reader.onerror = function() {
                reject(new Error('文件读取失败'));
            };
            reader.readAsText(file);
        });
    }

    /**
     * 合并导出：将编辑器数据合并到已有的 GameJsonCfg 中
     */
    function exportGameMergeFile(stateData, existingGameJson) {
        var newTables = toGameFormat(stateData);
        var merged = JSON.parse(JSON.stringify(existingGameJson));

        var levelId = stateData.level.id;

        // 覆盖 Level
        if (!merged.Level) merged.Level = {};
        merged.Level[levelId] = newTables.Level[levelId];

        // 覆盖 EventInfo（先删除旧的，再写入新的）
        if (!merged.EventInfo) merged.EventInfo = {};
        var existingEvents = Object.keys(merged.EventInfo);
        for (var i = existingEvents.length - 1; i >= 0; i--) {
            var ev = merged.EventInfo[existingEvents[i]];
            if (ev.level === levelId) {
                delete merged.EventInfo[existingEvents[i]];
            }
        }
        var newEventKeys = Object.keys(newTables.EventInfo);
        for (var j = 0; j < newEventKeys.length; j++) {
            merged.EventInfo[newEventKeys[j]] = newTables.EventInfo[newEventKeys[j]];
        }

        // 覆盖 TalkInfo
        if (!merged.TalkInfo) merged.TalkInfo = {};
        var existingTalks = Object.keys(merged.TalkInfo);
        for (var k = existingTalks.length - 1; k >= 0; k--) {
            var ti = merged.TalkInfo[existingTalks[k]];
            if (ti.level === levelId) {
                delete merged.TalkInfo[existingTalks[k]];
            }
        }
        var newTalkKeys = Object.keys(newTables.TalkInfo);
        for (var l = 0; l < newTalkKeys.length; l++) {
            merged.TalkInfo[newTalkKeys[l]] = newTables.TalkInfo[newTalkKeys[l]];
        }

        // 覆盖 TalkMsg（合并，不删除不属于本关的）
        if (!merged.TalkMsg) merged.TalkMsg = {};
        var newMsgKeys = Object.keys(newTables.TalkMsg);
        for (var m = 0; m < newMsgKeys.length; m++) {
            merged.TalkMsg[newMsgKeys[m]] = newTables.TalkMsg[newMsgKeys[m]];
        }

        // 覆盖 Talks
        if (!merged.Talks) merged.Talks = {};
        if (newTables.Talks[levelId]) {
            merged.Talks[levelId] = newTables.Talks[levelId];
        }

        // 确保 Action 和 Views 存在
        if (!merged.Action) merged.Action = {};
        if (!merged.Views) merged.Views = {};

        return merged;
    }

    // === localStorage ===

    function saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, serialize(data));
            return true;
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            return false;
        }
    }

    function loadFromLocalStorage(key) {
        try {
            var raw = localStorage.getItem(key);
            if (raw) {
                return deserialize(raw);
            }
            return null;
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return null;
        }
    }

    // === 文件 IO ===

    function exportToFile(data, filename) {
        var jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        var blob = new Blob([jsonStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename || 'level.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importFromFile(file) {
        return new Promise(function(resolve, reject) {
            var reader = new FileReader();
            reader.onload = function(e) {
                var data = deserialize(e.target.result);
                if (data) {
                    resolve(data);
                } else {
                    reject(new Error('Invalid file format'));
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    return {
        serialize: serialize,
        deserialize: deserialize,
        toGameFormat: toGameFormat,
        fromGameFormat: fromGameFormat,
        importGameJsonCfgFile: importGameJsonCfgFile,
        exportGameMergeFile: exportGameMergeFile,
        saveToLocalStorage: saveToLocalStorage,
        loadFromLocalStorage: loadFromLocalStorage,
        exportToFile: exportToFile,
        importFromFile: importFromFile
    };
})();

if (typeof window !== 'undefined') {
    window.Serializer = Serializer;
}
