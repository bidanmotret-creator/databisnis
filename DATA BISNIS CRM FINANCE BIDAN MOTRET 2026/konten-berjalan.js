// =========================================================================
// konten-berjalan.js — Sub-menu "🎬 Konten Berjalan" (Fase A: A1-A4)
// Muat SETELAH mkt-extra.js dan SEBELUM api-marketing.js.
//
// Sumber data:
//  - dataContent  (global, dari getData)  -> metrik harian per ad_id
//  - getAdCreativeMaster (lazy)           -> caption, headline, CTA, status, thumbnail Drive
//  - getAtribusiLeads    (lazy)           -> leads CRM, closing, DP, terbayar per ad_id
//
// Bentuk JSON dua endpoint di atas dibaca lewat ADAPTER di bagian atas
// (kbBacaMaster_ / kbBacaAtribusi_). Kalau nama field di server berbeda,
// cukup ubah daftar nama di adapter itu, bagian lain tidak perlu disentuh.
// =========================================================================

const KB = {
  master: null,          // { [ad_id]: {caption, headline, cta, status, thumbId, ...} }
  atribusi: null,        // { [ad_id]: {leads, ctwa, closing, dp, terbayar} }
  atribusiSince: null,   // kunci cache atribusi (since yang dipakai saat fetch)
  memuat: false,
  analisis: null,        // { [ad_id]: {rekom, aspek, alasan, saran, promo, periode, waktu} } dari DB_AnalisisKonten
  errMaster: '', errAtribusi: '', errAnalisis: '',
  aiBerjalan: false,
  urut: { k: 'spend', d: -1 },
  buka: {},              // ad_id -> true kalau baris detail terbuka
  hasil: []              // baris hasil agregasi terakhir (untuk sort/render ulang)
};

