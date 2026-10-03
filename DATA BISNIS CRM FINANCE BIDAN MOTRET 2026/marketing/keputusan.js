// =========================================================================
// keputusan.js — Kartu "Keputusan" di atas tab Funnel & Insight, Konten Berjalan, dan Tes Promo.
// Tujuan: dashboard membantu memutuskan (tambah budget / tahan / tindak / periksa / tunggu), bukan hanya menampilkan angka.
// Semua vonis berasal dari aturan yang SUDAH ada (vonis konten dari backend, banding adil promo, ambang di ⚙️ Ambang);
// kartu ini hanya merangkum dan mengurutkan. Tidak ada angka baru yang dihitung di sini.
// Muat SETELAH tes-penawaran.js dan SEBELUM api-marketing.js.
// Bergantung pada (dicek saat dipakai): KB, kbRp, kbEsc, PT, PA, paK_, tpData_, tpAgregasi_, tpPasangan_, tpKepatuhan_, FI, fiRp, fiInt.
// =========================================================================

const KP_TINGKAT = {
  tambah: ['➕ Layak ditambah', '#047857', '#ecfdf5'],
  tahan: ['⏸ Tahan / pertahankan', '#b45309', '#fffbeb'],
  tindak: ['🔧 Perlu ditindak', '#c2410c', '#fff7ed'],
  periksa: ['🔍 Periksa dulu', '#1d4ed8', '#eff6ff'],
  tunggu: ['⏳ Tunggu data', '#64748b', '#f1f5f9']
};
const KP_URUT = ['tambah', 'tindak', 'periksa', 'tahan', 'tunggu'];

