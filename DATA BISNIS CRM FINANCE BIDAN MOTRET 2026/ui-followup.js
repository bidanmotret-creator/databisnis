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

  if (tampilanMonitorSaatIni === 'stage') {
    renderTampilanStage_(gabungan);
    return;
  }

  const tbody = document.getElementById('bFollowUpTable');
  if (!tbody) return;

  if (gabungan.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">Tidak ada data yang cocok dengan filter.</td></tr>';
    return;
  }

  tbody.innerHTML = gabungan.map(g => {
    const info = dataNamaKodeByHp[g.hp_norm] || {};
    const window_ = hitungInfoWindow_(info.data_anak, g.produk);
    return `
    <tr>
      <td>${g.no_hp}</td>
      <td>${g.nama}</td>
      <td>${g.kode_leads}</td>
      <td>${g.produk}</td>
      <td><span class="fu-badge fu-stage-${g.stage}">${labelStageFu(g.stage)}</span></td>
      <td style="max-width:220px; white-space:normal;">${g.catatan || '-'}</td>
      <td style="white-space:nowrap;">${formatTanggalManusia(g.waktu_update)}</td>
      <td style="white-space:nowrap; font-size:11.5px;">${window_.teks}</td>
      <td style="white-space:nowrap;">
        <button type="button" class="btn-co-secondary" style="padding:4px 8px; font-size:11px;" onclick="bukaModalEdit('${g.hp_norm}', '${g.no_hp}', '${g.nama.replace(/'/g,"\\'")}')">✏️</button>
        <button type="button" class="btn-co-primary" style="padding:4px 8px; font-size:11px;" onclick="kirimFollowUpManual('${g.no_hp}', '${g.nama.replace(/'/g,"\\'")}')">🔔</button>
      </td>
    </tr>`;
  }).join('');
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
  butuh_cek_usia_bayi: 'Punya Batas Window Usia? (bisa auto-tolak — hanya Newborn yang seharusnya "Ya")',
  template_qualifying: 'Template Qualifying (Stage 0 → 1) — tanyakan usia/tanggal lahir anak di sini',
  template_setelah_detail: 'Caption Dikirim Bareng PL (untuk produk TANPA batas window)',
  template_aman_lanjutan: 'Template Setelah PL — Dalam Window Aman (khusus produk dengan batas window)',
  template_abuabu: 'Template Zona Abu-abu (khusus produk dengan batas window)',
  template_tolak: 'Template Ditolak / Di Luar Window (khusus produk dengan batas window)',
  template_repeat_customer: 'Template Sapaan Repeat Customer (khusus __GLOBAL__)',
  template_lokasi_luar_kota: 'Template Catatan Lokasi Luar Kota (khusus __GLOBAL__)',
  template_reminder_h4: 'Template Reminder Drip H+4 Jam',
  template_reminder_h20: 'Template Reminder Drip H+20 Jam',
  batas_hari_aman: 'Batas Hari Aman (khusus produk dengan batas window)',
  batas_hari_abuabu: 'Batas Hari Abu-abu (khusus produk dengan batas window)',
  url_pl_pdf: 'URL PDF Price List',
  nama_file_pdf: 'Nama File PDF'
};
// NOTE: 'template_detail_acara' sengaja TIDAK ditampilkan lagi di form ini —
// sejak alur di-unifikasi (semua produk tanya usia anak, bukan tanggal
// acara/tema), field ini sudah tidak dipakai oleh prosesFollowUpOtomatis_.
// Kolomnya boleh tetap ada di sheet (data lama tidak hilang), cuma disembunyikan di sini.
const FIELD_TEXTAREA_ = ['template_qualifying', 'template_setelah_detail', 'template_aman_lanjutan', 'template_abuabu', 'template_tolak', 'template_repeat_customer', 'template_lokasi_luar_kota', 'template_reminder_h4', 'template_reminder_h20'];
const FIELD_GLOBAL_ONLY_ = ['template_repeat_customer', 'template_lokasi_luar_kota'];

