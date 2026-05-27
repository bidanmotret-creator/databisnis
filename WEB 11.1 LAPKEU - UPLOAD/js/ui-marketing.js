// // ======================= LOGIKA TAB 4: MARKETING (DENGAN CPL, OMZET & GRAFIK) =======================

function renderMarketingTab() {
    let fCamp = document.getElementById('filterMktCampaign').value;
    let fStart = document.getElementById('fMktStart').value;
    let fEnd = document.getElementById('fMktEnd').value;
    
    let mktDataDaily = {}, mktDataSummary = {}; 
    let tot = { spend:0, leads: new Set(), dp:0, omzet:0, days:0, count:0 };

    // 1. FILTER & PROSES DATA KLIEN
    let fd = dataGlobal;
    if(fCamp) fd = fd.filter(r => r.minat === fCamp);
    if(fStart) fd = fd.filter(r => getTime(r.tanggal_chat) >= getTime(fStart));
    if(fEnd) fd = fd.filter(r => getTime(r.tanggal_chat) <= getTime(fEnd));

    fd.forEach(r => {
        let t = formati(r.tanggal_chat);
        let c = r.minat || "Lainnya";
        let kD = t + '|' + c, kS = c;

        if(!mktDataDaily[kD]) mktDataDaily[kD] = { date:t, camp:c, spend:0, leads: new Set(), dp:0, omzet:0, days:0 };
        if(!mktDataSummary[kS]) mktDataSummary[kS] = { camp:c, spend:0, leads: new Set(), dp:0, omzet:0, days:0 };
        
        let wa = r.no_hp; 
        if (!wa && !r.nama && !r.status) return;

        mktDataDaily[kD].leads.add(wa); 
        mktDataSummary[kS].leads.add(wa);
        tot.leads.add(wa); 

        if(r.status && (r.status.includes('DP') || r.status.includes('Lunas'))) {
            mktDataDaily[kD].dp++; 
            mktDataSummary[kS].dp++;
            tot.dp++;

            let total = Number(r.total) || 0;
            mktDataDaily[kD].omzet += total; 
            mktDataSummary[kS].omzet += total;
            tot.omzet += total; 
            
            if(r.tgl_bayar1) {
                let d = daysDiff(r.tanggal_chat, r.tgl_bayar1);
                mktDataDaily[kD].days += d; 
                mktDataSummary[kS].days += d;
                tot.days += d; 
                tot.count++;
            }
        }
    });

    // 2. FILTER & PROSES DATA AD SPEND
    let fAds = dataMarketing;
    if(fCamp) fAds = fAds.filter(m => m.campaign === fCamp);
    if(fStart) fAds = fAds.filter(m => getTime(m.tanggal) >= getTime(fStart));
    if(fEnd) fAds = fAds.filter(m => getTime(m.tanggal) <= getTime(fEnd));

    fAds.forEach(m => {
        let t = formati(m.tanggal);
        let c = m.campaign || "Lainnya";
        let kD = t + '|' + c, kS = c;
        
        if(!mktDataDaily[kD]) mktDataDaily[kD] = { date:t, camp:c, spend:0, leads: new Set(), dp:0, omzet:0, days:0 };
        if(!mktDataSummary[kS]) mktDataSummary[kS] = { camp:c, spend:0, leads: new Set(), dp:0, omzet:0, days:0 };
        
        let s = Number(m.spend) || 0;
        mktDataDaily[kD].spend += s; 
        mktDataSummary[kS].spend += s;
        tot.spend += s;
    });

    // 3. RUMUS KPI GLOBAL & CPL
    let totalLeadsUnik = tot.leads.size;
    let globalCPL = totalLeadsUnik > 0 ? Math.round(tot.spend / totalLeadsUnik) : 0;
    let globalCAC = tot.dp > 0 ? Math.round(tot.spend / tot.dp) : 0;
    let globalCR = totalLeadsUnik > 0 ? ((tot.dp / totalLeadsUnik) * 100).toFixed(1) : 0;
    let globalROAS = tot.spend > 0 ? (tot.omzet / tot.spend).toFixed(1) : 0;
    let globalTime = tot.count > 0 ? (tot.days / tot.count).toFixed(1) : 0;

    // 4. RENDER TABEL SUMMARY
    let htmlS = '', sS = Object.keys(mktDataSummary).sort((a,b)=>mktDataSummary[b].omzet - mktDataSummary[a].omzet);
    sS.forEach(k => {
        let v = mktDataSummary[k];
        let jmlLeads = v.leads.size;
        let cpl = jmlLeads > 0 ? Math.round(v.spend / jmlLeads) : 0;
        let cac = v.dp > 0 ? Math.round(v.spend / v.dp) : 0;
        let cr = jmlLeads > 0 ? (v.dp/jmlLeads*100).toFixed(1) : 0;
        let roas = v.spend > 0 ? (v.omzet/v.spend).toFixed(1) : 0;
        let avgTime = v.dp > 0 ? (v.days/v.dp).toFixed(1) : 0;

        htmlS += `<tr>
            <td><strong>${v.camp}</strong></td>
            <td>Rp ${rp(v.spend)}</td>
            <td>${jmlLeads}</td>
            <td style="color:#2563eb; font-weight:bold;">Rp ${rp(cpl)}</td>
            <td><strong style="color:#d97706">${v.dp}</strong></td>
            <td>${cr}%</td>
            <td style="color:#2563eb; font-weight:bold;">Rp ${rp(cac)}</td>
            <td style="color:#10b981; font-weight:bold;">Rp ${rp(v.omzet)}</td>
            <td style="color:#059669; font-weight:bold;">${roas}x</td>
            <td>${avgTime}</td>
        </tr>`;
    });
    htmlS += `<tr style="font-weight:bold; background:#e2e8f0;"><td>TOTAL GLOBAL</td><td>Rp ${rp(tot.spend)}</td><td>${totalLeadsUnik}</td><td style="color:#8b5cf6;">Rp ${rp(globalCPL)}</td><td>${tot.dp}</td><td>${globalCR}%</td><td style="color:#1fcc00;">Rp ${rp(globalCAC)}</td><td style="color:#10b981;">Rp ${rp(tot.omzet)}</td><td style="color:#059669;">${globalROAS}x</td><td>${globalTime}</td></tr>`;
    document.getElementById('bMarketingSummary').innerHTML = htmlS;

    // 5. RENDER TABEL HARIAN & PERSIAPAN DATA GRAFIK
    let htmlD = '', sD = Object.keys(mktDataDaily).sort().reverse(); 
    
    // Array untuk grafik (Harus urut tanggal lama -> baru)
    let cDates = [], cSpend = [], cOmzet = [], cLeads = [], cDp = [];
    let sDChart = Object.keys(mktDataDaily).sort(); 

    sDChart.forEach(k => {
        let v = mktDataDaily[k];
        cDates.push(v.date);
        cSpend.push(v.spend);
        cOmzet.push(v.omzet);
        cLeads.push(v.leads.size);
        cDp.push(v.dp);
    });

    sD.forEach(k => {
        let v = mktDataDaily[k];
        let jmlLeads = v.leads.size;
        let cpl = jmlLeads > 0 ? Math.round(v.spend / jmlLeads) : 0;
        let cac = v.dp > 0 ? Math.round(v.spend / v.dp) : 0;
        let cr = jmlLeads > 0 ? (v.dp/jmlLeads*100).toFixed(1) : 0;
        let roas = v.spend > 0 ? (v.omzet/v.spend).toFixed(1) : 0;
        let avgTime = v.dp > 0 ? (v.days/v.dp).toFixed(1) : 0;

        htmlD += `<tr>
            <td>${v.date}</td>
            <td>${v.camp}</td>
            <td>Rp ${rp(v.spend)}</td>
            <td>${jmlLeads}</td>
            <td style="color:#8b5cf6; font-weight:bold;">Rp ${rp(cpl)}</td>
            <td><strong style="color:#d97706">${v.dp}</strong></td>
            <td>${cr}%</td>
            <td style="color:#1fcc00; font-weight:bold;">${v.dp>0?'Rp '+rp(cac):'-'}</td>
            <td style="color:#10b981; font-weight:bold;">Rp ${rp(v.omzet)}</td>
            <td style="color:#059669; font-weight:bold;">${roas}x</td>
            <td>${avgTime}</td>
        </tr>`;
    });
    htmlD += `<tr style="font-weight:bold; background:#e2e8f0;"><td>TOTAL GLOBAL</td><td>-</td><td>Rp ${rp(tot.spend)}</td><td>${totalLeadsUnik}</td><td style="color:#8b5cf6;">Rp ${rp(globalCPL)}</td><td>${tot.dp}</td><td>${globalCR}%</td><td style="color:#1fcc00;">Rp ${rp(globalCAC)}</td><td style="color:#10b981;">Rp ${rp(tot.omzet)}</td><td style="color:#059669;">${globalROAS}x</td><td>${globalTime}</td></tr>`;
    document.getElementById('bMarketing').innerHTML = htmlD;

    // 6. SUNTIK DATA KE KOTAK KPI
    document.getElementById('kpiSpend').innerText = `Rp ${rp(tot.spend)}`;
    document.getElementById('kpiLeads').innerText = `${totalLeadsUnik} Klien`;
    let elKpiCpl = document.getElementById('kpiCPL'); if(elKpiCpl) elKpiCpl.innerText = `Rp ${rp(globalCPL)}`;
    document.getElementById('kpiCAC').innerText = `Rp ${rp(globalCAC)}`;
    document.getElementById('kpiClosing').innerText = `${tot.dp} Transaksi`;
    document.getElementById('kpiCR').innerText = `${globalCR}%`;
    document.getElementById('kpiTime').innerText = `${globalTime} Hari`;
    document.getElementById('kpiROAS').innerText = `${globalROAS}x`;

    // 7. LOGIKA GRAFIK CORONG FUNNEL DETAIL
    let wTofu = 100; 
    let wMofu = totalLeadsUnik > 0 ? (tot.dp / totalLeadsUnik) * 100 : 0; 
    let wBofu = wMofu * 0.75; 
    
    wMofu = Math.max(wMofu, 5); wBofu = Math.max(wBofu, 5);
    wMofu = Math.min(wMofu, 100); wBofu = Math.min(wBofu, 100);

    let fnlTofu = document.getElementById('fnlTofuBar');
    let fnlMofu = document.getElementById('fnlMofuBar');
    let fnlBofu = document.getElementById('fnlBofuBar');
    
    if (fnlTofu && fnlMofu && fnlBofu) {
        fnlTofu.style.width = wTofu + '%';
        fnlTofu.innerHTML = `<span style="font-size:15px; font-weight:900;">${totalLeadsUnik} Leads Unik</span><span style="font-size:11px; opacity:0.9;">CPL: Rp ${rp(globalCPL)}</span>`;
        
        fnlMofu.style.width = wMofu + '%';
        fnlMofu.innerHTML = `<span style="font-size:15px; font-weight:900;">${tot.dp} Closing (${globalCR}%)</span><span style="font-size:11px; opacity:0.9;">CAC: Rp ${rp(globalCAC)}</span>`;
        
        fnlBofu.style.width = wBofu + '%';
        fnlBofu.innerHTML = `<span style="font-size:15px; font-weight:900;">Omzet Rp ${rp(tot.omzet)}</span><span style="font-size:11px; opacity:0.9;">ROAS: ${globalROAS}x</span>`;
    }

    // 8. RENDER GRAFIK HARIAN (DUAL-AXIS)
    if(window.myMktHarianChart) window.myMktHarianChart.destroy();
    let ctxMkt = document.getElementById('chartMarketingHarian').getContext('2d');
    window.myMktHarianChart = new Chart(ctxMkt, {
        type: 'bar',
        data: {
            labels: cDates,
            datasets: [
                {
                    label: 'Omzet Penjualan (Rp)',
                    type: 'line',
                    data: cOmzet,
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    yAxisID: 'yRupiah',
                    tension: 0.3
                },
                {
                    label: 'Ad Spend (Rp)',
                    type: 'line',
                    data: cSpend,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    borderWidth: 2,
                    yAxisID: 'yRupiah',
                    tension: 0.3
                },
                {
                    label: 'Leads Masuk',
                    type: 'bar',
                    data: cLeads,
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    yAxisID: 'yQty'
                },
                {
                    label: 'Closing (DP+)',
                    type: 'bar',
                    data: cDp,
                    backgroundColor: 'rgba(245, 158, 11, 0.8)',
                    yAxisID: 'yQty'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { stacked: false },
                yRupiah: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Nilai Rupiah (Rp)' }
                },
                yQty: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Jumlah Orang' },
                    grid: { drawOnChartArea: false } // Agar garis background tidak bentrok
                }
            }
        }
    });
}
