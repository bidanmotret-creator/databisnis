async function tarikDataServer() {
    console.log("Memulai proses update...");
    
    // 1. Ambil data dari API
    const data = await fetchDataFromServer();
    
    if (!data) {
        const loadingEl = document.getElementById('loadingStatus');
        if(loadingEl) loadingEl.innerHTML = "❌ Gagal koneksi ke server.";
        return;
    }
    
    if (typeof renderSettings === "function" && data.config) {
        renderSettings(data.config);
    }

    // 2. Simpan ke variabel global
    dataGlobal = data.clients ? data.clients.reverse() : [];
    dataMarketing = data.marketing || [];
    STUDIO_CONFIG = data.config || {};
    dataJurnalGlobal = (data.finance && data.finance.journal) ? data.finance.journal : [];

    // 3. Distribusikan ke fitur-fitur Keuangan
    if (data.finance) {
        console.log("Data Keuangan Diterima:", data.finance);
        
        if (typeof isiDropdownAkun === "function" && data.finance.accounts) {
            isiDropdownAkun(data.finance.accounts);
        }
        
        if (typeof renderJurnalTable === "function" && data.finance.journal) {
            renderJurnalTable(data.finance.journal);
        }
        
        if (typeof hitungLabaRugi === "function") {
            hitungLabaRugi(dataJurnalGlobal);
        }

        if (typeof hitungArusKas === "function") {
            hitungArusKas(dataJurnalGlobal);
        }

        if (typeof hitungNeraca === "function") {
            hitungNeraca(dataJurnalGlobal);
        }
        
        // CATATAN: Dua baris pemanggilan ganda di bawah ini SUDAH DIHAPUS agar tidak error
    }

    // 4. Inisialisasi UI lainnya
    if (typeof inisialisasiUI === "function") inisialisasiUI();
    if (typeof loadExecutionData === "function") loadExecutionData();
    
    console.log("Proses selesai.");
}