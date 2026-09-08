// =========================================================================
// api.js — pengganti Api.html + Init.html versi Apps Script.
// Semua data diambil lewat fetch() ke Web App Apps Script (scriptURL),
// bukan lewat google.script.run (karena itu cuma jalan di dalam iframe
// HtmlService Apps Script, tidak bisa dipakai dari domain luar/Vercel).
// =========================================================================

async function tarikDataServer() {
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

    inisialisasiTampilanKeuangan_();

    // Render tab Marketing juga kalau sedang aktif saat data pertama kali dimuat
    const tabMarketingEl = document.getElementById('tabMarketing');
    if (tabMarketingEl && tabMarketingEl.classList.contains('active') && typeof renderMarketingTab === 'function') {
      renderMarketingTab();
    }
  } catch (err) {
    console.error('Gagal memuat data dari server:', err);
    alert('❌ Gagal memuat data dari server. Cek koneksi atau URL Apps Script (scriptURL) di index.html.\n\n' + err);
  } finally {
    const overlay = document.getElementById('globalLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
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

document.addEventListener('DOMContentLoaded', () => {
  tarikDataServer();
});

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
    await tarikDataServer();
    if (typeof renderMarketingTab === 'function') renderMarketingTab();
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
  const idBtn = jenis === 'harian' ? 'btnSyncMetaHarian' : (jenis === 'backfill30' ? 'btnSyncMetaBackfill' : 'btnSyncMetaSatuHari');
  const btn = document.getElementById(idBtn);
  const outEl = document.getElementById('hasilSyncMetaAds');
  const teksAsli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Sinkronisasi...'; }
  if (outEl) { outEl.style.display = 'block'; outEl.style.background = '#f1f5f9'; outEl.innerText = '⏳ Menghubungi Meta Ads API, mohon tunggu (bisa 10-60 detik tergantung jumlah data)...'; }
  try {
    const fd = new FormData();
    fd.append('action', jenis === 'harian' ? 'syncMetaAdsSekarang'
      : jenis === 'backfill30' ? 'backfillMetaAds30HariWeb'
      : 'syncMetaAdsSatuHariWeb');
    const res = await fetch(scriptURL, { method: 'POST', body: fd });
    const result = await res.json();
    if (result.result === 'success') {
      if (outEl) {
        outEl.style.background = '#dcfce7'; outEl.style.color = '#166534';
        outEl.innerText = '✅ Sinkronisasi selesai. ' + (result.message || '');
      }
      await tarikDataServer();
      if (typeof renderMarketingTab === 'function') renderMarketingTab();
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
