// =========================================================================
// nav.js — SATU-SATUNYA sumber menu untuk SEMUA halaman + perbaikan sidebar HP
// + helper fetchJsonAman (penyebab error "Unexpected token '<'").
// Pasang di setiap halaman SEBELUM skrip lain:  <script src="nav.js"></script>
//
// Mau tambah/ubah/hapus menu? Edit daftar MENU_APLIKASI di bawah, selesai.
//  - kamus: kunci Kamus Istilah (label ikut berubah kalau diganti di kamus.html)
//  - aksi : 'fieldkustom' = buka editor Field Kustom (di crm.html langsung terbuka)
// =========================================================================

const MENU_APLIKASI = [
  { grup: 'Utama',      href: 'index.html',           ico: '🏠', teks: 'Menu Utama' },
  { grup: 'Utama',      href: 'crm.html',             ico: '👥', teks: 'CRM Leads',           kamus: 'menu_crm' },
  { grup: 'Utama',      href: 'followup.html',        ico: '🤖', teks: 'AI Chat & Follow-up', kamus: 'menu_followup' },
  { grup: 'Utama',      href: 'rekap.html',           ico: '🧾', teks: 'Rekap Order' },
  { grup: 'Utama',      href: 'index-marketing.html', ico: '📈', teks: 'Analisis Marketing' },
  { grup: 'Utama',      href: 'index-keuangan.html',  ico: '💰', teks: 'Laporan Keuangan',    kamus: 'menu_keuangan' },
  { grup: 'Utama',      href: 'eos.html',             ico: '🎯', teks: 'EOS Dashboard',       kamus: 'menu_eos' },
  { grup: 'Pengaturan', href: 'alur.html',            ico: '🧭', teks: 'Alur Klasifikasi' },
  { grup: 'Pengaturan', href: 'crm.html?fieldkustom=1', ico: '🧩', teks: 'Field Kustom', aksi: 'fieldkustom' },
  { grup: 'Pengaturan', href: 'followup-pengaturan.html', ico: '⚙️', teks: 'Pengaturan AI' },
  { grup: 'Pengaturan', href: 'pengaturan.html',      ico: '🛠️', teks: 'Pengaturan',          kamus: 'menu_pengaturan' },
  { grup: 'Pengaturan', href: 'kamus.html',           ico: '🗂️', teks: 'Kamus Istilah' },
  { grup: 'Pengaturan', href: 'onboarding.html',      ico: '🚀', teks: 'Setup Klien Baru' }
];

