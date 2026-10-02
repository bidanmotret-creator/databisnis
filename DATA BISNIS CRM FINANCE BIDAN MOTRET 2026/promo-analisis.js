// =========================================================================
// promo-analisis.js — Papan Tes Promo v2: PAKET PENAWARAN + perbandingan adil
// Muat SETELAH promo-tes.js, konten-berjalan.js, mkt-extra.js.
//
// Ide utama:
//  1. Satu iklan = SATU paket penawaran (kombinasi label penawaran), jadi tidak
//     ada lagi iklan yang sama dihitung di banyak baris.
//  2. Label jenis format/trust/layanan/ajakan BUKAN penawaran: jadi "pendukung".
//  3. Promo A vs B dibandingkan per MINAT dengan 3 tingkat bukti:
//       adset sama (kuat) > campaign sama (sedang) > lintas campaign (lemah).
//  4. Vonis dari aturan (ambang UI). AI hanya menjelaskan konteks dari caption.
// =========================================================================

const PA_TANPA = '(Tanpa penawaran)';
const PA_PENDUKUNG = ['trust', 'layanan', 'ajakan'];
const PA = { minat: '', hari: 30, A: '', B: '', ai: {}, aiMemuat: false };

function paK_() {
  return {
    minSpend: ambilThreshold_('kontenMinSpendRp', 150000),
    minRes: ambilThreshold_('promoMinResults', 5),
    band: ambilThreshold_('promoBandPersen', 15) / 100
  };
}
function paMinat_(namaCampaign) {
  const s = String(namaCampaign || '');
  return (typeof normalisasiMinat === 'function') ? (normalisasiMinat(s) || s) : s;
}

// ------------------------------------------------------------ PAKET PER IKLAN
function paPaketDariTeks_(nama, headline, caption, rules) {
  const labels = ptLabelIklan_({ nama: nama, m: { headline: headline, caption: caption } }, rules);
  const penawaran = labels.filter(l => l.jenis !== 'format' && PA_PENDUKUNG.indexOf(l.jenis) === -1).map(l => l.label).sort();
  const pendukung = labels.filter(l => PA_PENDUKUNG.indexOf(l.jenis) !== -1).map(l => l.label).sort();
  const format = labels.filter(l => l.jenis === 'format').map(l => l.label);
  return { kunci: penawaran.length ? penawaran.join(' + ') : PA_TANPA, penawaran, pendukung, format };
}

// Satu baris per iklan (agregat periode), lengkap dengan paket, adset, minat.
function paKumpul_(hari) {
  const iklan = kbHitung_({ berjalan: false, cari: '' });
  const meta = {};
  (dataContent || []).forEach(r => {
    const id = String(r.ad_id || '').trim();
    if (!id) return;
    meta[id] = { adset: r.adset_name ? String(r.adset_name) : '', campaign: r.campaign_name ? String(r.campaign_name) : '' };
  });
  return iklan.map(r => {
    const mt = meta[r.id] || {};
    const m = r.m || {};
    const campaign = mt.campaign || r.campaign;
    return {
      id: r.id, nama: r.nama, campaign: campaign, adset: mt.adset || '(tanpa adset)', minat: paMinat_(campaign),
      paket: paPaketDariTeks_(r.nama, m.headline || '', m.caption || '', PT.rules),
      tipe: m.tipe || '', headline: m.headline || '', caption: m.caption || '', punyaTeks: !!(m.caption || m.headline),
      spend: r.spend, imp: r.imp, klik: r.klik, results: r.results,
      leads: r.leads, closing: r.closing, terbayar: r.terbayar, atSpend: r.at ? r.at.spend : 0
    };
  }).filter(a => a.spend > 0);
}

