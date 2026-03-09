# ⚡ Fast Gemini

Một Chrome Extension mạnh mẽ giúp bạn chat với **Google Gemini AI** và phân tích hình ảnh ngay trên trình duyệt — không cần rời khỏi trang web đang xem.

---

## ✨ Tính năng

- 💬 **Chat với Gemini** — Gửi câu hỏi và nhận phản hồi thông minh từ Gemini AI
- 📸 **Chụp ảnh khoanh vùng** — Kéo chuột để chọn vùng bất kỳ trên màn hình
- 🔍 **Phân tích ảnh** — Gửi ảnh đã chụp kèm câu hỏi đến Gemini để phân tích
- ⚙️ **Quản lý cài đặt** — Lưu API Key và chọn model Gemini phù hợp

---

## 📁 Cấu trúc dự án

```
Fast-Gemini/
├── manifest.json      # Manifest V3 - cấu hình extension
├── popup.html         # Giao diện chính của extension
├── popup.js           # Logic popup (class FastGemini)
├── styles.css         # CSS styling với gradient tím-xanh
├── content.js         # Content script (class ScreenshotTool)
├── background.js      # Service Worker - chụp tab
├── icons/             # Icon 16x16, 48x48, 128x128
└── README.md          # Tài liệu hướng dẫn
```

---

## 🚀 Cài đặt

### Bước 1 — Tải mã nguồn

```bash
git clone https://github.com/LcChinh21/Fast-Gemini.git
```

Hoặc tải file ZIP từ trang GitHub và giải nén.

### Bước 2 — Lấy Gemini API Key

1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikeys)
2. Đăng nhập bằng tài khoản Google
3. Nhấn **"Create API key"**
4. Sao chép API Key vừa tạo

### Bước 3 — Load Extension vào Chrome

1. Mở Chrome và vào `chrome://extensions/`
2. Bật **Developer mode** (góc trên bên phải)
3. Nhấn **"Load unpacked"**
4. Chọn thư mục `Fast-Gemini` vừa tải về
5. Extension sẽ xuất hiện trên thanh công cụ Chrome

### Bước 4 — Cấu hình API Key

1. Nhấn icon ⚡ trên thanh công cụ Chrome để mở popup
2. Nhấn nút ⚙️ (Cài đặt)
3. Dán API Key vào ô **"Gemini API Key"**
4. Chọn model phù hợp
5. Nhấn **"Lưu cài đặt"**

---

## 📖 Hướng dẫn sử dụng

### Chat thông thường
1. Nhập câu hỏi vào ô tin nhắn
2. Nhấn **Gửi** hoặc **Enter** để gửi
3. Phản hồi từ Gemini sẽ xuất hiện trong khung chat

### Chụp và phân tích ảnh
1. Nhấn nút **📸 Chụp ảnh**
2. Popup sẽ đóng lại, trang web sẽ được phủ overlay mờ
3. Kéo chuột để khoanh vùng muốn chụp
4. Ảnh sẽ tự động gắn vào khung nhập liệu
5. Nhập câu hỏi (hoặc để trống để Gemini tự mô tả)
6. Nhấn **Gửi** để phân tích

### Phím tắt
| Phím | Tác dụng |
|------|---------|
| `Enter` | Gửi tin nhắn |
| `Shift + Enter` | Xuống dòng mới |
| `Esc` | Hủy chế độ chụp ảnh |

---

## 🤖 Model được hỗ trợ

| Model | Đặc điểm |
|-------|---------|
| `gemini-2.0-flash` | Nhanh, tiết kiệm quota (mặc định) |
| `gemini-1.5-flash` | Cân bằng tốc độ và chất lượng |
| `gemini-1.5-pro` | Mạnh nhất, phù hợp tác vụ phức tạp |

---

## ⚠️ Lưu ý

- API Key được lưu trữ **cục bộ** trong `chrome.storage.local`, không gửi đến bất kỳ server nào khác ngoài Google
- Cần kết nối internet để sử dụng Gemini API
- Tính năng chụp ảnh yêu cầu trang web đã tải xong

---

## 📄 Giấy phép

MIT License — Sử dụng tự do cho mọi mục đích.