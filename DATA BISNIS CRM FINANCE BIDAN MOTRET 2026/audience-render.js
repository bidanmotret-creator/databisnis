
// ======================= TAB: AUDIENCE INTELLIGENCE =======================
// Scoring: CTR 30%, CPL 40% (dibalik - makin rendah makin bagus), Volume Leads 30%
// (Booking Rate belum bisa dipakai karena leads CRM belum tercatat per adset/audience -
// itu perlu UTM tracking per adset, rencana pengembangan berikutnya)

function renderAudienceTab() {
    if (!dataAudience || dataAudience.length === 0) {
        document.getElementById('bAudienceProfile').innerHTML =
            '<tr><td colspan="14" class="empty-state">Belum ada data. Jalankan jalankanPhase2Lengkap() di Apps Script dulu, lalu refresh halaman ini.</td></tr>';
        document.getElementById('aiRekomendasiTerbaik').innerHTML = '<div class="empty-state">Belum ada data.</div>';
        document.getElementById('aiRekomendasiHentikan').innerHTML = '<div class="empty-state">Belum ada data.</div>';
        return;
    }

    let data = dataAudience.filter(a => a.total_spend > 0);

    let maxCTR = Math.max(...data.map(a => a.ctr_persen), 0.01);
    let cplValid = data.filter(a => a.cpl > 0).map(a => a.cpl);
    let minCPL = cplValid.length ? Math.min(...cplValid) : 0;
    let maxCPL = cplValid.length ? Math.max(...cplValid) : 1;
    let maxLeads = Math.max(...data.map(a => a.total_leads_meta), 0.01);

    data.forEach(a => {
        let skorCTR = (a.ctr_persen / maxCTR) * 100;
        let skorCPL = a.cpl > 0 ? (1 - (a.cpl - minCPL) / ((maxCPL - minCPL) || 1)) * 100 : 0;
        let skorVolume = (a.total_leads_meta / maxLeads) * 100;
        a.skor = Math.round(skorCTR * 0.3 + skorCPL * 0.4 + skorVolume * 0.3);
    });

    data.sort((a, b) => b.skor - a.skor);

    let totalSpend = data.reduce((s, a) => s + a.total_spend, 0);
    let avgCPL = cplValid.length ? Math.round(cplValid.reduce((s, v) => s + v, 0) / cplValid.length) : 0;
    let avgCTR = data.length ? (data.reduce((s, a) => s + a.ctr_persen, 0) / data.length).toFixed(2) : 0;

    document.getElementById('aiTotalProfile').innerText = data.length;
    document.getElementById('aiAvgCPL').innerText = 'Rp ' + rp(avgCPL);
    document.getElementById('aiAvgCTR').innerText = avgCTR + '%';
    document.getElementById('aiTotalSpend').innerText = 'Rp ' + rp(totalSpend);

    let spendRataRata = totalSpend / (data.length || 1);
    let kandidatTerbaik = data.filter(a => a.skor >= 65).slice(0, 5);
    let kandidatHentikan = data.filter(a => a.skor < 35 && a.total_spend >= spendRataRata * 0.3)
        .sort((a, b) => a.skor - b.skor).slice(0, 5);

    function labelAudience(a) {
        let usia = (a.age_min || a.age_max) ? `${a.age_min || '?'}-${a.age_max || '?'} th` : 'Semua usia';
        let gender = a.genders || 'All';
        let interest = a.top_interests || '(tanpa interest spesifik)';
        return `${usia} · ${gender} · ${interest}`;
    }

    document.getElementById('aiRekomendasiTerbaik').innerHTML = kandidatTerbaik.length
        ? kandidatTerbaik.map(a => `
            <div class="rekomendasi-item">
                <div class="judul">${a.profile_id} <span class="skor skor-tinggi">Skor ${a.skor}</span></div>
                <div class="detail">${labelAudience(a)}</div>
                <div class="detail">CTR ${a.ctr_persen.toFixed(2)}% · CPL Rp ${rp(a.cpl)} · ${a.total_leads_meta} leads · ${a.platforms || '-'}</div>
            </div>
        `).join('')
        : '<div class="empty-state">Belum ada audience dengan skor tinggi (≥65). Kumpulkan data performa lebih banyak dulu.</div>';

    document.getElementById('aiRekomendasiHentikan').innerHTML = kandidatHentikan.length
        ? kandidatHentikan.map(a => `
            <div class="rekomendasi-item">
                <div class="judul">${a.profile_id} <span class="skor skor-rendah">Skor ${a.skor}</span></div>
                <div class="detail">${labelAudience(a)}</div>
                <div class="detail">CTR ${a.ctr_persen.toFixed(2)}% · CPL ${a.cpl > 0 ? 'Rp ' + rp(a.cpl) : '-'} · Sudah spend Rp ${rp(a.total_spend)}</div>
            </div>
        `).join('')
        : '<div class="empty-state">Tidak ada audience yang jelas-jelas kurang efektif saat ini. 👍</div>';

    document.getElementById('bAudienceProfile').innerHTML = data.map(a => {
        let rekomendasi = a.skor >= 65
            ? '<span style="color:#166534; font-weight:700;">🏆 Scale Up</span>'
            : (a.skor < 35 ? '<span style="color:#991b1b; font-weight:700;">⚠️ Hentikan</span>' : '<span style="color:#64748b;">Netral</span>');

        return `<tr>
            <td><strong>${a.profile_id}</strong></td>
            <td>${(a.age_min || a.age_max) ? `${a.age_min || '?'}-${a.age_max || '?'}` : '-'}</td>
            <td>${a.genders || '-'}</td>
            <td style="text-align:left;">${a.top_interests || '-'}</td>
            <td style="text-align:left;">${a.platforms || '-'}</td>
            <td>${a.jumlah_adset}</td>
            <td>Rp ${rp(a.total_spend)}</td>
            <td>${rp(a.total_impressions)}</td>
            <td>${a.ctr_persen.toFixed(2)}%</td>
            <td>${a.total_leads_meta}</td>
            <td>${a.cpl > 0 ? 'Rp ' + rp(a.cpl) : '-'}</td>
            <td>${a.video_completion_rate_persen ? a.video_completion_rate_persen.toFixed(1) + '%' : '-'}</td>
            <td><strong>${a.skor}</strong></td>
            <td>${rekomendasi}</td>
        </tr>`;
    }).join('');

   window._audienceScored = data;

    // Bagian yang sudah jalan (murni dari data audience)
    if (typeof renderClusterSection_ === 'function') renderClusterSection_();
    if (typeof renderPlacementFromAudienceSection_ === 'function') renderPlacementFromAudienceSection_();
    if (typeof renderAudienceTypeImpactSection_ === 'function') renderAudienceTypeImpactSection_();
if (typeof renderKlasifikasiTipeAudience_ === 'function') renderKlasifikasiTipeAudience_(); // BARU
    if (typeof renderCreativeFatigueSection_ === 'function') renderCreativeFatigueSection_();

    // Bagian wilayah, kota, konten - ini yang sebelumnya tidak pernah terpanggil
    if (typeof isiFilterCampaignRegionKonten === 'function') isiFilterCampaignRegionKonten();
    if (typeof isiFilterCampaignKota === 'function') isiFilterCampaignKota();
    if (typeof renderRegionTab === 'function') renderRegionTab();
    if (typeof renderCityEstimateTab === 'function') renderCityEstimateTab();
    if (typeof renderContentTab === 'function') renderContentTab();

    // BARU: agregasi per jenis konten (lihat fungsi baru di bagian 3)
    if (typeof renderCreativeTypeTab === 'function') renderCreativeTypeTab();

    // HARUS PALING TERAKHIR - baca window._regionBest & window._contentBest
    // yang baru di-set oleh renderRegionTab() dan renderContentTab() di atas
    if (typeof renderRekomendasiOptimal_ === 'function') renderRekomendasiOptimal_();
}