function paAgregasi_(iklan) {
  const out = {};
  iklan.forEach(a => {
    const M = out[a.minat] || (out[a.minat] = { minat: a.minat, spend: 0, results: 0, imp: 0, klik: 0, pakets: {}, iklan: [] });
    M.spend += a.spend; M.results += a.results; M.imp += a.imp; M.klik += a.klik; M.iklan.push(a);
    const P = M.pakets[a.paket.kunci] || (M.pakets[a.paket.kunci] = {
      kunci: a.paket.kunci, penawaran: a.paket.penawaran, pendukung: {}, n: 0, spend: 0, imp: 0, klik: 0, results: 0,
      leads: 0, closing: 0, terbayar: 0, atSpend: 0, adaAtr: false, tanpaTeks: 0, ads: []
    });
    P.n++; P.spend += a.spend; P.imp += a.imp; P.klik += a.klik; P.results += a.results; P.ads.push(a);
    a.paket.pendukung.forEach(x => { P.pendukung[x] = true; });
    if (!a.punyaTeks) P.tanpaTeks++;
    if (a.leads !== null && a.leads !== undefined) {
      P.adaAtr = true; P.leads += a.leads; P.closing += (a.closing || 0); P.terbayar += (a.terbayar || 0); P.atSpend += (a.atSpend || 0);
    }
  });
  Object.values(out).forEach(M => Object.values(M.pakets).forEach(P => {
    P.cpl = P.results > 0 ? P.spend / P.results : 0;
    P.ctr = P.imp > 0 ? P.klik / P.imp * 100 : 0;
    P.realCpl = P.adaAtr && P.leads > 0 ? P.atSpend / P.leads : null;
    P.contoh = P.ads.slice().sort((x, y) => y.spend - x.spend).slice(0, 2);
  }));
  return out;
}

// ------------------------------------------------------------ PERBANDINGAN A vs B
function paSisi_() { return { spend: 0, res: 0, imp: 0, n: 0 }; }
function paTambah_(s, a) { s.spend += a.spend; s.res += a.results; s.imp += a.imp; s.n++; }
function paGabung_(d, s) { d.spend += s.spend; d.res += s.res; d.imp += s.imp; d.n += s.n; }

function paLevel_(sA, sB, unit, K) {
  const cplA = sA.res > 0 ? sA.spend / sA.res : null, cplB = sB.res > 0 ? sB.spend / sB.res : null;
  const cukup = s => s.spend >= K.minSpend && s.res >= K.minRes;
  let kode = 'tunggu', selisih = null;
  if (cplA !== null && cplB !== null) selisih = (cplB - cplA) / cplB * 100;   // + = A lebih murah
  if (unit > 0 && cukup(sA) && cukup(sB) && cplA !== null && cplB !== null) {
    const rasio = cplA / cplB;
    kode = rasio <= 1 - K.band ? 'A' : (rasio >= 1 + K.band ? 'B' : 'setara');
  }
  return { unit, sA, sB, cplA, cplB, selisih, kode };
}

function paKunciPeriode_() { const f = kbFilterAtas_(); return f.since + '..' + f.until + '|' + f.campaigns.join(','); }
function paLabelPeriode_() { const f = kbFilterAtas_(); return (f.since || f.until) ? (f.since || '...') + ' s/d ' + (f.until || 'sekarang') : 'semua'; }

function paBandingkan_(iklanMinat, kA, kB, K) {
  const cell = {}, camp = {}, tot = { A: paSisi_(), B: paSisi_() };
  iklanMinat.forEach(a => {
    const sisi = a.paket.kunci === kA ? 'A' : (a.paket.kunci === kB ? 'B' : null);
    if (!sisi) return;
    paTambah_(tot[sisi], a);
    const kc = a.campaign + '||' + a.adset;
    const c = cell[kc] || (cell[kc] = { A: paSisi_(), B: paSisi_(), campaign: a.campaign, adset: a.adset });
    paTambah_(c[sisi], a);
    const k2 = camp[a.campaign] || (camp[a.campaign] = { A: paSisi_(), B: paSisi_() });
    paTambah_(k2[sisi], a);
  });

  const gAdA = paSisi_(), gAdB = paSisi_(), gCpA = paSisi_(), gCpB = paSisi_();
  let uAd = 0, uCp = 0, menangA = 0, menangB = 0, seri = 0;
  Object.values(cell).forEach(c => {
    if (!(c.A.n && c.B.n)) return;
    uAd++; paGabung_(gAdA, c.A); paGabung_(gAdB, c.B);
    if (c.A.res > 0 && c.B.res > 0) {
      const r = (c.A.spend / c.A.res) / (c.B.spend / c.B.res);
      if (r < 1) menangA++; else if (r > 1) menangB++; else seri++;
    }
  });
  Object.values(camp).forEach(c => { if (c.A.n && c.B.n) { uCp++; paGabung_(gCpA, c.A); paGabung_(gCpB, c.B); } });

  const lv = {
    adset: paLevel_(gAdA, gAdB, uAd, K),
    campaign: paLevel_(gCpA, gCpB, uCp, K),
    minat: paLevel_(tot.A, tot.B, (tot.A.n && tot.B.n) ? 1 : 0, K)
  };
  const urut = [['adset', 'kuat'], ['campaign', 'sedang'], ['minat', 'lemah']];
  const dipakai = urut.find(x => lv[x[0]].kode !== 'tunggu') || null;
  const tegas = urut.filter(x => lv[x[0]].kode === 'A' || lv[x[0]].kode === 'B').map(x => lv[x[0]].kode);
  return {
    kA, kB, lv, menangA, menangB, seri,
    pakai: dipakai ? { tingkat: dipakai[0], kekuatan: dipakai[1], kode: lv[dipakai[0]].kode, data: lv[dipakai[0]] } : null,
    konflik: tegas.indexOf('A') !== -1 && tegas.indexOf('B') !== -1
  };
}

