// =========================================================================
// api.js — pengganti Api.html + Init.html versi Apps Script.
// Semua data diambil lewat fetch() ke Web App Apps Script (scriptURL),
// bukan lewat google.script.run (karena itu cuma jalan di dalam iframe
// HtmlService Apps Script, tidak bisa dipakai dari domain luar/Vercel).
// =========================================================================

// =========================================================================
// STRATEGI PERCEPATAN LOADING (PROGRESSIVE LOADING):
// Alih-alih menarik SEMUA data sekaligus (jurnal + leads + iklan harian
// per-adset, dst -- bisa jadi ribuan baris) dalam satu request raksasa,
// sekarang alurnya 2 tahap:
//   TAHAP 1 (cepat): fetch ?action=getFinanceOnly -- HANYA data Keuangan
//     (jurnal, akun, dst). Overlay loading langsung hilang & tab Keuangan
//     langsung bisa dipakai begitu ini selesai (biasanya jauh lebih cepat
//     karena tidak perlu baca sheet Leads/Data_Ads/Adset_Performance/dst).
//   TAHAP 2 (di belakang layar, TIDAK memblokir tampilan): fetch penuh
//     ?action=getData untuk mengisi data Marketing (clients, ads, dst).
//     Kalau user sudah pindah ke tab Marketing sebelum tahap ini selesai,
//     otomatis dirender ulang begitu datanya sampai.
// =========================================================================

async function tarikDataServer() {
  await muatDataKeuanganCepat_();
  // Tahap 2 sengaja TIDAK di-await di sini supaya tidak memblokir --
  // biarkan berjalan di belakang layar.
  muatDataLengkapDiBelakangLayar_();
}