// ======================= WILAYAH (REGION/PROVINSI) =======================

function isiFilterCampaignRegionKonten() {
    const daftarCampaign = [...new Set([
        ...(dataRegion || []).map(r => r.campaign_name),
        ...(dataContent || []).map(c => c.campaign_name)
    ])].filter(Boolean).sort();

    if (window.msFilterState['msFilterRegionCampaign']) {
        updateMsFilterOptions('msFilterRegionCampaign', daftarCampaign);
    } else if (typeof initMsFilter === 'function') {
        initMsFilter('msFilterRegionCampaign', daftarCampaign, renderRegionTab);
    }

    if (window.msFilterState['msFilterContentCampaign']) {
        updateMsFilterOptions('msFilterContentCampaign', daftarCampaign);
    } else if (typeof initMsFilter === 'function') {
        initMsFilter('msFilterContentCampaign', daftarCampaign, renderContentTab);
    }
}

function renderRegionTab() {
    const tbody = document.getElementById('bRegion');
    if (!dataRegion || dataRegion.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Belum ada data. Jalankan sync di MaieRegionSync.gs dulu, lalu refresh halaman ini.</td></tr>';
        return;
    }

    const selectedCampaigns = typeof getMsFilterSelected === 'function' ? getMsFilterSelected('msFilterRegionCampaign') : [];
    const fStart = document.getElementById('fRegionStart')?.value || '';
    const fEnd = document.getElementById('fRegionEnd')?.value || '';

    let data = dataRegion.filter(r => {
        if (selectedCampaigns.length > 0 && !selectedCampaigns.includes(r.campaign_name)) return false;
        if (fStart && r.tanggal < fStart) return false;
        if (fEnd && r.tanggal > fEnd) return false;
        return true;
    });

    const agregat = {};
    data.forEach(r => {
        const key = (r.country || '-') + '||' + (r.region || '-');
        if (!agregat[key]) {
            agregat[key] = { country: r.country || '-', region: r.region || '-', spend: 0, impressions: 0, reach: 0, link_clicks: 0, results: 0 };
        }
        agregat[key].spend += Number(r.spend) || 0;
        agregat[key].impressions += Number(r.impressions) || 0;
        agregat[key].reach += Number(r.reach) || 0;
        agregat[key].link_clicks += Number(r.link_clicks) || 0;
        agregat[key].results += Number(r.results) || 0;
    });

    let barisWilayah = Object.values(agregat).map(a => {
        a.ctr = a.impressions > 0 ? (a.link_clicks / a.impressions * 100) : 0;
        a.costPerResult = a.results > 0 ? (a.spend / a.results) : 0;
        return a;
    }).sort((a, b) => b.reach - a.reach);

    tbody.innerHTML = barisWilayah.length ? barisWilayah.map(a => `
        <tr>
            <td style="text-align:left;">${a.country}</td>
            <td style="text-align:left;">${a.region}</td>
            <td>${rp(a.reach)}</td>
            <td>${rp(a.impressions)}</td>
            <td>Rp ${rp(Math.round(a.spend))}</td>
            <td>${a.ctr.toFixed(2)}%</td>
            <td>${a.results}</td>
            <td>${a.costPerResult > 0 ? 'Rp ' + rp(Math.round(a.costPerResult)) : '-'}</td>
        </tr>
    `).join('') : '<tr><td colspan="8" class="empty-state">Tidak ada data untuk filter ini.</td></tr>';
window._regionBest = barisWilayah.filter(a => a.results >= 3).sort((a, b) => (a.costPerResult || Infinity) - (b.costPerResult || Infinity))[0];
    gambarChartRegionReach(barisWilayah.slice(0, 10));
}

