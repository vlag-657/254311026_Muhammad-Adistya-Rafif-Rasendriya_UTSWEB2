const API = '/api/v1';
const app = document.querySelector('#app');
const accountActions = document.querySelector('#account-actions');
const navigation = document.querySelector('[data-navigation]');
let refreshPromise;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[character]));
const safeUrl = (value) => {
    try {
        const url = new URL(value, location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
        return '';
    }
};
const currentUser = () => {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
        localStorage.removeItem('user');
        return null;
    }
};
const dateLabel = (value) => value ? new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(value)) : 'Baru saja';
const initials = (name = 'Sahabat') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const queryString = (values) => new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null)).toString();

class ApiError extends Error {
    constructor(message, response, payload) {
        super(message);
        this.status = response.status;
        this.details = payload?.error?.details || [];
        this.code = payload?.error?.code;
    }
}

async function deleteAdminQuestion(quizId, questionId) {
    if (!window.confirm('Hapus pertanyaan ini dari kuis?')) return;
    try {
        await apiRequest(`/admin/kuis/${encodeURIComponent(quizId)}/pertanyaan/${encodeURIComponent(questionId)}`, { method: 'DELETE' });
        toast('Pertanyaan berhasil dihapus.');
        loadAdminQuiz(quizId);
    } catch (error) { toast(error.message, true); }
}

