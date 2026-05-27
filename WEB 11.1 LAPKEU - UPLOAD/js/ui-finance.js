// Fungsi untuk sinkronisasi dropdown tipe aktivitas
function updateTipeAktivitas() {
    const inputAkun = document.getElementById('jAkun');
    const tipeDropdown = document.getElementById('jTipe');
    const katInput = document.getElementById('jKategori'); // Tambahkan ID ini di HTML jika mau
    const options = document.getElementById('listAkun').options;
    
    // Cari apakah teks yang diketik user ada di dalam daftar akun
    for (let i = 0; i < options.length; i++) {
        if (options[i].value === inputAkun.value) {
            tipeDropdown.value = options[i].getAttribute('data-tipe');
            if (katInput) {
                katInput.value = options[i].getAttribute('data-kategori');
            }
            break;
        }
    }
}

function resetFormJurnal() {
    document.getElementById('jTgl').value = '';
    document.getElementById('jDesc').value = '';
    document.getElementById('jAkun').value = '';
    document.getElementById('jDebit').value = '0';
    document.getElementById('jKredit').value = '0';
    document.getElementById('jTipe').value = 'Operasional'; // Reset ke default
}

function isiDropdownAkun(daftarAkun) {
    const list = document.getElementById('listAkun');
    list.innerHTML = ''; // Kosongkan dulu

    daftarAkun.forEach(akun => {
        let option = document.createElement('option');
        // Format tampilan: [Nomor] - [Nama]
        option.value = `${akun.kode} - ${akun.kategori}- ${akun.nama}`;
        
        // Simpan data "tersembunyi" untuk dipakai saat posting jurnal
        option.setAttribute('data-kode', akun.kode);
        option.setAttribute('data-nama', akun.nama);
        option.setAttribute('data-kategori', akun.kategori); // Penting untuk kategori
        option.setAttribute('data-tipe', akun.tipe);
        
        list.appendChild(option);
    });
}

async function simpanJurnal(btn) {
    // 1. Ambil elemen input
    const inputUtama = document.getElementById('jAkunUtama');
    const inputPasangan = document.getElementById('jAkunPasangan');
    const options = document.getElementById('listAkun').options;

    // 2. Helper untuk mencari data akun
    const findOption = (val) => Array.from(options).find(o => o.value === val);

    const optUtama = findOption(inputUtama.value);
    const optPasangan = findOption(inputPasangan.value);

    if (!optUtama || !optPasangan) {
        alert("Pilih kedua akun (Utama & Pasangan) dengan benar!");
        return;
    }

    // 3. Siapkan data transaksi (Debit & Kredit)
    // Mengambil nominal dari input jDebit (yang sekarang mewakili total nominal)
    const nominal = document.getElementById('jDebit').value || 0;
    
    // Kita buat array transaksi untuk double-entry
    const dataTransaksi = [
        {
            tgl: document.getElementById('jTgl').value,
            desc: document.getElementById('jDesc').value,
            kode: optUtama.getAttribute('data-kode'),
            nama: optUtama.getAttribute('data-nama'),
            kategori: optUtama.getAttribute('data-kategori'),
            tipe: optUtama.getAttribute('data-tipe'),
            debit: nominal, // Akun Utama didebit
            kredit: 0
        },
        {
            tgl: document.getElementById('jTgl').value,
            desc: document.getElementById('jDesc').value,
            kode: optPasangan.getAttribute('data-kode'),
            nama: optPasangan.getAttribute('data-nama'),
            kategori: optPasangan.getAttribute('data-kategori'),
            tipe: optPasangan.getAttribute('data-tipe'),
            debit: 0,
            kredit: nominal // Akun Pasangan dikredit
        }
    ];

    btn.innerText = "🚀 Menyimpan...";
    btn.disabled = true;

    try {
        const formData = new FormData();
        formData.append('action', 'saveDoubleJurnal'); 
        formData.append('data', JSON.stringify(dataTransaksi)); 

        const response = await fetch(scriptURL, { method: 'POST', body: formData });
        const result = await response.json();
        
        if (result.result === 'success') {
            alert("✅ Jurnal Berpasangan Berhasil Diposting!");
            tarikDataServer(); 
            
            // --- RESET FORM DENGAN AMAN ---
            const debitInput = document.getElementById('jDebit');
            if (debitInput) debitInput.value = '';
            
            const descInput = document.getElementById('jDesc');
            if (descInput) descInput.value = '';
            
            if (inputUtama) inputUtama.value = '';
            if (inputPasangan) inputPasangan.value = '';
            
        } else {
            alert("Error: " + JSON.stringify(result));
        }
    } catch (err) {
        console.error("Gagal simpan:", err);
        alert("Terjadi kesalahan koneksi.");
    } finally {
        btn.innerText = "🚀 Posting ke Jurnal Umum";
        btn.disabled = false;
    }
}

