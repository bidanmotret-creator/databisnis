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

  // isi juga dropdown Import Massal
  const setSumber = [...new Set(dataCrm.map(r => r.sumber).filter(v => v && v !== '-'))].sort();
  const selImportSumber = document.getElementById('import_sumber');
  if (selImportSumber) selImportSumber.innerHTML = setSumber.map(v => `<option>${esc(v)}</option>`).join('') || '<option>Import Massal WA</option>';
  const selImportMinat = document.getElementById('import_minat');
  if (selImportMinat) selImportMinat.innerHTML = '<option value="">- Tidak diisi -</option>' + set.map(m => `<option>${esc(m)}</option>`).join('');
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
    const capi = capiByKode[r.kode_leads];
    const capiHtml = capi
      ? `<br><span class="fu-badge ${capi.sudah_kirim_purchase ? 'b-green' : 'b-yellow'}">${capi.sudah_kirim_purchase ? '✅ CAPI: Purchase ' + rpC(r.total) : '📨 CAPI: Lead'}</span> <small style="color:#94a3b8;">${esc(capi.last_synced || '')}</small>`
      : '<br><small style="color:#94a3b8;">CAPI: belum sync</small>';
    const fuHtml = (st ? `<span class="fu-badge st-${st.stage}">${esc(LABEL_STAGE[st.stage] || 'Stage ' + st.stage)}</span>` : '<small style="color:#94a3b8;">Belum ada</small>')
      + (chatStat[h] ? `<br><small>💬 ${chatStat[h].n} pesan · ${esc((chatStat[h].last || '').substring(0, 16))}</small><br><small style="color:#334155; display:inline-block; max-width:220px; white-space:normal;">“${esc(chatStat[h].teks || '')}”</small>` : '')
      + (ai ? `<br><small>Intent: <b>${esc(ai.intent || '-')}</b>${ai.booking ? ' · 🔥 siap booking' : ''}</small><br><small style="color:#64748b; display:inline-block; max-width:220px; white-space:normal;">${esc((ai.summary || '').substring(0, 90))}</small>` : '')
      + capiHtml;
        return `<tr>
      <td><strong>${esc(r.kode_leads || '-')}</strong></td>
      <td><strong>${esc(r.nama || '-')}</strong><br><small style="color:#64748b;">${esc(r.no_hp)}</small></td>
      <td>${esc(r.minat || '-')}<br><small style="color:#64748b;">${esc(r.paket !== '-' ? r.paket : '-')}</small></td>
      <td><small>Chat: ${esc(r.tanggal_chat || '-')}</small><br><small>Sesi: ${esc(r.jadwal || '-')}</small>${hari}</td>
      <td>${rpC(r.total)}<br><span class="fu-badge ${bs}">${esc(r.status)}</span></td>
      <td>${fuHtml}</td>
      <td style="white-space:nowrap; position:relative;">
        <button class="row-btn" style="background:#f59e0b;" title="Edit" onclick="bukaModal('${esc(r.kode_leads)}')">✏️ Edit</button>
        <button class="row-btn" style="background:#0ea5e9;" title="Riwayat chat & analisis" onclick="bukaChat('${esc(r.no_hp)}','${esc((r.nama || '').replace(/'/g, ''))}')">💬 Chat</button>
        <button class="row-btn" style="background:#64748b;" title="Aksi lainnya" onclick="toggleAksiMenu(event,'${esc(r.kode_leads)}')">⋮</button>
        <div class="aksi-menu" id="aksiMenu_${esc(r.kode_leads)}" style="display:none; position:absolute; right:0; top:100%; background:#fff; border:1px solid var(--border); border-radius:8px; box-shadow:0 8px 20px rgba(0,0,0,.18); z-index:50; min-width:210px; padding:6px; text-align:left;">
          <a href="https://wa.me/${h}" target="_blank" style="display:block; padding:7px 10px; font-size:12.5px; color:#166534; text-decoration:none; border-radius:6px;">📲 Buka WhatsApp</a>
          <a href="followup.html?cari=${h}" style="display:block; padding:7px 10px; font-size:12.5px; color:#4338ca; text-decoration:none; border-radius:6px;">🤖 AI Analysis & Follow-up</a>
          <button type="button" onclick="kirimUlangCapi('${esc(r.kode_leads)}')" style="display:block; width:100%; text-align:left; padding:7px 10px; font-size:12.5px; color:#7c3aed; background:none; border:none; cursor:pointer; border-radius:6px;">📡 Kirim Ulang CAPI</button>
          <hr style="margin:4px 0; border:none; border-top:1px solid var(--border);">
          <button type="button" onclick="hapusLead('${esc(r.kode_leads)}')" style="display:block; width:100%; text-align:left; padding:7px 10px; font-size:12.5px; color:#dc2626; background:none; border:none; cursor:pointer; border-radius:6px;">🗑️ Hapus Lead</button>
        </div>
      </td></tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center; padding:24px; color:#94a3b8;">Tidak ada data.</td></tr>';
}

function toggleAksiMenu(ev, kode) {
  ev.stopPropagation();
  document.querySelectorAll('.aksi-menu').forEach(m => { if (m.id !== 'aksiMenu_' + kode) m.style.display = 'none'; });
  const el = document.getElementById('aksiMenu_' + kode);
  if (el) el.style.display = (el.style.display === 'block') ? 'none' : 'block';
}
document.addEventListener('click', () => document.querySelectorAll('.aksi-menu').forEach(m => m.style.display = 'none'));

function bukaModal(kode) {
  const r = dataCrm.find(x => x.kode_leads === kode);
  if (!r) return;
  modalKode = kode;
  const set = (id, v) => document.getElementById(id).value = v == null ? '' : v;
  set('mHp', r.no_hp); set('mTglChat', r.tanggal_chat); set('mMinat', r.minat);
  set('mNama', r.nama); set('mAlamat', r.alamat); set('mDataAnak', r.data_anak); set('mJadwal', r.jadwal);
  set('mPaket', r.paket !== '-' ? r.paket : ''); set('mTotal', r.total); set('mTransport', r.transport);
  set('mTgl1', r.tgl_bayar1); set('mJml1', r.jml_bayar1); set('mTgl2', r.tgl_bayar2); set('mJml2', r.jml_bayar2);
  isiDropdownProvinsi('mProvinsi');
  document.getElementById('mProvinsi').value = r.provinsi || '';
  isiDropdownKabupaten(r.provinsi || '', 'mKabupaten');
  document.getElementById('mKabupaten').value = r.kabupaten_kota || '';
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
  ['master', 'produk', 'kohort', 'evaluasi', 'setupcapi'].forEach(k => {
    document.getElementById('panel_' + k).style.display = (k === t) ? 'block' : 'none';
    document.getElementById('tabBtn_' + k).className = (k === t) ? 'btn-co-primary' : 'btn-co-secondary';
  });
  if (t === 'setupcapi') muatSetupCapi();
  else if (t !== 'master') renderAnalitik();
}



// ================= PRODUK, KEUANGAN, KOHORT (lazy: hanya saat tab dibuka) =================
const dayDiff = (a, b) => Math.floor((new Date(b) - new Date(a)) / 864e5);
const monDiff = (a, b) => { const x = new Date(a), y = new Date(b); return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth()); };
const pc = (p, t) => t ? (p / t * 100).toFixed(1) + '%' : '0%';
const tglAnak = r => { const m = String(r.data_anak || '').match(/\d{4}-\d{2}-\d{2}/); return m ? m[0] : ''; };
function gambar(id, cfg) { if (charts[id]) charts[id].destroy(); if (typeof Chart !== 'undefined') charts[id] = new Chart(document.getElementById(id), cfg); }

function renderAnalitik() {
  if (tabCrm === 'produk') renderProdukKeuangan();
  else if (tabCrm === 'kohort') renderKohort();
  else if (tabCrm === 'evaluasi') renderEvaluasi();
}

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

function renderEvaluasi() {
  const list = listAktif;
  const total = list.length;

  // --- 1. Funnel stage follow-up ---
  const funnelCount = {};
  list.forEach(r => {
    const st = stageByHp[hpNorm(r.no_hp)];
    const key = st ? (LABEL_STAGE[st.stage] || 'Stage ' + st.stage) : 'Belum ada';
    funnelCount[key] = (funnelCount[key] || 0) + 1;
  });
  const funnelLabels = Object.keys(funnelCount);
  const funnelValues = funnelLabels.map(k => funnelCount[k]);
  document.getElementById('bFunnel').innerHTML = funnelLabels.map((k, i) =>
    `<tr><td>${esc(k)}</td><td>${funnelValues[i]}</td><td>${pc(funnelValues[i], total)}</td></tr>`
  ).join('') || '<tr><td colspan="3">Belum ada data.</td></tr>';
  gambar('cvFunnel', {
    type: 'bar',
    data: { labels: funnelLabels, datasets: [{ label: 'Jumlah Lead', data: funnelValues, backgroundColor: '#4f46e5' }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
  });

  // --- 2. Kesehatan CAPI ---
  let capiPurchase = 0, capiLeadOnly = 0, capiBelum = 0, capiPurchaseValue = 0;
  list.forEach(r => {
    const c = capiByKode[r.kode_leads];
    if (!c) capiBelum++;
    else if (c.sudah_kirim_purchase) { capiPurchase++; capiPurchaseValue += Number(r.total) || 0; }
    else capiLeadOnly++;
  });
  const capiLabels = ['✅ Purchase Terkirim', '📨 Lead Saja', '⚠️ Belum Sync'];
  const capiValues = [capiPurchase, capiLeadOnly, capiBelum];
  document.getElementById('bCapi').innerHTML = capiLabels.map((k, i) =>
    `<tr><td>${k}</td><td>${capiValues[i]}</td><td>${pc(capiValues[i], total)}</td></tr>`
  ).join('') + `<tr><td><strong>💰 Total Value Purchase (ke Meta)</strong></td><td colspan="2"><strong>${rpC(capiPurchaseValue)}</strong></td></tr>`;
  gambar('cvCapi', {
    type: 'doughnut',
    data: { labels: capiLabels, datasets: [{ data: capiValues, backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }] },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // --- 3. Performa per Sumber ---
  const sumberMap = {};
  list.forEach(r => {
    const src = r.sumber || 'Tidak diketahui';
    sumberMap[src] = sumberMap[src] || { leads: 0, closing: 0, omzet: 0 };
    sumberMap[src].leads++;
    if (kategoriStatus_(r.status) !== 'pending') sumberMap[src].closing++;
    sumberMap[src].omzet += r.total;
  });
  const sumberArr = Object.entries(sumberMap).sort((a, b) => b[1].leads - a[1].leads);
  document.getElementById('bSumber').innerHTML = sumberArr.map(([src, v]) =>
    `<tr><td>${esc(src)}</td><td>${v.leads}</td><td>${v.closing}</td><td>${pc(v.closing, v.leads)}</td><td>${rpC(v.omzet)}</td></tr>`
  ).join('') || '<tr><td colspan="5">Belum ada data.</td></tr>';
  gambar('cvSumber', {
    type: 'bar',
    data: {
      labels: sumberArr.map(s => s[0]),
      datasets: [
        { label: 'Leads', data: sumberArr.map(s => s[1].leads), backgroundColor: '#0ea5e9' },
        { label: 'Closing', data: sumberArr.map(s => s[1].closing), backgroundColor: '#10b981' }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // --- 4. Distribusi Intent AI ---
  const intentMap = {};
  list.forEach(r => {
    const ai = aiByHp[hpNorm(r.no_hp)];
    if (!ai || !ai.intent) return;
    intentMap[ai.intent] = intentMap[ai.intent] || { n: 0, booking: 0 };
    intentMap[ai.intent].n++;
    if (ai.booking) intentMap[ai.intent].booking++;
  });
  const intentArr = Object.entries(intentMap).sort((a, b) => b[1].n - a[1].n);
  document.getElementById('bIntent').innerHTML = intentArr.map(([k, v]) =>
    `<tr><td>${esc(k)}</td><td>${v.n}</td><td>${v.booking}</td></tr>`
  ).join('') || '<tr><td colspan="3">Belum ada analisis AI.</td></tr>';
  gambar('cvIntent', {
    type: 'bar',
    data: { labels: intentArr.map(i => i[0]), datasets: [{ label: 'Jumlah', data: intentArr.map(i => i[1].n), backgroundColor: '#f59e0b' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  // --- KPI cards ---
  const closingTotal = sumberArr.reduce((a, s) => a + s[1].closing, 0);
  const belumSyncPct = total ? Math.round(capiBelum / total * 100) : 0;
  document.getElementById('evalKpi').innerHTML = `
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${total}</div><div class="l">Total Lead (Terfilter)</div></div>
    <div class="fu-kpi-card fu-kpi-4"><div class="n">${pc(closingTotal, total)}</div><div class="l">Overall Close Rate</div></div>
    <div class="fu-kpi-card fu-kpi-2"><div class="n">${capiPurchase}</div><div class="l">CAPI Purchase Terkirim</div></div>
    <div class="fu-kpi-card fu-kpi-3"><div class="n">${belumSyncPct}%</div><div class="l">Lead Belum Sync CAPI</div></div>`;

      // --- 5. Tren mingguan (Leads vs Closing) ---
  const isoWeek = dstr => {
    const d = new Date(dstr);
    if (isNaN(d)) return null;
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const weekNr = 1 + Math.round(((target - firstThursday) / 864e5 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return target.getFullYear() + '-W' + String(weekNr).padStart(2, '0');
  };
  const trenMap = {};
  list.forEach(r => {
    if (!r.tanggal_chat) return;
    const wk = isoWeek(r.tanggal_chat);
    if (!wk) return;
    trenMap[wk] = trenMap[wk] || { leads: 0, closing: 0, omzet: 0 };
    trenMap[wk].leads++;
    if (kategoriStatus_(r.status) !== 'pending') { trenMap[wk].closing++; trenMap[wk].omzet += r.total; }
  });
  const trenKeys = Object.keys(trenMap).sort();
  document.getElementById('bTren').innerHTML = trenKeys.map(k => {
    const v = trenMap[k];
    return `<tr><td>${k}</td><td>${v.leads}</td><td>${v.closing}</td><td>${pc(v.closing, v.leads)}</td><td>${rpC(v.omzet)}</td></tr>`;
  }).join('') || '<tr><td colspan="5">Belum ada data.</td></tr>';
  gambar('cvTren', {
    type: 'line',
    data: {
      labels: trenKeys,
      datasets: [
        { label: 'Leads Masuk', data: trenKeys.map(k => trenMap[k].leads), borderColor: '#0ea5e9', backgroundColor: 'rgba(14,165,233,.1)', fill: true, tension: .2 },
        { label: 'Closing', data: trenKeys.map(k => trenMap[k].closing), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', fill: true, tension: .2 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // --- 6. Performa per Paket / Varian ---
  const paketMap = {};
  list.forEach(r => {
    const key = (r.minat || 'Lainnya') + '|' + (r.paket && r.paket !== '-' ? r.paket : 'Tanpa Paket') + '|' + (r.varian && r.varian !== '-' ? r.varian : '-');
    paketMap[key] = paketMap[key] || { minat: r.minat || 'Lainnya', paket: r.paket !== '-' ? r.paket : 'Tanpa Paket', varian: r.varian !== '-' ? r.varian : '-', trx: 0, closing: 0, omzet: 0 };
    paketMap[key].trx++;
    if (kategoriStatus_(r.status) !== 'pending') { paketMap[key].closing++; paketMap[key].omzet += r.total; }
  });
  const paketArr = Object.values(paketMap).sort((a, b) => b.omzet - a.omzet);
  document.getElementById('bPaketEval').innerHTML = paketArr.map(p =>
    `<tr><td>${esc(p.minat)}</td><td>${esc(p.paket)}</td><td>${esc(p.varian)}</td><td>${p.trx}</td><td>${p.closing}</td><td>${pc(p.closing, p.trx)}</td><td>${rpC(p.omzet)}</td><td style="color:#64748b;">${rpC(p.omzet / (p.closing || 1))}</td></tr>`
  ).join('') || '<tr><td colspan="8">Belum ada data.</td></tr>';
  gambar('cvPaket', {
    type: 'bar',
    data: {
      labels: paketArr.slice(0, 10).map(p => p.minat + ' - ' + p.paket),
      datasets: [{ label: 'Omzet', data: paketArr.slice(0, 10).map(p => p.omzet), backgroundColor: '#7c3aed' }]
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
  });

  // --- Insight otomatis ---
  const ins = [];
  const stageBelum = funnelCount['Belum ada'] || 0;
  if (total && stageBelum > total * 0.3) ins.push(`📌 <b>${pc(stageBelum, total)} lead belum masuk sistem follow-up otomatis.</b> Cek apakah follow-up otomatis aktif (menu Pengaturan) atau nomor-nomor ini memang belum pernah chat.`);
  if (total && capiBelum > total * 0.2) ins.push(`📌 <b>${belumSyncPct}% lead belum tersinkron ke CAPI Meta.</b> Pertimbangkan jalankan sync ulang massal supaya data closing masuk ke optimasi iklan.`);
  if (sumberArr.length) {
    const terbaik = sumberArr.reduce((a, b) => (b[1].closing / (b[1].leads || 1)) > (a[1].closing / (a[1].leads || 1)) ? b : a);
    if (terbaik[1].leads >= 3) ins.push(`📌 <b>Sumber "${esc(terbaik[0])}" punya close rate tertinggi</b> (${pc(terbaik[1].closing, terbaik[1].leads)}). Pertimbangkan alokasikan effort/budget lebih ke sumber ini.`);
  }
  const stageReview = funnelCount['Perlu Review CS'] || 0;
  if (stageReview > 0) ins.push(`📌 <b>${stageReview} lead menunggu review CS manual</b> (kasus usia baby di zona abu-abu). Segera cek tab AI Chat & Follow-up.`);
  
    if (paketArr.length) {
    const paketTerbaik = paketArr.reduce((a, b) => (b.closing / (b.trx || 1)) > (a.closing / (a.trx || 1)) ? b : a);
    if (paketTerbaik.trx >= 3) ins.push(`📌 <b>${esc(paketTerbaik.minat)} - ${esc(paketTerbaik.paket)}</b> punya close rate terbaik (${pc(paketTerbaik.closing, paketTerbaik.trx)}) dari ${paketTerbaik.trx} transaksi.`);
  }
  if (trenKeys.length >= 2) {
    const minggIni = trenMap[trenKeys[trenKeys.length - 1]], minggLalu = trenMap[trenKeys[trenKeys.length - 2]];
    if (minggLalu.leads > 0) {
      const perubahan = Math.round((minggIni.leads - minggLalu.leads) / minggLalu.leads * 100);
      if (Math.abs(perubahan) >= 20) ins.push(`📌 <b>Leads minggu ini ${perubahan > 0 ? 'naik' : 'turun'} ${Math.abs(perubahan)}%</b> dibanding minggu sebelumnya (${minggLalu.leads} → ${minggIni.leads}).`);
    }
  }
  document.getElementById('evalInsightList').innerHTML = ins.map(i => `<li>${i}</li>`).join('') || '<li>Belum ada insight signifikan untuk data yang sedang difilter.</li>';
}

// ================= WILAYAH: PROVINSI / KABUPATEN =================
let dataWilayahOptions = { provinsi: [], kabupatenByProvinsi: {} };

function isiDropdownProvinsi(selectId) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const nilaiSaatIni = el.value;
  el.innerHTML = '<option value="">- Pilih Provinsi -</option>' +
    dataWilayahOptions.provinsi.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if (nilaiSaatIni) el.value = nilaiSaatIni;
}

function isiDropdownKabupaten(provinsi, kabupatenSelectId) {
  const el = document.getElementById(kabupatenSelectId);
  if (!el) return;
  const list = dataWilayahOptions.kabupatenByProvinsi[provinsi] || [];
  el.innerHTML = '<option value="">- Pilih Kabupaten/Kota -</option>' +
    list.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
}

// ================= IMPORT MASSAL DARI SCRAPE CHAT WA =================
function bukaImportMassal() {
  document.getElementById('rawImportMassal').value = '';
  document.getElementById('hasilCekImportMassal').style.display = 'none';
  dataSiapImportMassal = [];
  document.getElementById('modalImport').style.display = 'flex';
}
function tutupImportMassal() { document.getElementById('modalImport').style.display = 'none'; }

function parseTeksImportMassal(teks) {
  const baris = teks.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const hasil = [];
  baris.forEach(line => {
    const match = line.match(/(\+?62|0)?[\s\-]?8[\d\s\-]{7,13}\d/);
    if (!match) return;
    const hpMentah = match[0];
    const nama = line.replace(hpMentah, '').replace(/^[\s,;:\-–]+|[\s,;:\-–]+$/g, '').trim();
    hasil.push({ nama: nama || '(Tanpa Nama)', no_hp_mentah: hpMentah.replace(/\s/g, '') });
  });
  return hasil;
}

let dataSiapImportMassal = [];

function cekDuplikatImportMassal() {
  const teks = document.getElementById('rawImportMassal').value;
  if (!teks.trim()) { alert('Tempel dulu data mentahnya di textarea.'); return; }

  const parsed = parseTeksImportMassal(teks);
  if (parsed.length === 0) { alert('Tidak ada nomor HP yang terdeteksi. Cek lagi formatnya.'); return; }

  const setNoHpAda = new Set(dataCrm.map(r => hpNorm(r.no_hp)).filter(Boolean));
  const setSudahDiproses = new Set();
  let cntBaru = 0, cntAda = 0, cntDup = 0, rows = '';
  dataSiapImportMassal = [];

  parsed.forEach(item => {
    const h = hpNorm(item.no_hp_mentah);
    let status = '', warna = '';
    if (setNoHpAda.has(h) && !setSudahDiproses.has(h)) {
      status = '⚠️ Sudah Ada di Database'; warna = 'color:#ef4444; font-weight:700;'; cntAda++;
    } else if (setSudahDiproses.has(h)) {
      status = '🔁 Duplikat dalam List Ini'; warna = 'color:#f59e0b; font-weight:700;'; cntDup++;
    } else {
      status = '🆕 Baru, Akan Diimport'; warna = 'color:#10b981; font-weight:700;'; cntBaru++;
      dataSiapImportMassal.push({ nama: item.nama, no_hp: h });
    }
    setSudahDiproses.add(h);
    rows += `<tr><td>${esc(item.nama)}</td><td>${esc(h)}</td><td style="${warna}">${status}</td></tr>`;
  });

  document.getElementById('tabelPreviewImport').innerHTML = rows;
  document.getElementById('cntBaru').textContent = cntBaru;
  document.getElementById('cntAda').textContent = cntAda;
  document.getElementById('cntDupBatch').textContent = cntDup;
  document.getElementById('hasilCekImportMassal').style.display = 'block';
}

async function importLeadsBaruSaja() {
  if (dataSiapImportMassal.length === 0) {
    alert('Tidak ada kontak berstatus "Baru". Klik "Cek Duplikat Dulu" terlebih dahulu.');
    return;
  }
  const sumberTerpilih = document.getElementById('import_sumber').value || 'Import Massal WA';
  const minatTerpilih = document.getElementById('import_minat').value || '';
  const tglHariIni = new Date().toISOString().split('T')[0];

  const payload = dataSiapImportMassal.map(item => ({
    nama: item.nama, no_hp: item.no_hp, sumber: sumberTerpilih, minat: minatTerpilih, tanggal_chat: tglHariIni
  }));

  if (!confirm(`Import ${payload.length} kontak baru ke Database Leads sekarang?`)) return;

  try {
    const p = new URLSearchParams();
    p.append('action', 'bulkInsertLeads');
    p.append('dataJson', JSON.stringify(payload));
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    alert(`✅ Import selesai!\nBerhasil ditambahkan: ${r.inserted}\nDilewati (sudah ada / duplikat): ${r.skipped}`);
    tutupImportMassal();
    await tarikDataCrm();
  } catch (err) {
    alert('❌ Gagal import: ' + err.message);
  }
}

function printEvaluasi() {
  document.body.classList.add('printing-evaluasi');
  window.print();
  setTimeout(() => document.body.classList.remove('printing-evaluasi'), 500);
}
// =========================================================================
// SETUP CAPI — Multi Akun / Multi Pixel (tab "⚙️ Setup CAPI")
// =========================================================================
let akunCapiRows = []; // array of {sumber, account_id, pixel_id, role, group_id, aktif}

async function muatSetupCapi() {
  const tbody = document.getElementById('bAkunCapi');
  tbody.innerHTML = '<tr><td colspan="7" style="color:#94a3b8;">Memuat...</td></tr>';
  try {
    const data = await fetchJsonAman(scriptURL + '?action=getMetaCapiConfig');

    document.getElementById('scAccessToken').value = '';
    document.getElementById('scAccessToken').placeholder = data.settings.ACCESS_TOKEN_TERISI
      ? ('Sudah tersimpan (' + data.settings.ACCESS_TOKEN + ') — kosongkan kalau tidak mau ganti')
      : 'Belum diisi — tempel System User Access Token di sini';
    document.getElementById('scTokenHint').textContent = data.settings.ACCESS_TOKEN_TERISI
      ? 'Token tersembunyi demi keamanan. Isi ulang field ini hanya kalau mau mengganti token.'
      : '⚠️ Access Token belum diisi — sync CAPI tidak akan jalan.';
    document.getElementById('scApiVersion').value = data.settings.API_VERSION || 'v21.0';
    document.getElementById('scTestEventCode').value = data.settings.TEST_EVENT_CODE || '';
    document.getElementById('scDefaultPixel').value = data.settings.DEFAULT_PIXEL_ID || '';
    document.getElementById('scHanyaMetaAds').checked = !!data.settings.HANYA_SUMBER_META_ADS;

    akunCapiRows = data.akunList || [];
    window._sumberLeadsOptions = data.sumberLeadsOptions || [];
    renderTabelAkunCapi();

    document.getElementById('scMinatList').value = (data.daftarMinat || []).join('\n');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#ef4444;">❌ Gagal memuat: ${esc(err.message)}</td></tr>`;
  }
}