async function deleteAdminReply(id) {
    if (!window.confirm('Hapus balasan ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
        await apiRequest(`/admin/forum/balasan/${encodeURIComponent(id)}`, { method: 'DELETE' });
        toast('Balasan berhasil dihapus.');
        route();
    } catch (error) { toast(error.message, true); }
}

function clearSession() {
    ['access_token', 'refresh_token', 'user'].forEach((key) => localStorage.removeItem(key));
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;
    if (!refreshPromise) {
        refreshPromise = fetch(`${API}/auth/refresh`, {
            method: 'POST',
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        }).then(async (response) => {
            const payload = await response.json();
            if (!response.ok || !payload.success) {
                clearSession();
                return false;
            }
            localStorage.setItem('access_token', payload.data.access_token);
            localStorage.setItem('refresh_token', payload.data.refresh_token);
            return true;
        }).catch(() => {
            clearSession();
            return false;
        }).finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

async function apiRequest(path, options = {}, retry = true) {
    const token = localStorage.getItem('access_token');
    const headers = {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };
    const response = await fetch(`${API}${path}`, { ...options, headers });
    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new ApiError('Server memberikan respons yang tidak dapat dibaca.', response, null);
    }
    if (response.status === 401 && retry && path !== '/auth/login' && path !== '/auth/register') {
        if (await refreshAccessToken()) return apiRequest(path, options, false);
        if (!['/login', '/register'].includes(location.pathname)) {
            clearSession();
            location.assign('/login');
        }
    }
    if (!response.ok || payload.success !== true) {
        const message = response.status >= 500
            ? 'Terjadi kesalahan pada server. Silakan coba lagi nanti.'
            : payload.message || 'Permintaan belum berhasil. Silakan coba lagi.';
        throw new ApiError(message, response, payload);
    }
    return payload;
}

function toast(message, isError = false) {
    let region = document.querySelector('.toast-region');
    if (!region) {
        region = document.createElement('div');
        region.className = 'toast-region';
        region.setAttribute('aria-live', 'polite');
        document.body.append(region);
    }
    const item = document.createElement('div');
    item.className = `toast${isError ? ' error' : ''}`;
    item.textContent = message;
    region.append(item);
    window.setTimeout(() => item.remove(), 4200);
}

function setPage(title, content, eyebrow = 'Ruang belajar SDG7') {
    document.title = `${title} — SDG7Learn`;
    app.innerHTML = `<div class="page-wrap"><div class="page-heading"><div><span class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(eyebrow)}</span><h1>${title}</h1></div></div>${content}</div>`;
    app.focus({ preventScroll: true });
}

function showError(error) {
    const message = error instanceof ApiError ? error.message : 'Koneksi bermasalah. Periksa koneksi internet lalu coba lagi.';
    app.innerHTML = `<div class="page-wrap"><div class="empty-state"><strong>Data belum dapat dimuat</strong>${escapeHtml(message)}<p style="margin:16px 0 0"><button class="button button-primary button-small" type="button" data-action="reload">Coba lagi</button></p></div></div>`;
}

function updateHeader() {
    const user = currentUser();
    if (user) {
        const adminLink = user.role === 'admin' ? '<a class="button button-quiet button-small" href="/admin/dashboard">Panel admin</a>' : '';
        accountActions.innerHTML = `${adminLink}<a class="button button-quiet button-small" href="/profil">${escapeHtml(user.nama || 'Profil')}</a><button class="button button-primary button-small" type="button" data-action="logout">Keluar</button>`;
    } else {
        accountActions.innerHTML = '<a class="button button-quiet button-small" href="/login">Masuk</a><a class="button button-primary button-small" href="/register">Daftar gratis <span aria-hidden="true">↗</span></a>';
    }
    document.querySelectorAll('[data-auth-link]').forEach((link) => link.classList.toggle('hidden', !user));
    document.querySelectorAll('[data-nav-link]').forEach((link) => {
        link.classList.toggle('active', location.pathname.startsWith(link.getAttribute('href')));
    });
}

function requireUser() {
    const user = currentUser();
    if (!user) {
        location.assign('/login');
        return false;
    }
    return user;
}

function requireAdmin() {
    const user = requireUser();
    if (!user) return false;
    if (user.role !== 'admin') {
        location.assign('/');
        return false;
    }
    return user;
}

function renderPagination(meta = {}, page = 1, target = 'list') {
    const total = Number(meta.total_pages || 1);
    if (total < 2) return '';
    const start = Math.max(1, page - 2);
    const end = Math.min(total, page + 2);
    return `<nav class="pagination" aria-label="Paginasi">${page > 1 ? `<button type="button" data-page="${page - 1}" data-target="${target}" aria-label="Halaman sebelumnya">‹</button>` : ''}${Array.from({ length: end - start + 1 }, (_, index) => start + index).map((number) => `<button type="button" data-page="${number}" data-target="${target}" class="${number === page ? 'active' : ''}" aria-current="${number === page ? 'page' : 'false'}">${number}</button>`).join('')}${page < total ? `<button type="button" data-page="${page + 1}" data-target="${target}" aria-label="Halaman selanjutnya">›</button>` : ''}</nav>`;
}

function articleCard(article, index = 0) {
    const covers = ['cover-sun', 'cover-wind', 'cover-leaf'];
    const symbols = ['☼', '↝', '✳'];
    const image = safeUrl(article.gambar_url);
    return `<article class="article-card"><a href="/artikel/${encodeURIComponent(article.id)}"><div class="article-cover ${covers[index % covers.length]}">${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover">` : `<span class="cover-symbol" aria-hidden="true">${symbols[index % symbols.length]}</span>`}</div></a><div class="article-body"><span class="tag">Energi bersih</span><h3><a href="/artikel/${encodeURIComponent(article.id)}">${escapeHtml(article.judul || 'Artikel energi bersih')}</a></h3><p>${escapeHtml(article.ringkasan || article.isi || 'Baca wawasan terbaru tentang energi bersih dan terjangkau.')}</p><div class="card-meta"><span>${dateLabel(article.tanggal || article.dibuat_pada)}</span><a class="text-link" href="/artikel/${encodeURIComponent(article.id)}">Baca artikel <span aria-hidden="true">→</span></a></div></div></article>`;
}

function emptyState(title, detail) {
    return `<div class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}</div>`;
}

async function loadHome() {
    app.innerHTML = `
        <section class="hero">
            <div class="hero-copy">
                <span class="eyebrow"><span class="eyebrow-dot"></span>Belajar untuk masa depan berkelanjutan</span>
                <h1>Energi bersih.<br><em>Masa depan cerah.</em></h1>
                <p>Temukan cara energi terbarukan mengubah dunia. Belajar, uji wawasanmu, dan tumbuh bersama komunitas peduli energi.</p>
                <div class="hero-buttons"><a class="button button-primary" href="/artikel">Jelajahi pembelajaran <span aria-hidden="true">↗</span></a><a class="button button-quiet" href="${currentUser() ? '/kuis' : '/register'}">Mulai belajar</a></div>
                <div class="hero-footnote"><span class="avatar-stack" aria-hidden="true"><i>A</i><i>N</i><i>R</i></span>Belajar bareng, dampaknya terasa bersama</div>
            </div>
            <div class="hero-art" aria-label="Ilustrasi energi terbarukan">
                <div class="sun-orbit"></div><div class="sun-core"><svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="9" fill="currentColor"/><path d="M24 2v7m0 30v7M2 24h7m30 0h7M8.4 8.4l5 5m21.2 21.2 5 5m0-31.2-5 5M13.4 34.6l-5 5" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg></div>
                <div class="windmill"><span class="tower"></span><span class="hub"></span><span class="blade"></span><span class="blade"></span><span class="blade"></span></div><div class="hill"></div><div class="solar-panel"></div>
                <div class="art-pill art-pill-one"><span>☀</span><span><strong>Energi</strong><br>terbarukan</span></div><div class="art-pill art-pill-two"><span>↗</span><span><strong>SDG 7</strong><br>Energi untuk semua</span></div>
            </div>
        </section>
        <section class="container section"><div class="section-heading"><div><span class="tag">Baca & temukan</span><h2>Pengetahuan yang<br>menginspirasi aksi.</h2><p>Wawasan praktis tentang energi yang lebih bersih dan terjangkau.</p></div><a class="text-link" href="/artikel">Lihat semua artikel <span aria-hidden="true">→</span></a></div><div class="article-grid" id="featured-articles">${emptyState('Memuat artikel terbaru...', 'Sebentar ya, kami sedang menyiapkan bacaan untukmu.')}</div></section>
        <section class="container"><div class="stats-strip"><div class="stat-item"><strong>01</strong><span>Satu tujuan, SDG 7</span></div><div class="stat-item"><strong>24/7</strong><span>Belajar kapan saja</span></div><div class="stat-item"><strong>100%</strong><span>Gratis untuk belajar</span></div><div class="stat-item"><strong>∞</strong><span>Ide untuk masa depan</span></div></div></section>
        <section class="container section"><div class="section-heading"><div><span class="tag">Belajar dengan cara berbeda</span><h2>Dari rasa ingin tahu<br>jadi perubahan.</h2></div></div><div class="feature-grid"><article class="feature-card"><span class="feature-icon">▤</span><h3>Artikel pilihan</h3><p>Pahami isu energi lewat bacaan yang ringkas, relevan, dan mudah diikuti.</p></article><article class="feature-card"><span class="feature-icon">✓</span><h3>Kuis interaktif</h3><p>Uji pemahamanmu dan lihat progres belajar dari waktu ke waktu.</p></article><article class="feature-card"><span class="feature-icon">☷</span><h3>Komunitas terbuka</h3><p>Tukar gagasan, bertanya, dan berbagi inspirasi di forum diskusi.</p></article></div>
            <div class="cta-panel"><div><h2>Setiap langkah kecil punya arti.</h2><p>Mulai perjalanan belajarmu tentang energi bersih hari ini.</p></div><a class="button" href="${currentUser() ? '/kuis' : '/register'}">Gabung sekarang <span aria-hidden="true">↗</span></a></div>
        </section>`;
    try {
        const response = await apiRequest('/artikel?limit=3&sort=-tanggal');
        const articles = response.data || [];
        document.querySelector('#featured-articles').innerHTML = articles.length
            ? articles.map(articleCard).join('')
            : emptyState('Belum ada artikel', 'Artikel baru akan segera hadir di sini.');
    } catch (error) {
        document.querySelector('#featured-articles').innerHTML = emptyState('Artikel belum tersedia', error.message);
    }
}

async function loadArticles(page = 1, search = '') {
    setPage('Jelajahi artikel', '<div class="toolbar"><form class="search-box" data-search="articles"><input class="field" name="q" value="' + escapeHtml(search) + '" placeholder="Cari topik energi..." aria-label="Cari artikel"></form></div><div class="article-grid" id="article-list"><div class="empty-state">Memuat artikel...</div></div><div id="article-pages"></div>', 'Wawasan energi');
    try {
        const response = await apiRequest(`/artikel?${queryString({ page, limit: 9, q: search, sort: '-tanggal' })}`);
        document.querySelector('#article-list').innerHTML = response.data.length
            ? response.data.map(articleCard).join('')
            : emptyState('Belum ada artikel yang cocok', search ? 'Coba kata kunci lain atau hapus pencarian.' : 'Artikel baru akan segera hadir.');
        document.querySelector('#article-pages').innerHTML = renderPagination(response.meta, page, 'articles');
    } catch (error) { showError(error); }
}

async function loadArticle(id) {
    app.innerHTML = '<div class="page-wrap"><div class="empty-state">Memuat artikel...</div></div>';
    try {
        const response = await apiRequest(`/artikel/${encodeURIComponent(id)}`);
        const article = response.data;
        document.title = `${article.judul} — SDG7Learn`;
        const image = safeUrl(article.gambar_url);
        const source = safeUrl(article.sumber);
        app.innerHTML = `<article class="page-wrap"><a class="text-link" href="/artikel">← Kembali ke artikel</a><div class="detail-panel" style="margin-top:20px"><div class="detail-cover">${image ? `<img src="${escapeHtml(image)}" alt="" style="width:100%;height:230px;object-fit:cover;border-radius:18px 18px 0 0">` : ''}</div><span class="tag">Energi bersih · ${dateLabel(article.tanggal || article.dibuat_pada)}</span><h1>${escapeHtml(article.judul)}</h1>${source ? `<p><a class="text-link" href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Lihat sumber ↗</a></p>` : ''}<div class="detail-copy">${escapeHtml(article.isi || '')}</div></div></article>`;
    } catch (error) { showError(error); }
}

function authPage(register = false) {
    document.title = `${register ? 'Buat akun' : 'Masuk'} — SDG7Learn`;
    const fields = register
        ? `<div class="form-field"><label for="nama">Nama lengkap</label><input class="field" id="nama" name="nama" autocomplete="name" required placeholder="Nama kamu"><small class="field-error" data-error="nama"></small></div>`
        : '';
    const extras = register
        ? `<div class="form-field"><label for="pekerjaan">Pekerjaan <span style="font-weight:400;color:#929b8e">(opsional)</span></label><input class="field" id="pekerjaan" name="pekerjaan" placeholder="Contoh: Mahasiswa"></div><div class="form-field"><label for="usia">Usia <span style="font-weight:400;color:#929b8e">(opsional)</span></label><input class="field" id="usia" name="usia" type="number" min="10" max="100" placeholder="Usia kamu"></div>`
        : '';
    app.innerHTML = `<div class="container auth-layout"><section class="auth-aside"><span class="eyebrow"><span class="eyebrow-dot"></span>Ruang untuk bertumbuh</span><h1>${register ? 'Satu langkah kecil menuju perubahan.' : 'Senang melihatmu kembali.'}</h1><p>${register ? 'Buat akun gratis untuk ikut kuis, berbagi ide, dan melanjutkan perjalanan belajar energi bersih.' : 'Masuk untuk melanjutkan belajar dan melihat progresmu di SDG7Learn.'}</p><div class="auth-quote">“Akses energi yang terjangkau, andal, berkelanjutan, dan modern untuk semua.”<br><strong>— Tujuan Pembangunan Berkelanjutan 7</strong></div></section><section class="auth-card"><h2>${register ? 'Mulai perjalananmu' : 'Masuk ke akun'}</h2><p>${register ? 'Bergabung dengan komunitas belajar energi bersih.' : 'Masukkan detail akun untuk melanjutkan.'}</p><form class="form-stack" data-form="${register ? 'register' : 'login'}"><div class="form-alert" data-form-alert hidden></div>${fields}<div class="form-field"><label for="email">Email</label><input class="field" id="email" name="email" type="email" autocomplete="email" required placeholder="nama@email.com"><small class="field-error" data-error="email"></small></div><div class="form-field"><label for="password">Kata sandi</label><input class="field" id="password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="${register ? 8 : 1}" required placeholder="${register ? 'Minimal 8 karakter' : 'Masukkan kata sandi'}"><small class="field-error" data-error="password"></small></div>${register ? `<div class="form-field"><label for="password_confirmation">Konfirmasi kata sandi</label><input class="field" id="password_confirmation" name="password_confirmation" type="password" autocomplete="new-password" required placeholder="Ulangi kata sandi"><small class="field-error" data-error="password_confirmation"></small></div>${extras}` : ''}<button class="button button-primary button-block" type="submit">${register ? 'Buat akun gratis' : 'Masuk'} <span aria-hidden="true">→</span></button><p class="form-note">${register ? 'Sudah punya akun?' : 'Belum punya akun?'} <a href="${register ? '/login' : '/register'}">${register ? 'Masuk di sini' : 'Daftar gratis'}</a></p></form></section></div>`;
}

