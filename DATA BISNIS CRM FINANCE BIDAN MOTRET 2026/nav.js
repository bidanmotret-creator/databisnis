// =========================================================================
// nav.js — menu navigasi bersama untuk SEMUA halaman + perbaikan sidebar HP
// + helper fetchJsonAman (penyebab error "Unexpected token '<'").
// Pasang di setiap halaman SEBELUM skrip lain:  <script src="nav.js"></script>
// =========================================================================

const MENU_APLIKASI = [
  { href: 'index.html',           ico: '🏠', teks: 'Menu Utama' },
  { href: 'crm.html',             ico: '👥', teks: 'CRM Leads' },
  { href: 'followup.html',        ico: '🤖', teks: 'AI Chat & Follow-up' },
  { href: 'followup-pengaturan.html', ico: '⚙️', teks: 'Pengaturan AI' },
  { href: 'index-keuangan.html',  ico: '💰', teks: 'Laporan Keuangan' },
  { href: 'index-marketing.html', ico: '📈', teks: 'Analisis Marketing' }
];

// Ambil JSON dari Apps Script. Kalau server membalas HTML (halaman error /
// login / action tidak dikenal), tampilkan pesan yang jelas, bukan SyntaxError.
async function fetchJsonAman(url, opts) {
  const res = await fetch(url, opts);
  const teks = await res.text();
  try {
    const obj = JSON.parse(teks);
    // Permintaan GET yang gagal di server kini dibalas {result:"error"} (lihat Code_gs_PERBAIKAN.gs).
    // Lempar sebagai error supaya tidak diam-diam tampil sebagai data kosong.
    if (!opts && obj && obj.result === 'error') throw new Error('Server: ' + (obj.message || 'error tidak diketahui'));
    return obj;
  } catch (e) {
    if (e.message && e.message.indexOf('Server:') === 0) throw e;
    const awal = teks.trim().slice(0, 80).replace(/\s+/g, ' ');
    throw new Error(
      'Server membalas HTML, bukan JSON (HTTP ' + res.status + '). ' +
      'Kemungkinan: action belum ada di Code.gs, deployment belum di-update ke versi baru, ' +
      'atau akses Web App belum "Anyone". Awal balasan: ' + awal
    );
  }
}

(function () {
  const css = `
    .nav-backdrop { display:none; position:fixed; inset:0; background:rgba(15,23,42,.35); z-index:45; }
    @media (max-width: 900px) {
      .sidebar { width:min(72vw, 250px); box-shadow:4px 0 18px rgba(0,0,0,.25); }
      body.nav-open .nav-backdrop { display:block; }
      /* konten tetap terlihat di sisi kanan; ketuk area itu untuk menutup menu */
      .topbar { z-index:20; }
    }
    .nav-item.nav-aktif { background:rgba(255,255,255,.14); color:#fff; font-weight:700; }
  `;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function bangunMenu() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    // buang tautan .html lama supaya tidak dobel / salah alamat (mis. index.html untuk Keuangan)
    nav.querySelectorAll('a.nav-item[href$=".html"], button.nav-item[disabled]').forEach(a => a.remove());

    const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const grup = document.createElement('div');
    grup.className = 'nav-group';
    grup.innerHTML = MENU_APLIKASI.map(m =>
      `<a class="nav-item${file === m.href ? ' nav-aktif' : ''}" href="${m.href}" style="text-decoration:none;">` +
      `<span class="nav-ico">${m.ico}</span> ${m.teks}</a>`
    ).join('');
    nav.insertBefore(grup, nav.firstChild);
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
    // tutup otomatis setelah memilih menu
    sidebar.addEventListener('click', e => {
      if (e.target.closest('a.nav-item')) sidebar.classList.remove('open');
    });
  }

  document.addEventListener('DOMContentLoaded', () => { bangunMenu(); pasangBackdrop(); });
})();
