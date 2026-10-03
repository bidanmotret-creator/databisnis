// =========================================================================
// ambang-ui.js — Ambang diatur dari UI (satu sumber: backend Ambang.gs)
// Muat SETELAH tenant-config.js dan nav.js. Letakkan sebelum ui-marketing.js bila bisa;
// bila setelahnya pun aman karena nilai dibaca lewat ambilThreshold() saat render.
// Alur: salinan bawaan tenant-config.js disimpan -> backend memberi nilai aktif -> ditimpa ke
// TENANT_CONFIG.thresholds -> semua tampilan yang memakai ambilThreshold()/ambilThreshold_() ikut.
// =========================================================================

const AMB = { bawaanFront: Object.assign({}, TENANT_CONFIG.thresholds), bawaanBackend: {}, backendAktif: {}, override: {}, batas: {}, dimuat: false, err: '' };

const AMB_FIELD = [
  { grup: '🧪 Penilaian iklan, konten, dan tes promo', f: [
    ['kontenMinSpendRp', 'Spend minimum sebelum ada vonis (Rp)', 'Di bawah ini iklan/promo berstatus "belum cukup data".'],
    ['kontenMinImpresi', 'Impresi minimum', 'Di bawah ini konten belum dinilai.'],
    ['promoMinResults', 'Leads (results Meta) minimum', 'Dipakai Papan Tes Promo, tes penawaran, dan vonis konten.'],
    ['promoBandPersen', 'Batas "setara" antar promo (±%)', 'CPL dalam rentang ini terhadap pembanding dianggap setara.'],
    ['minLeadsCekClosing', 'Leads CRM minimum sebelum curiga "murah tapi tak closing"', 'Hanya dipakai backend (vonis konten).']
  ] },
  { grup: '💸 Vonis biaya (Drill-down, Adset, Creative)', f: [
    ['cplMahalRp', 'CPL dianggap mahal di atas (Rp)', 'Baris CPL berwarna merah di atas nilai ini.'],
    ['efisienDariRataRataPersen', 'Efisien bila CPL lebih murah dari rata-rata sebesar (%)', 'Mis. 30 berarti CPL < 70% rata-rata.'],
    ['adsetBorosMinSpendRp', 'Spend minimum untuk label "boros" (Rp)', 'Adset/creative tanpa hasil di atas nilai ini dianggap boros.'],
    ['polaBerulangMinSpendRp', 'Spend minimum pola berulang lintas campaign (Rp)', '']
  ] },
  { grup: '📊 Funnel dan scorecard', f: [
    ['ctrRendahPersen', 'CTR rendah di bawah (%)', ''],
    ['matchRateSehatPersen', 'Match rate sehat minimal (%)', ''],
    ['roasSehat', 'ROAS sehat minimal (x)', ''],
    ['roasTipisBawah', 'ROAS "untung tipis" mulai dari (x)', 'Di bawah ini dianggap belum untung.'],
    ['crSehatPersen', 'Conv. rate sehat minimal (%)', ''],
    ['crWaspadaPersen', 'Conv. rate waspada minimal (%)', 'Harus ≤ nilai sehat.'],
    ['clickToLeadSehatPersen', 'Click→Lead sehat minimal (%)', ''],
    ['clickToLeadWaspadaPersen', 'Click→Lead waspada minimal (%)', '']
  ] }
];

function ambBawaan_(k) {
  if (Object.prototype.hasOwnProperty.call(AMB.bawaanBackend, k)) return AMB.bawaanBackend[k];
  return AMB.bawaanFront[k];
}
function ambAktif_(k) {
  if (Object.prototype.hasOwnProperty.call(AMB.override, k)) return Number(AMB.override[k]);
  if (Object.prototype.hasOwnProperty.call(AMB.backendAktif, k)) return AMB.backendAktif[k];
  return AMB.bawaanFront[k];
}

function ambTerapkanLokal_() {
  const T = TENANT_CONFIG.thresholds;
  Object.keys(AMB.bawaanFront).forEach(k => { T[k] = AMB.bawaanFront[k]; });
  Object.keys(AMB.backendAktif).forEach(k => { T[k] = AMB.backendAktif[k]; });
  Object.keys(AMB.override).forEach(k => { T[k] = Number(AMB.override[k]); });
}

