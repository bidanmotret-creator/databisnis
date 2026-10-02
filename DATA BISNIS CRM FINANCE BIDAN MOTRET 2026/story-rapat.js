// story-rapat.js v2: alur cerita rapat (pengganti bagian "3. ALUR CERITA" di audience-story.js)
// Muat SETELAH audience-story.js. Aman walau bagian 3 lama belum dihapus (elemen lamanya dibersihkan).
(function () {
  var RAPAT_ALUR = [
    { bab: 'Bab 1 · Hasil', warna: '#6366f1', ik: '🎯', isi: [['rapat', '🧭', 'Rapat'], ['funnel', '🎯', 'Funnel'], ['produk', '🏆', 'Produk'], ['tren', '📈', 'Tren']] },
    { bab: 'Bab 2 · Audiens', warna: '#db2777', ik: '👥', isi: [['audience', '👥', 'Audience']] },
    { bab: 'Bab 3 · Iklan', warna: '#f59e0b', ik: '🎨', isi: [['adset', '🧩', 'Adset'], ['creative', '🎨', 'Creative'], ['konten', '🎬', 'Konten'], ['promo', '🧪', 'Promo'], ['iklan', '🔍', 'Analisis'], ['drill', '🔎', 'Drill-down']] },
    { bab: 'Bab 4 · Mesin', warna: '#10b981', ik: '⚙️', isi: [['sync', '🔗', 'Sync Meta'], ['capi', '📡', 'CAPI']] }
  ];
  // mkt-extra.js hanya mengenal sub-tab di MKT_SUBS; 'rapat' & 'audience' dialihkan ke 'funnel' bila tidak didaftarkan
  if (typeof MKT_SUBS !== 'undefined') ['rapat', 'audience'].forEach(function (x) { if (MKT_SUBS.indexOf(x) < 0) MKT_SUBS.push(x); });
  var URUT = RAPAT_ALUR.flatMap(function (b) { return b.isi.map(function (i) { return i[0]; }); });
  // [pertanyaan rapat, keputusan yang diharapkan]
  var CERITA = {
    rapat: ['Apakah iklan periode ini menghasilkan uang?', 'Tentukan arah besar: scale, perbaiki, atau hentikan.'],
    funnel: ['Di tahap mana calon klien menghilang?', 'Pilih SATU tahap bocor untuk diperbaiki lebih dulu.'],
    produk: ['Produk mana yang paling laku dan menguntungkan?', 'Arahkan budget ke produk juara.'],
    tren: ['Naik atau turun dibanding periode lalu?', 'Tetapkan target angka minggu depan.'],
    audience: ['Siapa, di mana, lewat mana, dan pakai konten apa yang paling efektif?', 'Pilih audience/placement yang di-scale dan yang dihentikan.'],
    adset: ['Adset mana yang efisien?', 'Naikkan budget adset hijau, matikan adset merah.'],
    creative: ['Creative mana yang paling menarik perhatian?', 'Ganti creative terlemah, gandakan yang terkuat.'],
    konten: ['Konten apa yang sedang berjalan dan bagaimana hasilnya?', 'Putuskan konten yang diperpanjang atau dihentikan.'],
    promo: ['Penawaran/promo mana yang menarik orang membayar DP?', 'Pilih promo pemenang untuk dijalankan lebih luas.'],
    iklan: ['Iklan spesifik mana yang bermasalah?', 'Tunjuk iklan yang perlu dioptimasi.'],
    drill: ['Apa penyebab detail di balik angka ini?', 'Catat akar masalah dan PIC-nya.'],
    sync: ['Apakah data Meta sudah tersinkron?', 'Pastikan data valid sebelum memutuskan.'],
    capi: ['Apakah pelacakan konversi sehat?', 'Perbaiki pelacakan jika ada yang bocor.']
  };
  var NAMA = {}; RAPAT_ALUR.forEach(function (b) { b.isi.forEach(function (i) { NAMA[i[0]] = i[1] + ' ' + i[2]; }); });
  var VONIS = { scale: '🟢 Scale', fix: '🟡 Perbaiki', stop: '🔴 Stop' };
  var KEP = {};
  try { KEP = JSON.parse(localStorage.getItem('mktKeputusan') || '{}'); } catch (e) {}
  function simpan() { try { localStorage.setItem('mktKeputusan', JSON.stringify(KEP)); } catch (e) {} hitungKep(); }
  function hitungKep() { var n = Object.keys(KEP).filter(function (k) { return KEP[k].v || KEP[k].n; }).length; var el = document.getElementById('rpKepN'); if (el) el.textContent = n; }

  var nav = document.getElementById('mktSubNav');
  if (!nav) return;
  ['stWrap', 'stProg'].forEach(function (id) { var e = document.getElementById(id); if (e) { var p = e.closest('.st-prog') || e; p.remove(); } });
  document.querySelectorAll('.st-prog,.st-wrap,.st-foot,.rp-banner').forEach(function (e) { e.remove(); });

  var css = document.createElement('style');
  css.textContent = '#mktSubNav{display:none!important}' +
    '.rp-bar{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.96);backdrop-filter:blur(6px);border-bottom:1px solid #e2e8f0;margin:0 -4px 14px;padding:10px 4px 8px}' +
    '.rp-bar-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px}' +
    '.rp-count{font-size:12px;font-weight:800;color:#475569}.rp-bar .sp{flex:1}' +
    '.rp-mini{border:none;border-radius:20px;padding:6px 12px;font-size:12px;font-weight:800;color:#fff;cursor:pointer;background:#4338ca}' +
    '.rp-mini.alt{background:#db2777}.rp-mini.gr{background:#059669}' +
    '.st-prog{height:8px;background:#e2e8f0;border-radius:8px;overflow:hidden}.st-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#6366f1,#db2777,#f59e0b,#10b981);transition:width .5s}' +
    '.st-wrap{display:flex;flex-wrap:wrap;gap:12px;margin:10px 0 0}.st-bab{flex:1 1 180px}.st-bab h5{margin:0 0 5px;font-size:10.5px;letter-spacing:.5px;text-transform:uppercase}' +
    '.st-row{display:flex;gap:5px;flex-wrap:wrap}' +
    '.st-step{border:2px solid var(--c);background:#fff;color:var(--c);border-radius:20px;padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;transition:.15s}' +
    '.st-step:hover{transform:translateY(-2px)}.st-step.on{background:var(--c);color:#fff;box-shadow:0 4px 12px rgba(0,0,0,.22)}' +
    '.st-step.done{background:color-mix(in srgb,var(--c) 14%,#fff)}.st-step.has:after{content:" ✔";font-size:10px}' +
    '.rp-banner{border-radius:14px;padding:14px 18px;color:#fff;margin-bottom:14px;position:relative;overflow:hidden;animation:rpIn .45s}' +
    '.rp-banner:after{content:attr(data-ik);position:absolute;right:14px;top:-4px;font-size:64px;opacity:.2}' +
    '.rp-banner small{text-transform:uppercase;letter-spacing:.6px;font-size:10.5px;opacity:.9}' +
    '.rp-banner h3{margin:2px 0 6px;font-size:18px}.rp-banner p{margin:0;font-size:12.5px;opacity:.97}' +
    '@keyframes rpIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '.st-foot{margin-top:22px;padding:14px;border-radius:14px;background:#f8fafc;border:2px dashed #cbd5e1}' +
    '.rp-kep{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.rp-kep b{font-size:13px;margin-right:4px}' +
    '.rp-v{border:2px solid #cbd5e1;background:#fff;border-radius:20px;padding:6px 13px;font-weight:800;font-size:12px;cursor:pointer}' +
    '.rp-v.on[data-v=scale]{background:#16a34a;border-color:#16a34a;color:#fff}.rp-v.on[data-v=fix]{background:#f59e0b;border-color:#f59e0b;color:#fff}.rp-v.on[data-v=stop]{background:#dc2626;border-color:#dc2626;color:#fff}' +
    '.rp-kep input{flex:1 1 220px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px}' +
    '.st-nav{display:flex;gap:8px;justify-content:space-between}.st-nav button{padding:10px 18px;border:none;border-radius:8px;color:#fff;font-weight:800;cursor:pointer;background:#4338ca}.st-nav .back{background:#94a3b8}' +
    '#rpRekap{position:fixed;inset:0;z-index:9000;background:rgba(15,23,42,.6);display:none;align-items:center;justify-content:center;padding:16px}' +
    '#rpRekap.open{display:flex}#rpRekap>div{background:#fff;border-radius:16px;max-width:560px;width:100%;max-height:85vh;overflow:auto;padding:18px}' +
    '#rpRekap li{font-size:13px;margin:6px 0}' +
    'body.pres .sidebar,body.pres .topbar,body.pres .filter-panel,body.pres .st-wrap,body.pres .mkt-toolbar-btns{display:none!important}' +
    'body.pres .main-content{margin-left:0!important;width:100%!important}body.pres .mkt-sub{font-size:1.1em}';
  document.head.appendChild(css);

  var bar = document.createElement('div'); bar.className = 'rp-bar mkt-noprint';
  bar.innerHTML = '<div class="rp-bar-top"><span class="rp-count" id="rpCount"></span><span class="sp"></span>' +
    '<button class="rp-mini gr" onclick="rpRekapBuka()">📝 Rekap Keputusan (<span id="rpKepN">0</span>)</button>' +
    '<button class="rp-mini alt" id="rpPresBtn" onclick="rpPresentasi()">🖥️ Mode Presentasi</button></div>' +
    '<div class="st-prog"><i id="stProg"></i></div><div class="st-wrap" id="stWrap">' +
    RAPAT_ALUR.map(function (b) {
      return '<div class="st-bab"><h5 style="color:' + b.warna + '">' + b.bab + '</h5><div class="st-row">' +
        b.isi.map(function (i) { return '<button type="button" class="st-step" data-k="' + i[0] + '" style="--c:' + b.warna + '" onclick="mktBukaSub(\'' + i[0] + '\')">' + i[1] + ' ' + i[2] + '</button>'; }).join('') + '</div></div>';
    }).join('') + '</div>';
  nav.parentNode.insertBefore(bar, nav);

  function warnaBab(k) { return RAPAT_ALUR.filter(function (b) { return b.isi.some(function (i) { return i[0] === k; }); })[0]; }

  URUT.forEach(function (k, idx) {
    var sub = document.getElementById('mktSub_' + k); if (!sub) return;
    var b = warnaBab(k), c = CERITA[k], p = URUT[idx - 1], n = URUT[idx + 1];
    var bn = document.createElement('div'); bn.className = 'rp-banner'; bn.dataset.ik = b.ik;
    bn.style.background = 'linear-gradient(120deg,' + b.warna + ',#0f172a)';
    bn.innerHTML = '<small>' + b.bab + ' · Langkah ' + (idx + 1) + '/' + URUT.length + '</small><h3>❓ ' + c[0] + '</h3><p>🎯 ' + c[1] + '</p>';
    sub.insertBefore(bn, sub.firstChild);
    var cur = KEP[k] || {};
    var f = document.createElement('div'); f.className = 'st-foot mkt-noprint';
    f.innerHTML = '<div class="rp-kep"><b>⚖️ Keputusan untuk ' + NAMA[k] + ':</b>' +
      ['scale', 'fix', 'stop'].map(function (v) { return '<button type="button" class="rp-v' + (cur.v === v ? ' on' : '') + '" data-v="' + v + '" onclick="rpPilih(\'' + k + '\',\'' + v + '\',this)">' + VONIS[v] + '</button>'; }).join('') +
      '<input type="text" placeholder="Catatan / PIC / tenggat…" value="' + (cur.n || '').replace(/"/g, '&quot;') + '" oninput="rpCatat(\'' + k + '\',this.value)"></div>' +
      '<div class="st-nav">' + (p ? '<button class="back" onclick="mktBukaSub(\'' + p + '\')">← ' + NAMA[p] + '</button>' : '<span></span>') +
      (n ? '<button onclick="mktBukaSub(\'' + n + '\')">Lanjut: ' + NAMA[n] + ' →</button>' : '<button style="background:#059669" onclick="rpRekapBuka()">Selesai: Lihat Rekap 📝</button>') + '</div>';
    sub.appendChild(f);
  });

  var m = document.createElement('div'); m.id = 'rpRekap';
  m.innerHTML = '<div><h3 style="margin:0 0 8px">📝 Rekap Keputusan Rapat</h3><ul id="rpRekapList" style="padding-left:18px"></ul>' +
    '<button class="rp-mini" onclick="rpRekapSalin(this)">📋 Salin</button> <button class="rp-mini alt" onclick="document.getElementById(\'rpRekap\').classList.remove(\'open\')">Tutup</button>' +
    ' <button class="rp-mini" style="background:#64748b" onclick="rpRekapReset()">🗑️ Kosongkan</button></div>';
  document.body.appendChild(m);

  function teksRekap() {
    return URUT.filter(function (k) { return KEP[k] && (KEP[k].v || KEP[k].n); })
      .map(function (k) { return NAMA[k] + ': ' + (VONIS[KEP[k].v] || '-') + (KEP[k].n ? ' | ' + KEP[k].n : ''); });
  }
  window.rpPilih = function (k, v, el) {
    KEP[k] = KEP[k] || {}; KEP[k].v = KEP[k].v === v ? '' : v; simpan();
    el.parentNode.querySelectorAll('.rp-v').forEach(function (x) { x.classList.toggle('on', x.dataset.v === KEP[k].v); });
    tandai();
  };
  window.rpCatat = function (k, t) { KEP[k] = KEP[k] || {}; KEP[k].n = t; simpan(); tandai(); };
  window.rpRekapBuka = function () {
    var t = teksRekap();
    document.getElementById('rpRekapList').innerHTML = t.length ? t.map(function (x) { return '<li>' + x.replace(/</g, '&lt;') + '</li>'; }).join('') : '<li style="color:#94a3b8;list-style:none">Belum ada keputusan. Pilih Scale/Perbaiki/Stop di bawah tiap langkah.</li>';
    document.getElementById('rpRekap').classList.add('open');
  };
  window.rpRekapSalin = function (b) { navigator.clipboard.writeText('KEPUTUSAN RAPAT MARKETING\n- ' + teksRekap().join('\n- ')).then(function () { b.textContent = '✅ Tersalin'; setTimeout(function () { b.textContent = '📋 Salin'; }, 1500); }); };
  window.rpRekapReset = function () { if (confirm('Hapus semua keputusan?')) { KEP = {}; simpan(); location.reload(); } };
  window.rpPresentasi = function () {
    var on = document.body.classList.toggle('pres');
    document.getElementById('rpPresBtn').textContent = on ? '✖ Keluar Presentasi' : '🖥️ Mode Presentasi';
  };
  function tandai() { document.querySelectorAll('.st-step').forEach(function (e) { var d = KEP[e.dataset.k]; e.classList.toggle('has', !!(d && (d.v || d.n))); }); }

  // kendali keyboard ← → (tidak aktif saat mengetik)
  document.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) return;
    var i = URUT.indexOf(window._rpKini || URUT[0]);
    if (e.key === 'ArrowRight' && URUT[i + 1]) window.mktBukaSub(URUT[i + 1]);
    if (e.key === 'ArrowLeft' && URUT[i - 1]) window.mktBukaSub(URUT[i - 1]);
    if (e.key === 'Escape') document.body.classList.remove('pres');
  });

  var asli = window.mktBukaSub;
  window.mktBukaSub = function (k) {
    if (asli) asli.apply(this, arguments);
    window._rpKini = k;
    var i = URUT.indexOf(k);
    document.querySelectorAll('.st-step').forEach(function (el) {
      var j = URUT.indexOf(el.dataset.k); el.classList.toggle('on', j === i); el.classList.toggle('done', j < i);
    });
    document.getElementById('stProg').style.width = ((i + 1) / URUT.length * 100) + '%';
    document.getElementById('rpCount').textContent = 'Langkah ' + (i + 1) + ' dari ' + URUT.length + ' · ' + NAMA[k];
    if (k === 'audience' && typeof dataAudience !== 'undefined' && !dataAudience.length && window.muatDataAudience) muatDataAudience();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  tandai(); hitungKep();
})();
