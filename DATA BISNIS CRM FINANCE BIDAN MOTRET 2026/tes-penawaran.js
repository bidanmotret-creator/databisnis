// =========================================================================
// tes-penawaran.js — Papan Tes: PENAWARAN x FILTER LEADS
// Prinsip: tiap iklan = 1 penawaran spesifik + (opsional) 1 filter kualifikasi
// (harga, DP, lokasi/layanan, usia bayi). Filter sengaja "menyaring" penonton,
// jadi CPL iklan berfilter wajar lebih tinggi; yang diadu adalah BIAYA PER LEAD
// BERKUALITAS (CPQL) bila datanya ada. Tanpa data kualitas, tes filter TIDAK
// diberi vonis menang/kalah.
// Muat SETELAH promo-analisis.js dan penawaran-ai.js.
// Bergantung pada: PT, PA, paKumpul_, paBandingkan_, paK_, ptLabelIklan_, kb*.
// Opsional: field `qualified` per iklan (dari backend), bila ada otomatis dipakai.
// =========================================================================

const TP_FILTER = ['harga', 'dp', 'layanan', 'lokasi', 'usia'];   // jenis kamus yang berperan sebagai filter leads
const TP_PENDUKUNG = ['trust', 'ajakan', 'urgensi'];                // bukan penawaran, bukan filter (urgensi = bujukan waktu, bukan insentif)
// Nama filter hasil baca AI (PenawaranIklan.gs v2, kolom filter_kualifikasi) -> label di matriks.
const TP_LABEL_FILTER_AI = { harga_eksplisit: 'Harga tertulis', dp_nominal: 'DP nominal', area_layanan: 'Area / layanan', usia_bayi: 'Usia bayi', jadwal_kuota: 'Jadwal / kuota', syarat_lain: 'Syarat lain' };
const TP_TANPA_OFFER = '(Tanpa penawaran)', TP_TANPA_FILTER = '(Tanpa filter)';

function tpJenisOffer_(j) { return j !== 'format' && TP_FILTER.indexOf(j) === -1 && TP_PENDUKUNG.indexOf(j) === -1; }

// Dua faktor per iklan. Penawaran = hasil baca AI bila ada, kalau tidak aturan kamus.
// nOffer dihitung dari aturan kamus (bukan AI) untuk mendeteksi iklan yang menumpuk banyak penawaran.
function tpFaktor_(a) {
  const labels = ptLabelIklan_({ nama: a.nama, m: { headline: a.headline, caption: a.caption } }, PT.rules);
  const offerRules = labels.filter(l => tpJenisOffer_(l.jenis)).map(l => l.label).sort();
  const filterKamus = labels.filter(l => TP_FILTER.indexOf(l.jenis) !== -1).map(l => l.label).sort();
  // Filter hasil baca AI dipakai bila iklan sudah dibaca ([] = dibaca, tidak ada filter); null = belum dibaca -> Kamus.
  const filterAi = (a.paket && Array.isArray(a.paket.filterAi)) ? a.paket.filterAi.map(k => TP_LABEL_FILTER_AI[k] || k).sort() : null;
  const filter = filterAi !== null ? filterAi : filterKamus;
  const offer = (a.paket && a.paket.dariAi && a.paket.kunci) ? a.paket.kunci : (offerRules.join(' + ') || TP_TANPA_OFFER);
  return { offer: offer, filter: filter.join(' + ') || TP_TANPA_FILTER, nOffer: offerRules.length, offerRules: offerRules };
}

function tpData_() {
  const iklan = paKumpul_(0);
  iklan.forEach(a => { a.fak = tpFaktor_(a); a.combo = a.fak.offer + ' ‖ ' + a.fak.filter; });
  return iklan;
}

// ------------------------------------------------------------ AGREGASI SEL
function tpSel_(c) {
  c.cpl = c.results > 0 ? c.spend / c.results : null;
  c.qLengkap = c.ads.length > 0 && c.ads.every(a => a.qualified !== null && a.qualified !== undefined);
  c.qualified = c.qLengkap ? c.ads.reduce((s, a) => s + (a.qualified || 0), 0) : null;
  c.cpql = c.qLengkap && c.qualified > 0 ? c.spend / c.qualified : null;
  c.qRate = c.qLengkap && c.results > 0 ? c.qualified / c.results * 100 : null;
  return c;
}
function tpAgregasi_(iklanMinat) {
  const cells = {};
  iklanMinat.forEach(a => {
    const c = cells[a.combo] || (cells[a.combo] = { combo: a.combo, offer: a.fak.offer, filter: a.fak.filter, n: 0, spend: 0, results: 0, ads: [] });
    c.n++; c.spend += a.spend; c.results += a.results; c.ads.push(a);
  });
  Object.values(cells).forEach(tpSel_);
  const pakaiQ = iklanMinat.length > 0 && iklanMinat.every(a => a.qualified !== null && a.qualified !== undefined);
  return { cells, pakaiQ };
}

