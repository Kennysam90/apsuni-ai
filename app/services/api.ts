// Production API. Override with EXPO_PUBLIC_API_URL for local development.
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://api.apsuni.com/api').replace(/\/$/, '');

let accessToken: string | null = null;
let refreshToken: string | null = null;

export type AssistantResponse = {
  conversation_id: string;
  reply_text: string;
  intent: 'build' | 'business' | 'off_topic' | string;
  suggested_actions: unknown[];
  ui_payload: Record<string, unknown>;
};

export type Template = { id: string; name: string; type: string; category: string; preview_image_url?: string | null; figma_url?: string | null };
export type WalletBalance = { balance: string; currency: string; usage_today: string; usage_month: string; low_balance: boolean };
export type DesignResult = Record<string, any> & { id?: number; pid?: string; title?: string; image?: string; price?: string | number };
export type Editory = Record<string, any> & { id: number };
export type ProjectTeamMember = {
  id: number;
  username: string;
  full_name: string;
  profile_image?: string | null;
};
export type Project = {
  id: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  created_at?: string;
  team_members?: ProjectTeamMember[];
};

export function setAuthTokens(tokens: { access?: string; refresh?: string }) {
  accessToken = tokens.access || null;
  refreshToken = tokens.refresh || null;
}

export function clearAuthTokens() {
  accessToken = null;
  refreshToken = null;
}

export function logout() {
  clearAuthTokens();
}

export function getAccessToken() {
  return accessToken;
}

export function getAuthUserId() {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = decodeURIComponent(
      atob(normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '='))
        .split('')
        .map((character) => `%${`00${character.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    const claims = JSON.parse(decoded) as { user_id?: number | string; id?: number | string };
    return claims.user_id ?? claims.id ?? null;
  } catch {
    return null;
  }
}

/** URL for the persistent backend-controlled REST AI conversation socket. */
export function getRestAIWebSocketUrl() {
  // WebSocket routing is mounted at /ws/ by ASGI, while REST endpoints are
  // mounted at /api/. Do not produce /api/ws/rest-ai/ (that route is 404).
  const httpBase = API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/$/, '');
  const wsBase = httpBase.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  return `${wsBase}/ws/rest-ai/?token=${encodeURIComponent(accessToken || '')}`;
}

export type ConversationHistoryItem = {
  id: string;
  title: string;
  preview: string;
  intent?: string;
  started_at: string;
  updated_at: string;
  message_count: number;
  messages?: { id: string; role: 'user' | 'assistant'; text: string; created_at: string }[];
};

export async function getConversationHistory(conversationId?: string) {
  const query = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : '';
  const result = await request<{ conversations: ConversationHistoryItem[] }>(`/assistant/history/${query}`);
  return conversationId ? result.conversations[0] : result.conversations;
}

export type RestAIWebSocketResponse = {
  type: 'assistant_turn' | 'error' | 'ready';
  conversation_id?: string;
  speech?: string;
  response?: AssistantResponse & { speech_audio_url?: string | null; speech_provider?: string };
};

let restAISocket: WebSocket | null = null;
let restAISocketPromise: Promise<WebSocket> | null = null;

function openRestAISocket(): Promise<WebSocket> {
  if (restAISocket?.readyState === WebSocket.OPEN) return Promise.resolve(restAISocket);
  if (restAISocketPromise) return restAISocketPromise;

  restAISocketPromise = new Promise((resolve, reject) => {
    const socket = new WebSocket(getRestAIWebSocketUrl());
    restAISocket = socket;
    socket.onopen = () => {
      restAISocketPromise = null;
      resolve(socket);
    };
    socket.onerror = () => {
      restAISocketPromise = null;
      restAISocket = null;
      reject(new Error('Could not connect to the AI conversation service.'));
    };
    socket.onclose = () => {
      restAISocket = null;
      restAISocketPromise = null;
    };
  });
  return restAISocketPromise;
}

export async function sendAssistantMessageRealtime(text: string, conversationId?: string) {
  const socket = await openRestAISocket();
  return new Promise<RestAIWebSocketResponse>((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data)) as RestAIWebSocketResponse;
        if (payload.type === 'assistant_turn' || payload.type === 'error') {
          socket.removeEventListener('message', handleMessage);
          if (payload.type === 'error') reject(new Error(payload.speech || 'The assistant could not process that request.'));
          else resolve(payload);
        }
      } catch {
        socket.removeEventListener('message', handleMessage);
        reject(new Error('The AI returned an invalid response.'));
      }
    };
    socket.addEventListener('message', handleMessage);
    socket.send(JSON.stringify({ type: 'user_turn', text, conversation_id: conversationId }));
  });
}

export function closeRestAISocket() {
  restAISocket?.close();
  restAISocket = null;
  restAISocketPromise = null;
}

export function getApiAssetUrl(path?: string | null) {
  if (!path) return null;
  const normalizedPath = path.replace('/media/media/', '/media/');
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
  const origin = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${origin}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body.detail || body.error || body.message || 'The request failed.';
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return body as T;
}

