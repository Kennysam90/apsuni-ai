import { ApiError, NETWORK_MESSAGE, messageForStatus } from './errors';
import { markLoggedIn } from './appFlags';
import { setUserCountry } from './currency';

// Production API. Override with EXPO_PUBLIC_API_URL for local development.
const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://api.apsuni.com/api').replace(/\/$/, '');

let accessToken: string | null = null;
let refreshToken: string | null = null;
const cartCountListeners = new Set<(count: number) => void>();

export function subscribeToCartCount(listener: (count: number) => void) {
  cartCountListeners.add(listener);
  return () => { cartCountListeners.delete(listener); };
}

function notifyCartCount(count: number) {
  cartCountListeners.forEach((listener) => listener(count));
}

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

export type TeamMember = {
  membership_id: string;
  role: 'lead' | 'member' | string;
  id: number;
  username: string;
  full_name: string;
  profile_image?: string | null;
};
export type Team = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  category_id?: string | null;
  total_projects?: number;
  created_at?: string;
  members?: TeamMember[];
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
  setUserCountry(null);
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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    // No signal, airplane mode, DNS or a dropped connection: nothing came back at all.
    throw new ApiError(NETWORK_MESSAGE, 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    // A crash returns an HTML page, which leaves nothing readable in `body`.
    throw new ApiError(messageForStatus(response.status, formatApiError(body)), response.status);
  }
  return body as T;
}

/**
 * Flattens the backend's error envelopes into one readable sentence, e.g.
 * {"error":{"detail":{"phone":["This field is required."]}}} -> "Phone: This field is required."
 */
