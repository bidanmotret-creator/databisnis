// =========================================================================
// mkt-extra.js — sub-menu Marketing, PDF per bagian, refresh per bagian,
// "Analisis Iklan" (gaya Ads Manager) dan status CAPI per lead.
// Muat SETELAH ui-marketing.js dan SEBELUM api-marketing.js.
// =========================================================================

const MKT_SUBS = ['funnel', 'produk', 'tren', 'adset', 'creative', 'iklan', 'sync', 'capi'];
const $m = id => document.getElementById(id);

// ------------------------------------------------------------ SUB-MENU
function mktBukaSub(id, push) {
  if (MKT_SUBS.indexOf(id) === -1) id = 'funnel';
  document.querySelectorAll('.mkt-sub').forEach(el => el.classList.toggle('active', el.id === 'mktSub_' + id));
  document.querySelectorAll('.mkt-chip').forEach(b => b.classList.toggle('active', b.dataset.sub === id));
  if (push !== false) { try { history.replaceState(null, '', '#' + id); } catch (e) {} }
  setTimeout(() => {
    try { if (window.Chart && Chart.instances) Object.values(Chart.instances).forEach(c => c.resize()); } catch (e) {}
    if (id === 'iklan') renderAnalisisIklan();
    if (id === 'capi') renderCapiPerLead();
  }, 30);
  const chip = document.querySelector('.mkt-chip.active');
  if (chip && chip.scrollIntoView) chip.scrollIntoView({ inline: 'center', block: 'nearest' });
}

document.addEventListener('DOMContentLoaded', () => {
  mktBukaSub((location.hash || '').replace('#', '') || 'funnel', false);
});

// ------------------------------------------------------------ REFRESH PER BAGIAN
function mktUpdateStamp() {
  const t = window.mktTerakhirMuat;
  const txt = t ? 'Data dimuat ' + t.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';
  document.querySelectorAll('.mkt-stamp').forEach(e => { e.textContent = txt; });
}

async function mktRefreshSub(id, btn) {
  const asli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Memuat...'; }
  try {
    if (id === 'capi') { await tarikDataServer(); await muatAuditCapiAudience(); }
    else if (id === 'sync') { renderRiwayatSyncMeta(); await tarikDataServer(); }
    else await tarikDataServer();
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = asli; }
    mktUpdateStamp();
  }
}

// ------------------------------------------------------------ PDF PER BAGIAN
async function mktPdf(panelId, judul, btn) {
  const el = $m(panelId);
  if (!el) return;
  if (!window.html2canvas || !window.jspdf) { alert('Library PDF belum termuat. Cek koneksi internet lalu coba lagi.'); return; }
  const asli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Membuat PDF...'; }
  el.classList.add('mkt-pdf-mode');
  try {
    if (window.Chart && Chart.instances) Object.values(Chart.instances).forEach(c => c.resize());
    await new Promise(r => setTimeout(r, 250));
    const canvas = await html2canvas(el, { scale: 1.6, backgroundColor: '#ffffff', useCORS: true, logging: false, windowWidth: Math.max(el.scrollWidth, 1000) });

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const m = 10, headerH = 14, footerH = 8;
    const lebar = pw - m * 2;
    const skala = lebar / canvas.width;                    // mm per pixel
    const tinggiIsi = ph - m - headerH - footerH;          // area isi per halaman (mm)
    const pxPerHalaman = Math.floor(tinggiIsi / skala);
    const tgl = new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

    let y = 0, hal = 0;
    while (y < canvas.height) {
      const potong = Math.min(pxPerHalaman, canvas.height - y);
      const part = document.createElement('canvas');
      part.width = canvas.width; part.height = potong;
      part.getContext('2d').drawImage(canvas, 0, y, canvas.width, potong, 0, 0, canvas.width, potong);
      if (hal > 0) pdf.addPage();
      pdf.setFontSize(11); pdf.setTextColor(30, 27, 75);
      pdf.text('BIDAN MOTRET — ' + judul, m, m + 4);
      pdf.setFontSize(8); pdf.setTextColor(100, 116, 139);
      pdf.text('Dibuat ' + tgl, m, m + 9);
      pdf.addImage(part.toDataURL('image/jpeg', 0.85), 'JPEG', m, m + headerH, lebar, potong * skala);
      y += potong; hal++;
    }
    for (let i = 1; i <= hal; i++) {
      pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139);
      pdf.text('Halaman ' + i + ' / ' + hal, pw - m, ph - 5, { align: 'right' });
    }
    pdf.save('Marketing_' + judul.replace(/[^a-z0-9]+/gi, '_') + '_' + new Date().toISOString().slice(0, 10) + '.pdf');
  } catch (err) {
    console.error(err);
    alert('❌ Gagal membuat PDF: ' + (err && err.message ? err.message : err));
  } finally {
    el.classList.remove('mkt-pdf-mode');
    if (btn) { btn.disabled = false; btn.innerText = asli; }
  }
}
// kompatibilitas dengan tombol lama
function downloadPDF() { mktPdf('mktSub_' + (location.hash.replace('#', '') || 'funnel'), 'Laporan Marketing'); }

