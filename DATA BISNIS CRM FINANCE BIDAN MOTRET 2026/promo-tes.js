// =========================================================================
// promo-tes.js — Fase B: Kamus Promo (Lapis 1, aturan) + Papan Tes Promo
// Muat SETELAH konten-berjalan.js (memakai KB, kbHitung_, kbMuatData, dll).
//
// Aturan kamus: { pattern (regex, tanpa flag; selalu case-insensitive), label, jenis, aktif }
//  - jenis = 'format'  -> dicocokkan ke ad_name SAJA (poster/video/carousel/dst)
//  - jenis lain        -> dicocokkan ke headline + caption SAJA
//  Alasannya: ad_name memuat parameter tes (WINCON, CPL, tanggal) yang bukan promo.
// Sumber aturan: sheet DB_KamusPromo (getKamusPromo). Bila kosong/gagal, dipakai
// PROMO_SEED di bawah supaya tab langsung berfungsi; "Simpan" menulisnya ke sheet.
// =========================================================================

const PROMO_SEED = [
  // harga & diskon
  ['(mulai\\s*dari|start)\\s*(rp\\.?\\s*)?[\\d.,]+\\s*(jutaan|juta|jt|ribu|rb|k)\\b', 'Harga mulai dari', 'harga'],
  ['diskon\\s*(s/d|sd|hingga|sampai)?\\s*(rp\\.?\\s*)?[\\d.,]+\\s*(ribu|rb|k|jt|juta)', 'Diskon nominal', 'diskon'],
  ['(diskon|hemat)[^\\n]{0,40}\\(?\\d+\\s*%', 'Diskon persen', 'diskon'],
  ['\\d+\\s*%\\s*/\\s*\\d+\\s*%\\s*/\\s*\\d+\\s*%', 'Diskon bertingkat', 'diskon'],
  // bonus & gratis
  ['buy\\s*1\\s*get\\s*1', 'Buy 1 Get 1', 'bonus'],
  ['\\bbonus\\b', 'Bonus spesial', 'bonus'],
  ['free\\s*sesi', 'Free sesi keluarga/sibling', 'bonus'],
  ['(free|gratis)\\s*(transport|ongkir)', 'Gratis transport/ongkir', 'gratis'],
  ['newborn\\s*\\+\\s*handcasting', 'Bundling newborn + handcasting', 'bonus'],
  // DP & urgensi
  ['\\bdp\\s*(hanya\\s*)?(rp\\.?\\s*)?\\d+\\s*(k|rb|ribu)\\b', 'DP murah (nominal kecil)', 'dp'],
  ['keep\\s*harga', 'DP keep harga promo', 'dp'],
  ['cicil', 'DP boleh dicicil', 'dp'],
  ['sebelum\\s*harga\\s*naik|masa\\s*newborn\\s*lewat', 'Urgensi harga/waktu', 'urgensi'],
  // kepercayaan & ajakan
  ['\\d[\\d.]*\\s*\\+*\\s*sesi\\s*foto', 'Bukti: jumlah sesi', 'trust'],
  ['certified|full\\s*safety|seorang\\s*bidan', 'Otoritas bidan/safety', 'trust'],
  ['home\\s*service', 'Home service', 'layanan'],
  ['tulis\\s*komen', 'Ajakan komen asal kota', 'ajakan'],
  // program Bento
  ['program\\s*(bekal\\s*)?7\\s*hari', 'Program 7 Hari', 'program'],
  ['program\\s*(bekal\\s*)?14\\s*hari', 'Program 14 Hari', 'program'],
  ['program\\s*(bekal\\s*)?30\\s*hari', 'Program 30 Hari', 'program'],
  // format kreatif (dari ad_name)
  ['poster', 'Format: Poster', 'format'],
  ['carousel', 'Format: Carousel', 'format'],
  ['vid[ei]?o', 'Format: Video', 'format'],
  ['review', 'Video review', 'format'],
  ['masak', 'Video masak', 'format']
].map(a => ({ pattern: a[0], label: a[1], jenis: a[2], aktif: true }));

const PT = { kamus: null, sumber: '', err: '', rules: [] };