// ------------------------------------------------------------ UJI SATU VARIABEL
// Memakai ulang paBandingkan_ dengan kunci = kombinasi dan "results" = metrik terpilih.
function tpBandingkan_(iklanMinat, cA, cB, K, pakaiQ) {
  const salinan = iklanMinat.filter(a => a.combo === cA.combo || a.combo === cB.combo)
    .map(a => Object.assign({}, a, { paket: { kunci: a.combo }, results: pakaiQ ? (a.qualified || 0) : a.results }));
  return paBandingkan_(salinan, cA.combo, cB.combo, K);
}

function tpPasangan_(agg, iklanMinat, K) {
  const daftar = Object.values(agg.cells).filter(c => c.n > 0), out = [];
  for (let i = 0; i < daftar.length; i++) for (let j = i + 1; j < daftar.length; j++) {
    const a = daftar[i], b = daftar[j];
    let variabel = null;
    if (a.offer === b.offer && a.filter !== b.filter) variabel = 'Filter';
    else if (a.filter === b.filter && a.offer !== b.offer) variabel = 'Penawaran';
    if (!variabel) continue;
    // A = sisi yang spend-nya lebih besar (acuan)
    const [A, B] = a.spend >= b.spend ? [a, b] : [b, a];
    out.push({ variabel, A, B, h: tpBandingkan_(iklanMinat, A, B, K, agg.pakaiQ), bobot: Math.min(A.spend, B.spend) });
  }
  return out.sort((x, y) => y.bobot - x.bobot);
}

function tpVonis_(p, pakaiQ) {
  const h = p.h, namaSisi = k => (p.variabel === 'Filter' ? p[k].filter : p[k].offer);
  if (!h.pakai) return { teks: '⚪ Belum cukup data', warna: '#64748b' };
  if (p.variabel === 'Filter' && !pakaiQ) return { teks: '🟠 Butuh data kualitas lead (CPL saja menyesatkan untuk filter)', warna: '#b45309' };
  if (h.pakai.kode === 'A') return { teks: '🟢 ' + namaSisi('A') + ' lebih murah', warna: '#047857' };
  if (h.pakai.kode === 'B') return { teks: '🟢 ' + namaSisi('B') + ' lebih murah', warna: '#047857' };
  return { teks: '🟡 Setara', warna: '#b45309' };
}

// ------------------------------------------------------------ KEPATUHAN & RENCANA
function tpKepatuhan_(iklanMinat) {
  const g = { patuh: { n: 0, spend: 0 }, campur: { n: 0, spend: 0, daftar: [] }, tanpa: { n: 0, spend: 0 } };
  let total = 0;
  iklanMinat.forEach(a => {
    total += a.spend;
    const k = a.fak.nOffer === 1 ? 'patuh' : (a.fak.nOffer >= 2 ? 'campur' : 'tanpa');
    g[k].n++; g[k].spend += a.spend;
    if (k === 'campur') g.campur.daftar.push(a);
  });
  g.campur.daftar.sort((x, y) => y.spend - x.spend);
  g.total = total;
  return g;
}

