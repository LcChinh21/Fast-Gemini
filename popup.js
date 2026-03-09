/**
 * Fast Gemini - Popup Script
 * Xử lý giao diện popup, gửi tin nhắn đến Gemini API, và quản lý cài đặt
 */

'use strict';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Nhiệt độ sinh văn bản (0 = xác định, 1 = sáng tạo cao). 0.9 cho câu trả lời đa dạng mà vẫn chính xác.
const GENERATION_TEMPERATURE = 0.9;

class FastGemini {
  constructor() {
    this.apiKey = '';
    this.model = 'gemini-2.0-flash';
    this.pendingImage = null; // base64 string của ảnh đã chụp

    this._bindElements();
    this._bindEvents();
    this._loadSettings().then(() => this._checkPendingScreenshot());
  }

  /* ---- DOM References ---- */
  _bindElements() {
    this.chatContainer  = document.getElementById('chatContainer');
    this.userInput      = document.getElementById('userInput');
    this.sendBtn        = document.getElementById('sendBtn');
    this.captureBtn     = document.getElementById('captureBtn');
    this.settingsBtn    = document.getElementById('settingsBtn');
    this.modalOverlay   = document.getElementById('modalOverlay');
    this.modalCloseBtn  = document.getElementById('modalCloseBtn');
    this.apiKeyInput    = document.getElementById('apiKeyInput');
    this.modelSelect    = document.getElementById('modelSelect');
    this.saveSettingsBtn= document.getElementById('saveSettingsBtn');
    this.saveStatus     = document.getElementById('saveStatus');
    this.imagePreview   = document.getElementById('imagePreview');
    this.previewImg     = document.getElementById('previewImg');
    this.removeImageBtn = document.getElementById('removeImageBtn');
  }

