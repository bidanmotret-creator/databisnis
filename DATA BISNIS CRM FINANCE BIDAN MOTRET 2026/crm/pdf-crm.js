// =========================================================================
// pdf-crm.js - Ekspor PDF: "PDF Menu Ini" dan "PDF Semua" (dengan Ringkasan Aset WA).
// File mandiri. Memakai dialog cetak browser (Simpan sebagai PDF), tanpa pustaka tambahan.
// Bergantung pada: tabCrm, gantiTabCrm, renderCrm, renderAnalitik, dataCrm, aiByHp, chatStat,
//   hpNorm, esc, rpC, kategoriStatus_, charts, Chart (opsional),
//   hitungPrioritasHariIniCrm_, normKategoriCrm_, waktuKeMsCrm_, sudahBayarCrm_ (hariini.js)
// =========================================================================

const PDF_TAB_CRM_ = [
  { id: 'hariini', judul: 'Prioritas Hari Ini', abaikanFilter: true },
  { id: 'insight', judul: 'Keberatan & Tindakan' },
  { id: 'master', judul: 'Master Data Lead' },
  { id: 'produk', judul: 'Produk & Keuangan' },
  { id: 'kohort', judul: 'Kohort' },
  { id: 'evaluasi', judul: 'Evaluasi' }
];

// ---------------------------------------------------------------------------
// Ringkasan Aset WhatsApp (halaman depan "PDF Semua"). Semua angka dihitung dari data CRM
// (tidak terpengaruh filter). Potensi omzet = rata-rata order historis, BUKAN janji.
// ---------------------------------------------------------------------------
function ringkasanAsetCrm_() {
  const now = Date.now(), HARI = 86400000, DIAM_HARI = 60;
  const arahMap = window.chatArah || {};
  const terbaru = {}, baris = {};
  (dataCrm || []).forEach(r => {
    const h = hpNorm(r.no_hp);
    if (!h) return;
    (baris[h] = baris[h] || []).push(r);
    if (!terbaru[h] || String(r.tanggal_chat || '') >= String(terbaru[h].tanggal_chat || '')) terbaru[h] = r;
  });

  const kontak = Object.keys(chatStat || {});
  const tipe = { 'Customer': 0, 'Vendor': 0, 'Pribadi': 0, 'Lainnya': 0, 'Belum dianalisis': 0 };
  kontak.forEach(h => {
    const a = aiByHp[h];
    if (!a || (!a.tipe_kontak && !a.stage_funnel && !a.produk)) tipe['Belum dianalisis']++;
    else tipe[a.tipe_kontak in tipe ? a.tipe_kontak : 'Lainnya']++;
  });
  const adaCs = kontak.filter(h => arahMap[h] && arahMap[h].last_cs).length;

  const tipeDari = h => (aiByHp[h] && aiByHp[h].tipe_kontak) || 'Customer';
  const customerHp = Object.keys(terbaru).filter(h => tipeDari(h) === 'Customer' || baris[h].some(r => r.total > 0));
  const berbayarHp = customerHp.filter(h => baris[h].some(sudahBayarCrm_));

  let omzet = 0, trx = 0, cash = 0, piutang = 0;
  const perMinat = {}, perProduk = {};
  Object.keys(baris).forEach(h => baris[h].forEach(r => {
    cash += (Number(r.jml_bayar1) || 0) + (Number(r.jml_bayar2) || 0);
    piutang += Number(r.sisa_hutang) || 0;
    if (sudahBayarCrm_(r)) {
      omzet += Number(r.total) || 0; trx++;
      const m = r.minat || 'Lainnya';
      perMinat[m] = perMinat[m] || { s: 0, n: 0 };
      perMinat[m].s += Number(r.total) || 0; perMinat[m].n++;
    }
  }));
  const rata = trx ? omzet / trx : 0;
  const rataMinat = m => (perMinat[m] && perMinat[m].n) ? perMinat[m].s / perMinat[m].n : rata;
  const konversi = customerHp.length ? berbayarHp.length / customerHp.length : 0;
  const repeat = berbayarHp.filter(h => baris[h].filter(sudahBayarCrm_).length >= 2).length;

  // lead belum bayar: aktif (<=60 hari) vs tidur
  let aktif = 0, tidur = 0, potAktif = 0, potTidur = 0;
  const kebHitung = {};
  customerHp.filter(h => !berbayarHp.includes(h)).forEach(h => {
    const r = terbaru[h];
    const msIn = waktuKeMsCrm_((arahMap[h] || {}).last_in || (chatStat[h] || {}).last);
    const ms = isNaN(msIn) ? new Date(r.tanggal_chat).getTime() : msIn;
    const nilai = rataMinat(r.minat || 'Lainnya');
    if (!isNaN(ms) && (now - ms) <= DIAM_HARI * HARI) { aktif++; potAktif += nilai; }
    else { tidur++; potTidur += nilai; }
    ((aiByHp[h] || {}).keberatan || []).filter(k => k.status !== 'resolved').forEach(k => {
      const n = normKategoriCrm_(k.kategori); kebHitung[n] = (kebHitung[n] || 0) + 1;
    });
  });

  Object.keys(perMinat).forEach(m => { perProduk[m] = perMinat[m]; });
  const topProduk = Object.keys(perProduk).map(m => ({ m, s: perProduk[m].s, n: perProduk[m].n })).sort((a, b) => b.s - a.s).slice(0, 5);
  const topKeb = Object.keys(kebHitung).map(k => [k, kebHitung[k]]).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const top = hitungPrioritasHariIniCrm_().items.slice(0, 10);

  return { kontak: kontak.length, tipe, adaCs, leads: Object.keys(terbaru).length, customer: customerHp.length,
    berbayar: berbayarHp.length, repeat, omzet, cash, piutang, trx, rata, konversi,
    aktif, tidur, potAktif, potTidur, realistis: potAktif * konversi, topProduk, topKeb, top, DIAM_HARI };
}

