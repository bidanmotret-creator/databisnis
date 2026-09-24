// =========================================================================
// api-followup.js — khusus halaman followup.html.
// Pakai action server BARU yang ringan: ?action=getFollowUpData
// (lihat TAMBAHAN_CodeGs_getFollowUpData.gs) supaya tidak perlu menarik
// payload getData() yang berat (finance+marketing+leads dst).
// =========================================================================

async function tarikDataFollowUp() {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (overlay) overlay.style.display = 'flex';

  try {
    const data = await fetchJsonAman(scriptURL + '?action=getFollowUpData');

    dataAiAnalysis = data.aiAnalysis || [];
    dataFollowUpState = data.followUpState || [];
    dataDripTracking = data.dripTracking || [];
    dataNamaKodeByHp = data.namaKodeByHp || {};
    dataPengaturanFollowUp = data.pengaturanFollowUp || { aktif: true };
    dataPengaturanFollowUpProduk = data.pengaturanFollowUpPerProduk || [];
    dataKolomFupProduk = data.kolomFupProduk || [];
    dataAiErrorLog = data.aiErrorLog || [];
    dataFewShotList = data.fewShotList || [];
    dataAnalisisEvaluasi = data.analisisEvaluasi || {};
dataPengaturanSistem = data.pengaturanSistem || {};

    // Render semuanya (fungsi ada di ui-followup.js dan ui-fewshot.js)
    if (typeof isiDropdownProdukAiChat === 'function') isiDropdownProdukAiChat();
    if (typeof renderAiChatTable === 'function') renderAiChatTable();
    if (typeof renderFollowUpTable === 'function') renderFollowUpTable();
    if (typeof renderPengaturanAktif === 'function') renderPengaturanAktif();
    if (typeof renderPengaturanProduk === 'function') renderPengaturanProduk();
    if (typeof isiDropdownJenisPromptError_ === 'function') isiDropdownJenisPromptError_();
    if (typeof renderErrorLogTable === 'function') renderErrorLogTable();
    if (typeof isiDropdownJenisPromptFewShot_ === 'function') isiDropdownJenisPromptFewShot_();
    if (typeof renderFewShotTable === 'function') renderFewShotTable();
    if (typeof renderAnalisisEvaluasi === 'function') renderAnalisisEvaluasi();
if (typeof renderPengaturanSistem === 'function') renderPengaturanSistem();
  } catch (err) {
    console.error('Gagal memuat data Follow-up:', err);
    alert('❌ Gagal memuat data dari server. Cek koneksi atau scriptURL di followup.html.\n\n' + err);
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
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: params });
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
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: params });
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

// =========================================================================
// MODAL EDIT NOMOR (stage, minat, lokasi, tanggal lahir anak)
// =========================================================================
let editModalHpNorm = '';
let editModalNoHp = '';
let editModalNama = '';

function bukaModalEdit(hpNorm, noHp, nama) {
  editModalHpNorm = hpNorm;
  editModalNoHp = noHp;
  editModalNama = nama;

  const stageMap = ambilStageTerakhirPerHp_();
  const info = dataNamaKodeByHp[hpNorm] || {};
  const st = stageMap[hpNorm] || { stage: 0, product_interest: '' };

  document.getElementById('modalEditJudul').textContent = 'Edit: ' + nama + ' (' + noHp + ')';
  document.getElementById('editStage').value = st.stage;
  document.getElementById('editProduk').value = st.product_interest || '';
  document.getElementById('editLokasi').value = info.alamat || '';

  const match = (info.data_anak || '').match(/(Lahir|HPL):\s*(\d{4}-\d{2}-\d{2})/);
  if (match) {
    document.getElementById('editStatusAnak').value = match[1] === 'Lahir' ? 'sudah_lahir' : 'belum_lahir';
    document.getElementById('editTglLahir').value = match[2];
  } else {
    document.getElementById('editStatusAnak').value = 'belum_lahir';
    document.getElementById('editTglLahir').value = '';
  }

  updateInfoWindowModal();
  document.getElementById('modalEditNomor').style.display = 'flex';
}

function updateInfoWindowModal() {
  const tgl = document.getElementById('editTglLahir').value;
  const status = document.getElementById('editStatusAnak').value;
  const produk = document.getElementById('editProduk').value;
  const el = document.getElementById('editInfoWindow');
  if (!tgl) { el.textContent = 'Isi tanggal untuk lihat perhitungan window.'; return; }
  const prefix = status === 'sudah_lahir' ? 'Lahir' : 'HPL';
  const info = hitungInfoWindow_(prefix + ': ' + tgl, produk);
  el.textContent = info.teks;
}

document.addEventListener('change', (e) => {
  if (['editTglLahir', 'editStatusAnak', 'editProduk'].includes(e.target.id)) updateInfoWindowModal();
});

function tutupModalEdit() {
  document.getElementById('modalEditNomor').style.display = 'none';
}

async function simpanEditNomor() {
  const stageBaru = document.getElementById('editStage').value;
  const produkBaru = document.getElementById('editProduk').value.trim();
  const statusAnak = document.getElementById('editStatusAnak').value;
  const tglLahir = document.getElementById('editTglLahir').value;
  const lokasi = document.getElementById('editLokasi').value.trim();

  try {
    // 1. Update stage & produk
    const params1 = new URLSearchParams();
    params1.append('action', 'updateFollowUpManual');
    params1.append('noHp', editModalNoHp);
    params1.append('stageBaru', stageBaru);
    params1.append('produkBaru', produkBaru);
    params1.append('namaKontak', editModalNama);
    await fetch(scriptURL, { method: 'POST', body: params1 });

    // 2. Update data anak & lokasi (kalau ada isinya)
    if (tglLahir || lokasi) {
      const params2 = new URLSearchParams();
      params2.append('action', 'updateDataAnakManual');
      params2.append('noHp', editModalNoHp);
      params2.append('statusBaru', statusAnak);
      params2.append('tglLahirBaru', tglLahir);
      params2.append('lokasiBaru', lokasi);
      await fetch(scriptURL, { method: 'POST', body: params2 });
    }

    alert('✅ Data berhasil diperbarui.');
    tutupModalEdit();
    await tarikDataFollowUp();
  } catch (err) {
    alert('❌ Gagal menyimpan: ' + err);
  }
}

// =========================================================================
// FOLLOW-UP MANUAL SEKARANG
// =========================================================================
async function kirimFollowUpManual(noHp, nama) {
  if (!confirm('Kirim follow-up manual ke ' + nama + ' (' + noHp + ') sekarang juga?')) return;

  const params = new URLSearchParams();
  params.append('action', 'kirimFollowUpManual');
  params.append('noHp', noHp);
  params.append('namaKontak', nama);

  try {
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: params });
    if (result.result === 'success') {
      alert('✅ ' + (result.message || 'Follow-up terkirim.'));
      await tarikDataFollowUp();
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}