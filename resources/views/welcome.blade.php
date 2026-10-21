<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#f7f8f4">
    <meta name="description" content="Belajar energi bersih dan terjangkau bersama SDG7Learn.">
    <title>SDG7Learn — Energi bersih untuk semua</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    <div class="site-shell">
        <header class="site-header">
            <a class="brand" href="/" aria-label="SDG7Learn, beranda">
                <span class="brand-mark" aria-hidden="true">
                    <svg viewBox="0 0 32 32" fill="none"><path d="M17.2 3.5 7.4 17h7l-.9 11.5L24.6 14h-7.1l-.3-10.5Z" fill="currentColor"/><path d="M5 25.5c2.4 1.8 5.4 2.8 8.7 2.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </span>
                <span class="brand-name">SDG7<span>Learn</span></span>
            </a>
            <button class="menu-toggle" type="button" aria-label="Buka navigasi" aria-expanded="false" data-menu-toggle>
                <span></span><span></span>
            </button>
            <nav class="main-nav" aria-label="Navigasi utama" data-navigation>
                <a href="/artikel" data-nav-link>Artikel</a>
                <a href="/kuis" data-nav-link>Kuis</a>
                <a href="/forum" data-nav-link>Forum</a>
                <a href="/hasil-kuis" data-nav-link data-auth-link>Hasil belajar</a>
                <a href="/review" data-nav-link data-auth-link>Review</a>
            </nav>
            <div class="header-actions" id="account-actions">
                <a class="button button-quiet button-small" href="/login">Masuk</a>
                <a class="button button-primary button-small" href="/register">Daftar gratis <span aria-hidden="true">↗</span></a>
            </div>
        </header>
        <main id="app" tabindex="-1">
            <div class="loading-screen"><span class="spinner" aria-hidden="true"></span><span>Menyiapkan ruang belajar...</span></div>
        </main>
        <footer class="site-footer">
            <a class="brand brand-footer" href="/">
                <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M17.2 3.5 7.4 17h7l-.9 11.5L24.6 14h-7.1l-.3-10.5Z" fill="currentColor"/></svg></span>
                <span class="brand-name">SDG7<span>Learn</span></span>
            </a>
            <p>Belajar hari ini, menerangi masa depan.</p>
            <span class="footer-note">Energi bersih &amp; terjangkau untuk semua.</span>
        </footer>
    </div>
</body>
</html>
