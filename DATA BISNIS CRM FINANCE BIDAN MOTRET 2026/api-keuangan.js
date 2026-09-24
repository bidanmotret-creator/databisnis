// =========================================================================
// api-keuangan.js — versi api.js yang dipangkas khusus untuk halaman
// Laporan Keuangan (index-keuangan.html). Hanya menarik & menampilkan data
// keuangan; bagian Marketing dihapus supaya halaman ini ringan & berdiri
// sendiri.
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

    inisialisasiTampilanKeuangan_();
  } catch (err) {
    console.error('Gagal memuat data dari server:', err);
    alert('❌ Gagal memuat data dari server. Cek koneksi atau URL Apps Script (scriptURL) di index-keuangan.html.\n\n' + err);
  } finally {
    const overlay = document.getElementById('globalLoadingOverlay');
    if (overlay) overlay.style.display = 'none';
  }
}

// Dipakai untuk refresh cepat setelah aksi jurnal (posting/hapus/dll),
// tanpa perlu narik ulang seluruh dataset CRM yang berat.
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
// ANALISIS AI (GEMINI) — sudah ditangani per-bagian di ui-finance.js lewat
// action 'analisisAiGemini' (lihat jalankanAnalisisGemini/jalankanAnalisisDupontGemini).
// =========================================================================

// =========================================================================
// TOMBOL REFRESH MANUAL — tarik ulang data server tanpa reload halaman penuh.
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

document.addEventListener('DOMContentLoaded', () => {
  tarikDataServer();
});