function gambarChartRegionReach(top10Wilayah) {
    const ctx = document.getElementById('chartRegionReach');
    if (!ctx) return;
    if (window.chartRegionReachInstance) window.chartRegionReachInstance.destroy();

    window.chartRegionReachInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10Wilayah.map(a => a.region !== '-' ? a.region : a.country),
            datasets: [{
                label: 'Reach',
                data: top10Wilayah.map(a => a.reach),
                backgroundColor: '#0891b2'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: 'Top 10 Wilayah berdasarkan Reach' } }
        }
    });
}

// ======================= KOTA/KABUPATEN (ESTIMASI DARI TARGETING) =======================

function isiFilterCampaignKota() {
    const daftarCampaign = [...new Set((dataAdsetCityTargeting || []).map(r => r.campaign_name))].filter(Boolean).sort();

    if (window.msFilterState['msFilterCityCampaign']) {
        updateMsFilterOptions('msFilterCityCampaign', daftarCampaign);
    } else if (typeof initMsFilter === 'function') {
        initMsFilter('msFilterCityCampaign', daftarCampaign, renderCityEstimateTab);
    }
}

function renderCityEstimateTab() {
    const tbody = document.getElementById('bCity');
    if (!dataAdsetPerformance || !dataAdsetCityTargeting || dataAdsetPerformance.length === 0 || dataAdsetCityTargeting.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data. Pastikan Adset_Targeting & Adset_Performance sudah tersinkron (Phase 1), lalu refresh halaman ini.</td></tr>';
        return;
    }

    const selectedCampaigns = typeof getMsFilterSelected === 'function' ? getMsFilterSelected('msFilterCityCampaign') : [];
    const fStart = document.getElementById('fCityStart')?.value || '';
    const fEnd = document.getElementById('fCityEnd')?.value || '';

    const petaKota = {};
    dataAdsetCityTargeting.forEach(t => {
        const daftarKota = (t.cities || '').split(',').map(s => s.trim()).filter(Boolean);
        petaKota[t.adset_id] = daftarKota.length ? daftarKota : ['(Broad / Tanpa Target Kota Spesifik)'];
    });

    let baris = dataAdsetPerformance.filter(r => {
        if (selectedCampaigns.length > 0 && !selectedCampaigns.includes(r.campaign_name)) return false;
        if (fStart && r.tanggal < fStart) return false;
        if (fEnd && r.tanggal > fEnd) return false;
        return true;
    });

    const agregat = {};

    baris.forEach(r => {
        const daftarKota = petaKota[r.adset_id] || ['(Tidak Diketahui)'];
        const n = daftarKota.length;

        daftarKota.forEach(kota => {
            if (!agregat[kota]) {
                agregat[kota] = { kota, spend: 0, impressions: 0, reach: 0, results: 0, adsetSet: new Set() };
            }
            agregat[kota].spend += (Number(r.spend) || 0) / n;
            agregat[kota].impressions += (Number(r.impressions) || 0) / n;
            agregat[kota].reach += (Number(r.reach) || 0) / n;
            agregat[kota].results += (Number(r.results) || 0) / n;
            agregat[kota].adsetSet.add(r.adset_id);
        });
    });

    let daftarKotaFinal = Object.values(agregat).map(a => {
        a.jumlahAdset = a.adsetSet.size;
        a.costPerResult = a.results > 0 ? (a.spend / a.results) : 0;
        return a;
    }).sort((a, b) => b.reach - a.reach);

    tbody.innerHTML = daftarKotaFinal.length ? daftarKotaFinal.map(a => `
        <tr>
            <td style="text-align:left;">${a.kota}</td>
            <td>${a.jumlahAdset}</td>
            <td>Rp ${rp(Math.round(a.spend))}</td>
            <td>${rp(Math.round(a.impressions))}</td>
            <td>${rp(Math.round(a.reach))}</td>
            <td>${a.results.toFixed(1)}</td>
            <td>${a.costPerResult > 0 ? 'Rp ' + rp(Math.round(a.costPerResult)) : '-'}</td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="empty-state">Tidak ada data untuk filter ini.</td></tr>';

    gambarChartCityReach(daftarKotaFinal.slice(0, 10));
}

function gambarChartCityReach(top10Kota) {
    const ctx = document.getElementById('chartCityReach');
    if (!ctx) return;
    if (window.chartCityReachInstance) window.chartCityReachInstance.destroy();

    window.chartCityReachInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: top10Kota.map(a => a.kota),
            datasets: [{
                label: 'Reach (estimasi)',
                data: top10Kota.map(a => Math.round(a.reach)),
                backgroundColor: '#db2777'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: 'Top 10 Kota/Kabupaten (Estimasi Reach dari Targeting)' } }
        }
    });
}

// ======================= KONTEN / CREATIVE =======================

function renderContentTab() {
    const grid = document.getElementById('grid-konten-cards');
    if (!dataContent || dataContent.length === 0) {
        grid.innerHTML = '<div class="empty-state">Belum ada data. Jalankan sync di MaieAdContentSync.gs dulu, lalu refresh halaman ini.</div>';
        return;
    }

    const selectedCampaigns = typeof getMsFilterSelected === 'function' ? getMsFilterSelected('msFilterContentCampaign') : [];
    const fSort = document.getElementById('fContentSort')?.value || 'results_desc';

    let data = dataContent.filter(c => selectedCampaigns.length === 0 || selectedCampaigns.includes(c.campaign_name));

    const agregat = {};
    data.forEach(c => {
        if (!agregat[c.ad_id]) {
            agregat[c.ad_id] = {
                ad_id: c.ad_id, ad_name: c.ad_name, campaign_name: c.campaign_name,
                creative_type: c.creative_type, creative_thumbnail: c.creative_thumbnail, creative_title: c.creative_title,
                spend: 0, impressions: 0, reach: 0, link_clicks: 0, results: 0, purchases: 0
            };
        }
        const a = agregat[c.ad_id];
        a.spend += Number(c.spend) || 0;
        a.impressions += Number(c.impressions) || 0;
        a.reach += Number(c.reach) || 0;
        a.link_clicks += Number(c.link_clicks) || 0;
        a.results += Number(c.results) || 0;
        a.purchases += Number(c.purchases) || 0;
    });

    let daftarKonten = Object.values(agregat).map(a => {
        a.ctr = a.impressions > 0 ? (a.link_clicks / a.impressions * 100) : 0;
        a.costPerResult = a.results > 0 ? (a.spend / a.results) : 0;
        return a;
    });
window._contentBest = [...daftarKonten].filter(a => a.results >= 3).sort((a, b) => (a.costPerResult || Infinity) - (b.costPerResult || Infinity))[0];
    const sorter = {
        results_desc: (a, b) => b.results - a.results,
        ctr_desc: (a, b) => b.ctr - a.ctr,
        cost_asc: (a, b) => (a.costPerResult || Infinity) - (b.costPerResult || Infinity),
        spend_desc: (a, b) => b.spend - a.spend
    };
    daftarKonten.sort(sorter[fSort] || sorter.results_desc);

    grid.innerHTML = daftarKonten.length ? daftarKonten.map(a => {
        const thumb = a.creative_thumbnail
            ? `<img src="${a.creative_thumbnail}" style="width:100%; height:140px; object-fit:cover; border-radius:8px 8px 0 0;" loading="lazy">`
            : `<div style="width:100%; height:140px; background:#f1f5f9; border-radius:8px 8px 0 0; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:12px;">Tanpa Thumbnail</div>`;
        const badgeTipe = a.creative_type ? `<span style="position:absolute; top:8px; left:8px; background:rgba(15,23,42,0.75); color:#fff; font-size:10px; padding:3px 8px; border-radius:10px; text-transform:uppercase;">${a.creative_type}</span>` : '';

        return `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
            <div style="position:relative;">${thumb}${badgeTipe}</div>
            <div style="padding:12px;">
                <div style="font-weight:700; font-size:12.5px; color:#0f172a; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${a.ad_name}">${a.ad_name}</div>
                <div style="font-size:11px; color:#94a3b8; margin-bottom:8px;">${a.campaign_name}</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; font-size:11.5px; color:#475569;">
                    <div>Spend: <strong>Rp ${rp(Math.round(a.spend))}</strong></div>
                    <div>Reach: <strong>${rp(a.reach)}</strong></div>
                    <div>CTR: <strong>${a.ctr.toFixed(2)}%</strong></div>
                    <div>Results: <strong>${a.results}</strong></div>
                    <div style="grid-column: span 2;">Cost/Result: <strong>${a.costPerResult > 0 ? 'Rp ' + rp(Math.round(a.costPerResult)) : '-'}</strong></div>
                </div>
            </div>
        </div>`;
    }).join('') : '<div class="empty-state">Tidak ada data untuk filter ini.</div>';
}

// ======================= PERFORMA PER JENIS KONTEN =======================
// Agregasi dataContent per creative_type (video/gambar/carousel/dll), BEDA level
// dengan grid kartu "Performa per Konten Iklan" yang per-iklan individual.
// Tidak difilter campaign (menampilkan gambaran total semua campaign) supaya
// section ini berfungsi sebagai ringkasan cepat di bagian atas halaman.
function renderCreativeTypeTab() {
    const tbody = document.getElementById('bCreativeType');
    if (!tbody) return;

    if (!dataContent || dataContent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data konten. Jalankan sync di MaieAdContentSync.gs dulu, lalu refresh halaman ini.</td></tr>';
        return;
    }

    const agregat = {};
    dataContent.forEach(c => {
        const tipe = c.creative_type || 'Tidak Diketahui';
        if (!agregat[tipe]) {
            agregat[tipe] = {
                tipe, spend: 0, impressions: 0, link_clicks: 0, results: 0,
                video_play_50: 0, video_play_100: 0, adSet: new Set()
            };
        }
        const a = agregat[tipe];
        a.spend += Number(c.spend) || 0;
        a.impressions += Number(c.impressions) || 0;
        a.link_clicks += Number(c.link_clicks) || 0;
        a.results += Number(c.results) || 0;
        a.video_play_50 += Number(c.video_play_50) || 0;
        a.video_play_100 += Number(c.video_play_100) || 0;
        if (c.ad_id) a.adSet.add(c.ad_id);
    });

    let baris = Object.values(agregat).map(a => {
        a.jumlahKonten = a.adSet.size;
        a.ctr = a.impressions > 0 ? (a.link_clicks / a.impressions * 100) : 0;
        a.cpl = a.results > 0 ? (a.spend / a.results) : 0;
        a.videoCompletion = a.video_play_50 > 0 ? (a.video_play_100 / a.video_play_50 * 100) : null;
        return a;
    }).sort((a, b) => b.spend - a.spend);

    tbody.innerHTML = baris.length ? baris.map(a => `
        <tr>
            <td style="text-align:left;"><strong>${a.tipe}</strong></td>
            <td>${a.jumlahKonten}</td>
            <td>Rp ${rp(Math.round(a.spend))}</td>
            <td>${a.ctr.toFixed(2)}%</td>
            <td>${a.results}</td>
            <td>${a.cpl > 0 ? 'Rp ' + rp(Math.round(a.cpl)) : '-'}</td>
            <td>${a.videoCompletion !== null ? a.videoCompletion.toFixed(1) + '%' : '-'}</td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="empty-state">Tidak ada data.</td></tr>';
}

// ------------------------------------------------------------
// CLUSTER VISUAL (A = Unggulan, B = Cukup, C = Lemah)
// ------------------------------------------------------------
function renderClusterSection_() {
    let data = window._audienceScored || [];
    let elGrid = document.getElementById('aiClusterGrid');
    if (!elGrid) return;

    if (data.length === 0) {
        elGrid.innerHTML = '<div class="empty-state">Belum ada data untuk dikelompokkan.</div>';
        return;
    }

    let clusterA = data.filter(a => a.skor >= 65);
    let clusterB = data.filter(a => a.skor >= 35 && a.skor < 65);
    let clusterC = data.filter(a => a.skor < 35);

    function avgOf(arr, key) {
        if (!arr.length) return 0;
        return arr.reduce((s, a) => s + a[key], 0) / arr.length;
    }
    function bintangDari(skor) {
        let jumlah = Math.max(1, Math.round(skor / 20));
        return '★'.repeat(jumlah) + '☆'.repeat(5 - jumlah);
    }
    function kartuCluster(nama, label, arr, warna) {
        let avgCTR = avgOf(arr, 'ctr_persen').toFixed(2);
        let avgCPLarr = arr.filter(a => a.cpl > 0);
        let avgCPL = avgCPLarr.length ? Math.round(avgOf(avgCPLarr, 'cpl')) : 0;
        let avgSkor = Math.round(avgOf(arr, 'skor'));
        return `
        <div style="border-radius:10px; padding:16px; background:${warna.bg}; border:1px solid ${warna.border};">
            <div style="font-weight:800; font-size:14px; color:${warna.text};">${nama} · ${label}</div>
            <div style="font-size:22px; margin:6px 0; color:${warna.text};">${bintangDari(avgSkor)}</div>
            <div style="font-size:12px; color:#475569; line-height:1.6;">
                Jumlah Audience: <strong>${arr.length}</strong><br>
                Rata-rata CTR: <strong>${avgCTR}%</strong><br>
                Rata-rata CPL: <strong>${avgCPL > 0 ? 'Rp ' + rp(avgCPL) : '-'}</strong><br>
                Rata-rata Skor: <strong>${avgSkor}</strong>
            </div>
        </div>`;
    }

    elGrid.innerHTML =
        kartuCluster('Cluster A', 'Unggulan', clusterA, { bg: '#f0fdf4', border: '#86efac', text: '#166534' }) +
        kartuCluster('Cluster B', 'Cukup', clusterB, { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }) +
        kartuCluster('Cluster C', 'Lemah', clusterC, { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' });
}

// ------------------------------------------------------------
// PLACEMENT PERFORMANCE (dikelompokkan dari field "platforms" di dataAudience)
// ------------------------------------------------------------
function renderPlacementFromAudienceSection_() {
    let el = document.getElementById('bPlacementAudience');
    if (!el) return;
    let data = window._audienceScored || [];
    if (data.length === 0) {
        el.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada data.</td></tr>';
        window._placementBest = null;
        return;
    }

    let agregat = {};
    data.forEach(a => {
        let label = a.platforms || 'Tidak diketahui';
        if (!agregat[label]) agregat[label] = { spend: 0, impressions: 0, clicksEst: 0, leads: 0, jumlahProfile: 0 };
        let clicksEst = a.total_impressions * ((a.ctr_persen || 0) / 100);
        agregat[label].spend += a.total_spend;
        agregat[label].impressions += a.total_impressions;
        agregat[label].clicksEst += clicksEst;
        agregat[label].leads += a.total_leads_meta;
        agregat[label].jumlahProfile++;
    });

    let baris = Object.keys(agregat).map(label => {
        let g = agregat[label];
        let ctr = g.impressions > 0 ? (g.clicksEst / g.impressions * 100) : 0;
        let cpl = g.leads > 0 ? (g.spend / g.leads) : 0;
        return { label, spend: g.spend, jumlahProfile: g.jumlahProfile, ctr, leads: g.leads, cpl };
    }).sort((a, b) => (a.cpl || Infinity) - (b.cpl || Infinity));

    window._placementBest = baris.filter(b => b.leads >= 3)[0];

    el.innerHTML = baris.map(b => `
        <tr>
            <td style="text-align:left;">${b.label}</td>
            <td>${b.jumlahProfile}</td>
            <td>Rp ${rp(Math.round(b.spend))}</td>
            <td>${b.ctr.toFixed(2)}%</td>
            <td>${b.leads}</td>
            <td>${b.cpl > 0 ? 'Rp ' + rp(Math.round(b.cpl)) : '-'}</td>
        </tr>
    `).join('');
}


// ------------------------------------------------------------
// RINGKASAN TIPE TARGETING (Custom Audience murni vs Lookalike murni vs Gabungan)
// Beda dari renderAudienceTypeImpactSection_ (yang menampilkan kombinasi PERSIS
// nama audience apa adanya -- bisa sangat panjang & terfragmentasi kalau 1 adset
// pakai banyak audience sekaligus). Fungsi ini mengklasifikasi tiap adset ke SALAH
// SATU dari 4 kategori simpel, jadi selalu maksimal 4 baris -- lebih gampang dibaca
// buat jawab pertanyaan "custom audience atau lookalike yang lebih efektif?"
// ------------------------------------------------------------
function renderKlasifikasiTipeAudience_() {
    let el = document.getElementById('bAudTypeSimple');
    if (!el) return;

    if (!dataAdsetCityTargeting || !dataAdsetPerformance || dataAdsetCityTargeting.length === 0 || dataAdsetPerformance.length === 0) {
        el.innerHTML = '<tr><td colspan="6" class="empty-state">Belum ada data.</td></tr>';
        return;
    }

    function klasifikasi(namaAudienceRaw) {
        let raw = (namaAudienceRaw || '').toString().trim();
        if (!raw) return 'Tidak Pakai Custom Audience';

        // Pisah per audience individual (dipisah koma), lalu cek masing-masing
        // mengandung kata "Lookalike" atau tidak.
        let daftar = raw.split(',').map(s => s.trim()).filter(Boolean);
        let adaLookalike = daftar.some(a => /lookalike/i.test(a));
        let adaCustomBiasa = daftar.some(a => !/lookalike/i.test(a));

        if (adaLookalike && adaCustomBiasa) return 'Gabungan Custom Audience + Lookalike';
        if (adaLookalike) return 'Lookalike Saja';
        return 'Custom Audience Saja';
    }

    let petaKategori = {};
    dataAdsetCityTargeting.forEach(t => {
        petaKategori[t.adset_id] = klasifikasi(t.custom_audiences);
    });

    let agregat = {};
    dataAdsetPerformance.forEach(r => {
        let kategori = petaKategori[r.adset_id];
        if (!kategori) return;

        if (!agregat[kategori]) {
            agregat[kategori] = { kategori, spend: 0, impressions: 0, clicksEst: 0, leads: 0, adsetSet: new Set() };
        }

        let clicksEst = (Number(r.impressions) || 0) * ((Number(r.ctr) || 0) / 100);
        agregat[kategori].spend += Number(r.spend) || 0;
        agregat[kategori].impressions += Number(r.impressions) || 0;
        agregat[kategori].clicksEst += clicksEst;
        agregat[kategori].leads += Number(r.results) || 0;
        agregat[kategori].adsetSet.add(r.adset_id);
    });

    // Urutan tampilan tetap/konsisten, bukan sort otomatis, supaya orang bisa
    // langsung bandingkan baris yang sama tiap kali buka halaman
    let urutanTampil = ['Custom Audience Saja', 'Lookalike Saja', 'Gabungan Custom Audience + Lookalike', 'Tidak Pakai Custom Audience'];

    let baris = urutanTampil
        .filter(k => agregat[k])
        .map(k => {
            let g = agregat[k];
            let ctr = g.impressions > 0 ? (g.clicksEst / g.impressions * 100) : 0;
            let cpl = g.leads > 0 ? (g.spend / g.leads) : 0;
            return { kategori: k, jumlahAdset: g.adsetSet.size, spend: g.spend, ctr, leads: g.leads, cpl };
        });

    el.innerHTML = baris.length ? baris.map(b => `
        <tr>
            <td style="text-align:left;"><strong>${b.kategori}</strong></td>
            <td>${b.jumlahAdset}</td>
            <td>Rp ${rp(Math.round(b.spend))}</td>
            <td>${b.ctr.toFixed(2)}%</td>
            <td>${b.leads}</td>
            <td>${b.cpl > 0 ? 'Rp ' + rp(Math.round(b.cpl)) : '-'}</td>
        </tr>
    `).join('') : '<tr><td colspan="6" class="empty-state">Tidak ada data.</td></tr>';
}

// AUDIENCE TYPE IMPACT (Custom Audience / Exclusion) - reuse dataAdsetCityTargeting
// yang sudah diperluas dengan field custom_audiences & excluded_custom_audiences di Code.gs,
// join dengan dataAdsetPerformance.
// VERSI BARU: menampilkan NAMA audience asli (bukan cuma Ya/Tidak) supaya kelihatan
// custom audience/lookalike mana yang dipakai.
// ------------------------------------------------------------
function renderAudienceTypeImpactSection_() {
    let el = document.getElementById('bAudType');
    if (!el) return;

    if (!dataAdsetCityTargeting || !dataAdsetPerformance || dataAdsetCityTargeting.length === 0 || dataAdsetPerformance.length === 0) {
        el.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data. Pastikan Code.gs sudah menyertakan custom_audiences/excluded_custom_audiences di adsetCityTargeting, lalu deploy ulang.</td></tr>';
        window._audTypeBest = null;
        return;
    }

    let petaTipe = {};
    dataAdsetCityTargeting.forEach(t => {
        petaTipe[t.adset_id] = {
            audienceName: (t.custom_audiences || '').toString().trim(),
            exclusionName: (t.excluded_custom_audiences || '').toString().trim()
        };
    });

    let agregat = {};
    dataAdsetPerformance.forEach(r => {
        let tipe = petaTipe[r.adset_id];
        if (!tipe) return;

        let labelAudience = tipe.audienceName || 'Tidak pakai Custom Audience';
        let labelExclusion = tipe.exclusionName || 'Tidak ada Exclusion';
        let key = labelAudience + '||' + labelExclusion;

        if (!agregat[key]) {
            agregat[key] = { labelAudience, labelExclusion, spend: 0, impressions: 0, clicksEst: 0, leads: 0, adsetSet: new Set() };
        }

        let clicksEst = (Number(r.impressions) || 0) * ((Number(r.ctr) || 0) / 100);
        agregat[key].spend += Number(r.spend) || 0;
        agregat[key].impressions += Number(r.impressions) || 0;
        agregat[key].clicksEst += clicksEst;
        agregat[key].leads += Number(r.results) || 0;
        agregat[key].adsetSet.add(r.adset_id);
    });

    let baris = Object.values(agregat).map(g => {
        let ctr = g.impressions > 0 ? (g.clicksEst / g.impressions * 100) : 0;
        let cpl = g.leads > 0 ? (g.spend / g.leads) : 0;
        return Object.assign({}, g, { jumlahAdset: g.adsetSet.size, ctr, cpl });
    }).sort((a, b) => (a.cpl || Infinity) - (b.cpl || Infinity));

    window._audTypeBest = baris.filter(b => b.leads >= 3)[0];
    if (window._audTypeBest) {
        // dipakai renderRekomendasiOptimal_() yang baca field .label
        window._audTypeBest.label = `${window._audTypeBest.labelAudience} (Exclusion: ${window._audTypeBest.labelExclusion})`;
    }

    el.innerHTML = baris.map(b => `
        <tr>
            <td style="text-align:left;">${b.labelAudience}</td>
            <td style="text-align:left;">${b.labelExclusion}</td>
            <td>${b.jumlahAdset}</td>
            <td>Rp ${rp(Math.round(b.spend))}</td>
            <td>${b.ctr.toFixed(2)}%</td>
            <td>${b.leads}</td>
            <td>${b.cpl > 0 ? 'Rp ' + rp(Math.round(b.cpl)) : '-'}</td>
        </tr>
    `).join('');
}

// ------------------------------------------------------------
// CREATIVE FATIGUE ALERT (reuse dataAdsetPerformance yang sudah dimuat)
// ------------------------------------------------------------
function renderCreativeFatigueSection_() {
    let elBody = document.getElementById('bFatigue');
    if (!elBody) return;

    if (!dataAdsetPerformance || dataAdsetPerformance.length === 0) {
        elBody.innerHTML = '<tr><td colspan="7" class="empty-state">Belum ada data performa harian per adset.</td></tr>';
        return;
    }

    let perAdset = {};
    dataAdsetPerformance.forEach(r => {
        if (!perAdset[r.adset_id]) perAdset[r.adset_id] = { nama: r.adset_name, campaign: r.campaign_name, rows: [] };
        perAdset[r.adset_id].rows.push(r);
    });

    let hasilFatigue = [];

    Object.keys(perAdset).forEach(adsetId => {
        let info = perAdset[adsetId];
        let rows = info.rows.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        if (rows.length < 6) return;

        let recent3 = rows.slice(-3);
        let prior3 = rows.slice(-6, -3);

        let freqRecent = recent3.reduce((s, r) => s + r.frequency, 0) / recent3.length;
        let freqPrior = prior3.reduce((s, r) => s + r.frequency, 0) / prior3.length;
        let ctrRecent = recent3.reduce((s, r) => s + r.ctr, 0) / recent3.length;
        let ctrPrior = prior3.reduce((s, r) => s + r.ctr, 0) / prior3.length;

        let freqNaikPersen = freqPrior > 0 ? ((freqRecent - freqPrior) / freqPrior * 100) : 0;
        let ctrTurunPersen = ctrPrior > 0 ? ((ctrPrior - ctrRecent) / ctrPrior * 100) : 0;

        let status = null;
        if (freqNaikPersen >= 15 && ctrTurunPersen >= 15) {
            status = { label: '🔴 Fatigue Terdeteksi', warna: '#991b1b' };
        } else if (freqNaikPersen >= 10 || ctrTurunPersen >= 10) {
            status = { label: '🟡 Mulai Menurun', warna: '#92400e' };
        }

        if (status) {
            hasilFatigue.push({ nama: info.nama, campaign: info.campaign, freqPrior, freqRecent, ctrPrior, ctrRecent, status });
        }
    });

    hasilFatigue.sort((a, b) => b.freqRecent - a.freqRecent);

    elBody.innerHTML = hasilFatigue.length
        ? hasilFatigue.map(f => `
            <tr>
                <td style="text-align:left;">${f.nama}</td>
                <td style="text-align:left;">${f.campaign}</td>
                <td>${f.freqPrior.toFixed(2)}</td>
                <td>${f.freqRecent.toFixed(2)}</td>
                <td>${f.ctrPrior.toFixed(2)}%</td>
                <td>${f.ctrRecent.toFixed(2)}%</td>
                <td style="color:${f.status.warna}; font-weight:700;">${f.status.label}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="7" class="empty-state">Tidak ada tanda-tanda fatigue saat ini. 👍 (atau data belum cukup 6 hari berjalan)</td></tr>';
}

// ------------------------------------------------------------
// REKOMENDASI KOMBINASI OPTIMAL - gabungan Profile + Wilayah + Placement + Konten + Audience Type
// ------------------------------------------------------------
function renderRekomendasiOptimal_() {
    let elBox = document.getElementById('aiRekomendasiOptimalIsi');
    if (!elBox) return;

    let profil = (window._audienceScored || []).filter(a => a.total_leads_meta >= 3)[0];
    let placement = window._placementBest;
    let wilayah = window._regionBest;
    let konten = window._contentBest;
    let audType = window._audTypeBest;

    if (!profil && !placement && !wilayah && !konten && !audType) {
        elBox.innerHTML = '<div style="color:#94a3b8;">Data belum cukup untuk menyusun rekomendasi (butuh minimal beberapa audience/wilayah/konten dengan 3+ leads/results). Kumpulkan data performa lebih lama dulu.</div>';
        return;
    }

    let poin = [];
    if (profil) {
        let usia = (profil.age_min || profil.age_max) ? `${profil.age_min || '?'}-${profil.age_max || '?'} tahun` : 'semua usia';
        poin.push(`👤 <strong>Usia & Gender:</strong> ${usia}, ${profil.genders || 'All'} — CPL Rp ${rp(profil.cpl)}, skor ${profil.skor}/100`);
        if (profil.top_interests) poin.push(`❤️ <strong>Interest:</strong> ${profil.top_interests}`);
    }
    if (wilayah) {
        let namaWilayah = (wilayah.region && wilayah.region !== '-') ? wilayah.region : wilayah.country;
        poin.push(`📍 <strong>Wilayah</strong> <span style="font-size:10px; color:#94a3b8;">(data real delivery Meta)</span>: ${namaWilayah} — Cost/Result Rp ${rp(Math.round(wilayah.costPerResult))}`);
    }
    if (placement) {
        poin.push(`📱 <strong>Placement:</strong> ${placement.label} — CPL Rp ${rp(Math.round(placement.cpl))}`);
    }
    if (konten) {
        poin.push(`🎬 <strong>Konten Terbaik:</strong> "${konten.ad_name}" — Cost/Result Rp ${rp(Math.round(konten.costPerResult))}, CTR ${konten.ctr.toFixed(2)}%`);
    }
    if (audType) {
        poin.push(`🎯 <strong>Custom Audience/Exclusion:</strong> ${audType.label} — CPL Rp ${rp(Math.round(audType.cpl))}`);
    }

    let estimasiList = [
        profil ? profil.cpl : null,
        wilayah ? wilayah.costPerResult : null,
        placement ? placement.cpl : null,
        konten ? konten.costPerResult : null,
        audType ? audType.cpl : null
    ].filter(v => v > 0);
    let estimasiRerata = estimasiList.length ? Math.round(estimasiList.reduce((s, v) => s + v, 0) / estimasiList.length) : 0;

    elBox.innerHTML = poin.map(p => `<div style="margin-bottom:6px;">${p}</div>`).join('') +
        (estimasiRerata > 0 ? `<div style="margin-top:14px; padding-top:14px; border-top:1px solid #334155; font-size:15px;">
            💡 Kalau kombinasi di atas dipakai bersamaan pada campaign berikutnya, estimasi CPL/Cost per Result berada di kisaran <strong style="color:#4ade80;">Rp ${rp(estimasiRerata)}</strong>
            <div style="font-size:11px; color:#94a3b8; margin-top:4px;">*Estimasi rata-rata dari tiap faktor terbaik secara terpisah — bukan jaminan, karena kombinasi persis ini mungkin belum pernah dicoba bersamaan. Anggap sebagai titik awal untuk campaign uji coba berikutnya.</div>
        </div>` : '');
}