// ------------------------------------------------------------ UTIL
const kbEsc = s => (typeof mktEsc === 'function' ? mktEsc(s)
  : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const kbNum = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const kbRp = n => 'Rp ' + Math.round(kbNum(n)).toLocaleString('id-ID');
const kbInt = n => Math.round(kbNum(n)).toLocaleString('id-ID');
const kbPct = n => kbNum(n).toFixed(2).replace('.', ',') + '%';
const kbTgl = t => (typeof formati === 'function' ? formati(t) : String(t || '').slice(0, 10));
function kbAmbil(o, nama, def) {
  if (!o) return def;
  for (const n of nama) if (o[n] !== undefined && o[n] !== null && o[n] !== '') return o[n];
  return def;
}
function kbTglLokal(d) {
  const p = x => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function kbHariLalu(n) { const d = new Date(); d.setDate(d.getDate() - n); return kbTglLokal(d); }

// ------------------------------------------------------------ ADAPTER RESPON SERVER
function kbDaftarDari_(res, kunciKandidat) {
  if (!res) return [];
  let x = res;
  for (const k of kunciKandidat) { if (res[k] !== undefined) { x = res[k]; break; } }
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') {
    return Object.keys(x).map(k => { const v = x[k]; return (v && typeof v === 'object') ? Object.assign({ ad_id: k }, v) : null; }).filter(Boolean);
  }
  return [];
}
function kbBacaMaster_(res) {
  const peta = {};
  kbDaftarDari_(res, ['data', 'master', 'rows', 'items']).forEach(r => {
    const id = String(kbAmbil(r, ['ad_id', 'adId', 'id'], '')).trim();
    if (!id) return;
    peta[id] = {
      caption: kbAmbil(r, ['caption', 'body', 'body_lengkap'], ''),
      headline: kbAmbil(r, ['headline', 'title'], ''),
      cta: kbAmbil(r, ['cta_type', 'cta', 'call_to_action'], ''),
      status: String(kbAmbil(r, ['effective_status', 'status'], '')).toUpperCase(),
      thumbId: kbAmbil(r, ['thumbnail_drive_id', 'thumb_id'], ''),
      tipe: String(kbAmbil(r, ['creative_type', 'tipe'], '')).toUpperCase()
    };
  });
  return peta;
}

function kbBacaAtribusi_(res) {
  const peta = {};
  const daftar = (res && res.data && (res.data.per_iklan || res.data.perIklan)) ||
                 (res && (res.per_iklan || res.perIklan)) || [];
  (Array.isArray(daftar) ? daftar : []).forEach(r => {
    const id = String(r.ad_id || '').trim();
    if (!id) return;
    // Iklan yang chat-nya tidak masuk CRM ini (mis. Bento): tidak diberi entri,
    // sehingga leads/closing/ROAS tampil "-" dan bukan 0 palsu.
    if (r.terlacak === false) return;
    peta[id] = {
      leads: kbNum(r.leadA),
      ctwa: kbNum(r.leadA),
      closing: kbNum(r.closing),
      dp: 0,
      terbayar: kbNum(r.terbayar),
      omzet: kbNum(r.omzet),
      spend: kbNum(r.spend),          // spend pada periode atribusi yang sama
      real_cpl: r.real_cpl === undefined ? null : r.real_cpl,
      kebocoran: r.kebocoran === undefined ? null : r.kebocoran,
      status: Array.isArray(r.status) ? r.status : []
    };
  });
  return peta;
}

function kbBacaAnalisis_(res) {
  const peta = {};
  ((res && res.rows) || []).forEach(r => {
    const id = String(r.ad_id || '').trim();
    if (!id) return;
    let promo = [];
    try { promo = JSON.parse(r.promo_json || '[]'); } catch (e) { promo = []; }
    peta[id] = { rekom: String(r.rekomendasi || ''), aspek: String(r.aspek_revisi || ''), alasan: String(r.alasan || ''),
      saran: String(r.saran_tes || ''), promo: Array.isArray(promo) ? promo : [], periode: String(r.periode_metrik || ''), waktu: String(r.dianalisis_pada || '') };
  });
  return peta;
}

// ------------------------------------------------------------ A1: PEMUATAN LAZY
function kbPeriodeHari_() {
  const v = ($m('kbPeriode') || {}).value || '14';
  return v === 'semua' ? 0 : Number(v);
}
// Web App Apps Script kadang membalas 404 HTML secara sporadis; coba ulang sekali sebelum menyerah
async function kbFetchUlang_(url) {
  try { return await fetchJsonAman(url); }
  catch (e1) { await new Promise(r => setTimeout(r, 1500)); return await fetchJsonAman(url); }
}

async function kbMuatData(paksa) {
  if (KB.memuat) return;
  const hari = kbPeriodeHari_();
  const since = ''; // perAd dari server kumulatif sejak CTWA pertama (since hanya memengaruhi perHari)
  const perluMaster = paksa || KB.master === null;
  const perluAtribusi = paksa || KB.atribusi === null;
  const perluAnalisis = paksa || KB.analisis === null;
  if (!perluMaster && !perluAtribusi && !perluAnalisis) return;

  KB.memuat = true;
  kbSetStatus_('⏳ Memuat data konten & atribusi...');
  try {
    const [m, a, g] = await Promise.allSettled([
      perluMaster ? kbFetchUlang_(scriptURL + '?action=getAdCreativeMaster') : Promise.resolve(null),
           perluAtribusi ? kbFetchUlang_(scriptURL + '?action=getFunnelMarketing&since=2000-01-01') : Promise.resolve(null),
      perluAnalisis ? kbFetchUlang_(scriptURL + '?action=getAnalisisKonten') : Promise.resolve(null)
    ]);
    if (perluMaster) {
      if (m.status === 'fulfilled' && m.value) { KB.master = kbBacaMaster_(m.value); KB.errMaster = ''; }
      else { KB.errMaster = m.reason ? String(m.reason.message || m.reason) : 'respon kosong'; }
    }
    if (perluAtribusi) {
      if (a.status === 'fulfilled' && a.value) { KB.atribusi = kbBacaAtribusi_(a.value); KB.atribusiSince = since; KB.errAtribusi = ''; }
      else { KB.errAtribusi = a.reason ? String(a.reason.message || a.reason) : 'respon kosong'; }
    }
    if (perluAnalisis) {
      if (g.status === 'fulfilled' && g.value && g.value.result === 'success') { KB.analisis = kbBacaAnalisis_(g.value); KB.errAnalisis = ''; }
      else { KB.errAnalisis = g.reason ? String(g.reason.message || g.reason) : ((g.value && g.value.message) || 'endpoint getAnalisisKonten belum dipasang'); }
    }
  } finally {
    KB.memuat = false;
    kbSetStatus_('');
  }
}

function kbSetStatus_(t) { const el = $m('kbStatusMuat'); if (el) el.textContent = t; }

async function kbBukaSub() {
  kbIsiFilterCampaign_();
  kbRender();                  // tampil cepat dari dataContent dulu
  await kbMuatData(false);     // lalu lengkapi master + atribusi
  kbRender();
}
async function kbRefresh(btn) {
  const asli = btn ? btn.innerText : '';
  if (btn) { btn.disabled = true; btn.innerText = '⏳ Memuat...'; }
  try {
    if (typeof tarikDataServer === 'function') await tarikDataServer();
    await kbMuatData(true);
    kbIsiFilterCampaign_();
    kbRender();
  } finally {
    if (btn) { btn.disabled = false; btn.innerText = asli; }
    if (typeof mktUpdateStamp === 'function') mktUpdateStamp();
  }
}
async function kbJalankanAnalisis(btn, paksa) {
  if (KB.aiBerjalan) return;
  KB.aiBerjalan = true;
  const asli = btn ? btn.innerText : '';
  const st = $m('kbAiProgress');
  const hari = kbPeriodeHari_() || 14;   // 'semua' -> 14 (analisis butuh jendela tetap)
  if (btn) btn.disabled = true;
  let putaran = 0, terakhir = null;
  try {
    while (putaran < 12) {
      putaran++;
      if (st) st.textContent = '⏳ Menganalisis...' + (terakhir ? ' ' + terakhir.selesai + '/' + terakhir.total : '');
      const fd = new FormData();
      fd.append('action', 'analisisRekomendasiKontenWeb');
      fd.append('hari', String(hari));
      if (paksa && putaran === 1) fd.append('force', 'true');
      const res = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
      if (!res || res.result !== 'success') { if (st) { st.style.color = '#b91c1c'; st.textContent = '❌ ' + ((res && res.message) || 'Gagal. Pastikan handler analisisRekomendasiKontenWeb sudah dipasang di Code.gs.'); } return; }
      terakhir = res;
      if (res.gagal && res.gagal.length) { if (st) { st.style.color = '#b91c1c'; st.textContent = '⚠️ Berhenti di ' + res.selesai + '/' + res.total + ': ' + res.gagal[0]; } break; }
      if (res.sisa === 0) break;
      if (res.dianalisis_run_ini === 0) break;   // tidak ada kemajuan: hindari loop tanpa akhir
    }
    KB.analisis = null; await kbMuatData(false); kbRender();
    if (st && terakhir && !(terakhir.gagal && terakhir.gagal.length)) {
      st.style.color = terakhir.sisa === 0 ? '#047857' : '#b45309';
      st.textContent = (terakhir.sisa === 0 ? '✅ ' : '⚠️ ') + terakhir.selesai + '/' + terakhir.total + ' iklan selesai' + (terakhir.sisa ? ' (klik lagi untuk melanjutkan)' : '') + (terakhir.catatan ? ' · ' + terakhir.catatan : '');
    }
  } catch (e) {
    if (st) { st.style.color = '#b91c1c'; st.textContent = '❌ Gagal koneksi: ' + e; }
  } finally {
    KB.aiBerjalan = false;
    if (btn) { btn.disabled = false; btn.innerText = asli; }
  }
}

async function kbGantiFilter(periodeBerubah) {
  kbRender();
  if (periodeBerubah) { await kbMuatData(false); kbRender(); }
}

// ------------------------------------------------------------ AGREGASI
function kbPetaCampaign_() {
  try { return buatPetaCampaignName(dataAdsetPerformance, dataAdsetCityTargeting) || {}; } catch (e) { return {}; }
}
function kbNamaCampaign_(row, peta) {
  return peta[String(row.campaign_id || '').trim()] || row.campaign_name || ('Campaign #' + row.campaign_id);
}
function kbIsiFilterCampaign_() {
  const sel = $m('kbCampaign'); if (!sel) return;
  const peta = kbPetaCampaign_();
  const nama = [...new Set((dataContent || []).map(r => kbNamaCampaign_(r, peta)))].sort();
  const cur = sel.value;
  sel.innerHTML = '<option value="">Semua campaign</option>' + nama.map(n => `<option value="${kbEsc(n)}">${kbEsc(n)}</option>`).join('');
  if (nama.indexOf(cur) !== -1) sel.value = cur;
}

function kbHitung_(f) {   // f (opsional): {campaign, hari, berjalan, cari} menggantikan kontrol tab Konten
  const peta = kbPetaCampaign_();
  const hari = f ? f.hari : kbPeriodeHari_();
  const batasAwal = hari ? kbHariLalu(hari) : '';
  const batasBerjalan = kbHariLalu(3);
  const fCamp = f ? f.campaign : (($m('kbCampaign') || {}).value || '');
  const fCari = f ? String(f.cari || '').toLowerCase() : String(($m('kbCari') || {}).value || '').trim().toLowerCase();
  const hanyaBerjalan = f ? !!f.berjalan : !!($m('kbBerjalan') || {}).checked;
  const minSpend = ambilThreshold_('kontenMinSpendRp', 150000);
  const minImp = ambilThreshold_('kontenMinImpresi', 1000);

  const agg = {};
  (dataContent || []).forEach(r => {
    const id = String(r.ad_id || '').trim();
    if (!id) return;
    const tgl = kbTgl(r.tanggal);
    const camp = kbNamaCampaign_(r, peta);
    if (fCamp && camp !== fCamp) return;
    const a = agg[id] || (agg[id] = {
      id, nama: r.ad_name || '(tanpa nama)', campaign: camp, tipeRow: String(r.creative_type || '').toUpperCase(),
      spendSemua: 0, spend: 0, imp: 0, klik: 0, outbound: 0, results: 0, v3s: 0, thru: 0, frekBobot: 0, spend3h: 0
    });
    a.spendSemua += kbNum(r.spend);                               // untuk ROAS (atribusi kumulatif)
    if (tgl >= batasBerjalan) a.spend3h += kbNum(r.spend);        // untuk definisi "berjalan" (tidak ikut filter periode)
    if (batasAwal && tgl < batasAwal) return;
    a.spend += kbNum(r.spend);
    a.imp += kbNum(r.impressions);
    a.klik += kbNum(r.link_clicks);
    a.outbound += kbNum(r.outbound_clicks);
    a.results += kbNum(r.results);
    a.v3s += kbNum(r.video_3s);
    a.thru += kbNum(r.video_thruplay);
    a.frekBobot += kbNum(r.frequency) * kbNum(r.impressions);
  });

  const out = [];
  Object.values(agg).forEach(a => {
    const m = (KB.master && KB.master[a.id]) || null;
    const statusMeta = m ? m.status : '';
    const statusDiketahui = !!(m && statusMeta);
    const aktif = statusDiketahui ? statusMeta === 'ACTIVE' : null;   // null = belum diketahui
    const berjalan = a.spend3h > 0 && aktif !== false;
    if (hanyaBerjalan && !berjalan) return;
    if (!hanyaBerjalan && a.spend <= 0) return;
    if (hanyaBerjalan && a.spend <= 0 && a.imp <= 0) { /* berjalan tapi belum ada data di periode: tetap tampil */ }
    if (fCari && (a.nama + ' ' + a.campaign + ' ' + (m ? m.headline + ' ' + m.caption : '')).toLowerCase().indexOf(fCari) === -1) return;

    const at = (KB.atribusi && KB.atribusi[a.id]) || null;
    const adalahVideo = (m && m.tipe ? m.tipe : a.tipeRow).indexOf('VIDEO') !== -1 || a.v3s > 0;
    const cukup = a.spend >= minSpend && a.imp >= minImp;
    out.push({
      id: a.id, nama: a.nama, campaign: a.campaign, m, at, ai: (KB.analisis && KB.analisis[a.id]) || null, aktif, statusMeta, cukup,
      spend: a.spend, imp: a.imp, klik: a.klik, outbound: a.outbound, results: a.results,
      cpc: a.klik > 0 ? a.spend / a.klik : 0,
      ctr: a.imp > 0 ? a.klik / a.imp * 100 : 0,
      cpl: a.results > 0 ? a.spend / a.results : 0,
      frek: a.imp > 0 ? a.frekBobot / a.imp : 0,
      hook: adalahVideo && a.imp > 0 && a.v3s > 0 ? a.v3s / a.imp * 100 : null,
      hold: adalahVideo && a.v3s > 0 ? a.thru / a.v3s * 100 : null,
      leads: at ? at.leads : null, closing: at ? at.closing : null,
      dp: at ? at.dp : null, terbayar: at ? at.terbayar : null,
           roas: at && at.spend > 0 ? at.terbayar / at.spend : null
    });
  });
  return out;
}

// ------------------------------------------------------------ RENDER
const KB_KOLOM = [
  { k: 'nama', l: 'Iklan', kiri: true },
  { k: 'aktif', l: 'Status' },
  { k: 'spend', l: 'Spend' },
  { k: 'klik', l: 'Klik Link' },
  { k: 'ctr', l: 'CTR (Link)' },
  { k: 'cpl', l: 'CPL Meta' },
  { k: 'leads', l: 'Leads CRM †' },
  { k: 'closing', l: 'Closing †' },
  { k: 'terbayar', l: 'Terbayar †' },
  { k: 'roas', l: 'ROAS Konten †' },
  { k: 'cukup', l: 'Penilaian' }
];

function kbUrut(k) {
  if (KB.urut.k === k) KB.urut.d *= -1; else KB.urut = { k, d: (k === 'nama' ? 1 : -1) };
  kbRender();
}
function kbToggleDetail(id) {
  KB.buka[id] = !KB.buka[id];
  const d = document.querySelector('tr.kb-detail[data-ad="' + id + '"]');
  const a = document.getElementById('kb_arrow_' + id);
  if (d) d.style.display = KB.buka[id] ? '' : 'none';
  if (a) a.textContent = KB.buka[id] ? '▼' : '▶';
}

function kbThumbHtml_(m, ukuran) {
  const box = `width:${ukuran}px; height:${ukuran}px; border-radius:6px; background:#e2e8f0; flex:none; overflow:hidden; display:inline-block;`;
  if (!m || !m.thumbId) return `<span style="${box}"></span>`;
  const src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(m.thumbId) + '&sz=w200';
  return `<span style="${box}"><img src="${src}" loading="lazy" referrerpolicy="no-referrer" alt="" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.visibility='hidden'"></span>`;
}
function kbStatusHtml_(r) {
  if (r.aktif === true) return '<span style="color:#047857; font-weight:700;">● Aktif</span>';
  if (r.aktif === false) return `<span style="color:#6b7280;">○ ${kbEsc(r.statusMeta.toLowerCase())}</span>`;
  return '<span style="color:#94a3b8;" title="Belum ada di Ad_Creative_Master">? belum diketahui</span>';
}
function kbCplHtml_(r) {
  if (!(r.cpl > 0)) return '<span style="color:#6b7280;">-</span>';
  const mahal = r.cpl > ambilThreshold_('cplMahalRp', 30000);
  return `<span style="color:${mahal ? '#b91c1c' : '#047857'}; font-weight:700;">${kbRp(r.cpl)}</span>`;
}
// Catatan status per iklan dari backend (status[] di per_iklan).
const KB_LABEL_STATUS = {
  tidak_terlacak: ['Chat tidak masuk CRM ini', '#7c3aed', '#f5f3ff'],
  spend_belum_sync: ['Spend belum tersinkron', '#b45309', '#fffbeb'],
  sampel_kecil: ['Sampel kecil', '#64748b', '#f1f5f9'],
  belum_matang: ['Belum matang', '#b45309', '#fffbeb']
};
function kbChipStatus_(r) {
  const s = (r.at && r.at.status) || [];
  return s.map(x => {
    const l = KB_LABEL_STATUS[x]; if (!l) return '';
    return `<span style="display:inline-block;margin:2px 4px 0 0;padding:0 6px;border-radius:99px;font-size:10px;font-weight:700;color:${l[1]};background:${l[2]};">${l[0]}</span>`;
  }).join('');
}

function kbAtrHtml_(v, fmt) {
  if (v === null || v === undefined) return '<span style="color:#cbd5e1;" title="Belum termuat, atau iklan ini belum punya chat CTWA">-</span>';
  return fmt(v);
}
function kbRoasHtml_(r) {
  if (r.roas === null) return '<span style="color:#cbd5e1;">-</span>';
  if (!r.cukup) return `<span style="color:#64748b;">${r.roas.toFixed(2).replace('.', ',')}x</span>`;
  const hijau = r.roas >= ambilThreshold_('roasSehat', 2), merah = r.roas < ambilThreshold_('roasTipisBawah', 1);
  return `<span style="color:${hijau ? '#047857' : merah ? '#b91c1c' : '#b45309'}; font-weight:700;">${r.roas.toFixed(2).replace('.', ',')}x</span>`;
}
const KB_REKOM = {
  SCALE: ['#ecfdf5', '#047857', '🟢 SCALE'], PERTAHANKAN: ['#fffbeb', '#b45309', '🟡 PERTAHANKAN'],
  REVISI: ['#fff7ed', '#c2410c', '🔧 REVISI'], MATIKAN: ['#fef2f2', '#b91c1c', '🔴 MATIKAN'], TUNGGU_DATA: ['#f1f5f9', '#64748b', '⚪ TUNGGU DATA']
};
function kbBadgeHtml_(r) {
  if (r.ai && KB_REKOM[r.ai.rekom]) {
    const k = KB_REKOM[r.ai.rekom];
    return `<span style="background:${k[0]}; color:${k[1]}; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; white-space:nowrap;" title="Vonis aturan, dianalisis ${kbEsc(r.ai.waktu)} (periode ${kbEsc(r.ai.periode)})">${k[2]}</span>`;
  }
  return r.cukup
    ? '<span style="background:#ecfdf5; color:#047857; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; white-space:nowrap;">✓ Cukup data</span>'
    : '<span style="background:#f1f5f9; color:#64748b; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; white-space:nowrap;">⚪ TUNGGU DATA</span>';
}

function kbAiHtml_(r) {
  const ai = r.ai;
  if (!ai) return '<div style="margin-top:10px; font-size:11.5px; color:#94a3b8;">Belum ada analisis AI. Klik "🤖 Analisis AI" di atas untuk membuatnya.</div>';
  const k = KB_REKOM[ai.rekom] || KB_REKOM.TUNGGU_DATA;
  const baris = (l, v) => v ? `<div style="margin-top:4px;"><span style="font-size:10.5px; color:#64748b;">${l}</span><div style="font-size:12.5px; color:#1e293b;">${kbEsc(v)}</div></div>` : '';
  return `<div style="margin-top:10px; border-left:3px solid ${k[1]}; background:${k[0]}; padding:8px 10px; border-radius:0 8px 8px 0;">
    <div style="font-weight:700; font-size:12.5px; color:${k[1]};">${k[2]}${ai.aspek ? ' · revisi: ' + kbEsc(ai.aspek) : ''}</div>
    ${baris(ai.rekom === 'TUNGGU_DATA' ? 'Alasan (aturan)' : 'Alasan', ai.alasan)}${baris('Saran tes berikutnya', ai.saran)}
    ${ai.promo.length ? baris('Promo terdeteksi', ai.promo.join(', ')) : ''}
    <div style="margin-top:6px; font-size:10.5px; color:#94a3b8;">Vonis ditentukan aturan (bukan AI); AI hanya menjelaskan. Dianalisis ${kbEsc(ai.waktu)} · periode ${kbEsc(ai.periode)}. AI hanya membaca teks & angka, bukan gambar/video.</div>
  </div>`;
}

function kbDetailHtml_(r) {
  const m = r.m || {};
  const sel = (l, v) => `<div style="min-width:120px;"><div style="font-size:10.5px; color:#64748b;">${l}</div><div style="font-weight:700; font-size:13px;">${v}</div></div>`;
  const strip = '<span style="color:#cbd5e1;">-</span>';
  const metrik = [
    sel('Impresi', kbInt(r.imp)),
    sel('Outbound click', kbInt(r.outbound)),
    sel('CPC (Link)', r.cpc > 0 ? kbRp(r.cpc) : strip),
    sel('CTR (Link)', kbPct(r.ctr)),
    sel('Frekuensi (rata-rata harian)', r.frek > 0 ? r.frek.toFixed(2).replace('.', ',') : strip),
    sel('Results (Meta)', kbInt(r.results)),
    sel('Hook Rate (3 dtk ÷ impresi)', r.hook === null ? strip : kbPct(r.hook)),
    sel('Hold Rate (ThruPlay ÷ 3 dtk)', r.hold === null ? strip : kbPct(r.hold)),
    sel('Leads CTWA', r.at ? kbInt(r.at.ctwa) : strip)
  ].join('');
  const teks = (l, v) => v ? `<div style="margin-top:8px;"><div style="font-size:10.5px; color:#64748b;">${l}</div><div style="font-size:12.5px; white-space:pre-wrap; color:#1e293b;">${kbEsc(v)}</div></div>` : '';
  return `
    <div style="display:flex; gap:14px; flex-wrap:wrap; padding:6px 4px;">
      <div>${kbThumbHtml_(r.m, 140)}</div>
      <div style="flex:1; min-width:240px;">
        <div style="display:flex; gap:14px 22px; flex-wrap:wrap;">${metrik}</div>
        ${teks('Headline', m.headline)}${teks('CTA', m.cta)}${teks('Caption', m.caption)}
        ${kbAiHtml_(r)}
        ${!r.m ? '<div style="margin-top:8px; font-size:12px; color:#94a3b8;">Caption/headline belum tersedia (iklan belum ada di Ad_Creative_Master — jalankan syncCreativeMasterSemua()).</div>' : ''}
        <div style="margin-top:8px; font-size:10.5px; color:#94a3b8;">ad_id: ${kbEsc(r.id)}</div>
      </div>
    </div>`;
}

function kbRender() {
  const tbody = $m('bKonten'), thead = $m('theadKonten'), info = $m('kbRingkas'), catatan = $m('kbCatatan');
  if (!tbody || !thead) return;

  let baris = kbHitung_();
  const { k, d } = KB.urut;
  baris.sort((x, y) => {
    let a = x[k], b = y[k];
    if (k === 'aktif') { a = x.aktif === true ? 2 : x.aktif === null ? 1 : 0; b = y.aktif === true ? 2 : y.aktif === null ? 1 : 0; }
    if (k === 'cukup') { a = x.cukup ? 1 : 0; b = y.cukup ? 1 : 0; }
    if (typeof a === 'string' || typeof b === 'string') return d * String(a || '').localeCompare(String(b || ''));
    a = a === null || a === undefined ? -Infinity : a; b = b === null || b === undefined ? -Infinity : b;
    return d * (a - b) || (y.spend - x.spend);
  });
  KB.hasil = baris;

  thead.innerHTML = '<th class="kb-thumb-col" style="width:8px;"></th>' + KB_KOLOM.map(c => {
    const pan = KB.urut.k === c.k ? (KB.urut.d < 0 ? ' ▼' : ' ▲') : '';
    return `<th style="font-size:12px; cursor:pointer; ${c.kiri ? 'text-align:left;' : ''}" onclick="kbUrut('${c.k}')">${c.l}${pan}</th>`;
  }).join('');

  if (!baris.length) {
    tbody.innerHTML = '<tr><td colspan="' + (KB_KOLOM.length + 1) + '" style="padding:14px; color:#94a3b8;">Tidak ada iklan yang cocok dengan filter. Coba matikan "hanya yang berjalan" atau perlebar periode.</td></tr>';
  } else {
    tbody.innerHTML = baris.map(r => {
      const buka = !!KB.buka[r.id];
      return `
      <tr style="cursor:pointer;" onclick="kbToggleDetail('${kbEsc(r.id)}')">
        <td class="kb-thumb-col" style="text-align:center; color:#64748b;"><span id="kb_arrow_${kbEsc(r.id)}">${buka ? '▼' : '▶'}</span></td>
        <td style="text-align:left;"><div style="display:flex; gap:8px; align-items:center;">
          <span class="kb-thumb-col">${kbThumbHtml_(r.m, 48)}</span>
          <div style="min-width:0;"><div style="font-weight:600; font-size:12.5px;">${kbEsc(r.nama)}</div>
          <div style="font-size:11px; color:#64748b;">${kbEsc(r.campaign)}</div>${kbChipStatus_(r)}</div></div></td>
        <td>${kbStatusHtml_(r)}</td>
        <td>${kbRp(r.spend)}</td>
        <td>${kbInt(r.klik)}</td>
        <td>${kbPct(r.ctr)}</td>
        <td>${kbCplHtml_(r)}</td>
        <td>${kbAtrHtml_(r.leads, kbInt)}</td>
        <td>${kbAtrHtml_(r.closing, kbInt)}</td>
        <td>${kbAtrHtml_(r.terbayar, kbRp)}</td>
        <td>${kbRoasHtml_(r)}</td>
        <td>${kbBadgeHtml_(r)}</td>
      </tr>
      <tr class="kb-detail" data-ad="${kbEsc(r.id)}" style="display:${buka ? '' : 'none'}; background:#f8fafc;">
        <td colspan="${KB_KOLOM.length + 1}">${kbDetailHtml_(r)}</td>
      </tr>`;
    }).join('');
  }

  if (info) {
    const tot = baris.reduce((s, r) => s + r.spend, 0);
    const tunggu = baris.filter(r => !r.cukup).length;
    info.title = '† Leads, closing, terbayar, dan ROAS = kumulatif sejak chat CTWA pertama (tidak mengikuti filter periode). ROAS = terbayar ÷ total spend iklan itu sepanjang data.';
    info.textContent = baris.length + ' iklan · total spend ' + kbRp(tot) + (tunggu ? ' · ' + tunggu + ' masih ⚪ tunggu data' : '') + ' · † = kumulatif sejak CTWA, bukan per periode';
  }
  if (catatan) {
    const p = [];
    if (KB.errMaster) p.push('⚠️ Master kreatif gagal dimuat (' + KB.errMaster + '). Status/thumbnail/caption belum tampil.');
    if (KB.errAtribusi) p.push('⚠️ Atribusi leads gagal dimuat (' + KB.errAtribusi + '). Kolom Leads/Closing/Terbayar kosong.');
    if (KB.errAnalisis) p.push('ℹ️ Analisis AI belum tersedia (' + KB.errAnalisis + '). Pastikan sheet DB_AnalisisKonten dan endpoint sudah dipasang.');
    catatan.innerHTML = p.map(kbEsc).join('<br>');
    catatan.style.display = p.length ? 'block' : 'none';
  }
}

// ------------------------------------------------------------ CSS TAMBAHAN (mode PDF: sembunyikan thumbnail & panah)
(function () {
  const st = document.createElement('style');
  st.textContent = '.mkt-pdf-mode .kb-thumb-col{display:none !important;} .mkt-pdf-mode tr.kb-detail{display:none !important;}' +
    ' #tblKonten td, #tblKonten th{padding:6px 8px; text-align:right;} #tblKonten td:nth-child(2), #tblKonten th:nth-child(2){text-align:left;}' +
    ' #tblKonten tbody tr:not(.kb-detail):hover{background:#f1f5f9;}';
  document.head.appendChild(st);
})();
