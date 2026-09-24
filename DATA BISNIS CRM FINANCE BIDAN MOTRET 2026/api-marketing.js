// =========================================================================
// api-marketing.js — versi api.js yang dipangkas khusus untuk halaman
// Analisis Marketing (index-marketing.html). Hanya menarik & menampilkan
// data marketing/Meta Ads; bagian Laporan Keuangan dihapus supaya halaman
// ini ringan & berdiri sendiri.
// =========================================================================

async function tarikDataServer() {
  try {
    const res = await fetch(scriptURL + '?action=getData');
    const data = await res.json();

    // dataGlobal (Leads) tetap ditarik karena dipakai untuk funnel Leads/Closing/Revenue
    dataGlobal = data.clients || [];

    dataMarketing = data.marketing || [];
    STUDIO_CONFIG = data.config || STUDIO_CONFIG;
    dataAdsetPerformance = data.adsetPerformance || [];
    dataAdsetCityTargeting = data.adsetCityTargeting || [];
    dataContent = data.adContentPerformance || [];
    dataTargetMingguanMarketing = data.targetMingguanMarketing || { global: null, perProduk: {} };

    if (typeof renderMarketingTab === 'function') renderMarketingTab();
  } catch (err) {
    console.error('Gagal memuat data dari server:', err);
    alert('❌ Gagal memuat data dari server. Cek koneksi atau URL Apps Script (scriptURL) di index-marketing.html.\n\n' + err);
  } finally {
    const overlay = document.getElementById('globalLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }
}

// =========================================================================
// ANALISIS AI (GEMINI) — MARKETING.
// =========================================================================
async function jalankanAnalisisMarketingAI(bagian) {
  const mapIdBtn = { funnel: 'btnAiFunnel', adset: 'btnAiAdsetContent', tren: 'btnAiTrenMarketing' };
  const mapIdLoading = { funnel: 'aiFunnelLoading', adset: 'aiAdsetContentLoading', tren: 'aiTrenMarketingLoading' };
  const mapIdOutput = { funnel: 'aiFunnelOutput', adset: 'aiAdsetContentOutput', tren: 'aiTrenMarketingOutput' };

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
  const mapOutEl = {
    audiencecapi: 'hasilSyncAudienceCapi', buataudience: 'hasilSyncAudienceCapi', shareaudience: 'hasilSyncAudienceCapi'
  };
  const btn = document.getElementById(mapIdBtn[jenis]);
  const outEl = document.getElementById(mapOutEl[jenis] || 'hasilSyncMetaAds');
  const teksAsli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Sinkronisasi...'; }
  if (outEl) { outEl.style.display = 'block'; outEl.style.background = '#f1f5f9'; outEl.innerText = '⏳ Menghubungi Meta API, mohon tunggu (bisa 10 detik - beberapa menit tergantung jumlah data)...'; }
  try {
    const fd = new FormData();
    fd.append('action', mapAction[jenis] || 'syncMetaAdsSekarang');
    const res = await fetch(scriptURL, { method: 'POST', body: fd });
    const result = await res.json();
    if (result.result === 'success') {
      if (outEl) {
        outEl.style.background = '#dcfce7'; outEl.style.color = '#166534';
        outEl.innerText = '✅ Sinkronisasi selesai. ' + (result.message || '');
      }
      await tarikDataServer();
    } else {
      if (outEl) {
        outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
        outEl.innerText = '❌ Gagal: ' + (result.message || 'Action belum tersedia di Code.gs. Tambahkan handler-nya dulu (lihat instruksi).');
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
