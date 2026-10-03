// =========================================================================
// api-marketing.js — versi api.js yang dipangkas khusus untuk halaman
// Analisis Marketing (index-marketing.html). Hanya menarik & menampilkan
// data marketing/Meta Ads; bagian Laporan Keuangan dihapus supaya halaman
// ini ringan & berdiri sendiri.
//
// PERUBAHAN (patch):
//  1. tarikDataServer: error render dipisah dari error server, dan pesan
//     tampil di banner (bukan alert) supaya tidak menyesatkan.
//  2. jalankanAnalisisMarketingAI: ditambah bagian 'produk'.
// =========================================================================

// Banner error non-blokir (pengganti alert). Dibuat sekali, dipakai ulang.
function tampilkanBannerMkt_(pesan) {
  let el = document.getElementById('bannerErrorMkt');
  if (!el) {
    el = document.createElement('div');
    el.id = 'bannerErrorMkt';
    el.style.cssText = 'background:#fee2e2; color:#991b1b; padding:10px 16px; border-radius:8px; font-size:12.5px; font-weight:600; margin-bottom:14px; white-space:pre-wrap;';
    const wadah = document.getElementById('tabMarketing');
    if (wadah) wadah.insertBefore(el, wadah.firstChild); else document.body.insertBefore(el, document.body.firstChild);
  }
  el.textContent = pesan;
  el.style.display = 'block';
}
function sembunyikanBannerMkt_() {
  const el = document.getElementById('bannerErrorMkt');
  if (el) el.style.display = 'none';
}

