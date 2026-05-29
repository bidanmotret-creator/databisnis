// ========================================================
// 1. FUNGSI MENARIK DATA KE FORM UPDATE
// ========================================================
function loadLeadKeForm() {
    const compositeValue = document.getElementById('pilihLead').value; 
    const form = document.getElementById('formCustomer');
    if(!compositeValue) { form.style.display = 'none'; return; }
    
    const parts = compositeValue.split('|');
    // SABUK PENGAMAN: Gunakan String() agar tidak error jika r.no_hp kosong
    const k = dataGlobal.find(r => String(r.no_hp) === parts[0] && formati(r.tanggal_chat) === parts[1] && r.minat === parts[2]);
    
    if(k) {
        document.getElementById('cust_no_hp').value = k.no_hp || ""; 
        document.getElementById('cust_tanggal_chat').value = formati(k.tanggal_chat); 
        document.getElementById('cust_nama').value = k.nama || ""; 
        document.getElementById('cust_sumber').value = k.sumber || ""; 
        document.getElementById('cust_alamat').value = k.alamat || ""; 
        document.getElementById('cust_data_anak').value = formati(k.data_anak); 
        document.getElementById('cust_gender_anak').value = k.gender_anak || ""; 
        document.getElementById('cust_status').value = k.status || "Follow-up / Pending";
        document.getElementById('cust_minat').value = k.minat || ""; 
        renderPaketLayanan(); 
        
        if(k.paket && k.paket !== "-") document.getElementById('cust_paket').value = k.paket; 
        renderVarianLayanan();
        
        if(k.varian && k.varian !== "-") document.getElementById('cust_varian').value = k.varian;
        if(k.promo && k.promo !== "-") { 
            document.querySelectorAll('.promo-cb').forEach(cb => cb.checked = k.promo.split(', ').includes(cb.value)); 
        }
        
        document.getElementById('cust_lokasi').value = k.lokasi !== "-" ? k.lokasi : (STUDIO_CONFIG.lokasi ? STUDIO_CONFIG.lokasi[0] : ""); 
        document.getElementById('cust_jadwal').value = formati(k.jadwal);
        document.getElementById('input_total').value = k.total || 0; 
        document.getElementById('input_hpp').value = k.hpp || 0; 
        document.getElementById('input_transport').value = k.transport || 0; 
        document.getElementById('cust_tgl_bayar1').value = formati(k.tgl_bayar1); 
        document.getElementById('input_bayar1').value = k.jml_bayar1 || 0; 
        document.getElementById('cust_tgl_bayar2').value = formati(k.tgl_bayar2); 
        document.getElementById('input_bayar2').value = k.jml_bayar2 || 0;
        
        hitungFinansial(); 
        form.style.display = 'block';

        // ========================================================
        // 🚨 PENGAMAN: RESET SAKLAR JURNAL OTOMATIS
        // ========================================================
        const autoJurnalCb = document.getElementById('auto_jurnal_cb');
        const panelJurnal = document.getElementById('panel_auto_jurnal');
        
        if (autoJurnalCb && panelJurnal) {
            autoJurnalCb.checked = false;          // Paksa OFF saat form dimuat
            panelJurnal.style.display = 'none';    // Sembunyikan inputan akun
            
            // Kosongkan agar tidak ada data akun yang tertinggal/salah kirim
            let inputKas = document.getElementById('auto_akun_kas');
            let inputPend = document.getElementById('auto_akun_pendapatan');
            if(inputKas) inputKas.value = '';
            if(inputPend) inputPend.value = '';
        }
        // ========================================================
    }
}

