// =========================================================================
// TAB: ANALISIS & EVALUASI
// =========================================================================
function renderAnalisisEvaluasi() {
  if (!dataAnalisisEvaluasi) return;
  var d = dataAnalisisEvaluasi;

  var totalStage = Object.values(d.funnelStage || {}).reduce((a, b) => a + b, 0);
  var totalGagalSuksesEkstrak = (d.tingkatSuksesEkstrak.berhasil || 0) + (d.tingkatSuksesEkstrak.gagal || 0);
  var persenSukses = totalGagalSuksesEkstrak ? Math.round((d.tingkatSuksesEkstrak.berhasil / totalGagalSuksesEkstrak) * 100) : 0;
  var totalError = Object.values(d.errorPerJenis || {}).reduce((a, b) => a + b, 0);

  document.getElementById('evalKpiGrid').innerHTML = `
    <div class="fu-kpi-card fu-kpi-1"><div class="n">${d.totalNomorUnik || 0}</div><div class="l">Total Nomor Unik Chat</div></div>
    <div class="fu-kpi-card fu-kpi-2"><div class="n">${d.totalPesanMasuk || 0}</div><div class="l">Total Pesan Masuk</div></div>
    <div class="fu-kpi-card fu-kpi-4"><div class="n">${persenSukses}%</div><div class="l">Sukses Ekstrak Usia/Domisili</div></div>
    <div class="fu-kpi-card fu-kpi-5"><div class="n">${totalError}</div><div class="l">Total Error AI Tercatat</div></div>
  `;

  const labelStageEval = { 0: "Belum Dikirim Menu", 4: "Menunggu Pilih Layanan", 1: "Menunggu Jawaban", 2: "PL Terkirim", 3: "Perlu Review CS", 100: "Repeat Customer" };
  document.getElementById('evalFunnelChart').innerHTML = Object.keys(d.funnelStage || {}).sort().map(st => {
    var jumlah = d.funnelStage[st];
    var persen = totalStage ? Math.round((jumlah / totalStage) * 100) : 0;
    return `<div style="margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px;">
        <span>${labelStageEval[st] || ('Stage ' + st)}</span><span><b>${jumlah}</b> (${persen}%)</span>
      </div>
      <div style="background:#f1f5f9; border-radius:6px; height:10px;">
        <div style="background:#4f46e5; height:10px; border-radius:6px; width:${persen}%;"></div>
      </div>
    </div>`;
  }).join('') || '<p style="color:#94a3b8;">Belum ada data.</p>';

  var totalPopularitas = Object.values(d.popularitasLayanan || {}).reduce((a, b) => a + b, 0);
  var urutPopularitas = Object.entries(d.popularitasLayanan || {}).sort((a, b) => b[1] - a[1]);
  document.getElementById('evalPopularitasChart').innerHTML = urutPopularitas.map(([nama, jumlah]) => {
    var persen = totalPopularitas ? Math.round((jumlah / totalPopularitas) * 100) : 0;
    return `<div style="margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; font-size:12.5px; margin-bottom:3px;">
        <span>${nama}</span><span><b>${jumlah}</b> (${persen}%)</span>
      </div>
      <div style="background:#f1f5f9; border-radius:6px; height:10px;">
        <div style="background:#10b981; height:10px; border-radius:6px; width:${persen}%;"></div>
      </div>
    </div>`;
  }).join('') || '<p style="color:#94a3b8;">Belum ada data.</p>';

  document.getElementById('evalErrorChart').innerHTML = Object.entries(d.errorPerJenis || {}).map(([jenis, jumlah]) => `
    <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:12.5px;">
      <span>${labelJenisPrompt_(jenis)}</span><span style="font-weight:800; color:#ef4444;">${jumlah}</span>
    </div>
  `).join('') || '<p style="color:#94a3b8;">Belum ada error tercatat. Bagus!</p>';
}

// =========================================================================
// SUB-TAB: PENGATURAN SISTEM
// =========================================================================
function renderPengaturanSistem() {
  if (!dataPengaturanSistem) return;
  document.getElementById('sisDripJamH4').value = dataPengaturanSistem.drip_jam_h4;
  document.getElementById('sisDripJamH20').value = dataPengaturanSistem.drip_jam_h20;
  document.getElementById('sisDripMaxReminder').value = dataPengaturanSistem.drip_max_reminder;
  document.getElementById('sisBatasGagalEskalasi').value = dataPengaturanSistem.batas_gagal_ekstrak_eskalasi;
}

async function simpanPengaturanSistem() {
  const params = new URLSearchParams();
  params.append('action', 'simpanPengaturanSistem');
  params.append('dripJamH4', document.getElementById('sisDripJamH4').value);
  params.append('dripJamH20', document.getElementById('sisDripJamH20').value);
  params.append('dripMaxReminder', document.getElementById('sisDripMaxReminder').value);
  params.append('batasGagalEskalasi', document.getElementById('sisBatasGagalEskalasi').value);

  try {
    const res = await fetch(scriptURL, { method: 'POST', body: params });
    const result = await res.json();
    if (result.result === 'success') {
      alert('✅ Pengaturan sistem berhasil disimpan.');
      await tarikDataFollowUp();
    } else {
      alert('❌ Gagal: ' + (result.message || 'unknown'));
    }
  } catch (err) {
    alert('❌ Gagal koneksi: ' + err);
  }
}