function htmlRingkasanAsetCrm_() {
  const a = ringkasanAsetCrm_();
  const pct = (n, d) => d ? (n / d * 100).toFixed(1) + '%' : '0%';
  const kotak = (n, l, c) => `<div style="background:${c}; color:#fff; border-radius:10px; padding:12px 14px;"><div style="font-size:20px; font-weight:900;">${n}</div><div style="font-size:10px; text-transform:uppercase; opacity:.9; font-weight:700; margin-top:2px;">${l}</div></div>`;
  const tabel = (judul, kepala, isi) => `<div class="card"><h3 style="margin:0 0 6px; font-size:13px;">${judul}</h3><table><thead><tr>${kepala.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${isi || `<tr><td colspan="${kepala.length}" style="color:#94a3b8;">Belum ada data.</td></tr>`}</tbody></table></div>`;

  return `
  <h2>💎 Ringkasan Aset WhatsApp</h2>
  <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:10px;">
    ${kotak(a.kontak, 'Kontak WhatsApp yang pernah chat', '#4f46e5')}
    ${kotak(a.customer, 'Calon / pelanggan (lead)', '#0ea5e9')}
    ${kotak(a.berbayar + ' (' + pct(a.berbayar, a.customer) + ')', 'Sudah membayar (konversi historis)', '#10b981')}
    ${kotak(a.repeat, 'Pelanggan repeat (≥2 order)', '#0f766e')}
    ${kotak(rpC(a.omzet), 'Total penjualan', '#4f46e5')}
    ${kotak(rpC(a.cash), 'Cash masuk (DP + lunas)', '#10b981')}
    ${kotak(rpC(a.piutang), 'Sisa piutang', '#f59e0b')}
    ${kotak(rpC(a.rata), 'Rata-rata nilai order', '#0ea5e9')}
  </div>

  <div class="card" style="background:#f0fdf4; border-color:#bbf7d0;">
    <h3 style="margin:0 0 6px; font-size:13px;">💰 Potensi yang belum diambil</h3>
    <table><tbody>
      <tr><td><b>${a.aktif} lead aktif</b> belum membayar (chat terakhir ≤ ${a.DIAM_HARI} hari)</td><td style="text-align:right;">potensi bruto <b>${rpC(a.potAktif)}</b></td></tr>
      <tr><td>Estimasi realistis (potensi bruto × konversi historis ${pct(a.berbayar, a.customer)})</td><td style="text-align:right;"><b>${rpC(a.realistis)}</b></td></tr>
      <tr><td><b>${a.tidur} lead tidur</b> belum membayar (diam &gt; ${a.DIAM_HARI} hari): kandidat reaktivasi</td><td style="text-align:right;">potensi bruto <b>${rpC(a.potTidur)}</b></td></tr>
      <tr><td><b>${a.berbayar} pelanggan lama</b>: peluang repeat order / produk lanjutan (milestone, ulang tahun, dan seterusnya)</td><td style="text-align:right;">${a.repeat} sudah repeat</td></tr>
    </tbody></table>
    <small style="color:#64748b;">Potensi bruto = jumlah lead × rata-rata nilai order produk yang diminati (dari pelanggan yang sudah membayar). Ini batas atas, bukan prediksi. Estimasi realistis mengalikannya dengan konversi historis.</small>
  </div>

  <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
    ${tabel('Komposisi kontak WhatsApp', ['Tipe', 'Jumlah', '%'], Object.keys(a.tipe).map(k => `<tr><td>${esc(k)}</td><td>${a.tipe[k]}</td><td>${pct(a.tipe[k], a.kontak)}</td></tr>`).join(''))}
    ${tabel('Produk terlaris (omzet)', ['Produk', 'Order', 'Omzet'], a.topProduk.map(p => `<tr><td>${esc(p.m)}</td><td>${p.n}</td><td>${rpC(p.s)}</td></tr>`).join(''))}
    ${tabel('Keberatan open terbanyak (lead belum bayar)', ['Kategori', 'Lead'], a.topKeb.map(k => `<tr><td>${esc(k[0])}</td><td>${k[1]}</td></tr>`).join(''))}
    ${tabel('10 lead paling mendesak hari ini', ['Lead', 'Alasan'], a.top.map(x => `<tr><td><b>${esc(x.r.nama || x.r.no_hp)}</b><br><small>${esc((x.ai.produk && x.ai.produk !== 'Unknown') ? x.ai.produk : (x.r.minat || '-'))}</small></td><td>${x.alasan.map(z => esc(z.t)).join('<br>')}</td></tr>`).join(''))}
  </div>

  <div class="card"><h3 style="margin:0 0 6px; font-size:13px;">Kualitas data</h3>
    <small>Kontak yang sudah dianalisis AI: <b>${a.kontak - a.tipe['Belum dianalisis']}</b> dari ${a.kontak} (${pct(a.kontak - a.tipe['Belum dianalisis'], a.kontak)}).
    Kontak dengan balasan CS tercatat: <b>${a.adaCs}</b> (${pct(a.adaCs, a.kontak)}).
    ${a.adaCs === 0 ? '<b style="color:#b45309;">Balasan CS belum tercatat, jadi bagian "menunggu balasan" belum bisa diandalkan.</b>' : ''}
    Kontak Vendor dan Pribadi dikeluarkan dari hitungan lead.</small></div>`;
}