function paKalimat_(minat, A, B, h, K) {
  const rpx = n => kbRp(n);
  if (!h.pakai) {
    const t = h.lv.minat;
    const kurang = [];
    ['A', 'B'].forEach(s => {
      const x = s === 'A' ? t.sA : t.sB, nama = s === 'A' ? A : B;
      if (!x.n) kurang.push('"' + nama + '" tidak punya iklan pada periode ini');
      else if (x.spend < K.minSpend || x.res < K.minRes) kurang.push('"' + nama + '" baru ' + rpx(x.spend) + ' / ' + x.res + ' leads (butuh ≥ ' + rpx(K.minSpend) + ' dan ≥ ' + K.minRes + ')');
    });
    return 'Belum bisa dinilai di ' + minat + ': ' + (kurang.join('; ') || 'data belum cukup') + '.';
  }
  const d = h.pakai.data, tingkat = {
    adset: 'dibandingkan di ' + d.unit + ' adset yang sama (audiens sama, hanya penawaran beda)',
    campaign: 'dibandingkan di ' + d.unit + ' campaign yang sama (adset bisa berbeda)',
    minat: 'dibandingkan lintas campaign (audiens bisa berbeda, hanya petunjuk)'
  }[h.pakai.tingkat];
  const abs = Math.abs(d.selisih || 0).toFixed(0);
  let inti;
  if (h.pakai.kode === 'A') inti = '"' + A + '" lebih murah ' + abs + '% dari "' + B + '" (' + rpx(d.cplA) + ' vs ' + rpx(d.cplB) + ' per lead Meta)';
  else if (h.pakai.kode === 'B') inti = '"' + B + '" lebih murah ' + abs + '% dari "' + A + '" (' + rpx(d.cplB) + ' vs ' + rpx(d.cplA) + ' per lead Meta)';
  else inti = 'Selisih CPL "' + A + '" dan "' + B + '" hanya ' + abs + '%, masih dalam batas ±' + Math.round(K.band * 100) + '%, dianggap setara (' + rpx(d.cplA) + ' vs ' + rpx(d.cplB) + ')';
  let s = 'Di ' + minat + ': ' + inti + ', ' + tingkat + '. Sampel ' + d.sA.res + ' vs ' + d.sB.res + ' leads Meta.';
  if (h.pakai.tingkat === 'adset' && (h.menangA + h.menangB) > 0) s += ' Per adset: ' + h.menangA + ' dimenangkan A, ' + h.menangB + ' dimenangkan B.';
  if (h.konflik) s += ' ⚠️ Arah berbeda antar tingkat bukti: ambil tingkat terkuat, jangan jadikan keputusan final.';
  return s;
}