// ------------------------------------------------------------ BUKA/TUTUP SEMUA KELOMPOK
function mktToggleSemuaGrup(prefix, buka) {
  document.querySelectorAll('tr.grp-head[data-pref="' + prefix + '"]').forEach(h => mktSetGrup(h.dataset.grp, buka));
}

// ------------------------------------------------------------ ANALISIS IKLAN (gaya Ads Manager)
let chartAnalisisIklan = null;
const IK_FMT_K = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'jt' : (v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : String(Math.round(v)));

function ikAmbilBaris_() {
  const mode = $m('ikBreak') ? $m('ikBreak').value : 'ad';
  const peta = buatPetaCampaignName(dataAdsetPerformance || [], dataAdsetCityTargeting || []);
  const fStart = $m('fMktStart') ? $m('fMktStart').value : '';
  const fEnd = $m('fMktEnd') ? $m('fMktEnd').value : '';
  const sel = typeof getMsFilterSelected === 'function' ? getMsFilterSelected('msFilterMktNamaMeta') : [];

  const src = mode === 'ad' ? (dataContent || []) : (dataAdsetPerformance || []);
  let rows = src.map(r => ({
    campaign: peta[String(r.campaign_id || '').trim()] || ('Campaign #' + r.campaign_id),
    adset: r.adset_name || '(tanpa nama adset)',
    ad: r.ad_name || '(tanpa nama iklan)',
    spend: Number(r.spend) || 0, results: Number(r.results) || 0, purchases: Number(r.purchases) || 0,
    ctr: Number(mode === 'ad' ? r.ctr_persen : r.ctr) || 0, tanggal: formati(r.tanggal)
  }));
  if (sel.length) rows = rows.filter(r => sel.some(s => { const a = s.toLowerCase(), b = String(r.campaign).toLowerCase(); return a.includes(b) || b.includes(a); }));
  if (fStart) rows = rows.filter(r => r.tanggal >= fStart);
  if (fEnd) rows = rows.filter(r => r.tanggal <= fEnd);

  const agg = {};
  rows.forEach(r => {
    const nama = mode === 'ad' ? r.ad : (mode === 'adset' ? r.adset : r.campaign);
    const o = agg[nama] || (agg[nama] = { nama, spend: 0, results: 0, purchases: 0, ctrSum: 0, n: 0, hari: {} });
    o.spend += r.spend; o.results += r.results; o.purchases += r.purchases; o.ctrSum += r.ctr; o.n++; if (r.tanggal) o.hari[r.tanggal] = 1;
  });
  return Object.values(agg).map(o => ({
    nama: o.nama, spend: o.spend, results: o.results, purchases: o.purchases,
    cpl: o.results > 0 ? Math.round(o.spend / o.results) : null,
    ctr: o.n ? o.ctrSum / o.n : 0, hari: Object.keys(o.hari).length
  }));
}