function tpRencana_(agg, iklanMinat, kep, K) {
  const saran = [];
  if (kep.total > 0 && kep.campur.spend / kep.total >= 0.3) {
    const top = kep.campur.daftar[0];
    saran.push('Pecah iklan yang menumpuk penawaran: ' + Math.round(kep.campur.spend / kep.total * 100) + '% spend (' + kbRp(kep.campur.spend) + ') ada di iklan yang memuat ≥ 2 penawaran sekaligus, jadi hasilnya tidak bisa ditautkan ke satu penawaran. Mulai dari "' + (top ? top.nama : '-') + '": buat satu iklan per penawaran (' + (top ? top.fak.offerRules.join(', ') : '') + ').');
  }
  if (!agg.pakaiQ) saran.push('Kualitas lead belum terukur untuk minat ini. Tes filter (harga, DP, lokasi, usia) belum bisa diputuskan sampai backend mengirim jumlah "lead berkualitas" per iklan. Sampai saat itu bandingkan hanya penawaran dengan filter yang sama.');

  const perOffer = {};
  Object.values(agg.cells).forEach(c => { (perOffer[c.offer] = perOffer[c.offer] || []).push(c); });
  const poolFilter = [];
  (PT.rules || []).forEach(r => { if (TP_FILTER.indexOf(r.jenis) !== -1 && poolFilter.indexOf(r.label) === -1) poolFilter.push(r.label); });
  Object.keys(perOffer).map(k => ({ k, spend: perOffer[k].reduce((s, c) => s + c.spend, 0), cells: perOffer[k] }))
    .filter(o => o.k !== TP_TANPA_OFFER && o.spend >= K.minSpend).sort((a, b) => b.spend - a.spend).slice(0, 3).forEach(o => {
      const dipakai = {}; o.cells.forEach(c => { c.filter.split(' + ').forEach(f => { dipakai[f] = 1; }); });
      const kandidat = poolFilter.filter(f => !dipakai[f]);
      if (o.cells.length === 1 && kandidat.length) {
        const terbaik = o.cells[0].ads.slice().sort((x, y) => y.results - x.results)[0];
        saran.push('Penawaran "' + o.k + '" baru dites dengan ' + (o.cells[0].filter === TP_TANPA_FILTER ? 'satu jenis filter saja (tanpa filter)' : 'filter "' + o.cells[0].filter + '"') + '. Duplikat "' + (terbaik ? terbaik.nama : '-') + '" dan ubah SATU hal: ' + (o.cells[0].filter === TP_TANPA_FILTER ? 'tambahkan' : 'ganti dengan') + ' "' + kandidat[0] + '" di headline atau baris pertama caption. Visual, audiens, adset, dan anggaran dibuat sama.');
      }
    });

  const aktif = Object.values(agg.cells).filter(c => c.results > 0);
  const rata = aktif.length ? aktif.reduce((s, c) => s + c.results, 0) / aktif.length : 0;
  return { saran, rataLeadPerSel: rata, jumlahSel: aktif.length };
}

