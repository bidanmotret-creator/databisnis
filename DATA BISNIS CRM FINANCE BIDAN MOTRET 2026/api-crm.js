// api-crm.js — komunikasi ke Apps Script untuk crm.html

// Fetch + parse JSON dengan pesan error yang jelas (mandiri, tidak butuh nav.js)
async function fetchJsonAman(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new Error('Gagal terhubung ke server: ' + err.message);
  }
  let text;
  try {
    text = await res.text();
  } catch (err) {
    throw new Error('Gagal membaca respons server.');
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new Error('Server tidak mengembalikan JSON valid (cek URL deploy Apps Script). Cuplikan: ' + text.substring(0, 200));
  }
  if (json && json.result === 'error') {
    throw new Error(json.message || 'Terjadi error di server.');
  }
  return json;
}

async function tarikDataCrm() {
  const badge = document.getElementById('bgRefreshBadge');
  if (badge) { badge.style.display = 'inline-block'; badge.style.background = '#0f172a'; badge.textContent = '🔄 Menyegarkan data…'; }
  try {
    const data = await fetchJsonAman(scriptURL + '?action=getCrmData');
    dataCrm = data.clients || [];
    stageByHp = data.stageByHp || {};
    aiByHp = data.aiByHp || {};
    chatStat = data.chatStat || {};
    capiByKode = data.capiByKode || {};
    dripByHp = data.dripByHp || {};
    dataPengaturanFollowUpProduk = data.pengaturanFollowUpPerProduk || [];
    dataWilayahOptions = data.wilayahOptions || { provinsi: [], kabupatenByProvinsi: {} };
    isiDropdownMinat_();

    const q = new URLSearchParams(location.search).get('cari');
    if (q && !window._cariTerapkan) { document.getElementById('fCari').value = q; window._cariTerapkan = true; }

    if (!window._filterAwalDiset) {
      window._filterAwalDiset = true;
      presetChat('bulan');
    } else {
      renderCrm();
    }
  } catch (err) {
    console.error('Gagal memuat data CRM:', err);
    if (badge) {
      badge.style.background = '#b91c1c';
      badge.textContent = '⚠️ Gagal refresh (data lama masih tampil)';
      badge.style.display = 'inline-block';
      setTimeout(() => { badge.style.display = 'none'; }, 4000);
    }
    return;
  }
  if (badge) badge.style.display = 'none';
}

async function simpanLead() {
  const btn = document.getElementById('mSimpan');
  const v = id => document.getElementById(id).value;
  const asli = dataCrm.find(r => r.kode_leads === modalKode) || {};
  const p = new URLSearchParams();
  p.append('action', 'update');
  p.append('no_hp', v('mHp')); p.append('tanggal_chat', v('mTglChat')); p.append('minat', v('mMinat'));
  p.append('nama', v('mNama')); p.append('alamat', v('mAlamat')); p.append('data_anak', v('mDataAnak'));
  p.append('jadwal', v('mJadwal')); p.append('status', v('mStatus')); p.append('paket', v('mPaket'));
  p.append('total', v('mTotal') || 0); p.append('transport', v('mTransport') || 0);
  p.append('tgl_bayar1', v('mTgl1')); p.append('jml_bayar1', v('mJml1') || 0);
  p.append('tgl_bayar2', v('mTgl2')); p.append('jml_bayar2', v('mJml2') || 0);
  p.append('sumber', asli.sumber || ''); p.append('gender_anak', asli.gender_anak || '');
  p.append('varian', asli.varian || '-'); p.append('promo', asli.promo || '-');
  p.append('lokasi', asli.lokasi || '-'); p.append('hpp', asli.hpp || 0);
    p.append('sumber', asli.sumber || ''); p.append('gender_anak', asli.gender_anak || '');
  p.append('varian', asli.varian || '-'); p.append('promo', asli.promo || '-');
  p.append('lokasi', asli.lokasi || '-'); p.append('hpp', asli.hpp || 0);
  p.append('provinsi', document.getElementById('mProvinsi').value || '');
  p.append('kabupaten_kota', document.getElementById('mKabupaten').value || '');

  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') { tutupModal(); await tarikDataCrm(); }
    else alert('❌ Gagal: ' + (r.message || 'unknown'));
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = '💾 Simpan';
  }
}