// ------------------------------------------------------------ RENDER
function paPasangPanel_() {
  let box = $m('paPanel');
  if (box) return box;
  const sub = $m('mktSub_promo');
  if (!sub) return null;
  const tb = sub.querySelector('.mkt-toolbar');
  const sel = $m('ptLabelAtas');
  if (!tb || !sel) return null;
  box = document.createElement('div');
  box.id = 'paPanel';
  box.style.cssText = 'margin:0 0 20px;';
  tb.insertAdjacentElement('afterend', box);
  const h = document.createElement('div');
  h.innerHTML = '<h3 style="margin:18px 0 4px; font-size:14px; color:#1e293b;">🏷️ Tabel label tunggal (tampilan lama)</h3>' +
    '<p style="font-size:11.5px; color:#94a3b8; margin:0 0 8px;">Satu iklan bisa tampil di beberapa baris karena punya beberapa label. Untuk membandingkan promo gunakan panel paket penawaran di atas.</p>';
  sel.parentNode.parentNode.insertBefore(h, sel.parentNode);
  return box;
}

function paChip_(t, warna) {
  return '<span style="display:inline-block; background:' + (warna || '#f1f5f9') + '; color:#475569; border-radius:10px; padding:1px 7px; font-size:10.5px; margin:1px 3px 1px 0;">' + kbEsc(t) + '</span>';
}
function paVonisLabel_(kode, A, B) {
  const tampil = t => kbEsc(t.length > 28 ? t.slice(0, 27) + '…' : t);
  if (kode === 'A') return '<b style="color:#047857;">🟢 ' + tampil(A) + ' lebih murah</b>';
  if (kode === 'B') return '<b style="color:#047857;">🟢 ' + tampil(B) + ' lebih murah</b>';
  if (kode === 'setara') return '<b style="color:#b45309;">🟡 Setara</b>';
  return '<span style="color:#64748b;">⚪ Belum cukup data</span>';
}

