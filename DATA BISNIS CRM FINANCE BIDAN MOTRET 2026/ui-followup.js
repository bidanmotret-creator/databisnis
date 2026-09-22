// =========================================================================
// ui-followup.js — semua fungsi render untuk followup.html
// =========================================================================

// Samakan persis dengan normalizeTelepon_ di Code.gs supaya join data
// (AI Analysis <-> FollowUp State <-> Drip Tracking <-> Nama/Kode Leads) pas.
function normalizeHpFu_(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (digits.indexOf("0") === 0) digits = "62" + digits.slice(1);
  if (digits.indexOf("62") !== 0) digits = "62" + digits;
  return digits;
}

function labelStageFu(stage) {
  const map = {
    0: "Belum Qualifying", 1: "Menunggu Jawaban", 2: "PL Terkirim",
    3: "Perlu Review CS", 100: "Repeat Customer"
  };
  return map.hasOwnProperty(stage) ? map[stage] : ("Stage " + stage);
}

// =========================================================================
// TAB 1: AI CHAT ANALYSIS
// =========================================================================
function isiDropdownProdukAiChat() {
  const sel = document.getElementById('aiFilterProduk');
  if (!sel) return;
  const nilaiSekarang = sel.value;
  const produkSet = new Set(dataAiAnalysis.map(r => r.product_interest).filter(Boolean));
  sel.innerHTML = '<option value="">Semua</option>' +
    Array.from(produkSet).sort().map(p => `<option value="${p}">${p}</option>`).join('');
  if (nilaiSekarang) sel.value = nilaiSekarang;
}

function renderAiChatKpi_(list) {
  const el = document.getElementById('aiKpiGrid');
  if (!el) return;
  const total = list.length;
  const siapBooking = list.filter(r => r.booking_signal).length;
  const intentTinggi = list.filter(r => r.intent === 'High' || r.intent === 'Very High').length;
  const rataConfidence = total ? (list.reduce((a, r) => a + (r.confidence || 0), 0) / total * 100).toFixed(0) : 0;

  el.innerHTML = `
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${total}</div><div class="l">Total Chat Dianalisis</div></div>
    <div class="fu-kpi-card fu-kpi-4"><div class="n">${siapBooking}</div><div class="l">Sinyal Siap Booking</div></div>
    <div class="fu-kpi-card fu-kpi-3"><div class="n">${intentTinggi}</div><div class="l">Intent Tinggi/Sangat Tinggi</div></div>
    <div class="fu-kpi-card fu-kpi-2"><div class="n">${rataConfidence}%</div><div class="l">Rata-rata Confidence AI</div></div>
  `;
}

function renderAiChatTable() {
  const cari = (document.getElementById('aiFilterCari')?.value || '').toLowerCase().trim();
  const filterProduk = document.getElementById('aiFilterProduk')?.value || '';
  const filterIntent = document.getElementById('aiFilterIntent')?.value || '';
  const filterBooking = document.getElementById('aiFilterBooking')?.value || '';

  let list = [...dataAiAnalysis].sort((a, b) => (b.waktu_analisis || '').localeCompare(a.waktu_analisis || ''));

  if (cari) list = list.filter(r => (r.no_hp || '').toLowerCase().includes(cari) || (r.summary || '').toLowerCase().includes(cari));
  if (filterProduk) list = list.filter(r => r.product_interest === filterProduk);
  if (filterIntent) list = list.filter(r => r.intent === filterIntent);
  if (filterBooking) list = list.filter(r => String(!!r.booking_signal) === filterBooking);

  renderAiChatKpi_(list);

  const tbody = document.getElementById('bAiChatTable');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:#94a3b8; padding:20px;">Tidak ada data yang cocok dengan filter.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const info = dataNamaKodeByHp[normalizeHpFu_(r.no_hp)] || {};
    const intentClass = 'fu-intent-' + String(r.intent || 'Unknown').replace(/\s+/g, '');
    return `<tr>
      <td>${r.no_hp}</td>
      <td>${info.nama || '-'}</td>
      <td>${r.product_interest || '-'}</td>
      <td>${r.timeline || '-'}</td>
      <td>${r.location || '-'}</td>
      <td>${r.budget_signal || '-'}</td>
      <td><span class="fu-badge ${intentClass}">${r.intent || 'Unknown'}</span></td>
      <td>${r.booking_signal ? '✅ Ya' : '—'}</td>
      <td>${Math.round((r.confidence || 0) * 100)}%</td>
      <td style="max-width:280px; white-space:normal;">${r.summary || '-'}</td>
      <td style="white-space:nowrap;">${formatTanggalManusia(r.waktu_analisis)}</td>
    </tr>`;
  }).join('');
}

