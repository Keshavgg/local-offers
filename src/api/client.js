// HTTP client for the API in /server. The Vite dev server proxies /api to it.

const TOKEN_KEY = 'access_token';
const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

async function request(method, url, { body, params } = {}) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))
    : '';
  const token = getToken();
  let res;
  try {
    res = await fetch('/api' + url + qs, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Cannot reach the server'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } } // expired/invalid session
  if (!res.ok) throw Object.assign(new Error(data.message || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

const entity = (name) => ({
  // filter(query, sort | { sort, limit, fields }, limit) -> { items }
  filter(query = {}, opts = {}, limitArg) {
    const o = typeof opts === 'string' ? { sort: opts, limit: limitArg } : opts || {};
    return request('GET', `/entities/${name}`, { params: { query, sort: o.sort, limit: o.limit, fields: o.fields } });
  },
  get: (id) => request('GET', `/entities/${name}/${id}`),
  create: (data) => request('POST', `/entities/${name}`, { body: data }),
  update: (id, data) => request('PATCH', `/entities/${name}/${id}`, { body: data }),
  delete: (id) => request('DELETE', `/entities/${name}/${id}`),
  count: async (query = {}) => (await request('GET', `/entities/${name}/count`, { params: { query } })).count,
  aggregate: ({ avg }) => request('GET', `/entities/${name}/aggregate`, { params: { avg } }),
});

const entities = new Proxy({}, { get: (cache, name) => (cache[name] ||= entity(String(name))) });

const auth = {
  hasSession: () => !!getToken(),
  me: () => request('GET', '/auth/me'),
  isAuthenticated: async () => {
    if (!getToken()) return false;
    try { await request('GET', '/auth/me'); return true; } catch { return false; }
  },
  register: ({ email, password, role, phone }) => request('POST', '/auth/register', { body: { email, password, role, phone } }),
  verifyOtp: ({ email, otpCode }) => request('POST', '/auth/verify-otp', { body: { email, otpCode } }),
  resendOtp: (email) => request('POST', '/auth/resend-otp', { body: { email } }),
  setToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  // `identifier` is an email address or a phone number
  async loginViaEmailPassword(identifier, password) {
    const out = await request('POST', '/auth/login', { body: { identifier, password } });
    localStorage.setItem(TOKEN_KEY, out.access_token);
    return out;
  },
  updateMe: (data) => request('PATCH', '/auth/me', { body: data }),
  phone: {
    config: () => request('GET', '/auth/phone/config'),
    start: (role) => request('POST', '/auth/phone/start', { body: { role } }),
    status: (token) => request('GET', '/auth/phone/status', { params: { token } }),
    async complete({ token, password, full_name }) {
      const out = await request('POST', '/auth/phone/complete', { body: { token, password, full_name } });
      localStorage.setItem(TOKEN_KEY, out.access_token);
      return out;
    },
  },
  resetPasswordRequest: (identifier) => request('POST', '/auth/reset-request', { body: { identifier } }),
  resetPassword: ({ resetToken, newPassword }) => request('POST', '/auth/reset', { body: { resetToken, newPassword } }),
  logout(redirect) {
    localStorage.removeItem(TOKEN_KEY);
    if (redirect) window.location.href = '/login';
  },
  redirectToLogin() {
    window.location.href = '/login';
  },
};

const saved = {
  ids: async () => (await request('GET', '/saved')).ids,
  add: (businessId) => request('PUT', `/saved/${businessId}`),
  remove: (businessId) => request('DELETE', `/saved/${businessId}`),
};

export const api = {
  entities,
  saved,
  auth,
  app: { getPublicSettings: async () => ({}) },
};
export default api;
