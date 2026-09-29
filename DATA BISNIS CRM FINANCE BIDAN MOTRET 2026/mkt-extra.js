// =========================================================================
// mkt-extra.js — sub-menu Marketing, PDF per bagian, refresh per bagian,
// "Analisis Iklan" (gaya Ads Manager) dan status CAPI per lead.
// Muat SETELAH ui-marketing.js dan SEBELUM api-marketing.js.
// =========================================================================

const MKT_SUBS = ['funnel', 'produk', 'tren', 'adset', 'creative', 'iklan', 'drill', 'sync', 'capi'];
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
    if (id === 'drill') renderDrilldownIklan();
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
            pdf.text(((typeof TENANT_CONFIG !== 'undefined' && TENANT_CONFIG.meta && TENANT_CONFIG.meta.namaBisnis) || 'Marketing') + ' — ' + judul, m, m + 4);
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
    const batasCplMahal_ = (typeof ambilThreshold_ === 'function') ? ambilThreshold_('cplMahalRp', 30000) : 30000;
    const warna = d.cpl === null ? '#6b7280' : (d.cpl > batasCplMahal_ ? '#b91c1c' : '#047857');
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

  mktKolomTerapkan('tblAnalisisIklan');
}

// render ulang tiap kali tab Marketing dirender (setelah data/filters berubah)
(function () {
  const asli = window.renderMarketingTab;
  if (typeof asli !== 'function') return;
  window.renderMarketingTab = function () {
    const hasil = asli.apply(this, arguments);
    try { if ($m('mktSub_iklan') && $m('mktSub_iklan').classList.contains('active')) renderAnalisisIklan(); } catch (e) { console.error(e); }
    try { if ($m('mktSub_drill') && $m('mktSub_drill').classList.contains('active')) renderDrilldownIklan(); } catch (e) { console.error(e); }
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

// =========================================================================
// DRILL-DOWN IKLAN: Minat -> Campaign -> Adset -> Ad (headline + body)
// Dibangun dari dataContent (Ad_Content_Performance), yang sejak update
// MaieAdContentSync.gs sudah membawa campaign_name, adset_name, ad_name,
// headline, dan body_lengkap langsung per baris - jadi tidak perlu join
// tambahan lewat campaign_id/adset_id seperti di renderAnalisisIklan.
//
// "Minat" di level teratas didapat dari normalisasiMinat(campaign_name) -
// aturan yang sama dipakai di seluruh dashboard (lihat tenant-config.js).
// =========================================================================
window.mktDrillExpanded = window.mktDrillExpanded || new Set();

function mktDrillToggle(path) {
  if (window.mktDrillExpanded.has(path)) window.mktDrillExpanded.delete(path);
  else window.mktDrillExpanded.add(path);
  renderDrilldownIklan();
}

function mktDrillBukaTutupSemua(buka) {
  if (buka) {
    // buka semua node yang ada di tree saat ini
    const tree = mktDrillBangunTree_();
    Object.keys(tree).forEach(minat => {
      window.mktDrillExpanded.add('m|' + minat);
      Object.keys(tree[minat].campaigns).forEach(camp => {
        window.mktDrillExpanded.add('c|' + minat + '|' + camp);
        Object.keys(tree[minat].campaigns[camp].adsets).forEach(adset => {
          window.mktDrillExpanded.add('a|' + minat + '|' + camp + '|' + adset);
        });
      });
    });
  } else {
    window.mktDrillExpanded.clear();
  }
  renderDrilldownIklan();
}

function mktDrillBangunTree_() {
  const fStart = $m('fMktStart') ? $m('fMktStart').value : '';
  const fEnd = $m('fMktEnd') ? $m('fMktEnd').value : '';
  const selNamaMeta = typeof getMsFilterSelected === 'function' ? getMsFilterSelected('msFilterMktNamaMeta') : [];

  let rows = dataContent || [];
  rows = rows.filter(r => r.campaign_name && r.ad_name);
  if (fStart) rows = rows.filter(r => formati(r.tanggal) >= fStart);
  if (fEnd) rows = rows.filter(r => formati(r.tanggal) <= fEnd);
  if (selNamaMeta.length > 0) rows = rows.filter(r => selNamaMeta.includes(r.campaign_name));

  const tree = {};
  rows.forEach(r => {
    const minat = (typeof normalisasiMinat === 'function') ? normalisasiMinat(r.campaign_name) : r.campaign_name;
    const camp = r.campaign_name, adset = r.adset_name || '(tanpa nama adset)';
    const spend = Number(r.spend) || 0, results = Number(r.results) || 0, purchases = Number(r.purchases) || 0;

    if (!tree[minat]) tree[minat] = { spend: 0, results: 0, purchases: 0, campaigns: {} };
    tree[minat].spend += spend; tree[minat].results += results; tree[minat].purchases += purchases;

    if (!tree[minat].campaigns[camp]) tree[minat].campaigns[camp] = { spend: 0, results: 0, purchases: 0, adsets: {} };
    const c = tree[minat].campaigns[camp];
    c.spend += spend; c.results += results; c.purchases += purchases;

    if (!c.adsets[adset]) c.adsets[adset] = { spend: 0, results: 0, purchases: 0, ads: {} };
    const a = c.adsets[adset];
    a.spend += spend; a.results += results; a.purchases += purchases;

    const kunciAd = r.ad_id || r.ad_name;
    if (!a.ads[kunciAd]) a.ads[kunciAd] = {
      nama: r.ad_name, headline: r.headline || '', body: r.body_lengkap || '',
      tipe: r.creative_type || '', spend: 0, results: 0, purchases: 0, ctrSum: 0, n: 0
    };
    const d = a.ads[kunciAd];
    d.spend += spend; d.results += results; d.purchases += purchases;
    d.ctrSum += Number(r.ctr_persen) || 0; d.n++;
  });
  return tree;
}

function mktDrillCpl_(spend, results) { return results > 0 ? Math.round(spend / results) : null; }

function mktDrillWarnaCpl_(cpl) {
  if (cpl === null) return '#6b7280';
  const batas = (typeof ambilThreshold_ === 'function') ? ambilThreshold_('cplMahalRp', 30000) : 30000;
  return cpl > batas ? '#b91c1c' : '#047857';
}

// Rata-rata CPL tertimbang-spend dari sekumpulan node bertetangga (siblings),
// dipakai sebagai patokan "efisien/boros" di setiap level - bukan angka
// mutlak, karena wajar CPL berbeda antar minat/produk.
function mktDrillRataCpl_(daftarNode) {
  let totalSpend = 0, totalResults = 0;
  daftarNode.forEach(n => { totalSpend += n.spend; totalResults += n.results; });
  return totalResults > 0 ? (totalSpend / totalResults) : null;
}

// Klasifikasi & rekomendasi berbasis threshold di tenant-config.js:
// - efisienDariRataRataPersen: seberapa jauh CPL harus di BAWAH rata-rata
//   saudara sekelompok supaya dianggap "efisien" (kandidat scale up)
// - cplMahalRp: batas mutlak CPL "mahal"
// - adsetBorosMinSpendRp: spend minimum supaya rekomendasi "matikan" masuk akal
//   (spend kecil dengan CPL jelek belum tentu perlu tindakan - datanya masih tipis)
function mktDrillKlasifikasi_(spend, results, cpl, avgCpl) {
  const cplMahal = (typeof ambilThreshold_ === 'function') ? ambilThreshold_('cplMahalRp', 30000) : 30000;
  const efisienPersen = (typeof ambilThreshold_ === 'function') ? ambilThreshold_('efisienDariRataRataPersen', 30) : 30;
  const borosMinSpend = (typeof ambilThreshold_ === 'function') ? ambilThreshold_('adsetBorosMinSpendRp', 5000) : 5000;

  if (results === 0) {
    if (spend >= borosMinSpend) return { label: '⚠️ Belum Hasil', warna: '#b45309', bg: '#fef3c7', saran: 'Spend sudah cukup besar tanpa hasil sama sekali - pertimbangkan dihentikan atau ganti creative/targeting.' };
    return { label: '⏳ Baru Jalan', warna: '#64748b', bg: '#f1f5f9', saran: 'Spend masih kecil, datanya belum cukup untuk dievaluasi. Pantau lagi.' };
  }

  const batasEfisien = avgCpl ? avgCpl * (1 - efisienPersen / 100) : null;
  const batasBoros = avgCpl ? avgCpl * (1 + efisienPersen / 100) : null;

  if (batasEfisien !== null && cpl <= batasEfisien) {
    return { label: '🟢 Efisien', warna: '#047857', bg: '#dcfce7', saran: 'CPL jauh di bawah rata-rata sekelompoknya - kandidat kuat untuk di-scale up (naikkan budget).' };
  }
  if (cpl > cplMahal || (batasBoros !== null && cpl >= batasBoros)) {
    const saranMatikan = spend >= borosMinSpend
      ? 'CPL mahal dengan spend yang tidak sedikit - pertimbangkan dimatikan atau ganti creative/targeting.'
      : 'CPL di atas rata-rata, tapi spend masih kecil - pantau dulu sebelum ambil tindakan.';
    return { label: '🔴 Boros', warna: '#b91c1c', bg: '#fee2e2', saran: saranMatikan };
  }
  return { label: '🟡 Standar', warna: '#a16207', bg: '#fef9c3', saran: 'CPL sesuai rata-rata sekelompoknya - tidak perlu tindakan khusus.' };
}

function mktDrillBadgeHtml_(k) {
  return `<span title="${mktEsc(k.saran)}" style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800; background:${k.bg}; color:${k.warna}; cursor:help;">${k.label}</span>`;
}

function renderDrilldownIklan() {
  const body = $m('bDrillIklan');
  if (!body) return;

  const tree = mktDrillBangunTree_();
  const daftarMinatKey = Object.keys(tree);

  if (daftarMinatKey.length === 0) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:18px; color:#94a3b8;">Belum ada data untuk filter ini.</td></tr>';
    return;
  }

  const daftarMinat = daftarMinatKey.sort((a, b) => tree[b].spend - tree[a].spend);
  const avgCplSemuaMinat = mktDrillRataCpl_(daftarMinat.map(m => tree[m]));

  let html = '';
  daftarMinat.forEach(minat => {
    const mObj = tree[minat];
    const idM = 'm|' + minat;
    const bukaM = window.mktDrillExpanded.has(idM);
    const cplM = mktDrillCpl_(mObj.spend, mObj.results);
    const kM = mktDrillKlasifikasi_(mObj.spend, mObj.results, cplM, avgCplSemuaMinat);
    html += mktDrillBarisHeader_(idM, 0, bukaM, '📁 ' + mktEsc(minat), Object.keys(mObj.campaigns).length + ' campaign', mObj.spend, mObj.results, mObj.purchases, cplM, '#ede9fe', kM);

    if (!bukaM) return;
    const daftarCamp = Object.keys(mObj.campaigns).sort((a, b) => mObj.campaigns[b].spend - mObj.campaigns[a].spend);
    const avgCplCampSekelompok = mktDrillRataCpl_(daftarCamp.map(c => mObj.campaigns[c]));
    daftarCamp.forEach(camp => {
      const cObj = mObj.campaigns[camp];
      const idC = 'c|' + minat + '|' + camp;
      const bukaC = window.mktDrillExpanded.has(idC);
      const cplC = mktDrillCpl_(cObj.spend, cObj.results);
      const kC = mktDrillKlasifikasi_(cObj.spend, cObj.results, cplC, avgCplCampSekelompok);
      html += mktDrillBarisHeader_(idC, 1, bukaC, '📣 ' + mktEsc(camp), Object.keys(cObj.adsets).length + ' adset', cObj.spend, cObj.results, cObj.purchases, cplC, '#e0e7ff', kC);

      if (!bukaC) return;
      const daftarAdset = Object.keys(cObj.adsets).sort((a, b) => cObj.adsets[b].spend - cObj.adsets[a].spend);
      const avgCplAdsetSekelompok = mktDrillRataCpl_(daftarAdset.map(a => cObj.adsets[a]));
      daftarAdset.forEach(adset => {
        const aObj = cObj.adsets[adset];
        const idA = 'a|' + minat + '|' + camp + '|' + adset;
        const bukaA = window.mktDrillExpanded.has(idA);
        const cplA = mktDrillCpl_(aObj.spend, aObj.results);
        const kA = mktDrillKlasifikasi_(aObj.spend, aObj.results, cplA, avgCplAdsetSekelompok);
        html += mktDrillBarisHeader_(idA, 2, bukaA, '🧩 ' + mktEsc(adset), Object.keys(aObj.ads).length + ' ad', aObj.spend, aObj.results, aObj.purchases, cplA, '#dbeafe', kA);

        if (!bukaA) return;
        const daftarAd = Object.values(aObj.ads).sort((x, y) => y.spend - x.spend);
        const avgCplAdSekelompok = mktDrillRataCpl_(daftarAd);
        daftarAd.forEach(d => {
          const cplD = mktDrillCpl_(d.spend, d.results);
          const kD = mktDrillKlasifikasi_(d.spend, d.results, cplD, avgCplAdSekelompok);
          const ctr = d.n ? (d.ctrSum / d.n).toFixed(2) : '0.00';
          html += `<tr>
            <td style="padding:7px 8px 7px 60px;">🎨 ${mktEsc(d.nama)} <span style="font-size:10.5px; color:#94a3b8;">${mktEsc(d.tipe)}</span>${mktDrillBadgeHtml_(kD)}
              ${d.headline ? `<div style="font-size:11.5px; color:#334155; margin-top:3px;"><b>Headline:</b> ${mktEsc(d.headline)}</div>` : ''}
              ${d.body ? `<div style="font-size:11.5px; color:#64748b; margin-top:2px; max-width:480px; white-space:normal;"><b>Body:</b> ${mktEsc(d.body)}</div>` : ''}
            </td>
            <td class="num">-</td>
            <td class="num">Rp ${rp(d.spend)}</td>
            <td class="num">${d.results}</td>
            <td class="num" style="color:${mktDrillWarnaCpl_(cplD)}; font-weight:700;">${cplD === null ? '-' : 'Rp ' + rp(cplD)}</td>
            <td class="num">${d.purchases} <span style="font-size:10.5px; color:#94a3b8;">(CTR ${ctr}%)</span></td>
          </tr>`;
        });
      });
    });
  });

  body.innerHTML = html;
}

function mktDrillBarisHeader_(id, level, buka, label, sublabel, spend, results, purchases, cpl, bg, klasifikasi) {
  const indent = 10 + level * 24;
  const badge = klasifikasi ? mktDrillBadgeHtml_(klasifikasi) : '';
  return `<tr style="cursor:pointer; background:${bg};" onclick="mktDrillToggle('${id.replace(/'/g, "\\'")}')">
    <td style="padding:8px 8px 8px ${indent}px; font-weight:700;"><span style="display:inline-block; width:14px;">${buka ? '▼' : '▶'}</span>${label} <span style="font-weight:500; font-size:11px; color:#475569;">(${sublabel})</span>${badge}</td>
    <td class="num">-</td>
    <td class="num">Rp ${rp(spend)}</td>
    <td class="num">${results}</td>
    <td class="num" style="color:${mktDrillWarnaCpl_(cpl)}; font-weight:700;">${cpl === null ? '-' : 'Rp ' + rp(cpl)}</td>
    <td class="num">${purchases}</td>
  </tr>`;
}

// =========================================================================
// PILIH KOLOM TABEL (customizable columns) — generik per tableId, disimpan
// di localStorage sehingga preferensi bertahan meski browser ditutup.
// Untuk memakai di tabel lain: tambahkan panel checkbox di HTML (pola sama
// seperti tblAnalisisIklan_kolomPanel), lalu panggil mktKolomTerapkan(tableId)
// di akhir fungsi render tabel tsb (setelah tbody diisi ulang).
// =========================================================================
function mktKolomKeyStorage_(tableId) { return 'kolom_tersembunyi_' + tableId; }

function mktKolomBacaTersembunyi_(tableId) {
  try {
    const raw = localStorage.getItem(mktKolomKeyStorage_(tableId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

function mktKolomSimpanTersembunyi_(tableId, arr) {
  try { localStorage.setItem(mktKolomKeyStorage_(tableId), JSON.stringify(arr)); } catch (e) {}
}

// Terapkan status sembunyi/tampil ke <th>/<td> tabel - dipanggil setiap
// kali tbody-nya dirender ulang, supaya baris baru ikut mengikuti pilihan.
function mktKolomTerapkan(tableId) {
  const table = $m(tableId);
  if (!table) return;
  const hidden = mktKolomBacaTersembunyi_(tableId);
  table.querySelectorAll('tr').forEach(tr => {
    Array.from(tr.children).forEach((cell, idx) => {
      cell.style.display = hidden.includes(idx) ? 'none' : '';
    });
  });
}

function mktKolomToggle(tableId, idx, tampilkan) {
  let hidden = mktKolomBacaTersembunyi_(tableId);
  if (tampilkan) hidden = hidden.filter(i => i !== idx);
  else if (!hidden.includes(idx)) hidden.push(idx);
  mktKolomSimpanTersembunyi_(tableId, hidden);
  mktKolomTerapkan(tableId);
}

function mktKolomTogglePanel(panelId) {
  const el = $m(panelId);
  if (!el) return;
  const buka = el.style.display !== 'none';
  // tutup panel kolom lain yang mungkin sedang terbuka
  document.querySelectorAll('[id$="_kolomPanel"]').forEach(p => { if (p.id !== panelId) p.style.display = 'none'; });
  el.style.display = buka ? 'none' : 'block';
}

// Tutup panel kolom kalau klik di luar panel/tombolnya
document.addEventListener('click', function (e) {
  if (e.target.closest('[id$="_kolomPanel"]') || (e.target.tagName === 'BUTTON' && e.target.textContent.includes('⚙️ Kolom'))) return;
  document.querySelectorAll('[id$="_kolomPanel"]').forEach(p => { p.style.display = 'none'; });
});

// Saat halaman dimuat, sinkronkan checkbox panel dengan preferensi tersimpan
// (kalau sebelumnya user pernah menyembunyikan kolom, checkbox ikut ter-uncheck)
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[id$="_kolomPanel"]').forEach(panel => {
    const tableId = panel.id.replace(/_kolomPanel$/, '');
    const hidden = mktKolomBacaTersembunyi_(tableId);
    panel.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const m = (cb.getAttribute('onchange') || '').match(/mktKolomToggle\('([^']+)',\s*(\d+)/);
      if (m && hidden.includes(Number(m[2]))) cb.checked = false;
    });
  });
});