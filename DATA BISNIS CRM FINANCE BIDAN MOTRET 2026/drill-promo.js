// =========================================================================
// drill-promo.js — Drill-down: Minat → PROMO → Campaign → Adset → Ad
// Muat SETELAH mkt-extra.js dan promo-analisis.js. Fungsi dengan nama sama
// di mkt-extra.js digantikan (deklarasi yang dimuat belakangan menang).
// Paket promo per iklan memakai aturan yang sama dengan Papan Tes Promo.
// =========================================================================

let DRILL_SIAP = false, DRILL_MEMUAT = false, DRILL_COBA = 0;

function drillSiapkan_() {
  if (DRILL_SIAP) return true;
  if (!DRILL_MEMUAT) {
    DRILL_MEMUAT = true; DRILL_COBA++;
    Promise.all([ptMuatKamus(false), kbMuatData(false)].map(p => Promise.resolve(p).catch(() => {}))).then(() => {
      DRILL_MEMUAT = false;
      if (KB.master === null && DRILL_COBA < 3) { setTimeout(() => drillSiapkan_() || 0, 1500); return; }
      DRILL_SIAP = true;
      renderDrilldownIklan();
    });
  }
  return false;
}

function mktDrillBangunTree_() {
  const fStart = $m('fMktStart') ? $m('fMktStart').value : '';
  const fEnd = $m('fMktEnd') ? $m('fMktEnd').value : '';
  const selNamaMeta = typeof getMsFilterSelected === 'function' ? getMsFilterSelected('msFilterMktNamaMeta') : [];

  let rows = (dataContent || []).filter(r => r.campaign_name && r.ad_name);
  if (fStart) rows = rows.filter(r => formati(r.tanggal) >= fStart);
  if (fEnd) rows = rows.filter(r => formati(r.tanggal) <= fEnd);
  if (selNamaMeta.length > 0) rows = rows.filter(r => kbCocokCampaign_(r.campaign_name, selNamaMeta));

  const paketAd = {};
  const tree = {};
  const tambah = (o, spend, results, purchases) => { o.spend += spend; o.results += results; o.purchases += purchases; };

  rows.forEach(r => {
    const minat = paMinat_(r.campaign_name), camp = r.campaign_name, adset = r.adset_name || '(tanpa nama adset)';
    const spend = Number(r.spend) || 0, results = Number(r.results) || 0, purchases = Number(r.purchases) || 0;
    const kunciAd = r.ad_id || r.ad_name;

    let p = paketAd[kunciAd];
    if (!p) {
      const m = (KB.master && KB.master[String(r.ad_id || '').trim()]) || {};
      p = paketAd[kunciAd] = paPaketDariTeks_(r.ad_name, m.headline || r.headline || '', m.caption || r.body_lengkap || '', PT.rules);
    }

    const M = tree[minat] || (tree[minat] = { spend: 0, results: 0, purchases: 0, pakets: {} });
    tambah(M, spend, results, purchases);
    const P = M.pakets[p.kunci] || (M.pakets[p.kunci] = { spend: 0, results: 0, purchases: 0, pendukung: {}, ads: {}, campaigns: {} });
    tambah(P, spend, results, purchases);
    p.pendukung.forEach(x => { P.pendukung[x] = true; });
    P.ads[kunciAd] = true;
    const C = P.campaigns[camp] || (P.campaigns[camp] = { spend: 0, results: 0, purchases: 0, adsets: {} });
    tambah(C, spend, results, purchases);
    const A = C.adsets[adset] || (C.adsets[adset] = { spend: 0, results: 0, purchases: 0, ads: {} });
    tambah(A, spend, results, purchases);
    const d = A.ads[kunciAd] || (A.ads[kunciAd] = { nama: r.ad_name, headline: r.headline || '', body: r.body_lengkap || '', tipe: r.creative_type || '', spend: 0, results: 0, purchases: 0, ctrSum: 0, n: 0 });
    tambah(d, spend, results, purchases);
    d.ctrSum += Number(r.ctr_persen) || 0; d.n++;
  });
  return tree;
}

function mktDrillBukaTutupSemua(buka) {
  if (buka) {
    const tree = mktDrillBangunTree_();
    Object.keys(tree).forEach(mn => {
      window.mktDrillExpanded.add('m|' + mn);
      Object.keys(tree[mn].pakets).forEach(pk => {
        window.mktDrillExpanded.add('p|' + mn + '|' + pk);
        const P = tree[mn].pakets[pk];
        Object.keys(P.campaigns).forEach(cp => {
          window.mktDrillExpanded.add('c|' + mn + '|' + pk + '|' + cp);
          Object.keys(P.campaigns[cp].adsets).forEach(ad => window.mktDrillExpanded.add('a|' + mn + '|' + pk + '|' + cp + '|' + ad));
        });
      });
    });
  } else {
    window.mktDrillExpanded.clear();
  }
  renderDrilldownIklan();
}

