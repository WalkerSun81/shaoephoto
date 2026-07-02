/**
 * History Manager - 撤销/重做管理器
 */
var HistoryManager = (function() {
    var undoStack = [];
    var redoStack = [];
    var maxSize = 100;

    /**
     * 执行操作并记录历史
     * @param {Function} action - 执行的操作
     * @param {Function} undo - 撤销操作
     * @param {string} description - 操作描述
     */
    function execute(action, undo, description) {
        action();
        undoStack.push({
            undo: undo,
            redo: action,
            description: description
        });
        if (undoStack.length > maxSize) {
            undoStack.shift();
        }
        redoStack = [];
        updateButtons();
    }

    /**
     * 撤销
     */
    function undo() {
        if (undoStack.length === 0) return;
        var entry = undoStack.pop();
        entry.undo();
        redoStack.push(entry);
        updateButtons();
    }

    /**
     * 重做
     */
    function redo() {
        if (redoStack.length === 0) return;
        var entry = redoStack.pop();
        entry.redo();
        undoStack.push(entry);
        updateButtons();
    }

    /**
     * 清空历史
     */
    function clear() {
        undoStack = [];
        redoStack = [];
        updateButtons();
    }

    /**
     * 更新按钮状态
     */
    function updateButtons() {
        var btnUndo = document.getElementById('btnUndo');
        var btnRedo = document.getElementById('btnRedo');
        if (btnUndo) btnUndo.disabled = undoStack.length === 0;
        if (btnRedo) btnRedo.disabled = redoStack.length === 0;
    }

    /**
     * 获取历史记录
     */
    function getHistory() {
        return {
            undoStack: undoStack,
            redoStack: redoStack
        };
    }

    return {
        execute: execute,
        undo: undo,
        redo: redo,
        clear: clear,
        getHistory: getHistory
    };
})();

if (typeof window !== 'undefined') {
    window.HistoryManager = HistoryManager;
}
