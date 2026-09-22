// =========================================================================
// api-followup.js — khusus halaman followup.html.
// Pakai action server BARU yang ringan: ?action=getFollowUpData
// (lihat TAMBAHAN_CodeGs_getFollowUpData.gs) supaya tidak perlu menarik
// payload getData() yang berat (finance+marketing+leads dst).
// =========================================================================

// Coba fetch dengan percobaan ulang otomatis -- Apps Script kadang lambat
// merespons pertama kali (cold start) kalau sudah lama tidak dipanggil,
// jadi kita kasih kesempatan coba lagi sebelum benar-benar dianggap gagal.
async function fetchDenganRetry_(url, percobaanMaks) {
  percobaanMaks = percobaanMaks || 3;
  var errorTerakhir = null;

  for (var percobaan = 1; percobaan <= percobaanMaks; percobaan++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      errorTerakhir = err;
      if (percobaan < percobaanMaks) {
        // Tunggu sebentar sebelum coba lagi, makin lama tiap gagal
        // (percobaan 1 gagal -> tunggu 2 detik, percobaan 2 gagal -> tunggu 4 detik, dst)
        await new Promise(resolve => setTimeout(resolve, 2000 * percobaan));
      }
    }
  }
  throw errorTerakhir;
}

async function tarikDataFollowUp() {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (overlay) overlay.style.display = 'flex';

  try {
    const data = await fetchDenganRetry_(scriptURL + '?action=getFollowUpData', 3);

    dataAiAnalysis = data.aiAnalysis || [];
    dataFollowUpState = data.followUpState || [];
    dataDripTracking = data.dripTracking || [];
    dataNamaKodeByHp = data.namaKodeByHp || {};
    dataPengaturanFollowUp = data.pengaturanFollowUp || { aktif: true };
    dataPengaturanFollowUpProduk = data.pengaturanFollowUpPerProduk || [];
    dataKolomFupProduk = data.kolomFupProduk || [];
    dataAiErrorLog = data.aiErrorLog || [];
    dataFewShotList = data.fewShotList || [];

    if (typeof isiDropdownProdukAiChat === 'function') isiDropdownProdukAiChat();
    if (typeof renderAiChatTable === 'function') renderAiChatTable();
    if (typeof renderFollowUpTable === 'function') renderFollowUpTable();
    if (typeof renderPengaturanAktif === 'function') renderPengaturanAktif();
    if (typeof renderPengaturanProduk === 'function') renderPengaturanProduk();
    if (typeof isiDropdownJenisPromptError_ === 'function') isiDropdownJenisPromptError_();
    if (typeof renderErrorLogTable === 'function') renderErrorLogTable();
    if (typeof isiDropdownJenisPromptFewShot_ === 'function') isiDropdownJenisPromptFewShot_();
    if (typeof renderFewShotTable === 'function') renderFewShotTable();
  } catch (err) {
    console.error('Gagal memuat data Follow-up:', err);
    alert('❌ Gagal memuat data dari server setelah beberapa kali percobaan. Cek koneksi atau scriptURL di followup.html.\n\n' + err);
  } finally {
    if (overlay) { overlay.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; overlay.style.opacity = '1'; }, 250); }
  }
}

// --- Simpan status aktif/nonaktif sistem follow-up (round-trip aman:
// kirim balik semua field lama supaya template lama di sheet
// DB_PengaturanFollowUp tidak ikut tertimpa kosong). ---
async function simpanAktifGlobal() {
  const aktifBaru = document.getElementById('fuAktifGlobal').checked;
  const cfg = dataPengaturanFollowUp || {};

  const params = new URLSearchParams();
  params.append('action', 'simpanPengaturanFollowUp');
  params.append('aktif', aktifBaru);
  params.append('templateQualifying', cfg.template_qualifying || '');
  params.append('templateAman', cfg.template_aman || '');
  params.append('templateAmanLanjutan', cfg.template_aman_lanjutan || '');
  params.append('templateAbuabu', cfg.template_abuabu || '');
  params.append('templateTolak', cfg.template_tolak || '');
  params.append('templateRepeatCustomer', cfg.template_repeat_customer || '');
  params.append('templateLokasiLuarKota', cfg.template_lokasi_luar_kota || '');
  params.append('batasHariAman', cfg.batas_hari_aman || 15);
  params.append('batasHariAbuabu', cfg.batas_hari_abuabu || 30);
  params.append('urlPlPdf', cfg.url_pl_pdf || '');
  params.append('namaFilePdf', cfg.nama_file_pdf || '');

  try {
    const res = await fetch(scriptURL, { method: 'POST', body: params });
    const result = await res.json();
    if (result.result === 'success') {
      alert('✅ Status sistem follow-up berhasil disimpan.');
      dataPengaturanFollowUp.aktif = aktifBaru;
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}

// --- Simpan seluruh baris pengaturan template per produk (termasuk
// __GLOBAL__). Server men-CLEAR semua baris lalu tulis ulang dari array
// yang dikirim -- jadi WAJIB kirim SELURUH baris, bukan cuma yang diedit. ---
async function simpanPengaturanProduk() {
  if (!confirm('Simpan semua perubahan template follow-up per produk sekarang?')) return;

  const params = new URLSearchParams();
  params.append('action', 'simpanPengaturanFollowUpProduk');
  params.append('dataJson', JSON.stringify(dataPengaturanFollowUpProduk));

  try {
    const res = await fetch(scriptURL, { method: 'POST', body: params });
    const result = await res.json();
    if (result.result === 'success') {
      alert('✅ Semua template berhasil disimpan.');
      await tarikDataFollowUp();
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  tarikDataFollowUp();
});
