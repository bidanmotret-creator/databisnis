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

    inisialisasiTampilanKeuangan_();
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
