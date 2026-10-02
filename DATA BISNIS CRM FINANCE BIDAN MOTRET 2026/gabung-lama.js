// gabung-lama.js: menyisipkan blok lama (CSS funnel, semua .mkt-sub, #tmModalSet) dari index-marketing-lama.html
// ke posisi script ini, SEBELUM script lain jalan (sinkron), jadi semua id yang dicari ui-marketing.js tersedia.
// Syarat: halaman dibuka lewat server (Vercel/localhost), bukan file://.
(function () {
  var NAMA = 'index-marketing-lama.html';
  try {
    var x = new XMLHttpRequest();
    x.open('GET', NAMA + '?v=' + Date.now(), false);   // sinkron, sengaja
    x.send(null);
    if (x.status && x.status !== 200) throw new Error('HTTP ' + x.status);
    var d = new DOMParser().parseFromString(x.responseText, 'text/html');
    var tab = d.getElementById('tabMarketing');
    if (!tab) throw new Error('#tabMarketing tidak ditemukan di ' + NAMA);
    var h = '';
    tab.querySelectorAll('style').forEach(function (s) { h += s.outerHTML; });
    tab.querySelectorAll('.mkt-sub').forEach(function (s) {
      if (s.id === 'mktSub_rapat' || s.id === 'mktSub_audience') return;   // sudah ada di file baru
      h += s.outerHTML;
    });
    var m = d.getElementById('tmModalSet'); if (m) h += m.outerHTML;
    document.write(h);
  } catch (e) {
    document.write('<div style="background:#fee2e2;color:#991b1b;padding:12px;border-radius:8px;margin:10px 0;font-size:13px">⚠️ Gagal memuat blok lama dari <b>' + NAMA + '</b>: ' + String(e.message || e) + '. Simpan file lama dengan nama itu di folder yang sama dan buka lewat server (bukan file://).</div>');
  }
})();
