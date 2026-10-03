// =========================================================================
// ui-fewshot.js — render untuk tab "AI Learning" (Few-Shot Manager + Error Log)
// Pola & gaya penulisan disamakan dengan ui-followup.js yang sudah ada.
// =========================================================================

const LABEL_JENIS_PROMPT_ = {
  ekstrak_usia: "Ekstrak Usia Anak",
  product_interest: "Deteksi Minat Produk",
  chat_analysis: "Analisis Chat (Batch)"
};

function labelJenisPrompt_(j) {
  return LABEL_JENIS_PROMPT_[j] || j || "-";
}

// =========================================================================
// SUB-TAB: LOG ERROR AI
// =========================================================================
function renderErrorLogKpi_(list) {
  const el = document.getElementById('errKpiGrid');
  if (!el) return;
  const total = list.length;
  const belumReview = list.filter(r => !r.sudah_direview).length;
  const sudahJadiContoh = list.filter(r => r.jadi_fewshot).length;
  const jsonInvalid = list.filter(r => r.status_deteksi === 'JSON_INVALID').length;

  el.innerHTML = `
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${total}</div><div class="l">Total Error Tercatat</div></div>
    <div class="fu-kpi-card fu-kpi-5"><div class="n">${belumReview}</div><div class="l">Belum Direview</div></div>
    <div class="fu-kpi-card fu-kpi-4"><div class="n">${sudahJadiContoh}</div><div class="l">Sudah Jadi Contoh</div></div>
    <div class="fu-kpi-card fu-kpi-3"><div class="n">${jsonInvalid}</div><div class="l">Gagal Format JSON</div></div>
  `;
}

