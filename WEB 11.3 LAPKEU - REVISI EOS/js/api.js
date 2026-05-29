// ==========================================
// 1. FUNGSI UTAMA: MENARIK DATA DARI SERVER
// ==========================================
       async function fetchDataFromServer() {
            try {
                const response = await fetch(scriptURL);
                if (!response.ok) throw new Error("Gagal ambil data");
                return await response.json();
            } catch (e) {
                console.error("Error API:", e);
                return null;
            }
        }
            
// ==========================================
// 2. EVENT LISTENER UNTUK SIMPAN DATA MASTER
// ==========================================

// A. Simpan Struktur Organisasi (Accountability Chart)
let formOrg = document.getElementById('formOrg');
if (formOrg) {
    formOrg.addEventListener('submit', e => {
        e.preventDefault();
        let btn = e.target.querySelector('button[type="submit"]'); 
        let textAsli = btn.innerText;
        btn.disabled = true; 
        btn.innerText = '⏳ Menyimpan Struktur...';
        
        let newOrg = [];
        document.querySelectorAll('.org-box').forEach(box => {
            newOrg.push({
                title: box.querySelector('.org-title').value,
                name: box.querySelector('.org-name').value,
                roles: box.querySelector('.org-roles').value,
                level: box.querySelector('.org-level').value
            });
        });
        STUDIO_CONFIG.orgChart = newOrg;
        
        let fd = new FormData(); 
        fd.append('action', 'saveConfig'); 
        fd.append('configJson', JSON.stringify(STUDIO_CONFIG));
        
        fetch(scriptURL, { method: 'POST', body: fd })
            .then(res => res.json())
            .then(() => { 
                alert('✅ Struktur Akumulasi Urutan & Accountability Chart Berhasil Disimpan!'); 
            })
            .catch((err) => { 
                alert('❌ Gagal menyimpan ke cloud server. Pesan: ' + err); 
            })
            .finally(() => {
                btn.disabled = false; 
                btn.innerText = textAsli;
            });
    });
}

// B. Simpan Konfigurasi Umum (Settings)
let formSettings = document.getElementById('formSettings');
if (formSettings) {
    formSettings.addEventListener('submit', e => { 
        e.preventDefault(); 
        let btn = e.target.querySelector('button'); 
        let textAsli = btn.innerText;
        btn.disabled = true; 
        btn.innerText = '⏳ Menyimpan...'; 

        try { 
            STUDIO_CONFIG.sumber = document.getElementById('set_sumber').value.split('\n').filter(x => x.trim() !== ""); 
            STUDIO_CONFIG.minat = document.getElementById('set_minat').value.split('\n').filter(x => x.trim() !== ""); 
            STUDIO_CONFIG.lokasi = document.getElementById('set_lokasi').value.split('\n').filter(x => x.trim() !== ""); 
            STUDIO_CONFIG.promo = document.getElementById('set_promo').value.split('\n').filter(x => x.trim() !== ""); 
            STUDIO_CONFIG.waTemplate = document.getElementById('set_wa').value; 
            STUDIO_CONFIG.paketMap = JSON.parse(document.getElementById('set_paketMap').value); 
            STUDIO_CONFIG.varianMap = JSON.parse(document.getElementById('set_varianMap').value); 
            
            let fd = new FormData(); 
            fd.append('action', 'saveConfig'); 
            fd.append('configJson', JSON.stringify(STUDIO_CONFIG)); 
            
            fetch(scriptURL, { method: 'POST', body: fd })
                .then(res => res.json())
                .then(() => { 
                    alert('✅ Konfigurasi Berhasil Disimpan!'); 
                    tarikDataServer(); 
                })
                .catch(err => {
                    alert('❌ Gagal menyimpan ke server: ' + err);
                })
                .finally(() => {
                    btn.disabled = false; 
                    btn.innerText = textAsli; 
                }); 
        } catch(err) { 
            alert('❌ Gagal! Periksa kembali format JSON pada Map Paket/Varian.'); 
            btn.disabled = false; 
            btn.innerText = textAsli; 
        } 
    });
}