// =========================================================================
// TAB 2 / SUB-TAB: MONITOR STAGE & DRIP
// =========================================================================
function ambilStageTerakhirPerHp_() {
  // Auto_FollowUp_State adalah LOG (banyak baris per nomor) -- ambil yang
  // paling terakhir (baris terbawah) untuk tiap No HP.
  const map = {};
  dataFollowUpState.forEach(r => {
    const key = normalizeHpFu_(r.no_hp);
    if (!key) return;
    if (!map[key] || (r.waktu_update || '') >= (map[key].waktu_update || '')) map[key] = r;
  });
  return map;
}

function ambilDripByHp_() {
  const map = {};
  dataDripTracking.forEach(r => { map[normalizeHpFu_(r.no_hp)] = r; });
  return map;
}

function renderFollowUpKpi_(gabungan) {
  const el = document.getElementById('fuKpiGrid');
  if (!el) return;
  const total = gabungan.length;
  const stuck1 = gabungan.filter(g => g.stage === 1).length;
  const terkirimPL = gabungan.filter(g => g.stage === 2).length;
  const perluReview = gabungan.filter(g => g.stage === 3).length;
  const sedangDiDrip = gabungan.filter(g => g.drip && g.drip.jumlah_reminder_terkirim > 0 && g.stage === 1).length;

  el.innerHTML = `
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${total}</div><div class="l">Total Nomor Terpantau</div></div>
    <div class="fu-kpi-card fu-kpi-3"><div class="n">${stuck1}</div><div class="l">Menunggu Jawaban (Stage 1)</div></div>
    <div class="fu-kpi-card fu-kpi-2"><div class="n">${terkirimPL}</div><div class="l">PL Sudah Terkirim</div></div>
    <div class="fu-kpi-card fu-kpi-5"><div class="n">${perluReview}</div><div class="l">Perlu Review CS Manual</div></div>
    <div class="fu-kpi-card fu-kpi-4"><div class="n">${sedangDiDrip}</div><div class="l">Sedang Dalam Reminder Drip</div></div>
  `;
}

