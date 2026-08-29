const SUPABASE_URL = "https://jyqochyquopwanldnbwm.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cW9jaHlxdW9wd2FubGRuYndtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NjkyNjUsImV4cCI6MjEwMzU0NTI2NX0.K4eIL-wCvOWJIukHBnAAIMjPAEKjCRyiflOect41xdI";

const sb = (SUPABASE_URL.includes("YOUR-PROJECT"))
  ? null
  : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------------------------------------------------------------- */
/* STATE                                                                   */
/* ---------------------------------------------------------------------- */
let currentUser = null;
let currentProfile = null;
let wasteTypes = [];
let locations = [];
let regions = [];
let currentPhotoFile = null;
let authMode = 'login';
let leafletMap = null;
let mapInitialized = false;

/* ---------------------------------------------------------------------- */
/* TOASTS                                                                  */
/* ---------------------------------------------------------------------- */
function toast(message, type = 'info') {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'info';
  el.innerHTML = `<i data-lucide="${icon}" style="width:18px;height:18px;flex-shrink:0;"></i><span>${message}</span>`;
  stack.appendChild(el);
  lucide.createIcons();
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateX(30px)'; setTimeout(() => el.remove(), 300); }, 4200);
}

/* ---------------------------------------------------------------------- */
/* NAV                                                                     */
/* ---------------------------------------------------------------------- */
function moveIndicator(tabEl) {
  const indicator = document.getElementById('nav-indicator');
  if (!tabEl || window.innerWidth <= 640) return;
  indicator.style.width = tabEl.offsetWidth + 'px';
  indicator.style.transform = `translateX(${tabEl.offsetLeft}px)`;
}

function activateTab(id) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.add('hidden'));
  const tabBtn = document.querySelector(`.nav-tab[data-tab="${id}"]`);
  if (tabBtn) { tabBtn.classList.add('active'); moveIndicator(tabBtn); }
  const section = document.getElementById(id);
  section.classList.remove('hidden');
  section.classList.remove('tab-content'); void section.offsetWidth; section.classList.add('tab-content'); // restart zoom-in anim

  if (id === 'profile') renderProfileGate();
  if (id === 'submit') renderSubmitGate();
  if (id === 'locations') setTimeout(initMap, 80);
  if (id === 'admin') loadAdminQueue();

  lucide.createIcons();
  observeReveals();
  animateVisibleCounters();
  animateVisibleBars();
}

document.querySelectorAll('.nav-tab, .brand').forEach(el => {
  el.addEventListener('click', () => activateTab(el.getAttribute('data-tab')));
});

/* ---------------------------------------------------------------------- */
/* SCROLL REVEAL / COUNTERS / BARS                                         */
/* ---------------------------------------------------------------------- */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('in-view'), i * 60);
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: .12 });

function observeReveals() {
  document.querySelectorAll('.reveal:not(.in-view)').forEach(el => revealObserver.observe(el));
}

function animateCount(el) {
  const target = parseFloat(el.getAttribute('data-count'));
  const suffix = el.getAttribute('data-suffix') || '';
  const dur = 1100; const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function animateVisibleCounters() {
  document.querySelectorAll('.stat-number[data-count]:not(.counted)').forEach(el => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { el.classList.add('counted'); animateCount(el); obs.disconnect(); } });
    }, { threshold: .3 });
    obs.observe(el);
  });
}
function animateVisibleBars() {
  document.querySelectorAll('.fertility-fill[data-target]').forEach(el => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { el.style.width = el.getAttribute('data-target') + '%'; obs.disconnect(); } });
    }, { threshold: .2 });
    obs.observe(el);
  });
}

/* ---------------------------------------------------------------------- */
/* LIGHTBOX                                                                */
/* ---------------------------------------------------------------------- */
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

/* ---------------------------------------------------------------------- */
/* PHOTO CAPTURE                                                           */
/* ---------------------------------------------------------------------- */
function handlePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  currentPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('photo-preview');
    const placeholder = document.getElementById('photo-placeholder');
    const removeBtn = document.getElementById('photo-remove');
    const box = document.getElementById('photo-preview-box');
    const status = document.getElementById('photo-status');
    preview.src = e.target.result;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    removeBtn.style.display = 'block';
    status.style.display = 'block';
    box.classList.add('has-photo');
  };
  reader.readAsDataURL(file);
}
function removePhoto(event) {
  event.stopPropagation();
  currentPhotoFile = null;
  document.getElementById('photo-preview').style.display = 'none';
  document.getElementById('photo-preview').src = '';
  document.getElementById('photo-placeholder').style.display = 'block';
  document.getElementById('photo-remove').style.display = 'none';
  document.getElementById('photo-status').style.display = 'none';
  document.getElementById('photo-preview-box').classList.remove('has-photo');
  document.getElementById('camera-input').value = '';
}