// Contoh teks yang tampil abu-abu di kotak kosong (placeholder) -- ini
// CUMA panduan visual, tidak ikut tersimpan sampai user benar-benar ketik
// sesuatu di kotaknya. Aman dibiarkan kosong kalau memang mau kosong.
const CONTOH_PLACEHOLDER_ = {
  template_qualifying: "Contoh: Halo [NAMA]! Boleh info dulu ya kak: 1) HPL/tanggal lahir baby 2) Domisili tinggal di mana?",
  template_setelah_detail: "Contoh: Ini Price List kami kak, boleh dicek dulu 😊",
  template_aman_lanjutan: "Contoh: Kalau fix mau foto, bisa segera booking ya kak, usia pemotretan maksimal [BATAS_AMAN] hari.[LOKASI_NOTE]",
  template_abuabu: "Contoh: Usia baby sudah [USIA_HARI] hari. Boleh info BB lahir & kondisi kesehatan? Tim kami cek dulu ya.",
  template_tolak: "Contoh: Mohon maaf, usia baby [USIA_HARI] hari sudah di luar window. Kami ada paket lain yang cocok, mau kami kirim infonya?",
  template_repeat_customer: "Contoh: Halo kembali [NAMA]! Senang bisa terhubung lagi 🤍 Ada yang bisa kami bantu kali ini?",
  template_lokasi_luar_kota: "Contoh: Kami lihat domisili kakak di luar kota. Boleh share pin lokasi untuk cek estimasi transport?",
  template_reminder_h4: "Contoh: Halo [NAMA] 👋 Masih ditunggu infonya ya kak, biar kami bisa bantu cek jadwal.",
  template_reminder_h20: "Contoh: Halo kak [NAMA], kami masih standby kalau mau lanjut ya 🙏"
};

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
              placeholder="Contoh: Newborn, Maternity, Handcasting, Birthday, Family"
              onchange="updateFieldProduk(${idx}, 'minat', this.value)">
          </div>
          <div>
            <label>${LABEL_KOLOM_FU_.butuh_cek_usia_bayi}</label>
            <select onchange="updateFieldProduk(${idx}, 'butuh_cek_usia_bayi', this.value === 'true')">
              <option value="true" ${item.butuh_cek_usia_bayi ? 'selected' : ''}>Ya — bisa auto-tolak kalau di luar window (Newborn)</option>
              <option value="false" ${!item.butuh_cek_usia_bayi ? 'selected' : ''}>Tidak — usia cuma info, PL selalu dikirim</option>
            </select>
          </div>
          ${FIELD_TEXTAREA_.filter(f => isGlobal || !FIELD_GLOBAL_ONLY_.includes(f)).map(f => `
            <div class="full">
              <label>${LABEL_KOLOM_FU_[f]}${isGlobal ? '' : ' (kosongkan = ikut __GLOBAL__)'}</label>
              <textarea placeholder="${CONTOH_PLACEHOLDER_[f] || ''}" onchange="updateFieldProduk(${idx}, '${f}', this.value)">${(item[f] || '')}</textarea>
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
            <input type="text" value="${item.url_pl_pdf || ''}" placeholder="${isGlobal ? 'https://drive.google.com/uc?export=download&id=...' : '(ikut global)'}"
              onchange="updateFieldProduk(${idx}, 'url_pl_pdf', this.value)">
          </div>
          <div>
            <label>${LABEL_KOLOM_FU_.nama_file_pdf}</label>
            <input type="text" value="${item.nama_file_pdf || ''}" placeholder="${isGlobal ? 'PL Newborn Bidan Motret 2026.pdf' : '(ikut global)'}"
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

// =========================================================================
// TOGGLE TAMPILAN: TABEL vs KELOMPOK PER STAGE
// =========================================================================
let tampilanMonitorSaatIni = 'tabel';

function gantiTampilanMonitor(mode) {
  tampilanMonitorSaatIni = mode;
  document.getElementById('viewTampilTabel').style.display = mode === 'tabel' ? 'block' : 'none';
  document.getElementById('viewTampilStage').style.display = mode === 'stage' ? 'block' : 'none';
  document.getElementById('btnTampilTabel').className = mode === 'tabel' ? 'btn-co-primary' : 'btn-co-secondary';
  document.getElementById('btnTampilStage').className = mode === 'stage' ? 'btn-co-primary' : 'btn-co-secondary';
  renderFollowUpTable();
}

// =========================================================================
// HITUNG INFO WINDOW (berapa hari lagi / sudah lewat berapa hari)
// =========================================================================
function hitungInfoWindow_(dataAnakText, produk) {
  if (!dataAnakText) return { teks: '-', kelas: '' };

  const match = dataAnakText.match(/(Lahir|HPL):\s*(\d{4}-\d{2}-\d{2})/);
  if (!match) return { teks: '-', kelas: '' };

  const statusAnak = match[1] === 'Lahir' ? 'sudah_lahir' : 'belum_lahir';
  const tglAnak = new Date(match[2]);
  const now = new Date();
  const usiaHari = Math.floor((now - tglAnak) / 86400000);

  const cfgProduk = (dataPengaturanFollowUpProduk || []).find(p => p.minat === produk) || {};
  const batasAman = Number(cfgProduk.batas_hari_aman) || 15;
  const batasAbuabu = Number(cfgProduk.batas_hari_abuabu) || 30;
  const butuhCek = cfgProduk.butuh_cek_usia_bayi === true || cfgProduk.butuh_cek_usia_bayi === 'TRUE';

  if (statusAnak === 'belum_lahir') {
    const hariMenujuLahir = Math.abs(usiaHari);
    return { teks: `HPL dalam ${hariMenujuLahir} hari`, kelas: 'ok' };
  }

  if (!butuhCek) {
    return { teks: `Usia ${usiaHari} hari (tanpa batas window)`, kelas: 'ok' };
  }

  if (usiaHari <= batasAman) {
    return { teks: `${usiaHari} hari — masih ${batasAman - usiaHari} hari lagi aman`, kelas: 'aman' };
  } else if (usiaHari <= batasAbuabu) {
    return { teks: `${usiaHari} hari — sudah lewat ${usiaHari - batasAman} hari (zona abu-abu)`, kelas: 'abuabu' };
  } else {
    return { teks: `${usiaHari} hari — sudah lewat ${usiaHari - batasAbuabu} hari (di luar window)`, kelas: 'tolak' };
  }
}

// =========================================================================
// RENDER TAMPILAN KELOMPOK PER STAGE
// =========================================================================
function renderTampilanStage_(gabungan) {
  const wrap = document.getElementById('viewTampilStage');
  if (!wrap) return;

  const urutanStage = [1, 4, 3, 0, 2, 100];
  const kelompok = {};
  urutanStage.forEach(s => kelompok[s] = []);
  gabungan.forEach(g => { if (!kelompok[g.stage]) kelompok[g.stage] = []; kelompok[g.stage].push(g); });

  wrap.innerHTML = urutanStage.map(stageNum => {
    const list = kelompok[stageNum] || [];
    if (list.length === 0) return '';
    return `
      <div class="card" style="margin-bottom:14px;">
        <h4 style="margin:0 0 10px 0; display:flex; justify-content:space-between; align-items:center;">
          <span><span class="fu-badge fu-stage-${stageNum}">${labelStageFu(stageNum)}</span></span>
          <span style="font-size:13px; color:#64748b;">${list.length} nomor</span>
        </h4>
        <div class="table-responsive table-compact-wrap">
          <table>
            <thead><tr style="background:#f1f5f9;"><th>No HP</th><th>Nama</th><th>Produk</th><th>Window</th><th>Waktu Update</th><th>Aksi</th></tr></thead>
            <tbody>
              ${list.map(g => renderBarisNomor_(g)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }).join('');
}

function renderBarisNomor_(g) {
  const info = dataNamaKodeByHp[g.hp_norm] || {};
  const window_ = hitungInfoWindow_(info.data_anak, g.produk);
  return `
    <tr>
      <td>${g.no_hp}</td>
      <td>${g.nama}</td>
      <td>${g.produk}</td>
      <td>${window_.teks}</td>
      <td style="white-space:nowrap;">${formatTanggalManusia(g.waktu_update)}</td>
      <td style="white-space:nowrap;">
        <button type="button" class="btn-co-secondary" style="padding:4px 8px; font-size:11px;" onclick="bukaModalEdit('${g.hp_norm}', '${g.no_hp}', '${g.nama.replace(/'/g,"\\'")}')">✏️ Edit</button>
        <button type="button" class="btn-co-primary" style="padding:4px 8px; font-size:11px;" onclick="kirimFollowUpManual('${g.no_hp}', '${g.nama.replace(/'/g,"\\'")}')">🔔 Follow-up</button>
      </td>
    </tr>
  `;
}