function renderFollowUpTable() {
  const cari = (document.getElementById('fuFilterCari')?.value || '').toLowerCase().trim();
  const filterStage = document.getElementById('fuFilterStage')?.value || '';
  const filterDrip = document.getElementById('fuFilterDrip')?.value || '';

  const stageMap = ambilStageTerakhirPerHp_();
  const dripMap = ambilDripByHp_();

  let gabungan = Object.keys(stageMap).map(hp => {
    const st = stageMap[hp];
    const drip = dripMap[hp] || null;
    const info = dataNamaKodeByHp[hp] || {};
    return {
      no_hp: st.no_hp, hp_norm: hp, nama: info.nama || (drip ? drip.nama_kontak : '') || '-',
      kode_leads: info.kode_leads || '-', produk: st.product_interest || '-',
      stage: st.stage, catatan: st.catatan, waktu_update: st.waktu_update, drip: drip
    };
  });

  if (cari) gabungan = gabungan.filter(g => g.no_hp.toLowerCase().includes(cari) || (g.nama || '').toLowerCase().includes(cari));
  if (filterStage !== '') gabungan = gabungan.filter(g => String(g.stage) === filterStage);
  if (filterDrip === 'ya') gabungan = gabungan.filter(g => g.drip && g.stage === 1 && (g.drip.jumlah_reminder_terkirim > 0));

  gabungan.sort((a, b) => (b.waktu_update || '').localeCompare(a.waktu_update || ''));

  renderFollowUpKpi_(gabungan);

  const tbody = document.getElementById('bFollowUpTable');
  if (!tbody) return;

  if (gabungan.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">Tidak ada data yang cocok dengan filter.</td></tr>';
    return;
  }

  tbody.innerHTML = gabungan.map(g => `
    <tr>
      <td>${g.no_hp}</td>
      <td>${g.nama}</td>
      <td>${g.kode_leads}</td>
      <td>${g.produk}</td>
      <td><span class="fu-badge fu-stage-${g.stage}">${labelStageFu(g.stage)}</span></td>
      <td style="max-width:260px; white-space:normal;">${g.catatan || '-'}</td>
      <td style="white-space:nowrap;">${formatTanggalManusia(g.waktu_update)}</td>
      <td style="text-align:center;">${g.drip ? g.drip.jumlah_reminder_terkirim + ' / 2' : '-'}</td>
      <td style="white-space:nowrap;">${g.drip && g.drip.waktu_reminder_terakhir ? formatTanggalManusia(g.drip.waktu_reminder_terakhir) : '-'}</td>
    </tr>
  `).join('');
}

// =========================================================================
// SUB-TAB: PENGATURAN TEMPLATE PER PRODUK
// =========================================================================
function renderPengaturanAktif() {
  const cb = document.getElementById('fuAktifGlobal');
  if (cb) cb.checked = !!(dataPengaturanFollowUp && dataPengaturanFollowUp.aktif);
}

const LABEL_KOLOM_FU_ = {
  minat: 'Minat / Kategori Produk',
  butuh_cek_usia_bayi: 'Butuh Cek Usia Bayi? (khusus Newborn)',
  template_qualifying: 'Template Qualifying (Stage 0 → 1)',
  template_detail_acara: 'Template Tanya Detail Acara (non-Newborn, Stage 1)',
  template_setelah_detail: 'Caption Dikirim Bareng PL (non-Newborn)',
  template_aman_lanjutan: 'Template Setelah PL — Newborn Aman',
  template_abuabu: 'Template Newborn Zona Abu-abu',
  template_tolak: 'Template Newborn Ditolak (di luar window)',
  template_repeat_customer: 'Template Sapaan Repeat Customer (khusus __GLOBAL__)',
  template_lokasi_luar_kota: 'Template Catatan Lokasi Luar Kota (khusus __GLOBAL__)',
  template_reminder_h4: 'Template Reminder Drip H+4 Jam',
  template_reminder_h20: 'Template Reminder Drip H+20 Jam',
  batas_hari_aman: 'Batas Hari Aman (Newborn)',
  batas_hari_abuabu: 'Batas Hari Abu-abu (Newborn)',
  url_pl_pdf: 'URL PDF Price List',
  nama_file_pdf: 'Nama File PDF'
};
const FIELD_TEXTAREA_ = ['template_qualifying', 'template_detail_acara', 'template_setelah_detail', 'template_aman_lanjutan', 'template_abuabu', 'template_tolak', 'template_repeat_customer', 'template_lokasi_luar_kota', 'template_reminder_h4', 'template_reminder_h20'];
const FIELD_GLOBAL_ONLY_ = ['template_repeat_customer', 'template_lokasi_luar_kota'];

