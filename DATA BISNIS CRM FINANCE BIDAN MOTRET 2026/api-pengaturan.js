// api-pengaturan.js — komunikasi ke Apps Script khusus halaman Pengaturan

async function fetchJsonAman(url, options) {
  let res;
  try { res = await fetch(url, options); }
  catch (err) { throw new Error('Gagal terhubung ke server: ' + err.message); }
  let text;
  try { text = await res.text(); }
  catch (err) { throw new Error('Gagal membaca respons server.'); }
  let json;
  try { json = JSON.parse(text); }
  catch (err) { throw new Error('Server tidak mengembalikan JSON valid. Cuplikan: ' + text.substring(0, 200)); }
  if (json && json.result === 'error') throw new Error(json.message || 'Terjadi error di server.');
  return json;
}

async function muatDataPengaturan() {
  const badge = document.getElementById('bgRefreshBadge');
  if (badge) { badge.style.display = 'inline-block'; badge.style.background = '#0f172a'; badge.textContent = '🔄 Memuat pengaturan…'; }
  try {
    const data = await fetchJsonAman(scriptURL + '?action=getPengaturanData');
    STUDIO_CONFIG = data.config || {};
    renderSettings(STUDIO_CONFIG);
    muatPengaturanFollowUp(data.pengaturanFollowUp || {});
    isiDatalistAkun(data.accounts || []);
    isiMappingMinatBackfill();
  } catch (err) {
    console.error('Gagal memuat pengaturan:', err);
    if (badge) {
      badge.style.background = '#b91c1c';
      badge.textContent = '⚠️ Gagal memuat pengaturan';
      setTimeout(() => { badge.style.display = 'none'; }, 4000);
    }
    return;
  }
  if (badge) badge.style.display = 'none';
}
document.addEventListener('DOMContentLoaded', muatDataPengaturan);

function renderSettings(cfg) {
  const j = v => v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v, null, 2));
  const list = v => Array.isArray(v) ? v.join('\n') : '';
  document.getElementById('set_sumber').value = list(cfg.sumber);
  document.getElementById('set_minat').value = list(cfg.minat);
  document.getElementById('set_lokasi').value = list(cfg.lokasi);
  document.getElementById('set_promo').value = list(cfg.promo);
  document.getElementById('set_wa').value = cfg.waTemplate || '';
  document.getElementById('set_paketMap').value = j(cfg.paketMap || {});
  document.getElementById('set_varianMap').value = j(cfg.varianMap || {});
}

function isiDatalistAkun(accounts) {
  const dl = document.getElementById('listAkun');
  if (!dl) return;
  dl.innerHTML = accounts.map(a => `<option value="${a.kode} - ${a.nama}">`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  const formSettings = document.getElementById('formSettings');
  if (!formSettings) return;
  formSettings.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const teksAsli = btn.innerText;
    btn.disabled = true; btn.innerText = '⏳ Menyimpan...';
    try {
      STUDIO_CONFIG.sumber = document.getElementById('set_sumber').value.split('\n').filter(x => x.trim() !== '');
      STUDIO_CONFIG.minat = document.getElementById('set_minat').value.split('\n').filter(x => x.trim() !== '');
      STUDIO_CONFIG.lokasi = document.getElementById('set_lokasi').value.split('\n').filter(x => x.trim() !== '');
      STUDIO_CONFIG.promo = document.getElementById('set_promo').value.split('\n').filter(x => x.trim() !== '');
      STUDIO_CONFIG.waTemplate = document.getElementById('set_wa').value;
      STUDIO_CONFIG.paketMap = JSON.parse(document.getElementById('set_paketMap').value || '{}');
      STUDIO_CONFIG.varianMap = JSON.parse(document.getElementById('set_varianMap').value || '{}');

      const p = new URLSearchParams();
      p.append('action', 'saveConfig');
      p.append('configJson', JSON.stringify(STUDIO_CONFIG));
      const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
      if (r.result === 'success') { alert('✅ Konfigurasi berhasil disimpan!'); isiMappingMinatBackfill(); }
      else alert('❌ Gagal: ' + (r.message || 'unknown'));
    } catch (err) {
      alert('❌ Gagal! Periksa kembali format JSON pada Map Paket/Varian, atau koneksi: ' + err.message);
    } finally {
      btn.disabled = false; btn.innerText = teksAsli;
    }
  });
});

