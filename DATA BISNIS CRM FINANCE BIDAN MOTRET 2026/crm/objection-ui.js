// =========================================================================
// objection-ui.js - Sub-tab "Keberatan" (DB_Objection_Log) + profil bisnis (KonfigBisnis).
// Sumber: backend getObjectionLog dan getKonfigBisnis (ApiDashboardBisnis.gs).
// Hanya membaca. Pasang SETELAH api-marketing.js:  <script src="objection-ui.js"></script>
// Bergantung pada: scriptURL, fetchJsonAman (nav.js). mktEsc opsional.
// =========================================================================

const KEBR = { memuat: false, data: null, konfig: null, err: '', errKonfig: '', timer: null, sudah: false };

const kebrEsc = s => (typeof mktEsc === 'function' ? mktEsc(s)
  : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const kebrInt = n => (n === null || n === undefined) ? '-' : Math.round(Number(n) || 0).toLocaleString('id-ID');
const kebrPct = n => (n === null || n === undefined) ? '-' : String(n).replace('.', ',') + '%';
const KEBR_SAMPEL_KECIL = 5;

function kebrKartu_(label, nilai, ket, warna) {
  return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;background:#f8fafc;">
    <div style="font-size:11px;color:#64748b;font-weight:700;">${label}</div>
    <div style="font-size:20px;font-weight:800;color:${warna || '#0f172a'};">${nilai}</div>
    ${ket ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:2px;">${ket}</div>` : ''}</div>`;
}

// Nama bisnis dari konfigurasi backend; hanya dipakai bila terisi.
function kebrTerapkanProfil_(b) {
  if (!b || !b.nama) return;
  const el = document.querySelector('.sidebar-brand .brand-text span');
  if (el) el.textContent = b.nama;
  document.title = 'Analisis Marketing — ' + b.nama;
}

function kebrProfilHtml_() {
  if (KEBR.errKonfig && !KEBR.konfig) return `<div style="margin:8px 0;color:#b91c1c;font-size:12.5px;">❌ Profil bisnis gagal dimuat: ${kebrEsc(KEBR.errKonfig)}</div>`;
  const b = KEBR.konfig; if (!b) return '';
  if (b.belum_diatur) {
    return `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin:8px 0;font-size:12.5px;color:#78350f;">
      ⚙️ Profil bisnis belum diatur di backend, jadi prompt AI memakai deskripsi netral. Jalankan sekali di editor Apps Script:
      <code>aturProfilMarketing(nama, deskripsi, kota)</code>.</div>`;
  }
  const produk = (b.produk || []).map(p => `<span style="display:inline-block;margin:1px 4px 1px 0;padding:1px 8px;border-radius:99px;font-size:10.5px;font-weight:700;color:#4338ca;background:#eef2ff;">${kebrEsc(p)}</span>`).join('');
  return `<details style="margin:8px 0;"><summary style="cursor:pointer;font-size:12.5px;font-weight:700;color:#334155;">🏢 Profil bisnis: ${kebrEsc(b.nama || '(tanpa nama)')} · ${kebrEsc(b.deskripsi)}${b.kota ? ' · ' + kebrEsc(b.kota) : ''}</summary>
    <div style="font-size:12px;color:#475569;margin-top:6px;line-height:1.7;">
      Istilah: lead = <b>${kebrEsc(b.istilah.lead)}</b>, closing = <b>${kebrEsc(b.istilah.closing)}</b>, produk = <b>${kebrEsc(b.istilah.produk)}</b>, customer = <b>${kebrEsc(b.istilah.customer)}</b><br>
      Produk (${(b.produk || []).length}): ${produk || '<span style="color:#b45309;">kosong. Isi Pengaturan Follow-up per Produk.</span>'}<br>
      <span style="color:#94a3b8;">Hanya baca. Ubah lewat <code>aturProfilMarketing()</code> atau Kamus Istilah di backend.</span></div></details>`;
}

function kebrRender() {
  const p = document.getElementById('kebrPanel'); if (!p) return;
  const kepala = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
    <h3 style="margin:0;font-size:15px;color:#1e293b;">🚧 Keberatan Customer (dari analisis chat AI)</h3>
    <button type="button" onclick="kebrMuat(true)" style="border:none;border-radius:7px;padding:6px 12px;font-weight:700;font-size:12px;cursor:pointer;background:#4f46e5;color:#fff;" ${KEBR.memuat ? 'disabled' : ''}>${KEBR.memuat ? '⏳ Memuat...' : '↻ Muat ulang'}</button></div>`;
  const profil = kebrProfilHtml_();

  if (KEBR.memuat && !KEBR.data) { p.innerHTML = kepala + profil + '<div style="margin-top:10px;color:#64748b;font-size:13px;">⏳ Memuat...</div>'; return; }
  if (KEBR.err && !KEBR.data) { p.innerHTML = kepala + profil + `<div style="margin-top:10px;color:#b91c1c;font-size:13px;">❌ ${kebrEsc(KEBR.err)}<br><span style="font-size:11.5px;color:#64748b;">Bila pesannya "action tidak dikenal", route <code>getObjectionLog</code> belum dipasang di doGet atau belum di-deploy sebagai New version.</span></div>`; return; }
  if (!KEBR.data) { p.innerHTML = kepala + profil; return; }

  const d = KEBR.data.data, t = d.total;
  if (!d.sheet_ada || t.kejadian === 0) {
    p.innerHTML = kepala + profil + `<div style="margin-top:10px;color:#64748b;font-size:13px;">${d.sheet_ada ? 'Belum ada keberatan tercatat pada rentang ini.' : 'Sheet <code>DB_Objection_Log</code> belum ada. Jalankan <code>objLogBackfill()</code> atau tunggu engine AI mencatat keberatan baru.'}</div>`;
    return;
  }

  const peringatan = [];
  if (t.estimasi > 0) peringatan.push('🕓 ' + kebrInt(t.estimasi) + ' dari ' + kebrInt(t.kejadian) + ' catatan berasal dari backfill, jadi waktu munculnya perkiraan (diambil dari Updated At). Rata-rata waktu resolve hanya dihitung dari catatan engine.');
  const lain = d.per_kategori.find(k => k.kategori === 'Lainnya');
  if (lain && t.kejadian > 0 && lain.kejadian / t.kejadian > 0.3) peringatan.push('🧩 Kategori "Lainnya" mencapai ' + Math.round(lain.kejadian / t.kejadian * 100) + '% dari semua catatan. Klasifikasi perlu dilonggarkan atau aturan di <code>objKlasifikasiBukti_</code> ditambah.');
  peringatan.push('ℹ️ Rentang tanggal mengikuti filter "Rentang Tgl Chat" di atas, dihitung dari waktu keberatan muncul. % booking = nomor yang punya keberatan itu dan sudah booking; ini korelasi, bukan bukti sebab-akibat.');

  const maks = Math.max.apply(null, d.per_kategori.map(k => k.nomor).concat([1]));
  const barisKat = d.per_kategori.map(k => {
    const kecil = k.nomor < KEBR_SAMPEL_KECIL;
    return `<tr>
      <td style="padding:6px;text-align:left;font-weight:600;">${kebrEsc(k.kategori)}${kecil ? ' <span style="font-size:10px;font-weight:700;color:#64748b;background:#f1f5f9;border-radius:99px;padding:0 6px;">sampel kecil</span>' : ''}
        <div style="height:5px;background:#e0e7ff;border-radius:3px;margin-top:3px;"><div style="height:5px;width:${Math.round(k.nomor / maks * 100)}%;background:#6366f1;border-radius:3px;"></div></div></td>
      <td style="text-align:right;">${kebrInt(k.nomor)}</td>
      <td style="text-align:right;color:${k.open > 0 ? '#b45309' : '#94a3b8'};">${kebrInt(k.open)}</td>
      <td style="text-align:right;">${kebrInt(k.resolved)}</td>
      <td style="text-align:right;">${kebrInt(k.nomor_booking)}</td>
      <td style="text-align:right;font-weight:700;">${kecil ? '-' : kebrPct(k.persen_booking)}</td>
      <td style="text-align:right;">${k.rata_jam_resolve === null ? '-' : String(k.rata_jam_resolve).replace('.', ',') + ' jam (n=' + k.n_resolve + ')'}</td></tr>`;
  }).join('');

  const barisProduk = d.per_produk.map(x => `<tr><td style="padding:5px;text-align:left;">${kebrEsc(x.produk)}</td><td style="text-align:right;">${kebrInt(x.nomor)}</td><td style="text-align:right;">${kebrInt(x.kejadian)}</td><td style="text-align:right;color:${x.open > 0 ? '#b45309' : '#94a3b8'};">${kebrInt(x.open)}</td></tr>`).join('');
  const barisOpen = d.terbuka_terbaru.map(x => `<tr><td style="padding:5px;text-align:left;white-space:nowrap;">${kebrEsc(x.waktu)}${x.estimasi ? ' <span title="waktu perkiraan">~</span>' : ''}</td><td style="text-align:left;">${kebrEsc(x.hp)}</td><td style="text-align:left;font-weight:600;">${kebrEsc(x.kategori)}</td><td style="text-align:left;">${kebrEsc(x.produk)}</td><td style="text-align:left;color:#475569;white-space:normal;">${kebrEsc(x.bukti)}</td></tr>`).join('');
  const th = 'style="padding:6px;background:#f1f5f9;text-align:right;"', thL = 'style="padding:6px;background:#f1f5f9;text-align:left;"';

  p.innerHTML = kepala + profil +
    `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin:8px 0 10px;font-size:12.5px;color:#78350f;">${peringatan.map(x => `<div style="margin:2px 0;">${x}</div>`).join('')}</div>` +
    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">` +
      kebrKartu_('Nomor dengan keberatan', kebrInt(t.nomor_unik), 'nomor unik') +
      kebrKartu_('Catatan keberatan', kebrInt(t.kejadian), 'peristiwa, bukan status akhir') +
      kebrKartu_('Masih open', kebrInt(t.open), 'perlu tindak lanjut CS', t.open > 0 ? '#b45309' : '#047857') +
      kebrKartu_('Resolved', kebrInt(t.resolved), '', '#047857') + `</div>` +
    `<div style="overflow-x:auto;margin-top:14px;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th ${thL}>Kategori</th><th ${th}>Nomor</th><th ${th}>Open</th><th ${th}>Resolved</th><th ${th}>Nomor booking</th><th ${th}>% booking</th><th ${th}>Rata² waktu resolve</th></tr></thead><tbody>${barisKat}</tbody></table></div>` +
    `<details style="margin-top:12px;"><summary style="cursor:pointer;font-weight:700;font-size:13px;color:#334155;">Per produk (${d.per_produk.length})</summary><div style="overflow-x:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th ${thL}>Produk</th><th ${th}>Nomor</th><th ${th}>Catatan</th><th ${th}>Open</th></tr></thead><tbody>${barisProduk}</tbody></table></div></details>` +
    `<details style="margin-top:12px;" open><summary style="cursor:pointer;font-weight:700;font-size:13px;color:#334155;">Keberatan open terbaru (${d.terbuka_terbaru.length})</summary><div style="overflow-x:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th ${thL}>Waktu</th><th ${thL}>Nomor</th><th ${thL}>Kategori</th><th ${thL}>Produk</th><th ${thL}>Kutipan chat</th></tr></thead><tbody>${barisOpen || '<tr><td colspan="5" style="padding:10px;color:#94a3b8;">Tidak ada keberatan open.</td></tr>'}</tbody></table></div></details>`;
}

async function kebrFetch_(url) {
  let res;
  try { res = await fetchJsonAman(url); }
  catch (e1) { await new Promise(r => setTimeout(r, 1500)); res = await fetchJsonAman(url); }   // Web App kadang 404 sporadis
  if (!res || res.result !== 'success') throw new Error((res && res.message) || 'Respon tidak valid');
  return res;
}

async function kebrMuat(paksa) {
  if (KEBR.memuat) return;
  if (KEBR.sudah && !paksa) return;
  const s = (document.getElementById('fMktStart') || {}).value || '';
  const e = (document.getElementById('fMktEnd') || {}).value || '';
  let url = scriptURL + '?action=getObjectionLog';
  if (s) url += '&since=' + encodeURIComponent(s);
  if (e) url += '&until=' + encodeURIComponent(e);
  KEBR.memuat = true; KEBR.err = ''; KEBR.errKonfig = ''; kebrRender();
  const [a, b] = await Promise.allSettled([kebrFetch_(url), (KEBR.konfig && !paksa) ? Promise.resolve(null) : kebrFetch_(scriptURL + '?action=getKonfigBisnis')]);
  if (a.status === 'fulfilled') KEBR.data = a.value; else KEBR.err = String((a.reason && a.reason.message) || a.reason);
  if (b.status === 'fulfilled') { if (b.value) { KEBR.konfig = b.value.data; kebrTerapkanProfil_(KEBR.konfig); } }
  else KEBR.errKonfig = String((b.reason && b.reason.message) || b.reason);
  KEBR.sudah = true; KEBR.memuat = false; kebrRender();
}

function kebrJadwalMuat_() {
  clearTimeout(KEBR.timer);
  KEBR.timer = setTimeout(() => { if (KEBR.sudah) kebrMuat(true); }, 900);
}

document.addEventListener('DOMContentLoaded', () => {
  const chip = document.querySelector('#mktSubNav [data-sub="keberatan"]');
  if (chip) chip.addEventListener('click', () => kebrMuat(false));
  ['fMktStart', 'fMktEnd'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('change', kebrJadwalMuat_); });
  document.querySelectorAll('#grupPresetTglMkt button, .input-bulan-preset').forEach(el => el.addEventListener('click', kebrJadwalMuat_));
  setTimeout(() => { KEBR.konfig || kebrFetch_(scriptURL + '?action=getKonfigBisnis').then(r => { KEBR.konfig = r.data; kebrTerapkanProfil_(r.data); }).catch(() => {}); }, 1500);
});
