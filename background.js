/**
 * Fast Gemini - Background Service Worker
 * Xử lý chụp ảnh tab và điều phối tin nhắn giữa popup và content script
 */

'use strict';

/* ---- Lắng nghe tin nhắn ---- */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'CAPTURE_TAB') {
    _captureVisibleTab(sender.tab?.windowId)
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch((err)   => {
        console.error('[Background] Lỗi chụp tab:', err);
        sendResponse({ error: err.message });
      });

    // Trả về true để giữ sendResponse mở cho async
    return true;
  }
});

/* ---- Chụp tab hiện tại ---- */
async function _captureVisibleTab(windowId) {
  const options = { format: 'png', quality: 100 };

  if (windowId !== undefined) {
    return chrome.tabs.captureVisibleTab(windowId, options);
  }

  // Fallback: lấy cửa sổ hiện tại
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return chrome.tabs.captureVisibleTab(tab.windowId, options);
}
