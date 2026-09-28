// =========================================================================
// kamus.js — loader Kamus Istilah, dipasang di SEMUA halaman (crm.html,
// followup.html, eos.html, pengaturan.html). Cara pakai di HTML:
//
// 1. Tambahkan <script src="kamus.js"></script> SEBELUM script halaman
//    yang lain (sebelum api-crm.js dkk), supaya window.KAMUS sudah terisi
//    saat halaman lain mulai render.
// 2. Untuk teks statis di HTML, tambahkan atribut data-kamus="key" pada
//    elemen -- textContent-nya otomatis diganti begitu kamus termuat.
//    Contoh: <h2 data-kamus="istilah_scorecard">Weekly Scorecard</h2>
//    (teks "Weekly Scorecard" di situ cuma fallback kalau JS gagal load).
// 3. Untuk teks yang dibangun dinamis di JS (template string, dsb), pakai
//    langsung window.KAMUS.key, contoh: `${KAMUS.istilah_lead} baru`.
//    KAMUS sudah pasti terisi (minimal default) begitu DOMContentLoaded.
// =========================================================================

window.KAMUS = {}; // diisi async, tapi selalu ada isinya (default) begitu kamusSiap resolve

window.kamusSiap = (async function muatKamusIstilah() {
  try {
    const res = await fetch(scriptURL + '?action=getKamusIstilah');
    const json = await res.json();
    window.KAMUS = json.kamus || json.default || {};
  } catch (err) {
    console.error('Gagal memuat Kamus Istilah, pakai fallback default:', err);
    window.KAMUS = {}; // elemen data-kamus tetap tampil teks fallback aslinya di HTML
  }
  terapkanKamusKeDOM_();
  document.dispatchEvent(new CustomEvent('kamusSiap'));
  return window.KAMUS;
})();

function terapkanKamusKeDOM_() {
  document.querySelectorAll('[data-kamus]').forEach(function (el) {
    const key = el.getAttribute('data-kamus');
    if (window.KAMUS && window.KAMUS[key]) {
      el.textContent = window.KAMUS[key];
    }
  });
}

// Untuk elemen yang dirender BELAKANGAN oleh JS lain (misal setelah fetch
// data), panggil ini lagi setelah elemen data-kamus baru ditambahkan ke DOM.
window.terapkanKamusUlang = terapkanKamusKeDOM_;