// ================= Perawatan Data =================
async function backfillKodeLeadsLama() {
  if (!confirm('Isi Kode Leads untuk semua data lama yang belum punya kode? Aman dijalankan berkali-kali.')) return;
  try {
    const p = new URLSearchParams();
    p.append('action', 'backfillKodeLeads');
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') alert(`✅ Selesai! ${r.filled} baris data lama diberi Kode Leads baru.`);
    else alert('❌ Gagal: ' + (r.message || 'unknown'));
  } catch (err) {
    alert('❌ Gagal: ' + err.message);
  }
}

function isiMappingMinatBackfill() {
  const container = document.getElementById('bf_map_minat_container');
  if (!container) return;
  const daftarMinat = STUDIO_CONFIG.minat || [];
  container.innerHTML = daftarMinat.map(m => `
    <div>
      <label style="font-size:11px; color:#1e3a8a; font-weight:700; display:block; margin-bottom:3px;">${m}</label>
      <input type="text" class="bf-map-minat-input" data-minat="${m}" list="listAkun"
        placeholder="(pakai default)" style="width:100%; padding:7px; border-radius:6px; border:1px solid #bfdbfe; font-size:12.5px;">
    </div>`).join('');
}

function ambilMapMinatBackfill() {
  const map = {};
  document.querySelectorAll('.bf-map-minat-input').forEach(el => { if (el.value.trim()) map[el.dataset.minat] = el.value.trim(); });
  return map;
}

async function previewBackfillJurnal() {
  const hasilEl = document.getElementById('bf_hasil_preview');
  hasilEl.style.display = 'block';
  hasilEl.innerHTML = '⏳ Menghitung kandidat transaksi...';
  document.getElementById('btnJalankanBackfillJurnal').disabled = true;
  try {
    const p = new URLSearchParams();
    p.append('action', 'previewBackfillJurnalHistoris');
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (result.result !== 'success') { hasilEl.innerHTML = `❌ ${result.message || 'Gagal preview'}`; return; }
    if (result.jumlahBaris === 0) {
      hasilEl.innerHTML = '✅ Tidak ada transaksi lama yang perlu disinkron.';
      return;
    }
    const tabelContoh = result.contoh.map(k => `
      <tr><td>${k.kode_leads}</td><td>${k.nama}</td><td>${k.minat || '-'}</td><td style="text-align:right;">Rp ${k.total.toLocaleString('id-ID')}</td></tr>`).join('');
    hasilEl.innerHTML = `
      <p style="font-weight:800; color:#166534; margin:0 0 8px 0;">Ditemukan ${result.jumlahBaris} baris siap disinkron, total Rp ${result.totalNominal.toLocaleString('id-ID')}.</p>
      <p style="font-size:12px; color:#64748b; margin:0 0 10px 0;">Contoh (maks 15 baris pertama):</p>
      <div class="table-responsive" style="max-height:250px; overflow-y:auto;"><table><thead><tr><th>Kode</th><th>Nama</th><th>Minat</th><th>Total</th></tr></thead><tbody>${tabelContoh}</tbody></table></div>
      <p style="font-size:12px; color:#b45309; margin-top:10px; font-weight:700;">Pastikan Akun Kas dan Akun Pendapatan Default di atas sudah benar sebelum klik "Jalankan Sinkronisasi".</p>`;
    document.getElementById('btnJalankanBackfillJurnal').disabled = false;
  } catch (err) {
    hasilEl.innerHTML = '❌ Gagal preview (koneksi): ' + err.message;
  }
}