  /* ---- Event Listeners ---- */
  _bindEvents() {
    this.sendBtn.addEventListener('click', () => this._handleSend());
    this.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });

    this.captureBtn.addEventListener('click', () => this._startCapture());
    this.settingsBtn.addEventListener('click', () => this._openSettings());
    this.modalCloseBtn.addEventListener('click', () => this._closeSettings());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) this._closeSettings();
    });

    this.saveSettingsBtn.addEventListener('click', () => this._saveSettings());
    this.removeImageBtn.addEventListener('click', () => this._clearImage());
  }

  /* ---- Settings ---- */
  async _loadSettings() {
    try {
      const data = await chrome.storage.local.get(['apiKey', 'model']);
      this.apiKey = data.apiKey || '';
      this.model  = data.model  || 'gemini-2.0-flash';
    } catch (err) {
      console.error('[FastGemini] Lỗi tải cài đặt:', err);
    }
  }

  /* ---- Kiểm tra ảnh đang chờ từ lần chụp trước ---- */
  async _checkPendingScreenshot() {
    try {
      const data = await chrome.storage.local.get('pendingScreenshot');
      if (data.pendingScreenshot) {
        this._setImage(data.pendingScreenshot);
        await chrome.storage.local.remove('pendingScreenshot');
      }
    } catch (err) {
      console.error('[FastGemini] Lỗi kiểm tra ảnh chờ:', err);
    }
  }

  _openSettings() {
    this.apiKeyInput.value  = this.apiKey;
    this.modelSelect.value  = this.model;
    this.saveStatus.textContent = '';
    this.modalOverlay.style.display = 'flex';
  }

  _closeSettings() {
    this.modalOverlay.style.display = 'none';
  }

  async _saveSettings() {
    const key   = this.apiKeyInput.value.trim();
    const model = this.modelSelect.value;

    if (!key) {
      this.saveStatus.style.color = '#e53935';
      this.saveStatus.textContent = '⚠️ Vui lòng nhập API Key';
      return;
    }

    try {
      await chrome.storage.local.set({ apiKey: key, model });
      this.apiKey = key;
      this.model  = model;
      this.saveStatus.style.color = '#4caf50';
      this.saveStatus.textContent = '✅ Đã lưu cài đặt!';
      setTimeout(() => this._closeSettings(), 1200);
    } catch (err) {
      this.saveStatus.style.color = '#e53935';
      this.saveStatus.textContent = '❌ Lỗi khi lưu cài đặt';
      console.error('[FastGemini] Lỗi lưu cài đặt:', err);
    }
  }

  /* ---- Image Handling ---- */
  _setImage(base64) {
    this.pendingImage = base64;
    this.previewImg.src = base64;
    this.imagePreview.style.display = 'inline-block';
  }

  _clearImage() {
    this.pendingImage = null;
    this.previewImg.src = '';
    this.imagePreview.style.display = 'none';
  }

  /* ---- Screenshot Capture ---- */
  async _startCapture() {
    if (!this.apiKey) {
      this._addMessage('assistant', '⚙️ Vui lòng cài đặt API Key trước khi sử dụng tính năng này.');
      this._openSettings();
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        this._addMessage('assistant', '❌ Không thể xác định tab hiện tại.');
        return;
      }

      // Gửi lệnh đến content script để bắt đầu chụp
      // Sau khi chụp, ảnh được lưu vào storage.local và sẽ được tải khi popup mở lại
      await chrome.tabs.sendMessage(tab.id, { type: 'START_CAPTURE' });

      // Đóng popup để người dùng có thể tương tác với trang
      // Khi mở lại popup, _checkPendingScreenshot sẽ tải ảnh đã chụp
      window.close();
    } catch (err) {
      // Lỗi thường gặp: trang chrome://, about:, hoặc content script chưa inject
      this._addMessage('assistant', '❌ Không thể chụp ảnh trên trang này. Tính năng chụp ảnh chỉ hoạt động trên các trang web thông thường (http/https).');
      console.error('[FastGemini] Lỗi khi bắt đầu chụp ảnh:', err);
    }
  }

  /* ---- Send Message ---- */
  async _handleSend() {
    const text = this.userInput.value.trim();

    if (!text && !this.pendingImage) return;

    if (!this.apiKey) {
      this._addMessage('assistant', '⚙️ Vui lòng nhập API Key trong phần Cài đặt (⚙️) trước khi sử dụng.');
      this._openSettings();
      return;
    }

    // Thêm tin nhắn người dùng vào chat
    this._addMessage('user', text, this.pendingImage);
    this.userInput.value = '';
    const imageToSend = this.pendingImage;
    this._clearImage();

    // Hiện typing indicator
    const typingEl = this._addTypingIndicator();

    this.sendBtn.disabled = true;

    try {
      const reply = await this._callGeminiAPI(text, imageToSend);
      typingEl.remove();
      this._addMessage('assistant', reply);
    } catch (err) {
      typingEl.remove();
      const errorMsg = this._formatError(err);
      this._addMessage('assistant', `❌ ${errorMsg}`);
      console.error('[FastGemini] Lỗi API:', err);
    } finally {
      this.sendBtn.disabled = false;
      this.userInput.focus();
    }
  }

  /* ---- Gemini API Call ---- */
  async _callGeminiAPI(text, imageBase64) {
    const url = `${GEMINI_API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;

    // Xây dựng parts cho request
    const parts = [];

    if (imageBase64) {
      // Trích xuất MIME type và dữ liệu base64 thuần
      const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
      const mimeType  = mimeMatch ? mimeMatch[1] : 'image/png';
      const base64Data = imageBase64.replace(/^data:[^;]+;base64,/, '');

      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data
        }
      });
    }

    if (text) {
      parts.push({ text });
    } else if (imageBase64) {
      parts.push({ text: 'Hãy mô tả và phân tích ảnh này.' });
    }

    const body = {
      contents: [{ parts }],
      generationConfig: {
        temperature: GENERATION_TEMPERATURE,
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = errData?.error?.message || `HTTP ${response.status}`;
      throw new Error(message);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('Phản hồi không hợp lệ từ Gemini API');
    }

    return content;
  }

  /* ---- UI Helpers ---- */

  /**
   * Thêm tin nhắn vào khung chat
   * @param {'user'|'assistant'} role
   * @param {string} text
   * @param {string|null} imageBase64
   */
  _addMessage(role, text, imageBase64) {
    // Xóa welcome message nếu còn
    const welcome = this.chatContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    const msgEl = document.createElement('div');
    msgEl.className = `message ${role}`;

    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = role === 'user' ? 'Bạn' : '⚡ Gemini';
    msgEl.appendChild(label);

    // Ảnh kèm theo (nếu có)
    if (imageBase64) {
      const img = document.createElement('img');
      img.className = 'message-image';
      img.src = imageBase64;
      img.alt = 'Ảnh đính kèm';
      msgEl.appendChild(img);
    }

    // Văn bản
    if (text) {
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      bubble.textContent = text;
      msgEl.appendChild(bubble);
    }

    this.chatContainer.appendChild(msgEl);
    this._scrollToBottom();
  }

  _addTypingIndicator() {
    const wrapper = document.createElement('div');
    wrapper.className = 'message assistant';

    const label = document.createElement('div');
    label.className = 'message-label';
    label.textContent = '⚡ Gemini';
    wrapper.appendChild(label);

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'typing-dot';
      indicator.appendChild(dot);
    }

    wrapper.appendChild(indicator);
    this.chatContainer.appendChild(wrapper);
    this._scrollToBottom();
    return wrapper;
  }

  _scrollToBottom() {
    this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
  }

  _formatError(err) {
    const msg = err.message || '';
    if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
      return 'API Key không hợp lệ. Vui lòng kiểm tra lại trong Cài đặt.';
    }
    if (msg.includes('QUOTA_EXCEEDED') || msg.includes('quota')) {
      return 'Đã vượt quá giới hạn sử dụng API. Vui lòng thử lại sau.';
    }
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      return 'Không thể kết nối. Vui lòng kiểm tra kết nối mạng.';
    }
    return msg || 'Đã xảy ra lỗi không xác định.';
  }
}

// Khởi tạo ứng dụng khi DOM đã sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  new FastGemini();
});