// ---------------------------------------------------------------------------
// Pembersih salinan panel agar cocok untuk laporan cetak
// ---------------------------------------------------------------------------
function bersihkanKlonCrm_(klon) {
  // canvas grafik -> gambar
  klon.querySelectorAll('canvas').forEach(c => {
    let src = '';
    try { const o = document.getElementById(c.id); src = o ? o.toDataURL('image/png') : ''; } catch (e) { src = ''; }
    if (src && src.length > 100) {
      const img = document.createElement('img');
      img.src = src; img.style.cssText = 'max-width:100%; height:auto; max-height:220px;';
      c.replaceWith(img);
    } else {
      const n = document.createElement('small'); n.textContent = '[grafik tidak tersedia]'; c.replaceWith(n);
    }
  });
  klon.querySelectorAll('button, select, input, textarea, script, .aksi-menu, .row-btn').forEach(e => e.remove());
  klon.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));
  // kolom interaktif
  klon.querySelectorAll('table').forEach(tb => {
    const ths = Array.from(tb.querySelectorAll('thead th'));
    const buang = [];
    ths.forEach((th, i) => { if (/^(aksi|pesan siap kirim)$/i.test(th.textContent.trim())) buang.push(i); });
    if (!buang.length) return;
    tb.querySelectorAll('tr').forEach(tr => {
      const cells = Array.from(tr.children);
      if (cells.length !== ths.length) return;
      buang.slice().reverse().forEach(i => cells[i].remove());
    });
  });
  return klon;
}

