// ============================================================
// LISTE PARTY — API client + helpers
// ============================================================
const API = window.API_BASE || 'http://localhost:8000';
const TOKEN_KEY = 'lp_token';
const USER_KEY  = 'lp_user';

const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  get user() { const u = localStorage.getItem(USER_KEY); return u ? JSON.parse(u) : null; },
  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); },
  isLoggedIn() { return !!this.token; },
  isAdmin() { return !!(this.user && this.user.is_admin); },
};

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
  const isForm = options.body instanceof FormData;
  if (!isForm && options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (!isForm && options.body && typeof options.body !== 'string') options.body = JSON.stringify(options.body);
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = data && data.detail ? data.detail : (data || `Erreur ${res.status}`);
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

function formatPrice(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format((cents || 0) / 100);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function showAlert(container, message, type = 'error') {
  if (!container) return;
  container.innerHTML = `<div class="alert ${type === 'success' ? 'success' : type === 'info' ? 'info' : ''}">${message}</div>`;
}
function clearAlert(c) { if (c) c.innerHTML = ''; }

function renderNav(active = '') {
  const el = document.getElementById('nav');
  if (!el) return;
  const logged = auth.isLoggedIn();
  const admin  = auth.isAdmin();
  const isScanner = !!(auth.user && auth.user.is_scanner);
  el.innerHTML = `
    <nav class="nav">
      <div class="container nav-inner">
        <a href="index.html" class="brand">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="brand-dot"></span>
              <span>${window.SITE_NAME || 'Liste Party'}</span>
            </div>
            <span class="brand-slogan">${window.SITE_SLOGAN || 'Dans le bon'}</span>
          </div>
        </a>
        <div class="nav-links">
          <a href="index.html"      class="${active==='home'?'active':''}">Soirées</a>
          <a href="past.html"       class="${active==='past'?'active':''}">Précédentes</a>
          ${logged ? `<a href="my-reservations.html" class="${active==='me'?'active':''}">Ma liste</a>` : ''}
          ${(admin || isScanner) ? `<a href="scanner.html" class="${active==='scanner'?'active':''}">📷 Scanner</a>` : ''}
          ${admin  ? `<a href="admin.html"           class="${active==='admin'?'active':''}">Admin</a>` : ''}
          ${logged
            ? `<a href="#" id="logoutLink">Déco</a>`
            : `<a href="login.html"    class="${active==='login'?'active':''}">Connexion</a>
               <a href="register.html" class="${active==='register'?'active':''} nav-cta">DLB →</a>`
          }
        </div>
      </div>
    </nav>`;
  const ll = document.getElementById('logoutLink');
  if (ll) ll.addEventListener('click', e => { e.preventDefault(); auth.clear(); window.location.href = 'index.html'; });
}

function requireAuth(redirect = 'login.html') {
  if (!auth.isLoggedIn()) {
    window.location.href = redirect + '?next=' + encodeURIComponent(window.location.pathname + window.location.search);
    return false;
  }
  return true;
}

// QR affichage inline
function renderQrTicket(container, data, isGuest = false) {
  container.innerHTML = `
    <div class="ticket">
      <div class="ticket-header">
        <div class="ticket-brand">Liste Party</div>
        <div class="ticket-slogan">Dans le bon</div>
      </div>
      <div class="ticket-body">
        <div class="ticket-event">${data.event_title}</div>
        <div class="ticket-sub">${formatDate(data.event_date)} ${data.event_date ? '· ' + formatTime(data.event_date) : ''}</div>
        <div class="ticket-info">
          <div class="ticket-row">
            <span class="ticket-row-label">${isGuest ? 'Invité(e)' : 'Participant'}</span>
            <span class="ticket-row-val">${data.holder_name}</span>
          </div>
          ${isGuest ? `<div class="ticket-row"><span class="ticket-row-label">Invité par</span><span class="ticket-row-val">${data.host_name}</span></div>` : ''}
          ${!isGuest ? `<div class="ticket-row"><span class="ticket-row-label">Formule</span><span class="ticket-row-val">${data.formula_name}</span></div>` : ''}
          ${!isGuest && data.quantity > 1 ? `<div class="ticket-row"><span class="ticket-row-label">Places</span><span class="ticket-row-val">${data.quantity}</span></div>` : ''}
          <div class="ticket-row"><span class="ticket-row-label">Statut</span><span class="ticket-row-val text-lime">✓ Confirmé</span></div>
        </div>
        <div class="ticket-qr">
          <img src="data:image/png;base64,${data.qr_base64}" alt="QR Code">
        </div>
      </div>
      <div class="ticket-footer">Présenter ce QR à l'entrée · Liste Party · DLB</div>
    </div>`;
}

// ── Footer global ─────────────────────────────────────────
function renderFooter(elId) {
  const target = elId ? document.getElementById(elId) : document.getElementById('footer');
  if (!target) return;
  const yr = new Date().getFullYear();
  target.innerHTML = `
    <footer class="footer">
      <div class="container">
        <div class="footer-top">
          <div class="footer-brand-block">
            <div class="footer-brand">Liste <span>Party</span></div>
            <div class="footer-sub">Dans le bon — T'es sur la liste ou t'es pas sur la liste.</div>
          </div>
          <nav class="footer-nav">
            <div class="footer-nav-col">
              <div class="footer-nav-title">Navigation</div>
              <a href="index.html">Soirées</a>
              <a href="past.html">Soirées passées</a>
              <a href="my-reservations.html">Mes réservations</a>
              <a href="register.html">Créer un compte</a>
            </div>
            <div class="footer-nav-col">
              <div class="footer-nav-title">Légal</div>
              <a href="cgu.html">CGU</a>
              <a href="mentions-legales.html">Mentions légales</a>
              <a href="confidentialite.html">Confidentialité</a>
              <a href="cookies.html">Cookies</a>
            </div>
          </nav>
        </div>
        <div class="footer-bottom">
          <div>© ${yr} Liste Party — Tous droits réservés</div>
          <div class="footer-bottom-right">
            <span class="mono" style="color:var(--smoke);">Paiement sécurisé par</span>
            <span style="color:var(--gold);font-weight:600;">Stripe</span>
          </div>
        </div>
      </div>
    </footer>`;
}