function renderErrorLogTable() {
  const filterJenis = document.getElementById('errFilterJenis')?.value || '';
  const filterStatus = document.getElementById('errFilterReview')?.value || '';

  let list = [...(dataAiErrorLog || [])].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

  if (filterJenis) list = list.filter(r => r.jenis_prompt === filterJenis);
  if (filterStatus === 'belum') list = list.filter(r => !r.sudah_direview);
  if (filterStatus === 'sudah') list = list.filter(r => r.sudah_direview);

  renderErrorLogKpi_(dataAiErrorLog || []);

  const tbody = document.getElementById('bErrorLogTable');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">Belum ada error tercatat. Bagus! 🎉</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td style="white-space:nowrap;">${formatTanggalManusia(r.timestamp)}</td>
      <td>${labelJenisPrompt_(r.jenis_prompt)}</td>
      <td style="max-width:220px; white-space:normal;">${r.pesan_asli || '-'}</td>
      <td style="max-width:220px; white-space:normal; font-family:monospace; font-size:11px;">${r.output_ai || '-'}</td>
      <td><span class="fu-badge" style="background:${r.status_deteksi === 'JSON_INVALID' ? '#ef4444' : '#f59e0b'};">${r.status_deteksi || '-'}</span></td>
      <td>${r.jadi_fewshot ? '✅ Sudah' : (r.sudah_direview ? '👁️ Direview' : '—')}</td>
      <td style="white-space:nowrap;">
        ${!r.jadi_fewshot ? `<button type="button" class="btn-co-secondary" style="padding:4px 8px; font-size:11px;" onclick="bukaModalPromosiFewShot(${r.row_index})">➕ Jadikan Contoh</button>` : ''}
        ${!r.sudah_direview && !r.jadi_fewshot ? `<button type="button" class="btn-fu-hapus" style="margin-left:4px;" onclick="tandaiErrorSudahDireview(${r.row_index})">Tandai Sudah Dicek</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function isiDropdownJenisPromptError_() {
  const sel = document.getElementById('errFilterJenis');
  if (!sel) return;
  const nilaiSekarang = sel.value;
  sel.innerHTML = '<option value="">Semua Jenis</option>' +
    Object.keys(LABEL_JENIS_PROMPT_).map(k => `<option value="${k}">${LABEL_JENIS_PROMPT_[k]}</option>`).join('');
  if (nilaiSekarang) sel.value = nilaiSekarang;
}

async function tandaiErrorSudahDireview(rowIndex) {
  const params = new URLSearchParams();
  params.append('action', 'tandaiErrorDireview');
  params.append('rowIndex', rowIndex);
  try {
    const res = await fetch(scriptURL, { method: 'POST', body: params });
    const result = await res.json();
    if (result.result === 'success') {
      await tarikDataFollowUp();
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}

// Modal sederhana pakai prompt() bawaan browser -- simpel, tanpa perlu
// bikin modal HTML terpisah. Kalau nanti mau dipercantik jadi modal asli,
// tinggal ganti isi fungsi ini.
async function bukaModalPromosiFewShot(rowIndexErrorLog) {
  const item = (dataAiErrorLog || []).find(r => r.row_index === rowIndexErrorLog);
  if (!item) return;

  const outputIdeal = prompt(
    'Pesan customer:\n"' + item.pesan_asli + '"\n\n' +
    'Output AI yang salah:\n' + item.output_ai + '\n\n' +
    'Tulis OUTPUT JSON YANG SEHARUSNYA (format JSON valid):',
    item.output_ai || ''
  );
  if (!outputIdeal) return; // user cancel

  // Validasi ringan di sisi browser sebelum kirim ke server
  try {
    JSON.parse(outputIdeal);
  } catch (eJson) {
    alert('⚠️ Teks yang kamu tulis bukan format JSON yang valid. Coba cek lagi tanda kutip/kurungnya.');
    return;
  }

  const params = new URLSearchParams();
  params.append('action', 'promosikanErrorJadiFewShot');
  params.append('rowIndexErrorLog', rowIndexErrorLog);
  params.append('outputIdeal', outputIdeal);

  try {
    const res = await fetch(scriptURL, { method: 'POST', body: params });
    const result = await res.json();
    if (result.result === 'success') {
      alert('✅ Berhasil dijadikan contoh baru! Statusnya masih NONAKTIF -- buka sub-tab "Kelola Contoh" untuk aktifkan setelah kamu cek lagi.');
      await tarikDataFollowUp();
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}

// =========================================================================
// SUB-TAB: KELOLA CONTOH (FEW-SHOT)
// =========================================================================
function renderFewShotKpi_(list) {
  const el = document.getElementById('fsKpiGrid');
  if (!el) return;
  const total = list.length;
  const aktif = list.filter(r => r.aktif).length;
  const perJenis = {};
  list.forEach(r => { perJenis[r.jenis_prompt] = (perJenis[r.jenis_prompt] || 0) + 1; });
  const jenisTerbanyak = Object.keys(perJenis).sort((a, b) => perJenis[b] - perJenis[a])[0];

  el.innerHTML = `
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${total}</div><div class="l">Total Contoh Tersimpan</div></div>
    <div class="fu-kpi-card fu-kpi-4"><div class="n">${aktif}</div><div class="l">Sedang Aktif (Dipakai AI)</div></div>
    <div class="fu-kpi-card fu-kpi-2"><div class="n">${total - aktif}</div><div class="l">Nonaktif</div></div>
    <div class="fu-kpi-card fu-kpi-3"><div class="n" style="font-size:14px;">${labelJenisPrompt_(jenisTerbanyak) || '-'}</div><div class="l">Jenis Prompt Terbanyak</div></div>
  `;
}

function renderFewShotTable() {
  const filterJenis = document.getElementById('fsFilterJenis')?.value || '';

  let list = [...(dataFewShotList || [])];
  if (filterJenis) list = list.filter(r => r.jenis_prompt === filterJenis);

  renderFewShotKpi_(dataFewShotList || []);

  const tbody = document.getElementById('bFewShotTable');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Belum ada contoh untuk jenis ini.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => `
    <tr>
      <td>${labelJenisPrompt_(r.jenis_prompt)}</td>
      <td style="max-width:220px; white-space:normal;">${r.pesan_contoh || '-'}</td>
      <td style="max-width:220px; white-space:normal; font-family:monospace; font-size:11px;">${r.output_ideal || '-'}</td>
      <td style="max-width:160px; white-space:normal;">${r.catatan || '-'}</td>
      <td style="text-align:center;">
        <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
          <input type="checkbox" ${r.aktif ? 'checked' : ''} onchange="toggleFewShotAktif(${r.row_index}, this.checked)">
          ${r.aktif ? '✅ Aktif' : '⏸️ Nonaktif'}
        </label>
      </td>
      <td>
        <button type="button" class="btn-fu-hapus" onclick="hapusFewShot(${r.row_index}, '${(r.pesan_contoh || '').replace(/'/g, "\\'").substring(0, 30)}')">🗑️ Hapus</button>
      </td>
    </tr>
  `).join('');
}

function isiDropdownJenisPromptFewShot_() {
  const sel = document.getElementById('fsFilterJenis');
  if (!sel) return;
  const nilaiSekarang = sel.value;
  sel.innerHTML = '<option value="">Semua Jenis</option>' +
    Object.keys(LABEL_JENIS_PROMPT_).map(k => `<option value="${k}">${LABEL_JENIS_PROMPT_[k]}</option>`).join('');
  if (nilaiSekarang) sel.value = nilaiSekarang;
}

async function toggleFewShotAktif(rowIndex, statusBaru) {
  const params = new URLSearchParams();
  params.append('action', 'toggleFewShotAktif');
  params.append('rowIndex', rowIndex);
  params.append('aktif', statusBaru);
  try {
    const res = await fetch(scriptURL, { method: 'POST', body: params });
    const result = await res.json();
    if (result.result === 'success') {
      const item = dataFewShotList.find(r => r.row_index === rowIndex);
      if (item) item.aktif = statusBaru;
      renderFewShotTable();
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
      await tarikDataFollowUp(); // sinkronkan ulang kalau gagal, biar checkbox nggak nyasar
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}

async function hapusFewShot(rowIndex, namaSingkat) {
  if (!confirm('Hapus contoh "' + namaSingkat + '..." ? Tindakan ini tidak bisa dibatalkan.')) return;
  const params = new URLSearchParams();
  params.append('action', 'hapusFewShot');
  params.append('rowIndex', rowIndex);
  try {
    const res = await fetch(scriptURL, { method: 'POST', body: params });
    const result = await res.json();
    if (result.result === 'success') {
      await tarikDataFollowUp();
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}

// Form tambah contoh manual (tanpa lewat Error Log)
async function tambahFewShotManual() {
  const jenis = document.getElementById('fsInputJenis').value;
  const pesan = document.getElementById('fsInputPesan').value.trim();
  const output = document.getElementById('fsInputOutput').value.trim();
  const catatan = document.getElementById('fsInputCatatan').value.trim();

  if (!pesan || !output) { alert('⚠️ Pesan Contoh dan Output JSON Ideal wajib diisi.'); return; }
  try {
    JSON.parse(output);
  } catch (eJson) {
    alert('⚠️ Output JSON Ideal bukan format JSON yang valid.');
    return;
  }

  const params = new URLSearchParams();
  params.append('action', 'tambahFewShot');
  params.append('dataJson', JSON.stringify({
    jenis_prompt: jenis, pesan_contoh: pesan, output_ideal: output, catatan: catatan, aktif: true
  }));

  try {
    const res = await fetch(scriptURL, { method: 'POST', body: params });
    const result = await res.json();
    if (result.result === 'success') {
      alert('✅ Contoh baru berhasil ditambahkan & langsung aktif.');
      document.getElementById('fsInputPesan').value = '';
      document.getElementById('fsInputOutput').value = '';
      document.getElementById('fsInputCatatan').value = '';
      await tarikDataFollowUp();
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}
