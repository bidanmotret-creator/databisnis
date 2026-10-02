// =========================================================================
// penawaran-ai.js — Penawaran tiap iklan, dibaca AI dari headline + caption (disimpan per ad_id di DB_PenawaranIklan).
// Tes Promo dan Drill-down memakai PENAWARAN UTAMA ini sebagai kelompok promo; iklan yang belum dibaca
// memakai aturan Kamus Promo sebagai cadangan.
// Sumber: backend getPenawaranIklan (GET) dan ekstrakPenawaranIklan (POST, per batch) di PenawaranIklan.gs.
// Muat SETELAH promo-analisis.js dan drill-promo.js, SEBELUM api-marketing.js.
// Bergantung pada: scriptURL, fetchJsonAman (nav.js), $m (mkt-extra.js), paPaketDariTeks_, PT.rules.
// =========================================================================

const PEN = { peta: null, ringkas: null, sheetAda: true, err: '', memuat: false, berjalan: false, info: '', infoWarna: '#64748b' };

const penEsc = s => (typeof mktEsc === 'function' ? mktEsc(s)
  : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

// Dipakai promo-analisis.js dan drill-promo.js. Hasil AI bila ada; bila tidak, aturan kata kunci (cadangan).
function penPaketAtauAturan_(id, nama, headline, caption) {
  const dasar = paPaketDariTeks_(nama, headline, caption, PT.rules);
  const p = PEN.peta ? PEN.peta[String(id || '').trim()] : null;
  if (!p || !p.penawaran_utama) return dasar;
  return {
    kunci: p.penawaran_utama, penawaran: [p.penawaran_utama], pendukung: (p.pendukung || []).slice(),
    format: dasar.format, dariAi: true, ajakan: p.ajakan || '', ciri: p.ciri_kreatif || '', cekAngka: p.sumber === 'ai-cek-angka'
  };
}

function penGambarUlang_() {
  try { if (typeof paRender === 'function') paRender(); } catch (e) { console.error(e); }
  try { if ($m('mktSub_drill') && $m('mktSub_drill').classList.contains('active') && typeof renderDrilldownIklan === 'function') renderDrilldownIklan(); } catch (e) { console.error(e); }
  penRenderPanel_();
}

async function penMuat(paksa) {
  if (PEN.memuat || (PEN.peta && !paksa)) return;
  PEN.memuat = true; PEN.err = ''; penRenderPanel_();
  try {
    let res;
    try { res = await fetchJsonAman(scriptURL + '?action=getPenawaranIklan'); }
    catch (e1) { await new Promise(r => setTimeout(r, 1500)); res = await fetchJsonAman(scriptURL + '?action=getPenawaranIklan'); }   // Web App kadang 404 sporadis
    if (!res || res.result !== 'success') throw new Error((res && res.message) || 'Respon tidak valid');
    PEN.peta = res.peta || {}; PEN.ringkas = res.ringkas || null; PEN.sheetAda = res.sheet_ada !== false;
  } catch (err) {
    PEN.err = String((err && err.message) || err);
  } finally {
    PEN.memuat = false; penGambarUlang_();
  }
}

// Ulangi batch sampai tidak ada sisa. Berhenti bila ada kegagalan, batch kosong, atau 60 putaran.
async function penBacaSemua(btn) {
  if (PEN.berjalan) return;
  PEN.berjalan = true;
  const asli = btn ? btn.innerText : '';
  if (btn) btn.disabled = true;
  let total = 0, putaran = 0, catatan = [];
  try {
    while (putaran < 60) {
      putaran++;
      PEN.info = '⏳ AI membaca iklan... putaran ' + putaran + (total ? ', ' + total + ' iklan selesai' : '') + ' (tiap putaran ±30 detik)';
      PEN.infoWarna = '#64748b'; penRenderPanel_();
      const fd = new FormData();
      fd.append('action', 'ekstrakPenawaranIklan');
      const res = await fetchJsonAman(scriptURL, { method: 'POST', body: fd });
      if (!res || res.result !== 'success') throw new Error((res && res.message) || 'Handler ekstrakPenawaranIklan belum dipasang di backend.');
      total += res.diproses || 0;
      if (res.ringkas) PEN.ringkas = res.ringkas;
      (res.gagal || []).forEach(g => catatan.push(g));
      if (!res.diproses || !res.sisa) break;
    }
    PEN.info = '✅ ' + total + ' iklan selesai dibaca.' + (catatan.length ? ' ⚠️ ' + catatan.length + ' perlu dicek (angka tidak ada di teks iklan).' : '');
    PEN.infoWarna = catatan.length ? '#b45309' : '#047857';
    await penMuat(true);
  } catch (err) {
    PEN.info = '❌ ' + String((err && err.message) || err); PEN.infoWarna = '#b91c1c';
  } finally {
    PEN.berjalan = false;
    if (btn) { btn.disabled = false; btn.innerText = asli; }
    penRenderPanel_();
  }
}

function penRenderPanel_() {
  const paPanel = document.getElementById('paPanel');
  if (!paPanel) return;
  let box = document.getElementById('penPanel');
  if (!box) {
    box = document.createElement('div');
    box.id = 'penPanel';
    box.style.cssText = 'background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin:0 0 14px;';
    paPanel.parentNode.insertBefore(box, paPanel);
  }
  const r = PEN.ringkas;
  let isi;
  if (PEN.memuat && !PEN.peta) isi = '<span style="color:#64748b;font-size:12.5px;">⏳ Memuat penawaran per iklan...</span>';
  else if (PEN.err) isi = `<span style="color:#b91c1c;font-size:12.5px;">❌ ${penEsc(PEN.err)}<br>Bila pesannya "action tidak dikenali", route <code>getPenawaranIklan</code> belum dipasang di doGet atau belum di-deploy sebagai New version.</span>`;
  else if (!PEN.sheetAda) isi = '<span style="color:#b45309;font-size:12.5px;">Sheet <code>DB_PenawaranIklan</code> belum dibuat. Buat manual dengan header: ad_id | hash_teks | penawaran_utama | penawaran_pendukung | ajakan | ciri_kreatif | sumber | diperbarui.</span>';
  else if (r) {
    const perlu = r.perlu || 0;
    isi = `<span style="font-size:12.5px;color:#334155;"><b>${r.sudah}</b> dari ${r.dengan_teks} iklan bercaption sudah dibaca AI` +
      (perlu ? ` · <b style="color:#b45309;">${perlu}</b> belum dibaca atau captionnya berubah` : ' · semua terbaru') +
      (r.tanpa_teks ? ` · <span style="color:#b45309;">${r.tanpa_teks} iklan belum punya caption</span> (jalankan <code>syncCreativeMasterSemua()</code>; sementara dibaca dari nama saja)` : '') + '</span>';
  } else isi = '';
  const tombol = (PEN.sheetAda && !PEN.err && r) ? `<button type="button" class="mkt-btn" onclick="penBacaSemua(this)" ${PEN.berjalan || !(r.perlu > 0) ? 'disabled' : ''} style="background:#4338ca;color:#fff;">🧠 Baca ${r.perlu > 0 ? r.perlu + ' iklan' : 'semua iklan'} dengan AI</button>` : '';
  box.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;">
      <div><b style="font-size:13.5px;">🧠 Penawaran tiap iklan (dibaca AI)</b><div style="margin-top:3px;">${isi}</div></div>${tombol}</div>
    <div style="font-size:11.5px;color:${PEN.infoWarna};margin-top:6px;">${penEsc(PEN.info)}</div>
    <div style="font-size:11px;color:#94a3b8;margin-top:4px;">AI membaca headline dan caption sekali per iklan lalu hasilnya disimpan; dibaca ulang hanya bila caption berubah. Kelompok promo di bawah memakai penawaran utama hasil bacaan ini, jadi satu iklan hanya masuk satu kelompok. Iklan yang belum dibaca memakai Kamus Promo.</div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const chip = document.querySelector('#mktSubNav [data-sub="promo"]');
  if (chip) chip.addEventListener('click', () => penMuat(false));
  const chip2 = document.querySelector('#mktSubNav [data-sub="drill"]');
  if (chip2) chip2.addEventListener('click', () => penMuat(false));
  if ((location.hash || '') === '#promo' || (location.hash || '') === '#drill') setTimeout(() => penMuat(false), 800);
});
