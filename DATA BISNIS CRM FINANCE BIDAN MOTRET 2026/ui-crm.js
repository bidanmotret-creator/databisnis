// ui-crm.js — render untuk crm.html (ringan, tanpa Chart.js)
const rpC = n => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const tsC = d => d ? new Date(d).setHours(0, 0, 0, 0) : 0;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let modalKode = '', listAktif = [], tabCrm = 'master', charts = {};

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
  [['fSumber', 'sumber'], ['fLokasi', 'lokasi']].forEach(([id, f]) => {
    const s = document.getElementById(id), cur = s.value;
    s.innerHTML = '<option value="">Semua</option>' + [...new Set(dataCrm.map(r => r[f]).filter(v => v && v !== '-'))].sort().map(v => `<option>${esc(v)}</option>`).join('');
    s.value = cur;
  });
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

  // --- filter tambahan: tanggal chat/DP/lunas, sumber, lokasi ---
  const g = id => document.getElementById(id).value;
  const rng = (val, s, e) => { if (!s && !e) return true; if (!val) return false; const t = tsC(val); return (!s || t >= tsC(s)) && (!e || t <= tsC(e)); };
  list = list.filter(r => rng(r.tanggal_chat, g('fChatS'), g('fChatE')) && rng(r.tgl_bayar1, g('fDpS'), g('fDpE')) && rng(r.tgl_bayar2, g('fLnS'), g('fLnE'))
    && (!g('fSumber') || r.sumber === g('fSumber')) && (!g('fLokasi') || r.lokasi === g('fLokasi')));
  listAktif = list;
  if (tabCrm !== 'master') renderAnalitik();

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

// ================= FILTER TANGGAL PRESET / RESET =================
const isoC = d => d.toISOString().substring(0, 10);
function presetChat(k) {
  const now = new Date(); let s;
  if (k === 'bulan') s = new Date(now.getFullYear(), now.getMonth(), 1); else { s = new Date(); s.setDate(s.getDate() - Number(k)); }
  document.getElementById('fChatS').value = isoC(new Date(s.getTime() - s.getTimezoneOffset() * 6e4));
  document.getElementById('fChatE').value = isoC(new Date(now.getTime() - now.getTimezoneOffset() * 6e4));
  renderCrm();
}
function resetFilterCrm() {
  ['fCari', 'fMinat', 'fStatus', 'fStage', 'fChatS', 'fChatE', 'fDpS', 'fDpE', 'fLnS', 'fLnE', 'fSumber', 'fLokasi'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('fSort').value = 'chat_desc';
  renderCrm();
}
function gantiTabCrm(t) {
  tabCrm = t;
  ['master', 'produk', 'kohort'].forEach(k => {
    document.getElementById('panel_' + k).style.display = (k === t) ? 'block' : 'none';
    document.getElementById('tabBtn_' + k).className = (k === t) ? 'btn-co-primary' : 'btn-co-secondary';
  });
  if (t !== 'master') renderAnalitik();
}

// ================= PRODUK, KEUANGAN, KOHORT (lazy: hanya saat tab dibuka) =================
const dayDiff = (a, b) => Math.floor((new Date(b) - new Date(a)) / 864e5);
const monDiff = (a, b) => { const x = new Date(a), y = new Date(b); return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth()); };
const pc = (p, t) => t ? (p / t * 100).toFixed(1) + '%' : '0%';
const tglAnak = r => { const m = String(r.data_anak || '').match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; };
function gambar(id, cfg) { if (charts[id]) charts[id].destroy(); if (typeof Chart !== 'undefined') charts[id] = new Chart(document.getElementById(id), cfg); }

function renderAnalitik() { tabCrm === 'produk' ? renderProdukKeuangan() : renderKohort(); }