// ------------------------------------------------------------ KAMUS: muat & kompilasi
function ptKompilasi_(daftar) {
  const hasil = [];
  (daftar || []).forEach(r => {
    if (r.aktif === false || String(r.aktif).toUpperCase() === 'FALSE' || String(r.aktif) === '0') return;
    try { hasil.push({ re: new RegExp(r.pattern, 'i'), label: r.label, jenis: String(r.jenis || '').toLowerCase() }); } catch (e) { /* regex rusak: lewati */ }
  });
  return hasil;
}
async function ptMuatKamus(paksa) {
  if (PT.kamus && !paksa) return;
  try {
    const res = await fetchJsonAman(scriptURL + '?action=getKamusPromo');
    const arr = (res && (res.kamus || res.data)) || [];
    const rapi = arr.filter(r => r && r.pattern && (r.label_promo || r.label)).map(r => ({
      pattern: String(r.pattern), label: String(r.label_promo || r.label), jenis: String(r.jenis || ''),
      aktif: !(String(r.aktif).toUpperCase() === 'FALSE' || String(r.aktif) === '0' || r.aktif === false)
    }));
    if (rapi.length) { PT.kamus = rapi; PT.sumber = 'sheet'; PT.err = ''; }
    else { PT.kamus = PROMO_SEED.map(x => Object.assign({}, x)); PT.sumber = 'bawaan'; PT.err = ''; }
  } catch (e) {
    PT.kamus = PROMO_SEED.map(x => Object.assign({}, x)); PT.sumber = 'bawaan';
    PT.err = 'Kamus dari server gagal dimuat (' + (e && e.message ? e.message : e) + '); memakai aturan bawaan.';
  }
  PT.rules = ptKompilasi_(PT.kamus);
}

// Label untuk satu iklan (baris hasil kbHitung_). Kembalikan [{label, jenis}] tanpa duplikat.
function ptLabelIklan_(r, rules) {
  const m = r.m || {};
  const teksPromo = ((m.headline || '') + '\n' + (m.caption || '')).replace(/[ \t]+/g, ' ');
  const teksNama = String(r.nama || '');
  const ada = {}, out = [];
  (rules || PT.rules).forEach(x => {
    const uji = x.jenis === 'format' ? teksNama : teksPromo;
    if (uji && x.re.test(uji) && !ada[x.label]) { ada[x.label] = 1; out.push({ label: x.label, jenis: x.jenis }); }
  });
  return out;
}

// ------------------------------------------------------------ PAPAN TES PROMO
async function ptBukaSub() {
  ptIsiCampaign_();
  await ptMuatKamus(false);
  ptRender();
  await kbMuatData(false);
  ptRender();
}
async function ptRefresh(btn) {
  const asli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Memuat...'; }
  try {
    if (typeof tarikDataServer === 'function') await tarikDataServer();
    await kbMuatData(true);
    await ptMuatKamus(true);
    ptIsiCampaign_();
    ptRender();
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = asli; }
    if (typeof mktUpdateStamp === 'function') mktUpdateStamp();
  }
}
function ptIsiCampaign_() {
  const sel = $m('ptCampaign'); if (!sel) return;
  const peta = kbPetaCampaign_();
  const nama = [...new Set((dataContent || []).map(r => kbNamaCampaign_(r, peta)))].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="">Semua campaign</option>' + nama.map(n => `<option value="${kbEsc(n)}">${kbEsc(n)}</option>`).join('');
  if (nama.indexOf(cur) !== -1) sel.value = cur;
}
function ptFilter_() {
  return { berjalan: !!($m('ptBerjalan') || {}).checked, cari: '' };   // periode & campaign: filter atas
}

function ptStatusHtml_(kode) {
  const peta = {
    unggul: ['#ecfdf5', '#047857', '🟢 Unggul'],
    tertinggal: ['#fef2f2', '#b91c1c', '🔴 Tertinggal'],
    setara: ['#fffbeb', '#b45309', '🟡 Setara'],
    tunggu: ['#f1f5f9', '#64748b', '⚪ Belum cukup data']
  }[kode];
  return `<span style="background:${peta[0]}; color:${peta[1]}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; white-space:nowrap;">${peta[2]}</span>`;
}