function renderDrilldownIklan() {
  const body = $m('bDrillIklan');
  if (!body) return;
  if (!drillSiapkan_()) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:18px; color:#94a3b8;">Memuat kamus promo & caption iklan...</td></tr>';
    return;
  }
  const tree = mktDrillBangunTree_();
  const minatKey = Object.keys(tree);
  if (!minatKey.length) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:18px; color:#94a3b8;">Belum ada data untuk filter ini.</td></tr>';
    return;
  }
  const ex = window.mktDrillExpanded;
  const esc = mktEsc;
  const daftarMinat = minatKey.sort((a, b) => tree[b].spend - tree[a].spend);
  const avgMinat = mktDrillRataCpl_(daftarMinat.map(m => tree[m]));
  const kls = (n, avg) => mktDrillKlasifikasi_(n.spend, n.results, mktDrillCpl_(n.spend, n.results), avg);
  let html = '';

  daftarMinat.forEach(mn => {
    const M = tree[mn], idM = 'm|' + mn, bukaM = ex.has(idM);
    const link = '<a href="#" onclick="event.stopPropagation(); paLompatBandingkan(' + JSON.stringify(mn).replace(/"/g, '&quot;') + '); return false;" style="font-size:10.5px; margin-left:8px; color:#4338ca; font-weight:700;">⚖️ bandingkan promo</a>';
    html += mktDrillBarisHeader_(idM, 0, bukaM, '📁 ' + esc(mn) + link, Object.keys(M.pakets).length + ' promo', M.spend, M.results, M.purchases, mktDrillCpl_(M.spend, M.results), '#ede9fe', kls(M, avgMinat));
    if (!bukaM) return;

    const daftarP = Object.keys(M.pakets).sort((a, b) => M.pakets[b].spend - M.pakets[a].spend);
    const avgP = mktDrillRataCpl_(daftarP.map(k => M.pakets[k]));
    daftarP.forEach(pk => {
      const P = M.pakets[pk], idP = 'p|' + mn + '|' + pk, bukaP = ex.has(idP);
      const pend = Object.keys(P.pendukung);
      const label = '🏷️ ' + esc(pk) + (pend.length ? '<div style="font-weight:500; font-size:10.5px; color:#64748b;">Pendukung: ' + esc(pend.join(' · ')) + '</div>' : '');
      html += mktDrillBarisHeader_(idP, 1, bukaP, label, Object.keys(P.campaigns).length + ' campaign · ' + Object.keys(P.ads).length + ' ad', P.spend, P.results, P.purchases, mktDrillCpl_(P.spend, P.results), '#fae8ff', kls(P, avgP));
      if (!bukaP) return;

      const daftarC = Object.keys(P.campaigns).sort((a, b) => P.campaigns[b].spend - P.campaigns[a].spend);
      const avgC = mktDrillRataCpl_(daftarC.map(k => P.campaigns[k]));
      daftarC.forEach(cp => {
        const C = P.campaigns[cp], idC = 'c|' + mn + '|' + pk + '|' + cp, bukaC = ex.has(idC);
        html += mktDrillBarisHeader_(idC, 2, bukaC, '📣 ' + esc(cp), Object.keys(C.adsets).length + ' adset', C.spend, C.results, C.purchases, mktDrillCpl_(C.spend, C.results), '#e0e7ff', kls(C, avgC));
        if (!bukaC) return;

        const daftarA = Object.keys(C.adsets).sort((a, b) => C.adsets[b].spend - C.adsets[a].spend);
        const avgA = mktDrillRataCpl_(daftarA.map(k => C.adsets[k]));
        daftarA.forEach(ad => {
          const A = C.adsets[ad], idA = 'a|' + mn + '|' + pk + '|' + cp + '|' + ad, bukaA = ex.has(idA);
          html += mktDrillBarisHeader_(idA, 3, bukaA, '🧩 ' + esc(ad), Object.keys(A.ads).length + ' ad', A.spend, A.results, A.purchases, mktDrillCpl_(A.spend, A.results), '#dbeafe', kls(A, avgA));
          if (!bukaA) return;

          const daftarAd = Object.values(A.ads).sort((x, y) => y.spend - x.spend);
          const avgAd = mktDrillRataCpl_(daftarAd);
          daftarAd.forEach(d => {
            const cplD = mktDrillCpl_(d.spend, d.results), kD = mktDrillKlasifikasi_(d.spend, d.results, cplD, avgAd);
            const ctr = d.n ? (d.ctrSum / d.n).toFixed(2) : '0.00';
            html += '<tr><td style="padding:7px 8px 7px 120px;">🎨 ' + esc(d.nama) + ' <span style="font-size:10.5px; color:#94a3b8;">' + esc(d.tipe) + '</span>' + mktDrillBadgeHtml_(kD) +
              (d.headline ? '<div style="font-size:11.5px; color:#334155; margin-top:3px;"><b>Headline:</b> ' + esc(d.headline) + '</div>' : '') +
              (d.body ? '<div style="font-size:11.5px; color:#64748b; margin-top:2px; max-width:480px; white-space:normal;"><b>Body:</b> ' + esc(d.body) + '</div>' : '') +
              '</td><td class="num">-</td><td class="num">Rp ' + rp(d.spend) + '</td><td class="num">' + d.results + '</td>' +
              '<td class="num" style="color:' + mktDrillWarnaCpl_(cplD) + '; font-weight:700;">' + (cplD === null ? '-' : 'Rp ' + rp(cplD)) + '</td>' +
              '<td class="num">' + d.purchases + ' <span style="font-size:10.5px; color:#94a3b8;">(CTR ' + ctr + '%)</span></td></tr>';
          });
        });
      });
    });
  });
  body.innerHTML = html;
}