document.addEventListener('DOMContentLoaded', tarikDataCrm);

let chatAktif = { hp: '', nama: '' };
async function bukaChat(hp, nama) {
  chatAktif = { hp, nama };
  const modal = document.getElementById('modalChat'), body = document.getElementById('cBody');
  document.getElementById('cJudul').textContent = '💬 ' + (nama || hp) + ' · ' + hp;
  body.innerHTML = '<p style="color:#94a3b8;">Memuat riwayat chat...</p>';
  modal.style.display = 'flex';
  try {
    const data = await fetchJsonAman(scriptURL + '?action=getChatHistory&hp=' + encodeURIComponent(hp));
    renderChat(data, body);
    await muatSusunFollowUp(hp);

    // Auto refresh analisis SILENT kalau belum ada / sudah > 60 menit
    const analisisTerakhir = (data.analisis || []).slice(-1)[0];
    const basi = !analisisTerakhir || (Date.now() - new Date(analisisTerakhir.waktu).getTime()) > 60 * 60 * 1000;
    if (basi) {
      try {
        const p = new URLSearchParams();
        p.append('action', 'analisisUlangNomor');
        p.append('noHp', hp);
        await fetchJsonAman(scriptURL, { method: 'POST', body: p });
        const dataBaru = await fetchJsonAman(scriptURL + '?action=getChatHistory&hp=' + encodeURIComponent(hp));
        renderChat(dataBaru, body);
        tarikDataCrm();
      } catch (eSilent) { /* diamkan, biar tidak ganggu CS kalau gagal */ }
    }
  } catch (err) {
    body.innerHTML = '<p style="color:#ef4444;">❌ Gagal memuat: ' + esc(err.message) + '</p>';
  }
}

async function refreshChat() {
  if (!chatAktif.hp) return;
  await bukaChat(chatAktif.hp, chatAktif.nama);
  tarikDataCrm();
}

async function analisisUlang() {
  if (!chatAktif.hp) return;
  if (!confirm('Jalankan analisis AI ulang untuk ' + chatAktif.hp + '? Hasil baru akan ditambahkan ke AI_Chat_Analysis.')) return;
  const btn = document.getElementById('btnAnalisisUlang');
  btn.disabled = true; btn.textContent = '⏳ Menganalisis...';
  try {
    const p = new URLSearchParams();
    p.append('action', 'analisisUlangNomor');
    p.append('noHp', chatAktif.hp);
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') await refreshChat();
    else alert('❌ Gagal: ' + (r.message || 'unknown'));
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = '🧠 Analisis Ulang';
  }
}