/* ---------------------------------------------------------------------- */
/* AUTH                                                                    */
/* ---------------------------------------------------------------------- */
function renderAuthZone() {
  const zone = document.getElementById('auth-zone');
  if (currentUser) {
    const label = (currentProfile?.full_name || currentUser.email || '?');
    const initials = label.slice(0, 2).toUpperCase();
    zone.innerHTML = `
      <div class="user-chip" onclick="signOut()">
        <div class="user-avatar">${initials}</div>
        <span class="user-name">${label.split('@')[0]}</span>
        <i data-lucide="log-out" style="width:14px;height:14px;color:var(--muted);"></i>
      </div>`;
  } else {
    zone.innerHTML = `<button class="btn-ghost" onclick="openAuthModal('login')">Войти</button>`;
  }
  lucide.createIcons();
  document.getElementById('admin-tab').classList.toggle('hidden', !currentProfile?.is_admin);
}

function openAuthModal(mode) {
  setAuthMode(mode);
  document.getElementById('auth-modal').classList.add('open');
}
function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
  document.getElementById('auth-error').classList.add('hidden');
}
function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('auth-tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('auth-tab-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('auth-name-group').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('auth-title').textContent = mode === 'signup' ? 'Создать аккаунт' : 'Добро пожаловать назад';
  document.getElementById('auth-submit-btn').textContent = mode === 'signup' ? 'Зарегистрироваться' : 'Войти';
}

async function submitAuth() {
  if (!sb) { toast('Backend не подключён — заполните SUPABASE_URL/KEY в коде', 'error'); return; }
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const fullName = document.getElementById('auth-name').value.trim();
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');

  if (!email || !password) { errEl.textContent = 'Заполните email и пароль'; errEl.classList.remove('hidden'); return; }

  try {
    if (authMode === 'signup') {
      const { error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (error) throw error;
      toast('Аккаунт создан! Проверьте почту, если требуется подтверждение.', 'success');
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast('Вы вошли в аккаунт', 'success');
    }
    closeAuthModal();
  } catch (err) {
    errEl.textContent = err.message || 'Ошибка авторизации';
    errEl.classList.remove('hidden');
  }
}

async function signOut() {
  if (!sb) return;
  await sb.auth.signOut();
  toast('Вы вышли из аккаунта', 'info');
}

async function refreshSession() {
  if (!sb) { renderAuthZone(); return; }
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user || null;
  if (currentUser) {
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
    currentProfile = data || null;
  } else {
    currentProfile = null;
  }
  renderAuthZone();
}

if (sb) {
  sb.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
      const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
      currentProfile = data || null;
    } else {
      currentProfile = null;
    }
    renderAuthZone();
    renderProfileGate();
    renderSubmitGate();
  });
}

/* ---------------------------------------------------------------------- */
/* GATES                                                                   */
/* ---------------------------------------------------------------------- */
function renderSubmitGate() {
  document.getElementById('submit-guest').classList.toggle('hidden', !!currentUser);
  document.getElementById('submit-wizard-wrap').classList.toggle('hidden', !currentUser);
  if (currentUser) goToStep(1);
}
function renderProfileGate() {
  document.getElementById('profile-guest').classList.toggle('hidden', !!currentUser);
  document.getElementById('profile-content').classList.toggle('hidden', !currentUser);
  if (currentUser) {
    document.getElementById('profile-greeting').textContent = `Привет, ${currentProfile?.full_name || currentUser.email.split('@')[0]}!`;
    loadProfile();
  }
}

/* ---------------------------------------------------------------------- */
/* SUBMISSION WIZARD (collect & sort -> fertilize -> photo & submit)       */
/* ---------------------------------------------------------------------- */
let wizardStep = 1;

function goToStep(n) {
  wizardStep = n;
  document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`wizard-step-${n}`).classList.add('active');
  document.querySelectorAll('.wizard-step').forEach(el => {
    const s = parseInt(el.getAttribute('data-step'));
    el.classList.toggle('active', s === n);
    el.classList.toggle('done', s < n);
  });
  document.getElementById('wz-conn-1').classList.toggle('done', n > 1);
  document.getElementById('wz-conn-2').classList.toggle('done', n > 2);
  lucide.createIcons();
}

