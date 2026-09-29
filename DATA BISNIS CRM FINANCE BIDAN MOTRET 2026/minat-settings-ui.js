// =========================================================================
// minat-settings-ui.js — Modal "Mapping Minat" (project index-marketing.html)
// Muat SETELAH tenant-config.js & ui-marketing.js.
// Mengelola aturan keyword->minat, deteksi nilai belum termapping, simpan
// override ke localStorage, dan generate kode siap-tempel untuk config.
// =========================================================================

(function () {
  const STYLE_ID = 'msModalStyle';
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
#msModalOverlay { display:none; position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:9999; align-items:center; justify-content:center; padding:16px; }
#msModalOverlay.open { display:flex; }
#msModalBox { background:#fff; border-radius:12px; width:100%; max-width:820px; max-height:88vh; overflow:auto; padding:20px 22px; box-shadow:0 20px 50px rgba(0,0,0,.3); }
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
#msModalBox { position:relative; }
.ms-section { margin-top:18px; padding-top:14px; border-top:1px dashed #e2e8f0; }
.ms-belum-item { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #f1f5f9; font-size:12.5px; }
#msKodeOutput { width:100%; min-height:120px; font-family:monospace; font-size:11.5px; padding:10px; border:1px solid #cbd5e1; border-radius:8px; }
.ms-status-pill { display:inline-block; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:700; }
.ms-status-override { background:#dcfce7; color:#166534; }
.ms-status-default { background:#e0e7ff; color:#3730a3; }
`;
    document.head.appendChild(st);
  }

  const overlayHtml = `
<div id="msModalOverlay">
  <div id="msModalBox">
    <button type="button" id="msModalClose" onclick="msTutupModal()">✕</button>
    <h2>🏷️ Mapping Minat / Produk</h2>
    <p class="ms-sub">Aturan menentukan bagaimana nama campaign Meta Ads dikelompokkan jadi kategori "minat". Urutan penting — pattern pertama yang cocok yang dipakai.</p>
    <div style="margin-bottom:10px;">Status: <span id="msStatusPill" class="ms-status-pill">-</span></div>

    <table>
      <thead><tr><th style="width:45%;">Pattern (regex)</th><th style="width:35%;">Kategori Minat</th><th style="width:20%;"></th></tr></thead>
      <tbody id="msRulesBody"></tbody>
    </table>
    <div style="margin-top:8px;"><button type="button" class="ms-btn ms-btn-secondary" onclick="msTambahBarisKosong()">+ Tambah Aturan</button></div>

    <div class="ms-section">
      <b style="font-size:13px;">🔎 Belum Termapping</b>
      <p class="ms-sub" style="margin-top:2px;">Nilai campaign/minat dari data yang sedang dimuat, yang belum ketangkap aturan manapun.</p>
      <div id="msBelumList" style="max-height:160px; overflow:auto;"></div>
    </div>

    <div class="ms-section" style="display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="ms-btn ms-btn-primary" onclick="msSimpanDanBackfill()">💾 Simpan &amp; Backfill Sekarang</button>
      <button type="button" class="ms-btn ms-btn-secondary" onclick="msTampilkanKode()">📋 Salin sebagai Kode</button>
      <button type="button" class="ms-btn ms-btn-danger" onclick="msResetKeDefault()">↩️ Reset ke Default File</button>
    </div>

    <div id="msKodeWrap" style="display:none; margin-top:12px;">
      <textarea id="msKodeOutput" readonly></textarea>
      <div style="margin-top:6px;"><button type="button" class="ms-btn ms-btn-ghost" onclick="msSalinKode()">Salin ke Clipboard</button></div>
    </div>
  </div>
</div>`;

  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('beforeend', overlayHtml);
  });

  window.msRulesState = [];

  window.msBukaModal = function () {
    window.msRulesState = (typeof ambilMinatRulesAktifSerializable === 'function') ? ambilMinatRulesAktifSerializable() : [];
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

  window.msUbahBaris = function (i, field, val) { window.msRulesState[i][field] = val; };
  window.msPindahBaris = function (i, delta) {
    const j = i + delta;
    if (j < 0 || j >= window.msRulesState.length) return;
    const tmp = window.msRulesState[i]; window.msRulesState[i] = window.msRulesState[j]; window.msRulesState[j] = tmp;
    msRenderRules();
  };
  window.msHapusBaris = function (i) { window.msRulesState.splice(i, 1); msRenderRules(); };
  window.msTambahBarisKosong = function () { window.msRulesState.push({ pattern: '', minat: '' }); msRenderRules(); };

  // Kumpulkan nilai mentah dari data sesi yang sedang dimuat (dataMarketing/dataGlobal),
  // hitung kemunculan, filter yang belum ketangkap aturan MANAPUN (default ataupun draft saat ini).
  function msKumpulkanNilaiMentah_() {
    const sumber = [
      ...((window.dataMarketing || []).map(m => m.campaign)),
      ...((window.dataGlobal || []).map(r => r.minat))
    ].filter(Boolean);
    const hitung = {};
    sumber.forEach(v => { hitung[v] = (hitung[v] || 0) + 1; });
    return hitung;
  }

  function msRenderBelumTermapping() {
    const wrap = document.getElementById('msBelumList');
    const hitung = msKumpulkanNilaiMentah_();
    const draftRules = window.msRulesState.map(r => {
      try { return { pattern: new RegExp(r.pattern, 'i'), minat: r.minat }; } catch (e) { return null; }
    }).filter(Boolean);

    const belum = Object.keys(hitung).filter(nilai => !draftRules.some(r => r.pattern.test(nilai)))
      .sort((a, b) => hitung[b] - hitung[a]);

    wrap.innerHTML = belum.length === 0
      ? '<div style="color:#64748b; font-style:italic; font-size:12px;">Semua nilai pada data yang dimuat sudah termapping.</div>'
      : belum.map(nilai => `
        <div class="ms-belum-item">
          <span>${msEsc(nilai)} <span style="color:#94a3b8;">(${hitung[nilai]}x)</span></span>
          <button type="button" class="ms-btn ms-btn-secondary" style="padding:4px 10px; font-size:11px;" onclick="msJadikanAturan('${msEscJs(nilai)}')">+ Jadikan Aturan</button>
        </div>`).join('');
  }

  window.msJadikanAturan = function (nilaiAsli) {
    const escaped = nilaiAsli.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    window.msRulesState.push({ pattern: escaped, minat: nilaiAsli });
    msRenderRules();
    msRenderBelumTermapping();
  };

  window.msSimpanDanBackfill = function () {
    if (typeof simpanMinatRulesOverride !== 'function') { alert('❌ tenant-config.js belum termuat.'); return; }
    const jumlah = simpanMinatRulesOverride(window.msRulesState);
    msRenderStatus();
    msRenderBelumTermapping();
    if (typeof renderMarketingTab === 'function') renderMarketingTab();
    alert('✅ Tersimpan ' + jumlah + ' aturan. Tampilan Marketing sudah di-refresh dengan mapping baru.');
  };

  window.msResetKeDefault = function () {
    if (!confirm('Hapus override di browser ini dan kembali pakai default dari tenant-config.js?')) return;
    if (typeof hapusMinatRulesOverride === 'function') hapusMinatRulesOverride();
    window.msRulesState = (typeof ambilMinatRulesAktifSerializable === 'function') ? ambilMinatRulesAktifSerializable() : [];
    msRenderRules();
    msRenderStatus();
    msRenderBelumTermapping();
    if (typeof renderMarketingTab === 'function') renderMarketingTab();
  };

  window.msTampilkanKode = function () {
    const baris = window.msRulesState
      .filter(r => r.pattern && r.minat)
      .map(r => `    { pattern: /${r.pattern}/i, minat: "${r.minat.replace(/"/g, '\\"')}" },`)
      .join('\n');
    const kode = 'minatKeywordMap: [\n' + baris + '\n  ],';
    document.getElementById('msKodeOutput').value = kode;
    document.getElementById('msKodeWrap').style.display = 'block';
  };

  window.msSalinKode = function () {
    const ta = document.getElementById('msKodeOutput');
    ta.select();
    try { document.execCommand('copy'); alert('✅ Disalin ke clipboard.'); }
    catch (e) { alert('Gagal menyalin otomatis — salin manual dari kotak teks.'); }
  };

  function msEsc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function msEscJs(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
})();