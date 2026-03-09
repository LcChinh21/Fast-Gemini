/**
 * Fast Gemini - Content Script
 * Cho phép người dùng khoanh vùng màn hình và chụp ảnh để gửi đến Gemini
 */

'use strict';

class ScreenshotTool {
  constructor() {
    this.isActive = false;
    this.overlay  = null;
    this.selection = null;

    // Tọa độ bắt đầu kéo
    this.startX = 0;
    this.startY = 0;

    // Bind để có thể removeEventListener
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp   = this._onMouseUp.bind(this);
    this._onKeyDown   = this._onKeyDown.bind(this);
  }

  /* ---- Bắt đầu chế độ chụp ảnh ---- */
  start() {
    if (this.isActive) return;
    this.isActive = true;
    this._createOverlay();

    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('keydown',   this._onKeyDown);
  }

  /* ---- Kết thúc / hủy chế độ chụp ảnh ---- */
  stop() {
    this.isActive = false;
    this._removeOverlay();

    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);
    document.removeEventListener('keydown',   this._onKeyDown);
  }

  /* ---- Tạo overlay che phủ toàn trang ---- */
  _createOverlay() {
    this.overlay = document.createElement('div');

    Object.assign(this.overlay.style, {
      position:   'fixed',
      top:        '0',
      left:       '0',
      width:      '100vw',
      height:     '100vh',
      background: 'rgba(0, 0, 0, 0.35)',
      zIndex:     '2147483647',
      cursor:     'crosshair',
      userSelect: 'none'
    });

    // Hướng dẫn người dùng
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      position:   'absolute',
      top:        '50%',
      left:       '50%',
      transform:  'translate(-50%, -50%)',
      color:      '#fff',
      fontSize:   '16px',
      fontFamily: 'sans-serif',
      fontWeight: '600',
      background: 'rgba(0, 0, 0, 0.55)',
      padding:    '12px 20px',
      borderRadius: '8px',
      pointerEvents: 'none',
      textAlign:  'center',
      lineHeight: '1.5'
    });
    hint.textContent = '📸 Kéo chuột để chọn vùng chụp — nhấn Esc để hủy';
    hint.setAttribute('role', 'status');
    hint.setAttribute('aria-live', 'polite');
    hint.setAttribute('aria-label', 'Kéo chuột để chọn vùng chụp. Nhấn Esc để hủy');
    this.overlay.appendChild(hint);
    this._hintEl = hint;

    document.body.appendChild(this.overlay);
  }

  _removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this.selection) {
      this.selection.remove();
      this.selection = null;
    }
    this._hintEl = null;
  }

  /* ---- Mouse Events ---- */
  _onMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();

    this.startX = e.clientX;
    this.startY = e.clientY;

    // Ẩn hint
    if (this._hintEl) this._hintEl.style.display = 'none';

    // Tạo hộp chọn
    this.selection = document.createElement('div');
    Object.assign(this.selection.style, {
      position:   'fixed',
      border:     '2px dashed #667eea',
      background: 'rgba(102, 126, 234, 0.15)',
      zIndex:     '2147483647',
      pointerEvents: 'none',
      left:       `${this.startX}px`,
      top:        `${this.startY}px`,
      width:      '0px',
      height:     '0px'
    });

    document.body.appendChild(this.selection);

    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup',   this._onMouseUp);
  }

  _onMouseMove(e) {
    if (!this.selection) return;

    const x = Math.min(e.clientX, this.startX);
    const y = Math.min(e.clientY, this.startY);
    const w = Math.abs(e.clientX - this.startX);
    const h = Math.abs(e.clientY - this.startY);

    Object.assign(this.selection.style, {
      left:   `${x}px`,
      top:    `${y}px`,
      width:  `${w}px`,
      height: `${h}px`
    });
  }

  _onMouseUp(e) {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup',   this._onMouseUp);

    if (!this.selection) return;

    const rect = {
      x: parseInt(this.selection.style.left,   10),
      y: parseInt(this.selection.style.top,    10),
      w: parseInt(this.selection.style.width,  10),
      h: parseInt(this.selection.style.height, 10)
    };

    this.stop();

    // Bỏ qua nếu vùng quá nhỏ
    if (rect.w < 5 || rect.h < 5) return;

    this._captureRegion(rect);
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      this.stop();
    }
  }

  /* ---- Chụp vùng đã chọn ---- */
  async _captureRegion(rect) {
    try {
      // Yêu cầu background chụp toàn tab
      const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_TAB' });

      if (!response || !response.dataUrl) {
        throw new Error('Không nhận được ảnh từ background');
      }

      const croppedBase64 = await this._cropImage(response.dataUrl, rect);

      // Lưu ảnh vào storage.local để popup tải khi mở lại
      await chrome.storage.local.set({ pendingScreenshot: croppedBase64 });
    } catch (err) {
      console.error('[ScreenshotTool] Lỗi khi chụp ảnh:', err);
    }
  }

  /* ---- Cắt ảnh theo vùng đã chọn ---- */
  _cropImage(dataUrl, rect) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const pixelRatio = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        canvas.width  = rect.w * pixelRatio;
        canvas.height = rect.h * pixelRatio;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(
          img,
          rect.x * pixelRatio, rect.y * pixelRatio, rect.w * pixelRatio, rect.h * pixelRatio,
          0, 0, rect.w * pixelRatio, rect.h * pixelRatio
        );

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Không thể tải ảnh để cắt'));
      img.src = dataUrl;
    });
  }
}

/* ---- Khởi tạo và lắng nghe lệnh từ popup ---- */
const screenshotTool = new ScreenshotTool();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START_CAPTURE') {
    screenshotTool.start();
    sendResponse({ status: 'started' });
  }
  return true;
});