function renderAnalisisIklan() {
  const canvas = $m('chartAnalisisIklan');
  const body = $m('bAnalisisIklan');
  if (!canvas || !body) return;

  let data = ikAmbilBaris_();
  if ($m('ikAdaResults') && $m('ikAdaResults').checked) data = data.filter(d => d.results > 0);
  const sortKey = $m('ikSort').value, dir = $m('ikDir').value === 'asc' ? 1 : -1;
  data.sort((a, b) => {
    const va = a[sortKey], vb = b[sortKey];
    if (va === null && vb === null) return 0;
    if (va === null) return 1;       // CPL kosong selalu di bawah
    if (vb === null) return -1;
    return (va - vb) * dir;
  });
  const total = data.length;
  const n = Number($m('ikN').value) || 10;
  const tampil = data.slice(0, n);
  const totalSpend = data.reduce((a, d) => a + d.spend, 0);
  const totalRes = data.reduce((a, d) => a + d.results, 0);

  $m('ikRingkas').innerHTML = total === 0 ? '' :
    `<span>Menampilkan ${tampil.length} dari ${total}</span><span>Total spend: Rp ${rp(totalSpend)}</span><span>Total results: ${totalRes}</span><span>CPL rata-rata: ${totalRes ? 'Rp ' + rp(totalSpend / totalRes) : '-'}</span>`;

  if (chartAnalisisIklan) { chartAnalisisIklan.destroy(); chartAnalisisIklan = null; }
  if (total === 0) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:18px; color:#94a3b8;">Belum ada data untuk filter ini.</td></tr>';
    return;
  }

  const wrap = (t) => {
    const kata = String(t).split(/\s+/); const baris = []; let cur = '';
    kata.forEach(k => { if ((cur + ' ' + k).trim().length > 20) { baris.push(cur); cur = k; } else cur = (cur + ' ' + k).trim(); });
    if (cur) baris.push(cur);
    return baris.slice(0, 3).map((b, i, arr) => (i === arr.length - 1 && baris.length > 3) ? b + '…' : b);
  };
  const chartData = tampil.slice(0, 15);
  const labelPlugin = {
    id: 'ikLabel',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx; ctx.save(); ctx.font = 'bold 10px sans-serif'; ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center';
      chart.data.datasets.forEach((ds, i) => {
        chart.getDatasetMeta(i).data.forEach((bar, j) => {
          const v = ds.data[j];
          ctx.fillText(ds.yAxisID === 'y2' ? 'Rp ' + IK_FMT_K(v) : String(v), bar.x, bar.y - 4);
        });
      });
      ctx.restore();
    }
  };
  chartAnalisisIklan = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: chartData.map(d => wrap(d.nama)),
      datasets: [
        { label: 'Messaging conversations (Results)', data: chartData.map(d => d.results), backgroundColor: '#8fd8ff', borderColor: '#38bdf8', borderWidth: 1, yAxisID: 'y' },
        { label: 'Amount spent', data: chartData.map(d => d.spend), backgroundColor: '#5b3fc4', borderColor: '#3b2a8f', borderWidth: 1, yAxisID: 'y2' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 18 } },
      plugins: {
        legend: { position: 'top', align: 'start' },
        tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y2' ? ' Amount spent: Rp ' + rp(c.parsed.y) : ' Results: ' + c.parsed.y } }
      },
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: false } },
        y: { beginAtZero: true, position: 'left', title: { display: true, text: 'Results' }, ticks: { precision: 0 } },
        y2: { beginAtZero: true, position: 'right', title: { display: true, text: 'Amount spent' }, grid: { drawOnChartArea: false }, ticks: { callback: v => 'Rp ' + IK_FMT_K(v) } }
      }
    },
    plugins: [labelPlugin]
  });

  const maxSpend = Math.max(...tampil.map(d => d.spend), 1);
  body.innerHTML = tampil.map((d, i) => {
    const warna = d.cpl === null ? '#6b7280' : (d.cpl > 30000 ? '#b91c1c' : '#047857');
    return `<tr>
      <td>${i + 1}</td>
      <td style="max-width:320px; white-space:normal;">${mktEsc(d.nama)}</td>
      <td class="num"><b>${d.results === 0 ? '<span style="color:#b91c1c">0</span>' : d.results}</b></td>
      <td class="num"><span class="ik-bar" style="width:${Math.max(4, Math.round(d.spend / maxSpend * 60))}px"></span>Rp ${rp(d.spend)}</td>
      <td class="num" style="color:${warna}; font-weight:700;">${d.cpl === null ? '-' : 'Rp ' + rp(d.cpl)}</td>
      <td class="num">${d.purchases}</td>
      <td class="num">${d.ctr.toFixed(2)}%</td>
      <td class="num">${totalSpend ? (d.spend / totalSpend * 100).toFixed(1) + '%' : '-'}</td>
    </tr>`;
  }).join('');
}

// render ulang tiap kali tab Marketing dirender (setelah data/filters berubah)
(function () {
  const asli = window.renderMarketingTab;
  if (typeof asli !== 'function') return;
  window.renderMarketingTab = function () {
    const hasil = asli.apply(this, arguments);
    try { if ($m('mktSub_iklan') && $m('mktSub_iklan').classList.contains('active')) renderAnalisisIklan(); } catch (e) { console.error(e); }
    try { if ($m('mktSub_capi') && $m('mktSub_capi').classList.contains('active')) renderCapiPerLead(); } catch (e) { console.error(e); }
    mktUpdateStamp();
    return hasil;
  };
})();

// ------------------------------------------------------------ STATUS CAPI PER LEAD
window.dataCapiLog = { loaded: false, audiences: [], logs: [] };

