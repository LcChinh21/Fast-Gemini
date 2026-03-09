/**
 * popup.js – Popup UI logic for Fast Gemini (GitHub Copilot Chat)
 */

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {Array<{role:string, content:string}>} */
let conversationHistory = [];
let isLoading = false;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const chatArea     = document.getElementById('chatArea');
const inputMsg     = document.getElementById('inputMsg');
const btnSend      = document.getElementById('btnSend');
const btnClear     = document.getElementById('btnClear');
const btnSettings  = document.getElementById('btnSettings');
const statusDot    = document.getElementById('statusDot');
const statusText   = document.getElementById('statusText');
const noPATBanner  = document.getElementById('noPATBanner');
const welcomeMsg   = document.getElementById('welcomeMsg');
const currentModel = document.getElementById('currentModel');
const openSettingsLink = document.getElementById('openSettingsLink');

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { githubPat, selectedModel } = await chrome.storage.local.get(['githubPat', 'selectedModel']);

  currentModel.textContent = selectedModel || 'gpt-4o';

  if (!githubPat) {
    setStatus('error', 'Chưa cấu hình token');
    noPATBanner.style.display = 'flex';
    btnSend.disabled = true;
    inputMsg.disabled = true;
    inputMsg.placeholder = 'Vui lòng thiết lập GitHub Token trong Settings trước.';
    return;
  }

  setStatus('loading', 'Đang kết nối Copilot…');
  noPATBanner.style.display = 'none';

  const result = await chrome.runtime.sendMessage({ type: 'VALIDATE_PAT', githubPat });

  if (result.ok) {
    setStatus('connected', 'Đã kết nối – GitHub Copilot');
    btnSend.disabled = false;
    inputMsg.disabled = false;
  } else {
    setStatus('error', errorLabel(result.code, result.error));
    noPATBanner.style.display = 'flex';
    btnSend.disabled = true;
    inputMsg.disabled = true;
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function setStatus(type, text) {
  statusDot.className = `status-dot ${type}`;
  statusText.textContent = text;
}

function errorLabel(code, fallback) {
  const labels = {
    NO_PAT:             'Chưa cấu hình GitHub Token',
    INVALID_PAT:        'Token GitHub không hợp lệ',
    NO_COPILOT:         'Tài khoản chưa có Copilot',
    TOKEN_EXPIRED:      'Phiên Copilot hết hạn',
    TOKEN_PARSE_FAILED: 'Phản hồi GitHub không hợp lệ',
    RATE_LIMITED:       'Đã vượt giới hạn yêu cầu',
    QUOTA_EXCEEDED:     'Đã hết hạn mức Copilot',
    EMPTY_RESPONSE:     'Phản hồi rỗng từ Copilot',
    // TOKEN_FETCH_FAILED, ENDPOINT_NOT_FOUND, NETWORK_ERROR, API_ERROR:
    // pass through the detail from background.js (contains HTTP status / context)
  };
  return labels[code] || fallback || 'Lỗi không xác định';
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Very lightweight Markdown → HTML renderer
 * Supports: **bold**, `inline code`, ```fenced code```, line breaks
 */
function renderMarkdown(text) {
  // Fenced code blocks
  let html = text.replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, (_, c) => `<code>${escapeHtml(c)}</code>`);

  // Bold – escape the captured content to prevent XSS
  html = html.replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`);

  // Italic – escape the captured content to prevent XSS
  html = html.replace(/\*(.+?)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`);

  // Paragraphs (double newline)
  html = html
    .split(/\n{2,}/)
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');

  return html;
}

// ─── Chat rendering ───────────────────────────────────────────────────────────

function hideWelcome() {
  if (welcomeMsg) welcomeMsg.remove();
}

function appendMessage(role, content, isError = false) {
  hideWelcome();

  const div = document.createElement('div');
  div.className = `message ${role}${isError ? ' message-error' : ''}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? '👤' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (isError) {
    bubble.textContent = content;
  } else if (role === 'user') {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = renderMarkdown(content);
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;

  return { div, bubble };
}

function appendThinking() {
  hideWelcome();

  const div = document.createElement('div');
  div.className = 'message assistant message-thinking';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  div.appendChild(avatar);
  div.appendChild(bubble);
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;

  return div;
}

// ─── Send message ─────────────────────────────────────────────────────────────

async function sendMessage() {
  if (isLoading) return;

  const text = inputMsg.value.trim();
  if (!text) return;

  const { githubPat, selectedModel, systemPrompt } = await chrome.storage.local.get([
    'githubPat',
    'selectedModel',
    'systemPrompt',
  ]);

  if (!githubPat) {
    noPATBanner.style.display = 'flex';
    return;
  }

  // Add to UI and history
  appendMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  inputMsg.value = '';
  autoResize(inputMsg);

  isLoading = true;
  btnSend.disabled = true;
  setStatus('loading', 'Đang xử lý…');

  const thinkingEl = appendThinking();

  const messages = [];

  // Include system prompt if configured
  if (systemPrompt && systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  }

  messages.push(...conversationHistory);

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'CHAT',
      githubPat,
      messages,
      options: { model: selectedModel || 'gpt-4o' },
    });

    thinkingEl.remove();

    if (result.ok) {
      conversationHistory.push({ role: 'assistant', content: result.content });
      appendMessage('assistant', result.content);
      setStatus('connected', 'Đã kết nối – GitHub Copilot');
    } else {
      const errMsg = errorLabel(result.code, result.error);
      appendMessage('assistant', errMsg, true);
      setStatus('error', errorLabel(result.code, result.error));

      // Remove failed user message from history
      conversationHistory.pop();

      if (result.code === 'INVALID_PAT' || result.code === 'NO_COPILOT' || result.code === 'TOKEN_EXPIRED') {
        noPATBanner.style.display = 'flex';
        btnSend.disabled = true;
        inputMsg.disabled = true;
      }
    }
  } catch (err) {
    thinkingEl.remove();
    appendMessage('assistant', `Lỗi kết nối: ${err.message}`, true);
    setStatus('error', 'Lỗi kết nối');
    conversationHistory.pop();
  } finally {
    isLoading = false;
    // Only re-enable the send button if no auth error disabled the inputs
    if (!inputMsg.disabled) {
      btnSend.disabled = false;
    }
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

inputMsg.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

inputMsg.addEventListener('input', () => autoResize(inputMsg));

btnSend.addEventListener('click', sendMessage);

btnClear.addEventListener('click', () => {
  conversationHistory = [];
  chatArea.innerHTML = `
    <div class="welcome" id="welcomeMsg">
      <div class="welcome-icon">🤖</div>
      <h2>Xin chào! Tôi là Copilot</h2>
      <p>Hỏi tôi bất cứ điều gì – viết code, giải thích, hay thảo luận ý tưởng.</p>
    </div>
  `;
});

btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

openSettingsLink.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ─── Start ────────────────────────────────────────────────────────────────────

init();