function renderTabelAkunCapi() {
  const tbody = document.getElementById('bAkunCapi');
  if (akunCapiRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="color:#94a3b8;">Belum ada akun. Klik "➕ Tambah Akun".</td></tr>';
    return;
  }
  const opsiSumber = (window._sumberLeadsOptions || []);
  tbody.innerHTML = akunCapiRows.map((a, i) => {
    const datalistId = 'dlSumberCapi';
    return `<tr>
      <td><input list="${datalistId}" value="${esc(a.sumber)}" style="min-width:170px;" onchange="akunCapiRows[${i}].sumber=this.value"></td>
      <td><input value="${esc(a.account_id)}" placeholder="tanpa act_" style="min-width:130px;" onchange="akunCapiRows[${i}].account_id=this.value.replace(/^act_/,'')"></td>
      <td><input value="${esc(a.pixel_id)}" placeholder="kosongkan = ikut UTAMA" style="min-width:140px;" onchange="akunCapiRows[${i}].pixel_id=this.value"></td>
      <td>
        <select onchange="akunCapiRows[${i}].role=this.value">
          <option value="UTAMA" ${a.role === 'UTAMA' ? 'selected' : ''}>UTAMA</option>
          <option value="LAIN" ${a.role !== 'UTAMA' ? 'selected' : ''}>LAIN</option>
        </select>
      </td>
      <td><input value="${esc(a.group_id)}" placeholder="nama klien/grup" style="min-width:120px;" onchange="akunCapiRows[${i}].group_id=this.value"></td>
      <td style="text-align:center;"><input type="checkbox" ${a.aktif ? 'checked' : ''} onchange="akunCapiRows[${i}].aktif=this.checked"></td>
      <td><button type="button" class="btn-co-secondary" onclick="hapusBarisAkunCapi(${i})">🗑️</button></td>
    </tr>`;
  }).join('') + `<datalist id="dlSumberCapi">${opsiSumber.map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
}

function tambahBarisAkunCapi() {
  akunCapiRows.push({ sumber: '', account_id: '', pixel_id: '', role: 'LAIN', group_id: '', aktif: true });
  renderTabelAkunCapi();
}

function hapusBarisAkunCapi(idx) {
  akunCapiRows.splice(idx, 1);
  renderTabelAkunCapi();
}

async function simpanSetupSettingsCapi() {
  try {
    const p = new URLSearchParams();
    p.append('action', 'saveMetaCapiSettings');
    p.append('accessToken', document.getElementById('scAccessToken').value.trim());
    p.append('apiVersion', document.getElementById('scApiVersion').value.trim() || 'v21.0');
    p.append('testEventCode', document.getElementById('scTestEventCode').value.trim());
    p.append('defaultPixelId', document.getElementById('scDefaultPixel').value.trim());
    p.append('hanyaSumberMetaAds', document.getElementById('scHanyaMetaAds').checked ? 'true' : 'false');
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') { alert('✅ Pengaturan tersimpan.'); await muatSetupCapi(); }
    else alert('❌ Gagal: ' + (r.message || 'unknown'));
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  }
}

async function simpanAkunCapi() {
  // validasi ringan di sisi UI sebelum kirim
  const kosong = akunCapiRows.some(a => !a.sumber.trim() || !a.account_id.trim());
  if (kosong && !confirm('Ada baris dengan Sumber/Account ID kosong — tetap lanjut simpan (baris kosong akan diabaikan server)?')) return;

  try {
    const p = new URLSearchParams();
    p.append('action', 'saveMetaConfigAkun');
    p.append('dataJson', JSON.stringify(akunCapiRows));
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') { alert('✅ Daftar akun tersimpan.'); await muatSetupCapi(); }
    else alert('❌ Gagal: ' + (r.message || 'unknown'));
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  }
}

async function simpanMinatCapi() {
  const daftar = document.getElementById('scMinatList').value.split('\n').map(s => s.trim()).filter(Boolean);
  try {
    const p = new URLSearchParams();
    p.append('action', 'saveMetaMinat');
    p.append('dataJson', JSON.stringify(daftar));
    const r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
    if (r.result === 'success') { alert('✅ Daftar minat tersimpan.'); await muatSetupCapi(); }
    else alert('❌ Gagal: ' + (r.message || 'unknown'));
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err.message);
  }
}