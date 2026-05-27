 function bukaTab(tabId, btnElement) {
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            btnElement.classList.add('active');
            
            if(tabId === 'tabMarketing') renderMarketingTab();else if(tabId === 'tabEOSExecution') {
            if (typeof loadExecutionData === "function") loadExecutionData();
                }
                else if(dataGlobal.length === 0) tarikDataServer();
            }

        function inisialisasiUI() {
            const forms = ['sumber', 'minat', 'lokasi'];
            forms.forEach(key => {
                let opsiHTML = (STUDIO_CONFIG[key] || []).map(item => `<option value="${item}">${item}</option>`).join('');
                if(key === 'sumber') document.getElementById('sumber_opsi').innerHTML = opsiHTML;
                if(key === 'minat') {
                    document.getElementById('minat_opsi').innerHTML = opsiHTML;
                    document.getElementById('cust_minat').innerHTML = opsiHTML;
                }
                if(key === 'lokasi') document.getElementById('cust_lokasi').innerHTML = opsiHTML;
            });
            document.getElementById('promo_container').innerHTML = (STUDIO_CONFIG.promo || []).map(p => `<label class="checkbox-item"><input type="checkbox" class="promo-cb" value="${p}"> ${p}</label>`).join('');
            
            let htmlKategori = '<option value="">Semua Produk / Campaign</option>' + (STUDIO_CONFIG.minat || []).map(m => `<option value="${m}">${m}</option>`).join('');
            document.getElementById('filterKategori').innerHTML = htmlKategori;
            document.getElementById('filterMktCampaign').innerHTML = htmlKategori;

            document.getElementById('set_sumber').value = (STUDIO_CONFIG.sumber || []).join('\n');
            document.getElementById('set_minat').value = (STUDIO_CONFIG.minat || []).join('\n');
            document.getElementById('set_lokasi').value = (STUDIO_CONFIG.lokasi || []).join('\n');
            document.getElementById('set_promo').value = (STUDIO_CONFIG.promo || []).join('\n');
            document.getElementById('set_wa').value = STUDIO_CONFIG.waTemplate || "";
            document.getElementById('set_paketMap').value = JSON.stringify(STUDIO_CONFIG.paketMap, null, 2);
            document.getElementById('set_varianMap').value = JSON.stringify(STUDIO_CONFIG.varianMap, null, 2);

            renderOrgChart(); 
        }
         // ====================================================================