function fieldErrors(form, details = []) {
    form.querySelectorAll('[data-error]').forEach((element) => { element.textContent = ''; });
    const alert = form.querySelector('[data-form-alert]');
    if (alert) { alert.hidden = true; alert.textContent = ''; }
    details.forEach(({ field, message }) => {
        const target = form.querySelector(`[data-error="${CSS.escape(field)}"]`);
        if (target) target.textContent = message;
        else if (alert) { alert.hidden = false; alert.textContent = message; }
    });
}

async function submitAuth(form, register) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!register) delete data.password_confirmation;
    if (data.usia === '') delete data.usia;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Mohon tunggu...';
    fieldErrors(form);
    try {
        const response = await apiRequest(`/auth/${register ? 'register' : 'login'}`, {
            method: 'POST', body: JSON.stringify(data),
        }, false);
        localStorage.setItem('access_token', response.data.access_token);
        localStorage.setItem('refresh_token', response.data.refresh_token);
        localStorage.setItem('user', JSON.stringify(response.data.pengguna));
        location.assign(response.data.pengguna.role === 'admin' ? '/admin/dashboard' : '/');
    } catch (error) {
        fieldErrors(form, error.details);
        const alert = form.querySelector('[data-form-alert]');
        if (alert && !error.details.length) { alert.hidden = false; alert.textContent = error.message; }
        button.disabled = false;
        button.textContent = register ? 'Buat akun gratis →' : 'Masuk →';
    }
}

async function loadQuizzes(page = 1, search = '') {
    if (!requireUser()) return;
    setPage('Kuis interaktif', '<div class="toolbar"><form class="search-box" data-search="quizzes"><input class="field" name="q" value="' + escapeHtml(search) + '" placeholder="Cari kuis..." aria-label="Cari kuis"></form></div><div class="quiz-grid" id="quiz-list"><div class="empty-state">Memuat kuis...</div></div><div id="quiz-pages"></div>', 'Uji pemahamanmu');
    try {
        const response = await apiRequest(`/kuis?${queryString({ page, limit: 9, q: search, sort: '-dibuat_pada' })}`);
        const quizzes = response.data || [];
        document.querySelector('#quiz-list').innerHTML = quizzes.length ? quizzes.map((quiz) => `<article class="content-card"><span class="badge">${quiz.jumlah_pertanyaan || quiz.pertanyaan?.length || 0} pertanyaan</span><h3>${escapeHtml(quiz.judul || 'Kuis energi')}</h3><p>${escapeHtml(quiz.deskripsi || 'Uji pengetahuanmu tentang energi bersih dan terjangkau.')}</p>${quiz.sudah_dikerjakan ? `<span class="badge badge-warm">Sudah dikerjakan${quiz.skor_terbaik != null ? ` · Skor terbaik ${escapeHtml(quiz.skor_terbaik)}` : ''}</span><br>` : ''}<div class="card-meta"><span>Belajar sambil mencoba</span><a class="text-link" href="/kuis/${encodeURIComponent(quiz.id)}">Mulai kuis →</a></div></article>`).join('') : emptyState('Belum ada kuis', 'Coba kata kunci lain atau kunjungi lagi nanti.');
        document.querySelector('#quiz-pages').innerHTML = renderPagination(response.meta, page, 'quizzes');
    } catch (error) { showError(error); }
}

async function loadQuiz(id) {
    if (!requireUser()) return;
    app.innerHTML = '<div class="page-wrap"><div class="empty-state">Menyiapkan kuis...</div></div>';
    try {
        const response = await apiRequest(`/kuis/${encodeURIComponent(id)}`);
        const quiz = response.data;
        document.title = `${quiz.judul} — SDG7Learn`;
        const questions = quiz.pertanyaan || [];
        app.innerHTML = `<div class="page-wrap"><a class="text-link" href="/kuis">← Semua kuis</a><div class="page-heading" style="margin-top:18px"><div><span class="eyebrow"><span class="eyebrow-dot"></span>${questions.length} pertanyaan</span><h1>${escapeHtml(quiz.judul)}</h1><p>${escapeHtml(quiz.deskripsi || 'Pilih jawaban yang paling tepat untuk setiap pertanyaan.')}</p></div></div><form class="quiz-form" data-form="quiz" data-quiz-id="${escapeHtml(id)}">${questions.map((question, index) => `<fieldset class="question-card"><legend class="question-number">Pertanyaan ${index + 1} · ${escapeHtml(question.poin || 0)} poin</legend><h3>${escapeHtml(question.teks || question.pertanyaan || '')}</h3>${(question.opsi || []).map((option) => `<label class="option-label"><input type="radio" name="question-${escapeHtml(question.id)}" value="${escapeHtml(option.id)}"><span>${escapeHtml(option.teks || '')}</span></label>`).join('')}</fieldset>`).join('') || emptyState('Kuis belum memiliki pertanyaan', 'Pilih kuis lain untuk mulai belajar.')}<button class="button button-primary" type="submit" ${questions.length ? '' : 'disabled'}>Kirim jawaban <span aria-hidden="true">→</span></button></form></div>`;
    } catch (error) { showError(error); }
}

async function submitQuiz(form) {
    const answers = [...form.querySelectorAll('.question-card')].map((card) => {
        const checked = card.querySelector('input:checked');
        const questionId = card.querySelector('input')?.name.replace('question-', '');
        return { pertanyaan_id: Number(questionId), opsi_id: checked ? Number(checked.value) : null };
    });
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
        const response = await apiRequest(`/kuis/${encodeURIComponent(form.dataset.quizId)}/percobaan`, {
            method: 'POST', body: JSON.stringify({ jawaban: answers }),
        });
        location.assign(`/hasil-kuis/${encodeURIComponent(response.data.id)}`);
    } catch (error) {
        toast(error.message, true);
        button.disabled = false;
    }
}