function renderJurnalTable(data) {
    const tbody = document.getElementById('listPreviewJurnal');
    if (!tbody) return;
    tbody.innerHTML = ''; 

    if (!Array.isArray(data) || data.length === 0) return;

    let totalDebit = 0;
    let totalKredit = 0;

    // 1. Balik data sekali saja agar urutan terbaru di atas
    const dataDisplay = [...data].reverse();

    // 2. Loop data untuk render baris
    dataDisplay.forEach(row => {
        let deb = Number(row.debit) || 0;
        let kre = Number(row.kredit) || 0;

        // Tambahkan ke akumulator total
        totalDebit += deb;
        totalKredit += kre;

        // --- Logika Formatting Tanggal ---
        let formattedDate = '-';
        if (row.tgl) {
            const d = new Date(row.tgl);
            if (!isNaN(d.getTime())) {
                formattedDate = d.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                });
            } else {
                formattedDate = row.tgl; // Fallback jika format sudah string biasa
            }
        }

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.id || '-'}</td>
            <td>${formattedDate}</td>
            <td>${row.kode || '-'}</td>
            <td>${row.nama || '-'}</td>
            <td>${row.desc || '-'}</td>
            <td>${row.kategori || '-'}</td>
            <td><span class="badge">${row.tipe || '-'}</span></td>
            <td>Rp ${deb.toLocaleString('id-ID')}</td>
            <td>Rp ${kre.toLocaleString('id-ID')}</td>
        `;
        tbody.appendChild(tr);
    });

    // 3. Tambahkan baris total sekali saja setelah loop selesai
    let trTotal = document.createElement('tr');
    trTotal.style.fontWeight = "bold";
    trTotal.style.background = "#f1f5f9";
    trTotal.innerHTML = `
        <td colspan="7" style="text-align: right;">TOTAL</td>
        <td>Rp ${totalDebit.toLocaleString('id-ID')}</td>
        <td>Rp ${totalKredit.toLocaleString('id-ID')}</td>
    `;
    tbody.appendChild(trTotal);
}

function terapkanFilter() {
    const tglMulai = document.getElementById('filterTglMulai').value; 
    const tglSelesai = document.getElementById('filterTglSelesai').value;
    const akunInput = document.getElementById('filterAkun').value.trim().toLowerCase();

    let extractedKode = "";
    if (akunInput.includes("-")) {
        extractedKode = akunInput.split("-")[0].trim();
    } else {
        extractedKode = akunInput;
    }

    const dataFiltered = dataJurnalGlobal.filter(row => {
        let match = true;

        // 1. Filter Rentang Tanggal
        let rowDate = '';
        if (row.tgl) {
            const d = new Date(row.tgl);
            if (!isNaN(d.getTime())) {
                rowDate = d.toISOString().split('T')[0]; 
            }
        }
        if (tglMulai && (!rowDate || rowDate < tglMulai)) match = false;
        if (tglSelesai && (!rowDate || rowDate > tglSelesai)) match = false;

        // 2. Filter Berdasarkan Akun
        if (akunInput !== "") {
            const kodeRow = (row.kode || "").toString().toLowerCase().trim();
            const namaRow = (row.nama || "").toString().toLowerCase().trim();

            let isMatch = false;
            if (kodeRow !== "" && kodeRow === extractedKode) {
                isMatch = true;
            } else if (namaRow.includes(akunInput)) {
                isMatch = true;
            } else if (kodeRow.includes(akunInput)) {
                isMatch = true;
            }
            
            if (!isMatch) match = false;
        }

        return match;
    });

    // Jalankan pembaruan ke komponen UI secara terpisah
    renderJurnalTable(dataFiltered);
    hitungLabaRugi(dataFiltered);
    hitungArusKas(dataFiltered);
}

function resetFilter() {
    // Kosongkan form filter
    document.getElementById('filterTglMulai').value = '';
    document.getElementById('filterTglSelesai').value = '';
    document.getElementById('filterAkun').value = '';
    
    // Kembalikan semua hitungan ke data global awal
    renderJurnalTable(dataJurnalGlobal);
    hitungLabaRugi(dataJurnalGlobal);
    hitungArusKas(dataJurnalGlobal);
    hitungNeraca(dataFiltered);
}


function generateNewId(sheetJurnal) {
    var lastRow = sheetJurnal.getLastRow();
    var dateStr = Utilities.formatDate(new Date(), "GMT+7", "yyMMdd"); // YYMMDD
    var newId = "BM-" + dateStr + "-001"; // Format default jika hari ini belum ada transaksi

    if (lastRow > 1) {
        var lastId = sheetJurnal.getRange(lastRow, 1).getValue(); // Ambil ID baris terakhir
        // Pecah ID: BM-260527-001 menjadi bagian-bagian
        var parts = lastId.split('-'); 
        
        // Jika tanggalnya sama dengan hari ini, tambah angka urutannya
        if (parts[1] === dateStr) {
            var counter = parseInt(parts[2], 10) + 1;
            newId = "JV-" + dateStr + "-" + ("000" + counter).slice(-3);
        }
    }
    return newId;
}


// =========================================================================
// =========================================================================
// 1. FUNGSI HITUNG & RINCIAN LABA RUGI
// =========================================================================
function hitungLabaRugi(dataJurnal) {
    if (!Array.isArray(dataJurnal)) return;

    let totalPendapatan = 0;
    let totalBeban = 0;
    let rincianHTML = []; // Wadah untuk tabel detail

    dataJurnal.forEach(row => {
        let deb = Number(row.debit) || 0;
        let kre = Number(row.kredit) || 0;
        
        let kode = (row.kode || "").toString().trim();
        let kategori = (row.kategori || "").toLowerCase();

        let isPendapatan = kode.startsWith("4") || kategori.includes("pendapatan");
        let isBeban = kode.startsWith("5") || kategori.includes("beban") || kategori.includes("biaya");

        if (isPendapatan) {
            let nilai = kre - deb;
            totalPendapatan += nilai;
            rincianHTML.push(`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px;">${formatTanggalManusia(row.tgl)}</td>
                    <td style="padding: 8px;">${kode} - ${row.nama}</td>
                    <td style="padding: 8px;">${row.desc || '-'}</td>
                    <td style="padding: 8px;"><span class="badge" style="background: #dcfce7; color: #166534;">Pendapatan</span></td>
                    <td style="padding: 8px; text-align: right; font-weight: bold; color: #10b981;">Rp ${rp(nilai)}</td>
                </tr>
            `);
        } 
        else if (isBeban) {
            let nilai = deb - kre;
            totalBeban += nilai;
            rincianHTML.push(`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px;">${formatTanggalManusia(row.tgl)}</td>
                    <td style="padding: 8px;">${kode} - ${row.nama}</td>
                    <td style="padding: 8px;">${row.desc || '-'}</td>
                    <td style="padding: 8px;"><span class="badge" style="background: #fee2e2; color: #991b1b;">Beban</span></td>
                    <td style="padding: 8px; text-align: right; font-weight: bold; color: #ef4444;">Rp ${rp(nilai)}</td>
                </tr>
            `);
        }
    });

    let labaBersih = totalPendapatan - totalBeban;

    // --- Cetak ke UI (Ringkasan) ---
    const txtPendapatan = document.getElementById('val_pendapatan');
    const txtBeban = document.getElementById('val_beban');
    const txtLaba = document.getElementById('val_laba');
    if (txtPendapatan) txtPendapatan.innerText = "Rp " + rp(totalPendapatan);
    if (txtBeban) txtBeban.innerText = "Rp " + rp(totalBeban);
    if (txtLaba) {
        txtLaba.innerText = "Rp " + rp(labaBersih);
        txtLaba.style.color = labaBersih >= 0 ? "#059669" : "#dc2626"; 
    }

    // --- Cetak ke UI (Tabel Rincian) ---
    const tbodyLabaRugi = document.getElementById('listDetailLabaRugi');
    if (tbodyLabaRugi) {
        tbodyLabaRugi.innerHTML = rincianHTML.length > 0 ? rincianHTML.join('') : '<tr><td colspan="5" style="text-align:center; padding: 15px;">Tidak ada transaksi pada periode ini.</td></tr>';
    }
}


// =========================================================================
// 2. FUNGSI HITUNG & RINCIAN ARUS KAS
// =========================================================================
function hitungArusKas(dataJurnal) {
    if (!Array.isArray(dataJurnal)) return;

    let kasOps = 0, kasInv = 0, kasDan = 0;
    let rincianHTML = [];

    dataJurnal.forEach(row => {
        let deb = Number(row.debit) || 0;
        let kre = Number(row.kredit) || 0;
        
        let kode = (row.kode || "").toString().trim();
        let namaAkun = (row.nama || "").toLowerCase();
        let tipe = (row.tipe || "").toLowerCase();

        // Cari transaksi spesifik yang melibatkan Kas/Bank
        if (kode.startsWith("1") || namaAkun.includes("kas") || namaAkun.includes("bank")) {
            let pergerakanKas = deb - kre; 
            let badgeColor = "#3b82f6"; // Default biru untuk operasional
            let teksTipe = "Operasional";

            if (tipe.includes("investasi")) {
                kasInv += pergerakanKas;
                teksTipe = "Investasi";
                badgeColor = "#f59e0b"; // Kuning
            } else if (tipe.includes("pendanaan")) {
                kasDan += pergerakanKas;
                teksTipe = "Pendanaan";
                badgeColor = "#8b5cf6"; // Ungu
            } else {
                kasOps += pergerakanKas;
            }

            rincianHTML.push(`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px;">${formatTanggalManusia(row.tgl)}</td>
                    <td style="padding: 8px;">${kode} - ${row.nama}</td>
                    <td style="padding: 8px;">${row.desc || '-'}</td>
                    <td style="padding: 8px;"><span class="badge" style="background: ${badgeColor}; color: #fff;">${teksTipe}</span></td>
                    <td style="padding: 8px; text-align: right; color: #10b981; font-weight: bold;">${deb > 0 ? '+ Rp ' + rp(deb) : '-'}</td>
                    <td style="padding: 8px; text-align: right; color: #ef4444; font-weight: bold;">${kre > 0 ? '- Rp ' + rp(kre) : '-'}</td>
                </tr>
            `);
        }
    });

    let totalArusKas = kasOps + kasInv + kasDan;

    // --- Cetak ke UI (Ringkasan) ---
    const txtKasOps = document.getElementById('val_kas_ops');
    const txtKasInv = document.getElementById('val_kas_inv');
    const txtKasDan = document.getElementById('val_kas_dan');
    const txtTotalKas = document.getElementById('val_total_kas');

    if (txtKasOps) txtKasOps.innerText = "Rp " + rp(kasOps);
    if (txtKasInv) txtKasInv.innerText = "Rp " + rp(kasInv);
    if (txtKasDan) txtKasDan.innerText = "Rp " + rp(kasDan);
    if (txtTotalKas) {
        txtTotalKas.innerText = "Rp " + rp(totalArusKas);
        txtTotalKas.style.color = totalArusKas >= 0 ? "#059669" : "#dc2626";
    }

    // --- Cetak ke UI (Tabel Rincian) ---
    const tbodyArusKas = document.getElementById('listDetailArusKas');
    if (tbodyArusKas) {
        tbodyArusKas.innerHTML = rincianHTML.length > 0 ? rincianHTML.join('') : '<tr><td colspan="6" style="text-align:center; padding: 15px;">Tidak ada mutasi kas pada periode ini.</td></tr>';
    }
}

// =========================================================================
// 3. FUNGSI HITUNG NERACA (BALANCE SHEET)
// =========================================================================
function hitungNeraca(dataJurnal) {
    if (!Array.isArray(dataJurnal)) return;

    // Variabel Aktiva (Bertambah di Debit)
    let kasDanBank = 0;
    let piutangAsetLancar = 0;
    let asetTetap = 0;

    // Variabel Pasiva (Bertambah di Kredit)
    let hutangKewajiban = 0;
    let modalPemilik = 0;

    // Variabel Laba Berjalan (Pendapatan - Beban)
    let pendapatan = 0;
    let beban = 0;

    dataJurnal.forEach(row => {
        let deb = Number(row.debit) || 0;
        let kre = Number(row.kredit) || 0;
        
        let kode = (row.kode || "").toString().trim();
        let nama = (row.nama || "").toLowerCase();

        // KELOMPOK 1: AKTIVA (ASET) -> Rumus: Debit - Kredit
        if (kode.startsWith("1")) {
            let nilaiBersih = deb - kre;
            if (nama.includes("kas") || nama.includes("bank")) {
                kasDanBank += nilaiBersih;
            } else if (nama.includes("piutang") || nama.includes("persediaan") || kode.startsWith("11")) {
                piutangAsetLancar += nilaiBersih;
            } else {
                asetTetap += nilaiBersih; // Default untuk Peralatan, Inventaris, Kendaraan (Biasanya awalan 12)
            }
        } 
        // KELOMPOK 2: KEWAJIBAN / HUTANG -> Rumus: Kredit - Debit
        else if (kode.startsWith("2")) {
            hutangKewajiban += (kre - deb);
        }
        // KELOMPOK 3: MODAL -> Rumus: Kredit - Debit
        else if (kode.startsWith("3")) {
            modalPemilik += (kre - deb);
        }
        // KELOMPOK 4 & 5: LABA BERJALAN
        else if (kode.startsWith("4")) {
            pendapatan += (kre - deb);
        } else if (kode.startsWith("5")) {
            beban += (deb - kre);
        }
    });

    let labaBerjalan = pendapatan - beban;
    let totalAktiva = kasDanBank + piutangAsetLancar + asetTetap;
    let totalPasiva = hutangKewajiban + modalPemilik + labaBerjalan;

    // CETAK KE HTML
    document.getElementById('val_neraca_kas').innerText = "Rp " + rp(kasDanBank);
    document.getElementById('val_neraca_piutang').innerText = "Rp " + rp(piutangAsetLancar);
    document.getElementById('val_neraca_aset_tetap').innerText = "Rp " + rp(asetTetap);
    document.getElementById('val_neraca_total_aktiva').innerText = "Rp " + rp(totalAktiva);

    document.getElementById('val_neraca_hutang').innerText = "Rp " + rp(hutangKewajiban);
    document.getElementById('val_neraca_modal').innerText = "Rp " + rp(modalPemilik);
    
    let elLaba = document.getElementById('val_neraca_laba_berjalan');
    elLaba.innerText = "Rp " + rp(labaBerjalan);
    elLaba.style.color = labaBerjalan >= 0 ? "#10b981" : "#ef4444"; // Hijau untung, Merah rugi
    
    document.getElementById('val_neraca_total_pasiva').innerText = "Rp " + rp(totalPasiva);

    // CEK STATUS BALANCE
    let elStatus = document.getElementById('neraca_status');
    // Toleransi beda 1-2 rupiah akibat pembulatan
    if (Math.abs(totalAktiva - totalPasiva) < 5) {
        elStatus.innerText = "✅ SEIMBANG (BALANCED)";
        elStatus.style.background = "#dcfce7";
        elStatus.style.color = "#166534";
    } else {
        elStatus.innerText = "⚠️ TIDAK SEIMBANG";
        elStatus.style.background = "#fee2e2";
        elStatus.style.color = "#991b1b";
    }
}