function ringkasFilterCrm_() {
  const F = [['fCari', 'Cari'], ['fMinat', 'Minat'], ['fStatus', 'Status'], ['fStage', 'Stage'], ['fSumber', 'Sumber'], ['fLokasi', 'Lokasi'],
    ['fChatS', 'Chat dari'], ['fChatE', 'Chat s/d'], ['fDpS', 'DP dari'], ['fDpE', 'DP s/d'], ['fLnS', 'Lunas dari'], ['fLnE', 'Lunas s/d'],
    ['fKeb', 'Keberatan'], ['fTipe', 'Tipe kontak']];
  const out = F.map(([id, nama]) => {
    const e = document.getElementById(id);
    const v = e && e.value;
    if (!v) return '';
    const teks = (e.selectedOptions && e.selectedOptions[0]) ? e.selectedOptions[0].text : v;
    return nama + ': ' + teks;
  }).filter(Boolean);
  return out.length ? out.join(' · ') : 'Tanpa filter tambahan';
}

// ---------------------------------------------------------------------------
// Susun dokumen. mode: 'tab' (menu yang sedang dibuka) | 'semua'
// ---------------------------------------------------------------------------
async function bangunHtmlLaporanCrm_(mode) {
  const tabAsli = tabCrm;
  const daftar = mode === 'semua' ? PDF_TAB_CRM_ : PDF_TAB_CRM_.filter(t => t.id === tabAsli);
  if (!daftar.length) throw new Error('Menu ini tidak punya tampilan laporan. Buka menu lain, lalu coba lagi.');

  const animAsli = (typeof Chart !== 'undefined') ? Chart.defaults.animation : undefined;
  if (typeof Chart !== 'undefined') Chart.defaults.animation = false;   // grafik langsung tergambar, bisa difoto
  const bagian = [];
  try {
    for (const t of daftar) {
      if (t.id === 'master') renderCrm();
      if (mode === 'semua' || t.id !== 'master') { if (mode === 'semua') gantiTabCrm(t.id); else renderAnalitik(); }
      await new Promise(r => setTimeout(r, 80));
      const panel = document.getElementById('panel_' + t.id);
      if (!panel) continue;
      bagian.push({ judul: t.judul, abaikanFilter: !!t.abaikanFilter, html: bersihkanKlonCrm_(panel.cloneNode(true)).innerHTML });
    }
  } finally {
    if (typeof Chart !== 'undefined') Chart.defaults.animation = animAsli;
    if (mode === 'semua' && tabCrm !== tabAsli) gantiTabCrm(tabAsli);
  }

  const tglId = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
  const tglFile = new Date(Date.now() + 7 * 3600000).toISOString().substring(0, 10);
  const judulDok = mode === 'semua' ? 'Laporan Aset WhatsApp' : bagian[0].judul;
  const filterTeks = ringkasFilterCrm_();

  const gaya = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
  const tautan = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => `<link rel="stylesheet" href="${l.href}">`).join('');

  const kepala = (judul, ket) => `<h1>${esc(judul)}</h1><div class="ket">SentuhanMomen3D · Bidan Motret · dicetak ${esc(tglId)}${ket ? ' · ' + esc(ket) : ''}</div>`;
  let isi = '';
  if (mode === 'semua') {
    isi += `<div class="bagian pertama">${kepala('Laporan Aset WhatsApp', 'Filter pada menu lain: ' + filterTeks)}${htmlRingkasanAsetCrm_()}</div>`;
    bagian.forEach(b => {
      isi += `<div class="bagian"><h2>${esc(b.judul)}</h2><div class="ket">${b.abaikanFilter ? 'Tidak terpengaruh filter.' : 'Filter: ' + esc(filterTeks)}</div>${b.html}</div>`;
    });
  } else {
    const b = bagian[0];
    isi += `<div class="bagian pertama">${kepala(b.judul, b.abaikanFilter ? 'Tidak terpengaruh filter' : 'Filter: ' + filterTeks)}${b.html}</div>`;
  }

  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>${esc(judulDok)} - ${tglFile}</title>${tautan}<style>${gaya}</style><style>
    @page { size: A4 landscape; margin: 10mm 10mm 14mm; }
    html, body { background:#fff !important; color:#0f172a; font-family:'Segoe UI', Arial, sans-serif; font-size:11px; }
    body { padding:0; margin:0; display:block !important; }
    h1 { font-size:20px; margin:0 0 2px; } h2 { font-size:15px; margin:0 0 4px; padding-bottom:4px; border-bottom:2px solid #4f46e5; }
    .ket { color:#64748b; font-size:10.5px; margin-bottom:8px; }
    .bagian { page-break-before:always; } .bagian.pertama { page-break-before:avoid; }
    table { width:100%; border-collapse:collapse; font-size:10px; }
    th, td { border-bottom:1px solid #e2e8f0; padding:3px 6px; text-align:left; vertical-align:top; }
    thead th { background:#f1f5f9; } thead { display:table-header-group; } tr { page-break-inside:avoid; }
    .card { border:1px solid #e2e8f0; border-radius:8px; padding:8px 10px; margin-bottom:8px; background:#fff; box-shadow:none; page-break-inside:avoid; }
    .table-responsive, .table-compact-wrap { overflow:visible !important; max-height:none !important; }
    .fu-kpi-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:8px; }
    .fu-kpi-card { padding:8px 10px; box-shadow:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    #pdfFooter { position:fixed; bottom:0; left:0; right:0; font-size:9px; color:#94a3b8; text-align:center; }
  </style></head><body>${isi}<div id="pdfFooter">${esc(judulDok)} · CRM SentuhanMomen3D · rahasia internal</div></body></html>`;

  return { html, judul: judulDok + ' - ' + tglFile };
}

// ---------------------------------------------------------------------------
// Tombol: eksporPdfCrm('tab') atau eksporPdfCrm('semua')
// ---------------------------------------------------------------------------
async function eksporPdfCrm(mode) {
  const badge = document.getElementById('bgRefreshBadge');
  const tampil = (teks, warna) => { if (badge) { badge.style.display = 'inline-block'; badge.style.background = warna || '#0f172a'; badge.textContent = teks; } };
  try {
    tampil('📄 Menyiapkan PDF…');
    const { html, judul } = await bangunHtmlLaporanCrm_(mode === 'semua' ? 'semua' : 'tab');

    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0; visibility:hidden;';
    document.body.appendChild(f);
    await new Promise(res => {
      let selesai = false;
      const fin = () => { if (!selesai) { selesai = true; res(); } };
      f.onload = fin;
      const d = f.contentWindow.document;
      d.open(); d.write(html); d.close();
      setTimeout(fin, 1500);
    });

    const judulAsli = document.title;
    document.title = judul;   // nama file default di dialog "Simpan sebagai PDF"
    const bersih = () => { document.title = judulAsli; setTimeout(() => f.remove(), 1000); };
    f.contentWindow.onafterprint = bersih;
    setTimeout(() => { if (document.title === judul) bersih(); }, 120000);
    f.contentWindow.focus();
    f.contentWindow.print();
    if (badge) badge.style.display = 'none';
  } catch (err) {
    console.error('Ekspor PDF gagal:', err);
    tampil('⚠️ ' + (err.message || 'Ekspor PDF gagal'), '#b91c1c');
    setTimeout(() => { if (badge) badge.style.display = 'none'; }, 5000);
  }
}