async function loadResults(page = 1) {
    if (!requireUser()) return;
    setPage('Perjalanan belajarmu', '<div class="panel"><div class="panel-heading"><h2>Riwayat kuis</h2><span class="badge">Progres belajar</span></div><div class="table-wrap"><table><thead><tr><th>Kuis</th><th>Skor</th><th>Nilai</th><th>Tanggal</th><th></th></tr></thead><tbody id="result-rows"><tr><td colspan="5">Memuat hasil...</td></tr></tbody></table></div><div id="result-pages"></div></div>', 'Hasil belajar');
    try {
        const response = await apiRequest(`/hasil-kuis?${queryString({ page, limit: 10, sort: '-dikerjakan_pada' })}`);
        const rows = response.data || [];
        document.querySelector('#result-rows').innerHTML = rows.length ? rows.map((result) => `<tr><td>${escapeHtml(result.kuis?.judul || result.judul || `Kuis #${result.kuis_id || result.id}`)}</td><td>${escapeHtml(result.skor)} / ${escapeHtml(result.skor_maks)}</td><td><span class="badge">${escapeHtml(result.persentase ?? Math.round((result.skor / (result.skor_maks || 1)) * 100))}%</span></td><td>${dateLabel(result.dikerjakan_pada)}</td><td><a class="text-link" href="/hasil-kuis/${encodeURIComponent(result.id)}">Tinjau →</a></td></tr>`).join('') : '<tr><td colspan="5">Belum ada hasil kuis. Pilih kuis untuk memulai perjalanan belajarmu.</td></tr>';
        document.querySelector('#result-pages').innerHTML = renderPagination(response.meta, page, 'results');
    } catch (error) { showError(error); }
}

async function loadResult(id) {
    if (!requireUser()) return;
    app.innerHTML = '<div class="page-wrap"><div class="empty-state">Memuat ringkasan hasil...</div></div>';
    try {
        const response = await apiRequest(`/hasil-kuis/${encodeURIComponent(id)}`);
        const result = response.data;
        const percent = result.persentase ?? Math.round((result.skor / (result.skor_maks || 1)) * 100);
        app.innerHTML = `<div class="page-wrap"><a class="text-link" href="/hasil-kuis">← Riwayat kuis</a><div class="page-heading" style="margin-top:18px"><div><span class="eyebrow"><span class="eyebrow-dot"></span>Hasil belajarmu</span><h1>${escapeHtml(result.kuis?.judul || result.judul || 'Ringkasan kuis')}</h1></div></div><div class="split-layout"><section><div class="quiz-result"><span>Skor akhir</span><strong>${escapeHtml(result.skor)} <small style="font-size:18px;color:#c5d6c6">/ ${escapeHtml(result.skor_maks)}</small></strong><span>${escapeHtml(percent)}% · ${escapeHtml(result.jumlah_benar ?? '')} jawaban benar dari ${escapeHtml(result.jumlah_pertanyaan ?? '')} pertanyaan</span></div><div class="panel" style="margin-top:16px"><div class="panel-heading"><h2>Tinjauan jawaban</h2></div>${(result.tinjauan || []).map((item, index) => `<div class="result-review"><span class="question-number">Pertanyaan ${index + 1} · ${item.opsi_dipilih_id === item.opsi_benar_id ? 'Benar' : 'Pelajari lagi'}</span><h3>${escapeHtml(item.teks || item.pertanyaan || '')}</h3><p>Jawabanmu: ${escapeHtml(item.opsi_dipilih || item.opsi_dipilih_teks || 'Tidak dijawab')}</p><p>Jawaban benar: ${escapeHtml(item.opsi_benar || item.opsi_benar_teks || '—')}</p>${item.penjelasan ? `<p>${escapeHtml(item.penjelasan)}</p>` : ''}</div>`).join('') || '<p class="form-note">Tinjauan belum tersedia.</p>'}</div></section><aside class="sidebar-card"><h3>Terus bertumbuh</h3><p style="color:var(--muted);font-size:12px;line-height:1.7">Setiap percobaan adalah kesempatan untuk memahami energi bersih lebih baik.</p><a class="button button-primary button-block" href="/kuis">Coba kuis lainnya →</a></aside></div></div>`;
    } catch (error) { showError(error); }
}

async function loadForum(page = 1, search = '') {
    if (!requireUser()) return;
    setPage('Ruang diskusi', `<div class="toolbar"><form class="search-box" data-search="forum"><input class="field" name="q" value="${escapeHtml(search)}" placeholder="Cari diskusi..." aria-label="Cari diskusi"></form><a class="button button-primary button-small" href="/forum/buat">+ Buat postingan</a></div><div class="panel"><div id="forum-list"><div class="empty-state">Memuat percakapan...</div></div><div id="forum-pages"></div></div>`, 'Belajar bersama');
    try {
        const response = await apiRequest(`/forum/postingan?${queryString({ page, limit: 10, q: search, sort: '-tanggal' })}`);
        const posts = response.data || [];
        document.querySelector('#forum-list').innerHTML = posts.length ? posts.map((post) => `<article class="post-card"><div class="post-author"><span class="avatar">${escapeHtml(initials(post.penulis?.nama || 'U'))}</span><span>${escapeHtml(post.penulis?.nama || 'Pengguna')} · ${dateLabel(post.tanggal)}</span><span class="badge badge-blue">${Number(post.jumlah_balasan || 0)} balasan</span></div><h3><a href="/forum/${encodeURIComponent(post.id)}">${escapeHtml(post.judul || 'Diskusi')}</a></h3><p>${escapeHtml(post.ringkasan || post.isi || '')}</p><a class="text-link" href="/forum/${encodeURIComponent(post.id)}">Ikuti diskusi →</a></article>`).join('') : emptyState('Belum ada diskusi', 'Jadilah yang pertama berbagi pertanyaan atau ide tentang energi bersih.');
        document.querySelector('#forum-pages').innerHTML = renderPagination(response.meta, page, 'forum');
    } catch (error) { showError(error); }
}

function createPostPage() {
    if (!requireUser()) return;
    setPage('Mulai percakapan', '<div class="panel" style="max-width:740px"><form class="form-stack" data-form="post"><div class="form-alert" data-form-alert hidden></div><div class="form-field"><label for="judul">Judul diskusi</label><input class="field" id="judul" name="judul" required maxlength="255" placeholder="Apa yang ingin kamu bahas?"><small class="field-error" data-error="judul"></small></div><div class="form-field"><label for="isi">Ceritakan lebih lanjut</label><textarea class="text-field" id="isi" name="isi" required placeholder="Bagikan pertanyaan, pengalaman, atau gagasanmu..."></textarea><small class="field-error" data-error="isi"></small></div><div><button class="button button-primary" type="submit">Terbitkan diskusi →</button></div></form></div>', 'Forum komunitas');
}

async function loadPost(id) {
    if (!requireUser()) return;
    app.innerHTML = '<div class="page-wrap"><div class="empty-state">Memuat diskusi...</div></div>';
    try {
        const [postResponse, repliesResponse] = await Promise.all([
            apiRequest(`/forum/postingan/${encodeURIComponent(id)}`),
            apiRequest(`/forum/postingan/${encodeURIComponent(id)}/balasan?sort=tanggal`),
        ]);
        const post = postResponse.data;
        const replies = repliesResponse.data || [];
        app.innerHTML = `<div class="page-wrap"><a class="text-link" href="/forum">← Kembali ke forum</a><div class="split-layout" style="margin-top:18px"><section><article class="detail-panel"><div class="post-author"><span class="avatar">${escapeHtml(initials(post.penulis?.nama || 'U'))}</span><span>${escapeHtml(post.penulis?.nama || 'Pengguna')} · ${dateLabel(post.tanggal)}</span></div><h1>${escapeHtml(post.judul)}</h1><div class="detail-copy">${escapeHtml(post.isi || '')}</div></article><div class="panel" style="margin-top:16px"><div class="panel-heading"><h2>Balasan (${replies.length})</h2></div>${replies.map((reply) => `<article class="reply-card"><div class="post-author"><span class="avatar">${escapeHtml(initials(reply.penulis?.nama || 'U'))}</span><span>${escapeHtml(reply.penulis?.nama || 'Pengguna')} · ${dateLabel(reply.tanggal)}</span></div><p>${escapeHtml(reply.isi || '')}</p></article>`).join('') || '<p class="form-note">Belum ada balasan. Mulai percakapan yang hangat.</p>'}<form class="form-stack" data-form="reply" data-post-id="${escapeHtml(id)}" style="margin-top:18px"><div class="form-field"><label for="isi">Tulis balasan</label><textarea class="text-field" id="isi" name="isi" required placeholder="Tambahkan pemikiranmu..."></textarea><small class="field-error" data-error="isi"></small></div><button class="button button-primary" type="submit">Kirim balasan →</button></form></div></section><aside class="sidebar-card"><h3>Diskusi terbuka</h3><p style="color:var(--muted);font-size:12px;line-height:1.7">Saling menghargai dan berbagi sumber tepercaya membantu semua orang belajar.</p></aside></div></div>`;
    } catch (error) { showError(error); }
}

async function loadProfile() {
    if (!requireUser()) return;
    setPage('Profil saya', '<div class="profile-layout"><div class="profile-summary"><div class="profile-avatar" id="profile-initials">S</div><h2 id="profile-name">Memuat profil...</h2><p id="profile-email"></p></div><div><section class="panel"><div class="panel-heading"><h2>Informasi akun</h2></div><form class="form-stack" data-form="profile"><div class="form-alert" data-form-alert hidden></div><div class="form-field"><label for="nama">Nama lengkap</label><input class="field" id="nama" name="nama" required><small class="field-error" data-error="nama"></small></div><div class="form-field"><label for="pekerjaan">Pekerjaan</label><input class="field" id="pekerjaan" name="pekerjaan"><small class="field-error" data-error="pekerjaan"></small></div><div class="form-field"><label for="usia">Usia</label><input class="field" id="usia" name="usia" type="number" min="10" max="100"><small class="field-error" data-error="usia"></small></div><button class="button button-primary" type="submit">Simpan perubahan</button></form></section><section class="panel"><div class="panel-heading"><h2>Ubah kata sandi</h2></div><form class="form-stack" data-form="password"><div class="form-alert" data-form-alert hidden></div><div class="form-field"><label for="password_lama">Kata sandi saat ini</label><input class="field" id="password_lama" name="password_lama" type="password" required autocomplete="current-password"><small class="field-error" data-error="password_lama"></small></div><div class="form-field"><label for="password_baru">Kata sandi baru</label><input class="field" id="password_baru" name="password_baru" type="password" required minlength="8" autocomplete="new-password"><small class="field-error" data-error="password_baru"></small></div><div class="form-field"><label for="password_baru_confirmation">Konfirmasi kata sandi baru</label><input class="field" id="password_baru_confirmation" name="password_baru_confirmation" type="password" required autocomplete="new-password"><small class="field-error" data-error="password_baru_confirmation"></small></div><button class="button button-quiet" type="submit">Perbarui kata sandi</button></form></section></div></div>', 'Akunmu');
    try {
        const response = await apiRequest('/profil');
        const profile = response.data;
        document.querySelector('#profile-name').textContent = profile.nama || '';
        document.querySelector('#profile-email').textContent = profile.email || '';
        document.querySelector('#profile-initials').textContent = initials(profile.nama);
        const form = document.querySelector('[data-form="profile"]');
        ['nama', 'pekerjaan', 'usia'].forEach((key) => { form.elements[key].value = profile[key] ?? ''; });
    } catch (error) { showError(error); }
}

// // Contoh fungsi router di app.js
// function router() {
//     const path = window.location.pathname;

//     if (path === '/' || path === '') {
//         loadHome();
//     } else if (path === '/artikel' || path.startsWith('/artikel/')) {
//         // ... penanganan artikel ...
//     } else if (path === '/kuis' || path.startsWith('/kuis/')) {
//         // ... penanganan kuis ...
//     } else if (path === '/forum' || path.startsWith('/forum/')) {
//         // ... penanganan forum ...
//     } 
//     // ---- TAMBAHKAN BLOK INI UNTUK REVIEW ----
//     else if (path === '/review') {
//         loadReview();
//     } else if (path === '/review/post') {
//         loadReviewForm(); // atau fungsi form buat review Anda
//     } else if (path.startsWith('/review/')) {
//         const id = path.split('/')[2];
//         loadReviewDetail(id);
//     } 
//     // ----------------------------------------
//     else {
//         showNotFound404(); // Fungsi penampil 404 milik app.js
//     }
// }

async function loadReview(page = 1, search = '') {
    if (!requireUser()) returssn;
    // Di dalam function loadReview(...):
    setPage(
        'Review User', 
        `<div class="toolbar">
            <form class="search-box" data-search="reviews">
                <input class="field" name="q" value="${escapeHtml(search)}" placeholder="Cari review..." aria-label="Cari review">
            </form>
         </div>
         <div class="review-grid" id="review-list">
            <div class="empty-state">Memuat review...</div>
         </div>
         <div id="review-pages"></div>
         <div style="margin-top: 20px;">
            <a href="/review/post" class="button button-primary">Buat review baru</a>
        </div>`, 
        'review user'
    );   try {
        const response = await apiRequest(`/review?${queryString({ page, limit: 9, q: search, sort: '-dibuat_pada' })}`);
        const reviews = response.data || [];
        document.querySelector('#review-list').innerHTML = reviews.length ? reviews.map((review) => `<article class="content-card"><h3>${escapeHtml(review.judul || 'Review')}</h3><p>${escapeHtml(review.isi || 'Uji pengetahuanmu tentang energi bersih dan terjangkau.')}</p><div class="card-meta"><span>Ditulis oleh ${escapeHtml(review.penulis?.nama || 'Pengguna')}</span><a class="text-link" href="/review/${encodeURIComponent(review.id)}">Baca selengkapnya →</a></div></article>`).join('') : emptyState('Belum ada review', 'Coba kata kunci lain atau kunjungi lagi nanti.');
        document.querySelector('#review-pages').innerHTML = renderPagination(response.meta, page, 'reviews');
    } catch (error) { showError(error); }
}

async function loadReviewDetail(id) {
    if (!requireUser()) return;
    app.innerHTML = '<div class="page-wrap"><div class="empty-state">Memuat review...</div></div>';
    try {
        const response = await apiRequest(`/review/${encodeURIComponent(id)}`);
        const review = response.data;
        document.title = `${review.judul} — SDG7Learn`;
        app.innerHTML = `<div class="page-wrap"><a class="text-link" href="/review">← Semua review</a><div class="page-heading" style="margin-top:18px"><div><span class="eyebrow"><span class="eyebrow-dot"></span>Review</span><h1>${escapeHtml(review.judul || 'Review')}</h1><p>${escapeHtml(review.isi || '')}</p></div></div></div>`;
    } catch (error) { showError(error); }
}

async function submitreview(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
        const response = await apiRequest('/review', {
            method: 'POST', body: JSON.stringify(data),
        });
        location.assign(`/review/${encodeURIComponent(response.data.id)}`);
    } catch (error) {
        fieldErrors(form, error.details);
        const alert = form.querySelector('[data-form-alert]');
        if (alert && !error.details.length) { alert.hidden = false; alert.textContent = error.message; }
        button.disabled = false;
    }
}