function tryGoToStep(n) {
  if (n > wizardStep) {
    // moving forward: validate the step we're leaving
    if (wizardStep === 1) {
      const wasteTypeId = document.getElementById('waste-type-select').value;
      const kg = parseFloat(document.getElementById('waste-amount').value);
      const date = document.getElementById('submission-date').value;
      if (!wasteTypeId || !kg || !date) { toast('Заполните тип отходов, количество и дату', 'error'); return; }
    }
  }
  goToStep(n);
}

/* ---------------------------------------------------------------------- */
/* REFERENCE DATA (public read)                                            */
/* ---------------------------------------------------------------------- */
let fertilityTargetKg = 150; // fallback; overwritten by app_settings below

async function loadReferenceData() {
  if (!sb) { renderDemoNotice(); return; }
  const [{ data: loc }, { data: wt }, { data: reg }, { data: settings }] = await Promise.all([
    sb.from('locations').select('*').order('name'),
    sb.from('waste_types').select('*').eq('is_active', true).order('name'),
    sb.from('regions').select('*').order('name'),
    sb.from('app_settings').select('*').eq('key', 'fertility_target_kg').maybeSingle(),
  ]);
  locations = loc || [];
  wasteTypes = wt || [];
  regions = reg || [];
  if (settings?.value) fertilityTargetKg = Number(settings.value);
  renderLocations();
  renderWasteTypes();
  renderFertilityMap();
  populateSubmitSelects();
}

function renderDemoNotice() {
  toast('Подключите Supabase (SUPABASE_URL / SUPABASE_ANON_KEY) чтобы загрузить реальные данные', 'info');
}

function populateSubmitSelects() {
  const wtSel = document.getElementById('waste-type-select');
  wtSel.innerHTML = '<option value="">-- Выберите тип отходов --</option>' +
    wasteTypes.map(w => `<option value="${w.id}" data-rate="${w.rate_gems}">${w.name}</option>`).join('');
}

function updateRewardEstimate() {
  const sel = document.getElementById('waste-type-select');
  const rate = parseFloat(sel.selectedOptions[0]?.getAttribute('data-rate') || 0);
  const kg = parseFloat(document.getElementById('waste-amount').value || 0);
  const box = document.getElementById('reward-estimate');
  if (rate && kg > 0) {
    box.classList.remove('hidden');
    document.getElementById('reward-estimate-gems').textContent = Math.round(rate * kg).toLocaleString('ru-RU');
    const fertilityGain = Math.min(100, (100 * kg) / fertilityTargetKg);
    document.getElementById('reward-estimate-fertility').textContent = '+' + fertilityGain.toFixed(1) + '%';
  } else {
    box.classList.add('hidden');
  }
}

function renderLocations() {
  document.getElementById('locations-list').innerHTML = locations.length ? locations.map(loc => `
    <div class="location-item" onclick="focusLocation(${loc.lat},${loc.lng})">
      <div class="location-name">${loc.name}</div>
      <div class="location-address">📍 ${loc.address}</div>
      <div style="color:var(--muted);font-size:12.5px;">${loc.city}</div>
    </div>`).join('') : skeletonRows(3);
}

function renderWasteTypes() {
  document.getElementById('waste-types-list').innerHTML = wasteTypes.length ? wasteTypes.map(w => `
    <div class="waste-item">
      <div>
        <div class="waste-title">${w.name}</div>
        <div class="waste-description">${w.description}</div>
      </div>
      <span class="waste-badge">💎 ${w.rate_gems} гемов/кг</span>
    </div>`).join('') : skeletonRows(5);
}

function renderFertilityMap() {
  document.getElementById('fertility-grid').innerHTML = regions.length ? regions.map(r => `
    <div class="region-box">
      <div class="region-name">${r.name}</div>
      <div class="fertility-bar"><div class="fertility-fill" data-target="${Math.min(r.fertility * 2, 100)}"></div></div>
      <div class="fertility-percent">${r.fertility}% плодородной почвы</div>
    </div>`).join('') : skeletonRows(6);
  animateVisibleBars();
}

function skeletonRows(n) {
  return Array.from({ length: n }).map(() => `<div class="skel" style="height:64px;margin-bottom:14px;"></div>`).join('');
}