// =========================================================================
// C. SIMPAN LEADS BARU (TOFU)
// =========================================================================
let formLead = document.getElementById('formLead');
if (formLead) {
    formLead.addEventListener('submit', e => { 
        e.preventDefault(); 
        let btn = document.getElementById('btnSubmitLead'); 
        let textAsli = btn.innerText;
        btn.disabled = true; 
        btn.innerText = '⏳ Menyimpan...';
        
        fetch(scriptURL, { method: 'POST', body: new FormData(e.target)})
            .then(res => res.json())
            .then(() => { 
                alert('✅ Lead Baru Berhasil Disimpan!'); 
                e.target.reset(); 
                tarikDataServer(); 
            })
            .catch(err => {
                alert('❌ Gagal menyimpan Lead: ' + err);
            })
            .finally(() => {
                btn.disabled = false; 
                btn.innerText = textAsli;
            }); 
    });
}


async function simpanEksekusiEOS() {
    let btn = event.target || document.querySelector('.btn-submit');
    let originalText = btn.innerText;
    btn.innerText = '⏳ Menyimpan ke Cloud...';
    btn.disabled = true;

    // 1. Ambil data plan terbaru dengan aman
    STUDIO_CONFIG.exec_plan = {
        rev: document.getElementById('exec_1yr_rev')?.value || "",
        profit: document.getElementById('exec_1yr_profit')?.value || "",
        goals: document.getElementById('exec_1yr_goals')?.value || ""
    };

    try {
        // 2. Gunakan URLSearchParams agar e.parameter di GAS bisa membaca data
        let params = new URLSearchParams();
        params.append('action', 'saveEOS');
        params.append('configJson', JSON.stringify(STUDIO_CONFIG));

        let response = await fetch(scriptURL, { 
            method: 'POST', 
            body: params // Kirim sebagai URL Encoded, ini standar GAS
        });
        
        let result = await response.json();

        if (result.result === 'success') {
            alert("✅ Data EOS berhasil disinkronkan ke Spreadsheet!");
            // Refresh tampilan dasbor setelah simpan
            updateDashboardUI(); 
            // Opsional: Jika fungsi tarikDataServer ada, panggil untuk pastikan sinkronisasi terbaru
            if (typeof tarikDataServer === 'function') tarikDataServer();
        } else {
            throw new Error(result.error || "Terjadi kesalahan pada server");
        }
    } catch(err) {
        console.error("Error saat menyimpan EOS:", err);
        alert("❌ Gagal menyimpan. Pastikan internet stabil. Pesan: " + err.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// js/api.js
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

        if (typeof filterLeadSelect === "function") {
         filterLeadSelect();
        }
        // CATATAN: Dua baris pemanggilan ganda di bawah ini SUDAH DIHAPUS agar tidak error
    }

    // 4. Inisialisasi UI lainnya
    if (typeof inisialisasiUI === "function") inisialisasiUI();
    if (typeof loadExecutionData === "function") loadExecutionData();
    
    console.log("Proses selesai.");
}

// =========================================================================
// D. SIMPAN KONVERSI (UPDATE CUSTOMER / MOFU BOFU) + JURNAL OTOMATIS
// =========================================================================
let formCustomer = document.getElementById('formCustomer');
if (formCustomer) {
    formCustomer.addEventListener('submit', async e => { 
        e.preventDefault(); 
        let btn = document.getElementById('btnSubmitCustomer'); 
        let textAsli = btn.innerText;
        btn.disabled = true; 
        btn.innerText = '⏳ Memperbarui Database...';
        
        // Kompilasi data promo yang dicentang
        let promoTerpilih = []; 
        document.querySelectorAll('.promo-cb:checked').forEach(cb => promoTerpilih.push(cb.value)); 
        document.getElementById('hidden_promo').value = promoTerpilih.length > 0 ? promoTerpilih.join(', ') : '-'; 
        
        try {
            // 1. KIRIM DATA UTAMA KE DATABASE CLIENTS CRM
            let formData = new FormData(e.target);
            const responseCRM = await fetch(scriptURL, { method: 'POST', body: formData });
            await responseCRM.json();

            // 2. EVALUASI DAN EKSEKUSI FITUR JURNAL OTOMATIS
            const isAutoJournal = document.getElementById('auto_jurnal_cb')?.checked;
            const inputKas = document.getElementById('auto_akun_kas');
            const inputPendapatan = document.getElementById('auto_akun_pendapatan');
            const options = document.getElementById('listAkun')?.options || [];

            if (isAutoJournal && inputKas && inputPendapatan && options.length > 0) {
                btn.innerText = '⏳ Membuat Jurnal Akuntansi...';

                // Fungsi pembantu untuk mencocokkan input teks dengan data di datalist
                const findOption = (val) => Array.from(options).find(o => o.value === val);
                const optKas = findOption(inputKas.value);
                const optPendapatan = findOption(inputPendapatan.value);
                
                // Cari akun piutang secara dinamis berdasarkan kode standar atau nama
                const optPiutang = Array.from(options).find(o => o.getAttribute('data-kode') === '112' || o.value.toLowerCase().includes('piutang'));

                if (!optKas || !optPendapatan) {
                    console.warn("Otomatisasi jurnal dilewati karena penentuan akun Kas atau Pendapatan tidak valid.");
                } else {
                    // Ambil nilai data finansial dari form kontainer
                    let namaKlien   = document.getElementById('cust_nama').value || "Klien";
                    let layanan     = document.getElementById('cust_minat').value || "Layanan Foto";
                    let total       = Number(document.getElementById('input_total').value) || 0;
                    let bayar1      = Number(document.getElementById('input_bayar1').value) || 0;
                    let bayar2      = Number(document.getElementById('input_bayar2').value) || 0;
                    let tgl1        = document.getElementById('cust_tgl_bayar1').value || new Date().toISOString().split('T')[0];
                    let tgl2        = document.getElementById('cust_tgl_bayar2').value || new Date().toISOString().split('T')[0];

                    let dataTransaksi = [];

                    // SKENARIO A: KLIEN BARU BAYAR DP (Nominal Bayar 1 Terisi, Bayar 2 Kosong)
                    if (bayar1 > 0 && bayar2 === 0) {
                        // Pasangan Jurnal 1: Penerimaan Uang Fisik DP (Kas debit, Pendapatan kredit)
                        dataTransaksi.push(
                            {
                                tgl: tgl1, desc: `DP ${layanan} - ${namaKlien}`,
                                kode: optKas.getAttribute('data-kode'), nama: optKas.getAttribute('data-nama'),
                                kategori: optKas.getAttribute('data-kategori'), tipe: optKas.getAttribute('data-tipe'),
                                debit: bayar1, kredit: 0
                            },
                            {
                                tgl: tgl1, desc: `DP ${layanan} - ${namaKlien}`,
                                kode: optPendapatan.getAttribute('data-kode'), nama: optPendapatan.getAttribute('data-nama'),
                                kategori: optPendapatan.getAttribute('data-kategori'), tipe: optPendapatan.getAttribute('data-tipe'),
                                debit: 0, kredit: bayar1
                            }
                        );

                        // Pasangan Jurnal 2: Pengakuan Sisa Tagihan Sebagai Piutang
                        let sisaPiutang = total - bayar1;
                        if (sisaPiutang > 0 && optPiutang) {
                            dataTransaksi.push(
                                {
                                    tgl: tgl1, desc: `Sisa Tagihan ${layanan} - ${namaKlien}`,
                                    kode: optPiutang.getAttribute('data-kode'), nama: optPiutang.getAttribute('data-nama'),
                                    kategori: optPiutang.getAttribute('data-kategori'), tipe: optPiutang.getAttribute('data-tipe'),
                                    debit: sisaPiutang, kredit: 0
                                },
                                {
                                    tgl: tgl1, desc: `Sisa Tagihan ${layanan} - ${namaKlien}`,
                                    kode: optPendapatan.getAttribute('data-kode'), nama: optPendapatan.getAttribute('data-nama'),
                                    kategori: optPendapatan.getAttribute('data-kategori'), tipe: optPendapatan.getAttribute('data-tipe'),
                                    debit: 0, kredit: sisaPiutang
                                }
                            );
                        }
                    }
                    
                    // SKENARIO B: KLIEN MELAKUKAN PELUNASAN (Nominal Bayar 1 & Bayar 2 Terisi)
                    else if (bayar1 > 0 && bayar2 > 0 && optPiutang) {
                        // Jurnal Pelunasan: Memindahkan Piutang Usaha menjadi Kas Fisik
                        dataTransaksi.push(
                            {
                                tgl: tgl2, desc: `Pelunasan Sesi ${layanan} - ${namaKlien}`,
                                kode: optKas.getAttribute('data-kode'), nama: optKas.getAttribute('data-nama'),
                                kategori: optKas.getAttribute('data-kategori'), tipe: optKas.getAttribute('data-tipe'),
                                debit: bayar2, kredit: 0
                            },
                            {
                                tgl: tgl2, desc: `Pelunasan Sesi ${layanan} - ${namaKlien}`,
                                kode: optPiutang.getAttribute('data-kode'), nama: optPiutang.getAttribute('data-nama'),
                                kategori: optPiutang.getAttribute('data-kategori'), tipe: optPiutang.getAttribute('data-tipe'),
                                debit: 0, kredit: bayar2
                            }
                        );
                    }

                    // SKENARIO C: KLIEN LANGSUNG BAYAR LUNAS DI AWAL (Nominal Bayar 1 Kosong)
                    else if (bayar1 === 0 && total > 0) {
                        dataTransaksi.push(
                            {
                                tgl: tgl2, desc: `Lunas Kontan ${layanan} - ${namaKlien}`,
                                kode: optKas.getAttribute('data-kode'), nama: optKas.getAttribute('data-nama'),
                                kategori: optKas.getAttribute('data-kategori'), tipe: optKas.getAttribute('data-tipe'),
                                debit: total, kredit: 0
                            },
                            {
                                tgl: tgl2, desc: `Lunas Kontan ${layanan} - ${namaKlien}`,
                                kode: optPendapatan.getAttribute('data-kode'), nama: optPendapatan.getAttribute('data-nama'),
                                kategori: optPendapatan.getAttribute('data-kategori'), tipe: optPendapatan.getAttribute('data-tipe'),
                                debit: 0, kredit: total
                            }
                        );
                    }

                    // 3. KIRIM DATA KE ENDPOINT AKUNTANSI (saveDoubleJurnal)
                    if (dataTransaksi.length > 0) {
                        const formDataJurnal = new FormData();
                        formDataJurnal.append('action', 'saveDoubleJurnal');
                        formDataJurnal.append('data', JSON.stringify(dataTransaksi));
                        await fetch(scriptURL, { method: 'POST', body: formDataJurnal });
                    }
                }
            }

            alert('✅ Data Konversi Pelanggan & Otomatisasi Jurnal Berhasil Diperbarui!'); 
            e.target.reset(); 
            document.getElementById('formCustomer').style.display = 'none'; 
            
            // Segarkan seluruh visualisasi data dashboard
            tarikDataServer(); 

        } catch (err) {
            console.error("Gagal melakukan pembaruan integrasi:", err);
            alert('❌ Terjadi kesalahan sistem: ' + err);
        } finally {
            btn.disabled = false; 
            btn.innerText = textAsli;
        } 
    });
}