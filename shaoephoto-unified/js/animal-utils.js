/**
 * Animal Island Utils — Typewriter Toast
 * 动物森友会风格打字机 Toast 工具
 *
 * Usage: showTypewriterToast('你的消息', 3000, false);
 *        showTypewriterToast('错误消息', 5000, true);
 */
(function () {
    'use strict';

    var activeToast = null;
    var activeTimer = null;

    /**
     * Show a typewriter-style toast notification
     * @param {string} message  - The message text to display
     * @param {number} duration  - How long to show (ms), default 3000
     * @param {boolean} isError  - Whether this is an error toast
     */
    window.showTypewriterToast = function (message, duration, isError) {
        // Remove existing toast
        if (activeToast) {
            activeToast.remove();
            activeToast = null;
        }
        if (activeTimer) {
            clearTimeout(activeTimer);
            activeTimer = null;
        }

        var toast = document.createElement('div');
        toast.className = 'tt-toast' + (isError ? ' error' : '');
        // Add typewriter class for the CSS animation
        toast.classList.add('typewriter');
        toast.textContent = message;
        document.body.appendChild(toast);

        // Trigger reflow and set visible
        toast.offsetHeight;
        toast.classList.add('visible');

        activeToast = toast;

        // Auto-hide after duration
        duration = duration || 3000;
        activeTimer = setTimeout(function () {
            if (toast && toast.parentNode) {
                toast.classList.remove('visible');
                setTimeout(function () {
                    if (toast && toast.parentNode) {
                        toast.remove();
                    }
                    if (activeToast === toast) {
                        activeToast = null;
                    }
                }, 300);
            }
        }, duration);
    };
})();
