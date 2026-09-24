// api-crm.js — komunikasi ke Apps Script untuk crm.html
// (sudah memakai fetchJsonAman dari nav.js supaya error server tampil jelas)
async function tarikDataCrm() {
  const overlay = document.getElementById('globalLoadingOverlay');
  if (overlay) overlay.style.display = 'flex';
  try {
    const data = await fetchJsonAman(scriptURL + '?action=getCrmData');
    dataCrm = data.clients || [];
    stageByHp = data.stageByHp || {};
    aiByHp = data.aiByHp || {};
    chatStat = data.chatStat || {};
    isiDropdownMinat_();
    const q = new URLSearchParams(location.search).get('cari');
    if (q && !window._cariTerapkan) { document.getElementById('fCari').value = q; window._cariTerapkan = true; }
    renderCrm();
  } catch (err) {
    alert('❌ Gagal memuat data CRM.\n\n' + err.message);
  } finally {
    if (overlay) overlay.style.display = 'none';
  }
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