function formatApiError(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(formatApiError).filter(Boolean).join(' ');
  if (typeof value !== 'object') return String(value);

  const record = value as Record<string, unknown>;
  for (const key of ['detail', 'details', 'error', 'message', 'non_field_errors']) {
    if (record[key] != null) return formatApiError(record[key]);
  }

  return Object.entries(record)
    .filter(([key]) => key !== 'status_code' && key !== 'code')
    .map(([key, message]) => {
      const text = formatApiError(message);
      const label = key.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean)
    .join(' ');
}

export type UserProfile = {
  id: number;
  username: string;
  first_name?: string | null;
  email: string;
  image?: string | null;
  country?: string | null;
  country_name?: string | null;
  currency?: string | null;
  currency_symbol?: string | null;
};

/** The signed-in user's profile. Loading it also switches the app to the user's currency. */
export async function getProfile() {
  const profile = await request<UserProfile>('/profile/');
  setUserCountry(profile.country);
  return profile;
}

export function listProjects() {
  return request<{ projects: Project[] }>('/deploy/projects/list/');
}

export function listTeams() {
  return request<Team[]>('/deploy/teams/mine/');
}

export async function login(email: string, password: string) {
  const tokens = await request<{ access: string; refresh: string }>('/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthTokens(tokens);
  markLoggedIn(); // this phone has signed in, so the welcome tour is not shown again
  // Pick up the user's country so prices show in their currency straight away.
  getProfile().catch(() => undefined);
  return tokens;
}

export async function sendSignupOtp(email: string) {
  return request<{ message: string }>('/otp-send/', { method: 'POST', body: JSON.stringify({ email }) });
}

/** Forgotten password: email a code, check it, then set the new password. */
// Signed-out customers use these, so an "authentication" error is never about their own session.
const resetUnavailable = (error: unknown): never => {
  if (error instanceof ApiError && error.status === 401) {
    throw new ApiError('Password reset is not available right now. Please try again shortly.', 401);
  }
  throw error;
};

export async function sendResetPasswordOtp(email: string) {
  return request<{ message: string }>('/send_reset_password_otp/', { method: 'POST', body: JSON.stringify({ email }) }).catch(resetUnavailable);
}

export async function verifyResetPasswordOtp(email: string, otp: string) {
  return request<{ uidb64: string; token: string }>('/verify_reset_password_otp/', { method: 'POST', body: JSON.stringify({ email, otp }) }).catch(resetUnavailable);
}

export async function resetPassword(payload: { uidb64: string; token: string; password: string }) {
  return request<{ message: string }>('/reset_password/', { method: 'POST', body: JSON.stringify(payload) }).catch(resetUnavailable);
}

export async function register(payload: { email: string; username: string; password: string; password2: string; first_name: string; last_name: string; phone: string; country: string; accept_terms: boolean; otp: string }) {
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

export async function searchMarketplaceProducts(query: string, category: 'Mobile App' | 'Website', file = '', page = 1) {
  const params = new URLSearchParams({ q: query, category, file, brand: '', product_type: '', min_price: '1', max_price: '10000', page: String(page) });
  return request<{ products: DesignResult[]; page: number; pages: number }>(`/search/?${params}`);
}

/**
 * Screenshot gallery for a product - the mobile preview shows these instead of
 * the demo site. Paths come back as "/media/product-images/01_thumb.png".
 */
export async function getProductImages(productId: string | number) {
  const body = await request<any>(`/product-images/?pid=${encodeURIComponent(String(productId))}`);

  const list = Array.isArray(body)
    ? body
    : [body?.product_images, body?.images, body?.data, body?.results].find(Array.isArray) ?? [];

  return (list as any[])
    .map((item) => (typeof item === 'string' ? item : item?.images || item?.image || item?.url || item?.thumb || item?.path))
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
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

/** Whether a full domain name such as "mybrand.com" is free to register. */
export async function checkDomain(domain: string): Promise<boolean> {
  const result = await request<{ domain: string; isAvailable: boolean }>(`/domain_check/?domain=${encodeURIComponent(domain)}`);
  return Boolean(result.isAvailable);
}

export type PickedFile = { uri: string; name: string; type: string; size?: number };

/** Attaches documents to a project prompt (and removes saved ones). Sent as a form, not JSON. */
export async function updateEditoryAttachments(editoryId: number, files: PickedFile[], removeIds: number[] = [], logo?: PickedFile | null) {
  const form = new FormData();
  if (logo) form.append('company_logo', { uri: logo.uri, name: logo.name, type: logo.type } as any);
  files.forEach((file) => form.append('attachments', { uri: file.uri, name: file.name, type: file.type } as any));
  if (removeIds.length) form.append('remove_attachments', removeIds.join(','));

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/update-editory/${editoryId}/edit/`, {
      method: 'PATCH',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form,
    });
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success === false) {
    throw new ApiError(messageForStatus(response.status, formatApiError(body)), response.status);
  }
  return body as { success: boolean; message?: string; data?: Record<string, any> };
}

export async function listEditories() {
  return request<{ products: Editory[] }>('/editory-list/');
}

export async function deleteBucketItem(editoryId: number) {
  return request<{ status?: boolean; message?: string }>('/delete-bucket-item/', {
    method: 'DELETE', body: JSON.stringify({ product_id: editoryId }),
  });
}

export async function addEditoryToCart(editoryId: number, quantity = 1) {
  const result = await request<{ status: boolean; total_items: number }>('/add-to-cart/', {
    method: 'POST', body: JSON.stringify({ product_id: editoryId, quantity }),
  });
  notifyCartCount(result.total_items);
  return result;
}

export async function viewCart() {
  return request<{ status: boolean; data: Record<string, any>; total_items: number }>('/view-cart/');
}

export type CustomerOrderProduct = {
  id: number;
  product_id: number;
  product_name: string;
  product_image?: string | null;
  product_company_logo?: string | null;
  company_name?: string | null;
  description?: string | null;
  rating?: number | null;
  qty: number;
  price: string;
  total: string;
  total_product_price: number;
  product_demo?: string | null;
};

export type CustomerOrder = {
  id: number;
  quantity: number | null;
  total_price: string;
  product_status: string;
  payment_status: string;
  order_date: string;
  sku?: string | null;
  name?: string | null;
  company_logo?: string | null;
  email?: string | null;
  buyer_name?: string | null;
  paid_status?: boolean;
  payment_type?: string | null;
  importance?: string | null;
  progress_count?: number | null;
  products?: CustomerOrderProduct[];
};

export async function listCustomerOrders(status = '') {
  return request<{ product_count: number; orders: CustomerOrder[] }>('/customer_orders_&_cancel/', {
    method: 'POST',
    body: JSON.stringify({ statuse: status }),
  });
}

export type CustomerOrderProductsResponse = {
  order_id: number;
  products: CustomerOrderProduct[];
  products_count: number;
};

export async function getOrderProducts(orderId: number) {
  return request<CustomerOrderProductsResponse>(`/orders/${orderId}/products/`);
}

export async function cancelOrder(orderId: number) {
  return request<{ status: string; detail: string; order?: Record<string, any> }>(`/orders/${orderId}/cancel/`, {
    method: 'POST',
  });
}

export type WalletMember = { id: number; username: string; email: string };

export type WalletAccount = {
  id: string;
  account_type: 'personal' | 'team' | 'credit' | string;
  name: string;
  balance: string;
  owner?: WalletMember;
  members?: WalletMember[];
  max_members?: number;
  allow_withdrawals?: boolean;
  created_at?: string;
};

export type SavedCard = {
  id: string;
  last4: string;
  brand: string;
  expiry_month?: string | null;
  expiry_year?: string | null;
  is_default?: boolean;
  active?: boolean;
};

export type CardFundingResult = {
  status: 'success' | 'already_processed' | 'cancelled' | 'failed' | string;
  amount?: string;
  tx_ref?: string;
  detail?: string;
  wallet?: WalletAccount;
};

export function listWalletAccounts() {
  return request<WalletAccount[]>('/wallets/');
}

export async function listSavedCards() {
  const result = await request<{ status: string; cards?: SavedCard[] }>('/cards/');
  return result.cards ?? [];
}

/** Backend allows one wallet per account type; an existing one is returned as-is. */
export function createWalletAccount(payload: { account_type: string; name?: string }) {
  return request<WalletAccount>('/wallets/create/', { method: 'POST', body: JSON.stringify(payload) });
}

/** Starts a Flutterwave hosted checkout and returns the payment link. */
export function initiateCardFunding(payload: { wallet_id: string; amount: number; redirect_url?: string }) {
  return request<{ status: string; payment_link: string; tx_ref: string; funding_request_id: string }>('/fund/card/initiate/', {
    method: 'POST', body: JSON.stringify(payload),
  });
}

/** Confirms a completed checkout with the backend, which credits the wallet. */
export function verifyCardFunding(payload: { transaction_id: string; tx_ref: string; status: string; save_card?: boolean }) {
  return request<CardFundingResult>('/fund/card/verify/', { method: 'POST', body: JSON.stringify(payload) });
}

/** Charges a saved card directly; no checkout page is involved. */
export function fundWithSavedCard(payload: { wallet_id: string; saved_card_id: string; amount: number }) {
  return request<CardFundingResult>('/fund/saved-card/', { method: 'POST', body: JSON.stringify(payload) });
}

export async function listWallets() {
  return request<Record<string, any>[]>('/wallets/');
}

export async function checkoutWithWallet(deliveryAddress: { address: string; mobile: string; status: boolean }) {
  return request<{ status: boolean; message: string; data?: Record<string, any> }>('/checkout/?payment_type=wallet', {
    method: 'POST', body: JSON.stringify({ delivery_address: deliveryAddress }),
  });
}

/** Pays the whole cart from the wallet holding the given currency (e.g. USDTTRC20). */
export async function payCartWithWallet(currency: string) {
  return request<{ status?: boolean; message?: string; data?: Record<string, any> }>(
    `/checkout/?payment_type=wallet&currency=${encodeURIComponent(currency)}`,
    // The endpoint rejects an empty body ("no data provided"); the website sends this same placeholder address.
    { method: 'POST', body: JSON.stringify({ delivery_address: { mobile: '09012345678', address: '123 Apapa Lane, Lagos, Nigeria', status: true } }) },
  );
}

export const getNotifications = () => request<any>('/notifications/');

export async function fetchConversationToken(): Promise<string | { agent_id: string }> {
  if (!accessToken) throw new ApiError('Please sign in before starting a voice session.', 401);
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
    throw new ApiError(messageForStatus(response.status, message), response.status);
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