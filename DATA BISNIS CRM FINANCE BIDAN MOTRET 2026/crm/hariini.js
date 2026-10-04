// =========================================================================
// hariini.js - Menu "Prioritas Hari Ini": antrean kerja harian CS.
// File mandiri. Bergantung pada global dari crm.html / ui-crm.js / api-crm.js:
//   dataCrm, aiByHp, chatStat, hpNorm, esc, kategoriStatus_, bukaChat, pbAksi,
//   muatPlaybookCrm, window.chatArah, window.playbookData
// =========================================================================

const LEGACY_KEB_CRM_ = {
  'keuangan/harga': 'Harga paket', 'waktu': 'Slot/jadwal',
  'takut/ragu keamanan bayi': 'Ragu keamanan bayi', 'bingung memilih produk': 'Bingung pilih paket'
};
function normKategoriCrm_(k) {
  const s = String(k || '').trim();
  return LEGACY_KEB_CRM_[s.toLowerCase()] || s || 'Lainnya';
}

// "yyyy-MM-dd HH:mm[:ss]" (WIB) -> ms. NaN bila kosong/tidak valid.
function waktuKeMsCrm_(s) {
  if (!s) return NaN;
  s = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return new Date(s.replace(' ', 'T') + (s.length === 16 ? ':00' : '') + '+07:00').getTime();
  }
  return new Date(s).getTime();
}

function umurTeksCrm_(ms) {
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (m < 60) return m + ' mnt';
  const j = Math.floor(m / 60);
  return j < 48 ? j + ' jam' : Math.floor(j / 24) + ' hari';
}

function sudahBayarCrm_(r) {
  return kategoriStatus_(r.status) !== 'pending' || ((Number(r.jml_bayar1) || 0) + (Number(r.jml_bayar2) || 0)) > 0;
}

// Pesan siap kirim dari DB_Playbook untuk satu lead & kategori keberatan.
function pbBlokPesanCrm_(x, kat) {
  const rows = Array.isArray(window.playbookData) ? window.playbookData : [];
  const produk = String((x.ai && x.ai.produk) || '').toLowerCase(), per = {};
  rows.filter(p => p.kategori === kat && p.template).forEach(p => {
    const pp = String(p.produk || 'Semua').toLowerCase();
    if (pp !== 'semua' && pp !== produk) return;
    const ada = per[p.sentuhan];
    if (!ada || (String(ada.produk).toLowerCase() === 'semua' && pp !== 'semua')) per[p.sentuhan] = p;
  });
  const msgs = Object.keys(per).map(Number).sort((a, b) => a - b).slice(0, 4).map(n => per[n]);
  if (!msgs.length) return '';

  const depan = String(x.r.nama || '').trim().split(/\s+/)[0] || '';
  const sapaan = /^[A-Za-z]{2,}$/.test(depan) ? 'Kak ' + depan.charAt(0).toUpperCase() + depan.slice(1).toLowerCase() : 'Kak';
  const prod = (x.ai && x.ai.produk && x.ai.produk !== 'Unknown') ? x.ai.produk : (x.r.minat || 'layanan kami');
  const lokasi = (x.ai && x.ai.lokasi) || (x.r.lokasi && x.r.lokasi !== '-' ? x.r.lokasi : '') || '[LOKASI]';
  const isi = t => String(t).split('[NAMA]').join(sapaan).split('[PRODUK]').join(prod).split('[LOKASI]').join(lokasi);

  return `<details data-k="pbh_${x.h}" style="margin-top:6px;"><summary style="cursor:pointer; font-size:12.5px; color:#4338ca;">✉️ ${msgs.length} pesan siap kirim</summary>` +
    msgs.map(m => {
      const id = 'pbh_' + x.h + '_' + m.sentuhan;
      return `<div style="margin-top:6px;"><small><b>Sentuhan ${m.sentuhan}</b></small>
        <textarea id="${id}" rows="4" style="width:100%; font-size:12.5px; box-sizing:border-box;">${esc(isi(m.template))}</textarea>
        <button class="row-btn" style="background:#4f46e5;" onclick="pbAksi('salin','${id}','${x.h}')">📋 Salin</button>
        <button class="row-btn" style="background:#16a34a;" onclick="pbAksi('wa','${id}','${x.h}')">📲 Buka WA</button></div>`;
    }).join('') + '</details>';
}