async function deletereview(id) {
    if (!requireUser()) return;
    if (!confirm('Apakah kamu yakin ingin menghapus review ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
        await apiRequest(`/review/${encodeURIComponent(id)}`, { method: 'DELETE' });
        toast('Review berhasil dihapus.');
        location.assign('/review');
    } catch (error) {
        toast(error.message, true);
    }
}

function adminNav(active) {
    const items = [
        ['dashboard', 'Ringkasan', '/admin/dashboard'],
        ['artikel', 'Artikel', '/admin/artikel'],
        ['kuis', 'Kuis', '/admin/kuis'],
        ['forum', 'Forum', '/admin/forum'],
        ['pengguna', 'Pengguna', '/admin/pengguna'],
    ];
    return `<nav class="admin-tabs">${items.map(([key, label, href]) => `<a class="${active === key ? 'active' : ''}" href="${href}">${label}</a>`).join('')}</nav>`;
}

async function loadAdminDashboard() {
    if (!requireAdmin()) return;
    setPage('Ringkasan admin', `${adminNav('dashboard')}<div class="metric-grid" id="admin-metrics"><div class="metric-card">Memuat ringkasan...</div></div><div class="panel"><div class="panel-heading"><h2>Kelola platform</h2></div><div class="feature-grid"><a class="feature-card" href="/admin/artikel"><span class="feature-icon">▤</span><h3>Kelola artikel</h3><p>Perbarui konten bacaan dan referensi.</p></a><a class="feature-card" href="/admin/kuis"><span class="feature-icon">✓</span><h3>Kelola kuis</h3><p>Atur pertanyaan dan pantau hasil belajar.</p></a><a class="feature-card" href="/admin/pengguna"><span class="feature-icon">♧</span><h3>Kelola pengguna</h3><p>Lihat anggota dan aktivitas komunitas.</p></a></div></div>`, 'Panel administrator');
    const endpoints = [['Artikel', '/artikel?limit=1'], ['Kuis', '/admin/kuis?limit=1'], ['Pengguna', '/admin/pengguna?limit=1'], ['Diskusi', '/admin/forum/postingan?limit=1']];
    try {
        const values = await Promise.all(endpoints.map(async ([label, url]) => {
            const result = await apiRequest(url);
            return `<div class="metric-card"><span>${label} terdata</span><strong>${escapeHtml(result.meta?.total_items ?? result.data?.length ?? 0)}</strong></div>`;
        }));
        document.querySelector('#admin-metrics').innerHTML = values.join('');
    } catch (error) {
        document.querySelector('#admin-metrics').innerHTML = `<div class="notice">${escapeHtml(error.message)}</div>`;
    }
}

async function loadAdminList(section, page = 1, search = '') {
    if (!requireAdmin()) return;
    const configs = {
        artikel: { title: 'Kelola artikel', endpoint: `/artikel?${queryString({ page, limit: 10, q: search, sort: '-tanggal' })}`, columns: ['Judul', 'Tanggal', 'Sumber'], fields: ['judul', 'tanggal', 'sumber'] },
        kuis: { title: 'Kelola kuis', endpoint: `/admin/kuis?${queryString({ page, limit: 10, q: search, sort: '-dibuat_pada' })}`, columns: ['Judul', 'Pertanyaan', 'Dibuat'], fields: ['judul', 'jumlah_pertanyaan', 'dibuat_pada'] },
        forum: { title: 'Moderasi forum', endpoint: `/admin/forum/postingan?${queryString({ page, limit: 10, q: search, sort: '-tanggal' })}`, columns: ['Topik', 'Penulis', 'Balasan'], fields: ['judul', 'penulis.nama', 'jumlah_balasan'] },
        pengguna: { title: 'Kelola pengguna', endpoint: `/admin/pengguna?${queryString({ page, limit: 10, q: search, sort: '-dibuat_pada' })}`, columns: ['Nama', 'Email', 'Peran', 'Terdaftar'], fields: ['nama', 'email', 'role', 'dibuat_pada'] },
    };
    const config = configs[section];
    setPage(config.title, `${adminNav(section)}<div class="toolbar"><form class="search-box" data-search="admin-${section}"><input class="field" name="q" value="${escapeHtml(search)}" placeholder="Cari ${section === 'pengguna' ? 'nama atau email' : section}..." aria-label="Cari ${section}"></form>${section === 'artikel' || section === 'kuis' ? `<button class="button button-primary button-small" type="button" data-action="add-${section}">+ Tambah ${section === 'artikel' ? 'artikel' : 'kuis'}</button>` : ''}</div><div class="panel"><div class="table-wrap"><table><thead><tr>${config.columns.map((column) => `<th>${column}</th>`).join('')}<th>Aksi</th></tr></thead><tbody id="admin-rows"><tr><td colspan="${config.columns.length + 1}">Memuat data...</td></tr></tbody></table></div><div id="admin-pages"></div></div>`, 'Panel administrator');
    try {
        const response = await apiRequest(config.endpoint);
        const rows = response.data || [];
        const valueAt = (object, field) => field.split('.').reduce((value, part) => value?.[part], object);
        document.querySelector('#admin-rows').innerHTML = rows.length ? rows.map((item) => {
            const id = escapeHtml(item.id);
            const actions = {
                artikel: `<button type="button" data-action="edit-artikel" data-id="${id}">Edit</button><button class="delete" type="button" data-action="delete-artikel" data-id="${id}">Hapus</button>`,
                kuis: `<a href="/admin/kuis/${encodeURIComponent(item.id)}">Detail</a><button class="delete" type="button" data-action="delete-kuis" data-id="${id}">Hapus</button>`,
                forum: `<a href="/admin/forum/${encodeURIComponent(item.id)}">Balasan</a><button class="delete" type="button" data-action="delete-forum" data-id="${id}">Hapus</button>`,
                pengguna: `<a href="/admin/pengguna/${encodeURIComponent(item.id)}">Detail</a>`,
            }[section];
            const cells = config.fields.map((field) => `<td>${escapeHtml(field.includes('tanggal') || field.includes('dibuat') ? dateLabel(valueAt(item, field)) : valueAt(item, field) ?? '—')}</td>`).join('');
            return `<tr>${cells}<td><div class="table-actions">${actions}</div></td></tr>`;
        }).join('') : `<tr><td colspan="${config.columns.length + 1}">Tidak ada data yang cocok.</td></tr>`;
        document.querySelector('#admin-pages').innerHTML = renderPagination(response.meta, page, `admin-${section}`);
    } catch (error) { showError(error); }
}

function showAdminForm(type, item = null) {
    const isArticle = type === 'artikel';
    const editing = Boolean(item);
    const isQuizEdit = type === 'kuis-edit';
    const isQuestion = type === 'question';
    const fields = isArticle
        ? `<div class="form-field"><label for="judul">Judul</label><input class="field" id="judul" name="judul" required maxlength="255" value="${escapeHtml(item?.judul || '')}"><small class="field-error" data-error="judul"></small></div><div class="form-field"><label for="isi">Isi artikel</label><textarea class="text-field" id="isi" name="isi" required>${escapeHtml(item?.isi || '')}</textarea><small class="field-error" data-error="isi"></small></div><div class="form-field"><label for="sumber">URL sumber</label><input class="field" id="sumber" name="sumber" type="url" value="${escapeHtml(item?.sumber || '')}"><small class="field-error" data-error="sumber"></small></div><div class="form-field"><label for="gambar_url">URL gambar</label><input class="field" id="gambar_url" name="gambar_url" type="url" value="${escapeHtml(item?.gambar_url || '')}"><small class="field-error" data-error="gambar_url"></small></div>`
        : isQuizEdit
            ? `<div class="form-field"><label for="judul">Judul kuis</label><input class="field" id="judul" name="judul" required value="${escapeHtml(item?.judul || '')}"></div><div class="form-field"><label for="deskripsi">Deskripsi</label><textarea class="text-field" id="deskripsi" name="deskripsi">${escapeHtml(item?.deskripsi || '')}</textarea></div>`
            : isQuestion
                ? `<div class="form-field"><label for="teks">Pertanyaan</label><textarea class="text-field" id="teks" name="teks" required placeholder="Tulis pertanyaan...">${escapeHtml(item?.teks || '')}</textarea><small class="field-error" data-error="teks"></small></div><div class="form-field"><label for="poin">Poin</label><input class="field" id="poin" name="poin" type="number" min="1" value="${escapeHtml(item?.poin || 10)}" required></div><div class="form-field"><label>Opsi jawaban (pilih jawaban benar)</label>${[1, 2, 3, 4].map((number) => `<div style="display:flex;align-items:center;gap:8px;margin-top:7px"><input type="radio" name="correct-option" value="${number}" ${Boolean(item?.opsi?.[number - 1]?.benar) || (!item?.opsi && number === 1) ? 'checked' : ''}><input class="field" name="option-${number}" required placeholder="Opsi ${number}" value="${escapeHtml(item?.opsi?.[number - 1]?.teks || '')}"></div>`).join('')}</div><div class="form-field"><label for="penjelasan">Penjelasan jawaban</label><textarea class="text-field" id="penjelasan" name="penjelasan">${escapeHtml(item?.penjelasan || '')}</textarea></div>`
                : `<div class="form-field"><label for="judul">Judul kuis</label><input class="field" id="judul" name="judul" required></div><div class="form-field"><label for="deskripsi">Deskripsi</label><textarea class="text-field" id="deskripsi" name="deskripsi"></textarea></div><div class="form-field"><label for="teks">Pertanyaan pertama</label><textarea class="text-field" id="teks" name="teks" required placeholder="Tulis pertanyaan..."></textarea></div><div class="form-field"><label>Opsi jawaban (pilih jawaban benar)</label>${[1, 2, 3, 4].map((number) => `<div style="display:flex;align-items:center;gap:8px;margin-top:7px"><input type="radio" name="correct-option" value="${number}" ${number === 1 ? 'checked' : ''}><input class="field" name="option-${number}" required placeholder="Opsi ${number}"></div>`).join('')}</div><div class="form-field"><label for="penjelasan">Penjelasan jawaban</label><textarea class="text-field" id="penjelasan" name="penjelasan"></textarea></div>`;
    const dialog = document.createElement('dialog');
    dialog.className = 'admin-dialog';
    dialog.innerHTML = `<div class="dialog-frame"><div class="panel-heading"><h2>${editing ? 'Edit' : 'Tambah'} ${isArticle ? 'artikel' : isQuestion ? 'pertanyaan' : 'kuis'}</h2><button class="button button-quiet button-small" type="button" data-action="close-dialog" aria-label="Tutup">Tutup</button></div><form class="form-stack" data-form="admin-create" data-type="${type}" data-id="${escapeHtml(item?.id || '')}" data-question-id="${escapeHtml(item?.questionId || '')}">${fields}<div class="form-alert" data-form-alert hidden></div><button class="button button-primary" type="submit">Simpan ${isArticle ? 'artikel' : isQuestion ? 'pertanyaan' : 'kuis'}</button></form></div>`;
    document.body.append(dialog);
    dialog.showModal();
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
}

async function createAdminContent(form) {
    const type = form.dataset.type;
    const values = Object.fromEntries(new FormData(form).entries());
    let payload = values;
    if (type === 'kuis' || type === 'question') {
        const correct = Number(values['correct-option']);
        const question = {
            teks: values.teks, poin: Number(values.poin || 10), penjelasan: values.penjelasan,
            opsi: [1, 2, 3, 4].map((number) => ({ teks: values[`option-${number}`], benar: number === correct })),
        };
        payload = type === 'kuis'
            ? { judul: values.judul, deskripsi: values.deskripsi, pertanyaan: [question] }
            : question;
    }
    delete payload['correct-option'];
    try {
        const editing = Boolean(form.dataset.id);
        const resourceType = type === 'kuis-edit' ? 'kuis' : type;
        const questionId = form.dataset.questionId;
        const path = type === 'question'
            ? `/admin/kuis/${encodeURIComponent(form.dataset.id)}/pertanyaan${questionId ? `/${encodeURIComponent(questionId)}` : ''}`
            : editing ? `/admin/${resourceType}/${encodeURIComponent(form.dataset.id)}` : `/admin/${resourceType}`;
        const method = type === 'question' ? (questionId ? 'PUT' : 'POST') : editing || type === 'kuis-edit' ? 'PUT' : 'POST';
        await apiRequest(path, { method, body: JSON.stringify(payload) });
        document.querySelector('dialog')?.close();
        toast(`${type === 'artikel' ? 'Artikel' : type === 'question' ? 'Pertanyaan' : 'Kuis'} berhasil ${editing || type === 'kuis-edit' ? 'diperbarui' : 'ditambahkan'}.`);
        if (type === 'artikel' || type === 'kuis') loadAdminList(type);
        else if (type === 'question' || type === 'kuis-edit') loadAdminQuiz(form.dataset.id);
    } catch (error) {
        fieldErrors(form, error.details);
        const alert = form.querySelector('[data-form-alert]');
        alert.hidden = false;
        alert.textContent = error.message;
    }
}

async function deleteAdminItem(section, id) {
    const paths = {
        artikel: `/admin/artikel/${id}`,
        kuis: `/admin/kuis/${id}`,
        forum: `/admin/forum/postingan/${id}`,
    };
    if (!paths[section] || !window.confirm('Hapus item ini? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
        await apiRequest(paths[section], { method: 'DELETE' });
        toast('Item berhasil dihapus.');
        loadAdminList(section);
    } catch (error) { toast(error.message, true); }
}

async function loadAdminQuiz(id) {
    if (!requireAdmin()) return;
    app.innerHTML = '<div class="page-wrap"><div class="empty-state">Memuat detail kuis...</div></div>';
    try {
        const response = await apiRequest(`/admin/kuis/${encodeURIComponent(id)}`);
        const quiz = response.data;
        document.title = `${quiz.judul} — Panel admin`;
        app.innerHTML = `<div class="page-wrap"><a class="text-link" href="/admin/kuis">← Semua kuis</a>${adminNav('kuis')}<div class="detail-panel"><span class="badge">Detail kuis</span><div class="panel-heading" style="margin-top:12px"><h1 style="margin:0">${escapeHtml(quiz.judul)}</h1><button class="button button-quiet button-small" type="button" data-action="edit-kuis" data-id="${escapeHtml(quiz.id)}">Edit judul</button></div><p class="detail-copy">${escapeHtml(quiz.deskripsi || '')}</p><div class="panel" style="margin-top:20px"><div class="panel-heading"><h2>Pertanyaan &amp; kunci jawaban</h2><button class="button button-primary button-small" type="button" data-action="add-question" data-id="${escapeHtml(quiz.id)}">+ Tambah pertanyaan</button></div>${(quiz.pertanyaan || []).map((question, index) => `<div class="result-review"><div class="panel-heading"><span class="question-number">Pertanyaan ${index + 1} · ${escapeHtml(question.poin || 0)} poin</span><div class="table-actions"><button type="button" data-action="edit-question" data-id="${escapeHtml(quiz.id)}" data-question-id="${escapeHtml(question.id)}">Edit</button><button class="delete" type="button" data-action="delete-question" data-id="${escapeHtml(quiz.id)}" data-question-id="${escapeHtml(question.id)}">Hapus</button></div></div><h3>${escapeHtml(question.teks)}</h3>${(question.opsi || []).map((option) => `<p>${option.benar ? '✓ ' : '· '}${escapeHtml(option.teks)} ${option.benar ? '<span class="badge">Kunci jawaban</span>' : ''}</p>`).join('')}<p>${escapeHtml(question.penjelasan || '')}</p></div>`).join('')}</div><div class="panel" style="margin-top:16px"><div class="panel-heading"><h2>Hasil pengguna</h2></div><div id="quiz-takers">Memuat rekap...</div></div></div></div>`;
        const results = await apiRequest(`/admin/kuis/${encodeURIComponent(id)}/hasil?limit=10&sort=-dikerjakan_pada`);
        const rows = results.data || [];
        document.querySelector('#quiz-takers').innerHTML = rows.length ? `<div class="table-wrap"><table><thead><tr><th>Pengguna</th><th>Skor</th><th>Tanggal</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${escapeHtml(item.pengguna?.nama || item.nama || 'Pengguna')}</td><td>${escapeHtml(item.skor)} / ${escapeHtml(item.skor_maks)}</td><td>${dateLabel(item.dikerjakan_pada)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="form-note">Belum ada hasil pengerjaan.</p>';
    } catch (error) { showError(error); }
}

async function loadAdminForumPost(id) {
    if (!requireAdmin()) return;
    app.innerHTML = '<div class="page-wrap"><div class="empty-state">Memuat detail percakapan...</div></div>';
    try {
        const [postResponse, repliesResponse] = await Promise.all([
            apiRequest(`/forum/postingan/${encodeURIComponent(id)}`),
            apiRequest(`/forum/postingan/${encodeURIComponent(id)}/balasan?sort=tanggal`),
        ]);
        const post = postResponse.data;
        const replies = repliesResponse.data || [];
        app.innerHTML = `<div class="page-wrap"><a class="text-link" href="/admin/forum">← Kembali ke moderasi</a>${adminNav('forum')}<div class="detail-panel"><span class="badge badge-blue">Moderasi diskusi</span><h1>${escapeHtml(post.judul)}</h1><p class="detail-copy">${escapeHtml(post.isi || '')}</p><div class="post-author"><span class="avatar">${escapeHtml(initials(post.penulis?.nama || 'U'))}</span><span>${escapeHtml(post.penulis?.nama || 'Pengguna')} · ${dateLabel(post.tanggal)}</span></div><div class="panel" style="margin-top:20px"><div class="panel-heading"><h2>Balasan (${replies.length})</h2></div>${replies.map((reply) => `<article class="reply-card"><div class="post-author"><span class="avatar">${escapeHtml(initials(reply.penulis?.nama || 'U'))}</span><span>${escapeHtml(reply.penulis?.nama || 'Pengguna')} · ${dateLabel(reply.tanggal)}</span><button class="button button-danger button-small" type="button" data-action="delete-reply" data-id="${escapeHtml(reply.id)}">Hapus balasan</button></div><p>${escapeHtml(reply.isi || '')}</p></article>`).join('') || '<p class="form-note">Belum ada balasan untuk diskusi ini.</p>'}</div></div></div>`;
    } catch (error) { showError(error); }
}

async function loadAdminUser(id) {
    if (!requireAdmin()) return;
    app.innerHTML = '<div class="page-wrap"><div class="empty-state">Memuat profil pengguna...</div></div>';
    try {
        const response = await apiRequest(`/admin/pengguna/${encodeURIComponent(id)}`);
        const user = response.data;
        const activity = user.aktivitas || {};
        setPage(escapeHtml(user.nama || 'Detail pengguna'), `${adminNav('pengguna')}<div class="profile-layout"><section class="profile-summary"><div class="profile-avatar">${escapeHtml(initials(user.nama))}</div><h2>${escapeHtml(user.nama)}</h2><p>${escapeHtml(user.email)}</p><span class="badge" style="margin-top:12px">${escapeHtml(user.role)}</span></section><section><div class="panel"><div class="panel-heading"><h2>Informasi pengguna</h2></div><div class="metric-grid"><div class="metric-card"><span>Postingan</span><strong>${escapeHtml(activity.jumlah_postingan || 0)}</strong></div><div class="metric-card"><span>Balasan</span><strong>${escapeHtml(activity.jumlah_balasan || 0)}</strong></div><div class="metric-card"><span>Kuis diikuti</span><strong>${escapeHtml(activity.jumlah_kuis_diikuti || 0)}</strong></div></div><p class="detail-copy">Email: ${escapeHtml(user.email)}<br>Pekerjaan: ${escapeHtml(user.pekerjaan || '—')}<br>Usia: ${escapeHtml(user.usia || '—')}<br>Terdaftar: ${dateLabel(user.dibuat_pada)}</p></div></section></div>`, 'Panel administrator');
    } catch (error) { showError(error); }
}

async function logout() {
    const refreshToken = localStorage.getItem('refresh_token');
    try {
        if (refreshToken) await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) });
    } catch (error) {
        if (error.status !== 401) toast(error.message, true);
    } finally {
        clearSession();
        location.assign('/');
    }
}

async function handleSubmit(event) {
    const form = event.target.closest('form[data-form], form[data-search]');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.search) {
        const search = new FormData(form).get('q') || '';
        if (form.dataset.search === 'articles') loadArticles(1, search);
        if (form.dataset.search === 'quizzes') loadQuizzes(1, search);
        if (form.dataset.search === 'forum') loadForum(1, search);
        if (form.dataset.search.startsWith('admin-')) loadAdminList(form.dataset.search.slice(6), 1, search);
        return;
    }
    const type = form.dataset.form;
    if (type === 'login' || type === 'register') return submitAuth(form, type === 'register');
    if (type === 'quiz') return submitQuiz(form);
    if (type === 'admin-create') return createAdminContent(form);
    const values = Object.fromEntries(new FormData(form).entries());
    const button = form.querySelector('[type="submit"]');
    if (button) button.disabled = true;
    try {
        if (type === 'post') {
            const response = await apiRequest('/forum/postingan', { method: 'POST', body: JSON.stringify(values) });
            location.assign(`/forum/${encodeURIComponent(response.data.id)}`);
        } else if (type === 'reply') {
            await apiRequest(`/forum/postingan/${encodeURIComponent(form.dataset.postId)}/balasan`, { method: 'POST', body: JSON.stringify(values) });
            toast('Balasan berhasil dikirim.');
            loadPost(form.dataset.postId);
        } else if (type === 'profile') {
            values.usia = values.usia ? Number(values.usia) : null;
            await apiRequest('/profil', { method: 'PUT', body: JSON.stringify(values) });
            const user = currentUser();
            localStorage.setItem('user', JSON.stringify({ ...user, ...values }));
            updateHeader();
            toast('Profil berhasil diperbarui.');
        } else if (type === 'password') {
            await apiRequest('/profil/password', { method: 'PUT', body: JSON.stringify(values) });
            form.reset();
            toast('Kata sandi berhasil diperbarui.');
        }
    } catch (error) {
        fieldErrors(form, error.details);
        const alert = form.querySelector('[data-form-alert]');
        if (alert) { alert.hidden = false; alert.textContent = error.message; }
        else toast(error.message, true);
    } finally {
        if (button) button.disabled = false;
    }
}

function handleClick(event) {
    const action = event.target.closest('[data-action]');
    if (action) {
        const { action: type, id } = action.dataset;
        if (type === 'logout') logout();
        if (type === 'reload') route();
        if (type === 'add-artikel') showAdminForm('artikel');
        if (type === 'add-kuis') showAdminForm('kuis');
        if (type === 'edit-artikel') {
            apiRequest(`/artikel/${encodeURIComponent(id)}`).then((response) => showAdminForm('artikel', response.data))
                .catch((error) => toast(error.message, true));
        }
        if (type === 'close-dialog') action.closest('dialog')?.close();
        if (type === 'edit-kuis') {
            apiRequest(`/admin/kuis/${encodeURIComponent(id)}`).then((response) => showAdminForm('kuis-edit', response.data))
                .catch((error) => toast(error.message, true));
        }
        if (type === 'add-question') showAdminForm('question', { id });
        if (type === 'edit-question') {
            apiRequest(`/admin/kuis/${encodeURIComponent(id)}`).then((response) => {
                const question = response.data.pertanyaan?.find((item) => String(item.id) === action.dataset.questionId);
                if (question) showAdminForm('question', { ...question, id, questionId: question.id });
            }).catch((error) => toast(error.message, true));
        }
        if (type === 'delete-question') deleteAdminQuestion(id, action.dataset.questionId);
        if (type.startsWith('delete-')) deleteAdminItem(type.slice(7), id);
        if (type === 'delete-reply') deleteAdminReply(id);
    }
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) {
        const { page, target } = pageButton.dataset;
        const search = document.querySelector('[data-search] input[name="q"]')?.value || '';
        if (target === 'articles') loadArticles(Number(page), search);
        if (target === 'quizzes') loadQuizzes(Number(page), search);
        if (target === 'forum') loadForum(Number(page), search);
        if (target === 'results') loadResults(Number(page));
        if (target.startsWith('admin-')) loadAdminList(target.slice(6), Number(page), search);
    }
}

function route() {
    updateHeader();
    const path = decodeURIComponent(location.pathname).replace(/\/+$/, '') || '/';
    const parts = path.split('/').filter(Boolean);
    if (path === '/') return loadHome();
    if (path === '/login') return authPage(false);
    if (path === '/register') return authPage(true);
    if (path === '/artikel') return loadArticles();
    if (parts[0] === 'artikel' && parts[1]) return loadArticle(parts[1]);
    if (path === '/kuis') return loadQuizzes();
    if (parts[0] === 'kuis' && parts[1]) return loadQuiz(parts[1]);
    if (path === '/hasil-kuis') return loadResults();
    if (parts[0] === 'hasil-kuis' && parts[1]) return loadResult(parts[1]);
    if (path === '/forum') return loadForum();
    if (path === '/forum/buat') return createPostPage();
    if (parts[0] === 'forum' && parts[1]) return loadPost(parts[1]);
    if (path === '/profil') return loadProfile();
    if (path === '/review') return loadReview();
    if (path === '/review/post') return loadReviewForm(); // atau fungsi form buat review Anda
    if (path === '/admin/dashboard') return loadAdminDashboard();
    if (path === '/admin/artiksel' || path === '/admin/kuis' || path === '/admin/forum' || path === '/admin/pengguna') return loadAdminList(parts[1]);
    if (parts[0] === 'admin' && parts[1] === 'kuis' && parts[2]) return loadAdminQuiz(parts[2]);
    if (parts[0] === 'admin' && parts[1] === 'forum' && parts[2]) return loadAdminForumPost(parts[2]);
    if (parts[0] === 'admin' && parts[1] === 'pengguna' && parts[2]) return loadAdminUser(parts[2]);
    setPage('Halaman tidak ditemukan', '<div class="empty-state"><strong>Sepertinya kamu tersesat.</strong>Halaman ini tidak tersedia. Kembali ke awal dan lanjutkan belajar.<p style="margin-top:16px"><a class="button button-primary" href="/">Kembali ke beranda</a></p></div>', '404');
}

document.addEventListener('submit', handleSubmit);
document.addEventListener('click', handleClick);
document.querySelector('[data-menu-toggle]')?.addEventListener('click', (event) => {
    const button = event.currentTarget;
    const open = navigation.classList.toggle('open');
    button.setAttribute('aria-expanded', String(open));
});
navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
        navigation.classList.remove('open');
        document.querySelector('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
    }
});

// Jalankan saat halaman dimuat dan saat tombol back/forward browser ditekan
window.addEventListener('DOMContentLoaded', handleRoute);
window.addEventListener('popstate', handleRoute);

// Tangkap klik pada link internal agar tidak full reload
document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href && href.startsWith('/') && !link.hasAttribute('target')) {
        e.preventDefault();
        history.pushState(null, '', href);
        handleRoute();
    }
});
route();