// ========================================================
// 2. FUNGSI EDIT DARI TABEL MASTER (DASHBOARD)
// ========================================================
window.editDariTabel = function(key) {
    let searchInput = document.getElementById('searchLeadTxt');
    if (searchInput) searchInput.value = '';

    let selectElement = document.getElementById('pilihLead');
    selectElement.innerHTML = '<option value="">-- Pilih Nama Klien / No HP --</option>';
    
    dataGlobal.forEach(row => {
        // SABUK PENGAMAN: (row.status || "") mencegah error saat status kosong
        let statusVal = row.status || "";
        let iconStatus = statusVal.includes('Lunas') ? '🟢' : (statusVal.includes('DP') ? '🟡' : '🔴');
        
        let compositeKey = row.no_hp + '|' + formati(row.tanggal_chat) + '|' + row.minat;
        selectElement.appendChild(new Option(`${iconStatus} ${row.nama} (${row.no_hp}) [Chat: ${formatd(row.tanggal_chat)}] - ${row.minat}`, compositeKey));
    });

    selectElement.value = key;
    loadLeadKeForm();
    
    let tabBtns = document.querySelectorAll('.tab-btn');
    if(tabBtns.length > 1) bukaTab('tabUpdateCustomer', tabBtns[1]);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ========================================================
// 3. FUNGSI PENCARIAN & FILTER DROPDOWN (Penyelesaian Error)
// ========================================================
// ========================================================
// 3. FUNGSI PENCARIAN & FILTER DROPDOWN (TAHAN BANTING)
// ========================================================
window.filterLeadSelect = function() {
    let searchInput = document.getElementById('searchLeadTxt');
    let input = searchInput ? searchInput.value.toLowerCase() : "";
    let selectElement = document.getElementById('pilihLead');
    
    if (!selectElement) return; // Hentikan jika elemen tidak ditemukan di HTML
    
    selectElement.innerHTML = '<option value="">-- Pilih Nama Klien / No HP --</option>';
    
    if (!dataGlobal || dataGlobal.length === 0) return;

    // Saring data berdasarkan ketikan
    let filteredData = dataGlobal.filter(row => {
        let nama = (String(row.nama || "")).toLowerCase();
        let noHp = (String(row.no_hp || "")).toLowerCase();
        return nama.includes(input) || noHp.includes(input);
    });

    // Masukkan ke dropdown satu per satu DENGAN PENGAMAN
    filteredData.forEach(row => {
        try {
            let statusVal = String(row.status || "");
            let iconStatus = statusVal.includes('Lunas') ? '🟢' : (statusVal.includes('DP') ? '🟡' : '🔴');
            
            let rawTgl = row.tanggal_chat || "";
            let tglChat = typeof formati === "function" ? formati(rawTgl) : rawTgl;
            let tglDisplay = typeof formatd === "function" ? formatd(rawTgl) : rawTgl;
            
            // Render nama dengan rapi meskipun ada data yang kosong
            let namaTampil = row.nama ? row.nama : "Tanpa Nama";
            let hpTampil = row.no_hp ? row.no_hp : "-";
            let minatTampil = row.minat ? row.minat : "-";
            
            let compositeKey = (row.no_hp || "") + '|' + tglChat + '|' + (row.minat || "");
            selectElement.appendChild(new Option(`${iconStatus} ${namaTampil} (${hpTampil}) [Chat: ${tglDisplay}] - ${minatTampil}`, compositeKey));
            
        } catch (err) {
            // Jika ada 1 baris klien yang datanya error/cacat, lewati saja diam-diam 
            // agar klien di baris berikutnya tetap bisa tampil di dropdown!
            console.warn("Sistem melewati 1 data klien karena format cacat:", row);
        }
    });
};

function terapkanFilterMaster() {
    let fd = dataGlobal || [];

    const fName = document.getElementById('fSearchNama')?.value.toLowerCase() || "";
    const fKat = document.getElementById('filterKategori')?.value || "";
    const fStat = document.getElementById('filterStatus')?.value || ""; 
    const fChatS = document.getElementById('fChatStart')?.value || "";
    const fChatE = document.getElementById('fChatEnd')?.value || "";
    const fDpS = document.getElementById('fDpStart')?.value || "";
    const fDpE = document.getElementById('fDpEnd')?.value || "";
    const fLnS = document.getElementById('fLnStart')?.value || "";
    const fLnE = document.getElementById('fLnEnd')?.value || "";

    if(fName) fd = fd.filter(r => (r.nama && r.nama.toLowerCase().includes(fName)) || (r.no_hp && r.no_hp.toString().includes(fName)));
    if(fKat) fd = fd.filter(r => r.minat === fKat);
    
    // Filter Status
    if(fStat) {
        fd = fd.filter(r => {
            let status = String(r.status || "").toLowerCase();
            if (fStat === "dp") return status.includes("dp");
            if (fStat === "lunas") return status.includes("lunas");
            if (fStat === "pending") return !status.includes("dp") && !status.includes("lunas");
            return true;
        });
    }

    if(fChatS) fd = fd.filter(r => getTime(r.tanggal_chat) >= getTime(fChatS));
    if(fChatE) fd = fd.filter(r => getTime(r.tanggal_chat) <= getTime(fChatE));
    if(fDpS) fd = fd.filter(r => getTime(r.tgl_bayar1) >= getTime(fDpS));
    if(fDpE) fd = fd.filter(r => getTime(r.tgl_bayar1) <= getTime(fDpE));
    if(fLnS) fd = fd.filter(r => getTime(r.tgl_bayar2) >= getTime(fLnS));
    if(fLnE) fd = fd.filter(r => getTime(r.tgl_bayar2) <= getTime(fLnE));

    document.getElementById('txtCount').innerText = `Menampilkan: ${fd.length} Baris Data`;

    let uUnik = new Set(), omzet=0, penerimaan=0, totDP=0, totLunas=0, piutang=0;
    let dailyFinance = {}; 
    let prodMap = {}; 

    fd.forEach(r => {
        uUnik.add(r.no_hp);
        let tot = Number(r.total)||0, dp = Number(r.jml_bayar1)||0, ln = Number(r.jml_bayar2)||0, sisa = Number(r.sisa_hutang)||0;
        omzet += tot; penerimaan += (dp+ln); totDP += dp; totLunas += ln; piutang += sisa;
        
        let pKey = (r.minat || 'Lainnya') + '|' + (r.paket && r.paket !== "-" ? r.paket : 'Tanpa Paket');
        if(!prodMap[pKey]) prodMap[pKey] = {minat: r.minat||'Lainnya', paket: (r.paket && r.paket !== "-" ? r.paket : 'Tanpa Paket'), trx: 0, omzet: 0};
        prodMap[pKey].trx++;
        prodMap[pKey].omzet += tot;

        if(r.tgl_bayar1 && r.tgl_bayar1.length > 5) {
            let d1 = formati(r.tgl_bayar1);
            if(!dailyFinance[d1]) dailyFinance[d1] = {trx:0, omz:0, dp:0, ln:0};
            dailyFinance[d1].trx++; dailyFinance[d1].omz += tot; dailyFinance[d1].dp += dp;
        }
        if(r.tgl_bayar2 && r.tgl_bayar2.length > 5) {
            let d2 = formati(r.tgl_bayar2);
            if(!dailyFinance[d2]) dailyFinance[d2] = {trx:0, omz:0, dp:0, ln:0};
            dailyFinance[d2].ln += ln; 
        }
    });
    
    document.getElementById('vUnik').innerText = uUnik.size; document.getElementById('vTransaksi').innerText = fd.length;
    document.getElementById('vPenjualanBaru').innerText = rp(omzet); document.getElementById('vDP').innerText = rp(totDP); 
    document.getElementById('vLunas').innerText = rp(totLunas); document.getElementById('vPiutang').innerText = rp(piutang); 

    // Render Produk
    let prodArr = Object.values(prodMap).sort((a,b) => b.omzet - a.omzet);
    let htmlProd = '';
    let sumProdTrx = 0, sumProdOmzet = 0;
    prodArr.forEach(p => {
        sumProdTrx += p.trx; sumProdOmzet += p.omzet;
        htmlProd += `<tr><td>${p.minat}</td><td><strong>${p.paket}</strong></td><td>${p.trx}</td><td>Rp ${rp(p.omzet)}</td><td style="color:#64748b;">Rp ${rp(p.trx > 0 ? p.omzet/p.trx : 0)}</td></tr>`;
    });
    if(sumProdTrx > 0) htmlProd += `<tr class="total-row"><td colspan="2">TOTAL</td><td>${sumProdTrx}</td><td>Rp ${rp(sumProdOmzet)}</td><td>-</td></tr>`;
    document.getElementById('bProduk').innerHTML = htmlProd || '<tr><td colspan="5">Data kosong.</td></tr>';

    // Render Keuangan & Chart
    let sortedFinDates = Object.keys(dailyFinance).sort().reverse(); 
    let htmlFin = '', c_dates = [], c_vals = [];
    let t_fin_trx=0, t_fin_omz=0, t_fin_dp=0, t_fin_ln=0;

    sortedFinDates.forEach(d => {
        let v = dailyFinance[d];
        t_fin_trx += v.trx; t_fin_omz += v.omz; t_fin_dp += v.dp; t_fin_ln += v.ln;
        htmlFin += `<tr><td>${d}</td><td>${v.trx}</td><td>Rp ${rp(v.omz)}</td><td>Rp ${rp(v.dp)}</td><td>Rp ${rp(v.ln)}</td><td><strong style="color:var(--success);">Rp ${rp(v.dp+v.ln)}</strong></td></tr>`;
        c_dates.unshift(d); c_vals.unshift(v.dp+v.ln); 
    });

    if(t_fin_trx > 0) {
        htmlFin += `<tr class="total-row"><td>TOTAL KESELURUHAN</td><td>${t_fin_trx}</td><td>Rp ${rp(t_fin_omz)}</td><td>Rp ${rp(t_fin_dp)}</td><td>Rp ${rp(t_fin_ln)}</td><td style="color:#fbbf24;">Rp ${rp(t_fin_dp+t_fin_ln)}</td></tr>`;
    }
    document.getElementById('bKeuanganHarian').innerHTML = htmlFin || '<tr><td colspan="6">Data kosong.</td></tr>';

    // --- CHART SAFETY CHECK ---
    if (typeof Chart !== 'undefined') {
        if(myFinanceChart) myFinanceChart.destroy();
        const ctx = document.getElementById('financeChart');
        if(ctx) {
            myFinanceChart = new Chart(ctx, {
                type: 'line', 
                data: { labels: c_dates, datasets: [{ label: 'Cash Masuk (Rp)', data: c_vals, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.2 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        }
    }

    // Render Tabel Utama
    let tb = document.getElementById('tabelBody'); 
    let htmlHTMLRows = [];
    let waScript = (typeof STUDIO_CONFIG !== 'undefined' && STUDIO_CONFIG.waTemplate) ? STUDIO_CONFIG.waTemplate : "Halo Ibu [NAMA], konfirmasi sesi [MINAT]";

    fd.forEach((r, i) => {
        if(i > 500) return; 

        // Sesi
        let hariLagi = "-", badgeHari = "bg-gray";
        if (r.jadwal) {
            let tglSesi = new Date(r.jadwal);
            let sekarang = new Date();
            let selisih = Math.ceil((tglSesi - sekarang) / (1000 * 60 * 60 * 24));
            if (selisih < 0) { hariLagi = "LEWAT " + Math.abs(selisih) + " HR"; badgeHari = "bg-red-alert"; }
            else if (selisih <= 3) { hariLagi = selisih + " HR LAGI"; badgeHari = "bg-red"; }
            else { hariLagi = selisih + " HR"; badgeHari = "bg-blue"; }
        }

        let statusTeksLower = String(r.status || "Pending").toLowerCase();
        let rowClass = statusTeksLower.includes('lunas') ? 'funnel-highlight-lunas' : (statusTeksLower.includes('dp') ? 'funnel-highlight-dp' : 'funnel-highlight-pending');
        let compositeKey = (r.no_hp || "") + '|' + formati(r.tanggal_chat) + '|' + (r.minat || "");
        let textWA = encodeURIComponent(waScript.replace(/\[NAMA\]/g, r.nama || "").replace(/\[MINAT\]/g, r.minat || ""));

        htmlHTMLRows.push(`<tr class="${rowClass}">
            <td><strong>BM-${r.tanggal_chat?r.tanggal_chat.replace(/-/g,"").substring(2,8):"000"}</strong></td>
            <td><strong>${r.nama || "-"}</strong><br><small>${r.no_hp || "-"}</small></td>
            <td>${r.minat || "-"}<br><small>${r.paket && r.paket !== "-" ? r.paket : "-"}</small></td>
            <td>
                <small>Chat: ${formatd(r.tanggal_chat)}</small><br>
                <small>DP: ${formatd(r.tgl_bayar1)}</small><br>
                <small>Anak: ${formatTanggalManusia(r.data_anak)}</small><br>
                <small>Lunas: ${formatd(r.tgl_bayar2)}</small>
            </td>
            <td>Rp ${rp(r.total)}<br><span class="badge ${statusTeksLower.includes('lunas')?'bg-green':'bg-yellow'}">${r.status || "Pending"}</span></td>
            <td><span class="badge ${badgeHari}">${hariLagi}</span></td>
            <td>
                <div style="display:flex; gap:4px; justify-content:center;">
                    <button onclick="editDariTabel('${compositeKey}')" class="btn-wa" style="background:#f59e0b;" title="Edit">✏️</button>
                    <a href="https://wa.me/${cleanHP(r.no_hp)}?text=${textWA}" target="_blank" class="btn-wa" style="background:var(--whatsapp);" title="WA">💬</a>
                </div>
            </td>
        </tr>`);
    });
    tb.innerHTML = htmlHTMLRows.join('');
    
    // Tambahan untuk Kohort & Lead
    if (typeof generateKohortTables === "function") generateKohortTables(fd);
    // --- SABUK PENGAMAN DROPDOWN ---
    let selectLead = document.getElementById('pilihLead');
    if(selectLead && selectLead.options.length <= 1) {
        selectLead.innerHTML = '<option value="">-- Pilih Nama Klien / No HP --</option>';
        dataGlobal.forEach(row => {
            try {
                // Pengaman 1: Cegah error jika status kosong
                let statusVal = String(row.status || "");
                let iconStatus = statusVal.includes('Lunas') ? '🟢' : (statusVal.includes('DP') ? '🟡' : '🔴');
                
                // Pengaman 2: Cegah error jika tanggal kosong
                let rawTgl = row.tanggal_chat || "";
                let tglChat = typeof formati === "function" ? formati(rawTgl) : rawTgl;
                let tglDisplay = typeof formatd === "function" ? formatd(rawTgl) : rawTgl;
                
                // Pengaman 3: Tampilan rapi untuk data yang bolong
                let namaTampil = row.nama ? row.nama : "Tanpa Nama";
                let hpTampil = row.no_hp ? row.no_hp : "-";
                let minatTampil = row.minat ? row.minat : "-";
                
                // Pengaman 4: Cegah compositeKey undefined
                let compositeKey = (row.no_hp || "") + '|' + tglChat + '|' + (row.minat || "");
                selectLead.appendChild(new Option(`${iconStatus} ${namaTampil} (${hpTampil}) [Chat: ${tglDisplay}] - ${minatTampil}`, compositeKey));
            } catch (err) {
                console.warn("Melewati 1 data klien karena format kurang lengkap.");
            }
        });
    }
}

        function generateKohortTables(data) {
            let grpSesi = {}, grpDP = {};
            data.forEach(r => {
                if(r.jadwal && r.jadwal.length > 5) {
                    let mSesi = r.jadwal.substring(0,7);
                    if(!grpSesi[mSesi]) grpSesi[mSesi] = []; grpSesi[mSesi].push(r);
                }
                if(r.tgl_bayar1 && r.tgl_bayar1.length > 5) {
                    let mDP = r.tgl_bayar1.substring(0,7);
                    if(!grpDP[mDP]) grpDP[mDP] = []; grpDP[mDP].push(r);
                }
            });

            const hl = (val, max) => (val === max && val > 0) ? `class="highlight-cell"` : ``;
            let bBooking = '', bClosing = '', bLeads = '';
            let insightData = { ideal: 0, std: 0, dng: 0, gercep: 0, nrm: 0, lma: 0, m0: 0, oldM: 0 };
            
            let tot_b_tb=0, tot_b_idl=0, tot_b_std=0, tot_b_dng=0;
            let tot_c_tc=0, tot_c_grc=0, tot_c_nrm=0, tot_c_lma=0;
            let tot_l_td=0, tot_l_m0=0, tot_l_m1=0, tot_l_m2=0, tot_l_m3=0;

            // Arrays for Charts
            let lblSesi = Object.keys(grpSesi).sort();
            let c_idl = [], c_std = [], c_dng = [];
            let c_grc = [], c_nrm = [], c_lma = [];
            
            let lblDP = Object.keys(grpDP).sort();
            let c_m0 = [], c_m1 = [], c_m2plus = [];

            // TABEL 1
            lblSesi.forEach(m => {
                let rows = grpSesi[m], tB = 0, idl=0, std=0, dng=0;
                rows.forEach(r => {
                    if(r.tgl_bayar1 && r.data_anak && r.data_anak.length > 5) {
                        tB++; let diff = daysDiff(r.tgl_bayar1, r.data_anak);
                        if(diff > 30) idl++; else if(diff >= 0 && diff <= 30) std++; else dng++;
                    }
                });
                c_idl.push(idl); c_std.push(std); c_dng.push(dng);
                tot_b_tb+=tB; tot_b_idl+=idl; tot_b_std+=std; tot_b_dng+=dng;
                insightData.ideal += idl; insightData.std += std; insightData.dng += dng;
                let max = Math.max(idl, std, dng);
                if(tB > 0) bBooking += `<tr><td>${m}</td><td>${tB}</td><td ${hl(idl,max)}>${idl}</td><td>${prc(idl,tB)}</td><td ${hl(std,max)}>${std}</td><td>${prc(std,tB)}</td><td ${hl(dng,max)}>${dng}</td><td>${prc(dng,tB)}</td></tr>`;
            });
            if(tot_b_tb > 0) bBooking += `<tr class="total-row"><td>TOTAL KESELURUHAN</td><td>${tot_b_tb}</td><td>${tot_b_idl}</td><td>${prc(tot_b_idl,tot_b_tb)}</td><td>${tot_b_std}</td><td>${prc(tot_b_std,tot_b_tb)}</td><td>${tot_b_dng}</td><td>${prc(tot_b_dng,tot_b_tb)}</td></tr>`;

            // TABEL 2
            lblSesi.forEach(m => {
                let rows = grpSesi[m], tC = 0, grc=0, nrm=0, lma=0;
                rows.forEach(r => {
                    if(r.tanggal_chat && r.tgl_bayar1) {
                        tC++; let diff = daysDiff(r.tanggal_chat, r.tgl_bayar1);
                        if(diff >= 0 && diff <= 3) grc++; else if(diff >= 4 && diff <= 30) nrm++; else if(diff > 30) lma++;
                    }
                });
                c_grc.push(grc); c_nrm.push(nrm); c_lma.push(lma);
                tot_c_tc+=tC; tot_c_grc+=grc; tot_c_nrm+=nrm; tot_c_lma+=lma;
                insightData.gercep += grc; insightData.nrm += nrm; insightData.lma += lma;
                let max = Math.max(grc, nrm, lma);
                if(tC > 0) bClosing += `<tr><td>${m}</td><td>${tC}</td><td ${hl(grc,max)}>${grc}</td><td>${prc(grc,tC)}</td><td ${hl(nrm,max)}>${nrm}</td><td>${prc(nrm,tC)}</td><td ${hl(lma,max)}>${lma}</td><td>${prc(lma,tC)}</td></tr>`;
            });
            if(tot_c_tc > 0) bClosing += `<tr class="total-row"><td>TOTAL KESELURUHAN</td><td>${tot_c_tc}</td><td>${tot_c_grc}</td><td>${prc(tot_c_grc,tot_c_tc)}</td><td>${tot_c_nrm}</td><td>${prc(tot_c_nrm,tot_c_tc)}</td><td>${tot_c_lma}</td><td>${prc(tot_c_lma,tot_c_tc)}</td></tr>`;

            // TABEL 3
            lblDP.forEach(m => {
                let rows = grpDP[m], tD = 0, m0=0, m1=0, m2=0, m3=0;
                rows.forEach(r => {
                    if(r.tanggal_chat && r.tgl_bayar1) {
                        tD++; let dM = monthDiff(r.tanggal_chat, r.tgl_bayar1);
                        if(dM === 0) m0++; else if(dM === 1) m1++; else if(dM === 2) m2++; else m3++;
                    }
                });
                c_m0.push(m0); c_m1.push(m1); c_m2plus.push(m2+m3);
                tot_l_td+=tD; tot_l_m0+=m0; tot_l_m1+=m1; tot_l_m2+=m2; tot_l_m3+=m3;
                insightData.m0 += m0; insightData.oldM += (m1+m2+m3);
                let max = Math.max(m0, m1, m2, m3);
                if(tD > 0) bLeads += `<tr><td>${m}</td><td>${tD}</td><td ${hl(m0,max)}>${m0}</td><td>${prc(m0,tD)}</td><td ${hl(m1,max)}>${m1}</td><td>${prc(m1,tD)}</td><td ${hl(m2,max)}>${m2}</td><td>${prc(m2,tD)}</td><td ${hl(m3,max)}>${m3}</td><td>${prc(m3,tD)}</td></tr>`;
            });
            if(tot_l_td > 0) bLeads += `<tr class="total-row"><td>TOTAL KESELURUHAN</td><td>${tot_l_td}</td><td>${tot_l_m0}</td><td>${prc(tot_l_m0,tot_l_td)}</td><td>${tot_l_m1}</td><td>${prc(tot_l_m1,tot_l_td)}</td><td>${tot_l_m2}</td><td>${prc(tot_l_m2,tot_l_td)}</td><td>${tot_l_m3}</td><td>${prc(tot_l_m3,tot_l_td)}</td></tr>`;

            document.getElementById('bBooking').innerHTML = bBooking || '<tr><td colspan="8">Belum ada data.</td></tr>';
            document.getElementById('bClosing').innerHTML = bClosing || '<tr><td colspan="8">Belum ada data.</td></tr>';
            document.getElementById('bLeads').innerHTML = bLeads || '<tr><td colspan="10">Belum ada data.</td></tr>';

            // RENDER BAR CHARTS (MENGGUNAKAN CHART.JS)
            if(chartB) chartB.destroy(); if(chartC) chartC.destroy(); if(chartL) chartL.destroy();
            
            chartB = new Chart(document.getElementById('chartBooking'), { type: 'bar', data: { labels: lblSesi, datasets: [ { label: 'Ideal', data: c_idl, backgroundColor: '#10b981' }, { label: 'Standard', data: c_std, backgroundColor: '#3b82f6' }, { label: 'Bahaya', data: c_dng, backgroundColor: '#ef4444' } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }});
            chartC = new Chart(document.getElementById('chartClosing'), { type: 'bar', data: { labels: lblSesi, datasets: [ { label: 'Gercep', data: c_grc, backgroundColor: '#10b981' }, { label: 'Normal', data: c_nrm, backgroundColor: '#f59e0b' }, { label: 'Lama', data: c_lma, backgroundColor: '#64748b' } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: false }, y: { stacked: false } } }});
            chartL = new Chart(document.getElementById('chartLeads'), { type: 'bar', data: { labels: lblDP, datasets: [ { label: 'DP Bulan Sama', data: c_m0, backgroundColor: '#4f46e5' }, { label: 'Chat 1 Bln Sblm', data: c_m1, backgroundColor: '#ec4899' }, { label: 'Chat 2+ Bln Sblm', data: c_m2plus, backgroundColor: '#64748b' } ] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }});

            generateAutoInsights(insightData);
        }

function generateAutoInsights(d) {
            let list = document.getElementById('insightList');
            let insights = [];
            if((d.std + d.dng) > d.ideal) insights.push("📌 <strong>Pola Pasar Dadakan:</strong> Sebagian besar klien mem-booking mendekati hari H atau setelah lahir. Gunakan copywriting mendesak seperti 'Slot Terbatas Minggu Ini'.");
            else insights.push("📌 <strong>Pola Pasar Terencana:</strong> Klien merencanakan jauh-jauh hari. Promo Early Bird akan sangat efektif di sini.");
            if(d.gercep > d.nrm) insights.push("📌 <strong>Pentingnya Fast Respon:</strong> Klien cenderung closing di 0-3 hari pertama chat. Berikan insentif khusus bagi CS/Admin yang mampu membalas dan closing di hari yang sama.");
            else insights.push("📌 <strong>Butuh Nurturing:</strong> Klien butuh waktu untuk berpikir (4-30 hari). Gunakan Template WA Follow-up di menu Pengaturan untuk menyelamatkan prospek ini.");
            if(d.m0 > d.oldM) insights.push("📌 <strong>Fokus Akuisisi Baru:</strong> Siklus penjualan bertumpu pada Leads bulan berjalan (M0). Terus pantau Metrik Marketing Harian (CPL/CAC) untuk memastikan ROI Ads Anda sehat.");
            
            if(insights.length === 0) insights.push("Menunggu akumulasi data untuk kesimpulan.");
            list.innerHTML = insights.map(i => `<li>${i}</li>`).join('');
        }

        document.getElementById('formSettings').addEventListener('submit', e => { e.preventDefault(); let btn = e.target.querySelector('button'); btn.disabled = true; btn.innerText = 'Menyimpan...'; try { STUDIO_CONFIG.sumber = document.getElementById('set_sumber').value.split('\n').filter(x => x.trim() !== ""); STUDIO_CONFIG.minat = document.getElementById('set_minat').value.split('\n').filter(x => x.trim() !== ""); STUDIO_CONFIG.lokasi = document.getElementById('set_lokasi').value.split('\n').filter(x => x.trim() !== ""); STUDIO_CONFIG.promo = document.getElementById('set_promo').value.split('\n').filter(x => x.trim() !== ""); STUDIO_CONFIG.waTemplate = document.getElementById('set_wa').value; STUDIO_CONFIG.paketMap = JSON.parse(document.getElementById('set_paketMap').value); STUDIO_CONFIG.varianMap = JSON.parse(document.getElementById('set_varianMap').value); let fd = new FormData(); fd.append('action', 'saveConfig'); fd.append('configJson', JSON.stringify(STUDIO_CONFIG)); fetch(scriptURL, { method: 'POST', body: fd }).then(() => { alert('Pengaturan Disimpan!'); btn.disabled = false; btn.innerText = '💾 Simpan Konfigurasi Server'; tarikDataServer(); }); } catch(err) { alert('Gagal! Periksa tanda baca JSON.'); btn.disabled = false; btn.innerText = '💾 Simpan Konfigurasi Server'; } });
        document.getElementById('formLead').addEventListener('submit', e => { e.preventDefault(); let btn = document.getElementById('btnSubmitLead'); btn.disabled = true; fetch(scriptURL, { method: 'POST', body: new FormData(e.target)}).then(() => { alert('Sukses!'); e.target.reset(); btn.disabled = false; tarikDataServer(); }); });
        document.getElementById('formCustomer').addEventListener('submit', e => { e.preventDefault(); let btn = document.getElementById('btnSubmitCustomer'); btn.disabled = true; let promoTerpilih = []; document.querySelectorAll('.promo-cb:checked').forEach(cb => promoTerpilih.push(cb.value)); document.getElementById('hidden_promo').value = promoTerpilih.length > 0 ? promoTerpilih.join(', ') : '-'; fetch(scriptURL, { method: 'POST', body: new FormData(e.target)}).then(() => { alert('Sukses!'); e.target.reset(); document.getElementById('formCustomer').style.display = 'none'; btn.disabled = false; tarikDataServer(); }); });

        function rp(num) { return Number(num).toLocaleString('id-ID'); }
        function prc(part, total) { return total==0 ? "0%" : ((part/total)*100).toFixed(1) + "%"; }
        function getTime(d) { return new Date(d).setHours(0,0,0,0); }
        function daysDiff(start, end) { return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (1000*3600*24)); }
        function monthDiff(start, end) { let d1=new Date(start), d2=new Date(end); return (d2.getFullYear()-d1.getFullYear())*12 + (d2.getMonth()-d1.getMonth()); }
        function formatd(iso) { try { let d=new Date(iso); if(isNaN(d))return"-"; return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'2-digit'});}catch(e){return"-";} }
        function formati(iso) { try { let d = new Date(iso); if (isNaN(d.getTime())) return ""; let m = ''+(d.getMonth()+1), day = ''+d.getDate(), y = d.getFullYear(); if(m.length<2) m='0'+m; if(day.length<2) day='0'+day; return [y,m,day].join('-'); } catch(e) { return ""; } }
        function cleanHP(hp) { let s = hp.toString().trim(); return s.startsWith('0') ? '62'+s.substring(1) : s; }

        function hitungFinansial() { let total = Number(document.getElementById('input_total').value) || 0; let bayar1 = Number(document.getElementById('input_bayar1').value) || 0; let bayar2 = Number(document.getElementById('input_bayar2').value) || 0; document.getElementById('display_sisa_hutang').innerText = 'Rp ' + (total - (bayar1 + bayar2)).toLocaleString('id-ID'); }
        function renderPaketLayanan() { let minat = document.getElementById('cust_minat').value; document.getElementById('cust_paket').innerHTML = (STUDIO_CONFIG.paketMap[minat] || ["Standar"]).map(p => `<option value="${p}">${p}</option>`).join(''); renderVarianLayanan(); }
        function renderVarianLayanan() { let paket = document.getElementById('cust_paket').value; document.getElementById('cust_varian').innerHTML = (STUDIO_CONFIG.varianMap[paket] || ["Default"]).map(v => `<option value="${v}">${v}</option>`).join(''); }
        
        