// TAHAP 1: data Keuangan saja, cepat, dipakai saat load pertama kali.
async function muatDataKeuanganCepat_() {
  try {
    const res = await fetch(scriptURL + '?action=getFinanceOnly');
    const data = await res.json();

    dataFinance = data.finance || dataFinance;
    dataJurnalGlobal = dataFinance.journal || [];
    dataAnggaranBiaya = dataFinance.anggaran || [];
    if (typeof dataVendorGlobal !== 'undefined') dataVendorGlobal = dataFinance.vendors || [];

    inisialisasiTampilanKeuangan_();
  } catch (err) {
    console.error('Gagal memuat data Keuangan awal:', err);
    alert('❌ Gagal memuat data dari server. Cek koneksi atau URL Apps Script (scriptURL) di index.html.\n\n' + err);
  } finally {
    const overlay = document.getElementById('globalLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }
}

// TAHAP 2: data lengkap (Marketing dkk) -- dipanggil TANPA await, jalan di
// belakang layar. Dipakai juga sebagai "refresh penuh" oleh tombol Refresh.
async function muatDataLengkapDiBelakangLayar_() {
  try {
    const res = await fetch(scriptURL + '?action=getData');
    const data = await res.json();

    dataGlobal = data.clients || [];
    dataFinance = data.finance || dataFinance;
    dataJurnalGlobal = dataFinance.journal || [];
    dataAnggaranBiaya = dataFinance.anggaran || [];
    if (typeof dataVendorGlobal !== 'undefined') dataVendorGlobal = dataFinance.vendors || [];

    // --- Data Marketing (dipakai oleh ui-marketing.js) ---
    dataMarketing = data.marketing || [];
    STUDIO_CONFIG = data.config || STUDIO_CONFIG;
    dataAdsetPerformance = data.adsetPerformance || [];
    dataAdsetCityTargeting = data.adsetCityTargeting || [];
    dataContent = data.adContentPerformance || [];
    dataTargetMingguanMarketing = data.targetMingguanMarketing || { global: null, perProduk: {} };

    // Refresh ulang Keuangan juga (kalau ada perubahan dari data yang lebih baru)
    inisialisasiTampilanKeuangan_();

    // Render tab Marketing kalau sedang aktif saat data lengkap sampai
    const tabMarketingEl = document.getElementById('tabMarketing');
    if (tabMarketingEl && tabMarketingEl.classList.contains('active') && typeof renderMarketingTab === 'function') {
      renderMarketingTab();
    }

    const indikator = document.getElementById('indikatorDataMarketingSiap');
    if (indikator) indikator.style.display = 'none';
  } catch (err) {
    console.error('Gagal memuat data lengkap (Marketing) di belakang layar:', err);
  }
}


// Dipakai untuk refresh cepat setelah aksi jurnal (posting/hapus/dll),
// tanpa perlu narik ulang seluruh dataset CRM+Marketing yang berat.
async function tarikDataKeuanganSaja() {
  try {
    const res = await fetch(scriptURL + '?action=getFinanceOnly');
    const data = await res.json();
    dataFinance = data.finance || dataFinance;
    dataJurnalGlobal = dataFinance.journal || [];
    dataAnggaranBiaya = dataFinance.anggaran || [];
    if (typeof dataVendorGlobal !== 'undefined') dataVendorGlobal = dataFinance.vendors || [];
    inisialisasiTampilanKeuangan_();
  } catch (err) {
    console.error('Gagal refresh data keuangan:', err);
  }
}

// Panggil semua fungsi render yang ada di ui-finance.js (nama fungsi harus
// sama persis dengan yang didefinisikan di sana).
function inisialisasiTampilanKeuangan_() {
  try { if (typeof isiDropdownAkun === 'function') isiDropdownAkun(dataFinance.accounts || []); } catch (e) {}
  try { if (typeof renderJurnalTable === 'function') renderJurnalTable(dataJurnalGlobal); } catch (e) {}
  try { if (typeof hitungLabaRugi === 'function') hitungLabaRugi(dataJurnalGlobal); } catch (e) {}
  try { if (typeof hitungArusKas === 'function') hitungArusKas(dataJurnalGlobal); } catch (e) {}
  try { if (typeof hitungNeraca === 'function') hitungNeraca(dataJurnalGlobal); } catch (e) {}
  try { if (typeof renderCostStructure === 'function') renderCostStructure(dataJurnalGlobal); } catch (e) {}
  try { if (typeof renderInsightKeuangan === 'function') renderInsightKeuangan(dataJurnalGlobal); } catch (e) {}
  try { if (typeof hitungIncomeStatementLengkap === 'function') hitungIncomeStatementLengkap(dataJurnalGlobal); } catch (e) {}
  try { if (typeof hitungCashStatementLengkap === 'function') hitungCashStatementLengkap(dataJurnalGlobal); } catch (e) {}
  try { if (typeof hitungDupont === 'function') hitungDupont(dataJurnalGlobal); } catch (e) {}
  try { if (typeof renderDecisionsLog === 'function') renderDecisionsLog(); } catch (e) {}
  try { if (typeof renderRosettaStone === 'function') renderRosettaStone(); } catch (e) {}
  try { if (typeof renderRosettaWorksheet === 'function') renderRosettaWorksheet(); } catch (e) {}
  try { if (typeof renderStokPersediaan === 'function') renderStokPersediaan(); } catch (e) {}
  try { if (typeof renderTutupBuku === 'function') renderTutupBuku(); } catch (e) {}
  try { if (typeof notifMuatPengaturan === 'function') notifMuatPengaturan(); } catch (e) {}
  try { if (typeof isiDatalistVendor_ === 'function') isiDatalistVendor_(); } catch (e) {}
  try { if (typeof isiDatalistCustomer_ === 'function') isiDatalistCustomer_(); } catch (e) {}
  try { if (typeof panduanRenderChat === 'function') panduanRenderChat(); } catch (e) {}
}

// =========================================================================
// ANALISIS AI (GEMINI) — MARKETING. Dipasang di beberapa bagian utama
// tab Marketing, mirip pola "Analisis Akhir AI" di tab Keuangan.
// =========================================================================
// =========================================================================
// AUDIT PROSES CAPI & CUSTOM AUDIENCE — muat log dari Meta_Audience_Config
// dan Meta_Sync_Log via action baru 'getAudienceCapiLog' (lihat instruksi
// Code.gs). Menampilkan Input -> Proses -> Output secara transparan.
// =========================================================================
async function muatAuditCapiAudience() {
  const btn = document.getElementById('btnMuatAuditCapi');
  const teksAsli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Memuat...'; }

  try {
    const fd = new FormData();
    fd.append('action', 'getAudienceCapiLog');
    const res = await fetch(scriptURL, { method: 'POST', body: fd });
    const result = await res.json();

    if (result.result !== 'success') {
      alert('❌ Gagal memuat log: ' + (result.message || 'Action belum tersedia di Code.gs — tambahkan handler getAudienceCapiLog dulu.'));
      return;
    }

    const audiences = result.audiences || [];
    const logs = result.logs || [];

    const kpiGrid = document.getElementById('auditCapiKpiGrid');
    if (kpiGrid) {
      const totalPurchaseTerkirim = logs.filter(l => l.sudah_kirim_purchase).length;
      kpiGrid.innerHTML = `
        <div class="fin-kpi-card fin-kpi-aktiva"><div class="fin-kpi-label">Audience Dibuat</div><div class="fin-kpi-val">${audiences.length}</div></div>
        <div class="fin-kpi-card fin-kpi-leads"><div class="fin-kpi-label">Lead Sudah Disinkron</div><div class="fin-kpi-val">${logs.length}</div></div>
        <div class="fin-kpi-card fin-kpi-revenue"><div class="fin-kpi-label">Event Purchase Terkirim</div><div class="fin-kpi-val">${totalPurchaseTerkirim}</div></div>
      `;
    }

    const tblAudience = document.getElementById('auditCapiAudienceTable');
    if (tblAudience) {
      tblAudience.innerHTML = audiences.length > 0 ? audiences.map(a => `
        <tr>
          <td style="padding:7px;">${a.minat || '-'}</td>
          <td style="padding:7px;">${a.kategori || '-'}</td>
          <td style="padding:7px; font-family:monospace; font-size:11px;">${a.audience_id || '-'}</td>
          <td style="padding:7px;">${a.akun_pemilik || '-'}</td>
          <td style="padding:7px; font-size:11px; color:#64748b;">${a.last_synced || '-'}</td>
        </tr>`).join('') : '<tr><td colspan="5" style="text-align:center; padding:14px; color:#94a3b8;">Belum ada audience dibuat.</td></tr>';
    }

    const tblEvent = document.getElementById('auditCapiEventTable');
    if (tblEvent) {
      const logTerbaru = [...logs].sort((a, b) => (b.last_synced || '').localeCompare(a.last_synced || '')).slice(0, 20);
      tblEvent.innerHTML = logTerbaru.length > 0 ? logTerbaru.map(l => `
        <tr>
          <td style="padding:7px; font-family:monospace; font-size:11px;">${l.kode_leads || '-'}</td>
          <td style="padding:7px;">${l.sumber || '-'}</td>
          <td style="padding:7px;">${l.minat || '-'}</td>
          <td style="padding:7px;">${l.kategori || '-'}</td>
          <td style="padding:7px; text-align:center;">${l.sudah_kirim_purchase ? '✅' : '—'}</td>
          <td style="padding:7px; font-size:11px; color:#64748b;">${l.last_synced || '-'}</td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center; padding:14px; color:#94a3b8;">Belum ada log sinkronisasi.</td></tr>';
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli; }
  }
}

async function jalankanAnalisisMarketingAI(bagian) {  const mapIdBtn = { funnel: 'btnAiFunnel', adset: 'btnAiAdsetContent', tren: 'btnAiTrenMarketing', produk: 'btnAiProduk' };
  const mapIdLoading = { funnel: 'aiFunnelLoading', adset: 'aiAdsetContentLoading', tren: 'aiTrenMarketingLoading', produk: 'aiProdukLoading' };
  const mapIdOutput = { funnel: 'aiFunnelOutput', adset: 'aiAdsetContentOutput', tren: 'aiTrenMarketingOutput', produk: 'aiProdukOutput' };

  const btn = document.getElementById(mapIdBtn[bagian]);
  const loadingEl = document.getElementById(mapIdLoading[bagian]);
  const outEl = document.getElementById(mapIdOutput[bagian]);
  const teksAsli = btn ? btn.innerText : '';

  const ringkasan = ambilRingkasanMarketingUntukAI_(bagian);
  if (!ringkasan) { alert('Data belum cukup untuk dianalisis. Pastikan tab Marketing sudah dimuat/di-filter dulu.'); return; }

  if (btn) { btn.disabled = true; btn.innerText = '⏳...'; }
  if (loadingEl) loadingEl.style.display = 'block';
  if (outEl) outEl.style.display = 'none';

  try {
    const fd = new FormData();
    fd.append('action', 'analisisAiGeminiMarketing');
    fd.append('jenisAnalisis', bagian);
    fd.append('ringkasanJson', JSON.stringify(ringkasan));
    const res = await fetch(scriptURL, { method: 'POST', body: fd });
    const result = await res.json();
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
// TOMBOL REFRESH MANUAL (per sub-menu) — tarik ulang data server tanpa
// reload halaman penuh.
// =========================================================================
async function refreshDataKeuanganManual() {
  const btn = document.getElementById('btnRefreshKeuangan');
  const teksAsli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Memuat...'; }
  try {
    await tarikDataKeuanganSaja();
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli || '🔄 Refresh'; }
  }
}

async function refreshDataMarketingManual() {
  const btn = document.getElementById('btnRefreshMarketing');
  const teksAsli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Memuat...'; }
  try {
    // Belum ada endpoint "getMarketingOnly" khusus di Code.gs, jadi tarik
    // ulang semua data (getData) lalu render ulang tab Marketing saja.
    // (BEDA dari tarikDataServer() biasa: di sini kita SENGAJA menunggu
    // data lengkap sampai, bukan cuma versi cepat Keuangan.)
    await muatDataLengkapDiBelakangLayar_();
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli || '🔄 Refresh'; }
  }
}

// =========================================================================
// SINKRONISASI META ADS — memicu fungsi di MetaAdsSync.gs lewat doPost.
// CATATAN: action ini ('syncMetaAdsSekarang' & 'backfillMetaAds30HariWeb')
// BELUM ada di Code.gs Anda -- tambahkan dulu handler-nya di doPostCRM_
// (lihat instruksi yang saya berikan di chat) supaya tombol ini berfungsi.
// =========================================================================
async function jalankanSyncMetaAds(jenis) {
  const mapLabel = {
    harian: 'Sync Harian', backfill30: 'Backfill 30 Hari', satuhari: 'Sync Kemarin',
    content: 'Sync Ad Content', adsetperf: 'Sync Adset Performance', adsettargeting: 'Sync Adset Targeting',
    audiencecapi: 'Sync Audience & CAPI', buataudience: 'Buat Audience Saja', shareaudience: 'Share Ulang Audience'
  };
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
  const mapOutEl = {
    audiencecapi: 'hasilSyncAudienceCapi', buataudience: 'hasilSyncAudienceCapi', shareaudience: 'hasilSyncAudienceCapi'
  };
  const btn = document.getElementById(mapIdBtn[jenis]);
  const outEl = document.getElementById(mapOutEl[jenis] || 'hasilSyncMetaAds');
  const teksAsli = btn ? btn.innerText : '';
  const waktuMulai = Date.now();
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Sinkronisasi...'; }
  if (outEl) { outEl.style.display = 'block'; outEl.style.background = '#f1f5f9'; outEl.innerText = '⏳ Menghubungi Meta API, mohon tunggu (bisa 10 detik - beberapa menit tergantung jumlah data)...'; }
  try {
    const fd = new FormData();
    fd.append('action', mapAction[jenis] || 'syncMetaAdsSekarang');
    const res = await fetch(scriptURL, { method: 'POST', body: fd });
    const result = await res.json();
    const durasiDetik = ((Date.now() - waktuMulai) / 1000).toFixed(1);
    if (result.result === 'success') {
      if (outEl) {
        outEl.style.background = '#dcfce7'; outEl.style.color = '#166534';
        outEl.innerText = '✅ Sinkronisasi selesai (' + durasiDetik + ' detik). ' + (result.message || '');
      }
      catatRiwayatSyncMeta_(mapLabel[jenis] || jenis, true, result.message || '', durasiDetik);
      await tarikDataServer();
      if (typeof renderMarketingTab === 'function') renderMarketingTab();
    } else {
      if (outEl) {
        outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
        outEl.innerText = '❌ Gagal: ' + (result.message || 'Action belum tersedia di Code.gs. Tambahkan handler-nya dulu (lihat instruksi).');
      }
      catatRiwayatSyncMeta_(mapLabel[jenis] || jenis, false, result.message || 'Gagal', durasiDetik);
    }
  } catch (err) {
    const durasiDetik = ((Date.now() - waktuMulai) / 1000).toFixed(1);
    if (outEl) {
      outEl.style.display = 'block'; outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
      outEl.innerText = '❌ Gagal koneksi: ' + err;
    }
    catatRiwayatSyncMeta_(mapLabel[jenis] || jenis, false, 'Gagal koneksi: ' + err, durasiDetik);
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = teksAsli; }
  }
}

// --- Riwayat Sync (tersimpan di localStorage browser ini, 5 terbaru) ---
function catatRiwayatSyncMeta_(label, sukses, pesan, durasiDetik) {
  const KEY = 'riwayat_sync_meta_ads';
  let riwayat = [];
  try { riwayat = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { riwayat = []; }
  riwayat.unshift({
    label, sukses, pesan,
    durasiDetik,
    waktu: new Date().toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
  });
  riwayat = riwayat.slice(0, 5);
  localStorage.setItem(KEY, JSON.stringify(riwayat));
  renderRiwayatSyncMeta();
}

function renderRiwayatSyncMeta() {
  const el = document.getElementById('riwayatSyncMetaList');
  if (!el) return;
  const KEY = 'riwayat_sync_meta_ads';
  let riwayat = [];
  try { riwayat = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { riwayat = []; }
  if (riwayat.length === 0) {
    el.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Belum ada riwayat sync di sesi browser ini.</div>';
    return;
  }
  el.innerHTML = riwayat.map(r => `
    <div style="display:flex; justify-content:space-between; gap:8px; padding:5px 0; border-bottom:1px solid #e0f2fe;">
      <span>${r.sukses ? '✅' : '❌'} <b>${r.label}</b> <span style="color:#94a3b8;">(${r.durasiDetik}s)</span></span>
      <span style="color:#64748b; white-space:nowrap;">${r.waktu}</span>
    </div>
  `).join('');
}

function bersihkanRiwayatSyncMeta() {
  localStorage.removeItem('riwayat_sync_meta_ads');
  renderRiwayatSyncMeta();
}

document.addEventListener('DOMContentLoaded', () => {
  try { renderRiwayatSyncMeta(); } catch (e) {}
});

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
    const res = await fetch(scriptURL, { method: 'POST', body: fd });
    const result = await res.json();
    if (result.result === 'success') {
      if (outEl) {
        outEl.style.background = '#dcfce7'; outEl.style.color = '#166534';
        outEl.innerText = '✅ ' + (result.message || 'Sync ulang selesai.');
      }
      await tarikDataServer();
      if (typeof renderMarketingTab === 'function') renderMarketingTab();
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
