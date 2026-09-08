// =========================================================================
// ui-marketing.js — disalin dari UiMarketing.html Apps Script (gabungan
// seluruh potongan yang dikirim), ditambah widget .ms-filter (multi-select
// checklist filter) yang BELUM ada di referensi yang dikirim — jadi ini
// implementasi saya sendiri, pola standar checklist dropdown.
// =========================================================================

// =========================================================================
// WIDGET: .ms-filter (multi-select checklist dropdown)
// Dipakai untuk "Minat Produk" & "Nama Campaign Meta Ads" di filter Marketing.
// PERHATIAN: ini BUKAN salinan dari kode asli Anda (belum pernah dikirim) —
// kalau Anda punya implementasi asli di Init.html/Utils.html, kirimkan agar
// bisa diganti supaya identik.
// =========================================================================
window.msFilterState = window.msFilterState || {};

function initMsFilter(containerId, options, onChangeCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    window.msFilterState[containerId] = {
        options: options || [],
        selected: new Set(),
        onChange: onChangeCallback
    };

    renderMsFilterOptions(containerId);
    updateMsFilterButtonLabel(containerId);
}

function updateMsFilterOptions(containerId, options) {
    const state = window.msFilterState[containerId];
    if (!state) return;
    // Pertahankan seleksi yang masih valid, buang yang sudah tidak ada di opsi baru
    const optSet = new Set(options || []);
    state.selected.forEach(v => { if (!optSet.has(v)) state.selected.delete(v); });
    state.options = options || [];
    renderMsFilterOptions(containerId);
    updateMsFilterButtonLabel(containerId);
}

function renderMsFilterOptions(containerId, searchTerm) {
    const container = document.getElementById(containerId);
    const state = window.msFilterState[containerId];
    if (!container || !state) return;

    const panelOptions = container.querySelector('.ms-filter-options');
    if (!panelOptions) return;

    const term = (searchTerm || '').toLowerCase();
    const filtered = state.options.filter(o => o.toLowerCase().includes(term));

    panelOptions.innerHTML = filtered.map(opt => {
        const idAman = containerId + '_' + opt.replace(/[^a-zA-Z0-9]/g, '_');
        const checked = state.selected.has(opt) ? 'checked' : '';
        return `<label class="ms-filter-option" for="${idAman}">
            <input type="checkbox" id="${idAman}" value="${opt.replace(/"/g, '&quot;')}" ${checked} onchange="msFilterToggleOption('${containerId}', this.value, this.checked)">
            <span>${opt}</span>
        </label>`;
    }).join('') || '<div style="padding:10px; font-size:12px; color:#94a3b8;">Tidak ada opsi cocok.</div>';
}

function msFilterToggleOption(containerId, value, checked) {
    const state = window.msFilterState[containerId];
    if (!state) return;
    if (checked) state.selected.add(value); else state.selected.delete(value);
    updateMsFilterButtonLabel(containerId);
    if (typeof state.onChange === 'function') state.onChange();
}

function updateMsFilterButtonLabel(containerId) {
    const container = document.getElementById(containerId);
    const state = window.msFilterState[containerId];
    if (!container || !state) return;
    const btn = container.querySelector('.ms-filter-btn');
    if (!btn) return;

    const jml = state.selected.size;
    if (jml === 0) btn.textContent = 'Semua Campaign ▾';
    else if (jml === 1) btn.textContent = [...state.selected][0] + ' ▾';
    else btn.textContent = jml + ' dipilih ▾';
}

function toggleMsFilter(containerId) {
    document.querySelectorAll('.ms-filter-panel.open').forEach(p => {
        if (p.closest('.ms-filter')?.id !== containerId) p.classList.remove('open');
    });
    const container = document.getElementById(containerId);
    if (!container) return;
    const panel = container.querySelector('.ms-filter-panel');
    if (panel) panel.classList.toggle('open');
}

function filterMsOptions(containerId, searchTerm) {
    renderMsFilterOptions(containerId, searchTerm);
}

function getMsFilterSelected(containerId) {
    const state = window.msFilterState[containerId];
    return state ? [...state.selected] : [];
}

function msFilterSelectAll(containerId) {
    const state = window.msFilterState[containerId];
    if (!state) return;
    state.options.forEach(o => state.selected.add(o));
    renderMsFilterOptions(containerId);
    updateMsFilterButtonLabel(containerId);
    if (typeof state.onChange === 'function') state.onChange();
}

function msFilterClearAll(containerId) {
    const state = window.msFilterState[containerId];
    if (!state) return;
    state.selected.clear();
    renderMsFilterOptions(containerId);
    updateMsFilterButtonLabel(containerId);
    if (typeof state.onChange === 'function') state.onChange();
}

// Tutup panel ms-filter kalau klik di luar
document.addEventListener('click', function (evt) {
    document.querySelectorAll('.ms-filter').forEach(el => {
        if (!el.contains(evt.target)) {
            const panel = el.querySelector('.ms-filter-panel');
            if (panel) panel.classList.remove('open');
        }
    });
});


// ======================= LOGIKA TAB 4: MARKETING (FUNNEL 4 TAHAP: AWARENESS → LEADS → CLOSING → REVENUE) =======================
// UPDATE v5: Breakdown Adset/Content + Insight Tactical v2 + Scorecard Mingguan EOS
//            + Banner Target (editable web, per-produk) + Click-to-Lead Rate


const TARGET_DEFAULT_FALLBACK = { closingMin: 5, omzetMin: 10000000, roasMin: 2, creativeBaruMin: 2 };

const NAMA_BULAN_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function formatMinggu(tgl) {
    if (!tgl) return '';
    let s = formati(tgl);
    if (!s) return '';
    let d = new Date(s + 'T00:00:00');
    let day = d.getDay();
    let selisihKeSenin = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + selisihKeSenin);
    let y = d.getFullYear();
    let m = String(d.getMonth() + 1).padStart(2, '0');
    let dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function labelMinggu(seninStr) {
    let senin = new Date(seninStr + 'T00:00:00');
    let minggu = new Date(senin);
    minggu.setDate(senin.getDate() + 6);
    let lblSenin = senin.getDate() + ' ' + NAMA_BULAN_ID[senin.getMonth()];
    let lblMinggu = minggu.getDate() + ' ' + NAMA_BULAN_ID[minggu.getMonth()];
    return lblSenin + '-' + lblMinggu;
}

function ambilTargetAktif(selectedCampaigns) {
    let global = (dataTargetMingguanMarketing && dataTargetMingguanMarketing.global) || TARGET_DEFAULT_FALLBACK;

    if (selectedCampaigns && selectedCampaigns.length === 1) {
        let namaProduk = selectedCampaigns[0];
        let perProduk = dataTargetMingguanMarketing && dataTargetMingguanMarketing.perProduk
            ? dataTargetMingguanMarketing.perProduk[namaProduk]
            : null;
        if (perProduk) {
            return { target: perProduk, sumber: 'Produk: ' + namaProduk };
        }
    }
    return { target: global, sumber: 'Global (Semua Produk)' };
}

function isiFilterCampaignMarketing() {
    const daftarCampaign = [...new Set([
        ...(dataGlobal || []).map(r => r.minat),
        ...(dataMarketing || []).map(m => m.campaign)
    ])].filter(Boolean).sort();

    if (window.msFilterState && window.msFilterState['msFilterMktCampaign']) {
        updateMsFilterOptions('msFilterMktCampaign', daftarCampaign);
    } else if (typeof initMsFilter === 'function') {
        initMsFilter('msFilterMktCampaign', daftarCampaign, renderMarketingTab);
    }
}

function isiFilterNamaMetaMarketing() {
    const daftarNamaMeta = [...new Set((dataMarketing || []).map(m => m.nama_campaign_meta))].filter(Boolean).sort();

    if (window.msFilterState && window.msFilterState['msFilterMktNamaMeta']) {
        updateMsFilterOptions('msFilterMktNamaMeta', daftarNamaMeta);
    } else if (typeof initMsFilter === 'function') {
        initMsFilter('msFilterMktNamaMeta', daftarNamaMeta, renderMarketingTab);
    }
}