function ptRender() {
  const tbody = $m('bPromoTes'), thead = $m('theadPromoTes'), info = $m('ptRingkas'), cat = $m('ptCatatan');
  if (!tbody || !thead) return;
  if (!PT.kamus) { tbody.innerHTML = '<tr><td style="padding:14px; color:#94a3b8;">Memuat kamus...</td></tr>'; return; }

  const iklan = kbHitung_(ptFilter_());
  const minSpend = ambilThreshold_('kontenMinSpendRp', 150000);
  const minImp = ambilThreshold_('kontenMinImpresi', 1000);
  const minRes = ambilThreshold_('promoMinResults', 5);
  const bandPersen = ambilThreshold_('promoBandPersen', 15) / 100;

  // Rata-rata pembanding = seluruh iklan pada filter (tiap iklan dihitung SEKALI)
  const T = iklan.reduce((s, r) => { s.spend += r.spend; s.results += r.results; return s; }, { spend: 0, results: 0 });
  const cplRata = T.results > 0 ? T.spend / T.results : 0;

  const grup = {};
  let tanpaCaption = 0, tanpaLabelPromo = [];
  iklan.forEach(r => {
    if (!r.m || !(r.m.caption || r.m.headline)) tanpaCaption++;
    const labels = ptLabelIklan_(r);
    const promoSaja = labels.filter(l => l.jenis !== 'format');
    const pakai = labels.slice();
    if (!promoSaja.length) { pakai.push({ label: '(Tanpa label promo)', jenis: 'kosong' }); tanpaLabelPromo.push(r); }
    pakai.forEach(l => {
      const g = grup[l.label] || (grup[l.label] = { label: l.label, jenis: l.jenis, n: 0, spend: 0, imp: 0, klik: 0, outbound: 0, results: 0, leads: 0, closing: 0, terbayar: 0, adaAtr: false, nama: [] });
      g.n++; g.spend += r.spend; g.imp += r.imp; g.klik += r.klik; g.outbound += r.outbound; g.results += r.results;
      if (r.leads !== null) { g.adaAtr = true; g.leads += r.leads; g.closing += r.closing; g.terbayar += r.terbayar; }
      if (g.nama.length < 8) g.nama.push(r.nama);
    });
  });

  const daftar = Object.values(grup).map(g => {
    g.cpl = g.results > 0 ? g.spend / g.results : 0;
    g.ctr = g.imp > 0 ? g.klik / g.imp * 100 : 0;
    const cukup = g.spend >= minSpend && g.imp >= minImp && g.results >= minRes && cplRata > 0;
    if (!cukup) g.status = 'tunggu';
    else if (g.cpl <= cplRata * (1 - bandPersen)) g.status = 'unggul';
    else if (g.cpl >= cplRata * (1 + bandPersen)) g.status = 'tertinggal';
    else g.status = 'setara';
    return g;
  }).sort((a, b) => (a.jenis === 'kosong') - (b.jenis === 'kosong') || String(a.jenis).localeCompare(b.jenis) || b.spend - a.spend);

  thead.innerHTML = ['Label promo', 'Jenis', 'Iklan', 'Spend', 'Impresi', 'Klik Link', 'Outbound', 'Results', 'CPL Meta', 'CTR (Link)', 'Leads CRM †', 'Closing †', 'Terbayar †', 'Status']
    .map((t, i) => `<th style="font-size:12px; ${i === 0 ? 'text-align:left;' : ''}">${t}</th>`).join('');

  if (!daftar.length) {
    tbody.innerHTML = '<tr><td colspan="14" style="padding:14px; color:#94a3b8;">Tidak ada iklan yang cocok dengan filter.</td></tr>';
  } else {
    const atr = (g, v, f) => g.adaAtr ? f(v) : '<span style="color:#cbd5e1;">-</span>';
    tbody.innerHTML = daftar.map(g => `
      <tr>
        <td style="text-align:left; font-weight:600;" title="${kbEsc(g.nama.join('\n'))}">${kbEsc(g.label)}</td>
        <td style="color:#64748b; font-size:11.5px;">${kbEsc(g.jenis === 'kosong' ? '-' : g.jenis)}</td>
        <td>${g.n}</td>
        <td>${kbRp(g.spend)}</td>
        <td>${kbInt(g.imp)}</td>
        <td>${kbInt(g.klik)}</td>
        <td>${kbInt(g.outbound)}</td>
        <td>${kbInt(g.results)}</td>
        <td>${g.cpl > 0 ? kbRp(g.cpl) : '-'}</td>
        <td>${kbPct(g.ctr)}</td>
        <td>${atr(g, g.leads, kbInt)}</td>
        <td>${atr(g, g.closing, kbInt)}</td>
        <td>${atr(g, g.terbayar, kbRp)}</td>
        <td>${ptStatusHtml_(g.status)}</td>
      </tr>`).join('');
  }

  if (info) info.textContent = iklan.length + ' iklan · CPL rata-rata pembanding ' + (cplRata > 0 ? kbRp(cplRata) : '-') +
    ' · vonis butuh spend ≥ ' + kbRp(minSpend) + ', impresi ≥ ' + kbInt(minImp) + ', results ≥ ' + minRes;
  if (cat) {
    const p = [];
    if (PT.err) p.push('⚠️ ' + PT.err);
    if (PT.sumber === 'bawaan') p.push('ℹ️ Memakai aturan bawaan (belum tersimpan di sheet DB_KamusPromo). Buka "Kamus Promo" lalu Simpan agar tersimpan.');
    if (tanpaCaption) p.push('⚠️ ' + tanpaCaption + ' iklan belum punya caption di Ad_Creative_Master, jadi hanya bisa dilabeli dari nama (format). Jalankan syncCreativeMasterSemua().');
    if (KB.errMaster) p.push('⚠️ Master kreatif gagal dimuat: ' + KB.errMaster);
    cat.innerHTML = p.map(kbEsc).join('<br>');
    cat.style.display = p.length ? 'block' : 'none';
  }
}