export function listProjects() {
  return request<{ projects: Project[] }>('/deploy/projects/list/');
}

export async function login(email: string, password: string) {
  const tokens = await request<{ access: string; refresh: string }>('/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthTokens(tokens);
  return tokens;
}

export async function sendSignupOtp(email: string) {
  return request<{ message: string }>('/otp-send/', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function register(payload: { email: string; username: string; password: string; password2: string; first_name: string; otp: string }) {
  return request<{ message: string }>('/register/', { method: 'POST', body: JSON.stringify(payload) });
}

export async function sendAssistantMessage(text: string, conversationId?: string) {
  return request<AssistantResponse>('/assistant/message/', {
    method: 'POST',
    body: JSON.stringify({ text, conversation_id: conversationId }),
  });
}

export const getGreeting = () => request<{ reply_text: string }>('/assistant/greeting/');

export async function getBusinessSuggestions(country = '') {
  return request<{ country: string; ideas: string[] }>(`/business-guides/suggestions/?country=${encodeURIComponent(country)}`);
}

export async function getBusinessChecklist(idea: string, country = '') {
  return request<{ id: string; idea_text: string; country: string; checklist: unknown[]; cached: boolean; reply_text: string }>('/business-guides/checklist/', {
    method: 'POST', body: JSON.stringify({ idea_text: idea, country }),
  });
}

export async function getTemplates(type?: string, category?: string) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (category) params.set('category', category);
  return request<{ templates: Template[] }>(`/templates/${params.toString() ? `?${params}` : ''}`);
}

export async function addTemplateToCart(templateId: string, projectId?: string) {
  return request<{ cart_item: unknown; project: unknown }>('/cart/add/', {
    method: 'POST', body: JSON.stringify({ template_id: templateId, project_id: projectId }),
  });
}

export async function editProject(projectId: string, values: Record<string, unknown>) {
  return request<{ message: string; updated_fields: string[]; project: unknown }>(`/project/${projectId}/edit/`, {
    method: 'PATCH', body: JSON.stringify(values),
  });
}

export const getWalletBalance = () => request<WalletBalance>('/wallet/balance/');

export async function synthesizeSpeech(text: string) {
  return request<{ text: string; audio_url?: string | null; provider: string; text_only?: boolean }>('/voice/tts/', {
    method: 'POST', body: JSON.stringify({ text, category: 'mobile_test' }),
  });
}

// Core marketplace endpoints used by the voice assistant flow.
export async function searchDesigns(query: string, category: 'Mobile App' | 'Website', page = 1) {
  const params = new URLSearchParams({ q: query, category, page: String(page) });
  return request<{ products: DesignResult[]; page: number; pages: number }>(`/search/?${params}`);
}

export async function createEditory(payload: Record<string, unknown>) {
  return request<{ success: boolean; data: Editory; message?: string }>('/add-to-editory/', {
    method: 'POST', body: JSON.stringify(payload),
  });
}

export async function updateEditory(editoryId: number, payload: Record<string, unknown>) {
  return request<{ success: boolean; data: Editory; message?: string }>(`/update-editory/${editoryId}/edit/`, {
    method: 'PATCH', body: JSON.stringify(payload),
  });
}

export async function listEditories() {
  return request<{ products: Editory[] }>('/editory-list/');
}

export async function addEditoryToCart(editoryId: number, quantity = 1) {
  return request<{ status: boolean; total_items: number }>('/add-to-cart/', {
    method: 'POST', body: JSON.stringify({ product_id: editoryId, quantity }),
  });
}

export async function viewCart() {
  return request<{ status: boolean; data: Record<string, any>; total_items: number }>('/view-cart/');
}

export async function listWallets() {
  return request<Record<string, any>[]>('/wallets/');
}

export async function checkoutWithWallet(deliveryAddress: { address: string; mobile: string; status: boolean }) {
  return request<{ status: boolean; message: string; data?: Record<string, any> }>('/checkout/?payment_type=wallet', {
    method: 'POST', body: JSON.stringify({ delivery_address: deliveryAddress }),
  });
}

export async function fetchConversationToken(): Promise<string | { agent_id: string }> {
  if (!accessToken) throw new Error('Please sign in before starting a voice session.');
  const response = await fetch(`${API_BASE_URL}/voice/conversation-token/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.text();
  if (!response.ok) {
    let message = body || 'Could not start the voice session.';
    try {
      const parsed = JSON.parse(body);
      const detail = parsed.error || parsed.detail || parsed.message;
      message = typeof detail === 'string' ? detail : JSON.stringify(detail || parsed);
    } catch {
      // The server may return plain text for infrastructure errors.
    }
    throw new Error(`Voice service (${response.status}): ${message}`);
  }
  if (!body.trim()) throw new Error('Voice service returned an empty conversation token.');
  try {
    const parsed = JSON.parse(body);
    if (parsed.agent_id) return { agent_id: parsed.agent_id };
  } catch {
    // A secure conversation token is returned as plain text.
  }
  return body.trim();
}

export function getRefreshToken() {
  return refreshToken;
}
