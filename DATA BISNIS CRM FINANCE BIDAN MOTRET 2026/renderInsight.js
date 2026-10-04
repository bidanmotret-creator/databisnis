function renderInsight() {
  const el = document.getElementById('insightBody');
  if (!el) return;
  if (typeof layarSedangDiedit_ === 'function' && layarSedangDiedit_(el)) return;   // jangan timpa pesan yang sedang diedit
  if (window.playbookData === undefined) muatPlaybookCrm();
  const pbRows = Array.isArray(window.playbookData) ? window.playbookData : [];

  // nama kategori lama -> baru (agar tetap benar sebelum migrasi dijalankan)
  const LEGACY = { 'keuangan/harga': 'Harga paket', 'waktu': 'Slot/jadwal', 'takut/ragu keamanan bayi': 'Ragu keamanan bayi', 'bingung memilih produk': 'Bingung pilih paket' };
  const normKat = k => LEGACY[String(k || '').trim().toLowerCase()] || String(k || 'Lainnya').trim() || 'Lainnya';

  const PLAYBOOK = {
    'Harga paket': 'Tanya diagnosa dulu ("Dibanding apa, Bun?"), tunjukkan isi paket + testimoni, tawarkan opsi naik/turun paket. Jangan langsung diskon.',
    'Biaya transport/lokasi': 'Kirim tabel biaya transport per wilayah, dan tawarkan paket yang sudah termasuk transport.',
    'Slot/jadwal': 'Tawarkan 2 slot pasti (mis. "Sabtu 10.00 atau Minggu 08.00"), bukan "kapan Kakak mau?". Yang kerja weekday: langsung tawarkan weekend.',
    'Izin pasangan/keluarga': 'Jangan menekan. Kirim ringkasan 1 halaman (paket, harga, jadwal) untuk diteruskan ke suami, lalu tentukan hari cek berikutnya.',
    'Belum waktunya': 'Jangan dikejar. Masuk nurturing: edukasi persiapan dan pengingat waktu ideal booking (sekitar 2 bulan sebelum HPL).',
    'Bandingkan studio lain': 'Tonjolkan keunggulan unik, testimoni, dan garansi. Hindari perang harga.',
    'Ragu keamanan bayi': 'Kirim bukti keamanan: SOP, portofolio, testimoni ibu lain, atau video proses.',
    'Bingung pilih paket': 'Beri maksimal 2 rekomendasi berdasarkan HPL/usia bayi dan motivasi (Kenangan, Hadiah, Dokumentasi).',
    'Lainnya': 'Baca percakapannya dan tentukan tindakan secara manual.'
  };

  // panduan: dari DB_Playbook (baris pertama berpanduan), jika kosong pakai bawaan
  const panduan = kat => { const p = pbRows.find(x => x.kategori === kat && x.panduan); return p ? p.panduan : (PLAYBOOK[kat] || PLAYBOOK['Lainnya']); };
  // pesan siap kirim per sentuhan; baris khusus produk menang atas "Semua"
  const pbUntuk = (kat, produk) => {
    const pr = String(produk || '').toLowerCase(), per = {};
    pbRows.filter(x => x.kategori === kat && x.template).forEach(x => {
      const p = String(x.produk || 'Semua').toLowerCase();
      if (p !== 'semua' && p !== pr) return;
      const ada = per[x.sentuhan];
      if (!ada || (ada.produk.toLowerCase() === 'semua' && p !== 'semua')) per[x.sentuhan] = x;
    });
    return Object.keys(per).map(Number).sort((a, b) => a - b).slice(0, 4).map(n => per[n]);
  };
  const isiTemplate = (tpl, x) => {
    const depan = String(x.r.nama || '').trim().split(/\s+/)[0] || '';
    const sapaan = /^[A-Za-z]{2,}$/.test(depan) ? 'Kak ' + depan.charAt(0).toUpperCase() + depan.slice(1).toLowerCase() : 'Kak';
    const produk = (x.ai.produk && x.ai.produk !== 'Unknown') ? x.ai.produk : (x.r.minat || 'layanan kami');
    const lokasi = x.ai.lokasi || (x.r.lokasi && x.r.lokasi !== '-' ? x.r.lokasi : '') || '[LOKASI]';
    return String(tpl).split('[NAMA]').join(sapaan).split('[PRODUK]').join(produk).split('[LOKASI]').join(lokasi);
  };

  // 1 baris per nomor (dari filter aktif), hanya Customer
  const seen = {}, rows = [];
  (listAktif || []).forEach(r => {
    const h = hpNorm(r.no_hp);
    if (!h || seen[h]) return;
    seen[h] = true;
    const ai = aiByHp[h];
    if (!ai || !ai.produk && !ai.stage_funnel && !ai.keberatan) return;   // belum dianalisis
    if (ai.tipe_kontak && ai.tipe_kontak !== 'Customer' && !(r.total > 0)) return;
    const keb = (Array.isArray(ai.keberatan) ? ai.keberatan : []).map(k => ({ kategori: normKat(k.kategori), status: k.status === 'resolved' ? 'resolved' : 'open', bukti: k.bukti || '' }));
    rows.push({ r, h, ai, keb, open: keb.filter(k => k.status === 'open'), sudahBayar: kategoriStatus_(r.status) !== 'pending' });
  });

  const aksiNama = r => esc((r.nama || '').replace(/'/g, ''));
  const tombol = x => `<button class="row-btn" style="background:#0ea5e9;" onclick="bukaChat('${esc(x.r.no_hp)}','${aksiNama(x.r)}')">💬 Chat</button> <a class="row-btn" style="background:#16a34a; text-decoration:none; display:inline-block;" href="https://wa.me/${x.h}" target="_blank">📲 WA</a>`;
  const namaLead = x => `<b>${esc(x.r.nama || x.r.no_hp)}</b> <small style="color:#64748b;">${esc(x.ai.produk && x.ai.produk !== 'Unknown' ? x.ai.produk : (x.r.minat || '-'))} · ${esc(x.ai.timeline || '-')}</small>`;

  // ---------- KPI ----------
  const adaOpen = rows.filter(x => x.open.length).length;
  const siapBooking = rows.filter(x => x.ai.booking).length;
  const tungguPasangan = rows.filter(x => x.open.some(k => k.kategori === 'Izin pasangan/keluarga')).length;
  const thisWeek = rows.filter(x => x.ai.timeline === 'This Week' && !x.sudahBayar).length;
  const kpi = `<div class="fu-kpi-grid" style="margin-bottom:14px;">
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${rows.length}</div><div class="l">Lead Dianalisis</div></div>
    <div class="fu-kpi-card fu-kpi-3"><div class="n">${adaOpen}</div><div class="l">Punya Keberatan Open</div></div>
    <div class="fu-kpi-card fu-kpi-2"><div class="n">${tungguPasangan}</div><div class="l">Menunggu Pasangan</div></div>
    <div class="fu-kpi-card fu-kpi-4"><div class="n">${thisWeek}</div><div class="l">Timeline Minggu Ini (belum bayar)</div></div>
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${siapBooking}</div><div class="l">Sinyal Booking 🔥</div></div></div>`;

  // ---------- 1. RINGKASAN KEBERATAN ----------
  const perKat = {};
  rows.forEach(x => x.keb.forEach(k => {
    const o = perKat[k.kategori] || (perKat[k.kategori] = { open: [], resolved: 0 });
    if (k.status === 'open') o.open.push({ x, k }); else o.resolved++;
  }));
  const katList = Object.keys(perKat).sort((a, b) => perKat[b].open.length - perKat[a].open.length);
  const htmlKeb = katList.map(kat => {
    const o = perKat[kat];
    const detail = o.open.slice(0, 15).map(({ x, k }) => `<div style="padding:6px 0; border-top:1px solid #f1f5f9;">${namaLead(x)}<br>
        <small style="color:#475569;">“${esc(k.bukti)}”</small>
        ${x.ai.next_action ? `<br><small style="color:#14532d;">🎯 ${esc(String(x.ai.next_action).substring(0, 140))}</small>` : ''}<br>${tombol(x)}</div>`).join('');
    return `<tr><td style="vertical-align:top;"><b>${esc(kat)}</b></td>
      <td style="vertical-align:top; text-align:center;"><span class="fu-badge b-red">${o.open.length}</span></td>
      <td style="vertical-align:top; text-align:center;">${o.resolved}</td>
      <td style="vertical-align:top; font-size:12.5px; color:#14532d; max-width:340px;">${esc(panduan(kat))}</td>
      <td style="vertical-align:top; min-width:260px;">${o.open.length ? `<details><summary style="cursor:pointer; font-size:12.5px; color:#4338ca;">Lihat ${o.open.length} lead</summary>${detail}${o.open.length > 15 ? '<small style="color:#94a3b8;">…15 teratas</small>' : ''}</details>` : '<small style="color:#94a3b8;">-</small>'}</td></tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:16px;">Belum ada keberatan pada filter ini.</td></tr>';

  // ---------- 2. RINGKASAN KEBUTUHAN ----------
  const hitung = (fn, multi) => {
    const m = {};
    rows.forEach(x => { [].concat(fn(x)).forEach(v => { v = String(v || '').trim(); if (v && v !== 'Unknown') m[v] = (m[v] || 0) + 1; }); });
    return Object.keys(m).map(k => [k, m[k]]).sort((a, b) => b[1] - a[1]);
  };
  const mini = (judul, arr, catatan) => `<div class="card" style="flex:1; min-width:210px;"><h4 style="margin:0 0 8px; font-size:13px;">${judul}</h4>
    ${arr.slice(0, 8).map(([k, n]) => `<div style="display:flex; justify-content:space-between; font-size:12.5px; padding:3px 0; border-bottom:1px solid #f1f5f9;"><span>${esc(k)}</span><b>${n}</b></div>`).join('') || '<small style="color:#94a3b8;">Belum ada data.</small>'}
    ${catatan ? `<small style="color:#94a3b8;">${catatan}</small>` : ''}</div>`;
  const htmlKebutuhan = `<div style="display:flex; gap:10px; flex-wrap:wrap;">
    ${mini('Produk Diminati', hitung(x => x.ai.produk))}
    ${mini('Timeline Sesi', hitung(x => x.ai.timeline))}
    ${mini('Motivasi', hitung(x => x.ai.motivasi))}
    ${mini('Lokasi Terbanyak', hitung(x => x.ai.lokasi))}
    ${mini('Minat Lain', hitung(x => x.ai.minat_lain || []), 'Data lama mungkin tercemar menu bot.')}</div>`;

  // ---------- 3. SARAN TINDAKAN (prioritas) ----------
  const bobotTl = { 'This Week': 3, 'This Month': 2, 'Future': 1 };
  const bobotIn = { 'Very High': 3, 'High': 2, 'Medium': 1 };
  const antrean = rows.filter(x => !x.sudahBayar && !x.ai.booking && (x.ai.next_action || x.open.length))
    .map(x => ({ x, skor: (bobotTl[x.ai.timeline] || 0) * 3 + (bobotIn[x.ai.intent] || 0) * 2 + Math.min(x.open.length, 2) }))
    .filter(a => !(a.x.ai.stage_funnel === 'Menunggu timing'))   // nurturing tidak dikejar
    .sort((a, b) => b.skor - a.skor).slice(0, 25);
  const htmlAksi = antrean.map(({ x }) => `<tr>
    <td style="vertical-align:top;">${namaLead(x)}<br><small style="color:#64748b;">Intent: ${esc(x.ai.intent || '-')}${x.ai.stage_funnel ? ' · ' + esc(x.ai.stage_funnel) : ''}</small></td>
    <td style="vertical-align:top;">${x.open.map(k => `<span style="display:inline-block; margin:0 3px 3px 0; padding:2px 7px; border-radius:10px; font-size:11px; font-weight:700; background:#fee2e2; color:#991b1b;">● ${esc(k.kategori)}</span>`).join('') || '<small style="color:#94a3b8;">-</small>'}</td>
    <td style="vertical-align:top; font-size:12.5px; max-width:380px;">${x.ai.next_action ? `🎯 ${esc(x.ai.next_action)}` : ''}${x.open[0] ? `<br><small style="color:#14532d;">Panduan: ${esc(panduan(x.open[0].kategori))}</small>` : ''}</td>
    <td style="vertical-align:top; min-width:300px;">${(() => {
      const msgs = x.open[0] ? pbUntuk(x.open[0].kategori, x.ai.produk) : [];
      if (!msgs.length) return '<small style="color:#94a3b8;">-</small>';
      return `<details><summary style="cursor:pointer; font-size:12.5px; color:#4338ca;">✉️ ${msgs.length} pesan siap kirim</summary>` + msgs.map(m => {
        const id = 'pb_' + x.h + '_' + m.sentuhan;
        return `<div style="margin-top:6px;"><small><b>Sentuhan ${m.sentuhan}</b></small>
          <textarea id="${id}" rows="5" style="width:100%; font-size:12.5px; box-sizing:border-box;">${esc(isiTemplate(m.template, x))}</textarea>
          <button class="row-btn" style="background:#4f46e5;" onclick="pbAksi('salin','${id}','${x.h}')">📋 Salin</button>
          <button class="row-btn" style="background:#16a34a;" onclick="pbAksi('wa','${id}','${x.h}')">📲 Buka WA</button></div>`;
      }).join('') + '</details>';
    })()}</td>
    <td style="vertical-align:top; white-space:nowrap;">${tombol(x)}</td></tr>`).join('')
    || '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:16px;">Tidak ada lead yang perlu ditindaklanjuti pada filter ini.</td></tr>';

  const th = 'background:#f1f5f9;';
  el.innerHTML = kpi +
    `<div class="card" style="margin-bottom:14px;"><h4 style="margin:0 0 4px;">🚧 Ringkasan Keberatan</h4>
      <small style="color:#64748b;">Urut dari yang paling banyak masih open. Klik "Lihat lead" untuk daftar dan buka chat.</small>
      <div class="table-responsive" style="margin-top:8px;"><table><thead><tr style="${th}"><th>Kategori</th><th>Open</th><th>Selesai</th><th>Panduan jawaban</th><th>Lead</th></tr></thead><tbody>${htmlKeb}</tbody></table></div></div>` +
    `<div class="card" style="margin-bottom:14px;"><h4 style="margin:0 0 8px;">🧩 Ringkasan Kebutuhan Customer</h4>${htmlKebutuhan}</div>` +
    `<div class="card"><h4 style="margin:0 0 4px;">🎯 Saran Tindakan Prioritas</h4>
      <small style="color:#64748b;">Belum bayar dan belum booking, urut timeline (Minggu Ini dulu), intent, lalu jumlah keberatan. Maks 25. Lead "Menunggu timing" tidak ditampilkan.</small>
      <div class="table-responsive" style="margin-top:8px;"><table><thead><tr style="${th}"><th>Lead</th><th>Keberatan open</th><th>Saran tindakan</th><th>Pesan siap kirim</th><th>Aksi</th></tr></thead><tbody>${htmlAksi}</tbody></table></div></div>`;
}
