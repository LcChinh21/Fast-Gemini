/**
 * background.js – Service Worker for Fast Gemini (GitHub Copilot API)
 *
 * Handles:
 *  - Exchanging a GitHub PAT for a short-lived Copilot token
 *  - Caching/refreshing that token before it expires
 *  - Forwarding chat-completion requests to api.githubcopilot.com
 *  - Returning streamed or full responses back to popup
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const GITHUB_TOKEN_URL = 'https://api.github.com/copilot_internal/v2/token';
const COPILOT_CHAT_URL = 'https://api.githubcopilot.com/chat/completions';

// Required headers that the Copilot API validates
const COPILOT_EDITOR_HEADERS = {
  'Editor-Version': 'vscode/1.85.0',
  'Editor-Plugin-Version': 'copilot/1.155.0',
  'Copilot-Integration-Id': 'vscode-chat',
  'User-Agent': 'GitHubCopilot/1.155.0',
};

// Token cache – stored in memory between service-worker wake-ups
let _cachedToken = null;       // { token, expiresAt (ms) }
let _cachedGithubPat = null;   // last PAT used to fetch the cached token

// Fallback TTL when GitHub does not include expires_at in the response.
// Set to 28 minutes (slightly under the typical ~30-minute token lifetime)
// so we refresh before the token actually expires.
const DEFAULT_TOKEN_TTL_MS = 28 * 60_000;

// ─── Token management ─────────────────────────────────────────────────────────

/**
 * Returns a valid Copilot bearer token, refreshing it when needed.
 * @param {string} githubPat  GitHub Personal Access Token
 * @returns {Promise<string>} Copilot bearer token
 */
async function getCopilotToken(githubPat) {
  const now = Date.now();

  // Reuse cached token if it is still valid for at least 60 s
  if (
    _cachedToken &&
    _cachedGithubPat === githubPat &&
    _cachedToken.expiresAt - now > 60_000
  ) {
    return _cachedToken.token;
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'GET',
    headers: {
      Authorization: `token ${githubPat}`,
      Accept: 'application/json',
      'User-Agent': 'GitHubCopilot/1.155.0',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) {
      throw new CopilotError('INVALID_PAT', 'GitHub Personal Access Token không hợp lệ hoặc đã hết hạn.');
    }
    if (response.status === 403) {
      throw new CopilotError('NO_COPILOT', 'Tài khoản của bạn không có quyền truy cập GitHub Copilot. Hãy đảm bảo bạn có subscription Copilot.');
    }
    throw new CopilotError('TOKEN_FETCH_FAILED', `Không thể lấy Copilot token (HTTP ${response.status}): ${text}`);
  }

  const data = await response.json();

  if (!data.token) {
    throw new CopilotError('TOKEN_PARSE_FAILED', 'Phản hồi từ GitHub không chứa token hợp lệ.');
  }

  // expires_at is an ISO-8601 string like "2024-01-01T00:30:00Z"
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : now + DEFAULT_TOKEN_TTL_MS;

  _cachedToken = { token: data.token, expiresAt };
  _cachedGithubPat = githubPat;

  return data.token;
}

// ─── Chat completions ─────────────────────────────────────────────────────────

/**
 * Sends a chat-completion request to the Copilot API and returns the full
 * assistant reply as a string.
 *
 * @param {string} githubPat
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} options  model, temperature, max_tokens, etc.
 * @returns {Promise<string>} The assistant message content
 */
async function chatWithCopilot(githubPat, messages, options = {}) {
  const token = await getCopilotToken(githubPat);

  const body = {
    messages,
    model: options.model || 'gpt-4o',
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens || 4096,
    top_p: 1,
    stream: false,
    n: 1,
  };

  const response = await fetch(COPILOT_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...COPILOT_EDITOR_HEADERS,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) {
      // Invalidate cached token so next request forces a refresh
      _cachedToken = null;
      throw new CopilotError('TOKEN_EXPIRED', 'Phiên Copilot đã hết hạn. Vui lòng thử lại.');
    }
    if (response.status === 429) {
      throw new CopilotError('RATE_LIMITED', 'Bạn đã vượt quá giới hạn yêu cầu Copilot. Vui lòng chờ một lúc trước khi thử lại.');
    }
    if (response.status === 402) {
      throw new CopilotError('QUOTA_EXCEEDED', 'Hạn mức Copilot của bạn đã hết. Vui lòng kiểm tra subscription của bạn.');
    }
    throw new CopilotError('API_ERROR', `Lỗi Copilot API (HTTP ${response.status}): ${text}`);
  }

  const data = await response.json();

  const content = data?.choices?.[0]?.message?.content;
  if (content === undefined || content === null) {
    throw new CopilotError('EMPTY_RESPONSE', 'Copilot trả về phản hồi rỗng. Vui lòng thử lại.');
  }

  return content;
}

// ─── Validate PAT only ────────────────────────────────────────────────────────

/**
 * Tests a PAT by attempting to fetch a Copilot token.
 * Returns { ok: true } or { ok: false, error }
 */
async function validatePat(githubPat) {
  try {
    await getCopilotToken(githubPat);
    return { ok: true };
  } catch (err) {
    return { ok: false, code: err.code || 'UNKNOWN', error: err.message };
  }
}

// ─── Error class ──────────────────────────────────────────────────────────────

class CopilotError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'CopilotError';
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    try {
      if (request.type === 'CHAT') {
        const { githubPat, messages, options } = request;
        if (!githubPat) {
          return sendResponse({ ok: false, code: 'NO_PAT', error: 'Chưa cấu hình GitHub Personal Access Token. Vui lòng vào Settings để thiết lập.' });
        }
        const content = await chatWithCopilot(githubPat, messages, options || {});
        return sendResponse({ ok: true, content });
      }

      if (request.type === 'VALIDATE_PAT') {
        const result = await validatePat(request.githubPat);
        return sendResponse(result);
      }

      sendResponse({ ok: false, code: 'UNKNOWN_TYPE', error: 'Loại yêu cầu không được hỗ trợ.' });
    } catch (err) {
      sendResponse({
        ok: false,
        code: err.code || 'UNKNOWN',
        error: err.message || 'Đã xảy ra lỗi không mong đợi.',
      });
    }
  })();

  // Must return true to use async sendResponse
  return true;
});
