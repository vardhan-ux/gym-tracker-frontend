/* =========================================================
   GYM TRACKER — API client
   Talks to the Express + MongoDB backend.
   Only the JWT token + a lightweight cached user object are
   kept in localStorage; all real data lives in MongoDB.
   ========================================================= */

// CHANGE THIS to your deployed backend URL once hosted
// e.g. 'https://gym-tracker-api.onrender.com/api'
const API_BASE = window.API_BASE_URL || 'https://gym-tracker-backend-1-1oax.onrender.com/api';

const Api = (() => {
  const TOKEN_KEY = 'gt_token';
  const USER_KEY = 'gt_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  function cachedUser() {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  async function request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  }

  return {
    // ---- Auth ----
    async signup({ name, email, password }) {
      const data = await request('/auth/signup', { method: 'POST', body: { name, email, password }, auth: false });
      setSession(data.token, data.user);
      return data.user;
    },
    async login(email, password) {
      const data = await request('/auth/login', { method: 'POST', body: { email, password }, auth: false });
      setSession(data.token, data.user);
      return data.user;
    },
    async me() {
      const data = await request('/auth/me');
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    },
    async updateProfile(patch) {
      const data = await request('/auth/me', { method: 'PATCH', body: patch });
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    },
    logout() { clearSession(); },
    getToken,
    cachedUser,

    // ---- Workouts ----
    async getWorkouts() {
      const data = await request('/workouts');
      return data.workouts;
    },
    async addWorkout(entry) {
      const data = await request('/workouts', { method: 'POST', body: entry });
      return data.workout;
    },
    async deleteWorkout(id) {
      await request(`/workouts/${id}`, { method: 'DELETE' });
    },

    // ---- Plans ----
    async getPlans() {
      const data = await request('/plans', { auth: false });
      return data.plans;
    }
  };
})();

/** Redirects to login if there's no token; resolves to the cached user otherwise. */
async function requireAuthAsync() {
  if (!Api.getToken()) {
    window.location.href = 'index.html';
    return null;
  }
  try {
    return await Api.me(); // also validates token is still good
  } catch (err) {
    Api.logout();
    window.location.href = 'index.html';
    return null;
  }
}
