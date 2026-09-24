// ui-crm.js — render untuk crm.html (ringan, tanpa Chart.js)
const rpC = n => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const tsC = d => d ? new Date(d).setHours(0, 0, 0, 0) : 0;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let modalKode = '';

// SAMA PERSIS dengan normalizeTelepon_ di Code.gs — dipakai untuk join ke stage/AI
function hpNorm(phone) {
  if (!phone) return '';
  let d = String(phone).replace(/\D/g, '');
  if (d.indexOf('0') === 0) d = '62' + d.slice(1);
  if (d.indexOf('62') !== 0) d = '62' + d;
  return d;
}
const LABEL_STAGE = { 0: 'Belum Qualifying', 1: 'Menunggu Jawaban', 2: 'PL Terkirim', 3: 'Perlu Review CS', 100: 'Repeat Customer' };

function isiDropdownMinat_() {
  const sel = document.getElementById('fMinat'), cur = sel.value;
  const set = [...new Set(dataCrm.map(r => r.minat).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Semua</option>' + set.map(m => `<option>${esc(m)}</option>`).join('');
  sel.value = cur;
}

function kategoriStatus_(s) {
  s = String(s || '').toLowerCase();
  return s.includes('lunas') ? 'lunas' : s.includes('dp') ? 'dp' : 'pending';
}

function renderCrm() {
  const cari = document.getElementById('fCari').value.toLowerCase();
  const fMinat = document.getElementById('fMinat').value;
  const fStatus = document.getElementById('fStatus').value;
  const fStage = document.getElementById('fStage').value;
  const fSort = document.getElementById('fSort').value;

  let list = dataCrm.filter(r => {
    if (cari && !((r.nama || '').toLowerCase().includes(cari) || String(r.no_hp).includes(cari) || (r.kode_leads || '').toLowerCase().includes(cari))) return false;
    if (fMinat && r.minat !== fMinat) return false;
    if (fStatus && kategoriStatus_(r.status) !== fStatus) return false;
    if (fStage !== '') { const st = stageByHp[hpNorm(r.no_hp)]; if (!st || String(st.stage) !== fStage) return false; }
    return true;
  });

  const sorters = {
    chat_desc: (a, b) => tsC(b.tanggal_chat) - tsC(a.tanggal_chat),
    chat_asc: (a, b) => tsC(a.tanggal_chat) - tsC(b.tanggal_chat),
    total_desc: (a, b) => b.total - a.total,
    hutang_desc: (a, b) => b.sisa_hutang - a.sisa_hutang,
    jadwal_asc: (a, b) => (tsC(a.jadwal) || Infinity) - (tsC(b.jadwal) || Infinity)
  };
  list = [...list].sort(sorters[fSort] || sorters.chat_desc);

  // KPI
  const uniq = new Set(list.map(r => hpNorm(r.no_hp)));
  const omzet = list.reduce((a, r) => a + r.total, 0);
  const masuk = list.reduce((a, r) => a + r.jml_bayar1 + r.jml_bayar2, 0);
  const piutang = list.reduce((a, r) => a + r.sisa_hutang, 0);
  document.getElementById('crmKpi').innerHTML = `
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${uniq.size}</div><div class="l">Klien Unik</div></div>
    <div class="fu-kpi-card fu-kpi-2"><div class="n">${rpC(omzet)}</div><div class="l">Total Penjualan</div></div>
    <div class="fu-kpi-card fu-kpi-4"><div class="n">${rpC(masuk)}</div><div class="l">Cash Masuk (DP+Lunas)</div></div>
    <div class="fu-kpi-card fu-kpi-3"><div class="n">${rpC(piutang)}</div><div class="l">Sisa Piutang</div></div>`;
  document.getElementById('crmCount').textContent = `Menampilkan ${Math.min(list.length, 300)} dari ${list.length} baris`;

  const now = Date.now();
  document.getElementById('crmBody').innerHTML = list.slice(0, 300).map(r => {
    const cat = kategoriStatus_(r.status);
    const bs = cat === 'lunas' ? 'b-green' : cat === 'dp' ? 'b-yellow' : 'b-red';
    let hari = '';
    if (r.jadwal) {
      const s = Math.ceil((new Date(r.jadwal) - now) / 864e5);
      hari = s < 0 ? `<br><small style="color:#ef4444;">Lewat ${-s} hr</small>` : `<br><small style="color:#0ea5e9;">${s} hr lagi</small>`;
    }
    const h = hpNorm(r.no_hp), st = stageByHp[h], ai = aiByHp[h];
    const fuHtml = (st ? `<span class="fu-badge st-${st.stage}">${esc(LABEL_STAGE[st.stage] || 'Stage ' + st.stage)}</span>` : '<small style="color:#94a3b8;">Belum ada</small>')
      + (chatStat[h] ? `<br><small>💬 ${chatStat[h].n} pesan · ${esc((chatStat[h].last || '').substring(0, 16))}</small><br><small style="color:#334155; display:inline-block; max-width:220px; white-space:normal;">“${esc(chatStat[h].teks || '')}”</small>` : '')
      + (ai ? `<br><small>Intent: <b>${esc(ai.intent || '-')}</b>${ai.booking ? ' · 🔥 siap booking' : ''}</small><br><small style="color:#64748b; display:inline-block; max-width:220px; white-space:normal;">${esc((ai.summary || '').substring(0, 90))}</small>` : '');
    return `<tr>
      <td><strong>${esc(r.kode_leads || '-')}</strong></td>
      <td><strong>${esc(r.nama || '-')}</strong><br><small style="color:#64748b;">${esc(r.no_hp)}</small></td>
      <td>${esc(r.minat || '-')}<br><small style="color:#64748b;">${esc(r.paket !== '-' ? r.paket : '-')}</small></td>
      <td><small>Chat: ${esc(r.tanggal_chat || '-')}</small><br><small>Sesi: ${esc(r.jadwal || '-')}</small>${hari}</td>
      <td>${rpC(r.total)}<br><span class="fu-badge ${bs}">${esc(r.status)}</span></td>
      <td>${fuHtml}</td>
      <td style="white-space:nowrap;">
        <button class="row-btn" style="background:#f59e0b;" title="Edit" onclick="bukaModal('${esc(r.kode_leads)}')">✏️</button>
        <button class="row-btn" style="background:#0ea5e9;" title="Riwayat chat & analisis" onclick="bukaChat('${esc(r.no_hp)}','${esc((r.nama || '').replace(/'/g, ''))}')">💬</button>
        <a class="row-btn" style="background:#25d366;" title="Buka WhatsApp" target="_blank" href="https://wa.me/${h}">📲</a>
        <a class="row-btn" style="background:#4f46e5;" title="Lihat AI Analysis & Follow-up" href="followup.html?cari=${h}">🤖</a>
      </td></tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center; padding:24px; color:#94a3b8;">Tidak ada data.</td></tr>';
}

function bukaModal(kode) {
  const r = dataCrm.find(x => x.kode_leads === kode);
  if (!r) return;
  modalKode = kode;
  const set = (id, v) => document.getElementById(id).value = v == null ? '' : v;
  set('mHp', r.no_hp); set('mTglChat', r.tanggal_chat); set('mMinat', r.minat);
  set('mNama', r.nama); set('mAlamat', r.alamat); set('mDataAnak', r.data_anak); set('mJadwal', r.jadwal);
  set('mPaket', r.paket !== '-' ? r.paket : ''); set('mTotal', r.total); set('mTransport', r.transport);
  set('mTgl1', r.tgl_bayar1); set('mJml1', r.jml_bayar1); set('mTgl2', r.tgl_bayar2); set('mJml2', r.jml_bayar2);
  const sel = document.getElementById('mStatus');
  if (![...sel.options].some(o => o.value === r.status)) sel.add(new Option(r.status, r.status));
  sel.value = r.status;
  document.getElementById('mJudul').textContent = 'Edit: ' + (r.nama || r.no_hp);
  hitungSisa();
  document.getElementById('modalCrm').style.display = 'flex';
}
function tutupModal() { document.getElementById('modalCrm').style.display = 'none'; }
function hitungSisa() {
  const n = id => Number(document.getElementById(id).value) || 0;
  document.getElementById('mSisa').textContent = 'Sisa hutang: ' + rpC(n('mTotal') - n('mJml1') - n('mJml2'));
}

function tutupChat() { document.getElementById('modalChat').style.display = 'none'; }

function renderChat(d, el) {
  let html = '';
  // Info iklan (CTWA)
  if (d.ctwa && d.ctwa.length) {
    const c = d.ctwa[d.ctwa.length - 1];
    html += `<div class="ai-card" style="background:#fffbeb;"><b>📣 Dari Iklan Meta (CTWA)</b><br>${esc(c.headline || '-')}
      <br><small style="color:#64748b;">${esc(c.body || '')} · masuk ${esc(c.waktu)}</small></div>`;
  }
  // Analisis AI terbaru + riwayat
  if (d.analisis && d.analisis.length) {
    const a = d.analisis[d.analisis.length - 1];
    html += `<div class="ai-card" style="background:#eef2ff;"><b>🧠 Analisis AI Terbaru</b> <small style="color:#64748b;">(${esc(a.waktu)})</small><br>
      Produk: <b>${esc(a.produk || '-')}</b> · Timeline: ${esc(a.timeline || '-')} · Lokasi: ${esc(a.lokasi || '-')}<br>
      Budget: ${esc(a.budget || '-')} · Intent: <b>${esc(a.intent || '-')}</b> ${a.booking ? '· 🔥 Siap booking' : ''} · Confidence: ${Math.round(a.confidence * 100)}%<br>
      <span style="color:#334155;">${esc(a.summary || '')}</span>
      ${d.analisis.length > 1 ? `<br><small style="color:#94a3b8;">${d.analisis.length} analisis tercatat total.</small>` : ''}</div>`;
  } else {
    html += '<div class="ai-card" style="color:#94a3b8;">Belum ada analisis AI untuk nomor ini.</div>';
  }
  // Follow-up terakhir
  if (d.followup && d.followup.length) {
    const f = d.followup[d.followup.length - 1];
    html += `<div class="ai-card"><b>⚡ Follow-up:</b> ${esc(LABEL_STAGE[f.stage] || 'Stage ' + f.stage)} · ${esc(f.catatan)} <small style="color:#94a3b8;">(${esc(f.waktu)})</small></div>`;
  }
  // Percakapan
  html += '<div style="font-weight:800; font-size:13px; margin:12px 0 8px;">Percakapan (' + (d.timeline || []).length + ' pesan)</div>';
  html += '<div style="display:flex; flex-direction:column;">' + ((d.timeline || []).map(m => {
    const out = m.arah === 'keluar';
    const label = out ? ('🤖 ' + esc(m.tipe || 'otomatis') + (m.ok === false ? ' · ❌ gagal' : '')) : '';
    return `<div class="bub ${out ? 'bub-out' : 'bub-in'}">${esc(m.teks)}<small>${label} ${esc((m.waktu || '').substring(0, 16))}</small></div>`;
  }).join('') || '<p style="color:#94a3b8;">Belum ada pesan tercatat.</p>') + '</div>';
  el.innerHTML = html;
}