function renderCapiPerLead() {
  const body = $m('capiLeadBody');
  if (!body) return;
  const L = window.dataCapiLog;
  if (!L.loaded) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:16px; color:#4b5563;">Klik <b>Muat Log Audit</b> dulu untuk melihat status CAPI tiap lead.</td></tr>';
    $m('capiLeadRingkas').innerHTML = '';
    return;
  }
  const petaLog = {};
  L.logs.forEach(l => { petaLog[String(l.kode_leads || '').trim()] = l; });

  const q = ($m('capiCari').value || '').toLowerCase().trim();
  const filter = $m('capiFilter').value;
  const semua = (dataGlobal || []).filter(c => c.kode_leads).map(c => {
    const log = petaLog[c.kode_leads] || null;
    const bayar = (Number(c.jml_bayar1) || 0) + (Number(c.jml_bayar2) || 0);
    return { c, log, bayar, tersinkron: !!log, purchaseTerkirim: !!(log && log.sudah_kirim_purchase), sudahBayar: bayar > 0 };
  });

  const jml = {
    total: semua.length,
    sinkron: semua.filter(x => x.tersinkron).length,
    belum: semua.filter(x => !x.tersinkron).length,
    perluPurchase: semua.filter(x => x.sudahBayar && !x.purchaseTerkirim).length,
    purchaseOk: semua.filter(x => x.purchaseTerkirim).length
  };
  $m('capiLeadRingkas').innerHTML =
    `<div class="fin-kpi-card fin-kpi-aktiva"><div class="fin-kpi-label">Total Lead</div><div class="fin-kpi-val">${jml.total}</div></div>` +
    `<div class="fin-kpi-card fin-kpi-revenue"><div class="fin-kpi-label">Sudah Tersinkron</div><div class="fin-kpi-val">${jml.sinkron}</div></div>` +
    `<div class="fin-kpi-card fin-kpi-bad"><div class="fin-kpi-label">Belum Tersinkron</div><div class="fin-kpi-val">${jml.belum}</div></div>` +
    `<div class="fin-kpi-card fin-kpi-warn"><div class="fin-kpi-label">Sudah Bayar, Purchase Belum Terkirim</div><div class="fin-kpi-val">${jml.perluPurchase}</div></div>` +
    `<div class="fin-kpi-card fin-kpi-leads"><div class="fin-kpi-label">Purchase Terkirim</div><div class="fin-kpi-val">${jml.purchaseOk}</div></div>`;

  let rows = semua;
  if (filter === 'sinkron') rows = rows.filter(x => x.tersinkron);
  if (filter === 'belum') rows = rows.filter(x => !x.tersinkron);
  if (filter === 'perlu') rows = rows.filter(x => x.sudahBayar && !x.purchaseTerkirim);
  if (filter === 'purchase') rows = rows.filter(x => x.purchaseTerkirim);
  if (q) rows = rows.filter(x => (x.c.nama + ' ' + x.c.no_hp + ' ' + x.c.kode_leads + ' ' + x.c.minat).toLowerCase().includes(q));
  rows.sort((a, b) => String(b.c.tanggal_chat).localeCompare(String(a.c.tanggal_chat)));

  const BATAS = 150;
  const badge = (cls, t) => `<span class="capi-badge ${cls}">${t}</span>`;
  body.innerHTML = rows.slice(0, BATAS).map(x => {
    const { c, log } = x;
    const evLead = x.tersinkron ? badge('capi-ok', '✔ Lead') : badge('capi-bad', '✖ Lead');
    const evPur = x.purchaseTerkirim ? badge('capi-ok', '✔ Purchase')
      : (x.sudahBayar ? badge('capi-warn', '⚠ Purchase belum') : badge('capi-na', '— Purchase'));
    return `<tr>
      <td><b>${mktEsc(c.nama || '-')}</b><div style="font-size:11px; color:#4b5563;">${mktEsc(c.no_hp)}</div><div style="font-family:monospace; font-size:10.5px; color:#6b7280;">${mktEsc(c.kode_leads)}</div></td>
      <td>${mktEsc(c.minat || '-')}<div style="font-size:11px; color:#4b5563;">${mktEsc(c.status || '')}</div></td>
      <td>${formatd(c.tanggal_chat)}</td>
      <td>${evLead} ${evPur}</td>
      <td>${log ? mktEsc(log.kategori || '-') : '<span style="color:#991b1b; font-weight:700;">Belum masuk audience</span>'}</td>
      <td style="font-family:monospace; font-size:10.5px;">${log ? mktEsc(log.audience_id || '-') : '-'}</td>
      <td style="font-size:11px;">${log ? mktEsc(log.last_synced || '-') : '-'}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" style="text-align:center; padding:16px; color:#4b5563;">Tidak ada lead yang cocok dengan filter.</td></tr>';
  $m('capiLeadCount').textContent = `Menampilkan ${Math.min(rows.length, BATAS)} dari ${rows.length} lead` + (rows.length > BATAS ? ' (persempit dengan pencarian/filter)' : '');
}
