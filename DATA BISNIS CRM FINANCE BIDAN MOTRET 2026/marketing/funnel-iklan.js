// =========================================================================
// funnel-iklan.js — Panel "Funnel Iklan (Real CPL)" untuk index-marketing.html
// Sumber angka: backend getFunnelMarketing (satu sumber dengan Telegram & vonis konten).
// Tidak mengubah kode lama. Pasang SETELAH api-marketing.js:
//   <script src="funnel-iklan.js"></script>
// Bergantung pada: scriptURL, fetchJsonAman (nav.js). mktEsc opsional.
// =========================================================================

const FI = { memuat: false, data: null, err: '', timer: null };

const fiEsc = s => (typeof mktEsc === 'function' ? mktEsc(s)
  : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const fiRp = n => (n === null || n === undefined) ? '-' : 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const fiInt = n => (n === null || n === undefined) ? '-' : Math.round(Number(n) || 0).toLocaleString('id-ID');
const fiX = n => (n === null || n === undefined) ? '-' : String(n).replace('.', ',') + 'x';

const FI_LABEL_STATUS = {
  tidak_terlacak: ['Chat tidak masuk CRM ini', '#7c3aed', '#f5f3ff'],
  spend_belum_sync: ['Spend belum tersinkron', '#b45309', '#fffbeb'],
  sampel_kecil: ['Sampel kecil', '#64748b', '#f1f5f9'],
  belum_matang: ['Belum matang (< 30 hari)', '#0369a1', '#f0f9ff']
};
function fiChips_(status) {
  return (status || []).map(s => {
    const l = FI_LABEL_STATUS[s]; if (!l) return '';
    return `<span style="display:inline-block;margin:1px 3px 1px 0;padding:1px 7px;border-radius:99px;font-size:10.5px;font-weight:700;color:${l[1]};background:${l[2]};">${l[0]}</span>`;
  }).join('');
}

function fiPastikanPanel_() {
  let p = document.getElementById('fiPanel');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'fiPanel';
  p.style.cssText = 'background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin:0 0 18px;';
  const jangkar = document.querySelector('#tabMarketing .funnel-container');
  if (jangkar && jangkar.parentNode) jangkar.parentNode.insertBefore(p, jangkar);
  else { const tab = document.getElementById('tabMarketing'); if (tab) tab.appendChild(p); else return null; }
  return p;
}

function fiKartu_(label, nilai, ket, warna) {
  return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#f8fafc;">
    <div style="font-size:11px;color:#64748b;font-weight:700;">${label}</div>
    <div style="font-size:20px;font-weight:800;color:${warna || '#0f172a'};">${nilai}</div>
    ${ket ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${ket}</div>` : ''}</div>`;
}

function fiBaris_(x, tampilNama) {
  const bocor = x.kebocoran;
  const warnaBocor = bocor === null || bocor === undefined ? '#94a3b8' : bocor > 0 ? '#b45309' : '#047857';
  return `<tr>
    <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${fiEsc(tampilNama)}">${fiEsc(tampilNama)}</td>
    <td style="text-align:right;">${fiRp(x.spend)}</td>
    <td style="text-align:right;">${fiInt(x.results_meta)}</td>
    <td style="text-align:right;">${fiRp(x.cpl_meta)}</td>
    <td style="text-align:right;">${x.terlacak === false ? '-' : fiInt(x.leadA)}</td>
    <td style="text-align:right;font-weight:700;">${fiRp(x.real_cpl)}</td>
    <td style="text-align:right;color:${warnaBocor};">${bocor === null || bocor === undefined ? '-' : fiInt(bocor)}</td>
    <td style="text-align:right;">${x.terlacak === false ? '-' : fiInt(x.closing)}</td>
    <td style="text-align:right;">${fiX(x.roas_riil)}</td>
    <td>${fiChips_(x.status)}</td></tr>`;
}
function fiTabel_(judul, daftar, kolomNama, maks) {
  const rows = (daftar || []).slice(0, maks || 50).map(x => fiBaris_(x, kolomNama(x))).join('');
  return `<details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:700;font-size:13px;color:#334155;">${judul} (${(daftar || []).length})</summary>
    <div style="overflow-x:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr style="background:#f1f5f9;text-align:right;">
      <th style="text-align:left;padding:6px;">Nama</th><th>Spend</th><th>Chat Meta</th><th>CPL Meta</th><th>Lead CRM</th><th>Real CPL</th><th>Bocor</th><th>Closing</th><th>ROAS</th><th style="text-align:left;">Catatan</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="10" style="padding:10px;color:#94a3b8;">Tidak ada data.</td></tr>'}</tbody></table></div></details>`;
}


// Rekonsiliasi Ad Spend: kartu atas (semua spend pada filter) vs panel ini (hanya iklan terlacak sejak pelacakan valid).
function fiSpendLama_(per, kata) {
  const val = id => (document.getElementById(id) || {}).value || '';
  const fS = val('fMktStart'), fE = val('fMktEnd');
  const sel = id => (typeof getMsFilterSelected === 'function' ? getMsFilterSelected(id) : []);
  const selC = sel('msFilterMktCampaign'), selN = sel('msFilterMktNamaMeta');
  const norm = typeof normalisasiMinat === 'function' ? normalisasiMinat : x => x;
  const fmt = typeof formati === 'function' ? formati : x => String(x || '').slice(0, 10);
  const kunci = (kata || []).map(k => String(k).toLowerCase()).filter(Boolean);
  const data = typeof dataMarketing !== 'undefined' ? dataMarketing : [];
  const o = { total: 0, sebelum: 0, tak: 0, terlacak: 0 };
  (data || []).forEach(m => {
    const t = fmt(m.tanggal);
    if (fS && t < fS) return; if (fE && t > fE) return;
    if (selC.length && selC.indexOf(norm(m.campaign)) === -1) return;
    if (selN.length && selN.indexOf(m.nama_campaign_meta) === -1) return;
    const s = Number(m.spend) || 0, nama = String(m.nama_campaign_meta || m.campaign || '').toLowerCase();
    o.total += s;
    if (per.since && t < per.since) o.sebelum += s;
    else if (kunci.some(k => nama.indexOf(k) !== -1)) o.tak += s;
    else o.terlacak += s;
  });
  return o;
}
function fiRekonHtml_(per, r) {
  const o = fiSpendLama_(per, r.lini_lain && r.lini_lain.kata_kunci);
  if (!o.total) return '';
  const sel = o.terlacak - (Number(r.spend) || 0), cocok = Math.abs(sel) < 1000;
  const baris = (a, b, tebal) => `<tr><td style="padding:2px 10px 2px 0;${tebal ? 'font-weight:700;' : ''}">${a}</td><td style="text-align:right;${tebal ? 'font-weight:700;' : ''}">${b}</td></tr>`;
  const sub = document.getElementById('kpiSpendAwareness');
  if (sub && sub.parentNode) {
    let n = document.getElementById('kpiSpendRekon');
    if (!n) { n = document.createElement('div'); n.id = 'kpiSpendRekon'; n.style.cssText = 'font-size:10.5px;opacity:.85;margin-top:3px;font-weight:500;'; sub.parentNode.appendChild(n); }
    n.textContent = 'Termasuk ' + fiRp(o.sebelum) + ' sebelum ' + (per.since || '-') + ' dan ' + fiRp(o.tak) + ' lini tak terlacak. Rincian di panel Funnel Iklan.';
  }
  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12px;color:#334155;">
    <div style="font-weight:700;margin-bottom:4px;">💰 Kenapa Ad Spend kartu atas berbeda dari panel ini</div>
    <table style="border-collapse:collapse;">
      ${baris('Spend seluruh periode filter (kartu atas)', fiRp(o.total), true)}
      ${baris('− sebelum pelacakan iklan→lead valid (' + fiEsc(per.since || '-') + ')', fiRp(o.sebelum))}
      ${baris('− lini yang chat-nya tidak masuk CRM ini', fiRp(o.tak))}
      ${baris('= spend iklan terlacak (data harian)', fiRp(o.terlacak), true)}
      ${baris('Spend di panel ini (backend)', fiRp(r.spend), true)}
    </table>
    <div style="margin-top:4px;color:${cocok ? '#047857' : '#b45309'};">${cocok ? '✓ Cocok.' : 'Selisih ' + fiRp(Math.abs(sel)) + ': kemungkinan sync hari terakhir atau pilihan campaign (panel ini belum mengikuti centang campaign).'}</div>
  </div>`;
}

function fiRender() {
  const p = fiPastikanPanel_(); if (!p) return;
  const kepala = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
    <h3 style="margin:0;font-size:15px;color:#1e293b;">🎯 Funnel Iklan — Real CPL (iklan → lead CRM)</h3>
    <button type="button" onclick="fiMuat(true)" style="border:none;border-radius:7px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer;background:#4f46e5;color:#fff;" ${FI.memuat ? 'disabled' : ''}>${FI.memuat ? '⏳ Memuat...' : '↻ Muat ulang'}</button></div>`;

  if (FI.memuat && !FI.data) { p.innerHTML = kepala + '<div style="margin-top:10px;color:#64748b;font-size:13px;">⏳ Memuat... (pertama kali tanpa cache bisa sekitar 20 detik)</div>'; return; }
  if (FI.err && !FI.data) { p.innerHTML = kepala + `<div style="margin-top:10px;color:#b91c1c;font-size:13px;">❌ ${fiEsc(FI.err)}</div>`; return; }
  if (!FI.data) { p.innerHTML = kepala; return; }

  const d = FI.data.data, r = d.ringkasan, per = d.periode;
  const amb = d.ambang || { minResults: 5, matangHari: 30 };
  const kohort = d.kohort_harian || [];
  const belumMatang = kohort.filter(k => !k.matang).length;
  const spendBelumSync = kohort.filter(k => /belum tersinkron/.test(k.keterangan || '')).map(k => k.tanggal);
  const closingSedikit = (r.closing_iklan || 0) < amb.minResults;

  const peringatan = [];
  if (per.catatan) peringatan.push('📅 ' + fiEsc(per.catatan) + '. Periode yang dihitung: ' + fiEsc(per.since) + ' s/d ' + fiEsc(per.until) + '.');
  if (belumMatang > 0 || closingSedikit) {
    peringatan.push('⏳ ' + belumMatang + ' dari ' + kohort.length + ' hari kohort belum berumur ' + amb.matangHari + ' hari' +
      (closingSedikit ? ' dan closing iklan baru ' + fiInt(r.closing_iklan) : '') + '. CAC, ROAS, dan konversi <b>belum layak dinilai final</b>.');
  }
  if (spendBelumSync.length) peringatan.push('🔄 Spend belum tersinkron untuk: ' + fiEsc(spendBelumSync.join(', ')) + '. Real CPL hari itu tidak dihitung.');
  if (r.lini_lain && r.lini_lain.spend > 0) {
    peringatan.push('🧩 Lini <b>' + fiEsc((r.lini_lain.kata_kunci || []).join(', ')) + '</b>: spend ' + fiRp(r.lini_lain.spend) + ', CPL Meta ' + fiRp(r.lini_lain.cpl_meta) +
      '. Chat masuk CRM lain, jadi Real CPL tidak bisa dihitung dan tidak masuk total di bawah.');
  }
  // Ambang kini satu sumber (UI ⚙️ Ambang -> backend), jadi peringatan selisih tenant-config vs MK_AMBANG dihapus.
  const nol = d.diagnosis && d.diagnosis.campaign_terlacak_tapi_nol_lead || [];
  if (nol.length) peringatan.push('⚠️ ' + nol.length + ' campaign berspend tanpa lead CRM (sampel bisa kecil, jangan langsung dimatikan): ' + fiEsc(nol.join('; ')));

  const kartu = [
    fiKartu_('Ad Spend iklan terlacak', fiRp(r.spend), 'sejak ' + fiEsc(per.since) + ', tanpa lini tak terlacak'),
    fiKartu_('CPL Meta', fiRp(r.cpl_meta), fiInt(r.results_meta) + ' chat versi Meta'),
    fiKartu_('Real CPL', fiRp(r.real_cpl_iklan), fiInt(r.lead_iklan_A) + ' lead iklan di CRM', '#4338ca'),
    fiKartu_('Kebocoran', fiInt(r.kebocoran_chat), 'chat Meta yang tidak jadi lead CRM', r.kebocoran_chat > 0 ? '#b45309' : '#047857'),
    fiKartu_('Closing iklan', fiInt(r.closing_iklan), 'konversi ' + (r.konversi_lead_ke_closing_persen === null ? '-' : String(r.konversi_lead_ke_closing_persen).replace('.', ',') + '%')),
    fiKartu_('CAC', fiRp(r.cac_iklan), (belumMatang || closingSedikit) ? 'belum final' : ''),
    fiKartu_('ROAS riil', fiX(r.roas_riil), 'ROAS kas ' + fiX(r.roas_kas) + ((belumMatang || closingSedikit) ? ' · belum final' : '')),
    fiKartu_('Lead lain', fiInt(r.lead_meta_tanpa_jejak_B) + ' / ' + fiInt(r.lead_organik_C), 'Meta tanpa jejak / organik')
  ].join('');

  p.innerHTML = kepala +
    `<div style="font-size:11.5px;color:#64748b;margin:6px 0 10px;">Dihitung ${fiEsc(FI.data.dibuat || '')} · cache: ${fiEsc(FI.data.cache || '-')} · Angka KPI funnel di bawah panel ini memakai metode lama (semua lead CRM ÷ semua spend), jadi boleh berbeda. Untuk biaya per lead iklan, pakai panel ini.</div>` +
    (peringatan.length ? `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:10px;font-size:12.5px;color:#78350f;">${peringatan.map(t => `<div style="margin:2px 0;">${t}</div>`).join('')}</div>` : '') +
    fiRekonHtml_(per, r) +
    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;">${kartu}</div>` +
    fiTabel_('Per campaign', d.per_campaign, x => x.campaign_name, 30) +
    fiTabel_('Per iklan (urut spend)', d.per_iklan, x => x.ad_name || x.ad_id, 40);
}

// Rentang tanggal mengikuti filter tab Marketing; kosong = default server (30 hari).
async function fiMuat(paksa) {
  if (FI.memuat) return;
  const s = (document.getElementById('fMktStart') || {}).value || '';
  const e = (document.getElementById('fMktEnd') || {}).value || '';
  let url = scriptURL + '?action=getFunnelMarketing';
  if (s) url += '&since=' + encodeURIComponent(s);
  if (e) url += '&until=' + encodeURIComponent(e);
  if (paksa) url += '&refresh=1';
  FI.memuat = true; FI.err = ''; fiRender();
  try {
    let res;
    try { res = await fetchJsonAman(url); }
    catch (e1) { await new Promise(r => setTimeout(r, 1500)); res = await fetchJsonAman(url); }   // Web App kadang 404 sporadis
    if (!res || res.result !== 'success') throw new Error((res && res.message) || 'Respon tidak valid');
    FI.data = res;
  } catch (err) {
    FI.err = String((err && err.message) || err);
  } finally {
    FI.memuat = false; fiRender();
  }
}

function fiJadwalMuat_() {
  clearTimeout(FI.timer);
  FI.timer = setTimeout(() => fiMuat(false), 900);   // tunggu pengguna selesai memilih tanggal
}

document.addEventListener('DOMContentLoaded', () => {
  ['fMktStart', 'fMktEnd'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', fiJadwalMuat_); });
  document.querySelectorAll('#grupPresetTglMkt button').forEach(el => el.addEventListener('click', fiJadwalMuat_));
  document.querySelectorAll('.input-bulan-preset').forEach(el => el.addEventListener('change', fiJadwalMuat_));
  setTimeout(() => fiMuat(false), 600);
});