// ---------------------------------------------------------------------------
// Logika prioritas (murni, tidak menyentuh DOM)
// ---------------------------------------------------------------------------
function hitungPrioritasHariIniCrm_() {
  const now = Date.now(), JAM = 3600000, HARI = 86400000;
  const awalHari = (() => { const d = new Date(now + 7 * JAM); d.setUTCHours(0, 0, 0, 0); return d.getTime() - 7 * JAM; })();   // 00:00 WIB
  const arahMap = window.chatArah || {};
  const kpi = { balas: 0, booking: 0, keberatan: 0, pelunasan: 0, pasangan: 0, ditangani: 0 };

  // 1 baris per nomor: baris dengan tanggal chat terbaru
  const terbaru = {};
  (dataCrm || []).forEach(r => {
    const h = hpNorm(r.no_hp);
    if (!h) return;
    if (!terbaru[h] || String(r.tanggal_chat || '') >= String(terbaru[h].tanggal_chat || '')) terbaru[h] = r;
  });

  const items = [];
  Object.keys(terbaru).forEach(h => {
    const r = terbaru[h], ai = aiByHp[h] || {};
    if (ai.tipe_kontak && ai.tipe_kontak !== 'Customer' && !(r.total > 0)) return;

    const arah = arahMap[h] || {}, cs = chatStat[h] || {};
    const lastIn = waktuKeMsCrm_(arah.last_in || cs.last);
    const lastCs = waktuKeMsCrm_(arah.last_cs);
    const dibayar = sudahBayarCrm_(r);
    const open = (Array.isArray(ai.keberatan) ? ai.keberatan : [])
      .filter(k => k.status !== 'resolved').map(k => ({ kategori: normKategoriCrm_(k.kategori), bukti: k.bukti || '' }));

    if (!isNaN(lastCs) && lastCs >= awalHari) kpi.ditangani++;

    const menunggu = !isNaN(lastIn) && (isNaN(lastCs) || lastIn > lastCs) && (now - lastIn) <= 7 * HARI;
    const csBaru = !isNaN(lastCs) && (now - lastCs) < 24 * JAM;
    const hidup = !isNaN(lastIn) && (now - lastIn) <= 30 * HARI;   // lead yang diam > 30 hari = reaktivasi, bukan prioritas harian
    const alasan = [];
    let skor = 0;

    if (!dibayar) {
      if (menunggu) { alasan.push({ k: 'balas', t: '⏳ Menunggu balasan ' + umurTeksCrm_(lastIn) }); skor += 70 + Math.min(20, Math.floor((now - lastIn) / JAM)); kpi.balas++; }
      if (ai.booking && hidup) { alasan.push({ k: 'booking', t: '🔥 Sinyal booking, belum DP' }); skor += 65; kpi.booking++; }
      if (open.length && hidup && (!csBaru || menunggu)) { alasan.push({ k: 'keberatan', t: '🚧 ' + open.map(o => o.kategori).slice(0, 2).join(', ') }); skor += 50 + (open.length > 1 ? 5 : 0); kpi.keberatan++; }
      if (ai.stage_funnel === 'Menunggu keputusan pasangan' && !menunggu && !isNaN(lastCs) && (now - lastCs) >= 48 * JAM && (now - lastCs) <= 14 * HARI) {
        alasan.push({ k: 'pasangan', t: '💬 Cek keputusan pasangan (' + umurTeksCrm_(lastCs) + ' sejak balasan terakhir)' }); skor += 40; kpi.pasangan++;
      }
    }
    if ((Number(r.sisa_hutang) || 0) > 0 && r.jadwal) {
      const hari = (new Date(r.jadwal).getTime() - now) / HARI;
      if (hari >= -3 && hari <= 7) { alasan.push({ k: 'pelunasan', t: '💰 Pelunasan sesi ' + (hari < 0 ? 'lewat ' + Math.ceil(-hari) + ' hr' : Math.ceil(hari) + ' hr lagi') }); skor += 60; kpi.pelunasan++; }
    }
    if (!alasan.length) return;

    if (ai.intent === 'Very High') skor += 10; else if (ai.intent === 'High') skor += 5;
    if (ai.timeline === 'This Week') skor += 10; else if (ai.timeline === 'This Month') skor += 4;

    items.push({ h, r, ai, open, lastIn, lastCs, teksTerakhir: cs.teks || '', alasan, skor });
  });

  items.sort((a, b) => b.skor - a.skor);
  return { items: items.slice(0, 40), total: items.length, kpi };
}