/// ====================================================================
// FUNGSI DOWNLOAD PDF FINAL (UKURAN KECIL, GRAFIK UTUH, ANTI-BURAM)
// ====================================================================
async function downloadPDF(menuId, namaFile, judulLaporan) {
    const { jsPDF } = window.jspdf;
    const elemen = document.getElementById(menuId);
    
    if (!elemen) {
        alert("Sistem gagal menemukan menu: " + menuId);
        return;
    }

    const elemenDisembunyikan = elemen.querySelectorAll('.btn-pdf-global, .filter-panel, .btn-wa, .menu-actions, .ctrl-btn');
    elemenDisembunyikan.forEach(el => el.style.display = 'none');

    // MENDETEKSI FILTER
    let teksFilter = "Tidak ada filter (Semua Data)";
    if (menuId === 'tabDatabase') {
        let fName = document.getElementById('fSearchNama')?.value;
        let elKat = document.getElementById('filterKategori');
        let elStat = document.getElementById('filterStatus');
        let fKat = elKat?.options[elKat.selectedIndex]?.text;
        let fStat = elStat?.options[elStat.selectedIndex]?.text;
        
        let info = [];
        if(fName) info.push("Cari: " + fName);
        if(elKat?.value) info.push("Produk: " + fKat);
        if(elStat?.value) info.push("Status: " + fStat);
        if(info.length > 0) teksFilter = info.join(" | ");
    } else if (menuId === 'tabMarketing') {
        let elCamp = document.getElementById('filterMktCampaign');
        let fCamp = elCamp?.options[elCamp.selectedIndex]?.text;
        let fStart = document.getElementById('fMktStart')?.value;
        let fEnd = document.getElementById('fMktEnd')?.value;
        
        let info = [];
        if(elCamp?.value) info.push("Campaign: " + fCamp);
        if(fStart || fEnd) info.push(`Tgl: ${fStart||'...'} s/d ${fEnd||'...'}`);
        if(info.length > 0) teksFilter = info.join(" | ");
    }

    // MEMBUAT KOP LAPORAN
    let tglDownload = new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
    let headerHTML = document.createElement('div');
    headerHTML.id = "tempPdfHeader";
    headerHTML.style.cssText = "padding:20px; margin-bottom:20px; border-bottom:3px solid #0f172a; background-color:#ffffff; color:#0f172a;";
    headerHTML.innerHTML = `
        <h1 style="margin:0 0 10px 0; font-size:22px; font-weight:900; text-transform:uppercase;">${judulLaporan}</h1>
        <table style="width:100%; border:none; font-size:12px; font-weight:bold; color:#475569; margin:0; background:transparent;">
            <tr><td style="width:130px; padding:3px 0; border:none; text-align:left;">Waktu Cetak Dokumen</td><td style="padding:3px 0; border:none; text-align:left;">: ${tglDownload} WIB</td></tr>
            <tr><td style="padding:3px 0; border:none; text-align:left;">Filter Digunakan</td><td style="padding:3px 0; border:none; text-align:left;">: <span style="color:#ef4444;">${teksFilter}</span></td></tr>
        </table>
    `;
    elemen.insertBefore(headerHTML, elemen.firstChild);

    // BUKA GULUNGAN TABEL
    const tabelScroll = elemen.querySelectorAll('.table-responsive');
    const styleAsli = [];
    tabelScroll.forEach((tb, index) => {
        styleAsli[index] = { maxHeight: tb.style.maxHeight, overflow: tb.style.overflow };
        tb.style.maxHeight = 'none'; 
        tb.style.overflow = 'visible'; 
    });

    // BEKUKAN ANIMASI AGAR TIDAK GHOSTING
    const styleAntiBuram = document.createElement('style');
    styleAntiBuram.innerHTML = `
        * { 
            animation: none !important; 
            transition: none !important; 
            transform: none !important; 
        }
    `;
    document.head.appendChild(styleAntiBuram);

    document.body.style.cursor = 'wait';
    
    // Waktu jeda dinaikkan ke 1 detik memastikan Chart.js selesai menggambar
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    try {
        // PERBAIKAN GRAFIK TERPOTONG: Gunakan scrollWidth dinamis
        const canvas = await html2canvas(elemen, {
            scale: 1.5, // 1.5 adalah titik ideal (Teks cukup tajam, tapi file tidak bengkak)
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: elemen.scrollWidth,       // Memaksa lebar 100% utuh
            height: elemen.scrollHeight,     // Memaksa tinggi 100% utuh
            windowWidth: elemen.scrollWidth, // Menyamakan lensa kamera dengan lebar layar
            windowHeight: elemen.scrollHeight
        });
        
        // PERBAIKAN UKURAN FILE: Kembali ke JPEG dengan kualitas 80%
        const imgData = canvas.toDataURL('image/jpeg', 0.8); 
        
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        const tglHariIni = new Date().toISOString().slice(0, 10);
        pdf.save(`${namaFile}_${tglHariIni}.pdf`);
        
    } catch (error) {
        console.error("Gagal membuat PDF:", error);
        alert("Gagal membuat PDF. Pesan sistem: " + error.message);
    } finally {
        let tempHeader = document.getElementById('tempPdfHeader');
        if (tempHeader) tempHeader.remove();
        
        if (styleAntiBuram) styleAntiBuram.remove();
        
        elemenDisembunyikan.forEach(el => el.style.display = '');
        tabelScroll.forEach((tb, index) => {
            tb.style.maxHeight = styleAsli[index].maxHeight;
            tb.style.overflow = styleAsli[index].overflow;
        });
        document.body.style.cursor = 'default';
    }
}

function renderSettings(config) {
    // 1. Debugging: Lihat apa isinya di Console
    console.log("Data Config yang diterima:", config); 

    if (!config) {
        console.warn("Config kosong!");
        return;
    }

    // 2. Isi form dengan pengamanan (Gunakan || [] atau || {} agar tidak error)
    document.getElementById('set_sumber').value = (config.sumber || []).join('\n');
    document.getElementById('set_minat').value = (config.minat || []).join('\n');
    document.getElementById('set_lokasi').value = (config.lokasi || []).join('\n');
    document.getElementById('set_promo').value = (config.promo || []).join('\n');
    document.getElementById('set_wa').value = config.waTemplate || "";
    
    // 3. Untuk JSON, pastikan kita stringify objek yang ada
    document.getElementById('set_paketMap').value = JSON.stringify(config.paketMap || {}, null, 2);
    document.getElementById('set_varianMap').value = JSON.stringify(config.varianMap || {}, null, 2);
    
    console.log("Pengaturan berhasil dimuat.");
}

function bukaSubTab(subId, btnElement) {
    const targetElement = document.getElementById(subId);
    
    // Safety Check: Jika elemen tidak ditemukan, beri peringatan
    if (!targetElement) {
        console.error("ID elemen tidak ditemukan: " + subId + ". Periksa apakah ID di HTML sama persis.");
        return; 
    }

    // 1. Sembunyikan semua konten sub-tab
    const parentTab = btnElement.closest('.tab-content');
    parentTab.querySelectorAll('.sub-content').forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
    });

    // 2. Hilangkan class 'active' dari semua tombol sub-tab
    parentTab.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 3. Tampilkan sub-tab yang dipilih
    targetElement.style.display = 'block';
    targetElement.classList.add('active');
    btnElement.classList.add('active');
}

