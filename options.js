/**
 * options.js – Settings page logic for Fast Gemini
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const ALERT_AUTO_HIDE_DELAY_MS = 3000;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const inputPAT         = document.getElementById('inputPAT');
const togglePAT        = document.getElementById('togglePAT');
const btnValidate      = document.getElementById('btnValidate');
const btnSave          = document.getElementById('btnSave');
const btnReset         = document.getElementById('btnReset');
const alertSuccess     = document.getElementById('alertSuccess');
const alertSuccessText = document.getElementById('alertSuccessText');
const alertError       = document.getElementById('alertError');
const alertErrorText   = document.getElementById('alertErrorText');
const modelGrid        = document.getElementById('modelGrid');
const inputSystemPrompt = document.getElementById('inputSystemPrompt');

let selectedModel = 'gpt-4o';

// ─── Load saved settings ──────────────────────────────────────────────────────

async function loadSettings() {
  const { githubPat, selectedModel: sm, systemPrompt } = await chrome.storage.local.get([
    'githubPat',
    'selectedModel',
    'systemPrompt',
  ]);

  if (githubPat) inputPAT.value = githubPat;

  if (sm) {
    selectedModel = sm;
    modelGrid.querySelectorAll('.model-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.model === sm);
    });
  }

  if (systemPrompt) inputSystemPrompt.value = systemPrompt;
}

// ─── Model selection ──────────────────────────────────────────────────────────

modelGrid.addEventListener('click', (e) => {
  const opt = e.target.closest('.model-option');
  if (!opt) return;
  modelGrid.querySelectorAll('.model-option').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');
  selectedModel = opt.dataset.model;
});

// ─── Toggle password visibility ───────────────────────────────────────────────

togglePAT.addEventListener('click', () => {
  if (inputPAT.type === 'password') {
    inputPAT.type = 'text';
    togglePAT.textContent = '🙈';
  } else {
    inputPAT.type = 'password';
    togglePAT.textContent = '👁';
  }
});

// ─── Alert helpers ────────────────────────────────────────────────────────────

function showSuccess(text) {
  alertSuccessText.textContent = text;
  alertSuccess.classList.add('show');
  alertError.classList.remove('show');
}

function showError(text) {
  alertErrorText.textContent = text;
  alertError.classList.add('show');
  alertSuccess.classList.remove('show');
}

function hideAlerts() {
  alertSuccess.classList.remove('show');
  alertError.classList.remove('show');
}

function errorMessage(code, fallback) {
  const messages = {
    NO_PAT:             'Vui lòng nhập GitHub Personal Access Token.',
    INVALID_PAT:        'Token không hợp lệ hoặc đã hết hạn. Hãy tạo token mới tại github.com/settings/tokens.',
    NO_COPILOT:         'Tài khoản của bạn chưa có GitHub Copilot subscription. Hãy đăng ký tại github.com/features/copilot.',
    TOKEN_FETCH_FAILED: 'Không thể kết nối đến GitHub. Kiểm tra lại kết nối mạng và token.',
    RATE_LIMITED:       'Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau vài phút.',
    QUOTA_EXCEEDED:     'Hạn mức Copilot đã hết. Kiểm tra subscription của bạn.',
  };
  return messages[code] || fallback || 'Đã xảy ra lỗi không xác định.';
}

// ─── Validate PAT ─────────────────────────────────────────────────────────────

btnValidate.addEventListener('click', async () => {
  const pat = inputPAT.value.trim();
  if (!pat) {
    showError('Vui lòng nhập GitHub Personal Access Token trước khi kiểm tra.');
    return;
  }

  hideAlerts();
  btnValidate.disabled = true;
  btnValidate.textContent = '⏳ Đang kiểm tra…';

  const result = await chrome.runtime.sendMessage({ type: 'VALIDATE_PAT', githubPat: pat });

  btnValidate.disabled = false;
  btnValidate.textContent = '🔍 Kiểm tra kết nối';

  if (result.ok) {
    showSuccess('Kết nối thành công! Copilot đã sẵn sàng.');
  } else {
    showError(errorMessage(result.code, result.error));
  }
});

// ─── Save settings ────────────────────────────────────────────────────────────

btnSave.addEventListener('click', async () => {
  const pat = inputPAT.value.trim();

  await chrome.storage.local.set({
    githubPat: pat,
    selectedModel,
    systemPrompt: inputSystemPrompt.value.trim(),
  });

  showSuccess('Đã lưu cài đặt thành công!');

  // Auto-hide success message after delay
  setTimeout(() => hideAlerts(), ALERT_AUTO_HIDE_DELAY_MS);
});

// ─── Reset settings ───────────────────────────────────────────────────────────

btnReset.addEventListener('click', async () => {
  if (!confirm('Đặt lại toàn bộ cài đặt về mặc định?')) return;

  await chrome.storage.local.clear();

  inputPAT.value = '';
  inputSystemPrompt.value = '';
  selectedModel = 'gpt-4o';
  modelGrid.querySelectorAll('.model-option').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.model === 'gpt-4o');
  });

  showSuccess('Đã đặt lại cài đặt.');
  setTimeout(() => hideAlerts(), ALERT_AUTO_HIDE_DELAY_MS);
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadSettings();
