// ============================================================
// API CLIENT — wrapper léger autour du backend FastAPI
// ============================================================

// L'URL du backend est définie via window.API_BASE dans config.js
// (utile pour basculer entre dev local et Azure App Service)
const API = window.API_BASE || 'http://localhost:8000';

const TOKEN_KEY = 'soiree_token';
const USER_KEY = 'soiree_user';

const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user() {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
  isLoggedIn() { return !!this.token; },
  isAdmin() { return !!(this.user && this.user.is_admin); },
};

async function apiFetch(path, options = {}) {
  const headers = {
    ...(options.headers || {}),
  };
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;

  // Si body est FormData on laisse fetch poser le boundary
  const isForm = options.body instanceof FormData;
  if (!isForm && options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (!isForm && options.body && typeof options.body !== 'string') {
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });

  if (res.status === 204) return null;

  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = (data && data.detail) || data || `Erreur ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

// ---------- HELPERS ----------
function formatPrice(cents) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function showAlert(container, message, type = 'error') {
  if (!container) return;
  container.innerHTML = `<div class="alert ${type === 'success' ? 'success' : ''}">${message}</div>`;
}

function clearAlert(container) {
  if (container) container.innerHTML = '';
}

// ---------- NAV : injecter les liens selon l'état ----------
function renderNav(active = '') {
  const el = document.getElementById('nav');
  if (!el) return;

  const logged = auth.isLoggedIn();
  const admin = auth.isAdmin();

  el.innerHTML = `
    <nav class="nav">
      <div class="container nav-inner">
        <a href="index.html" class="brand">Nocturna</a>
        <div class="nav-links">
          <a href="index.html" class="${active === 'home' ? 'active' : ''}">Soirées</a>
          ${logged ? `<a href="my-reservations.html" class="${active === 'me' ? 'active' : ''}">Mes places</a>` : ''}
          ${admin ? `<a href="admin.html" class="${active === 'admin' ? 'active' : ''}">Admin</a>` : ''}
          ${logged
            ? `<a href="#" id="logoutLink">Déconnexion</a>`
            : `<a href="login.html" class="${active === 'login' ? 'active' : ''}">Connexion</a>
               <a href="register.html" class="${active === 'register' ? 'active' : ''}">Inscription</a>`
          }
        </div>
      </div>
    </nav>
  `;

  const logoutLink = document.getElementById('logoutLink');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      auth.clear();
      window.location.href = 'index.html';
    });
  }
}

// ---------- REQUIRE AUTH ----------
function requireAuth(redirect = 'login.html') {
  if (!auth.isLoggedIn()) {
    window.location.href = redirect + '?next=' + encodeURIComponent(window.location.pathname);
    return false;
  }
  return true;
}