// ---- Token akses (dikirim ke Apps Script; dicek di Auth.gs) -------------
const KUNCI_TOKEN_APP = 'app_api_token';
function ambilTokenApp_() { try { return localStorage.getItem(KUNCI_TOKEN_APP) || ''; } catch (e) { return ''; } }
function simpanTokenApp_(t) { try { if (t) localStorage.setItem(KUNCI_TOKEN_APP, t); else localStorage.removeItem(KUNCI_TOKEN_APP); } catch (e) {} }
function tanyaTokenApp_(pesan) {
  const t = (window.prompt(pesan || 'Masukkan token akses aplikasi:') || '').trim();
  if (t) simpanTokenApp_(t);
  return t;
}
function untukAppsScript_(url) { return /^https:\/\/script\.google(usercontent)?\.com\//.test(String(url)); }

function pasangTokenApp_(url, opts, token) {
  if (!token || !untukAppsScript_(url)) return { url, opts };
  if (!opts || !opts.body) {                       // GET -> ?token=
    return { url: url + (url.indexOf('?') === -1 ? '?' : '&') + 'token=' + encodeURIComponent(token), opts };
  }
  if (typeof FormData !== 'undefined' && opts.body instanceof FormData) { opts.body.set('token', token); }
  return { url, opts };                            // body JSON/lain (form publik): tidak disentuh
}

// Ambil JSON dari Apps Script. Kalau server membalas HTML (halaman error /
// login / action tidak dikenal), tampilkan pesan yang jelas, bukan SyntaxError.
// Kalau server menolak token (code:'AUTH'), minta token sekali lalu ulangi.
async function fetchJsonAman(url, opts, sudahCobaToken) {
  const req = pasangTokenApp_(url, opts, ambilTokenApp_());
  const res = await fetch(req.url, req.opts);
  const teks = await res.text();
  let obj;
  try {
    obj = JSON.parse(teks);
  } catch (e) {
    const awal = teks.trim().slice(0, 80).replace(/\s+/g, ' ');
    throw new Error(
      'Server membalas HTML, bukan JSON (HTTP ' + res.status + '). ' +
      'Kemungkinan: action belum ada di Code.gs, deployment belum di-update ke versi baru, ' +
      'atau akses Web App belum "Anyone". Awal balasan: ' + awal
    );
  }
  if (obj && obj.result === 'error' && obj.code === 'AUTH') {
    simpanTokenApp_('');
    if (!sudahCobaToken) {
      const t = tanyaTokenApp_('Token akses diperlukan atau salah. Masukkan token:');
      if (t) return fetchJsonAman(url, opts, true);
    }
    throw new Error('Server: token akses ditolak.');
  }
  // Permintaan GET yang gagal di server dibalas {result:"error"}. Lempar sebagai error
  // supaya tidak diam-diam tampil sebagai data kosong.
  if (!opts && obj && obj.result === 'error') throw new Error('Server: ' + (obj.message || 'error tidak diketahui'));
  return obj;
}

(function () {
  const css = `
    .nav-backdrop { display:none; position:fixed; inset:0; background:rgba(15,23,42,.35); z-index:45; }
    @media (max-width: 900px) {
      .sidebar { width:min(72vw, 250px); box-shadow:4px 0 18px rgba(0,0,0,.25); }
      body.nav-open .nav-backdrop { display:block; }
      .topbar { z-index:20; }
    }
    .nav-item.nav-aktif { background:rgba(255,255,255,.14); color:#fff; font-weight:700; }
    .nav-judul { font-size:10px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; opacity:.55; padding:10px 14px 4px; }
    /* menu tarik-turun untuk halaman tanpa sidebar (mis. followup.html) */
    .nav-dd { position:relative; display:inline-block; }
    .nav-dd > button { border:none; border-radius:7px; padding:7px 13px; font-weight:700; font-size:12.5px; cursor:pointer; background:#4f46e5; color:#fff; }
    .nav-dd-panel { display:none; position:absolute; top:calc(100% + 6px); left:0; min-width:230px; background:#fff; border:1px solid #e2e8f0;
      border-radius:10px; box-shadow:0 10px 24px rgba(15,23,42,.18); padding:6px; z-index:1000; }
    .nav-dd.buka .nav-dd-panel { display:block; }
    .nav-dd-panel a { display:flex; gap:8px; align-items:center; padding:8px 10px; border-radius:6px; color:#0f172a; text-decoration:none; font-size:13px; font-weight:600; }
    .nav-dd-panel a:hover { background:#f1f5f9; }
    .nav-dd-panel a.aktif { background:#eef2ff; color:#4338ca; }
    .nav-dd-panel .nav-judul { color:#64748b; opacity:1; }
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  const fileSaatIni = () => (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const fileDari = href => String(href).split('?')[0].split('#')[0].toLowerCase();

  function labelHtml(m) {
    return m.kamus ? `<span data-kamus="${m.kamus}">${m.teks}</span>` : m.teks;
  }
  function kelompok() {
    const hasil = [];
    MENU_APLIKASI.forEach(m => {
      let g = hasil[hasil.length - 1];
      if (!g || g.nama !== m.grup) { g = { nama: m.grup, item: [] }; hasil.push(g); }
      g.item.push(m);
    });
    return hasil;
  }
  const aktifKah = m => !m.aksi && fileDari(m.href) === fileSaatIni();

  function bangunMenu() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return false;

    // buang tautan .html lama (hardcode per halaman) supaya tidak dobel / salah alamat
    nav.querySelectorAll('a.nav-item[href$=".html"], button.nav-item[disabled], .nav-group[data-nav-app]').forEach(a => a.remove());

    const wadah = document.createElement('div');
    wadah.setAttribute('data-nav-app', '1');
    wadah.innerHTML = kelompok().map(g =>
      `<div class="nav-group"><div class="nav-judul">${g.nama}</div>` +
      g.item.map(m =>
        `<a class="nav-item${aktifKah(m) ? ' active nav-aktif' : ''}" href="${m.href}"` +
        (m.aksi ? ` data-nav-aksi="${m.aksi}"` : '') +
        ` style="text-decoration:none; display:flex;"><span class="nav-ico">${m.ico}</span> ${labelHtml(m)}</a>`
      ).join('') + '</div>'
    ).join('');
    // pindahkan tiap grup langsung ke <nav> (struktur sama seperti sebelumnya)
    Array.from(wadah.children).reverse().forEach(el => { el.setAttribute('data-nav-app', '1'); nav.insertBefore(el, nav.firstChild); });
    return true;
  }

  // Halaman tanpa sidebar tapi punya <header> (followup.html): sediakan menu tarik-turun.
  function bangunMenuHeader() {
    const header = document.querySelector('body > header');
    if (!header || header.querySelector('.nav-dd')) return;
    header.querySelectorAll('a.sm[href$=".html"]').forEach(a => a.remove()); // tautan lama yang salah alamat

    const dd = document.createElement('div');
    dd.className = 'nav-dd';
    dd.innerHTML = '<button type="button">☰ Menu</button><div class="nav-dd-panel">' +
      kelompok().map(g =>
        `<div class="nav-judul">${g.nama}</div>` +
        g.item.map(m =>
          `<a href="${m.href}"${m.aksi ? ` data-nav-aksi="${m.aksi}"` : ''} class="${aktifKah(m) ? 'aktif' : ''}">${m.ico} ${labelHtml(m)}</a>`
        ).join('')
      ).join('') + '</div>';
    const h1 = header.querySelector('h1');
    if (h1 && h1.nextSibling) header.insertBefore(dd, h1.nextSibling); else header.appendChild(dd);

    dd.querySelector('button').addEventListener('click', e => { e.stopPropagation(); dd.classList.toggle('buka'); });
    document.addEventListener('click', () => dd.classList.remove('buka'));
  }

  function pasangBackdrop() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;
    const bd = document.createElement('div');
    bd.className = 'nav-backdrop';
    bd.addEventListener('click', () => sidebar.classList.remove('open'));
    document.body.appendChild(bd);

    const sinkron = () => document.body.classList.toggle('nav-open', sidebar.classList.contains('open'));
    new MutationObserver(sinkron).observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    sidebar.addEventListener('click', e => {
      if (e.target.closest('a.nav-item')) sidebar.classList.remove('open');
    });
  }

  // Field Kustom: kalau sudah di crm.html, buka editor langsung tanpa reload
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[data-nav-aksi="fieldkustom"]');
    if (a && fileSaatIni() === 'crm.html' && typeof window.bukaEditorFieldKustom === 'function') {
      e.preventDefault();
      const sb = document.querySelector('.sidebar'); if (sb) sb.classList.remove('open');
      window.bukaEditorFieldKustom();
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    if (!bangunMenu()) bangunMenuHeader();
    pasangBackdrop();
  });
})();