function renderPengaturanProduk() {
  const container = document.getElementById('fuPengaturanContainer');
  if (!container) return;

  if (!dataPengaturanFollowUpProduk || dataPengaturanFollowUpProduk.length === 0) {
    dataPengaturanFollowUpProduk = [{ minat: '__GLOBAL__', butuh_cek_usia_bayi: true }];
  }

  container.innerHTML = dataPengaturanFollowUpProduk.map((item, idx) => {
    const isGlobal = item.minat === '__GLOBAL__';
    const judul = isGlobal ? '🌐 __GLOBAL__ (fallback default)' : ('📦 ' + (item.minat || '(belum diisi)'));
    return `
      <div class="fu-prod-card">
        <h4>
          <span>${judul}</span>
          ${!isGlobal ? `<button type="button" class="btn-fu-hapus" onclick="hapusBarisProduk(${idx})">🗑️ Hapus</button>` : ''}
        </h4>
        <div class="fu-prod-grid">
          <div class="${isGlobal ? '' : ''}">
            <label>Nama Minat/Produk (persis sama seperti di dropdown Minat)</label>
            <input type="text" ${isGlobal ? 'disabled' : ''} value="${isGlobal ? '__GLOBAL__' : (item.minat || '')}"
              onchange="updateFieldProduk(${idx}, 'minat', this.value)">
          </div>
          <div>
            <label>${LABEL_KOLOM_FU_.butuh_cek_usia_bayi}</label>
            <select onchange="updateFieldProduk(${idx}, 'butuh_cek_usia_bayi', this.value === 'true')">
              <option value="true" ${item.butuh_cek_usia_bayi ? 'selected' : ''}>Ya (Newborn)</option>
              <option value="false" ${!item.butuh_cek_usia_bayi ? 'selected' : ''}>Tidak (non-Newborn)</option>
            </select>
          </div>
          ${FIELD_TEXTAREA_.filter(f => isGlobal || !FIELD_GLOBAL_ONLY_.includes(f)).map(f => `
            <div class="full">
              <label>${LABEL_KOLOM_FU_[f]}${isGlobal ? '' : ' (kosongkan = ikut __GLOBAL__)'}</label>
              <textarea onchange="updateFieldProduk(${idx}, '${f}', this.value)">${(item[f] || '')}</textarea>
            </div>
          `).join('')}
          <div>
            <label>${LABEL_KOLOM_FU_.batas_hari_aman}</label>
            <input type="number" value="${item.batas_hari_aman || ''}" placeholder="${isGlobal ? '15' : '(ikut global)'}"
              onchange="updateFieldProduk(${idx}, 'batas_hari_aman', this.value)">
          </div>
          <div>
            <label>${LABEL_KOLOM_FU_.batas_hari_abuabu}</label>
            <input type="number" value="${item.batas_hari_abuabu || ''}" placeholder="${isGlobal ? '30' : '(ikut global)'}"
              onchange="updateFieldProduk(${idx}, 'batas_hari_abuabu', this.value)">
          </div>
          <div>
            <label>${LABEL_KOLOM_FU_.url_pl_pdf}</label>
            <input type="text" value="${item.url_pl_pdf || ''}" placeholder="${isGlobal ? 'https://...' : '(ikut global)'}"
              onchange="updateFieldProduk(${idx}, 'url_pl_pdf', this.value)">
          </div>
          <div>
            <label>${LABEL_KOLOM_FU_.nama_file_pdf}</label>
            <input type="text" value="${item.nama_file_pdf || ''}" placeholder="${isGlobal ? 'Price List.pdf' : '(ikut global)'}"
              onchange="updateFieldProduk(${idx}, 'nama_file_pdf', this.value)">
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateFieldProduk(idx, field, value) {
  if (!dataPengaturanFollowUpProduk[idx]) return;
  dataPengaturanFollowUpProduk[idx][field] = value;
}

function tambahBarisProduk() {
  dataPengaturanFollowUpProduk.push({ minat: '', butuh_cek_usia_bayi: false });
  renderPengaturanProduk();
}

function hapusBarisProduk(idx) {
  const item = dataPengaturanFollowUpProduk[idx];
  if (item && item.minat === '__GLOBAL__') { alert('Baris __GLOBAL__ tidak bisa dihapus.'); return; }
  if (!confirm('Hapus baris produk "' + (item.minat || '(tanpa nama)') + '"? Perubahan baru tersimpan permanen setelah klik "Simpan Semua Template".')) return;
  dataPengaturanFollowUpProduk.splice(idx, 1);
  renderPengaturanProduk();
}