// ------------------------------------------------------------ MODAL KAMUS
let PT_EDIT = [];

function ptBukaKamus() {
  if (!PT.kamus) { ptMuatKamus(false).then(ptBukaKamus); return; }
  PT_EDIT = PT.kamus.map(x => Object.assign({}, x));
  let ov = $m('ptOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ptOverlay';
    ov.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,.55); z-index:1000; display:flex; align-items:flex-start; justify-content:center; padding:24px 12px; overflow:auto;';
    document.body.appendChild(ov);
  }
  ov.style.display = 'flex';
  ptRenderKamus_();
}
function ptTutupKamus() { const ov = $m('ptOverlay'); if (ov) ov.style.display = 'none'; }

function ptSemuaIklan_() { return kbHitung_({ semua: true, berjalan: false, cari: '' }); }

// ------------------------------------------------------------ KAMUS PROMO (tampilan awam)
// Jenis (nilai disimpan di sheet) -> nama yang mudah dibaca + kelompoknya. Nilai jenis TIDAK berubah.
// Kelompok 'filter' = TP_FILTER dan 'bukti' = TP_PENDUKUNG di tes-penawaran.js; jaga tetap sama.
const PT_JENIS = [
  ['diskon', 'Diskon', 'insentif'], ['bonus', 'Bonus / free', 'insentif'], ['gratis', 'Gratis', 'insentif'],
  ['program', 'Program / paket', 'insentif'], ['promo', 'Promo lain', 'insentif'],
  ['harga', 'Harga yang tertulis', 'filter'], ['dp', 'DP / cara bayar', 'filter'], ['layanan', 'Layanan', 'filter'],
  ['lokasi', 'Lokasi / area', 'filter'], ['usia', 'Usia bayi / syarat usia', 'filter'],
  ['urgensi', 'Batas waktu / urgensi', 'bukti'], ['trust', 'Pembuktian / kepercayaan', 'bukti'], ['ajakan', 'Ajakan bertindak', 'bukti'],
  ['format', 'Bentuk iklan (dari nama iklan)', 'format']
];
const PT_GRUP = [
  { id: 'insentif', judul: '🎁 Penawaran (insentif)', jenisBaru: 'diskon', ket: 'Alasan orang tertarik: diskon, bonus, gratis, program. Inilah yang dibandingkan di Papan Tes Promo.' },
  { id: 'filter', judul: '🔎 Filter calon pelanggan', jenisBaru: 'harga', ket: 'Informasi yang menyaring orang sebelum chat: harga, DP, area layanan. Bukan insentif.' },
  { id: 'bukti', judul: '💬 Pembuktian dan ajakan', jenisBaru: 'trust', ket: 'Pendukung: kepercayaan, batas waktu, ajakan komen. Bukan penawaran.' },
  { id: 'format', judul: '🎬 Bentuk iklan', jenisBaru: 'format', ket: 'Dibaca dari NAMA iklan (video, poster, carousel), bukan dari caption.' },
  { id: 'lain', judul: '❔ Belum dikelompokkan', jenisBaru: '', ket: 'Jenisnya kosong atau tidak dikenal. Pilih jenis agar masuk kelompok yang tepat.' }
];
let PT_UJI_TEKS = '';

