// =========================================================================
// minat-settings-ui.js  (VERSI BARU — fokus: Mapping Minat)
// Muat SETELAH tenant-config.js & ui-marketing.js (urutan <script> tidak berubah).
//
// Yang berubah dibanding versi lama:
//  1. "Belum Termapping" sekarang menguji NAMA CAMPAIGN MENTAH dari Meta
//     (dataMarketing[].nama_campaign_meta), bukan kolom "campaign" yang sudah
//     berisi hasil mapping lama. (Itu sebabnya sebelumnya selalu tampil
//     "semua sudah termapping".)
//  2. Rekomendasi kata kunci: dikelompokkan dari token yang berulang, diurut
//     berdasarkan total Ad Spend, nama minat & pattern bisa diedit sebelum
//     dijadikan aturan.
//  3. Aturan minat sekarang juga MENULIS ULANG kolom campaign/minat di data
//     Ads (dataMarketing[].campaign) sebelum tiap render Marketing, jadi semua
//     tabel/chart/filter yang membaca m.campaign ikut berubah.
//     Nama asli disimpan di m._campaign_asli (tidak hilang).
// =========================================================================

(function () {
  const STYLE_ID = 'msModalStyle';
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
#msModalOverlay { display:none; position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:9999; align-items:center; justify-content:center; padding:16px; }
#msModalOverlay.open { display:flex; }
#msModalBox { background:#fff; border-radius:12px; width:100%; max-width:880px; max-height:88vh; overflow:auto; padding:20px 22px; box-shadow:0 20px 50px rgba(0,0,0,.3); position:relative; }
#msModalBox h2 { margin:0 0 4px; font-size:17px; color:#1e1b4b; }
#msModalBox .ms-sub { font-size:12px; color:#64748b; margin:0 0 14px; }
#msModalBox table { width:100%; border-collapse:collapse; font-size:12.5px; }
#msModalBox th, #msModalBox td { padding:6px 8px; border-bottom:1px solid #e2e8f0; text-align:left; }
#msModalBox th { background:#f1f5f9; }
#msModalBox input[type=text] { width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12.5px; }
.ms-row-actions button { border:none; background:none; cursor:pointer; font-size:14px; padding:2px 5px; }
.ms-btn { padding:8px 14px; border:none; border-radius:8px; font-weight:700; font-size:12.5px; cursor:pointer; }
.ms-btn-primary { background:#4338ca; color:#fff; }
.ms-btn-secondary { background:#e0e7ff; color:#312e81; }
.ms-btn-danger { background:#fee2e2; color:#991b1b; }
.ms-btn-ghost { background:#f1f5f9; color:#334155; }
#msModalClose { position:absolute; top:14px; right:16px; background:none; border:none; font-size:20px; cursor:pointer; color:#64748b; }
.ms-section { margin-top:18px; padding-top:14px; border-top:1px dashed #e2e8f0; }
.ms-saran { border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; margin-bottom:8px; background:#fafafe; }
.ms-saran-head { font-size:12px; color:#475569; margin-bottom:6px; }
.ms-saran-contoh { font-size:11px; color:#64748b; margin:2px 0 8px; line-height:1.5; }
.ms-saran-form { display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:center; }
@media (max-width:640px){ .ms-saran-form { grid-template-columns:1fr; } }
#msKodeOutput { width:100%; min-height:120px; font-family:monospace; font-size:11.5px; padding:10px; border:1px solid #cbd5e1; border-radius:8px; }
.ms-status-pill { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; }
.ms-status-override { background:#dcfce7; color:#166534; }
.ms-status-default { background:#e0e7ff; color:#3730a3; }
.ms-badge-sum { display:inline-block; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:700; margin-right:6px; }
.ms-badge-ok { background:#dcfce7; color:#166534; }
.ms-badge-warn { background:#fef3c7; color:#92400e; }
`;
    document.head.appendChild(st);
  }

  const overlayHtml = `
<div id="msModalOverlay">
  <div id="msModalBox">
    <button type="button" id="msModalClose" onclick="msTutupModal()">✕</button>
    <h2>🏷️ Mapping Minat / Produk</h2>
    <p class="ms-sub">Aturan mengelompokkan <b>nama campaign Meta Ads</b> jadi kategori "minat". Urutan penting — pattern pertama yang cocok yang dipakai. Hasilnya langsung mengubah kolom <b>Campaign (Minat)</b> di data Ads.</p>
    <div style="margin-bottom:10px;">Status: <span id="msStatusPill" class="ms-status-pill">-</span> <span id="msRingkasan"></span></div>

    <table>
      <thead><tr><th style="width:45%;">Pattern (regex, tidak peka huruf besar/kecil)</th><th style="width:35%;">Kategori Minat</th><th style="width:20%;"></th></tr></thead>
      <tbody id="msRulesBody"></tbody>
    </table>
    <div style="margin-top:8px;"><button type="button" class="ms-btn ms-btn-secondary" onclick="msTambahBarisKosong()">+ Tambah Aturan</button></div>

    <div class="ms-section">
      <b style="font-size:13px;">🔎 Campaign Belum Termapping</b>
      <p class="ms-sub" style="margin-top:2px;">Nama campaign mentah dari Meta (sesuai filter tanggal yang aktif di dashboard) yang belum cocok dengan aturan manapun di atas. Kata kunci yang berulang di beberapa campaign dikelompokkan jadi satu rekomendasi. Nama minat &amp; pattern bisa kamu edit dulu sebelum dipakai.</p>
      <div id="msBelumList" style="max-height:300px; overflow:auto;"></div>
    </div>

    <div class="ms-section" style="display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="ms-btn ms-btn-primary" onclick="msSimpanDanBackfill()">💾 Simpan &amp; Terapkan ke Data Ads</button>
      <button type="button" class="ms-btn ms-btn-secondary" onclick="msTampilkanKode()">📋 Salin sebagai Kode</button>
      <button type="button" class="ms-btn ms-btn-danger" onclick="msResetKeDefault()">↩️ Reset ke Default File</button>
    </div>

    <div id="msKodeWrap" style="display:none; margin-top:12px;">
      <textarea id="msKodeOutput" readonly></textarea>
      <div style="margin-top:6px;"><button type="button" class="ms-btn ms-btn-ghost" onclick="msSalinKode()">Salin ke Clipboard</button></div>
    </div>
  </div>
</div>`;

  window.msRulesState = [];
  window.msSaranState = [];

  // -----------------------------------------------------------------------
  // Helper aturan
  // -----------------------------------------------------------------------
  function msCompile_(rules) {
    return (rules || []).map(r => {
      try { return r && r.pattern ? { re: new RegExp(r.pattern, 'i'), minat: r.minat } : null; }
      catch (e) { return null; }
    }).filter(Boolean);
  }

  // Aturan yang sedang AKTIF dipakai aplikasi (bukan draft di modal).
  function msRulesAktif_() {
    if (typeof ambilMinatRulesAktifSerializable === 'function') {
      try { return ambilMinatRulesAktifSerializable() || []; } catch (e) {}
    }
    return [];
  }

  function msCocokkan_(compiled, teks) {
    for (const r of compiled) { if (r.re.test(teks)) return r.minat; }
    return null;
  }

  // -----------------------------------------------------------------------
  // INTI: tulis ulang kolom campaign/minat di data Ads berdasarkan aturan aktif.
  // Nama asli dari backend disimpan di _campaign_asli supaya bisa di-reset.
  // Kalau tidak ada aturan yang cocok -> kembali ke nilai asli backend.
  // -----------------------------------------------------------------------
  window.msTerapkanMinatKeDataAds = function () {
    if (!Array.isArray(window.dataMarketing) && typeof dataMarketing === 'undefined') return 0;
    const arr = (typeof dataMarketing !== 'undefined') ? dataMarketing : window.dataMarketing;
    if (!Array.isArray(arr) || arr.length === 0) return 0;

    const compiled = msCompile_(msRulesAktif_());
    let berubah = 0;
    arr.forEach(m => {
      if (m._campaign_asli === undefined) m._campaign_asli = m.campaign;
      const raw = m.nama_campaign_meta || m._campaign_asli || '';
      const hasil = compiled.length ? msCocokkan_(compiled, raw) : null;
      const baru = hasil || m._campaign_asli;
      if (m.campaign !== baru) { m.campaign = baru; berubah++; }
    });
    return berubah;
  };

  // Bungkus renderMarketingTab supaya mapping selalu diterapkan sebelum render
  // (termasuk saat data baru ditarik dari server / tombol Refresh).
  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('beforeend', overlayHtml);

    if (typeof window.renderMarketingTab === 'function' && !window.renderMarketingTab._msWrapped) {
      const asli = window.renderMarketingTab;
      const bungkus = function () {
        try { msTerapkanMinatKeDataAds(); } catch (e) { console.error('Gagal terapkan mapping minat:', e); }
        return asli.apply(this, arguments);
      };
      bungkus._msWrapped = true;
      window.renderMarketingTab = bungkus;
    }
  });

  // -----------------------------------------------------------------------
  // Modal
  // -----------------------------------------------------------------------
  window.msBukaModal = function () {
    window.msRulesState = msRulesAktif_().map(r => ({ pattern: r.pattern, minat: r.minat }));
    msRenderRules();
    msRenderStatus();
    msRenderBelumTermapping();
    document.getElementById('msKodeWrap').style.display = 'none';
    document.getElementById('msModalOverlay').classList.add('open');
  };

  window.msTutupModal = function () {
    document.getElementById('msModalOverlay').classList.remove('open');
  };

  function msRenderStatus() {
    const pill = document.getElementById('msStatusPill');
    const pakaiOverride = (typeof sedangPakaiMinatOverride === 'function') && sedangPakaiMinatOverride();
    pill.textContent = pakaiOverride ? 'Override aktif (localStorage)' : 'Default file (tenant-config.js)';
    pill.className = 'ms-status-pill ' + (pakaiOverride ? 'ms-status-override' : 'ms-status-default');
  }

  function msRenderRules() {
    const tbody = document.getElementById('msRulesBody');
    tbody.innerHTML = window.msRulesState.map((r, i) => `
      <tr>
        <td><input type="text" value="${msEsc(r.pattern)}" onchange="msUbahBaris(${i}, 'pattern', this.value)"></td>
        <td><input type="text" value="${msEsc(r.minat)}" onchange="msUbahBaris(${i}, 'minat', this.value)"></td>
        <td class="ms-row-actions">
          <button title="Naik" onclick="msPindahBaris(${i}, -1)">⬆️</button>
          <button title="Turun" onclick="msPindahBaris(${i}, 1)">⬇️</button>
          <button title="Hapus" onclick="msHapusBaris(${i})">🗑️</button>
        </td>
      </tr>`).join('') || '<tr><td colspan="3" style="text-align:center; color:#94a3b8; padding:12px;">Belum ada aturan.</td></tr>';
  }

  window.msUbahBaris = function (i, field, val) {
    window.msRulesState[i][field] = val;
    msRenderBelumTermapping();           // live: daftar belum termapping ikut berubah
  };
  window.msPindahBaris = function (i, delta) {
    const j = i + delta;
    if (j < 0 || j >= window.msRulesState.length) return;
    const tmp = window.msRulesState[i]; window.msRulesState[i] = window.msRulesState[j]; window.msRulesState[j] = tmp;
    msRenderRules(); msRenderBelumTermapping();
  };
  window.msHapusBaris = function (i) { window.msRulesState.splice(i, 1); msRenderRules(); msRenderBelumTermapping(); };
  window.msTambahBarisKosong = function () { window.msRulesState.push({ pattern: '', minat: '' }); msRenderRules(); };

  // -----------------------------------------------------------------------
  // Kumpulkan NAMA CAMPAIGN MENTAH dari data Ads (mengikuti filter tanggal
  // dashboard supaya relevan dengan yang sedang dilihat).
  // -----------------------------------------------------------------------
  function msKumpulkanCampaignMentah_() {
    const arr = (typeof dataMarketing !== 'undefined') ? dataMarketing : [];
    const fStart = document.getElementById('fMktStart')?.value || '';
    const fEnd = document.getElementById('fMktEnd')?.value || '';
    const peta = {}; // nama mentah -> {nama, spend, baris, saatIni}
    (arr || []).forEach(m => {
      if (typeof formati === 'function') {
        const t = formati(m.tanggal);
        if (fStart && t < fStart) return;
        if (fEnd && t > fEnd) return;
      }
      const nama = m.nama_campaign_meta || m._campaign_asli || m.campaign;
      if (!nama) return;
      if (!peta[nama]) peta[nama] = { nama, spend: 0, baris: 0, saatIni: m.campaign };
      peta[nama].spend += Number(m.spend) || 0;
      peta[nama].baris++;
    });
    return Object.values(peta);
  }

  // Kata umum jargon iklan yang hampir pasti bukan nama produk.
  const MS_STOPWORDS = new Set([
    'copy','bofu','tofu','mofu','ctwa','cbo','abo','bidcap','vv','ig','visit','engage','follow','follower',
    'profile','video','foto','poster','iklan','ads','ad','campaign','kampanye','the','dan','di','ke','dari',
    'untuk','dengan','atau','yang','per','cpl','rb','ribu','jt','juta','jan','feb','mar','apr','mei','jun',
    'jul','agu','sep','okt','nov','des','hari','minggu','bulan','wincon','test','testing','baru','lama','new','old',
    'leads','lead','traffic','reach','awareness','conversion','conversions','sales','message','messages','whatsapp'
  ]);

  function msTokenisasi_(teks) {
    return String(teks || '').toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(t => t.length >= 4 && !/^\d+$/.test(t) && !MS_STOPWORDS.has(t));
  }

  const rpFmt = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

  function msBangunSaran_(belum) {
    const tokenPerNama = {}, frek = {};
    belum.forEach(c => {
      const toks = [...new Set(msTokenisasi_(c.nama))];
      tokenPerNama[c.nama] = toks;
      toks.forEach(t => { frek[t] = (frek[t] || 0) + 1; });
    });

    const sisa = new Map(belum.map(c => [c.nama, c]));
    const saran = [];

    Object.keys(frek).filter(t => frek[t] >= 2)
      .sort((a, b) => frek[b] - frek[a] || a.localeCompare(b))
      .forEach(token => {
        const anggota = [...sisa.values()].filter(c => tokenPerNama[c.nama].includes(token));
        if (anggota.length < 2) return;
        anggota.forEach(c => sisa.delete(c.nama));
        saran.push({ tipe: 'kelompok', pattern: token, minat: token.charAt(0).toUpperCase() + token.slice(1), anggota });
      });

    // Sisanya: 1 rekomendasi per campaign. Pakai token pertama yang bermakna
    // kalau ada, kalau tidak pakai nama persis (escape).
    [...sisa.values()].forEach(c => {
      const toks = tokenPerNama[c.nama];
      const pattern = toks.length ? toks[0] : c.nama.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const minat = toks.length ? toks[0].charAt(0).toUpperCase() + toks[0].slice(1) : c.nama;
      saran.push({ tipe: 'tunggal', pattern, minat, anggota: [c] });
    });

    // Urut: total spend terbesar dulu (yang paling berdampak ke angka).
    saran.forEach(s => { s.totalSpend = s.anggota.reduce((a, c) => a + c.spend, 0); });
    saran.sort((a, b) => b.totalSpend - a.totalSpend);
    return saran;
  }

  function msRenderBelumTermapping() {
    const wrap = document.getElementById('msBelumList');
    const ring = document.getElementById('msRingkasan');
    const semua = msKumpulkanCampaignMentah_();
    const compiled = msCompile_(window.msRulesState);
    const belum = semua.filter(c => !msCocokkan_(compiled, c.nama));

    if (ring) {
      ring.innerHTML = semua.length === 0
        ? ''
        : `<span class="ms-badge-sum ms-badge-ok">${semua.length - belum.length} termapping</span>` +
          `<span class="ms-badge-sum ${belum.length ? 'ms-badge-warn' : 'ms-badge-ok'}">${belum.length} belum</span>`;
    }

    if (semua.length === 0) {
      wrap.innerHTML = '<div style="color:#64748b; font-style:italic; font-size:12px;">Data Ads belum dimuat / kosong pada filter tanggal aktif. Tutup modal, klik Refresh, lalu buka lagi.</div>';
      window.msSaranState = [];
      return;
    }
    if (belum.length === 0) {
      wrap.innerHTML = '<div style="color:#166534; font-size:12px;">✅ Semua nama campaign pada periode ini sudah cocok dengan minimal satu aturan.</div>';
      window.msSaranState = [];
      return;
    }

    window.msSaranState = msBangunSaran_(belum);
    wrap.innerHTML = window.msSaranState.map((s, i) => {
      const contoh = s.anggota.slice(0, 3).map(c => msEsc(c.nama)).join('<br>');
      const lebih = s.anggota.length > 3 ? `<br><span style="color:#94a3b8;">+${s.anggota.length - 3} campaign lain</span>` : '';
      const judul = s.tipe === 'kelompok'
        ? `💡 Kata kunci <b>${msEsc(s.pattern)}</b> berulang di ${s.anggota.length} campaign`
        : `Campaign tunggal`;
      return `
      <div class="ms-saran">
        <div class="ms-saran-head">${judul} · Ad Spend <b>${rpFmt(s.totalSpend)}</b></div>
        <div class="ms-saran-contoh">${contoh}${lebih}</div>
        <div class="ms-saran-form">
          <input type="text" id="msSaranPattern_${i}" value="${msEsc(s.pattern)}" title="Pattern (regex)">
          <input type="text" id="msSaranMinat_${i}" value="${msEsc(s.minat)}" title="Nama minat">
          <button type="button" class="ms-btn ms-btn-primary" style="padding:6px 12px; font-size:11.5px; white-space:nowrap;" onclick="msPakaiSaran(${i})">+ Jadikan Aturan</button>
        </div>
      </div>`;
    }).join('');
  }

  window.msPakaiSaran = function (i) {
    const pattern = (document.getElementById('msSaranPattern_' + i)?.value || '').trim();
    const minat = (document.getElementById('msSaranMinat_' + i)?.value || '').trim();
    if (!pattern || !minat) { alert('Pattern dan nama minat tidak boleh kosong.'); return; }
    try { new RegExp(pattern, 'i'); } catch (e) { alert('Pattern bukan regex yang valid: ' + e.message); return; }
    window.msRulesState.push({ pattern, minat });
    msRenderRules();
    msRenderBelumTermapping();
  };

  window.msSimpanDanBackfill = async function () {
    if (typeof simpanMinatRulesOverride !== 'function') { alert('❌ tenant-config.js belum termuat.'); return; }
    const valid = window.msRulesState.filter(r => r.pattern && r.minat);
    for (const r of valid) {
      try { new RegExp(r.pattern, 'i'); } catch (e) { alert('Pattern tidak valid: "' + r.pattern + '"\n' + e.message); return; }
    }
    const jumlah = simpanMinatRulesOverride(valid);   // cache lokal (browser ini)
    const berubahLokal = msTerapkanMinatKeDataAds();
    msRenderStatus();

    // Simpan ke sheet + tulis ulang kolom campaign/minat di Data_Ads (Apps Script)
    let pesanServer = '';
    try {
      let fd = new FormData();
      fd.append('action', 'saveMappingMinat');
      fd.append('rulesJson', JSON.stringify(valid));
      let res = await (await fetch(scriptURL, { method: 'POST', body: fd })).json();
      if (res.result !== 'success') throw new Error(res.message || 'gagal simpan aturan');

      fd = new FormData();
      fd.append('action', 'backfillMinatDataAds');
      res = await (await fetch(scriptURL, { method: 'POST', body: fd })).json();
      if (res.result !== 'success') throw new Error(res.message || 'gagal backfill');
      pesanServer = '\n\n🗂️ Data_Ads: ' + res.message + (res.tidakCocok ? ' (' + res.tidakCocok + ' baris tidak cocok aturan, dibiarkan)' : '');
      if (typeof tarikDataServer === 'function') await tarikDataServer();
    } catch (err) {
      pesanServer = '\n\n⚠️ Data_Ads di sheet BELUM berubah: ' + err.message +
        '\n(Tampilan dashboard tetap sudah memakai aturan baru. Cek MinatMapping.gs sudah ditempel & di-deploy ulang.)';
    }

    msRenderBelumTermapping();
    if (typeof renderMarketingTab === 'function') renderMarketingTab();
    alert('✅ Tersimpan ' + jumlah + ' aturan (' + berubahLokal + ' baris berubah di tampilan).' + pesanServer);
  };

  window.msResetKeDefault = function () {
    if (!confirm('Hapus override di browser ini dan kembali pakai default dari tenant-config.js?')) return;
    if (typeof hapusMinatRulesOverride === 'function') hapusMinatRulesOverride();
    window.msRulesState = msRulesAktif_().map(r => ({ pattern: r.pattern, minat: r.minat }));
    msTerapkanMinatKeDataAds();
    msRenderRules(); msRenderStatus(); msRenderBelumTermapping();
    if (typeof renderMarketingTab === 'function') renderMarketingTab();
  };

  window.msTampilkanKode = function () {
    const baris = window.msRulesState
      .filter(r => r.pattern && r.minat)
      .map(r => `    { pattern: /${r.pattern}/i, minat: "${r.minat.replace(/"/g, '\\"')}" },`)
      .join('\n');
    document.getElementById('msKodeOutput').value = 'minatKeywordMap: [\n' + baris + '\n  ],';
    document.getElementById('msKodeWrap').style.display = 'block';
  };

  window.msSalinKode = function () {
    const ta = document.getElementById('msKodeOutput');
    ta.select();
    try { document.execCommand('copy'); alert('✅ Disalin ke clipboard.'); }
    catch (e) { alert('Gagal menyalin otomatis — salin manual dari kotak teks.'); }
  };

  function msEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
})();