async function kirimUlangCapi(kode) {
  if (!kode) return;
  if (!confirm('Kirim ulang event CAPI (Lead/Purchase) untuk lead ' + kode + ' ke Meta?')) return;
  try {
    const p = new URLSearchParams();
    p.append('action', 'resendCapiLead');
    p.append('kodeLeads', kode);
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') {
      alert('✅ CAPI terkirim ulang untuk ' + kode + ' (' + r.data.eventsSent + ' event' + (r.data.sudahBayar ? ', termasuk Purchase' : '') + ').');
      await tarikDataCrm();
    } else {
      alert('❌ Gagal: ' + (r.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  }
}

async function hapusLead(kode, paksa) {
  if (!kode) return;
  if (!paksa && !confirm('Hapus lead ' + kode + ' dari database? Tindakan ini tidak bisa dibatalkan.')) return;
  try {
    const p = new URLSearchParams();
    p.append('action', 'deleteLeadByKode');
    p.append('kode', kode);
    if (paksa) p.append('paksa', 'true');
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') {
      await tarikDataCrm();
    } else if (r.result === 'perlu_konfirmasi') {
      if (confirm(r.message + '\n\nTetap hapus paksa?')) await hapusLead(kode, true);
    } else {
      alert('❌ Gagal: ' + (r.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  }
}

// =========================================================================
// REFRESH BACKGROUND (silent, tanpa overlay penuh layar)
// =========================================================================
setInterval(() => { if (!document.hidden) tarikDataCrm(); }, 45000);

// =========================================================================
// SUSUN FOLLOW-UP (Improvisasi AI)
// =========================================================================
let cfgTemplateAktif = null;
let waktuAnalisisTerakhir = null;

async function muatSusunFollowUp(hp) {
  const st = stageByHp[hpNorm(hp)];
  const minat = (st && st.produk) || 'Unknown';
  try {
    const r = await fetchJsonAman(scriptURL + '?action=getTemplateFollowUpUntukMinat&minat=' + encodeURIComponent(minat));
    cfgTemplateAktif = r.cfg || {};
  } catch (err) {
    cfgTemplateAktif = {};
  }
  gantiJenisTemplateFu();
  document.getElementById('fuPreviewBox').style.display = 'none';
}

function gantiJenisTemplateFu() {
  const jenis = document.getElementById('fuJenisTemplate').value;
  const raw = (cfgTemplateAktif && cfgTemplateAktif[jenis]) || '';
  const nama = (chatAktif.nama || 'Kak');
  document.getElementById('fuPesanDraft').value = raw
    .split('[NAMA]').join(nama)
    .split('[USIA_HARI]').join('-')
    .split('[BATAS_AMAN]').join(cfgTemplateAktif.batas_hari_aman || 15)
    .split('[LOKASI_NOTE]').join('');
  updateCharCountFu();
}

function updateCharCountFu() {
  document.getElementById('fuCharCount').textContent = document.getElementById('fuPesanDraft').value.length + ' karakter';
}

async function generateImprovisasiAI() {
  if (!chatAktif.hp) return;
  const draft = document.getElementById('fuPesanDraft').value.trim();
  if (!draft) { alert('⚠️ Isi dulu draft pesannya (atau pilih jenis template).'); return; }

  const btn = document.getElementById('btnImprovisasiAI');
  btn.disabled = true; btn.textContent = '⏳ Menyusun...';
  try {
    const st = stageByHp[hpNorm(chatAktif.hp)];
    const p = new URLSearchParams();
    p.append('action', 'generateImprovisasiFollowUp');
    p.append('noHp', chatAktif.hp);
    p.append('draftDasar', draft);
    p.append('labelStage', st ? (LABEL_STAGE[st.stage] || '') : '');
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') {
      document.getElementById('fuPreviewTeks').textContent = r.pesan;
      document.getElementById('fuPreviewBox').style.display = 'block';
    } else {
      alert('❌ Gagal: ' + (r.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = '✨ Improvisasi dengan AI';
  }
}

function pakaiHasilImprovisasi() {
  document.getElementById('fuPesanDraft').value = document.getElementById('fuPreviewTeks').textContent;
  document.getElementById('fuPreviewBox').style.display = 'none';
  updateCharCountFu();
}

async function simpanSebagaiFewShot() {
  const teks = document.getElementById('fuPreviewTeks').textContent;
  const catatan = prompt('Catatan singkat untuk contoh ini (opsional):', 'Hasil improvisasi AI - ' + (chatAktif.nama || chatAktif.hp));
  if (catatan === null) return;
  try {
    const p = new URLSearchParams();
    p.append('action', 'tambahFewShot');
    p.append('dataJson', JSON.stringify({
      jenis_prompt: 'chat_analysis',
      pesan_contoh: '(Contoh gaya follow-up) ' + document.getElementById('fuPesanDraft').value.substring(0, 200),
      output_ideal: teks,
      catatan: catatan || '',
      aktif: false
    }));
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') alert('✅ Tersimpan sebagai contoh (nonaktif). Aktifkan lewat halaman AI Learning kalau sudah dicek.');
    else alert('❌ Gagal: ' + (r.message || 'unknown'));
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  }
}

async function kirimWhatsappPanel() {
  const pesan = document.getElementById('fuPesanDraft').value.trim();
  if (!pesan) { alert('⚠️ Pesan kosong.'); return; }
  if (!confirm('Kirim pesan ini ke ' + (chatAktif.nama || chatAktif.hp) + ' sekarang?')) return;
  try {
    const p = new URLSearchParams();
    p.append('action', 'kirimPesanManualNomor');
    p.append('noHp', chatAktif.hp);
    p.append('pesan', pesan);
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') {
      alert('✅ Pesan terkirim.');
      await refreshChat();
    } else {
      alert('❌ Gagal: ' + (r.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  }
}
// =========================================================================
// MONITOR STAGE (versi ringkas di CRM) — edit stage/produk/lokasi cepat
// & kirim follow-up manual, tanpa pindah ke followup.html.
// =========================================================================
async function kirimFollowUpManual(noHp, nama) {
  if (!confirm('Kirim follow-up manual ke ' + nama + ' (' + noHp + ') sekarang juga?')) return;
  try {
    const p = new URLSearchParams();
    p.append('action', 'kirimFollowUpManual');
    p.append('noHp', noHp);
    p.append('namaKontak', nama);
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') {
      alert('✅ ' + (r.message || 'Follow-up terkirim.'));
      await tarikDataCrm();
    } else {
      alert('❌ Gagal: ' + (r.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  }
}

let stageModalHpNorm = '', stageModalNoHp = '', stageModalNama = '';

function bukaModalEditStageCrm(hpN, noHp, nama) {
  stageModalHpNorm = hpN; stageModalNoHp = noHp; stageModalNama = nama;
  const st = stageByHp[hpN] || { stage: 0, produk: '' };
  const info = dataCrm.find(r => hpNorm(r.no_hp) === hpN) || {};

  document.getElementById('scJudul').textContent = 'Edit Stage: ' + nama + ' (' + noHp + ')';
  document.getElementById('scStage').value = st.stage;
  document.getElementById('scProduk').value = st.produk || info.minat || '';
  document.getElementById('scLokasi').value = info.alamat || '';

  const match = (info.data_anak || '').match(/(Lahir|HPL):\s*(\d{4}-\d{2}-\d{2})/);
  document.getElementById('scStatusAnak').value = match ? (match[1] === 'Lahir' ? 'sudah_lahir' : 'belum_lahir') : 'belum_lahir';
  document.getElementById('scTglLahir').value = match ? match[2] : '';

  updateInfoWindowStageCrm();
  document.getElementById('modalEditStageCrm').style.display = 'flex';
}

function tutupModalEditStageCrm() {
  document.getElementById('modalEditStageCrm').style.display = 'none';
}

function updateInfoWindowStageCrm() {
  const tgl = document.getElementById('scTglLahir').value;
  const status = document.getElementById('scStatusAnak').value;
  const produk = document.getElementById('scProduk').value;
  const el = document.getElementById('scInfoWindow');
  if (!tgl) { el.textContent = 'Isi tanggal untuk lihat perhitungan window.'; return; }
  const prefix = status === 'sudah_lahir' ? 'Lahir' : 'HPL';
  const info = hitungInfoWindowCrm_(prefix + ': ' + tgl, produk);
  el.textContent = info.teks;
}

async function simpanEditStageCrm() {
  const stageBaru = document.getElementById('scStage').value;
  const produkBaru = document.getElementById('scProduk').value.trim();
  const statusAnak = document.getElementById('scStatusAnak').value;
  const tglLahir = document.getElementById('scTglLahir').value;
  const lokasi = document.getElementById('scLokasi').value.trim();

  try {
    const p1 = new URLSearchParams();
    p1.append('action', 'updateFollowUpManual');
    p1.append('noHp', stageModalNoHp);
    p1.append('stageBaru', stageBaru);
    p1.append('produkBaru', produkBaru);
    p1.append('namaKontak', stageModalNama);
    await fetch(scriptURL, { method: 'POST', body: p1 });

    if (tglLahir || lokasi) {
      const p2 = new URLSearchParams();
      p2.append('action', 'updateDataAnakManual');
      p2.append('noHp', stageModalNoHp);
      p2.append('statusBaru', statusAnak);
      p2.append('tglLahirBaru', tglLahir);
      p2.append('lokasiBaru', lokasi);
      await fetch(scriptURL, { method: 'POST', body: p2 });
    }

    alert('✅ Stage & data anak berhasil diperbarui.');
    tutupModalEditStageCrm();
    await tarikDataCrm();
  } catch (err) {
    alert('❌ Gagal menyimpan: ' + err.message);
  }
}

document.addEventListener('change', (e) => {
  if (['scTglLahir', 'scStatusAnak', 'scProduk'].includes(e.target.id)) updateInfoWindowStageCrm();
});