function ptJenisKe_(j) { const k = String(j || '').toLowerCase().trim(); return PT_JENIS.find(x => x[0] === k) || null; }
function ptGrupDari_(j) { const f = ptJenisKe_(j); return f ? f[2] : 'lain'; }

// Pola regex sederhana -> daftar kata/frasa. null bila polanya lanjutan (grup, angka, variasi ejaan).
function ptPolaKeKata_(p) {
  const s0 = String(p || '');
  if (!s0.trim()) return [];
  const s = s0.replace(/\\b/g, '').replace(/\\s\*/g, ' ').replace(/\\([-/])/g, '$1').replace(/\\\+/g, '\uE000').replace(/\\\./g, '\uE001');
  const bagian = s.split('|').map(x => x.replace(/\s+/g, ' ').trim());
  if (bagian.some(x => !x || /[\\\[\](){}?*^$+.]/.test(x))) return null;
  return bagian.map(x => x.replace(/\uE000/g, '+').replace(/\uE001/g, '.'));
}
// Daftar kata (dipisah koma) -> pola regex. Spasi jadi \s*; kata alfanumerik pendek diberi batas kata.
function ptKataKePola_(teks) {
  return String(teks || '').split(',').map(w => w.replace(/\s+/g, ' ').trim()).filter(Boolean).map(w => {
    const e = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
    return /^[a-z0-9]{1,5}$/i.test(w) ? '\\b' + e + '\\b' : e;
  }).join('|');
}

function ptUji(teks) {
  PT_UJI_TEKS = teks;
  const out = $m('ptUjiHasil'); if (!out) return;
  const t = String(teks || '').trim();
  if (!t) { out.innerHTML = '<span style="color:#94a3b8;">Tempel headline atau caption iklan di atas untuk melihat penawaran apa yang dikenali.</span>'; return; }
  const rules = ptKompilasi_(PT_EDIT).filter(x => x.jenis !== 'format');
  const kena = [], ada = {};
  rules.forEach(x => { if (x.re.test(t) && !ada[x.label]) { ada[x.label] = 1; kena.push(x); } });
  out.innerHTML = kena.length
    ? kena.map(x => `<span style="display:inline-block; margin:2px 4px 2px 0; padding:2px 9px; border-radius:99px; background:#eef2ff; color:#4338ca; font-weight:700; font-size:12px;">${kbEsc(x.label)}</span>`).join('')
    : '<span style="color:#b45309;">Tidak ada yang dikenali. Iklan seperti ini dikelompokkan sebagai "(Tanpa penawaran)" bila AI juga belum membacanya.</span>';
}