function renderProdukKeuangan() {
  const prod = {}, day = {};
  listAktif.forEach(r => {
    const pk = (r.minat || 'Lainnya') + '|' + (r.paket && r.paket !== '-' ? r.paket : 'Tanpa Paket');
    prod[pk] = prod[pk] || { m: r.minat || 'Lainnya', p: pk.split('|')[1], t: 0, o: 0 };
    prod[pk].t++; prod[pk].o += r.total;
    if (r.tgl_bayar1) { const d = r.tgl_bayar1; day[d] = day[d] || { t: 0, o: 0, dp: 0, ln: 0 }; day[d].t++; day[d].o += r.total; day[d].dp += r.jml_bayar1; }
    if (r.tgl_bayar2) { const d = r.tgl_bayar2; day[d] = day[d] || { t: 0, o: 0, dp: 0, ln: 0 }; day[d].ln += r.jml_bayar2; }
  });
  const pa = Object.values(prod).sort((a, b) => b.o - a.o);
  const st = pa.reduce((a, p) => a + p.t, 0), so = pa.reduce((a, p) => a + p.o, 0);
  document.getElementById('bProduk').innerHTML = pa.map(p => `<tr><td>${esc(p.m)}</td><td><b>${esc(p.p)}</b></td><td>${p.t}</td><td>${rpC(p.o)}</td><td style="color:#64748b;">${rpC(p.o / p.t)}</td></tr>`).join('')
    + (st ? `<tr class="total-row"><td colspan="2">TOTAL</td><td>${st}</td><td>${rpC(so)}</td><td>-</td></tr>` : '<tr><td colspan="5">Data kosong.</td></tr>');
  const ds = Object.keys(day).sort();
  let T = { t: 0, o: 0, dp: 0, ln: 0 };
  document.getElementById('bKeu').innerHTML = [...ds].reverse().map(d => { const v = day[d]; T.t += v.t; T.o += v.o; T.dp += v.dp; T.ln += v.ln;
    return `<tr><td>${d}</td><td>${v.t}</td><td>${rpC(v.o)}</td><td>${rpC(v.dp)}</td><td>${rpC(v.ln)}</td><td><b style="color:#10b981;">${rpC(v.dp + v.ln)}</b></td></tr>`; }).join('')
    + (T.t ? `<tr class="total-row"><td>TOTAL</td><td>${T.t}</td><td>${rpC(T.o)}</td><td>${rpC(T.dp)}</td><td>${rpC(T.ln)}</td><td>${rpC(T.dp + T.ln)}</td></tr>` : '<tr><td colspan="6">Data kosong.</td></tr>');
  gambar('cvFin', { type: 'line', data: { labels: ds, datasets: [{ label: 'Cash Masuk', data: ds.map(d => day[d].dp + day[d].ln), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', fill: true, tension: .2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
}

// Bangun 1 tabel kohort: grup per bulan -> hitung tiap kategori (classify mengembalikan indeks kategori / -1 = dilewati)
function kohort(grp, classify, n, bodyId, cvId, labels, colors, stacked) {
  const bulan = Object.keys(grp).sort(), sum = Array(n).fill(0), per = Array(n).fill(0).map(() => []);
  let tot = 0, html = '';
  bulan.forEach(m => {
    const c = Array(n).fill(0); let t = 0;
    grp[m].forEach(r => { const i = classify(r); if (i >= 0) { c[i]++; t++; } });
    c.forEach((v, i) => { per[i].push(v); sum[i] += v; }); tot += t;
    const mx = Math.max(...c);
    if (t) html += `<tr><td>${m}</td><td>${t}</td>` + c.map(v => `<td${v === mx && v > 0 ? ' class="highlight-cell"' : ''}>${v}</td><td>${pc(v, t)}</td>`).join('') + '</tr>';
  });
  if (tot) html += `<tr class="total-row"><td>TOTAL</td><td>${tot}</td>` + sum.map(v => `<td>${v}</td><td>${pc(v, tot)}</td>`).join('') + '</tr>';
  document.getElementById(bodyId).innerHTML = html || `<tr><td colspan="${2 + n * 2}">Belum ada data.</td></tr>`;
  gambar(cvId, { type: 'bar', data: { labels: bulan, datasets: labels.map((l, i) => ({ label: l, data: per[i], backgroundColor: colors[i] })) }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked }, y: { stacked } } } });
  return sum;
}

function renderKohort() {
  const gS = {}, gD = {};
  listAktif.forEach(r => {
    if (r.jadwal && r.jadwal.length > 5) (gS[r.jadwal.substring(0, 7)] = gS[r.jadwal.substring(0, 7)] || []).push(r);
    if (r.tgl_bayar1 && r.tgl_bayar1.length > 5) (gD[r.tgl_bayar1.substring(0, 7)] = gD[r.tgl_bayar1.substring(0, 7)] || []).push(r);
  });
  const b = kohort(gS, r => { const a = tglAnak(r); if (!r.tgl_bayar1 || !a) return -1; const d = dayDiff(r.tgl_bayar1, a); return d > 30 ? 0 : d >= 0 ? 1 : 2; }, 3, 'bBooking', 'cvB', ['Ideal', 'Standard', 'Bahaya'], ['#10b981', '#3b82f6', '#ef4444'], true);
  const c = kohort(gS, r => { if (!r.tanggal_chat || !r.tgl_bayar1) return -1; const d = dayDiff(r.tanggal_chat, r.tgl_bayar1); return d <= 3 ? 0 : d <= 30 ? 1 : 2; }, 3, 'bClosing', 'cvC', ['Gercep', 'Normal', 'Lama'], ['#10b981', '#f59e0b', '#64748b'], false);
  const l = kohort(gD, r => { if (!r.tanggal_chat || !r.tgl_bayar1) return -1; const m = monDiff(r.tanggal_chat, r.tgl_bayar1); return m <= 0 ? 0 : m > 3 ? 3 : m; }, 4, 'bLeads', 'cvL', ['DP Bulan Sama', 'Chat 1 Bln Sblm', 'Chat 2 Bln Sblm', 'Chat 3+ Bln Sblm'], ['#4f46e5', '#ec4899', '#64748b', '#94a3b8'], true);
  const ins = [];
  ins.push((b[1] + b[2]) > b[0] ? '📌 <b>Pola Pasar Dadakan:</b> banyak klien booking mendekati hari H atau setelah lahir. Gunakan copywriting mendesak seperti "Slot Terbatas Minggu Ini".' : '📌 <b>Pola Pasar Terencana:</b> klien merencanakan jauh-jauh hari. Promo Early Bird akan efektif.');
  ins.push(c[0] > c[1] ? '📌 <b>Fast Respon Penting:</b> klien cenderung closing di 0-3 hari pertama chat. Beri insentif untuk CS yang closing di hari yang sama.' : '📌 <b>Butuh Nurturing:</b> klien butuh 4-30 hari untuk memutuskan. Manfaatkan follow-up otomatis untuk menyelamatkan prospek.');
  if (l[0] > (l[1] + l[2] + l[3])) ins.push('📌 <b>Fokus Akuisisi Baru:</b> penjualan bertumpu pada leads bulan berjalan (M0). Pantau CPL/CAC agar ROI iklan tetap sehat.');
  document.getElementById('insightList').innerHTML = ins.map(i => `<li>${i}</li>`).join('');
}