/* ---------------------------------------------------------------------- */
/* SUBMIT WASTE                                                            */
/* ---------------------------------------------------------------------- */
async function submitWaste() {
  if (!sb || !currentUser) { toast('Войдите в аккаунт, чтобы сдать отходы', 'error'); return; }
  const wasteTypeId = document.getElementById('waste-type-select').value;
  const kg = parseFloat(document.getElementById('waste-amount').value);
  const date = document.getElementById('submission-date').value;

  if (!wasteTypeId || !kg || !date) { toast('Вернитесь на шаг 1 и заполните тип, количество и дату', 'error'); goToStep(1); return; }
  if (!currentPhotoFile) { toast('Прикрепите фото процесса, прежде чем отправить', 'error'); return; }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" style="width:18px;height:18px;" class="mono"></i> Отправка...';
  lucide.createIcons();

  try {
    const ext = currentPhotoFile.name.split('.').pop() || 'jpg';
    const photoPath = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('waste-photos').upload(photoPath, currentPhotoFile);
    if (upErr) throw upErr;

    const { data, error } = await sb.from('submissions').insert({
      waste_type_id: wasteTypeId,
      kg,
      submission_date: date,
      photo_path: photoPath,
    }).select().single();
    if (error) throw error;

    document.getElementById('waste-type-select').value = '';
    document.getElementById('waste-amount').value = '';
    document.getElementById('reward-estimate').classList.add('hidden');
    removePhoto({ stopPropagation: () => {} });
    goToStep(1);

    toast(`Принято! 💎 ${Number(data.reward_gems).toLocaleString('ru-RU')} гемов и вклад в плодородность появятся после проверки`, 'success');
  } catch (err) {
    toast(err.message || 'Не удалось отправить отходы', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = '<i data-lucide="check" style="width:18px;height:18px;"></i> Отправить';
    lucide.createIcons();
  }
}

/* ---------------------------------------------------------------------- */
/* PROFILE                                                                  */
/* ---------------------------------------------------------------------- */
async function loadProfile() {
  document.getElementById('submissions-history').innerHTML = skeletonRows(3);
  const [{ data: stats }, { data: subs }] = await Promise.all([
    sb.from('my_stats').select('*').eq('user_id', currentUser.id).maybeSingle(),
    sb.from('submissions').select('*, waste_types(name)').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
  ]);

  const totalKg = stats?.total_kg || 0;
  const totalGems = stats?.total_gems || 0;
  const approvedCount = stats?.approved_count || 0;
  const fertilityScore = Number(stats?.fertility_score || 0);
  animateStatBox('total-submissions', approvedCount);
  animateStatBox('total-weight', Number(totalKg));
  animateStatBox('total-reward', Number(totalGems));
  renderFertilityScoreUI(fertilityScore);

  const hist = document.getElementById('submissions-history');
  if (!subs || subs.length === 0) {
    hist.innerHTML = `<div class="empty-state"><i data-lucide="inbox" style="width:40px;height:40px;color:var(--muted);margin-bottom:10px;"></i><p>Вы ещё не сдавали отходы.<br>Начните с вкладки «Сдать отходы»!</p></div>`;
    lucide.createIcons();
    return;
  }

  hist.innerHTML = subs.map(s => `
    <div class="submission-item">
      <div class="submission-info">
        <div class="submission-type">${s.waste_types?.name || 'Отходы'}</div>
        <div class="submission-date">${new Date(s.submission_date).toLocaleDateString('ru-RU')}</div>
        <span class="status-pill status-${s.status}">${statusLabel(s.status)}</span>
      </div>
      <div style="text-align:right;">
        <div class="submission-kg">${s.kg} кг</div>
        <div class="submission-reward">💎 ${Number(s.reward_gems).toLocaleString('ru-RU')}</div>
      </div>
    </div>`).join('');
}

function statusLabel(s) { return s === 'approved' ? 'Одобрено' : s === 'rejected' ? 'Отклонено' : 'На проверке'; }

function renderFertilityScoreUI(score) {
  const clamped = Math.max(0, Math.min(100, score));
  document.getElementById('fertility-score-value').textContent = clamped.toFixed(0) + '%';
  requestAnimationFrame(() => { document.getElementById('fertility-score-fill').style.width = clamped + '%'; });
  const label = document.getElementById('fertility-score-label');
  if (clamped === 0) label.textContent = 'Сдайте первые отходы, чтобы начать восстановление';
  else if (clamped < 30) label.textContent = 'Критическая — ваша земля только начинает восстанавливаться';
  else if (clamped < 70) label.textContent = 'Средняя — почва оживает, продолжайте!';
  else label.textContent = 'Хорошая — ваша личная земля процветает 🌱';
}

function animateStatBox(id, target) {
  const el = document.getElementById(id);
  const start = performance.now(); const dur = 900;
  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = target * eased;
    el.textContent = Number.isInteger(target) ? Math.round(val).toLocaleString('ru-RU') : val.toFixed(1);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

/* ---------------------------------------------------------------------- */
/* ADMIN                                                                    */
/* ---------------------------------------------------------------------- */
async function loadAdminQueue() {
  if (!currentProfile?.is_admin) return;
  const list = document.getElementById('admin-list');
  list.innerHTML = skeletonRows(3);
  const { data, error } = await sb.from('submissions')
    .select('*, waste_types(name), profiles(full_name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) { list.innerHTML = `<p style="color:var(--error-text);">${error.message}</p>`; return; }

  document.getElementById('admin-badge').textContent = data.length;
  document.getElementById('admin-badge').classList.toggle('hidden', data.length === 0);

  if (data.length === 0) {
    list.innerHTML = `<div class="empty-state"><i data-lucide="check-circle" style="width:40px;height:40px;color:var(--green);margin-bottom:10px;"></i><p>Очередь на модерацию пуста 🎉</p></div>`;
    lucide.createIcons();
    return;
  }

  list.innerHTML = await Promise.all(data.map(async s => {
    let thumbSrc = '';
    if (s.photo_path) {
      const { data: signed } = await sb.storage.from('waste-photos').createSignedUrl(s.photo_path, 3600);
      thumbSrc = signed?.signedUrl || '';
    }
    return `
      <div class="admin-row">
        ${thumbSrc ? `<img class="admin-thumb" src="${thumbSrc}" onclick="openLightbox('${thumbSrc}')">` : `<div class="admin-thumb" style="display:flex;align-items:center;justify-content:center;"><i data-lucide="image-off" style="width:20px;height:20px;color:var(--muted);"></i></div>`}
        <div style="flex:1;">
          <div style="font-weight:700;">${s.waste_types?.name || 'Отходы'} · ${s.kg} кг</div>
          <div style="font-size:12.5px;color:var(--muted);">${s.profiles?.full_name || 'Пользователь'} · ${new Date(s.submission_date).toLocaleDateString('ru-RU')}</div>
          <div class="mono" style="font-size:14px;color:var(--green-dark);font-weight:700;margin-top:4px;">💎 ${Number(s.reward_gems).toLocaleString('ru-RU')}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" style="padding:8px 14px;" onclick="reviewSubmission('${s.id}','rejected')"><i data-lucide="x" style="width:15px;height:15px;"></i></button>
          <button class="btn btn-primary" style="padding:8px 14px;" onclick="reviewSubmission('${s.id}','approved')"><i data-lucide="check" style="width:15px;height:15px;"></i></button>
        </div>
      </div>`;
  })).then(rows => rows.join(''));
  lucide.createIcons();
}

async function reviewSubmission(id, status) {
  const { error } = await sb.from('submissions').update({ status, reviewed_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast(error.message, 'error'); return; }
  toast(status === 'approved' ? 'Сдача одобрена' : 'Сдача отклонена', 'success');
  loadAdminQueue();
}

/* ---------------------------------------------------------------------- */
/* MAP                                                                      */
/* ---------------------------------------------------------------------- */
function focusLocation(lat, lng) {
  if (leafletMap) { leafletMap.flyTo([lat, lng], 12, { duration: 0.8 }); }
}
function initMap() {
  if (mapInitialized) return;
  mapInitialized = true;
  leafletMap = L.map('map').setView([48.0, 66.0], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(leafletMap);
  const greenIcon = L.divIcon({
    html: `<div style="position:relative;"><div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(16,185,129,.25);animation:pulseRing 2s infinite;"></div><div style="background:#10b981;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.35);"></div></div>`,
    iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -34], className: ''
  });
  locations.forEach(loc => {
    L.marker([loc.lat, loc.lng], { icon: greenIcon }).addTo(leafletMap).bindPopup(`
      <div style="font-family:'Manrope',sans-serif;min-width:160px;">
        <div style="font-weight:700;font-size:14px;color:#1f2937;margin-bottom:4px;">${loc.name}</div>
        <div style="font-size:13px;color:#6b7280;">📍 ${loc.address}</div>
        <div style="font-size:13px;color:#6b7280;">${loc.city}</div>
      </div>`);
  });
}
const style = document.createElement('style');
style.textContent = `@keyframes pulseRing{0%{transform:scale(.6);opacity:.7;}100%{transform:scale(1.6);opacity:0;}}`;
document.head.appendChild(style);

/* ---------------------------------------------------------------------- */
/* INIT                                                                     */
/* ---------------------------------------------------------------------- */
document.getElementById('submission-date').value = new Date().toISOString().split('T')[0];
lucide.createIcons();
window.addEventListener('resize', () => moveIndicator(document.querySelector('.nav-tab.active')));
window.addEventListener('load', () => {
  moveIndicator(document.querySelector('.nav-tab.active'));
  observeReveals();
  animateVisibleCounters();
});
refreshSession();
loadReferenceData();