function ambGambarUlang_() {
  ['renderMarketingTab', 'ptRender', 'kbRender', 'renderDrilldownIklan', 'fiRender'].forEach(nama => {
    try { if (typeof window[nama] === 'function') window[nama](); } catch (e) { console.error('Gambar ulang ' + nama + ' gagal:', e); }
  });
}

async function ambMuat() {
  try {
    let res;
    try { res = await fetchJsonAman(scriptURL + '?action=getAmbang'); }
    catch (e1) { await new Promise(r => setTimeout(r, 1500)); res = await fetchJsonAman(scriptURL + '?action=getAmbang'); }   // Web App kadang 404 sporadis
    if (!res || res.result !== 'success') throw new Error((res && res.message) || 'Respon tidak valid');
    AMB.bawaanBackend = res.bawaan_backend || {}; AMB.backendAktif = res.backend || {};
    AMB.override = res.override || {}; AMB.batas = res.batas || {};
    AMB.dimuat = true; AMB.err = '';
    ambTerapkanLokal_();
    ambGambarUlang_();
  } catch (err) {
    AMB.err = String((err && err.message) || err);
    console.warn('Ambang dari backend tidak dimuat, memakai tenant-config.js:', AMB.err);
  }
}

// ------------------------------------------------------------ MODAL
function ambPastikanModal_() {
  let m = document.getElementById('ambModal');
  if (m) return m;
  m = document.createElement('div');
  m.id = 'ambModal';
  m.style.cssText = 'display:none; position:fixed; inset:0; background:rgba(15,23,42,.6); z-index:9999; align-items:center; justify-content:center;';
  m.innerHTML = '<div style="background:#fff; border-radius:14px; padding:20px 22px; width:min(760px,94vw); max-height:88vh; overflow-y:auto;">' +
    '<div style="display:flex; justify-content:space-between; align-items:center;"><b style="font-size:16px;">⚙️ Ambang penilaian</b>' +
    '<button type="button" onclick="ambTutup()" style="border:none; background:none; font-size:20px; cursor:pointer;">×</button></div>' +
    '<p style="font-size:12px; color:#64748b; margin:4px 0 12px;">Satu sumber untuk dashboard, vonis konten, ringkasan AI, dan Telegram. Kolom "Bawaan" adalah nilai awal sistem; hanya nilai yang Anda ubah yang disimpan.</p>' +
    '<div id="ambIsi"></div><div id="ambPesan" style="font-size:12.5px; margin:10px 0 0;"></div>' +
    '<div style="display:flex; gap:8px; justify-content:flex-end; margin-top:14px; border-top:1px solid #e2e8f0; padding-top:12px;">' +
    '<button type="button" onclick="ambKembalikan()" style="padding:9px 14px; border:1px solid #cbd5e1; background:#fff; border-radius:7px; font-weight:700; cursor:pointer;">↺ Kembalikan semua ke bawaan</button>' +
    '<button type="button" onclick="ambTutup()" style="padding:9px 14px; border:none; background:#f1f5f9; border-radius:7px; font-weight:700; cursor:pointer;">Batal</button>' +
    '<button type="button" id="ambBtnSimpan" onclick="ambSimpan()" style="padding:9px 16px; border:none; background:#166534; color:#fff; border-radius:7px; font-weight:700; cursor:pointer;">💾 Simpan</button></div></div>';
  document.body.appendChild(m);
  return m;
}