// ---------------------------------------------------------------------------
// Tampilan
// ---------------------------------------------------------------------------
function renderHariIni() {
  const el = document.getElementById('hariIniBody');
  if (!el) return;
  if (layarSedangDiedit_(el)) return;   // data di-refresh tiap 45 dtk: jangan timpa pesan yang sedang diedit CS
  const terbuka = Array.from(el.querySelectorAll('details[data-k][open]')).map(d => d.getAttribute('data-k'));
  if (window.playbookData === undefined && typeof muatPlaybookCrm === 'function') muatPlaybookCrm();

  const { items, total, kpi } = hitungPrioritasHariIniCrm_();
  const adaCs = Object.keys(window.chatArah || {}).some(h => window.chatArah[h].last_cs);
  const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

  const kartuKpi = (n, l, k) => `<div class="fu-kpi-card ${k}"><div class="n">${n}</div><div class="l">${l}</div></div>`;
  let html = `<div style="font-size:12.5px; color:#64748b; margin-bottom:8px;">${esc(tanggal)} · daftar ini <b>tidak terpengaruh filter</b> di atas, dan lead yang sudah dibalas CS hari ini tidak ditampilkan lagi.</div>` +
    (adaCs ? '' : `<div class="ai-card" style="background:#fffbeb; border-color:#fde68a;"><b>⚠️ Balasan CS belum tercatat.</b> Jalankan sinkron pesan keluar (<code>syncPesanKeluarKirimdev</code>) agar "Menunggu balasan" akurat. Sebelum itu, semua pesan pelanggan dianggap belum dibalas.</div>`) +
    `<div class="fu-kpi-grid">` +
    kartuKpi(kpi.balas, 'Menunggu balasan', 'fu-kpi-3') + kartuKpi(kpi.booking, 'Sinyal booking, belum DP', 'fu-kpi-4') +
    kartuKpi(kpi.keberatan, 'Keberatan perlu follow up', 'fu-kpi-1') + kartuKpi(kpi.pelunasan, 'Pelunasan sesi dekat', 'fu-kpi-2') +
    kartuKpi(kpi.ditangani, 'Sudah dibalas CS hari ini', 'fu-kpi-4') + `</div>`;

  html += `<div class="card"><h4 style="margin:0 0 4px;">📌 Prioritas Hari Ini <small style="color:#64748b; font-weight:400;">(${items.length} dari ${total} lead)</small></h4>
    <small style="color:#64748b;">Urut skor: menunggu balasan, sinyal booking, keberatan, pelunasan, lalu intent dan timeline.</small>`;

  html += items.map((x, i) => {
    const produk = (x.ai.produk && x.ai.produk !== 'Unknown') ? x.ai.produk : (x.r.minat || '-');
    const tags = x.alasan.map(a => `<span style="display:inline-block; margin:0 4px 4px 0; padding:2px 8px; border-radius:10px; font-size:11.5px; font-weight:700; background:${a.k === 'balas' ? '#fef3c7' : a.k === 'booking' ? '#dcfce7' : a.k === 'pelunasan' ? '#e0f2fe' : '#fee2e2'}; color:#1e293b;">${esc(a.t)}</span>`).join('');
    const kat = x.open[0] ? x.open[0].kategori : '';
    return `<div style="border-top:1px solid #e2e8f0; padding:10px 0;">
      <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <div><b>${i + 1}. ${esc(x.r.nama || x.r.no_hp)}</b> <small style="color:#64748b;">${esc(produk)} · ${esc(x.ai.timeline || '-')} · Intent ${esc(x.ai.intent || '-')}</small></div>
        <div style="white-space:nowrap;"><button class="row-btn" style="background:#0ea5e9;" onclick="bukaChat('${esc(x.r.no_hp)}','${esc((x.r.nama || '').replace(/'/g, ''))}')">💬 Chat</button>
          <a class="row-btn" style="background:#16a34a; text-decoration:none; display:inline-block;" href="https://wa.me/${x.h}" target="_blank">📲 WA</a></div></div>
      <div style="margin-top:4px;">${tags}</div>
      ${x.teksTerakhir ? `<div style="font-size:12.5px; color:#334155;">Pesan terakhir pelanggan: “${esc(String(x.teksTerakhir).substring(0, 110))}”</div>` : ''}
      ${x.open.length ? `<div style="font-size:12px; color:#991b1b;">Keberatan: ${x.open.map(o => esc(o.kategori) + (o.bukti ? ' (“' + esc(String(o.bukti).substring(0, 60)) + '”)' : '')).join(' · ')}</div>` : ''}
      ${x.ai.next_action ? `<div style="font-size:12.5px; color:#14532d;">🎯 ${esc(x.ai.next_action)}</div>` : ''}
      ${kat ? pbBlokPesanCrm_(x, kat) : ''}</div>`;
  }).join('') || '<p style="text-align:center; color:#94a3b8; padding:20px;">🎉 Tidak ada yang mendesak hari ini.</p>';

  html += '</div>';
  el.innerHTML = html;
  terbuka.forEach(k => { const d = el.querySelector('details[data-k="' + k + '"]'); if (d) d.setAttribute('open', ''); });
}

// true bila CS sedang mengetik / sudah mengubah teks pesan di layar ini.
function layarSedangDiedit_(el) {
  const a = document.activeElement;
  if (a && el.contains(a) && a.tagName === 'TEXTAREA') return true;
  return Array.from(el.querySelectorAll('textarea')).some(t => t.value !== t.defaultValue);
}

// Tab pertama saat halaman dibuka = Prioritas Hari Ini (setelah data pertama masuk).
// Tidak dipaksakan bila CS sudah pindah tab sendiri, atau datang dari tautan pencarian (?cari=...).
(function () {
  if (new URLSearchParams(location.search).get('cari')) return;
  let n = 0;
  const t = setInterval(() => {
    if (window._tabAwalDiset || ++n > 120) return clearInterval(t);
    if (Array.isArray(dataCrm) && dataCrm.length) {
      window._tabAwalDiset = true;
      clearInterval(t);
      if (tabCrm === 'master') gantiTabCrm('hariini');
    }
  }, 500);
})();