async function tarikDataServer() {
  let dataDiterima = false;
  try {
    const data = await fetchJsonAman(scriptURL + '?action=getData');

    // dataGlobal (Leads) tetap ditarik karena dipakai untuk funnel Leads/Closing/Revenue
    dataGlobal = data.clients || [];

    dataMarketing = data.marketing || [];
    STUDIO_CONFIG = data.config || STUDIO_CONFIG;
    dataAdsetPerformance = data.adsetPerformance || [];
    dataAdsetCityTargeting = data.adsetCityTargeting || [];
    dataContent = data.adContentPerformance || [];
    dataTargetMingguanMarketing = data.targetMingguanMarketing || { global: null, perProduk: {} };

    window.mktTerakhirMuat = new Date();
    dataDiterima = true;
    sembunyikanBannerMkt_();
  } catch (err) {
    // Error di sini = masalah SERVER / koneksi / URL Apps Script.
    console.error('Gagal memuat data dari server:', err);
    tampilkanBannerMkt_('❌ Gagal memuat data dari server. Cek koneksi atau URL Apps Script (scriptURL).\n' + (err && err.message ? err.message : err));
  }

  // Render dipisah: error di sini = bug di kode tampilan, BUKAN masalah server.
  if (dataDiterima) {
    try {
      if (typeof renderMarketingTab === 'function') renderMarketingTab();
      if (typeof mktUpdateStamp === 'function') mktUpdateStamp();
    } catch (err) {
      console.error('Data berhasil dimuat, tetapi tampilan gagal dirender:', err);
      tampilkanBannerMkt_('⚠️ Data dari server berhasil dimuat, tetapi tampilan gagal dirender (bug di kode halaman, bukan masalah server).\nDetail: ' + (err && err.message ? err.message : err) + '\nBuka Console browser (F12) untuk lokasi barisnya.');
    }
  }

  const overlay = document.getElementById('globalLoadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// =========================================================================
// ANALISIS AI (GEMINI) — MARKETING.
// =========================================================================
async function jalankanAnalisisMarketingAI(bagian) {
  const mapIdBtn = { funnel: 'btnAiFunnel', produk: 'btnAiProduk', adset: 'btnAiAdsetContent', tren: 'btnAiTrenMarketing' };
  const mapIdLoading = { funnel: 'aiFunnelLoading', produk: 'aiProdukLoading', adset: 'aiAdsetContentLoading', tren: 'aiTrenMarketingLoading' };
  const mapIdOutput = { funnel: 'aiFunnelOutput', produk: 'aiProdukOutput', adset: 'aiAdsetContentOutput', tren: 'aiTrenMarketingOutput' };

  const btn = document.getElementById(mapIdBtn[bagian]);
  const loadingEl = document.getElementById(mapIdLoading[bagian]);
  const outEl = document.getElementById(mapIdOutput[bagian]);
  const teksAsli = btn ? btn.innerText : '';

  const ringkasan = ambilRingkasanMarketingUntukAI_(bagian);
  if (!ringkasan) { alert('Data belum cukup untuk dianalisis. Pastikan halaman Marketing sudah dimuat/di-filter dulu.'); return; }

  if (btn) { btn.disabled = true; btn.innerText = '⏳...'; }
  if (loadingEl) loadingEl.style.display = 'block';
  if (outEl) outEl.style.display = 'none';

  try {
    const fd = new FormData();
    fd.append('action', 'analisisAiGeminiMarketing');
    fd.append('jenisAnalisis', bagian);
    fd.append('ringkasanJson', JSON.stringify(ringkasan));
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
    if (outEl) {
      outEl.style.display = 'block';
      outEl.innerText = result.result === 'success' ? result.analisis : ('❌ Gagal: ' + (result.message || 'Action belum tersedia di Code.gs — tambahkan handler analisisAiGeminiMarketing dulu (lihat instruksi).'));
    }
  } catch (err) {
    if (outEl) { outEl.style.display = 'block'; outEl.innerText = '❌ Gagal koneksi: ' + err; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli; }
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

// =========================================================================
// TOMBOL REFRESH MANUAL — tarik ulang data server tanpa reload halaman penuh.
// =========================================================================
async function refreshDataMarketingManual() {
  const btn = document.getElementById('btnRefreshMarketing');
  const teksAsli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Memuat...'; }
  try {
    // Belum ada endpoint "getMarketingOnly" khusus di Code.gs, jadi tarik
    // ulang semua data (getData) lalu render ulang tab Marketing.
    await tarikDataServer();
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli || '🔄 Refresh'; }
  }
}

// =========================================================================
// SINKRONISASI META ADS — memicu fungsi di MetaAdsSync.gs lewat doPost.
// =========================================================================
async function jalankanSyncMetaAds(jenis) {
  const mapIdBtn = {
    harian: 'btnSyncMetaHarian', backfill30: 'btnSyncMetaBackfill', satuhari: 'btnSyncMetaSatuHari',
    content: 'btnSyncMetaContent', adsetperf: 'btnSyncMetaAdsetPerf', adsettargeting: 'btnSyncMetaAdsetTarget',
    audiencecapi: 'btnSyncAudienceCapi', buataudience: 'btnBuatAudienceSaja', shareaudience: 'btnShareUlangAudience'
  };
  const mapAction = {
    harian: 'syncMetaAdsSekarang', backfill30: 'backfillMetaAds30HariWeb', satuhari: 'syncMetaAdsSatuHariWeb',
    content: 'syncAdContentWeb', adsetperf: 'syncAdsetPerformanceWeb', adsettargeting: 'syncAdsetTargetingWeb',
    audiencecapi: 'syncAudienceCapiWeb', buataudience: 'buatAudienceSajaWeb', shareaudience: 'shareUlangAudienceWeb'
  };
  const mapLabel = {
    harian: 'Sync harian', backfill30: 'Backfill 30 hari', satuhari: 'Sync kemarin', content: 'Ad Content',
    adsetperf: 'Adset Performance', adsettargeting: 'Adset Targeting', audiencecapi: 'Audience & CAPI',
    buataudience: 'Buat Audience', shareaudience: 'Share Audience'
  };
  const mapOutEl = { audiencecapi: 'hasilSyncAudienceCapi', buataudience: 'hasilSyncAudienceCapi', shareaudience: 'hasilSyncAudienceCapi' };
  const btn = document.getElementById(mapIdBtn[jenis]);
  const outEl = document.getElementById(mapOutEl[jenis] || 'hasilSyncMetaAds');
  const teksAsli = btn ? btn.innerText : '';
  const waktuMulai = Date.now();
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Sinkronisasi...'; }
  if (outEl) { outEl.style.display = 'block'; outEl.style.background = '#f1f5f9'; outEl.style.color = '#0f172a'; outEl.innerText = '⏳ Menghubungi Meta API, mohon tunggu (bisa 10 detik - beberapa menit tergantung jumlah data)...'; }
  try {
    const fd = new FormData();
    fd.append('action', mapAction[jenis] || 'syncMetaAdsSekarang');
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
    const detik = ((Date.now() - waktuMulai) / 1000).toFixed(1);
    if (result.result === 'success') {
      if (outEl) { outEl.style.background = '#14532d'; outEl.style.color = '#fff'; outEl.innerText = '✅ Sinkronisasi selesai (' + detik + ' detik). ' + (result.message || ''); }
      catatRiwayatSyncMeta_(mapLabel[jenis] || jenis, true, result.message || '', detik);
      await tarikDataServer();
    } else {
      if (outEl) { outEl.style.background = '#7f1d1d'; outEl.style.color = '#fff'; outEl.innerText = '❌ Gagal: ' + (result.message || 'Action belum tersedia di Code.gs.'); }
      catatRiwayatSyncMeta_(mapLabel[jenis] || jenis, false, result.message || 'Gagal', detik);
    }
  } catch (err) {
    const detik = ((Date.now() - waktuMulai) / 1000).toFixed(1);
    if (outEl) { outEl.style.display = 'block'; outEl.style.background = '#7f1d1d'; outEl.style.color = '#fff'; outEl.innerText = '❌ Gagal koneksi: ' + err.message; }
    catatRiwayatSyncMeta_(mapLabel[jenis] || jenis, false, 'Gagal koneksi: ' + err.message, detik);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli; }
  }
}

// --- Riwayat sync (5 terbaru, tersimpan di browser ini) ---
function catatRiwayatSyncMeta_(label, sukses, pesan, durasiDetik) {
  const KEY = 'riwayat_sync_meta_ads';
  let r = [];
  try { r = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { r = []; }
  r.unshift({ label, sukses, pesan, durasiDetik, waktu: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) });
  try { localStorage.setItem(KEY, JSON.stringify(r.slice(0, 5))); } catch (e) {}
  renderRiwayatSyncMeta();
}
function renderRiwayatSyncMeta() {
  const el = document.getElementById('riwayatSyncMetaList');
  if (!el) return;
  let r = [];
  try { r = JSON.parse(localStorage.getItem('riwayat_sync_meta_ads') || '[]'); } catch (e) { r = []; }
  el.innerHTML = r.length === 0
    ? '<div style="color:#64748b; font-style:italic;">Belum ada riwayat sync di browser ini.</div>'
    : r.map(x => `<div style="display:flex; justify-content:space-between; gap:8px; padding:5px 0; border-bottom:1px solid #bae6fd; color:#0f172a;">
        <span>${x.sukses ? '✅' : '❌'} <b>${x.label}</b> <span style="color:#475569;">(${x.durasiDetik}s)</span></span>
        <span style="color:#475569; white-space:nowrap;">${x.waktu}</span></div>`).join('');
}
function bersihkanRiwayatSyncMeta() {
  try { localStorage.removeItem('riwayat_sync_meta_ads'); } catch (e) {}
  renderRiwayatSyncMeta();
}
document.addEventListener('DOMContentLoaded', () => { try { renderRiwayatSyncMeta(); } catch (e) {} });

// =========================================================================
// AUDIT CAPI & CUSTOM AUDIENCE — memuat log lewat action 'getAudienceCapiLog'.
// Hasilnya disimpan di window.dataCapiLog dan dipakai juga oleh tabel
// "Status CAPI per Lead" (renderCapiPerLead di mkt-extra.js).
// =========================================================================
async function muatAuditCapiAudience() {
  const btn = document.getElementById('btnMuatAuditCapi');
  const teksAsli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Memuat...'; }
  try {
    const fd = new FormData();
    fd.append('action', 'getAudienceCapiLog');
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
    if (result.result !== 'success') {
      alert('❌ Gagal memuat log: ' + (result.message || 'Action getAudienceCapiLog belum tersedia di Code.gs.'));
      return;
    }
    const audiences = result.audiences || [], logs = result.logs || [];
    window.dataCapiLog = { loaded: true, audiences, logs };

    const kpi = document.getElementById('auditCapiKpiGrid');
    if (kpi) {
      kpi.innerHTML = `
        <div class="fin-kpi-card fin-kpi-aktiva"><div class="fin-kpi-label">Audience Dibuat</div><div class="fin-kpi-val">${audiences.length}</div></div>
        <div class="fin-kpi-card fin-kpi-leads"><div class="fin-kpi-label">Lead Sudah Disinkron</div><div class="fin-kpi-val">${logs.length}</div></div>
        <div class="fin-kpi-card fin-kpi-revenue"><div class="fin-kpi-label">Event Purchase Terkirim</div><div class="fin-kpi-val">${logs.filter(l => l.sudah_kirim_purchase).length}</div></div>`;
    }
    const tA = document.getElementById('auditCapiAudienceTable');
    if (tA) {
      tA.innerHTML = audiences.length ? audiences.map(a => `<tr>
        <td style="padding:7px;">${a.minat || '-'}</td><td style="padding:7px;">${a.kategori || '-'}</td>
        <td style="padding:7px; font-family:monospace; font-size:11px;">${a.audience_id || '-'}</td>
        <td style="padding:7px;">${a.akun_pemilik || '-'}</td><td style="padding:7px; font-size:11px;">${a.last_synced || '-'}</td></tr>`).join('')
        : '<tr><td colspan="5" style="text-align:center; padding:14px; color:#4b5563;">Belum ada audience dibuat.</td></tr>';
    }
    const tE = document.getElementById('auditCapiEventTable');
    if (tE) {
      const terbaru = [...logs].sort((a, b) => String(b.last_synced || '').localeCompare(String(a.last_synced || ''))).slice(0, 20);
      tE.innerHTML = terbaru.length ? terbaru.map(l => `<tr>
        <td style="padding:7px; font-family:monospace; font-size:11px;">${l.kode_leads || '-'}</td><td style="padding:7px;">${l.sumber || '-'}</td>
        <td style="padding:7px;">${l.minat || '-'}</td><td style="padding:7px;">${l.kategori || '-'}</td>
        <td style="padding:7px; text-align:center;">${l.sudah_kirim_purchase ? '<span class="capi-badge capi-ok">✔ Terkirim</span>' : '<span class="capi-badge capi-na">—</span>'}</td>
        <td style="padding:7px; font-size:11px;">${l.last_synced || '-'}</td></tr>`).join('')
        : '<tr><td colspan="6" style="text-align:center; padding:14px; color:#4b5563;">Belum ada log sinkronisasi.</td></tr>';
    }
    if (typeof renderCapiPerLead === 'function') renderCapiPerLead();
  } catch (err) {
    alert('❌ Gagal memuat log: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli; }
  }
}

// Sync ulang rentang tanggal tertentu (untuk perbaiki data yang tidak
// ketarik/tidak sinkron di hari-hari tertentu).
async function jalankanSyncMetaAdsRentang() {
  const dari = document.getElementById('syncTglDari')?.value;
  const sampai = document.getElementById('syncTglSampai')?.value;
  const btn = document.getElementById('btnSyncMetaRentang');
  const outEl = document.getElementById('hasilSyncMetaAds');
  if (!dari || !sampai) {
    alert('Isi tanggal Dari dan Sampai dulu.');
    return;
  }
  const teksAsli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Sinkronisasi...'; }
  if (outEl) { outEl.style.display = 'block'; outEl.style.background = '#f1f5f9'; outEl.innerText = `⏳ Menyinkronkan ulang periode ${dari} s/d ${sampai}...`; }
  try {
    const fd = new FormData();
    fd.append('action', 'syncMetaAdsRentangWeb');
    fd.append('since', dari);
    fd.append('until', sampai);
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
    if (result.result === 'success') {
      if (outEl) {
        outEl.style.background = '#dcfce7'; outEl.style.color = '#166534';
        outEl.innerText = '✅ ' + (result.message || 'Sync ulang selesai.');
      }
      await tarikDataServer();
    } else {
      if (outEl) {
        outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
        outEl.innerText = '❌ Gagal: ' + (result.message || 'Action belum tersedia di Code.gs.');
      }
    }
  } catch (err) {
    if (outEl) {
      outEl.style.display = 'block'; outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
      outEl.innerText = '❌ Gagal koneksi: ' + err;
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  tarikDataServer();
});

// ===== PANEL SYNC META — rentang hari per jenis =====
const SYNC_META_JENIS = [
  { key: 'campaign',  label: '📊 Campaign Harian (Data_Ads)', hari: 2, chunk: 10 },
  { key: 'adsetperf', label: '🔍 Adset Performance',          hari: 2, chunk: 5 },
  { key: 'content',   label: '🎨 Ad Content Performance',     hari: 2, chunk: 3 },
  { key: 'region',    label: '🗺️ Region Performance',         hari: 2, chunk: 7 },
  { key: 'placement', label: '📍 Placement Performance',      hari: 7, chunk: 31 },
  { key: 'targeting', label: '🎯 Adset Targeting (snapshot)', noDays: true },
  { key: 'creative',  label: '🖼️ Ad Creative Master',         noDays: true }
];

function renderPanelSyncMeta() {
  const el = document.getElementById('panelSyncMeta');
  if (!el) return;
  el.innerHTML = SYNC_META_JENIS.map(j => {
    let simpan = null;
    try { simpan = localStorage.getItem('syncHari_' + j.key); } catch (e) {}
    const nilai = simpan || j.hari || '';
    return `<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; padding:8px 0; border-bottom:1px dashed #bae6fd;">
      <div style="flex:1; min-width:200px; font-size:12.5px; font-weight:700; color:#0369a1;">${j.label}</div>
      ${j.noDays ? '<div style="font-size:11px; color:#64748b; width:150px;">tanpa rentang tanggal</div>' : `
      <div style="display:flex; align-items:center; gap:6px;">
        <input type="number" id="hariSync_${j.key}" min="1" max="365" value="${nilai}" style="width:70px; padding:7px; border-radius:6px; border:1px solid #7dd3fc;"
               onchange="try{localStorage.setItem('syncHari_${j.key}', this.value)}catch(e){}">
        <span style="font-size:11.5px; color:#0369a1;">hari ke belakang</span>
      </div>`}
      <button type="button" id="btnSyncRentang_${j.key}" onclick="jalankanSyncRentangMeta('${j.key}')"
        style="padding:8px 16px; background:#0369a1; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:700; font-size:12.5px;">🔄 Sync</button>
    </div>`;
  }).join('') + `<p style="font-size:10.5px; color:#0369a1; margin:8px 0 0;">💡 Rentang berakhir kemarin. Contoh: 7 hari = 7 hari terakhir sampai kemarin. Rentang panjang diproses bertahap otomatis.</p>`;
}

function _tglLokal(d) { return formatDateLocal_(d); }

function _bagiRentang(hari, chunk) {
  const akhir = new Date(); akhir.setDate(akhir.getDate() - 1);
  const awal = new Date(akhir); awal.setDate(awal.getDate() - (hari - 1));
  const hasil = [];
  let cur = new Date(awal);
  while (cur <= akhir) {
    const sampai = new Date(cur); sampai.setDate(sampai.getDate() + chunk - 1);
    const batas = sampai > akhir ? akhir : sampai;
    hasil.push({ since: _tglLokal(cur), until: _tglLokal(batas) });
    cur = new Date(batas); cur.setDate(cur.getDate() + 1);
  }
  return hasil;
}

async function jalankanSyncRentangMeta(key) {
  const j = SYNC_META_JENIS.find(x => x.key === key);
  const btn = document.getElementById('btnSyncRentang_' + key);
  const outEl = document.getElementById('hasilSyncMetaAds');
  const teksAsli = btn ? btn.innerText : '';
  const tampil = (bg, color, teks) => { if (outEl) { outEl.style.display = 'block'; outEl.style.background = bg; outEl.style.color = color; outEl.innerText = teks; } };

  let potongan = [{}];
  if (!j.noDays) {
    const hari = Math.max(1, Math.min(365, Number(document.getElementById('hariSync_' + key).value) || 0));
    if (!hari) { alert('Isi jumlah hari dulu.'); return; }
    potongan = _bagiRentang(hari, j.chunk);
  }

  if (btn) btn.disabled = true;
  try {
    for (let i = 0; i < potongan.length; i++) {
      const p = potongan[i];
      if (btn) btn.innerText = `⏳ ${i + 1}/${potongan.length}`;
      tampil('#f1f5f9', '#334155', `⏳ ${j.label}: bagian ${i + 1}/${potongan.length}` + (p.since ? ` (${p.since} s/d ${p.until})` : '') + ' ...');
      const fd = new FormData();
      fd.append('action', 'syncMetaRentangWeb');
      fd.append('jenis', key);
      if (p.since) { fd.append('since', p.since); fd.append('until', p.until); }
      const res = await fetch(scriptURL, { method: 'POST', body: fd });
      const result = await res.json();
      if (result.result !== 'success') throw new Error(result.message || 'Gagal (cek handler di Code.gs)');
    }
    tampil('#dcfce7', '#166534', `✅ ${j.label} selesai (${potongan.length} bagian).`);
    await tarikDataServer();
    if (typeof renderMarketingTab === 'function') renderMarketingTab();
  } catch (err) {
    tampil('#fee2e2', '#991b1b', '❌ ' + j.label + ': ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli; }
  }
}

document.addEventListener('DOMContentLoaded', renderPanelSyncMeta);