function renderMarketingTab() {
    isiFilterCampaignMarketing();
    isiFilterNamaMetaMarketing();

    let selectedCampaigns = typeof getMsFilterSelected === 'function' ? getMsFilterSelected('msFilterMktCampaign') : [];
    let selectedNamaMeta = typeof getMsFilterSelected === 'function' ? getMsFilterSelected('msFilterMktNamaMeta') : [];

    let fStart = document.getElementById('fMktStart')?.value || '';
    let fEnd = document.getElementById('fMktEnd')?.value || '';

    let mktDataDaily = {}, mktDataSummary = {};
    let tot = {
        spend: 0, leadsCRM: new Set(), leadsMeta: 0, dp: 0, omzet: 0, days: 0, count: 0,
        impressions: 0, reach: 0, linkClicks: 0, outboundClicks: 0,
        videoPlay50: 0, videoPlay75: 0, videoPlay100: 0,
        igProfileVisit: 0, igFollow: 0,
        adaDataAds: false
    };

    function kosongDaily(t, c) {
        return {
            date: t, camp: c, spend: 0, leadsCRM: new Set(), leadsMeta: 0, dp: 0, omzet: 0, days: 0,
            impressions: 0, reach: 0, linkClicks: 0, outboundClicks: 0,
            videoPlay50: 0, videoPlay75: 0, videoPlay100: 0,
            igProfileVisit: 0, igFollow: 0, adaDataAds: false
        };
    }
    function kosongSummary(c) {
        return {
            camp: c, spend: 0, leadsCRM: new Set(), leadsMeta: 0, dp: 0, omzet: 0, days: 0,
            impressions: 0, reach: 0, linkClicks: 0, outboundClicks: 0,
            videoPlay50: 0, videoPlay75: 0, videoPlay100: 0,
            igProfileVisit: 0, igFollow: 0, adaDataAds: false
        };
    }

    let fd = dataGlobal;
    if (selectedCampaigns.length > 0) fd = fd.filter(r => selectedCampaigns.includes(r.minat));
    if (fStart) fd = fd.filter(r => formati(r.tanggal_chat) >= fStart);
    if (fEnd) fd = fd.filter(r => formati(r.tanggal_chat) <= fEnd);

    fd.forEach(r => {
        let t = formati(r.tanggal_chat);
        let c = r.minat || "Lainnya";
        let kD = t + '|' + c, kS = c;

        if (!mktDataDaily[kD]) mktDataDaily[kD] = kosongDaily(t, c);
        if (!mktDataSummary[kS]) mktDataSummary[kS] = kosongSummary(c);

        let wa = r.no_hp;
        if (!wa && !r.nama && !r.status) return;

        mktDataDaily[kD].leadsCRM.add(wa);
        mktDataSummary[kS].leadsCRM.add(wa);
        tot.leadsCRM.add(wa);

        if (r.status && (r.status.includes('DP') || r.status.includes('Lunas'))) {
            mktDataDaily[kD].dp++;
            mktDataSummary[kS].dp++;
            tot.dp++;

            let total = Number(r.total) || 0;
            mktDataDaily[kD].omzet += total;
            mktDataSummary[kS].omzet += total;
            tot.omzet += total;

            if (r.tgl_bayar1) {
                let d = daysDiff(r.tanggal_chat, r.tgl_bayar1);
                mktDataDaily[kD].days += d;
                mktDataSummary[kS].days += d;
                tot.days += d;
                tot.count++;
            }
        }
    });

    let fAds = dataMarketing;
    if (selectedCampaigns.length > 0) fAds = fAds.filter(m => selectedCampaigns.includes(m.campaign));
    if (selectedNamaMeta.length > 0) fAds = fAds.filter(m => selectedNamaMeta.includes(m.nama_campaign_meta));
    if (fStart) fAds = fAds.filter(m => formati(m.tanggal) >= fStart);
    if (fEnd) fAds = fAds.filter(m => formati(m.tanggal) <= fEnd);

    fAds.forEach(m => {
        let t = formati(m.tanggal);
        let c = m.campaign || "Lainnya";
        let kD = t + '|' + c, kS = c;

        if (!mktDataDaily[kD]) mktDataDaily[kD] = kosongDaily(t, c);
        if (!mktDataSummary[kS]) mktDataSummary[kS] = kosongSummary(c);

        mktDataDaily[kD].adaDataAds = true;
        mktDataSummary[kS].adaDataAds = true;
        tot.adaDataAds = true;

        let s = Number(m.spend) || 0;
        mktDataDaily[kD].spend += s;
        mktDataSummary[kS].spend += s;
        tot.spend += s;

        let leadsMeta = Number(m.results) || 0;
        mktDataDaily[kD].leadsMeta += leadsMeta;
        mktDataSummary[kS].leadsMeta += leadsMeta;
        tot.leadsMeta += leadsMeta;

        let imp = Number(m.impressions) || 0;
        let rc = Number(m.reach) || 0;
        let lc = Number(m.link_clicks) || 0;

        mktDataDaily[kD].impressions += imp;  mktDataSummary[kS].impressions += imp;  tot.impressions += imp;
        mktDataDaily[kD].reach += rc;         mktDataSummary[kS].reach += rc;         tot.reach += rc;
        mktDataDaily[kD].linkClicks += lc;    mktDataSummary[kS].linkClicks += lc;    tot.linkClicks += lc;
    });

    let totalLeadsCRM = tot.leadsCRM.size;
    let globalCPL = totalLeadsCRM > 0 ? Math.round(tot.spend / totalLeadsCRM) : 0;
    let globalCAC = tot.dp > 0 ? Math.round(tot.spend / tot.dp) : 0;
    let globalCR = totalLeadsCRM > 0 ? ((tot.dp / totalLeadsCRM) * 100).toFixed(1) : 0;
    let globalROAS = tot.spend > 0 ? (tot.omzet / tot.spend).toFixed(1) : 0;
    let globalTime = tot.count > 0 ? (tot.days / tot.count).toFixed(1) : 0;
    let globalCTRMeta = tot.impressions > 0 ? ((tot.linkClicks / tot.impressions) * 100).toFixed(2) : 0;
    let globalMatchRate = tot.leadsMeta > 0 ? ((totalLeadsCRM / tot.leadsMeta) * 100).toFixed(0) : 0;

    function selAngka(nilai, adaData) {
        if (!adaData) return '<span style="color:#94a3b8;">-</span>';
        return rp(nilai);
    }
    function selPersen(nilai, adaData) {
        if (!adaData) return '<span style="color:#94a3b8;">-</span>';
        return nilai + '%';
    }

    let htmlS = '', sS = Object.keys(mktDataSummary).sort((a, b) => mktDataSummary[b].omzet - mktDataSummary[a].omzet);
    sS.forEach(k => {
        let v = mktDataSummary[k];
        let jmlLeadsCRM = v.leadsCRM.size;
        let cpl = jmlLeadsCRM > 0 ? Math.round(v.spend / jmlLeadsCRM) : 0;
        let cac = v.dp > 0 ? Math.round(v.spend / v.dp) : 0;
        let cr = jmlLeadsCRM > 0 ? (v.dp / jmlLeadsCRM * 100).toFixed(1) : 0;
        let roas = v.spend > 0 ? (v.omzet / v.spend).toFixed(1) : 0;
        let avgTime = v.dp > 0 ? (v.days / v.dp).toFixed(1) : 0;
        let ctrMeta = v.impressions > 0 ? ((v.linkClicks / v.impressions) * 100).toFixed(2) : 0;

        htmlS += `<tr>
            <td><strong>${v.camp}</strong></td>
            <td>Rp ${rp(v.spend)}</td>
            <td>${selAngka(v.reach, v.adaDataAds)}</td>
            <td>${selAngka(v.impressions, v.adaDataAds)}</td>
            <td>${selPersen(ctrMeta, v.adaDataAds)}</td>
            <td>${selAngka(v.leadsMeta, v.adaDataAds)}</td>
            <td>${jmlLeadsCRM}</td>
            <td style="color:#2563eb; font-weight:bold;">Rp ${rp(cpl)}</td>
            <td><strong style="color:#d97706">${v.dp}</strong></td>
            <td>${cr}%</td>
            <td style="color:#1fcc00; font-weight:bold;">Rp ${rp(cac)}</td>
            <td style="color:#10b981; font-weight:bold;">Rp ${rp(v.omzet)}</td>
            <td style="color:#059669; font-weight:bold;">${roas}x</td>
            <td>${avgTime}</td>
        </tr>`;
    });
    htmlS += `<tr style="font-weight:bold; background:#e2e8f0;">
        <td>TOTAL GLOBAL</td><td>Rp ${rp(tot.spend)}</td>
        <td>${selAngka(tot.reach, tot.adaDataAds)}</td>
        <td>${selAngka(tot.impressions, tot.adaDataAds)}</td>
        <td>${selPersen(globalCTRMeta, tot.adaDataAds)}</td>
        <td>${selAngka(tot.leadsMeta, tot.adaDataAds)}</td>
        <td>${totalLeadsCRM}</td>
        <td style="color:#8b5cf6;">Rp ${rp(globalCPL)}</td><td>${tot.dp}</td><td>${globalCR}%</td>
        <td style="color:#1fcc00;">Rp ${rp(globalCAC)}</td><td style="color:#10b981;">Rp ${rp(tot.omzet)}</td>
        <td style="color:#059669;">${globalROAS}x</td><td>${globalTime}</td>
    </tr>`;

    let elMarketingSummary = document.getElementById('bMarketingSummary');
    if (elMarketingSummary) elMarketingSummary.innerHTML = htmlS;

    let htmlD = '', sD = Object.keys(mktDataDaily).sort().reverse();
    let cDates = [], cSpend = [], cOmzet = [], cLeads = [], cLeadsMeta = [], cDp = [];
    let sDChart = Object.keys(mktDataDaily).sort();

    sDChart.forEach(k => {
        let v = mktDataDaily[k];
        cDates.push(v.date);
        cSpend.push(v.spend);
        cOmzet.push(v.omzet);
        cLeads.push(v.leadsCRM.size);
        cLeadsMeta.push(v.leadsMeta);
        cDp.push(v.dp);
    });

    sD.forEach(k => {
        let v = mktDataDaily[k];
        let jmlLeadsCRM = v.leadsCRM.size;
        let cpl = jmlLeadsCRM > 0 ? Math.round(v.spend / jmlLeadsCRM) : 0;
        let cac = v.dp > 0 ? Math.round(v.spend / v.dp) : 0;
        let cr = jmlLeadsCRM > 0 ? (v.dp / jmlLeadsCRM * 100).toFixed(1) : 0;
        let roas = v.spend > 0 ? (v.omzet / v.spend).toFixed(1) : 0;
        let avgTime = v.dp > 0 ? (v.days / v.dp).toFixed(1) : 0;
        let ctrMeta = v.impressions > 0 ? ((v.linkClicks / v.impressions) * 100).toFixed(2) : 0;

        htmlD += `<tr>
            <td>${v.date}</td>
            <td>${v.camp}</td>
            <td>Rp ${rp(v.spend)}</td>
            <td>${selAngka(v.reach, v.adaDataAds)}</td>
            <td>${selAngka(v.impressions, v.adaDataAds)}</td>
            <td>${selPersen(ctrMeta, v.adaDataAds)}</td>
            <td>${selAngka(v.leadsMeta, v.adaDataAds)}</td>
            <td>${jmlLeadsCRM}</td>
            <td style="color:#2563eb; font-weight:bold;">Rp ${rp(cpl)}</td>
            <td><strong style="color:#d97706">${v.dp}</strong></td>
            <td>${cr}%</td>
            <td style="color:#1fcc00; font-weight:bold;">Rp ${rp(cac)}</td>
            <td style="color:#10b981; font-weight:bold;">Rp ${rp(v.omzet)}</td>
            <td style="color:#059669; font-weight:bold;">${roas}x</td>
            <td>${avgTime}</td>
        </tr>`;
    });
    htmlD += `<tr style="font-weight:bold; background:#e2e8f0;">
        <td>TOTAL GLOBAL</td><td>-</td><td>Rp ${rp(tot.spend)}</td>
        <td>${selAngka(tot.reach, tot.adaDataAds)}</td>
        <td>${selAngka(tot.impressions, tot.adaDataAds)}</td>
        <td>${selPersen(globalCTRMeta, tot.adaDataAds)}</td>
        <td>${selAngka(tot.leadsMeta, tot.adaDataAds)}</td>
        <td>${totalLeadsCRM}</td>
        <td style="color:#8b5cf6;">Rp ${rp(globalCPL)}</td><td>${tot.dp}</td><td>${globalCR}%</td>
        <td style="color:#1fcc00;">Rp ${rp(globalCAC)}</td><td style="color:#10b981;">Rp ${rp(tot.omzet)}</td>
        <td style="color:#059669;">${globalROAS}x</td><td>${globalTime}</td>
    </tr>`;

    let elMarketingHarian = document.getElementById('bMarketing');
    if (elMarketingHarian) elMarketingHarian.innerHTML = htmlD;

    let elReach = document.getElementById('kpiReach'); if (elReach) elReach.innerText = tot.adaDataAds ? rp(tot.reach) : '-';
    let elImp = document.getElementById('kpiImpresi'); if (elImp) elImp.innerText = tot.adaDataAds ? rp(tot.impressions) : '-';
    let elCtr = document.getElementById('kpiCTR'); if (elCtr) elCtr.innerText = tot.adaDataAds ? `${globalCTRMeta}%` : '-';
    let elSpendAware = document.getElementById('kpiSpendAwareness'); if (elSpendAware) elSpendAware.innerText = `Rp ${rp(tot.spend)}`;

    let elLeadsMeta = document.getElementById('kpiLeadsMeta'); if (elLeadsMeta) elLeadsMeta.innerText = tot.adaDataAds ? rp(tot.leadsMeta) : '-';
    let elKpiLeads = document.getElementById('kpiLeads'); if (elKpiLeads) elKpiLeads.innerText = `${totalLeadsCRM} Klien`;
    let elKpiCpl = document.getElementById('kpiCPL'); if (elKpiCpl) elKpiCpl.innerText = `Rp ${rp(globalCPL)}`;
    let elMatchRate = document.getElementById('kpiMatchRate'); if (elMatchRate) elMatchRate.innerText = tot.adaDataAds && tot.leadsMeta > 0 ? `${globalMatchRate}%` : '-';

    let elKpiClosing = document.getElementById('kpiClosing'); if (elKpiClosing) elKpiClosing.innerText = `${tot.dp} Transaksi`;
    let elKpiCR = document.getElementById('kpiCR'); if (elKpiCR) elKpiCR.innerText = `${globalCR}%`;
    let elKpiCAC = document.getElementById('kpiCAC'); if (elKpiCAC) elKpiCAC.innerText = `Rp ${rp(globalCAC)}`;
    let elKpiTime = document.getElementById('kpiTime'); if (elKpiTime) elKpiTime.innerText = `${globalTime} Hari`;

    let elKpiOmzet = document.getElementById('kpiOmzet'); if (elKpiOmzet) elKpiOmzet.innerText = `Rp ${rp(tot.omzet)}`;
    let elKpiROAS = document.getElementById('kpiROAS'); if (elKpiROAS) elKpiROAS.innerText = `${globalROAS}x`;

    let wAware = 100;
    let wLeads = tot.impressions > 0 ? Math.max(15, Math.min(85, (totalLeadsCRM / tot.impressions) * 100 * 40)) : 70;
    let wClosing = totalLeadsCRM > 0 ? Math.max(10, Math.min(wLeads - 5, (tot.dp / totalLeadsCRM) * 100)) : 40;
    let wRevenue = Math.max(8, wClosing - 8);

    let fnlAware = document.getElementById('fnlAwareBar');
    let fnlLeads = document.getElementById('fnlLeadsBar');
    let fnlClosing = document.getElementById('fnlClosingBar');
    let fnlRevenue = document.getElementById('fnlRevenueBar');

    if (fnlAware) {
        fnlAware.style.width = wAware + '%';
        fnlAware.innerHTML = tot.adaDataAds
            ? `<span style="font-size:15px; font-weight:900;">👁️ ${rp(tot.reach)} Orang Terjangkau</span><span style="font-size:11px; opacity:0.9;">${rp(tot.impressions)} Impresi · CTR ${globalCTRMeta}%</span>`
            : `<span style="font-size:14px; font-weight:900;">👁️ Belum ada data Reach/Impresi</span><span style="font-size:11px; opacity:0.9;">Sinkronkan Data_Ads dari Meta dulu</span>`;
    }
    if (fnlLeads) {
        fnlLeads.style.width = wLeads + '%';
        let labelMeta = tot.adaDataAds ? ` (Meta: ${rp(tot.leadsMeta)})` : '';
        fnlLeads.innerHTML = `<span style="font-size:15px; font-weight:900;">💬 ${totalLeadsCRM} Leads Nyata${labelMeta}</span><span style="font-size:11px; opacity:0.9;">CPL: Rp ${rp(globalCPL)}</span>`;
    }
    if (fnlClosing) {
        fnlClosing.style.width = wClosing + '%';
        fnlClosing.innerHTML = `<span style="font-size:15px; font-weight:900;">🤝 ${tot.dp} Closing (${globalCR}%)</span><span style="font-size:11px; opacity:0.9;">CAC: Rp ${rp(globalCAC)}</span>`;
    }
    if (fnlRevenue) {
        fnlRevenue.style.width = wRevenue + '%';
        fnlRevenue.innerHTML = `<span style="font-size:15px; font-weight:900;">💰 Omzet Rp ${rp(tot.omzet)}</span><span style="font-size:11px; opacity:0.9;">ROAS: ${globalROAS}x</span>`;
    }

    let elCanvasChart = document.getElementById('chartMarketingHarian');
    if (elCanvasChart) {
        if (window.myMktHarianChart) window.myMktHarianChart.destroy();
        let ctxMkt = elCanvasChart.getContext('2d');
        window.myMktHarianChart = new Chart(ctxMkt, {
            type: 'bar',
            data: {
                labels: cDates,
                datasets: [
                    { label: 'Omzet Penjualan (Rp)', type: 'line', data: cOmzet, borderColor: '#10b981', backgroundColor: '#10b981', borderWidth: 2, yAxisID: 'yRupiah', tension: 0.3 },
                    { label: 'Ad Spend (Rp)', type: 'line', data: cSpend, borderColor: '#ef4444', backgroundColor: '#ef4444', borderWidth: 2, yAxisID: 'yRupiah', tension: 0.3 },
                    { label: 'Leads (Meta Ads)', type: 'line', data: cLeadsMeta, borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', borderWidth: 2, borderDash: [5, 5], yAxisID: 'yQty', tension: 0.3 },
                    { label: 'Leads Masuk (CRM)', type: 'bar', data: cLeads, backgroundColor: 'rgba(59, 130, 246, 0.6)', yAxisID: 'yQty' },
                    { label: 'Closing (DP+)', type: 'bar', data: cDp, backgroundColor: 'rgba(245, 158, 11, 0.8)', yAxisID: 'yQty' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { stacked: false },
                    yRupiah: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Nilai Rupiah (Rp)' } },
                    yQty: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Jumlah Orang' }, grid: { drawOnChartArea: false } }
                }
            }
        });
    }

    function formatBulan(tgl) {
        if (!tgl) return '';
        let s = formati(tgl);
        return s ? s.substring(0, 7) : '';
    }

    let mktDataBulanan = {};
    function kosongBulanan(bln) {
        return {
            bulan: bln, spend: 0, leadsCRM: new Set(), leadsMeta: 0, dp: 0, omzet: 0,
            impressions: 0, reach: 0, linkClicks: 0, adaDataAds: false
        };
    }

    fd.forEach(r => {
        let bln = formatBulan(r.tanggal_chat);
        if (!bln) return;
        if (!mktDataBulanan[bln]) mktDataBulanan[bln] = kosongBulanan(bln);

        let wa = r.no_hp;
        if (!wa && !r.nama && !r.status) return;
        mktDataBulanan[bln].leadsCRM.add(wa);

        if (r.status && (r.status.includes('DP') || r.status.includes('Lunas'))) {
            mktDataBulanan[bln].dp++;
            mktDataBulanan[bln].omzet += Number(r.total) || 0;
        }
    });

    fAds.forEach(m => {
        let bln = formatBulan(m.tanggal);
        if (!bln) return;
        if (!mktDataBulanan[bln]) mktDataBulanan[bln] = kosongBulanan(bln);

        mktDataBulanan[bln].adaDataAds = true;
        mktDataBulanan[bln].spend += Number(m.spend) || 0;
        mktDataBulanan[bln].leadsMeta += Number(m.results) || 0;
        mktDataBulanan[bln].impressions += Number(m.impressions) || 0;
        mktDataBulanan[bln].reach += Number(m.reach) || 0;
        mktDataBulanan[bln].linkClicks += Number(m.link_clicks) || 0;
    });

    let sBulan = Object.keys(mktDataBulanan).sort();
    let bLabel = [], bSpend = [], bOmzet = [], bLeadsCRM = [], bLeadsMeta = [], bDp = [];
    sBulan.forEach(k => {
        let v = mktDataBulanan[k];
        bLabel.push(k);
        bSpend.push(v.spend);
        bOmzet.push(v.omzet);
        bLeadsCRM.push(v.leadsCRM.size);
        bLeadsMeta.push(v.leadsMeta);
        bDp.push(v.dp);
    });

    let elCanvasBulanan = document.getElementById('chartMarketingBulanan');
    if (elCanvasBulanan) {
        if (window.myMktBulananChart) window.myMktBulananChart.destroy();
        let ctxBln = elCanvasBulanan.getContext('2d');
        window.myMktBulananChart = new Chart(ctxBln, {
            type: 'bar',
            data: {
                labels: bLabel,
                datasets: [
                    { label: 'Ad Spend (Rp)', data: bSpend, backgroundColor: 'rgba(239, 68, 68, 0.75)', yAxisID: 'yRupiah' },
                    { label: 'Omzet (Rp)', data: bOmzet, backgroundColor: 'rgba(16, 185, 129, 0.75)', yAxisID: 'yRupiah' },
                    { label: 'Leads (Meta Ads)', type: 'line', data: bLeadsMeta, borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', borderWidth: 2, borderDash: [5, 5], yAxisID: 'yQty', tension: 0.3 },
                    { label: 'Leads (CRM/Real)', type: 'line', data: bLeadsCRM, borderColor: '#3b82f6', backgroundColor: '#3b82f6', borderWidth: 2, yAxisID: 'yQty', tension: 0.3 },
                    { label: 'Closing (DP+)', type: 'line', data: bDp, borderColor: '#f59e0b', backgroundColor: '#f59e0b', borderWidth: 2, yAxisID: 'yQty', tension: 0.3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            afterBody: function (items) {
                                let bln = items[0].label;
                                let d = mktDataBulanan[bln];
                                let roas = d && d.spend > 0 ? (d.omzet / d.spend).toFixed(1) : 0;
                                return 'ROAS: ' + roas + 'x';
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: false },
                    yRupiah: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Nilai Rupiah (Rp)' } },
                    yQty: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Jumlah Orang' }, grid: { drawOnChartArea: false } }
                }
            }
        });
    }

    let mktDataMingguan = {};
    function kosongMingguan(mgg) {
        return {
            minggu: mgg, spend: 0, leadsCRM: new Set(), leadsMeta: 0, dp: 0, omzet: 0,
            impressions: 0, reach: 0, linkClicks: 0, adaDataAds: false
        };
    }

    fd.forEach(r => {
        let mgg = formatMinggu(r.tanggal_chat);
        if (!mgg) return;
        if (!mktDataMingguan[mgg]) mktDataMingguan[mgg] = kosongMingguan(mgg);

        let wa = r.no_hp;
        if (!wa && !r.nama && !r.status) return;
        mktDataMingguan[mgg].leadsCRM.add(wa);

        if (r.status && (r.status.includes('DP') || r.status.includes('Lunas'))) {
            mktDataMingguan[mgg].dp++;
            mktDataMingguan[mgg].omzet += Number(r.total) || 0;
        }
    });

    fAds.forEach(m => {
        let mgg = formatMinggu(m.tanggal);
        if (!mgg) return;
        if (!mktDataMingguan[mgg]) mktDataMingguan[mgg] = kosongMingguan(mgg);

        mktDataMingguan[mgg].adaDataAds = true;
        mktDataMingguan[mgg].spend += Number(m.spend) || 0;
        mktDataMingguan[mgg].leadsMeta += Number(m.results) || 0;
        mktDataMingguan[mgg].impressions += Number(m.impressions) || 0;
        mktDataMingguan[mgg].reach += Number(m.reach) || 0;
        mktDataMingguan[mgg].linkClicks += Number(m.link_clicks) || 0;
    });

    let sMinggu = Object.keys(mktDataMingguan).sort();

    let targetAktifInfo = ambilTargetAktif(selectedCampaigns);

    let creativeBaruPerMinggu = hitungCreativeBaruPerMinggu(dataContent);
    renderBannerTargetMingguan(mktDataMingguan, sMinggu, creativeBaruPerMinggu, targetAktifInfo.target, targetAktifInfo.sumber);

    let wLabel = [], wSpend = [], wOmzet = [], wLeadsCRM = [], wLeadsMeta = [], wDp = [];
    sMinggu.forEach(k => {
        let v = mktDataMingguan[k];
        wLabel.push(labelMinggu(k));
        wSpend.push(v.spend);
        wOmzet.push(v.omzet);
        wLeadsCRM.push(v.leadsCRM.size);
        wLeadsMeta.push(v.leadsMeta);
        wDp.push(v.dp);
    });

    let elCanvasMingguan = document.getElementById('chartMarketingMingguan');
    if (elCanvasMingguan) {
        if (window.myMktMingguanChart) window.myMktMingguanChart.destroy();
        let ctxMgg = elCanvasMingguan.getContext('2d');
        window.myMktMingguanChart = new Chart(ctxMgg, {
            type: 'bar',
            data: {
                labels: wLabel,
                datasets: [
                    { label: 'Ad Spend (Rp)', data: wSpend, backgroundColor: 'rgba(239, 68, 68, 0.75)', yAxisID: 'yRupiah' },
                    { label: 'Omzet (Rp)', data: wOmzet, backgroundColor: 'rgba(16, 185, 129, 0.75)', yAxisID: 'yRupiah' },
                    { label: 'Leads (Meta Ads)', type: 'line', data: wLeadsMeta, borderColor: '#0ea5e9', backgroundColor: '#0ea5e9', borderWidth: 2, borderDash: [5, 5], yAxisID: 'yQty', tension: 0.3 },
                    { label: 'Leads (CRM/Real)', type: 'line', data: wLeadsCRM, borderColor: '#3b82f6', backgroundColor: '#3b82f6', borderWidth: 2, yAxisID: 'yQty', tension: 0.3 },
                    { label: 'Closing (DP+)', type: 'line', data: wDp, borderColor: '#f59e0b', backgroundColor: '#f59e0b', borderWidth: 2, yAxisID: 'yQty', tension: 0.3 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            afterBody: function (items) {
                                let lbl = items[0].label;
                                let idx = wLabel.indexOf(lbl);
                                let key = sMinggu[idx];
                                let d = mktDataMingguan[key];
                                let roas = d && d.spend > 0 ? (d.omzet / d.spend).toFixed(1) : 0;
                                return 'ROAS: ' + roas + 'x';
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: false },
                    yRupiah: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Nilai Rupiah (Rp)' } },
                    yQty: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Jumlah Orang' }, grid: { drawOnChartArea: false } }
                }
            }
        });
    }

    renderScorecardMingguan(mktDataMingguan, sMinggu, globalCPL, globalROAS, creativeBaruPerMinggu, targetAktifInfo.target);

    let pLabel = [], pSpend = [], pOmzet = [], pLeadsCRM = [], pLeadsMeta = [], pDp = [];
    sS.forEach(k => {
        let v = mktDataSummary[k];
        pLabel.push(v.camp);
        pSpend.push(v.spend);
        pOmzet.push(v.omzet);
        pLeadsCRM.push(v.leadsCRM.size);
        pLeadsMeta.push(v.leadsMeta);
        pDp.push(v.dp);
    });

    let elCanvasProduk = document.getElementById('chartMarketingProduk');
    if (elCanvasProduk) {
        if (window.myMktProdukChart) window.myMktProdukChart.destroy();
        let ctxProduk = elCanvasProduk.getContext('2d');
        window.myMktProdukChart = new Chart(ctxProduk, {
            type: 'bar',
            data: {
                labels: pLabel,
                datasets: [
                    { label: 'Ad Spend (Rp)', data: pSpend, backgroundColor: 'rgba(239, 68, 68, 0.75)', yAxisID: 'yRupiah' },
                    { label: 'Omzet (Rp)', data: pOmzet, backgroundColor: 'rgba(16, 185, 129, 0.75)', yAxisID: 'yRupiah' },
                    { label: 'Leads (Meta Ads)', data: pLeadsMeta, backgroundColor: 'rgba(14, 165, 233, 0.65)', yAxisID: 'yQty' },
                    { label: 'Leads (CRM/Real)', data: pLeadsCRM, backgroundColor: 'rgba(59, 130, 246, 0.85)', yAxisID: 'yQty' },
                    { label: 'Closing (DP+)', data: pDp, backgroundColor: 'rgba(245, 158, 11, 0.85)', yAxisID: 'yQty' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    tooltip: {
                        callbacks: {
                            afterBody: function (items) {
                                let produk = items[0].label;
                                let v = mktDataSummary[produk];
                                let roas = v && v.spend > 0 ? (v.omzet / v.spend).toFixed(1) : 0;
                                let cr = v && v.leadsCRM.size > 0 ? ((v.dp / v.leadsCRM.size) * 100).toFixed(1) : 0;
                                return ['ROAS: ' + roas + 'x', 'Conv. Rate: ' + cr + '%'];
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: false },
                    yRupiah: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Nilai Rupiah (Rp)' } },
                    yQty: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Jumlah Orang' }, grid: { drawOnChartArea: false } }
                }
            }
        });
    }

    let petaCampaignName = buatPetaCampaignName(dataAdsetPerformance, dataAdsetCityTargeting);
    let filterAdsetContent = { selectedNamaMeta, fStart, fEnd };
    let hasilAdset = renderBreakdownAdset(dataAdsetPerformance || [], petaCampaignName, filterAdsetContent);
    let hasilContent = renderBreakdownContent(dataContent || [], petaCampaignName, filterAdsetContent);

    let kandidatAdset = hasilAdset ? cariTerbaikTerburuk(hasilAdset.dataFlat) : { terbaik: null, terburuk: null };
    let kandidatContent = hasilContent ? cariTerbaikTerburuk(hasilContent.dataFlat) : { terbaik: null, terburuk: null };
    renderKandidatAdsetContent(kandidatAdset, kandidatContent, filterAdsetContent);

    let agregasiAdset = hasilAdset ? agregasiPerNamaLintasCampaign(hasilAdset.dataFlat) : [];
    let agregasiContent = hasilContent ? agregasiPerNamaLintasCampaign(hasilContent.dataFlat) : [];
    renderAgregasiAdsetAtauContent('theadAgregasiAdset', 'bAgregasiAdset', agregasiAdset, globalCPL);
    renderAgregasiAdsetAtauContent('theadAgregasiContent', 'bAgregasiContent', agregasiContent, globalCPL);

    renderInsightRekomendasi_v2(tot, mktDataSummary, sS, mktDataBulanan, sBulan,
        { totalLeadsCRM, globalCPL, globalCAC, globalCR, globalROAS, globalCTRMeta, globalMatchRate },
        kandidatAdset, kandidatContent, agregasiAdset, agregasiContent);
}


// ==============================================================
// HELPER FUNCTIONS: BREAKDOWN ADSET & CONTENT
// ==============================================================
function buatPetaCampaignName(dataAdsetPerformance, dataAdsetCityTargeting) {
    let adsetIdKeNama = {};
    (dataAdsetCityTargeting || []).forEach(row => {
        if (row.adset_id && row.campaign_name) {
            adsetIdKeNama[String(row.adset_id).trim()] = row.campaign_name;
        }
    });

    let campaignIdKeNama = {};
    (dataAdsetPerformance || []).forEach(row => {
        let nama = adsetIdKeNama[String(row.adset_id).trim()];
        let cid = String(row.campaign_id || '').trim();
        if (nama && cid && !campaignIdKeNama[cid]) {
            campaignIdKeNama[cid] = nama;
        }
    });
    return campaignIdKeNama;
}

const BATAS_BARIS_TERLIHAT = 20;

function renderBreakdownAdset(dataMentah, petaCampaignName, filterState) {
    let thead = document.getElementById('theadAdsetPerformance');
    let tbody = document.getElementById('bAdsetPerformance');
    if (!thead || !tbody) return null;

    if (!dataMentah || dataMentah.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td style="padding:14px; color:#94a3b8;">Belum ada data.</td></tr>';
        return null;
    }

    let data = dataMentah.map(row => ({
        ...row,
        _campaignName: petaCampaignName[String(row.campaign_id || '').trim()] || ('Campaign #' + row.campaign_id),
        _label: row.adset_name || '(tanpa nama adset)',
        _ctr: Number(row.ctr) || 0
    }));

    if (filterState.selectedNamaMeta && filterState.selectedNamaMeta.length > 0) {
        data = data.filter(row => filterState.selectedNamaMeta.some(sel => {
            let s = String(sel || '').toLowerCase();
            let v = String(row._campaignName || '').toLowerCase();
            return v.includes(s) || s.includes(v);
        }));
    }
    if (filterState.fStart) data = data.filter(row => formati(row.tanggal) >= filterState.fStart);
    if (filterState.fEnd) data = data.filter(row => formati(row.tanggal) <= filterState.fEnd);

    if (data.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td style="padding:14px; color:#94a3b8;">Tidak ada data yang cocok dengan filter aktif.</td></tr>';
        return null;
    }

    let grup = {};
    data.forEach(row => {
        let key = row._campaignName;
        if (!grup[key]) grup[key] = { nama: key, totalSpend: 0, rows: [] };
        grup[key].totalSpend += Number(row.spend) || 0;
        grup[key].rows.push(row);
    });
    let campaignUrut = Object.values(grup).sort((a, b) => b.totalSpend - a.totalSpend);
    campaignUrut.forEach(g => g.rows.sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)));

    thead.innerHTML = `
        <th style="text-align:left; font-size:12px;">Adset</th>
        <th style="font-size:12px;">Spend</th>
        <th style="font-size:12px;">Results</th>
        <th style="font-size:12px;">CPL</th>
        <th style="font-size:12px;">Purchases</th>
        <th style="font-size:12px;">CTR</th>
        <th style="font-size:12px;">Tanggal</th>
    `;

    function baris1Adset(row) {
        let spend = Number(row.spend) || 0;
        let results = Number(row.results) || 0;
        let purchases = Number(row.purchases) || 0;
        let cpl = results > 0 ? Math.round(spend / results) : null;
        let warnaCpl = cpl === null ? '#94a3b8' : (cpl > 30000 ? '#ef4444' : '#059669');
        let labelHasil = results === 0 ? '<span style="color:#ef4444; font-weight:700;">0</span>' : results;
        return `<tr>
            <td style="font-size:12.5px;">${row._label}</td>
            <td style="font-size:12.5px;">Rp ${rp(spend)}</td>
            <td style="font-size:12.5px;">${labelHasil}</td>
            <td style="font-size:12.5px; color:${warnaCpl}; font-weight:600;">${cpl !== null ? 'Rp ' + rp(cpl) : '-'}</td>
            <td style="font-size:12.5px;">${purchases}</td>
            <td style="font-size:12.5px;">${row._ctr.toFixed(2)}%</td>
            <td style="font-size:12.5px; white-space:nowrap;">${row.tanggal || '-'}</td>
        </tr>`;
    }
    function headerGrupAdset(g) {
        return `<tr style="background:#eef2ff;">
            <td colspan="7" style="font-weight:800; color:#4338ca; padding:8px 10px; font-size:12.5px;">
                📁 ${g.nama} <span style="font-weight:500; color:#64748b; font-size:11px;">(Total Spend: Rp ${rp(g.totalSpend)})</span>
            </td>
        </tr>`;
    }

    let htmlTerlihat = '', htmlTersembunyi = '';
    let jumlahBarisTerlihat = 0, jumlahBarisTersembunyi = 0, jumlahCampaignTersembunyi = 0;
    let modeSembunyi = false;

    campaignUrut.forEach(g => {
        if (!modeSembunyi && jumlahBarisTerlihat >= BATAS_BARIS_TERLIHAT) modeSembunyi = true;

        let headerHtml = headerGrupAdset(g);
        let rowsHtml = g.rows.map(baris1Adset).join('');

        if (!modeSembunyi) {
            htmlTerlihat += headerHtml + rowsHtml;
            jumlahBarisTerlihat += g.rows.length;
        } else {
            htmlTersembunyi += headerHtml + rowsHtml;
            jumlahBarisTersembunyi += g.rows.length;
            jumlahCampaignTersembunyi++;
        }
    });

    let html = htmlTerlihat;
    if (jumlahBarisTersembunyi > 0) {
        html += `<tr style="background:#f8fafc;">
            <td colspan="7" style="text-align:center; padding:10px; cursor:pointer; color:#6366f1; font-weight:700; font-size:12.5px;"
                onclick="toggleExpandBreakdown(this, 'hiddenAdsetRows')">
                ▼ Tampilkan ${jumlahBarisTersembunyi} baris lainnya (${jumlahCampaignTersembunyi} campaign) ▼
            </td>
        </tr>
        <tbody id="hiddenAdsetRows" style="display:none;">${htmlTersembunyi}</tbody>`;
    }

    tbody.innerHTML = html;

    return { campaignUrut, dataFlat: data };
}

function renderBreakdownContent(dataMentah, petaCampaignName, filterState) {
    let thead = document.getElementById('theadAdContentPerformance');
    let tbody = document.getElementById('bAdContentPerformance');
    if (!thead || !tbody) return null;

    if (!dataMentah || dataMentah.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td style="padding:14px; color:#94a3b8;">Belum ada data.</td></tr>';
        return null;
    }

    let data = dataMentah.map(row => ({
        ...row,
        _campaignName: petaCampaignName[String(row.campaign_id || '').trim()] || ('Campaign #' + row.campaign_id),
        _label: row.ad_name || '(tanpa nama iklan)',
        _ctr: Number(row.ctr_persen) || 0
    }));

    if (filterState.selectedNamaMeta && filterState.selectedNamaMeta.length > 0) {
        data = data.filter(row => filterState.selectedNamaMeta.some(sel => {
            let s = String(sel || '').toLowerCase();
            let v = String(row._campaignName || '').toLowerCase();
            return v.includes(s) || s.includes(v);
        }));
    }
    if (filterState.fStart) data = data.filter(row => formati(row.tanggal) >= filterState.fStart);
    if (filterState.fEnd) data = data.filter(row => formati(row.tanggal) <= filterState.fEnd);

    if (data.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td style="padding:14px; color:#94a3b8;">Tidak ada data yang cocok dengan filter aktif.</td></tr>';
        return null;
    }

    let grup = {};
    data.forEach(row => {
        let key = row._campaignName;
        if (!grup[key]) grup[key] = { nama: key, totalSpend: 0, rows: [] };
        grup[key].totalSpend += Number(row.spend) || 0;
        grup[key].rows.push(row);
    });
    let campaignUrut = Object.values(grup).sort((a, b) => b.totalSpend - a.totalSpend);
    campaignUrut.forEach(g => g.rows.sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)));

    thead.innerHTML = `
        <th style="text-align:left; font-size:12px;">Ad Name</th>
        <th style="font-size:12px;">Tipe</th>
        <th style="font-size:12px;">Spend</th>
        <th style="font-size:12px;">Results</th>
        <th style="font-size:12px;">CPL</th>
        <th style="font-size:12px;">Purchases</th>
        <th style="font-size:12px;">CTR</th>
        <th style="font-size:12px;">Tanggal</th>
    `;

    function baris1Content(row) {
        let spend = Number(row.spend) || 0;
        let results = Number(row.results) || 0;
        let purchases = Number(row.purchases) || 0;
        let cpl = results > 0 ? Math.round(spend / results) : null;
        let warnaCpl = cpl === null ? '#94a3b8' : (cpl > 30000 ? '#ef4444' : '#059669');
        let labelHasil = results === 0 ? '<span style="color:#ef4444; font-weight:700;">0</span>' : results;
        return `<tr>
            <td style="font-size:12.5px;">${row._label}</td>
            <td style="font-size:12.5px;">${row.creative_type || '-'}</td>
            <td style="font-size:12.5px;">Rp ${rp(spend)}</td>
            <td style="font-size:12.5px;">${labelHasil}</td>
            <td style="font-size:12.5px; color:${warnaCpl}; font-weight:600;">${cpl !== null ? 'Rp ' + rp(cpl) : '-'}</td>
            <td style="font-size:12.5px;">${purchases}</td>
            <td style="font-size:12.5px;">${row._ctr.toFixed(2)}%</td>
            <td style="font-size:12.5px; white-space:nowrap;">${row.tanggal || '-'}</td>
        </tr>`;
    }
    function headerGrupContent(g) {
        return `<tr style="background:#fdf4ff;">
            <td colspan="8" style="font-weight:800; color:#a21caf; padding:8px 10px; font-size:12.5px;">
                📁 ${g.nama} <span style="font-weight:500; color:#64748b; font-size:11px;">(Total Spend: Rp ${rp(g.totalSpend)})</span>
            </td>
        </tr>`;
    }

    let htmlTerlihat = '', htmlTersembunyi = '';
    let jumlahBarisTerlihat = 0, jumlahBarisTersembunyi = 0;
    let modeSembunyi = false;

    campaignUrut.forEach(g => {
        if (!modeSembunyi && jumlahBarisTerlihat >= BATAS_BARIS_TERLIHAT) modeSembunyi = true;

        let headerHtml = headerGrupContent(g);
        let rowsHtml = g.rows.map(baris1Content).join('');

        if (!modeSembunyi) {
            htmlTerlihat += headerHtml + rowsHtml;
            jumlahBarisTerlihat += g.rows.length;
        } else {
            htmlTersembunyi += headerHtml + rowsHtml;
            jumlahBarisTersembunyi += g.rows.length;
        }
    });

    let html = htmlTerlihat;
    if (jumlahBarisTersembunyi > 0) {
        html += `<tr style="background:#f8fafc;">
            <td colspan="8" style="text-align:center; padding:10px; cursor:pointer; color:#a21caf; font-weight:700; font-size:12.5px;"
                onclick="toggleExpandBreakdown(this, 'hiddenContentRows')">
                ▼ Tampilkan ${jumlahBarisTersembunyi} baris lainnya ▼
            </td>
        </tr>
        <tbody id="hiddenContentRows" style="display:none;">${htmlTersembunyi}</tbody>`;
    }

    tbody.innerHTML = html;

    return { campaignUrut, dataFlat: data };
}

function toggleExpandBreakdown(el, idHidden) {
    let hidden = document.getElementById(idHidden);
    if (!hidden) return;
    if (hidden.style.display === 'none') {
        hidden.style.display = '';
        el.innerHTML = '▲ Sembunyikan ▲';
    } else {
        hidden.style.display = 'none';
        el.innerHTML = '▼ Tampilkan baris lainnya ▼';
    }
}

function cariTerbaikTerburuk(rows) {
    if (!rows || rows.length === 0) return { terbaik: null, terburuk: null };
    let adaSpend = rows.filter(r => (Number(r.spend) || 0) > 0);
    if (adaSpend.length === 0) return { terbaik: null, terburuk: null };

    let adaHasil = adaSpend.filter(r => (Number(r.results) || 0) > 0);
    let terbaik = null;
    if (adaHasil.length > 0) {
        terbaik = [...adaHasil].sort((a, b) => {
            let cplA = (Number(a.spend) || 0) / (Number(a.results) || 1);
            let cplB = (Number(b.spend) || 0) / (Number(b.results) || 1);
            return cplA - cplB;
        })[0];
    }

    let nolHasil = adaSpend.filter(r => (Number(r.results) || 0) === 0);
    let terburuk = null;
    if (nolHasil.length > 0) {
        terburuk = [...nolHasil].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0))[0];
    } else {
        terburuk = [...adaSpend].sort((a, b) => {
            let cplA = (Number(a.spend) || 0) / (Number(a.results) || 1);
            let cplB = (Number(b.spend) || 0) / (Number(b.results) || 1);
            return cplB - cplA;
        })[0];
    }
    return { terbaik, terburuk };
}


// ==============================================================
// INSIGHT TACTICAL v2
// ==============================================================
function renderInsightRekomendasi_v2(tot, mktDataSummary, sS, mktDataBulanan, sBulan, g, kandidatAdset, kandidatContent, agregasiAdset, agregasiContent) {
    let insight = [];
    let todo = [];

    if (tot.adaDataAds && tot.leadsMeta > 0) {
        if (g.globalMatchRate < 50) {
            insight.push(`⚠️ <b>Match Rate ${g.globalMatchRate}%</b> (target: >70%) — ${g.totalLeadsCRM} leads CRM dari ${rp(tot.leadsMeta)} chat Meta.`);
            todo.push(`🔴 <b>[TRACKING-01]</b> Audit input leads manual — ${Math.round((1 - g.globalMatchRate/100) * 100)}% chat Meta hilang. Kapan? Di WhatsApp? Lupa input database?`);
        } else {
            insight.push(`✅ Match Rate ${g.globalMatchRate}% — pencocokkan leads Meta → CRM sehat.`);
        }
    }

    if (tot.spend > 0) {
        let statusRoas = '';
        let drill = '';
        if (g.globalROAS < 1) {
            statusRoas = '🔴 Belum Untung';
            drill = g.globalCR < 10
                ? `(CR ${g.globalCR}% — banyak leads tapi jarang closing)`
                : `(CPL Rp${rp(g.globalCPL)} — sedikit leads, mahal)`;
        } else if (g.globalROAS < 2) {
            statusRoas = '🟡 Untung Tipis';
            drill = `(masih ruang optim: CR ${g.globalCR}%, CPL Rp${rp(g.globalCPL)})`;
        } else {
            statusRoas = '🟢 Sehat';
            drill = `ROAS ${g.globalROAS}x — target: jaga di >2x`;
        }
        insight.push(`${statusRoas} ROAS ${g.globalROAS}x ${drill}`);

        if (g.globalROAS < 1 && g.globalCR < 10) {
            todo.push(`🔴 <b>[ROAS-DR1]</b> <u>Root Cause: CR Rendah (${g.globalCR}%)</u> — campaign dapat leads tapi conversion buruk. Cek: apa messaging kamu clear? adakah follow-up? pricing terlalu tinggi?`);
        } else if (g.globalROAS < 1 && g.globalCPL > 50000) {
            todo.push(`🔴 <b>[ROAS-DR2]</b> <u>Root Cause: CPL Tinggi (Rp${rp(g.globalCPL)})</u> — targeting terlalu luas atau kreatif tidak menarik. Test: narrowing audience atau ganti creative.`);
        }
    }

    let produkAdaSpend = sS.filter(k => mktDataSummary[k].spend > 0);
    if (produkAdaSpend.length > 0) {
        let urutRoas = [...produkAdaSpend].sort((a, b) => {
            let ra = mktDataSummary[a].spend > 0 ? mktDataSummary[a].omzet / mktDataSummary[a].spend : 0;
            let rb = mktDataSummary[b].spend > 0 ? mktDataSummary[b].omzet / mktDataSummary[b].spend : 0;
            return rb - ra;
        });

        let terbaik = mktDataSummary[urutRoas[0]];
        let roasTerbaik = terbaik.omzet / terbaik.spend;
        insight.push(`🏆 Produk Terbaik: <b>${terbaik.camp}</b> (ROAS ${roasTerbaik.toFixed(1)}x, Rp${rp(terbaik.spend)} → Rp${rp(terbaik.omzet)})`);

        let terburuk = mktDataSummary[urutRoas[urutRoas.length - 1]];
        let roasTerburuk = terburuk.spend > 0 ? terburuk.omzet / terburuk.spend : 0;
        if (roasTerburuk < 1) {
            let drillTerburuk = terburuk.leadsCRM.size === 0
                ? `(0 leads dari Rp${rp(terburuk.spend)})`
                : `(CR ${((terburuk.dp / terburuk.leadsCRM.size) * 100).toFixed(0)}%, CPL Rp${rp(terburuk.spend / terburuk.leadsCRM.size)})`;
            insight.push(`🔴 Produk Terburuk: <b>${terburuk.camp}</b> (ROAS ${roasTerburuk.toFixed(1)}x) ${drillTerburuk}`);
            todo.push(`🔴 <b>[PRODUK-${terburuk.camp.substring(0,4).toUpperCase()}]</b> Pause "<b>${terburuk.camp}</b>" atau ganti target — ROAS < 1.`);
        }
    }

    if (kandidatAdset && kandidatAdset.terburuk) {
        let t = kandidatAdset.terburuk;
        let spend = Number(t.spend) || 0;
        let results = Number(t.results) || 0;
        if (spend > 5000 && results === 0) {
            insight.push(`🔴 Adset paling boros (0 hasil): <b>${t._label}</b> di campaign ${t._campaignName} — Rp${rp(spend)} tanpa leads.`);
            todo.push(`🔴 <b>[ADSET-BOROS]</b> <u>URGENT: Matikan adset</u> "<b>${t._label}</b>" (campaign: ${t._campaignName}) — sudah spend Rp${rp(spend)}, 0 hasil. Cek: audience terlalu sempit? kreatif tidak muncul? platform issue?`);
        }
    }

    if (kandidatContent && kandidatContent.terburuk) {
        let t = kandidatContent.terburuk;
        let spend = Number(t.spend) || 0;
        let results = Number(t.results) || 0;
        if (spend > 5000 && results === 0) {
            insight.push(`🔴 Creative paling boros (0 hasil): <b>${t._label}</b> (${t.creative_type || 'unknown'}) — Rp${rp(spend)} tanpa leads.`);
            todo.push(`🔴 <b>[CREATIVE-BOROS]</b> Ganti creative "<b>${t._label}</b>" — CTR ${t._ctr.toFixed(2)}%, Rp${rp(spend)} tanpa hasil. Test: video vs foto? copy lain? audience lain?`);
        }
    }

    if (kandidatAdset && kandidatAdset.terbaik) {
        let b = kandidatAdset.terbaik;
        let spend = Number(b.spend) || 0;
        let results = Number(b.results) || 0;
        let cplB = results > 0 ? Math.round(spend / results) : 0;
        if (cplB > 0 && cplB < (g.globalCPL * 0.7)) {
            insight.push(`🟢 Adset Efisien: <b>${b._label}</b> (CPL Rp${rp(cplB)}, ${Math.round((1 - cplB/g.globalCPL) * 100)}% lebih murah dari rata-rata).`);
            todo.push(`🟢 <b>[ADSET-SCALE]</b> <u>Naikkan budget</u> adset "<b>${b._label}</b>" — CPL-nya Rp${rp(cplB)}, ${Math.round((1 - cplB/g.globalCPL) * 100)}% lebih murah dari rata-rata (Rp${rp(g.globalCPL)}). Scale: +20-30% dulu, monitor 3 hari.`);
        }
    }

    if (kandidatContent && kandidatContent.terbaik) {
        let b = kandidatContent.terbaik;
        let spend = Number(b.spend) || 0;
        let results = Number(b.results) || 0;
        let cplB = results > 0 ? Math.round(spend / results) : 0;
        if (cplB > 0 && cplB < (g.globalCPL * 0.7)) {
            insight.push(`🟢 Creative Efisien: <b>${b._label}</b> (tipe: ${b.creative_type}, CPL Rp${rp(cplB)}).`);
            todo.push(`🟢 <b>[CREATIVE-SCALE]</b> Duplikasi/scale creative "<b>${b._label}</b>" — CPL Rp${rp(cplB)} (terbaik di campaign). Buat 2-3 variasi, test di audience berbeda.`);
        }
    }

    if (tot.adaDataAds && tot.impressions > 0 && g.globalCTRMeta < 1) {
        insight.push(`🟡 CTR Rendah (${g.globalCTRMeta}%) — kreatif kurang menarik perhatian.`);
        todo.push(`🟡 <b>[KREATIF-CTR]</b> Test creative baru untuk campaign dengan CTR <1% — focus: hook/thumbnail yang lebih attention-grabbing.`);
    }

    if (tot.adaDataAds && tot.linkClicks > 0) {
        let clickToLeadRateGlobal = (tot.leadsMeta / tot.linkClicks) * 100;
        if (clickToLeadRateGlobal < 5 && g.globalCTRMeta >= 1) {
            insight.push(`🟡 Click-to-Lead Rate cuma <b>${clickToLeadRateGlobal.toFixed(0)}%</b> — padahal CTR oke (${g.globalCTRMeta}%). Orang klik iklan tapi tidak lanjut chat.`);
            todo.push(`🟡 <b>[FUNNEL-CLICK]</b> Cek proses SETELAH klik iklan — apakah link mengarah ke WhatsApp/landing yang benar? Loading lambat? CTA membingungkan? Ini bukan masalah kreatif iklan, tapi funnel sesudahnya.`);
        }
    }

    if (sBulan.length >= 2) {
        let blnTerakhir = sBulan[sBulan.length - 1];
        let blnSebelum = sBulan[sBulan.length - 2];
        let dT = mktDataBulanan[blnTerakhir], dS = mktDataBulanan[blnSebelum];

        function persenNaik(now, before) {
            if (before === 0) return now > 0 ? 100 : 0;
            return (((now - before) / before) * 100).toFixed(0);
        }

        let naikSpend = Number(persenNaik(dT.spend, dS.spend));
        let naikOmzet = Number(persenNaik(dT.omzet, dS.omzet));
        let naikLeads = Number(persenNaik(dT.leadsCRM.size, dS.leadsCRM.size));

        insight.push(`📅 MoM ${blnTerakhir} vs ${blnSebelum}: Spend ${naikSpend > 0 ? '+' : ''}${naikSpend}%, Omzet ${naikOmzet > 0 ? '+' : ''}${naikOmzet}%, Leads ${naikLeads > 0 ? '+' : ''}${naikLeads}%.`);

        if (naikSpend > 20 && naikOmzet < naikSpend - 5) {
            todo.push(`🟡 <b>[MOM-01]</b> Efisiensi turun — Spend naik ${naikSpend}% tapi omzet naik ${naikOmzet}%. Review audience targeting.`);
        }
        if (naikLeads < -20) {
            todo.push(`🟡 <b>[MOM-02]</b> Leads turun ${Math.abs(naikLeads)}%. Cek campaign status & audience reach.`);
        }
    }

    if (agregasiAdset && agregasiAdset.length > 0) {
        let polaBorosAdset = agregasiAdset
            .filter(v => v.status.tipe === 'boros_berulang')
            .sort((a, b) => b.totalSpend - a.totalSpend)[0];
        if (polaBorosAdset) {
            insight.push(`🔴 <b>Pola Berulang:</b> Adset/setting "<b>${polaBorosAdset.nama}</b>" dipakai di ${polaBorosAdset.jumlahCampaign} campaign berbeda (${polaBorosAdset.instanceCount}x), TOTAL spend Rp${rp(polaBorosAdset.totalSpend)}, 0 hasil SAMA SEKALI di semua tempat.`);
            todo.push(`🔴 <b>[POLA-ADSET-BOROS]</b> <u>Hentikan setting ini PERMANEN dari template</u> — "<b>${polaBorosAdset.nama}</b>" gagal konsisten di ${polaBorosAdset.jumlahCampaign} campaign berbeda. Ini bukan kesialan 1 campaign, ini masalah di targeting/kreatifnya sendiri. Jangan dipakai lagi untuk campaign baru.`);
        }

        let polaBaikAdset = agregasiAdset
            .filter(v => v.status.tipe === 'konsisten' && v.cpl !== null && v.cpl < g.globalCPL * 0.7)
            .sort((a, b) => a.cpl - b.cpl)[0];
        if (polaBaikAdset) {
            insight.push(`🟢 <b>Pola Winning:</b> Adset/setting "<b>${polaBaikAdset.nama}</b>" konsisten efisien di ${polaBaikAdset.jumlahCampaign} campaign (CPL gabungan Rp${rp(polaBaikAdset.cpl)}).`);
            todo.push(`🟢 <b>[POLA-ADSET-WINNING]</b> <u>Jadikan template standar</u> — "<b>${polaBaikAdset.nama}</b>" terbukti bekerja di banyak campaign. Gunakan setting/targeting ini sebagai basis untuk campaign baru berikutnya.`);
        }
    }

    if (agregasiContent && agregasiContent.length > 0) {
        let polaBorosContent = agregasiContent
            .filter(v => v.status.tipe === 'boros_berulang')
            .sort((a, b) => b.totalSpend - a.totalSpend)[0];
        if (polaBorosContent) {
            insight.push(`🔴 <b>Pola Berulang (Creative):</b> "<b>${polaBorosContent.nama}</b>" dipakai di ${polaBorosContent.jumlahCampaign} campaign (${polaBorosContent.instanceCount}x), total spend Rp${rp(polaBorosContent.totalSpend)}, 0 hasil.`);
            todo.push(`🔴 <b>[POLA-CREATIVE-BOROS]</b> <u>Buang creative ini dari library</u> — "<b>${polaBorosContent.nama}</b>" sudah dicoba berulang di ${polaBorosContent.jumlahCampaign} campaign, tidak pernah menghasilkan. Bukan masalah targeting, masalah di materinya sendiri.`);
        }
    }

    if (insight.length === 0) insight.push('Belum ada cukup data untuk insight pada filter/periode ini.');
    if (todo.length === 0) todo.push('🟢 Tidak ada red-flag terdeteksi — performa dalam batas wajar.');

    let elInsight = document.getElementById('listInsightMarketing');
    if (elInsight) elInsight.innerHTML = insight.map(t => `<li style="margin-bottom:8px; line-height:1.5;">${t}</li>`).join('');

    let elTodo = document.getElementById('listTodoMarketing');
    if (elTodo) {
        elTodo.innerHTML = todo.map(t => {
            let isBold = t.includes('<u>') ? 'style="background:#fff3cd;"' : '';
            return `<li style="margin-bottom:8px; line-height:1.5; padding:6px; border-radius:4px; ${isBold}">${t}</li>`;
        }).join('');
    }
}


// ==============================================================
// AGREGASI PERFORMA LINTAS CAMPAIGN (per nama adset/creative yang sama)
// ==============================================================
function agregasiPerNamaLintasCampaign(dataFlat) {
    let map = {};
    dataFlat.forEach(row => {
        let nama = row._label;
        if (!map[nama]) {
            map[nama] = {
                nama,
                totalSpend: 0, totalResults: 0, totalPurchases: 0,
                instanceCount: 0, campaignSet: new Set()
            };
        }
        map[nama].totalSpend += Number(row.spend) || 0;
        map[nama].totalResults += Number(row.results) || 0;
        map[nama].totalPurchases += Number(row.purchases) || 0;
        map[nama].instanceCount++;
        map[nama].campaignSet.add(row._campaignName);
    });

    return Object.values(map).map(v => {
        let cpl = v.totalResults > 0 ? Math.round(v.totalSpend / v.totalResults) : null;
        let jumlahCampaign = v.campaignSet.size;
        let berulang = v.instanceCount >= 2;

        let status = { label: '-', warna: '#94a3b8', tipe: 'netral' };
        if (berulang && v.totalResults === 0 && v.totalSpend > 15000) {
            status = { label: '🔴 Pola Boros Berulang', warna: '#ef4444', tipe: 'boros_berulang' };
        } else if (!berulang && v.totalResults === 0 && v.totalSpend > 15000) {
            status = { label: '🟠 Boros (1x)', warna: '#f97316', tipe: 'boros_sekali' };
        } else if (berulang && cpl !== null) {
            status = { label: '🟢 Pola Konsisten', warna: '#10b981', tipe: 'konsisten' };
        } else if (cpl !== null) {
            status = { label: '⚪ Normal', warna: '#64748b', tipe: 'normal' };
        }

        return { ...v, cpl, jumlahCampaign, berulang, status };
    });
}


function renderAgregasiAdsetAtauContent(theadId, tbodyId, dataAgregasi, globalCPL) {
    let thead = document.getElementById(theadId);
    let tbody = document.getElementById(tbodyId);
    if (!thead || !tbody) return;

    if (!dataAgregasi || dataAgregasi.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = '<tr><td style="padding:14px; color:#94a3b8;">Belum ada data.</td></tr>';
        return;
    }

    let prioritas = { boros_berulang: 0, konsisten: 1, boros_sekali: 2, normal: 3, netral: 4 };
    let sorted = [...dataAgregasi].sort((a, b) => {
        let pa = prioritas[a.status.tipe], pb = prioritas[b.status.tipe];
        if (pa !== pb) return pa - pb;
        return b.totalSpend - a.totalSpend;
    });

    thead.innerHTML = `
        <th style="text-align:left; font-size:12px;">Nama</th>
        <th style="font-size:12px;">Muncul (x)</th>
        <th style="font-size:12px;">Jml Campaign</th>
        <th style="font-size:12px;">Total Spend</th>
        <th style="font-size:12px;">Total Results</th>
        <th style="font-size:12px;">CPL Gabungan</th>
        <th style="font-size:12px;">Status/Rekomendasi</th>
    `;

    tbody.innerHTML = sorted.map(v => {
        let cplBanding = '';
        if (v.cpl !== null && globalCPL > 0) {
            let persen = Math.round((1 - v.cpl / globalCPL) * 100);
            cplBanding = persen > 0
                ? `<span style="color:#059669; font-size:10.5px;"> (${persen}% lebih murah)</span>`
                : (persen < 0 ? `<span style="color:#ef4444; font-size:10.5px;"> (${Math.abs(persen)}% lebih mahal)</span>` : '');
        }
        return `<tr>
            <td style="font-size:12.5px; max-width:220px;">${v.nama}</td>
            <td style="font-size:12.5px; text-align:center;">${v.instanceCount}${v.berulang ? ' 🔁' : ''}</td>
            <td style="font-size:12.5px; text-align:center;">${v.jumlahCampaign}</td>
            <td style="font-size:12.5px;">Rp ${rp(v.totalSpend)}</td>
            <td style="font-size:12.5px;">${v.totalResults === 0 ? '<span style="color:#ef4444; font-weight:700;">0</span>' : v.totalResults}</td>
            <td style="font-size:12.5px;">${v.cpl !== null ? 'Rp ' + rp(v.cpl) + cplBanding : '-'}</td>
            <td style="font-size:12px; color:${v.status.warna}; font-weight:700;">${v.status.label}</td>
        </tr>`;
    }).join('');
}


// ==============================================================
// BADGE FILTER AKTIF + KANDIDAT TERBAIK/TERBURUK
// ==============================================================
function buatBadgeFilter(filterState) {
    let bagian = [];
    if (filterState.selectedNamaMeta && filterState.selectedNamaMeta.length > 0) {
        bagian.push(filterState.selectedNamaMeta.length <= 2
            ? filterState.selectedNamaMeta.join(', ')
            : filterState.selectedNamaMeta.length + ' campaign dipilih');
    } else {
        bagian.push('Semua Campaign');
    }
    if (filterState.fStart || filterState.fEnd) {
        bagian.push((filterState.fStart || '...') + ' s/d ' + (filterState.fEnd || '...'));
    } else {
        bagian.push('Semua Tanggal');
    }
    return '📍 Berdasarkan: ' + bagian.join(' · ');
}

function renderKandidatAdsetContent(kandidatAdset, kandidatContent, filterState) {
    let elBadge = document.getElementById('badgeFilterKandidat');
    if (elBadge && filterState) elBadge.innerText = buatBadgeFilter(filterState);

    let el = document.getElementById('isiKandidatAdsetContent');
    if (!el) return;

    function kartu(judul, row, warnaBorder) {
        if (!row) return `<div style="padding:14px; border-radius:10px; border:1px solid #e2e8f0; color:#94a3b8; font-size:12.5px;">${judul}: belum ada data yang cukup.</div>`;
        let spend = Number(row.spend) || 0;
        let results = Number(row.results) || 0;
        let cpl = results > 0 ? Math.round(spend / results) : null;
        return `
        <div style="padding:14px; border-radius:10px; border-left:4px solid ${warnaBorder}; background:#fff; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
            <div style="font-size:11px; color:#64748b; text-transform:uppercase; font-weight:700; margin-bottom:4px;">${judul}</div>
            <div style="font-weight:800; font-size:13.5px; color:#1e293b; margin-bottom:6px; line-height:1.3;">${row._label}</div>
            <div style="font-size:12px; color:#475569; line-height:1.7;">
                Campaign: <b>${row._campaignName || '-'}</b><br>
                Spend: <b>Rp ${rp(spend)}</b> · Results: <b>${results}</b><br>
                CPL: <b>${cpl !== null ? 'Rp ' + rp(cpl) : '-'}</b> · CTR: <b>${row._ctr.toFixed(2)}%</b>
            </div>
        </div>`;
    }

    let html = '';
    html += kartu('🟢 Adset Terbaik (Paling Efisien)', kandidatAdset.terbaik, '#10b981');
    html += kartu('🔴 Adset Terburuk (Kandidat Dimatikan)', kandidatAdset.terburuk, '#ef4444');
    html += kartu('🟢 Creative Terbaik', kandidatContent.terbaik, '#10b981');
    html += kartu('🔴 Creative Terburuk (Kandidat Diganti)', kandidatContent.terburuk, '#ef4444');
    el.innerHTML = html;
}


// ==============================================================
// EOS L10 SCORECARD MINGGUAN
// ==============================================================
function renderScorecardMingguan(mktDataMingguan, sMinggu, globalCPL, globalROAS, creativeBaruPerMinggu, target) {
    let container = document.getElementById('containerScorecardMingguan');
    if (!container) return;

    if (!sMinggu || sMinggu.length === 0) {
        container.innerHTML = '<div style="padding:14px; color:#94a3b8; font-size:12.5px;">Belum ada data mingguan untuk filter/periode ini.</div>';
        return;
    }

    let minggUntukTabel = sMinggu.slice(-10);

    function warnaROAS(roas) {
        if (roas >= 2) return { warna: '#dcfce7', teks: '#166534' };
        if (roas >= 1) return { warna: '#fef9c3', teks: '#854d0e' };
        return { warna: '#fee2e2', teks: '#991b1b' };
    }
    function warnaCPL(cpl, cplGlobal) {
        if (cpl === null) return { warna: '#f8fafc', teks: '#94a3b8' };
        if (cpl <= cplGlobal * 0.9) return { warna: '#dcfce7', teks: '#166534' };
        if (cpl <= cplGlobal * 1.2) return { warna: '#fef9c3', teks: '#854d0e' };
        return { warna: '#fee2e2', teks: '#991b1b' };
    }
    function warnaCR(cr) {
        if (cr >= 15) return { warna: '#dcfce7', teks: '#166534' };
        if (cr >= 8) return { warna: '#fef9c3', teks: '#854d0e' };
        return { warna: '#fee2e2', teks: '#991b1b' };
    }
    function warnaCreativeBaru(jml) {
        if (jml >= (target ? target.creativeBaruMin : 2)) return { warna: '#dcfce7', teks: '#166534' };
        if (jml >= 1) return { warna: '#fef9c3', teks: '#854d0e' };
        return { warna: '#fee2e2', teks: '#991b1b' };
    }
    function warnaClickToLead(rate) {
        if (rate === null) return { warna: '#f8fafc', teks: '#94a3b8' };
        if (rate >= 15) return { warna: '#dcfce7', teks: '#166534' };
        if (rate >= 5) return { warna: '#fef9c3', teks: '#854d0e' };
        return { warna: '#fee2e2', teks: '#991b1b' };
    }

    let dataMinggu = minggUntukTabel.map(key => {
        let v = mktDataMingguan[key];
        let jmlLeadsCRM = v.leadsCRM.size;
        let cpl = jmlLeadsCRM > 0 ? Math.round(v.spend / jmlLeadsCRM) : null;
        let cr = jmlLeadsCRM > 0 ? (v.dp / jmlLeadsCRM * 100) : null;
        let roas = v.spend > 0 ? (v.omzet / v.spend) : null;
        let creativeBaru = (creativeBaruPerMinggu && creativeBaruPerMinggu[key]) || 0;
        let clickToLeadRate = v.linkClicks > 0 ? (v.leadsMeta / v.linkClicks * 100) : null;
        return { key, label: labelMinggu(key), spend: v.spend, leadsMeta: v.leadsMeta, leadsCRM: jmlLeadsCRM, dp: v.dp, omzet: v.omzet, cpl, cr, roas, creativeBaru, linkClicks: v.linkClicks, clickToLeadRate };
    });

    let thStyle = 'padding:8px 10px; font-size:11.5px; font-weight:700; text-align:center; white-space:nowrap; background:#0f172a; color:#fff;';
    let tdLabelStyle = 'padding:8px 10px; font-size:12px; font-weight:700; color:#1e293b; white-space:nowrap; position:sticky; left:0; background:#f8fafc; border-right:2px solid #e2e8f0;';
    let tdStyle = 'padding:8px 10px; font-size:12px; text-align:center; white-space:nowrap;';

    let html = '<table style="border-collapse:collapse; width:100%;"><thead><tr>';
    html += `<th style="${thStyle} text-align:left; position:sticky; left:0; z-index:2;">Metrik</th>`;
    dataMinggu.forEach(m => { html += `<th style="${thStyle}">${m.label}</th>`; });
    html += '</tr></thead><tbody>';

    html += `<tr><td colspan="${dataMinggu.length + 1}" style="padding:6px 10px; font-size:10.5px; font-weight:800; color:#4338ca; background:#eef2ff; text-transform:uppercase; letter-spacing:0.5px;">🔮 Leading Indicators</td></tr>`;

    html += `<tr><td style="${tdLabelStyle}">🆕 Creative Baru Ditest</td>`;
    dataMinggu.forEach(m => {
        let w = warnaCreativeBaru(m.creativeBaru);
        html += `<td style="${tdStyle} background:${w.warna}; color:${w.teks}; font-weight:700;">${m.creativeBaru}</td>`;
    });
    html += '</tr>';

    html += `<tr><td style="${tdLabelStyle}">📢 Leads (Meta)</td>`;
    dataMinggu.forEach(m => { html += `<td style="${tdStyle}">${m.leadsMeta}</td>`; });
    html += '</tr>';

    html += `<tr><td style="${tdLabelStyle}">🖱️ Click→Lead Rate</td>`;
    dataMinggu.forEach(m => {
        if (m.clickToLeadRate === null) { html += `<td style="${tdStyle} background:#f8fafc; color:#94a3b8;">-</td>`; return; }
        let w = warnaClickToLead(m.clickToLeadRate);
        html += `<td style="${tdStyle} background:${w.warna}; color:${w.teks}; font-weight:700;">${m.clickToLeadRate.toFixed(0)}%</td>`;
    });
    html += '</tr>';

    html += `<tr><td style="${tdLabelStyle}">💬 Leads (CRM)</td>`;
    dataMinggu.forEach(m => { html += `<td style="${tdStyle}">${m.leadsCRM}</td>`; });
    html += '</tr>';

    html += `<tr><td style="${tdLabelStyle}">💰 CPL</td>`;
    dataMinggu.forEach(m => {
        if (m.cpl === null) { html += `<td style="${tdStyle} background:#f8fafc; color:#94a3b8;">-</td>`; return; }
        let w = warnaCPL(m.cpl, globalCPL);
        html += `<td style="${tdStyle} background:${w.warna}; color:${w.teks}; font-weight:700;">Rp ${rp(m.cpl)}</td>`;
    });
    html += '</tr>';

    html += `<tr><td colspan="${dataMinggu.length + 1}" style="padding:6px 10px; font-size:10.5px; font-weight:800; color:#0f172a; background:#f1f5f9; text-transform:uppercase; letter-spacing:0.5px;">📊 Lagging Indicators (Hasil Akhir)</td></tr>`;

    html += `<tr><td style="${tdLabelStyle}">💸 Ad Spend</td>`;
    dataMinggu.forEach(m => { html += `<td style="${tdStyle}">Rp ${rp(m.spend)}</td>`; });
    html += '</tr>';

    html += `<tr><td style="${tdLabelStyle}">🤝 Closing (DP+)</td>`;
    dataMinggu.forEach(m => { html += `<td style="${tdStyle}">${m.dp}</td>`; });
    html += '</tr>';

    html += `<tr><td style="${tdLabelStyle}">📈 Conv. Rate</td>`;
    dataMinggu.forEach(m => {
        if (m.cr === null) { html += `<td style="${tdStyle} background:#f8fafc; color:#94a3b8;">-</td>`; return; }
        let w = warnaCR(m.cr);
        html += `<td style="${tdStyle} background:${w.warna}; color:${w.teks}; font-weight:700;">${m.cr.toFixed(0)}%</td>`;
    });
    html += '</tr>';

    html += `<tr><td style="${tdLabelStyle}">🏦 Omzet</td>`;
    dataMinggu.forEach(m => { html += `<td style="${tdStyle}">Rp ${rp(m.omzet)}</td>`; });
    html += '</tr>';

    html += `<tr><td style="${tdLabelStyle}">🎯 ROAS</td>`;
    dataMinggu.forEach(m => {
        if (m.roas === null) { html += `<td style="${tdStyle} background:#f8fafc; color:#94a3b8;">-</td>`; return; }
        let w = warnaROAS(m.roas);
        html += `<td style="${tdStyle} background:${w.warna}; color:${w.teks}; font-weight:700;">${m.roas.toFixed(1)}x</td>`;
    });
    html += '</tr>';

    html += '</tbody></table>';

    html += `<div style="padding:10px 14px; font-size:11px; color:#64748b; background:#f8fafc; border-top:1px solid #e2e8f0;">
        Warna: <span style="background:#dcfce7; color:#166534; padding:1px 6px; border-radius:4px; font-weight:700;">Sehat</span>
        <span style="background:#fef9c3; color:#854d0e; padding:1px 6px; border-radius:4px; font-weight:700; margin-left:6px;">Perhatian</span>
        <span style="background:#fee2e2; color:#991b1b; padding:1px 6px; border-radius:4px; font-weight:700; margin-left:6px;">Off-Track</span>
        &nbsp;&nbsp;·&nbsp;&nbsp; Section 🔮 di atas adalah sinyal awal (masih bisa diintervensi), section 📊 di bawah adalah hasil akhir (sudah terjadi)
    </div>`;

    container.innerHTML = html;
}


// ==============================================================
// LEADING INDICATOR: CREATIVE BARU DITEST PER MINGGU
// ==============================================================
function hitungCreativeBaruPerMinggu(dataContentSemua) {
    let firstAppearance = {};
    (dataContentSemua || []).forEach(row => {
        let nama = row.ad_name || '(tanpa nama)';
        let tgl = formati(row.tanggal);
        if (!tgl) return;
        if (!firstAppearance[nama] || tgl < firstAppearance[nama]) {
            firstAppearance[nama] = tgl;
        }
    });

    let perMinggu = {};
    Object.values(firstAppearance).forEach(tglPertama => {
        let mgg = formatMinggu(tglPertama);
        if (!mgg) return;
        perMinggu[mgg] = (perMinggu[mgg] || 0) + 1;
    });
    return perMinggu;
}


// ==============================================================
// BANNER ALERT TARGET MINGGUAN
// ==============================================================
function renderBannerTargetMingguan(mktDataMingguan, sMinggu, creativeBaruPerMinggu, target, sumberTarget) {
    let container = document.getElementById('bannerTargetMingguan');
    if (!container) return;

    if (!sMinggu || sMinggu.length === 0) {
        container.innerHTML = '';
        return;
    }

    let hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    let mingguSelesai = null;
    for (let i = sMinggu.length - 1; i >= 0; i--) {
        let senin = new Date(sMinggu[i] + 'T00:00:00');
        let minggu = new Date(senin);
        minggu.setDate(senin.getDate() + 6);
        if (minggu < hariIni) { mingguSelesai = sMinggu[i]; break; }
    }

    if (!mingguSelesai) {
        container.innerHTML = '<div style="padding:12px 16px; background:#f8fafc; border-radius:8px; color:#94a3b8; font-size:12.5px; margin-bottom:16px;">Belum ada minggu penuh yang selesai untuk dievaluasi terhadap target.</div>';
        return;
    }

    let v = mktDataMingguan[mingguSelesai];
    let closing = v.dp;
    let omzet = v.omzet;
    let roas = v.spend > 0 ? v.omzet / v.spend : 0;
    let creativeBaru = creativeBaruPerMinggu[mingguSelesai] || 0;
    let labelMgg = labelMinggu(mingguSelesai);

    function kartuTarget(judul, aktual, targetNilai, formatFn, arah) {
        arah = arah || 'min';
        let tercapai = arah === 'min' ? (aktual >= targetNilai) : (aktual <= targetNilai);
        let warnaBg = tercapai ? '#f0fdf4' : '#fef2f2';
        let warnaBorder = tercapai ? '#22c55e' : '#ef4444';
        let warnaTeks = tercapai ? '#166534' : '#991b1b';
        let statusText = tercapai ? '✅ TERCAPAI' : '🚨 BELUM TERCAPAI';
        let gap = arah === 'min' ? (targetNilai - aktual) : (aktual - targetNilai);
        let labelTarget = arah === 'min' ? 'Target min: ' : 'Batas maks: ';
        return `
        <div style="flex:1; min-width:170px; padding:14px; border-radius:10px; border:2px solid ${warnaBorder}; background:${warnaBg};">
            <div style="font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:4px;">${judul}</div>
            <div style="font-size:20px; font-weight:900; color:${warnaTeks};">${formatFn(aktual)}</div>
            <div style="font-size:11px; color:${warnaTeks}; font-weight:700; margin-top:4px;">${statusText}</div>
            <div style="font-size:10.5px; color:#64748b; margin-top:2px;">${labelTarget}${formatFn(targetNilai)}${!tercapai ? ' · Selisih ' + formatFn(gap) : ''}</div>
        </div>`;
    }

    let adaYangBelumTercapai = closing < target.closingMin || omzet < target.omzetMin || roas < target.roasMin || creativeBaru < target.creativeBaruMin;

    let html = `<div style="border-radius:12px; padding:16px; margin-bottom:20px; background:${adaYangBelumTercapai ? 'linear-gradient(135deg,#fef2f2,#fff)' : 'linear-gradient(135deg,#f0fdf4,#fff)'}; border:2px solid ${adaYangBelumTercapai ? '#ef4444' : '#22c55e'};">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
            <div style="font-size:14px; font-weight:800; color:#1e293b;">
                ${adaYangBelumTercapai ? '🚨 PERHATIAN — ADA TARGET BELUM TERCAPAI' : '✅ SEMUA TARGET TERCAPAI'} · Evaluasi Minggu Lalu (${labelMgg})
            </div>
            <span style="font-size:10.5px; font-weight:700; padding:2px 10px; border-radius:12px; background:#e0e7ff; color:#4338ca;">${sumberTarget || 'Global'}</span>
        </div>
        <div style="font-size:11.5px; color:#64748b; margin-bottom:12px;">
            Berdasarkan minggu penuh terakhir yang sudah selesai (bukan minggu berjalan, karena datanya belum lengkap). Creative Baru dihitung dari semua akun.
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
            ${kartuTarget('Closing', closing, target.closingMin, v => v + ' trx')}
            ${kartuTarget('Omzet', omzet, target.omzetMin, v => 'Rp ' + rp(v))}
            ${kartuTarget('ROAS', roas, target.roasMin, v => v.toFixed(1) + 'x')}
            ${kartuTarget('Creative Baru Ditest', creativeBaru, target.creativeBaruMin, v => v + 'x')}
        </div>
    </div>`;

    container.innerHTML = html;
}


// ==============================================================
// MODAL PENGATURAN TARGET MINGGUAN (Global + per Produk)
// ==============================================================
function tmBukaPengaturan() {
    let g = (dataTargetMingguanMarketing && dataTargetMingguanMarketing.global) || TARGET_DEFAULT_FALLBACK;
    document.getElementById('tmGlobalClosing').value = g.closingMin;
    document.getElementById('tmGlobalOmzet').value = g.omzetMin;
    document.getElementById('tmGlobalRoas').value = g.roasMin;
    document.getElementById('tmGlobalCreative').value = g.creativeBaruMin;

    let daftarMinat = (STUDIO_CONFIG && STUDIO_CONFIG.minat) || [];
    let perProduk = (dataTargetMingguanMarketing && dataTargetMingguanMarketing.perProduk) || {};

    let container = document.getElementById('tmPerProdukContainer');
    container.innerHTML = daftarMinat.map(minat => {
        let existing = perProduk[minat] || { closingMin: '', omzetMin: '', roasMin: '', creativeBaruMin: '' };
        let idAman = minat.replace(/[^a-zA-Z0-9]/g, '_');
        return `
        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:12px;">
            <div style="font-size:12.5px; font-weight:700; color:#1e293b; margin-bottom:8px;">${minat}</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:8px;">
                <input type="number" id="tmProduk_${idAman}_closing" placeholder="Closing Min" value="${existing.closingMin}" style="padding:7px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
                <input type="number" id="tmProduk_${idAman}_omzet" placeholder="Omzet Min (Rp)" value="${existing.omzetMin}" style="padding:7px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
                <input type="number" step="0.1" id="tmProduk_${idAman}_roas" placeholder="ROAS Min (x)" value="${existing.roasMin}" style="padding:7px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
                <input type="number" id="tmProduk_${idAman}_creative" placeholder="Creative Baru Min" value="${existing.creativeBaruMin}" style="padding:7px; border-radius:6px; border:1px solid #cbd5e1; font-size:12.5px;">
            </div>
        </div>`;
    }).join('');

    document.getElementById('tmModalSet').style.display = 'flex';
}

function tmTutupPengaturan() {
    document.getElementById('tmModalSet').style.display = 'none';
}

function tmSimpanPengaturan() {
    let btn = document.getElementById('tmBtnSimpan');
    btn.disabled = true;
    btn.innerText = 'Menyimpan...';

    let daftarTarget = [];

    daftarTarget.push({
        minat: '__GLOBAL__',
        closingMin: Number(document.getElementById('tmGlobalClosing').value) || 0,
        omzetMin: Number(document.getElementById('tmGlobalOmzet').value) || 0,
        roasMin: Number(document.getElementById('tmGlobalRoas').value) || 0,
        creativeBaruMin: Number(document.getElementById('tmGlobalCreative').value) || 0
    });

    let daftarMinat = (STUDIO_CONFIG && STUDIO_CONFIG.minat) || [];
    daftarMinat.forEach(minat => {
        let idAman = minat.replace(/[^a-zA-Z0-9]/g, '_');
        let closing = document.getElementById('tmProduk_' + idAman + '_closing').value;
        let omzet = document.getElementById('tmProduk_' + idAman + '_omzet').value;
        let roas = document.getElementById('tmProduk_' + idAman + '_roas').value;
        let creative = document.getElementById('tmProduk_' + idAman + '_creative').value;

        if (closing !== '' || omzet !== '' || roas !== '' || creative !== '') {
            daftarTarget.push({
                minat: minat,
                closingMin: Number(closing) || 0,
                omzetMin: Number(omzet) || 0,
                roasMin: Number(roas) || 0,
                creativeBaruMin: Number(creative) || 0
            });
        }
    });

    let fd = new FormData();
    fd.append('action', 'saveTargetMingguanMarketing');
    fd.append('dataJson', JSON.stringify(daftarTarget));

    fetch(scriptURL, { method: 'POST', body: fd })
        .then(r => r.json())
        .then(res => {
            btn.disabled = false;
            btn.innerText = '💾 Simpan Target';
            if (res.result === 'success') {
                let globalBaru = daftarTarget.find(t => t.minat === '__GLOBAL__');
                let perProdukBaru = {};
                daftarTarget.forEach(t => { if (t.minat !== '__GLOBAL__') perProdukBaru[t.minat] = t; });
                dataTargetMingguanMarketing = { global: globalBaru, perProduk: perProdukBaru };

                tmTutupPengaturan();
                if (typeof renderMarketingTab === 'function') renderMarketingTab();
                alert('Target mingguan berhasil disimpan.');
            } else {
                alert('Gagal menyimpan: ' + (res.message || 'Unknown error'));
            }
        })
        .catch(err => {
            btn.disabled = false;
            btn.innerText = '💾 Simpan Target';
            alert('Gagal menyimpan: ' + err.toString());
        });
}
