# Fast Gemini – GitHub Copilot Chat Extension

> **Phiên bản 2.0** – Đã chuyển hoàn toàn sang **GitHub Copilot API** thay vì Gemini API hoặc GitHub REST API.

Tiện ích mở rộng trình duyệt cho phép bạn chat với **GitHub Copilot AI** ngay trong popup mà không cần rời khỏi trang web đang xem.

---

## 🚀 Tính năng

- 💬 **Giao diện chat** trực tiếp trong popup trình duyệt
- 🤖 **Powered by GitHub Copilot API** – sử dụng endpoint `api.githubcopilot.com`
- 🔄 **Tự động làm mới token** – Copilot token hết hạn sau ~30 phút, extension tự gia hạn
- 🌐 **Hỗ trợ nhiều model**: GPT-4o, GPT-4o mini, o1-preview, o1-mini
- ⚙️ **System prompt** tuỳ chỉnh
- 🇻🇳 **Thông báo lỗi tiếng Việt** – quota hết, token hết hạn, không có Copilot subscription…
- 🔒 **Token được lưu cục bộ** trong `chrome.storage.local`, không gửi đến bên thứ ba

---

## 📦 Cài đặt

### Yêu cầu

- Trình duyệt Chromium (Chrome, Edge, Brave, Opera…)
- Tài khoản GitHub có **GitHub Copilot subscription** (Individual, Business, hoặc Enterprise)

### Các bước

1. **Tải xuống** hoặc clone repository này
2. Mở `chrome://extensions/` (hoặc `edge://extensions/`)
3. Bật **Developer mode** (góc trên phải)
4. Nhấn **Load unpacked** → chọn thư mục `Fast-Gemini`
5. Extension sẽ xuất hiện trên thanh công cụ

---

## 🔑 Lấy GitHub Personal Access Token

GitHub Copilot API yêu cầu một **GitHub Personal Access Token (PAT)** gắn với tài khoản có Copilot subscription.

### Cách tạo token

1. Truy cập [github.com/settings/tokens](https://github.com/settings/tokens/new?description=Fast-Gemini-Copilot)
2. Đặt tên token, ví dụ: `Fast-Gemini-Copilot`
3. Chọn thời hạn (ví dụ: 90 ngày hoặc No expiration)
4. **Không cần chọn thêm scope nào** – Copilot sử dụng subscription của tài khoản, không phải scope
5. Nhấn **Generate token** và sao chép token (dạng `ghp_xxxx…`)

> ⚠️ **Lưu ý bảo mật**: Token chỉ được lưu trong trình duyệt của bạn (`chrome.storage.local`). Không chia sẻ token với ai.

### Thiết lập trong extension

1. Click biểu tượng extension → nhấn ⚙️ **Settings**
2. Dán token vào ô **GitHub Personal Access Token**
3. Nhấn **🔍 Kiểm tra kết nối** để xác nhận
4. Nhấn **💾 Lưu cài đặt**

---

## 🔌 Copilot API – Thông tin kỹ thuật

### Endpoint sử dụng

| Mục đích | URL |
|---|---|
| Lấy Copilot token | `GET https://api.github.com/copilot_internal/v2/token` |
| Chat completions | `POST https://api.githubcopilot.com/chat/completions` |

### Luồng xác thực

```
GitHub PAT  →  Copilot Token (~30 phút)  →  Chat Completions
```

Extension tự động làm mới Copilot token khi còn ít hơn 60 giây trước khi hết hạn.

### Headers bắt buộc

```
Editor-Version: vscode/1.85.0
Editor-Plugin-Version: copilot/1.155.0
Copilot-Integration-Id: vscode-chat
User-Agent: GitHubCopilot/1.155.0
```

### Định dạng request

```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Hello!" }
  ],
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 4096,
  "stream": false
}
```

---

## ⚠️ Giới hạn & Lưu ý

| Tình huống | Thông báo (tiếng Việt) |
|---|---|
| Token GitHub không hợp lệ | *"GitHub Personal Access Token không hợp lệ hoặc đã hết hạn."* |
| Tài khoản không có Copilot | *"Tài khoản của bạn không có quyền truy cập GitHub Copilot…"* |
| Phiên Copilot hết hạn | *"Phiên Copilot đã hết hạn. Vui lòng thử lại."* (tự động làm mới) |
| Vượt giới hạn request | *"Bạn đã vượt quá giới hạn yêu cầu Copilot…"* |
| Hết quota | *"Hạn mức Copilot của bạn đã hết. Vui lòng kiểm tra subscription."* |

### Giới hạn theo plan

| Plan | Giới hạn ước tính |
|---|---|
| Copilot Individual | ~300 gợi ý/tháng (chat khác với completion) |
| Copilot Business | Cao hơn, phụ thuộc cấu hình tổ chức |
| Copilot Enterprise | Không giới hạn (tùy policy) |

### Lưu ý về trạng thái API

> **API `api.githubcopilot.com` hiện là internal endpoint** – GitHub chưa có tài liệu public chính thức. Extension sử dụng cùng cơ chế mà VS Code Copilot extension dùng. GitHub có thể thay đổi hoặc hạn chế endpoint này bất kỳ lúc nào.
>
> Khi GitHub công bố API Copilot chính thức/public, extension sẽ được cập nhật để dùng endpoint đó. Code đã được cấu trúc để dễ chuyển đổi (thay `COPILOT_CHAT_URL` và `GITHUB_TOKEN_URL` trong `background.js`).

---

## 🛠️ Cấu trúc dự án

```
Fast-Gemini/
├── manifest.json        # Extension manifest (Manifest V3)
├── background.js        # Service worker: Copilot token exchange & API calls
├── popup.html           # Giao diện chat popup
├── popup.js             # Logic popup chat
├── options.html         # Trang cài đặt
├── options.js           # Logic trang cài đặt
├── styles.css           # CSS dùng chung
├── icons/               # Icon extension
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 🔧 Chuyển đổi API (khi cần)

Nếu GitHub công bố API chính thức, chỉ cần thay hai hằng số trong `background.js`:

```js
// Hiện tại (internal)
const GITHUB_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';
const COPILOT_CHAT_URL = 'https://api.githubcopilot.com/chat/completions';

// Tương lai (ví dụ, nếu có endpoint public)
const GITHUB_TOKEN_URL = 'https://api.github.com/copilot/v1/token';
const COPILOT_CHAT_URL = 'https://api.githubcopilot.com/v1/chat/completions';
```

---

## 📄 License

MIT – Xem file LICENSE để biết thêm chi tiết.