// ------------------------------------------------------------ RENDER
function tpRender() {
  const paBox = document.getElementById('paPanel');
  if (!paBox) return;
  let box = document.getElementById('tpPanel');
  if (!box) {
    box = document.createElement('div'); box.id = 'tpPanel'; box.style.cssText = 'margin:0 0 20px;';
    paBox.insertAdjacentElement('afterend', box);
  }
  if (!PT.kamus || !PA.minat) { box.innerHTML = ''; return; }

  const K = paK_();
  const iklanMinat = tpData_().filter(a => a.minat === PA.minat);
  const kartu = isi => '<div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px;">' + isi + '</div>';
  if (!iklanMinat.length) { box.innerHTML = kartu('<b>🧪 Papan tes penawaran × filter</b><p style="color:#94a3b8; font-size:12.5px;">Belum ada iklan untuk minat ini.</p>'); return; }

  const agg = tpAgregasi_(iklanMinat), kep = tpKepatuhan_(iklanMinat);
  const cells = Object.values(agg.cells);
  const spendMinat = cells.reduce((s, c) => s + c.spend, 0), resMinat = cells.reduce((s, c) => s + c.results, 0);
  const qMinat = agg.pakaiQ ? cells.reduce((s, c) => s + c.qualified, 0) : null;
  const rataBiaya = agg.pakaiQ ? (qMinat > 0 ? spendMinat / qMinat : 0) : (resMinat > 0 ? spendMinat / resMinat : 0);
  const biaya = c => agg.pakaiQ ? c.cpql : c.cpl;

  const offers = Object.values(cells.reduce((m, c) => { (m[c.offer] = m[c.offer] || { k: c.offer, spend: 0 }).spend += c.spend; return m; }, {})).sort((a, b) => b.spend - a.spend).slice(0, 8).map(o => o.k);
  const filters = Object.values(cells.reduce((m, c) => { (m[c.filter] = m[c.filter] || { k: c.filter, spend: 0 }).spend += c.spend; return m; }, {})).sort((a, b) => b.spend - a.spend).slice(0, 6).map(o => o.k);

  const warnaSel = c => {
    const cnt = agg.pakaiQ ? c.qualified : c.results;
    if (!(c.spend >= K.minSpend && cnt >= K.minRes) || !biaya(c) || !rataBiaya) return '#f8fafc';
    const r = biaya(c) / rataBiaya;
    return r <= 1 - K.band ? '#dcfce7' : (r >= 1 + K.band ? '#fee2e2' : '#fef9c3');
  };
  const sel = c => !c ? '<span style="color:#cbd5e1;">·</span>' :
    '<div style="font-weight:800;">' + (biaya(c) ? kbRp(biaya(c)) : '-') + '</div>' +
    '<div style="font-size:10.5px; color:#475569;">' + c.results + ' leads · ' + c.n + ' iklan</div>' +
    (c.qLengkap ? '<div style="font-size:10.5px; color:#4338ca;">' + c.qualified + ' berkualitas' + (c.qRate !== null ? ' (' + Math.round(c.qRate) + '%)' : '') + '</div>' : '') +
    '<div style="font-size:10.5px; color:#94a3b8;">' + kbRp(c.spend) + '</div>';
  const matriks = '<div class="table-responsive table-compact-wrap"><table style="width:100%;"><thead><tr style="background:#f1f5f9; font-size:11.5px;"><th style="text-align:left;">Penawaran ↓ / Filter →</th>' +
    filters.map(f => '<th>' + kbEsc(f) + '</th>').join('') + '</tr></thead><tbody>' +
    offers.map(o => '<tr><td style="text-align:left; max-width:260px; white-space:normal;"><b>' + kbEsc(o) + '</b></td>' +
      filters.map(f => { const c = agg.cells[o + ' ‖ ' + f]; return '<td style="text-align:center; background:' + (c ? warnaSel(c) : '#fff') + ';">' + sel(c) + '</td>'; }).join('') + '</tr>').join('') +
    '</tbody></table></div>';

  const pasangan = tpPasangan_(agg, iklanMinat, K).slice(0, 12);
  const metrikNama = agg.pakaiQ ? 'biaya per lead berkualitas' : 'CPL Meta';
  const barisPasangan = pasangan.map(p => {
    const v = tpVonis_(p, agg.pakaiQ), d = p.h.pakai ? p.h.pakai.data : p.h.lv.minat;
    const beda = p.variabel === 'Filter' ? kbEsc(p.A.filter) + ' <b>vs</b> ' + kbEsc(p.B.filter) + '<div style="font-size:10.5px; color:#64748b;">penawaran sama: ' + kbEsc(p.A.offer) + '</div>'
      : kbEsc(p.A.offer) + ' <b>vs</b> ' + kbEsc(p.B.offer) + '<div style="font-size:10.5px; color:#64748b;">filter sama: ' + kbEsc(p.A.filter) + '</div>';
    const bukti = p.h.pakai ? { kuat: '🧩 adset sama', sedang: '📣 campaign sama', lemah: '📁 lintas campaign' }[p.h.pakai.kekuatan] : '-';
    return '<tr><td><span style="background:' + (p.variabel === 'Filter' ? '#ede9fe' : '#e0f2fe') + '; border-radius:10px; padding:1px 8px; font-size:11px; font-weight:700;">' + p.variabel + '</span></td>' +
      '<td style="text-align:left; white-space:normal; max-width:380px;">' + beda + '</td><td>' + bukti + '</td>' +
      '<td>' + (d.cplA !== null ? kbRp(d.cplA) : '-') + ' <span style="color:#94a3b8;">vs</span> ' + (d.cplB !== null ? kbRp(d.cplB) : '-') + '</td>' +
      '<td style="color:' + v.warna + '; font-weight:700; text-align:left;">' + v.teks + '</td></tr>';
  }).join('');

  const rencana = tpRencana_(agg, iklanMinat, kep, K);
  const persenKep = k => kep.total > 0 ? Math.round(kep[k].spend / kep.total * 100) : 0;
  const campurHtml = kep.campur.daftar.slice(0, 4).map(a => '<li>' + kbEsc(a.nama) + ' <span style="color:#94a3b8;">(' + kbRp(a.spend) + ')</span>: ' + kbEsc(a.fak.offerRules.join(' + ')) + '</li>').join('');
  const perluSampel = 150;

  box.innerHTML = kartu(
    '<b style="font-size:14px;">🧪 Papan tes: 1 iklan = 1 penawaran + 1 filter leads</b> <span style="font-size:12px; color:#64748b;">· minat ' + kbEsc(PA.minat) + ' (ikut pilihan di panel atas)</span>' +
    '<p style="font-size:11.5px; color:#64748b; margin:6px 0 10px;">Filter (' + TP_FILTER.join(', ') + ') sengaja menyaring penonton, jadi CPL-nya wajar lebih tinggi. Tes yang adil membandingkan <b>' + metrikNama + '</b>. ' +
      (agg.pakaiQ ? 'Data lead berkualitas tersedia untuk minat ini.' : '<span style="color:#b45309;">Data lead berkualitas belum tersedia: sel diwarnai dengan CPL Meta dan tes filter tidak diberi vonis.</span>') + '</p>' +

    '<div style="background:#f8fafc; border-radius:8px; padding:8px 12px; font-size:12.5px; margin-bottom:12px;"><b>Disiplin "1 iklan = 1 penawaran":</b> ' +
      '<span style="color:#047857;">✅ ' + kep.patuh.n + ' iklan (' + persenKep('patuh') + '% spend)</span> · <span style="color:#b91c1c;">⚠️ ' + kep.campur.n + ' iklan menumpuk ≥ 2 penawaran (' + persenKep('campur') + '%)</span> · <span style="color:#64748b;">⚪ ' + kep.tanpa.n + ' tanpa penawaran (' + persenKep('tanpa') + '%)</span>' +
      (campurHtml ? '<ul style="margin:6px 0 0 18px; padding:0; font-size:11.5px; color:#475569;">' + campurHtml + '</ul>' : '') + '</div>' +

    '<div style="font-weight:700; font-size:13px; margin-bottom:4px;">Matriks penawaran × filter <span style="font-weight:500; color:#64748b;">(sel = ' + metrikNama + '; hijau/merah dibanding rata-rata minat ' + (rataBiaya ? kbRp(rataBiaya) : '-') + ')</span></div>' + matriks +

    '<div style="font-weight:700; font-size:13px; margin:14px 0 4px;">Uji satu variabel <span style="font-weight:500; color:#64748b;">(hanya pasangan yang berbeda di SATU faktor)</span></div>' +
    (barisPasangan ? '<div class="table-responsive table-compact-wrap"><table style="width:100%;"><thead><tr style="background:#f1f5f9; font-size:11.5px;"><th>Variabel</th><th style="text-align:left;">Dibandingkan</th><th>Bukti</th><th>' + (agg.pakaiQ ? 'CPQL' : 'CPL Meta') + ' A vs B</th><th style="text-align:left;">Vonis</th></tr></thead><tbody>' + barisPasangan + '</tbody></table></div>'
      : '<p style="color:#94a3b8; font-size:12.5px;">Belum ada pasangan bersih. Buat iklan yang hanya berbeda di satu faktor (penawaran sama, filter beda, atau sebaliknya).</p>') +

    '<div style="font-weight:700; font-size:13px; margin:14px 0 4px;">Rencana tes berikutnya</div>' +
    (rencana.saran.length ? '<ol style="margin:0 0 0 18px; padding:0; font-size:12.5px; line-height:1.65; color:#334155;">' + rencana.saran.map(s => '<li style="margin-bottom:4px;">' + kbEsc(s) + '</li>').join('') + '</ol>' : '<p style="color:#94a3b8; font-size:12.5px;">Tidak ada saran khusus saat ini.</p>') +
    '<p style="font-size:11px; color:#94a3b8; margin:8px 0 0;">Kecukupan sampel: rata-rata ' + rencana.rataLeadPerSel.toFixed(0) + ' leads per sel pada ' + rencana.jumlahSel + ' sel. Untuk membedakan 25% vs 40% lead berkualitas dengan yakin dibutuhkan kira-kira ' + perluSampel + ' leads per varian (perkiraan kasar, taraf 5%, daya 80%). Dengan volume sekarang hanya selisih besar yang terbaca, jadi jalankan 2 sampai 3 varian sekaligus dan anggap hasil sebagai arah, bukan kepastian.</p>'
  );
}

(function () {
  const asli = window.paRender;
  window.paRender = function () {
    if (typeof asli === 'function') asli.apply(this, arguments);
    try { tpRender(); } catch (e) { console.error('tpRender gagal:', e); }
  };
})();