function paRender() {
  const box = paPasangPanel_();
  if (!box) return;
  const kartu = isi => '<div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px;">' + isi + '</div>';
  if (!PT.kamus) { box.innerHTML = kartu('<span style="color:#94a3b8; font-size:12.5px;">Memuat kamus promo...</span>'); return; }

  const K = paK_();
  const iklan = paKumpul_(PA.hari);
  const agg = paAgregasi_(iklan);
  const minatList = Object.keys(agg).sort((a, b) => agg[b].spend - agg[a].spend);
  const selCss = 'padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12.5px;';

  if (!minatList.length) {
    box.innerHTML = kartu('<b>⚖️ Perbandingan promo per minat</b><p style="color:#94a3b8; font-size:12.5px;">Belum ada iklan ber-spend pada periode ini.</p>');
    return;
  }
  if (!agg[PA.minat]) PA.minat = minatList[0];
  const M = agg[PA.minat];
  const pakets = Object.values(M.pakets).sort((a, b) => b.spend - a.spend);
  const ada = k => pakets.some(p => p.kunci === k);
  if (!ada(PA.A) || !ada(PA.B) || PA.A === PA.B) {
    const pil = pakets.filter(p => p.kunci !== PA_TANPA), dasar = pil.length >= 2 ? pil : pakets;
    PA.A = dasar[0] ? dasar[0].kunci : ''; PA.B = dasar[1] ? dasar[1].kunci : '';
  }
  const cplMinat = M.results > 0 ? M.spend / M.results : 0;
  const aiKey = PA.minat + '|' + paKunciPeriode_(), ai = PA.ai[aiKey] || null;
  const aiArti = {};
  if (ai && ai.paket) ai.paket.forEach(p => { aiArti[p.label] = p; });

  const baris = pakets.map(p => {
    const cukup = p.spend >= K.minSpend && p.results >= K.minRes && cplMinat > 0;
    const st = !cukup ? 'tunggu' : (p.cpl <= cplMinat * (1 - K.band) ? 'unggul' : (p.cpl >= cplMinat * (1 + K.band) ? 'tertinggal' : 'setara'));
    const pend = Object.keys(p.pendukung);
    const a = aiArti[p.kunci];
    const dash = '<span style="color:#cbd5e1;">-</span>';
    return '<tr>' +
      '<td style="text-align:left; max-width:340px; white-space:normal;"><b>' + kbEsc(p.kunci) + '</b>' +
        (pend.length ? '<div>' + pend.map(x => paChip_(x)).join('') + '</div>' : '') +
        (a && a.arti_awam ? '<div style="font-size:11.5px; color:#4338ca; margin-top:3px;">🧠 ' + kbEsc(a.arti_awam) + '</div>' : '') +
        (a && a.ciri_kreatif ? '<div style="font-size:11px; color:#64748b;">🎬 ' + kbEsc(a.ciri_kreatif) + '</div>' : '') +
        (p.tanpaTeks ? '<div style="font-size:10.5px; color:#b45309;">⚠️ ' + p.tanpaTeks + ' iklan tanpa caption</div>' : '') +
      '</td>' +
      '<td>' + p.n + '</td><td>' + kbRp(p.spend) + '</td><td>' + kbInt(p.results) + '</td>' +
      '<td>' + (p.cpl > 0 ? kbRp(p.cpl) : '-') + '</td><td>' + kbPct(p.ctr) + '</td>' +
      '<td>' + (p.realCpl !== null ? kbRp(p.realCpl) : dash) + '</td>' +
      '<td>' + (p.adaAtr ? kbInt(p.leads) : dash) + '</td><td>' + (p.adaAtr ? kbInt(p.closing) : dash) + '</td>' +
      '<td>' + ptStatusHtml_(st) + '</td></tr>';
  }).join('');

  const opsiAB = pilih => pakets.map(p => '<option value="' + kbEsc(p.kunci) + '"' + (p.kunci === pilih ? ' selected' : '') + '>' + kbEsc(p.kunci.length > 70 ? p.kunci.slice(0, 69) + '…' : p.kunci) + ' (' + kbRp(p.spend) + ')</option>').join('');
  const h = (PA.A && PA.B) ? paBandingkan_(M.iklan, PA.A, PA.B, K) : null;

  let bukti = '';
  if (h) {
    const namaTingkat = { adset: '🧩 Adset sama · bukti kuat', campaign: '📣 Campaign sama · bukti sedang', minat: '📁 Lintas campaign · bukti lemah' };
    bukti = '<table style="width:100%; margin-top:6px;"><thead><tr style="background:#f1f5f9; font-size:11.5px;"><th style="text-align:left;">Tingkat bukti</th><th>Unit</th><th>Spend A</th><th>Leads A</th><th>CPL A</th><th>Spend B</th><th>Leads B</th><th>CPL B</th><th>Vonis</th></tr></thead><tbody>' +
      ['adset', 'campaign', 'minat'].map(t => {
        const l = h.lv[t], dipakai = h.pakai && h.pakai.tingkat === t;
        return '<tr style="' + (dipakai ? 'background:#eef2ff;' : '') + '"><td style="text-align:left;">' + namaTingkat[t] + (dipakai ? ' ←' : '') + '</td>' +
          '<td>' + (t === 'minat' ? '-' : l.unit) + '</td><td>' + kbRp(l.sA.spend) + '</td><td>' + l.sA.res + '</td><td>' + (l.cplA !== null ? kbRp(l.cplA) : '-') + '</td>' +
          '<td>' + kbRp(l.sB.spend) + '</td><td>' + l.sB.res + '</td><td>' + (l.cplB !== null ? kbRp(l.cplB) : '-') + '</td><td>' + paVonisLabel_(l.kode, PA.A, PA.B) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  let aiHtml = '';
  if (ai) {
    aiHtml = '<div style="margin-top:10px; padding:10px 12px; background:#eef2ff; border-radius:8px; font-size:12.5px; line-height:1.6; color:#312e81;">' +
      (ai.bacaan_minat ? '<div><b>🧠 Bacaan AI:</b> ' + kbEsc(ai.bacaan_minat) + '</div>' : '') +
      (ai.saran_tes ? '<div style="margin-top:4px;"><b>🔬 Tes berikutnya:</b> ' + kbEsc(ai.saran_tes) + '</div>' : '') +
      (ai.angka_tak_terverifikasi && ai.angka_tak_terverifikasi.length ? '<div style="margin-top:4px; color:#b45309;">⚠️ Angka berikut tidak ditemukan di data, abaikan: ' + kbEsc(ai.angka_tak_terverifikasi.join(', ')) + '</div>' : '') +
      '</div>';
  }

  box.innerHTML = kartu(
    '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px;">' +
      '<b style="font-size:14px;">⚖️ Perbandingan promo per minat</b>' +
      '<select onchange="paGanti(\'minat\', this.value)" style="' + selCss + '">' + minatList.map(m => '<option value="' + kbEsc(m) + '"' + (m === PA.minat ? ' selected' : '') + '>' + kbEsc(m) + ' (' + kbRp(agg[m].spend) + ')</option>').join('') + '</select>' +
      '<span class="mkt-ikut-atas" style="font-size:12px; color:#475569;"></span>' +
    '</div>' +
    '<p style="font-size:11.5px; color:#64748b; margin:0 0 8px;">Satu iklan hanya masuk <b>satu</b> paket (kombinasi penawaran), jadi angka antar baris tidak tumpang tindih. Format, bukti, dan ajakan tampil sebagai label pendukung. Vonis memakai ambang dari ⚙️ Ambang: spend ≥ ' + kbRp(K.minSpend) + ', leads Meta ≥ ' + K.minRes + ', batas setara ±' + Math.round(K.band * 100) + '%. Rata-rata CPL ' + kbEsc(PA.minat) + ': ' + (cplMinat > 0 ? kbRp(cplMinat) : '-') + '.</p>' +
    (KB.master === null ? '<div style="background:#fef3c7; color:#92400e; padding:6px 10px; border-radius:6px; font-size:12px; margin-bottom:8px;">⚠️ Caption belum dimuat, sebagian iklan mungkin masuk "(Tanpa penawaran)". Klik 🔄 Refresh data.</div>' : '') +
    '<div class="table-responsive table-compact-wrap"><table style="width:100%;"><thead><tr style="background:#f1f5f9; font-size:11.5px;"><th style="text-align:left;">Paket penawaran</th><th>Iklan</th><th>Spend</th><th>Leads Meta</th><th>CPL Meta</th><th>CTR</th><th>Real CPL †</th><th>Leads CRM †</th><th>Closing †</th><th>vs rata-rata ' + kbEsc(PA.minat) + '</th></tr></thead><tbody>' + baris + '</tbody></table></div>' +
    '<p style="font-size:11px; color:#94a3b8; margin:4px 0 10px;">† Kumulatif sejak chat CTWA pertama, tidak mengikuti filter periode. Real CPL = spend periode atribusi ÷ leads CRM. Closing masih sedikit: vonis berdasarkan CPL Meta, bukan penjualan.</p>' +
    '<div style="border-top:1px dashed #cbd5e1; padding-top:10px;">' +
      '<div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;"><b style="font-size:13px;">Bandingkan</b>' +
        '<select onchange="paGanti(\'A\', this.value)" style="' + selCss + ' max-width:320px;">' + opsiAB(PA.A) + '</select><b>vs</b>' +
        '<select onchange="paGanti(\'B\', this.value)" style="' + selCss + ' max-width:320px;">' + opsiAB(PA.B) + '</select></div>' +
      (h ? '<div style="margin:8px 0; padding:9px 12px; background:#f8fafc; border-left:4px solid #6366f1; border-radius:6px; font-size:13px; line-height:1.6;">' + kbEsc(paKalimat_(PA.minat, PA.A, PA.B, h, K)) + '</div>' + bukti : '<p style="color:#94a3b8; font-size:12.5px;">Pilih dua paket berbeda.</p>') +
    '</div>' +
    '<div style="margin-top:10px;"><button type="button" class="mkt-btn" id="paBtnAi" onclick="paJalankanAI(this)" style="background:#4338ca; color:#fff;">🧠 Baca konteks promo dengan AI</button>' +
      '<span style="font-size:11.5px; color:#94a3b8; margin-left:8px;">AI membaca caption/headline dan menjelaskan arti penawaran. Vonis tetap dari aturan.</span></div>' + aiHtml
  );
}

function paGanti(k, v) {
  if (k === 'minat') { PA.minat = v; PA.A = ''; PA.B = ''; }
  else PA[k] = v;
  paRender();
}
function paLompatBandingkan(minat) {
  PA.minat = minat; PA.A = ''; PA.B = '';
  if (typeof mktBukaSub === 'function') mktBukaSub('promo');
}

// ------------------------------------------------------------ AI (konteks dari caption)
function paBangunPayload_() {
  const K = paK_();
  const agg = paAgregasi_(paKumpul_(PA.hari)), M = agg[PA.minat];
  if (!M) return null;
  const top = Object.values(M.pakets).sort((a, b) => b.spend - a.spend).slice(0, 6);
  const kode = {}; top.forEach((p, i) => { kode[p.kunci] = 'P' + (i + 1); });
  const potong = (t, n) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const pakets = top.map(p => ({
    kode: kode[p.kunci], label: p.kunci, label_pendukung: Object.keys(p.pendukung), n_iklan: p.n,
    spend: Math.round(p.spend), leads_meta: p.results, cpl_meta: p.cpl > 0 ? Math.round(p.cpl) : null,
    ctr_link_persen: Number(p.ctr.toFixed(2)),
    leads_crm_kumulatif: p.adaAtr ? p.leads : null, closing_kumulatif: p.adaAtr ? p.closing : null,
    teks_tersedia: p.ads.some(a => a.punyaTeks),
    contoh_iklan: p.contoh.map(a => ({ nama: potong(a.nama, 80), tipe: a.tipe || null, headline: potong(a.headline, 120) || null, caption: potong(a.caption, 500) || null }))
  }));
  const pembanding = [];
  const dasar = top.slice(0, 4);
  for (let i = 0; i < dasar.length; i++) for (let j = i + 1; j < dasar.length; j++) {
    const h = paBandingkan_(M.iklan, dasar[i].kunci, dasar[j].kunci, K);
    const d = h.pakai ? h.pakai.data : null;
    pembanding.push({
      a: kode[dasar[i].kunci], b: kode[dasar[j].kunci],
      vonis_aturan: !h.pakai ? 'belum_cukup_data' : (h.pakai.kode === 'A' ? 'a_lebih_murah' : (h.pakai.kode === 'B' ? 'b_lebih_murah' : 'setara')),
      tingkat_bukti: h.pakai ? h.pakai.tingkat : null, kekuatan_bukti: h.pakai ? h.pakai.kekuatan : null,
      unit_adset_atau_campaign: d ? d.unit : null,
      cpl_a: d && d.cplA !== null ? Math.round(d.cplA) : null, cpl_b: d && d.cplB !== null ? Math.round(d.cplB) : null,
      selisih_cpl_persen: d && d.selisih !== null ? Math.round(Math.abs(d.selisih)) : null,
      arah_berbeda_antar_tingkat: h.konflik
    });
  }
  return {
    minat: PA.minat, periode_hari: paLabelPeriode_(),
    ambang: { spend_min: K.minSpend, leads_meta_min: K.minRes, batas_setara_persen: Math.round(K.band * 100) },
    cpl_rata_minat: M.results > 0 ? Math.round(M.spend / M.results) : null,
    pakets: pakets, pembanding: pembanding
  };
}

async function paJalankanAI(btn) {
  if (PA.aiMemuat) return;
  const payload = paBangunPayload_();
  if (!payload || !payload.pakets.length) { alert('Belum ada paket untuk dianalisis.'); return; }
  const asli = btn ? btn.innerText : '';
  PA.aiMemuat = true;
  if (btn) { btn.disabled = true; btn.innerText = '⏳ AI membaca caption...'; }
  try {
    const fd = new FormData();
    fd.append('action', 'analisisPromoKonteks');
    fd.append('payloadJson', JSON.stringify(payload));
    const res = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
    if (!res || res.result !== 'success') throw new Error((res && res.message) || 'Handler analisisPromoKonteks belum dipasang di backend.');
    const peta = {}; payload.pakets.forEach(p => { peta[p.kode] = p.label; });
    const a = res.analisis || {};
    a.paket = (a.paket || []).map(p => Object.assign({}, p, { label: peta[p.kode] })).filter(p => p.label);
    a.angka_tak_terverifikasi = res.angka_tak_terverifikasi || [];
    PA.ai[PA.minat + '|' + paKunciPeriode_()] = a;
    paRender();
  } catch (e) {
    alert('❌ Analisis AI gagal: ' + (e && e.message ? e.message : e));
    if (btn) { btn.disabled = false; btn.innerText = asli; }
  } finally {
    PA.aiMemuat = false;
  }
}

// ------------------------------------------------------------ KAIT KE ptRender
(function () {
  const asli = window.ptRender;
  window.ptRender = function () {
    if (typeof asli === 'function') asli.apply(this, arguments);
    try { paRender(); kbIsiLabelAtas_(); } catch (e) { console.error('paRender gagal:', e); }
  };
})();