function ambBuka() {
  const m = ambPastikanModal_();
  const inp = 'width:130px; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; text-align:right;';
  let html = AMB.err ? '<div style="background:#fef3c7; color:#92400e; padding:8px 10px; border-radius:6px; font-size:12px; margin-bottom:10px;">⚠️ Ambang backend belum bisa dimuat (' + penEscAmb_(AMB.err) + '). Route <code>getAmbang</code> mungkin belum dipasang. Nilai di bawah berasal dari tenant-config.js dan belum bisa disimpan.</div>' : '';
  AMB_FIELD.forEach(g => {
    html += '<div style="font-weight:800; font-size:13px; margin:12px 0 4px;">' + g.grup + '</div><table style="width:100%; border-collapse:collapse; font-size:12.5px;">';
    g.f.forEach(x => {
      const k = x[0], aktif = ambAktif_(k), bw = ambBawaan_(k);
      if (aktif === undefined && bw === undefined) return;
      html += '<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 8px 6px 0;"><div style="font-weight:600;">' + x[1] + '</div>' + (x[2] ? '<div style="font-size:11px; color:#94a3b8;">' + x[2] + '</div>' : '') + '</td>' +
        '<td style="width:120px; text-align:right; color:#94a3b8; font-size:11.5px;">Bawaan: ' + (bw === undefined ? '-' : Number(bw).toLocaleString('id-ID')) + '</td>' +
        '<td style="width:140px; text-align:right;"><input type="number" step="any" data-amb="' + k + '" value="' + (aktif === undefined ? '' : aktif) + '" style="' + inp + '"></td></tr>';
    });
    html += '</table>';
  });
  document.getElementById('ambIsi').innerHTML = html;
  document.getElementById('ambPesan').textContent = '';
  m.style.display = 'flex';
}
function penEscAmb_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function ambTutup() { const m = document.getElementById('ambModal'); if (m) m.style.display = 'none'; }

async function ambKirim_(obj, tombol) {
  const pesan = document.getElementById('ambPesan');
  pesan.style.color = '#64748b'; pesan.textContent = '⏳ Menyimpan...';
  if (tombol) tombol.disabled = true;
  try {
    const fd = new FormData();
    fd.append('action', 'simpanAmbang');
    fd.append('ambangJson', JSON.stringify(obj));
    const res = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
    if (!res || res.result !== 'success') throw new Error((res && res.message) || 'Handler simpanAmbang belum dipasang di backend.');
    AMB.override = res.override || {};
    ambTerapkanLokal_();
    // nilai backend aktif ikut berubah; muat ulang agar form dan peringatan sinkron
    await ambMuat();
    ambGambarUlang_();
    pesan.style.color = '#047857';
    pesan.textContent = '✅ Tersimpan. Berlaku untuk dashboard dan backend. Status per iklan di cache funnel memakai ambang baru setelah cache diperbarui.';
    ambBuka();
    document.getElementById('ambPesan').style.color = '#047857';
    document.getElementById('ambPesan').textContent = '✅ Tersimpan.';
  } catch (err) {
    pesan.style.color = '#b91c1c'; pesan.textContent = '❌ ' + String((err && err.message) || err);
  } finally {
    if (tombol) tombol.disabled = false;
  }
}

function ambSimpan() {
  const diff = {};
  let salah = '';
  document.querySelectorAll('#ambIsi input[data-amb]').forEach(el => {
    const k = el.dataset.amb;
    if (el.value === '') { salah = 'Isi semua kolom (kolom kosong tidak diizinkan).'; return; }
    const v = Number(el.value);
    if (!isFinite(v)) { salah = 'Nilai "' + k + '" bukan angka.'; return; }
    const bw = ambBawaan_(k);
    if (bw === undefined || Number(bw) !== v) diff[k] = v;
  });
  if (salah) { const p = document.getElementById('ambPesan'); p.style.color = '#b91c1c'; p.textContent = '❌ ' + salah; return; }
  ambKirim_(diff, document.getElementById('ambBtnSimpan'));
}
function ambKembalikan() {
  if (!confirm('Kembalikan SEMUA ambang ke nilai bawaan?')) return;
  ambKirim_({}, document.getElementById('ambBtnSimpan'));
}

// ------------------------------------------------------------ TOMBOL DI TOOLBAR
function ambPasangTombol_() {
  ['mktSub_funnel', 'mktSub_konten', 'mktSub_promo', 'mktSub_drill'].forEach(id => {
    const sub = document.getElementById(id);
    if (!sub || sub.querySelector('.amb-btn')) return;
    const tb = sub.querySelector('.mkt-toolbar-btns') || sub.querySelector('.mkt-toolbar');
    if (!tb) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mkt-btn amb-btn'; b.textContent = '⚙️ Ambang';
    b.title = 'Atur ambang penilaian (spend minimum, batas setara, dll)';
    b.onclick = ambBuka;
    tb.insertBefore(b, tb.firstChild);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  ambPasangTombol_();
  setTimeout(ambMuat, 300);
});