async function jalankanBackfillJurnal() {
  const akunKas = document.getElementById('bf_akun_kas').value.trim();
  const akunPendapatanDefault = document.getElementById('bf_akun_pendapatan_default').value.trim();
  if (!akunKas || !akunPendapatanDefault) { alert('Isi dulu Akun Kas/Bank Tujuan dan Akun Pendapatan Default.'); return; }
  if (!confirm('Yakin jalankan sinkronisasi? Proses ini menulis jurnal baru ke DB_Jurnal dan tidak bisa "undo" otomatis.')) return;

  const btn = document.getElementById('btnJalankanBackfillJurnal');
  const teksAsli = btn.innerText;
  btn.disabled = true; btn.innerText = '⏳ Memproses...';
  try {
    const p = new URLSearchParams();
    p.append('action', 'jalankanBackfillJurnalHistoris');
    p.append('akunKas', akunKas);
    p.append('akunPendapatanDefault', akunPendapatanDefault);
    p.append('mapMinatAkun', JSON.stringify(ambilMapMinatBackfill()));
    const result = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (result.result === 'success') {
      alert(`✅ Selesai! ${result.diposting} transaksi disinkron, total Rp ${result.totalNominal.toLocaleString('id-ID')}.`);
      document.getElementById('bf_hasil_preview').style.display = 'none';
    } else {
      alert('❌ Gagal: ' + (result.message || 'error tidak diketahui'));
    }
  } catch (err) {
    alert('❌ Gagal (koneksi): ' + err.message);
  } finally {
    btn.disabled = false; btn.innerText = teksAsli;
  }
}

// ================= Follow-Up Otomatis WA =================
function muatPengaturanFollowUp(cfg) {
  document.getElementById('fuAktif').checked = !!cfg.aktif;
  document.getElementById('fuTemplateQualifying').value = cfg.template_qualifying || '';
  document.getElementById('fuTemplateAman').value = cfg.template_aman || '';
  document.getElementById('fuTemplateAmanLanjutan').value = cfg.template_aman_lanjutan || '';
  document.getElementById('fuTemplateAbuabu').value = cfg.template_abuabu || '';
  document.getElementById('fuTemplateTolak').value = cfg.template_tolak || '';
  document.getElementById('fuTemplateRepeat').value = cfg.template_repeat_customer || '';
  document.getElementById('fuTemplateLokasi').value = cfg.template_lokasi_luar_kota || '';
  document.getElementById('fuBatasAman').value = cfg.batas_hari_aman || 15;
  document.getElementById('fuBatasAbuabu').value = cfg.batas_hari_abuabu || 30;
  document.getElementById('fuUrlPdf').value = cfg.url_pl_pdf || '';
  document.getElementById('fuNamaFilePdf').value = cfg.nama_file_pdf || '';
}

async function simpanPengaturanFollowUpUI() {
  const p = new URLSearchParams();
  p.append('action', 'simpanPengaturanFollowUp');
  p.append('aktif', document.getElementById('fuAktif').checked);
  p.append('templateQualifying', document.getElementById('fuTemplateQualifying').value);
  p.append('templateAman', document.getElementById('fuTemplateAman').value);
  p.append('templateAmanLanjutan', document.getElementById('fuTemplateAmanLanjutan').value);
  p.append('templateAbuabu', document.getElementById('fuTemplateAbuabu').value);
  p.append('templateTolak', document.getElementById('fuTemplateTolak').value);
  p.append('templateRepeatCustomer', document.getElementById('fuTemplateRepeat').value);
  p.append('templateLokasiLuarKota', document.getElementById('fuTemplateLokasi').value);
  p.append('batasHariAman', document.getElementById('fuBatasAman').value);
  p.append('batasHariAbuabu', document.getElementById('fuBatasAbuabu').value);
  p.append('urlPlPdf', document.getElementById('fuUrlPdf').value);
  p.append('namaFilePdf', document.getElementById('fuNamaFilePdf').value);

  const box = document.getElementById('fuHasilSimpan');
  try {
    const data = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    box.style.display = 'block';
    if (data.result === 'success') {
      box.style.background = '#dcfce7'; box.style.color = '#166534';
      box.textContent = '✅ Pengaturan berhasil disimpan!';
    } else {
      box.style.background = '#fee2e2'; box.style.color = '#991b1b';
      box.textContent = '❌ Gagal: ' + data.message;
    }
  } catch (err) {
    box.style.display = 'block';
    box.style.background = '#fee2e2'; box.style.color = '#991b1b';
    box.textContent = '❌ Gagal simpan: ' + err.message;
  }
}