const kpEsc = s => (typeof kbEsc === 'function' ? kbEsc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const kpRp = n => (typeof kbRp === 'function' ? kbRp(n) : 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'));
const kpPotong = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const kpIt = (tingkat, judul, alasan) => ({ tingkat, judul, alasan: alasan || '' });

// ------------------------------------------------------------ PEMBANGUN PER TAB
function kpKonten_() {
  const baris = (typeof KB !== 'undefined' && Array.isArray(KB.hasil)) ? KB.hasil : [];
  if (!baris.length) return { items: [], catatan: 'Tidak ada iklan pada filter ini.' };
  const ada = baris.filter(r => r.ai && r.ai.rekom);
  const per = k => ada.filter(r => r.ai.rekom === k).sort((a, b) => b.spend - a.spend);
  const items = [];
  per('SCALE').slice(0, 3).forEach(r => items.push(kpIt('tambah', kpPotong(r.nama, 70), kpRp(r.spend) + ' · ' + kpPotong(r.ai.alasan, 140))));
  per('MATIKAN').slice(0, 3).forEach(r => items.push(kpIt('tindak', 'Matikan atau ganti: ' + kpPotong(r.nama, 60), kpRp(r.spend) + ' · ' + kpPotong(r.ai.alasan, 140))));
  per('REVISI').slice(0, 2).forEach(r => items.push(kpIt('tindak', 'Revisi kreatif: ' + kpPotong(r.nama, 60), kpRp(r.spend) + ' · ' + kpPotong(r.ai.alasan, 140))));
  const tahan = per('PERTAHANKAN');
  if (tahan.length) items.push(kpIt('tahan', tahan.length + ' iklan dipertahankan', 'Total spend ' + kpRp(tahan.reduce((s, r) => s + r.spend, 0)) + '. Tidak ada tindakan, pantau saja.'));
  const belum = baris.filter(r => !r.cukup);
  if (belum.length) items.push(kpIt('tunggu', belum.length + ' iklan belum cukup data', 'Spend atau impresi belum mencapai ambang (⚙️ Ambang). Jangan diputuskan dulu: ' + kpRp(belum.reduce((s, r) => s + r.spend, 0)) + ' sudah terpakai.'));
  if (!ada.length) items.unshift(kpIt('periksa', 'Vonis iklan belum dijalankan', 'Klik "Analisis AI" di atas untuk mendapat vonis per iklan (SCALE, REVISI, MATIKAN). Vonis dihitung aturan di backend; AI hanya menjelaskan.'));
  return { items, catatan: 'Mengikuti filter di atas. Vonis dari aturan backend, ambang dari ⚙️ Ambang.' };
}

function kpPromo_() {
  if (typeof PT === 'undefined' || !PT.kamus || typeof PA === 'undefined' || !PA.minat) return { items: [kpIt('tunggu', 'Memuat data promo...', '')], catatan: '' };
  const K = paK_(), iklan = tpData_().filter(a => a.minat === PA.minat);
  if (!iklan.length) return { items: [kpIt('tunggu', 'Belum ada iklan untuk minat ' + PA.minat, '')], catatan: '' };
  const agg = tpAgregasi_(iklan), pas = tpPasangan_(agg, iklan, K), kep = tpKepatuhan_(iklan), items = [];

  const peng = pas.filter(p => p.variabel === 'Penawaran' && p.h.pakai);
  peng.slice(0, 4).forEach(p => {
    const k = p.h.pakai.kode, d = p.h.pakai.data || {}, bukti = { kuat: 'adset sama', sedang: 'campaign sama', lemah: 'lintas campaign' }[p.h.pakai.kekuatan] || '-';
    const cpl = (d.cplA !== null && d.cplA !== undefined ? kpRp(d.cplA) : '-') + ' vs ' + (d.cplB !== null && d.cplB !== undefined ? kpRp(d.cplB) : '-');
    if (k === 'A' || k === 'B') {
      const menang = p[k], kalah = p[k === 'A' ? 'B' : 'A'];
      if (p.h.pakai.kekuatan === 'lemah') items.push(kpIt('periksa', 'Petunjuk: "' + kpPotong(menang.offer, 50) + '" tampak lebih murah dari "' + kpPotong(kalah.offer, 50) + '"', cpl + ' · bukti lemah (' + bukti + ', audiens bisa berbeda). Uji ulang dalam satu adset sebelum memindah budget.'));
      else items.push(kpIt('tambah', 'Tambah budget ke penawaran "' + kpPotong(menang.offer, 60) + '"', 'Lebih murah dari "' + kpPotong(kalah.offer, 50) + '" (' + cpl + '), bukti: ' + bukti + ', filter sama: ' + kpPotong(p.A.filter, 40) + '.'));
    } else {
      items.push(kpIt('tahan', '"' + kpPotong(p.A.offer, 50) + '" dan "' + kpPotong(p.B.offer, 50) + '" setara', cpl + ' · bukti: ' + bukti + '. Pilih yang lebih mudah diproduksi.'));
    }
  });
  if (!peng.length) items.push(kpIt('tunggu', 'Belum ada pasangan penawaran yang bisa divonis', 'Perlu dua penawaran dengan filter sama dan data cukup (spend ≥ ' + kpRp(K.minSpend) + ', leads ≥ ' + K.minRes + '). Lihat "Rencana tes berikutnya" di bawah.'));
  if (!agg.pakaiQ && pas.some(p => p.variabel === 'Filter')) items.push(kpIt('periksa', 'Tes filter (harga, DP, area, usia) belum bisa diputuskan', 'Butuh data lead berkualitas per iklan; CPL saja menyesatkan untuk filter.'));
  if (kep.total > 0 && kep.campur.spend / kep.total >= 0.3) items.push(kpIt('tindak', 'Pecah iklan yang menumpuk penawaran', Math.round(kep.campur.spend / kep.total * 100) + '% spend (' + kpRp(kep.campur.spend) + ') ada di iklan yang memuat 2 penawaran atau lebih, sehingga hasilnya tidak bisa ditautkan ke satu penawaran.'));
  return { items, catatan: 'Minat ' + PA.minat + ' (ikut pilihan di panel atas). Vonis dari banding adil: adset sama > campaign sama > lintas campaign.' };
}

function kpFunnel_() {
  const w = (typeof FI !== 'undefined') ? FI.data : null;
  if (!w || !w.data) return { items: [], catatan: '' };
  const d = w.data, r = d.ringkasan || {}, per = d.periode || {}, amb = d.ambang || { minResults: 5, matangHari: 30 };
  const rp = typeof fiRp === 'function' ? fiRp : kpRp, it = typeof fiInt === 'function' ? fiInt : (n => String(n));
  const kohort = d.kohort_harian || [], belumMatang = kohort.filter(k => !k.matang).length;
  const items = [];
  if ((r.closing_iklan || 0) < amb.minResults || belumMatang > 0) {
    items.push(kpIt('tunggu', 'Jangan menilai CAC, ROAS, dan konversi dulu', 'Closing iklan baru ' + it(r.closing_iklan) + '; ' + belumMatang + ' dari ' + kohort.length + ' hari kohort belum berumur ' + amb.matangHari + ' hari.'));
  }
  if ((r.kebocoran_chat || 0) > 0) {
    items.push(kpIt('periksa', it(r.kebocoran_chat) + ' chat versi Meta tidak menjadi lead di CRM', 'Real CPL ' + rp(r.real_cpl_iklan) + ' vs CPL Meta ' + rp(r.cpl_meta) + '. Telusuri apakah webhook WhatsApp atau pencocokan nomor melewatkan chat. Pakai Real CPL untuk keputusan biaya.'));
  }
  const nol = (d.diagnosis && d.diagnosis.campaign_terlacak_tapi_nol_lead) || [];
  if (nol.length) items.push(kpIt('tahan', nol.length + ' campaign berspend tanpa lead CRM: jangan dimatikan dulu', 'Sampel kecil. Tunggu spend dan impresi melewati ambang sebelum memutuskan.'));
  const sync = kohort.filter(k => /belum tersinkron/.test(k.keterangan || '')).map(k => k.tanggal);
  if (sync.length) items.push(kpIt('periksa', 'Spend belum tersinkron: ' + sync.join(', '), 'Real CPL hari itu tidak dihitung. Jalankan sync Meta untuk tanggal tersebut.'));
  if (!items.length) items.push(kpIt('tahan', 'Tidak ada tindakan mendesak', 'Real CPL ' + rp(r.real_cpl_iklan) + ' pada periode ' + (per.since || '-') + ' s/d ' + (per.until || '-') + '.'));
  return { items, catatan: 'Angka dari panel Funnel Iklan (Real CPL), satu sumber dengan Telegram dan vonis konten.' };
}

// ------------------------------------------------------------ RENDER
const KP_SUB = [
  { id: 'mktSub_funnel', bangun: kpFunnel_ },
  { id: 'mktSub_konten', bangun: kpKonten_ },
  { id: 'mktSub_promo', bangun: kpPromo_ }
];

function kpWadah_(sub) {
  let box = document.getElementById('kp_' + sub.id);
  if (box) return box;
  const el = document.getElementById(sub.id);
  if (!el) return null;
  box = document.createElement('div');
  box.id = 'kp_' + sub.id;
  box.style.cssText = 'background:#fff; border:1px solid #c7d2fe; border-left:5px solid #4f46e5; border-radius:12px; padding:12px 16px; margin:0 0 14px;';
  const tb = el.querySelector('.mkt-toolbar');
  if (tb) tb.insertAdjacentElement('afterend', box); else el.insertBefore(box, el.firstChild);
  return box;
}

function kpKartu_(hasil) {
  const items = (hasil.items || []).slice().sort((a, b) => KP_URUT.indexOf(a.tingkat) - KP_URUT.indexOf(b.tingkat));
  const baris = items.map(x => {
    const t = KP_TINGKAT[x.tingkat] || KP_TINGKAT.tunggu;
    return '<div style="display:flex; gap:10px; align-items:flex-start; padding:6px 0; border-top:1px solid #f1f5f9;">' +
      '<span style="flex:0 0 auto; background:' + t[2] + '; color:' + t[1] + '; font-weight:700; font-size:11px; border-radius:10px; padding:2px 9px; white-space:nowrap;">' + t[0] + '</span>' +
      '<div style="min-width:0;"><div style="font-weight:700; font-size:13px; color:#0f172a;">' + kpEsc(x.judul) + '</div>' +
      (x.alasan ? '<div style="font-size:12px; color:#475569; margin-top:1px;">' + kpEsc(x.alasan) + '</div>' : '') + '</div></div>';
  }).join('');
  return '<div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px; flex-wrap:wrap;"><b style="font-size:14px;">🧭 Keputusan</b>' +
    '<span style="font-size:11px; color:#94a3b8;">' + kpEsc(hasil.catatan || '') + '</span></div>' +
    (baris || '<div style="font-size:12.5px; color:#94a3b8; margin-top:6px;">Belum ada yang perlu diputuskan pada filter ini.</div>');
}

function kpRender_() {
  KP_SUB.forEach(s => {
    const el = document.getElementById(s.id);
    if (!el || el.offsetParent === null) return;   // hanya tab yang sedang tampil
    const box = kpWadah_(s);
    if (!box) return;
    try { box.innerHTML = kpKartu_(s.bangun()); }
    catch (e) { console.error('Kartu keputusan gagal (' + s.id + '):', e); box.innerHTML = ''; }
  });
}
let kpTimer = null;
function kpJadwal_() { clearTimeout(kpTimer); kpTimer = setTimeout(kpRender_, 120); }

// Dipasang saat DOMContentLoaded supaya membungkus versi terakhir tiap fungsi (funnel-iklan.js dimuat sesudah file ini).
document.addEventListener('DOMContentLoaded', () => {
  ['renderMarketingTab', 'kbRender', 'paRender', 'fiRender'].forEach(nama => {
    const asli = window[nama];
    if (typeof asli !== 'function' || asli.__kp) return;
    const bungkus = function () { const h = asli.apply(this, arguments); kpJadwal_(); return h; };
    bungkus.__kp = true;
    window[nama] = bungkus;
  });
  document.querySelectorAll('#mktSubNav .mkt-chip').forEach(c => c.addEventListener('click', () => setTimeout(kpRender_, 400)));
  setTimeout(kpRender_, 1500);
});