function ptRenderKamus_() {
  const ov = $m('ptOverlay'); if (!ov) return;
  const iklan = ptSemuaIklan_();
  const rules = ptKompilasi_(PT_EDIT);
  const dilabeli = iklan.map(r => ptLabelIklan_(r, rules));
  const hitung = PT_EDIT.map(x => {
    let re = null; try { re = new RegExp(x.pattern, 'i'); } catch (e) { return -1; }
    if (!String(x.pattern || '').trim()) return 0;
    let c = 0;
    iklan.forEach(r => {
      const m = r.m || {};
      const uji = String(x.jenis).toLowerCase() === 'format' ? String(r.nama || '') : (m.headline || '') + '\n' + (m.caption || '');
      if (uji && re.test(uji)) c++;
    });
    return c;
  });
  const belum = iklan.filter((r, i) => !dilabeli[i].some(l => l.jenis !== 'format'));

  // kalimat bernuansa promo yang belum dikenali aturan mana pun
  const kataPromo = /diskon|promo|gratis|free|bonus|hemat|cashback|voucher|potongan|\d+\s*(rb|ribu|jt|juta|%)/i;
  const saran = {};
  iklan.forEach(r => {
    const m = r.m || {};
    ((m.headline || '') + '\n' + (m.caption || '')).split('\n').forEach(b => {
      const t = b.trim();
      if (t.length < 6 || t.length > 140 || !kataPromo.test(t)) return;
      if (rules.some(x => x.jenis !== 'format' && x.re.test(t))) return;
      saran[t] = (saran[t] || 0) + 1;
    });
  });
  const saranList = Object.keys(saran).sort((a, b) => saran[b] - saran[a]).slice(0, 12);

  const inp = 'padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12.5px; width:100%; box-sizing:border-box;';
  const kartu = i => {
    const x = PT_EDIT[i], kata = ptPolaKeKata_(x.pattern), sederhana = kata !== null;
    const jenisSaatIni = String(x.jenis || '').toLowerCase().trim();
    const opsi = PT_JENIS.map(j => `<option value="${j[0]}" ${jenisSaatIni === j[0] ? 'selected' : ''}>${j[1]}</option>`).join('') +
      (ptJenisKe_(x.jenis) ? '' : `<option value="${kbEsc(x.jenis || '')}" selected>${kbEsc(x.jenis || '(pilih jenis)')}</option>`);
    const nilaiKata = x._kata !== undefined ? x._kata : (sederhana ? kata.join(', ') : '');
    const kolomKata = sederhana
      ? `<input data-pt="${i}:kata" style="${inp}" placeholder="kata atau frasa, pisahkan dengan koma" value="${kbEsc(nilaiKata)}" oninput="ptEdit(${i},'kata',this.value)">
         <div style="font-size:10.5px; color:#94a3b8; margin-top:2px;">Cocok bila iklan menyebut salah satu kata ini.</div>`
      : `<input data-pt="${i}:pattern" style="${inp} font-family:monospace;" value="${kbEsc(x.pattern)}" oninput="ptEdit(${i},'pattern',this.value)">
         <div style="font-size:10.5px; color:#b45309; margin-top:2px;">Pola lanjutan (mengenali angka atau variasi ejaan). Ubah hanya bila paham regex.</div>`;
    const jml = hitung[i] < 0 ? '<span style="color:#b91c1c; font-weight:700;">pola salah</span>'
      : hitung[i] === 0 ? '<span style="color:#94a3b8;">belum ada iklan</span>' : '<b>' + hitung[i] + '</b> iklan';
    return `<div style="display:grid; grid-template-columns:22px minmax(150px,1.1fr) minmax(220px,2fr) minmax(150px,.9fr) 84px 30px; gap:8px; align-items:start; padding:8px 0; border-bottom:1px solid #f1f5f9; ${x.aktif === false ? 'opacity:.55;' : ''}">
      <input type="checkbox" title="Aktif" ${x.aktif === false ? '' : 'checked'} onchange="ptEdit(${i},'aktif',this.checked)" style="margin-top:8px;">
      <div><input data-pt="${i}:label" style="${inp} font-weight:600;" placeholder="Nama, mis. DP murah" value="${kbEsc(x.label)}" oninput="ptEdit(${i},'label',this.value)"></div>
      <div>${kolomKata}</div>
      <select data-pt="${i}:jenis" style="${inp}" onchange="ptEdit(${i},'jenis',this.value)">${opsi}</select>
      <div style="font-size:12px; color:#475569; margin-top:7px;">${jml}</div>
      <button type="button" class="mkt-btn" title="Hapus aturan" onclick="ptHapusBaris(${i})">✕</button>
    </div>`;
  };

  const bagianGrup = PT_GRUP.map(g => {
    const idx = PT_EDIT.map((x, i) => i).filter(i => ptGrupDari_(PT_EDIT[i].jenis) === g.id);
    if (!idx.length && g.id === 'lain') return '';
    return `<div style="margin-top:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <div><b style="font-size:13.5px;">${g.judul}</b> <span style="font-size:11.5px; color:#94a3b8;">(${idx.length})</span>
          <div style="font-size:11.5px; color:#64748b;">${g.ket}</div></div>
        ${g.jenisBaru ? `<button type="button" class="mkt-btn" onclick="ptTambahBaris('${g.jenisBaru}')">＋ Tambah</button>` : ''}
      </div>
      <div style="margin-top:4px;">${idx.length ? idx.map(kartu).join('') : '<div style="font-size:12px; color:#94a3b8; padding:8px 0;">Belum ada aturan di kelompok ini.</div>'}</div></div>`;
  }).join('');

  ov.innerHTML = `
  <div style="background:#fff; border-radius:12px; max-width:1020px; width:100%; padding:16px 18px; box-shadow:0 20px 50px rgba(0,0,0,.3);">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <b style="font-size:16px;">📖 Kamus Promo</b>
      <button type="button" class="mkt-btn" onclick="ptTutupKamus()">Tutup</button>
    </div>
    <div style="font-size:12.5px; color:#334155; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:9px 12px; line-height:1.55;">
      <b>Untuk apa kamus ini?</b> Daftar kata yang menandakan sebuah penawaran. Contoh: bila caption menyebut <i>free sesi</i>, iklan diberi nama penawaran
      <i>Free sesi keluarga/sibling</i>.<br>
      AI sudah membaca arti penawaran dari caption iklan. Kamus ini hanya <b>cadangan</b> untuk iklan yang belum dibaca AI atau belum punya caption.
      Satu iklan boleh cocok dengan beberapa aturan. Kelompok <b>🎁 Penawaran</b> yang membedakan promo di Papan Tes Promo;
      <b>🔎 Filter</b> dan <b>💬 Pembuktian</b> hanya pendukung.
    </div>
    <div style="margin-top:12px; border:1px dashed #c7d2fe; border-radius:8px; padding:9px 12px; background:#fafaff;">
      <b style="font-size:13px;">🧪 Coba kalimat</b> <span style="font-size:11.5px; color:#64748b;">Tempel caption untuk melihat aturan mana yang mengenalinya (sebelum disimpan).</span>
      <textarea id="ptUjiTeks" rows="2" style="${inp} margin-top:6px;" placeholder="Mis. Booking newborn cukup DP 100rb, free sesi keluarga!" oninput="ptUji(this.value)">${kbEsc(PT_UJI_TEKS)}</textarea>
      <div id="ptUjiHasil" style="margin-top:6px; font-size:12.5px;"></div>
    </div>
    <div style="overflow-x:auto;">${bagianGrup}</div>
    <div style="margin:12px 0; display:flex; gap:8px; flex-wrap:wrap;">
      <button type="button" class="mkt-btn" onclick="ptSimpanKamus(this)" style="background:#4f46e5; color:#fff;">💾 Simpan ke sheet</button>
      <span id="ptSimpanStatus" style="font-size:12px; align-self:center; color:#64748b;"></span>
    </div>
    <div style="border-top:1px solid #e2e8f0; padding-top:10px; display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px;">
      <div><b style="font-size:13px;">Iklan yang belum dikenali kamus (${belum.length})</b>
        <div style="font-size:11.5px; color:#94a3b8;">Wajar bila AI sudah membacanya. Daftar ini hanya relevan untuk cadangan.</div>
        <div style="font-size:12px; color:#475569; max-height:180px; overflow:auto; margin-top:4px;">
        ${belum.length ? belum.slice(0, 30).map(r => '• ' + kbEsc(r.nama)).join('<br>') : '<span style="color:#047857;">Semua iklan sudah dikenali kamus. 🎉</span>'}</div></div>
      <div><b style="font-size:13px;">Kalimat bernuansa promo yang belum dikenali (${saranList.length})</b>
        <div style="font-size:11.5px; color:#94a3b8;">Klik "+ aturan" untuk menjadikannya aturan baru.</div>
        <div style="font-size:12px; color:#475569; max-height:180px; overflow:auto; margin-top:4px;">
        ${saranList.length ? saranList.map(s => `• ${kbEsc(s)} <span style="color:#94a3b8;">(${saran[s]}×)</span> <a href="#" onclick="ptTambahDariSaran(${JSON.stringify(s).replace(/"/g, '&quot;')});return false;">+ aturan</a>`).join('<br>') : '<span style="color:#94a3b8;">Tidak ada.</span>'}</div></div>
    </div>
  </div>`;
  ptUji(PT_UJI_TEKS);
}

function ptEdit(i, k, v) {
  const x = PT_EDIT[i]; if (!x) return;
  if (k === 'kata') { x._kata = v; x.pattern = ptKataKePola_(v); }
  else if (k === 'pattern') { x.pattern = v; delete x._kata; }
  else x[k] = v;
  if (k === 'label') return;   // nama tidak memengaruhi hitungan
  clearTimeout(ptEdit._t);
  ptEdit._t = setTimeout(() => {
    const a = document.activeElement, id = a && a.getAttribute ? a.getAttribute('data-pt') : null, pos = a && a.selectionStart;
    ptRenderKamus_();
    if (id) { const el = document.querySelector('#ptOverlay [data-pt="' + id + '"]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } }
  }, 500);
}
function ptTambahBaris(jenis) { PT_EDIT.push({ pattern: '', label: '', jenis: jenis || 'diskon', aktif: true }); ptRenderKamus_(); }
function ptHapusBaris(i) { PT_EDIT.splice(i, 1); ptRenderKamus_(); }
function ptEscRegex_(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function ptTambahDariSaran(teks) {
  const inti = teks.replace(/[^\p{L}\p{N}\s%+/.,-]/gu, '').trim().replace(/\s+/g, ' ');
  PT_EDIT.push({ pattern: ptEscRegex_(inti).replace(/\s+/g, '\\s*'), label: inti.slice(0, 40), jenis: 'promo', aktif: true });
  ptRenderKamus_();
}

async function ptSimpanKamus(btn) {
  const st = $m('ptSimpanStatus');
  const bersih = PT_EDIT.filter(x => String(x.pattern || '').trim() && String(x.label || '').trim());
  for (const x of bersih) { try { new RegExp(x.pattern, 'i'); } catch (e) { if (st) { st.style.color = '#b91c1c'; st.textContent = 'Regex salah: ' + x.pattern; } return; } }
  if (!bersih.length) { if (st) { st.style.color = '#b91c1c'; st.textContent = 'Tidak ada aturan untuk disimpan.'; } return; }
  if (!confirm('Simpan ' + bersih.length + ' aturan ke sheet DB_KamusPromo? Isi sheet lama akan diganti dengan daftar ini.')) return;
  const asli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Menyimpan...'; }
  try {
    const fd = new FormData();
    fd.append('action', 'saveKamusPromo');
    fd.append('rulesJson', JSON.stringify(bersih.map(x => ({ pattern: x.pattern.trim(), label_promo: x.label.trim(), jenis: String(x.jenis || '').trim(), aktif: x.aktif !== false }))));
    const res = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
    if (res && res.result === 'success') {
      PT.kamus = bersih.map(x => ({ pattern: x.pattern.trim(), label: x.label.trim(), jenis: String(x.jenis || '').trim(), aktif: x.aktif !== false }));
      PT.sumber = 'sheet'; PT.rules = ptKompilasi_(PT.kamus);
      if (st) { st.style.color = '#047857'; st.textContent = '✅ Tersimpan (' + bersih.length + ' aturan).'; }
      ptRender();
    } else if (st) { st.style.color = '#b91c1c'; st.textContent = '❌ ' + ((res && res.message) || 'Gagal menyimpan. Pastikan handler saveKamusPromo sudah dipasang di Code.gs.'); }
  } catch (e) {
    if (st) { st.style.color = '#b91c1c'; st.textContent = '❌ Gagal koneksi: ' + e; }
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = asli; }
  }
}

// mode PDF: modal tidak ikut; tabel tetap
(function () {
  const st = document.createElement('style');
  st.textContent = ' #tblPromoTes td, #tblPromoTes th{padding:6px 8px; text-align:right;} #tblPromoTes td:first-child, #tblPromoTes th:first-child{text-align:left;}';
  document.head.appendChild(st);
})();
