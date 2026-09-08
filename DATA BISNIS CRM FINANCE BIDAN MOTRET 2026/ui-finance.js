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

    // --- PENDAMPING SOP: validasi pola mencurigakan sebelum posting ---
    const nominalCek = document.getElementById('jDebit').value || 0;
    const peringatanSOP = cekSopSebelumPosting_(optUtama, optPasangan, nominalCek);
    if (peringatanSOP.length > 0) {
        const lanjut = confirm(
            "⚠️ SOP Akuntansi mendeteksi hal berikut sebelum posting:\n\n" +
            peringatanSOP.map((p, i) => (i + 1) + ". " + p).join("\n\n") +
            "\n\nTetap lanjutkan posting?"
        );
        if (!lanjut) return;
    }

    // --- WAJIB: validasi Customer (Pendapatan) & Vendor (Pembelian) ---
    const pesanErrorCustomerVendor = validasiCustomerVendorSebelumPosting_(optUtama, optPasangan);
    if (pesanErrorCustomerVendor) {
        alert(pesanErrorCustomerVendor);
        return; // BLOCKING — tidak bisa di-skip
    }
    const refCustomerKirim = document.getElementById('jCustomerPicker')?.value.trim() || '';
    const refVendorKirim = document.getElementById('jVendorPicker')?.value.trim() || '';

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
            kredit: 0,
            refCustomer: refCustomerKirim,
            refVendor: refVendorKirim
        },
        {
            tgl: document.getElementById('jTgl').value,
            desc: document.getElementById('jDesc').value,
            kode: optPasangan.getAttribute('data-kode'),
            nama: optPasangan.getAttribute('data-nama'),
            kategori: optPasangan.getAttribute('data-kategori'),
            tipe: optPasangan.getAttribute('data-tipe'),
            debit: 0,
            kredit: nominal, // Akun Pasangan dikredit
            refCustomer: refCustomerKirim,
            refVendor: refVendorKirim
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
            tarikDataKeuanganSaja();
            
            // --- RESET FORM DENGAN AMAN ---
            const debitInput = document.getElementById('jDebit');
            if (debitInput) debitInput.value = '';
            
            const descInput = document.getElementById('jDesc');
            if (descInput) descInput.value = '';
            
            if (inputUtama) inputUtama.value = '';
            if (inputPasangan) inputPasangan.value = '';
            if (document.getElementById('jCustomerPicker')) document.getElementById('jCustomerPicker').value = '';
            if (document.getElementById('jVendorPicker')) document.getElementById('jVendorPicker').value = '';
            if (document.getElementById('customerPreviewInfo')) document.getElementById('customerPreviewInfo').style.display = 'none';
            perbaruiTampilanCustomerVendor_();
            
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
    const dataDisplay = [...data].reverse();

    dataDisplay.forEach(row => {
        let deb = Number(row.debit) || 0;
        let kre = Number(row.kredit) || 0;
        totalDebit += deb;
        totalKredit += kre;

        let formattedDate = '-';
        if (row.tgl) {
            const d = new Date(row.tgl);
            formattedDate = !isNaN(d.getTime())
                ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                : row.tgl;
        }

            // Badge sumber entri
        let sumber = row.sumber_entri || 'Manual';
        let badgeSumber = sumber === 'Otomatis-Leads'
            ? `<span class="badge" style="background:#dbeafe; color:#1e40af; font-weight:700;">🔄 Auto (${row.ref_tahap_bayar || '-'})</span>`
            : `<span class="badge" style="background:#f1f5f9; color:#475569; font-weight:700;">✍️ Manual</span>`;

        // --- BARU: tandai baris Pribadi dengan badge terpisah + baris agak transparan ---
        let baginiPribadi = isTransaksiPribadi_(row);
        let styleBarisPribadi = baginiPribadi ? 'opacity:0.75; background:#f8fafc;' : '';

        // Badge status audit
        let statusAudit = row.status_audit || 'Belum Diaudit';
        let badgeAudit = statusAudit === 'Sudah Diaudit'
            ? `<span class="badge" style="background:#dcfce7; color:#166534; font-weight:700;" title="Oleh: ${row.diaudit_oleh || '-'} pada ${row.tgl_audit || '-'}">✅ ${row.diaudit_oleh || '-'}</span>`
            : `<button type="button" class="btn-verifikasi-jurnal" onclick="verifikasiJurnal('${row.id}')" style="padding:4px 10px; font-size:11px; border-radius:12px; border:1px solid #f59e0b; background:#fffbeb; color:#92400e; font-weight:700; cursor:pointer;">⏳ Verifikasi</button>`;

        // Bukti nota
        let bukti = row.url_bukti
            ? `<a href="${row.url_bukti}" target="_blank" style="color:#2563eb; font-weight:700; text-decoration:none;">📎 Lihat</a>`
            : `<button type="button" onclick="pilihFileBuktiJurnal('${row.id}')" style="padding:4px 10px; font-size:11px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; color:#475569; cursor:pointer;">📤 Upload</button>`;

        let aksi = `<button type="button" title="Hapus baris ini" onclick="hapusBarisJurnal('${row.id}', this)" style="padding:4px 8px; font-size:11px; border-radius:6px; border:none; background:#fee2e2; color:#991b1b; font-weight:700; cursor:pointer;">🗑️</button>`;

              let tr = document.createElement('tr');
        tr.setAttribute('data-pribadi', baginiPribadi ? '1' : '0');
        tr.style.cssText = styleBarisPribadi;
        tr.innerHTML = `
            <td>${row.id || '-'}</td>
            <td>${formattedDate}</td>
            <td>${row.kode || '-'}</td>
            <td>${row.nama || '-'} ${baginiPribadi ? '<span class="badge" style="background:#f59e0b; color:#fff; font-weight:700; margin-left:4px;">👤 PRIBADI</span>' : ''}</td>
            <td>${row.desc || '-'}
                ${row.ref_kode_leads ? `<br><span class="badge" style="background:#dcfce7; color:#166534; font-size:10px; margin-top:3px; display:inline-block;">🧑‍💼 ${row.ref_kode_leads}</span>` : ''}
                ${row.ref_vendor ? `<br><span class="badge" style="background:#fed7aa; color:#9a3412; font-size:10px; margin-top:3px; display:inline-block;">🏭 ${row.ref_vendor}</span>` : ''}
            </td>
            <td>${row.kategori || '-'}</td>
            <td><span class="badge">${row.tipe || '-'}</span></td>
            <td>Rp ${deb.toLocaleString('id-ID')}</td>
            <td>Rp ${kre.toLocaleString('id-ID')}</td>
            <td>${badgeSumber}</td>
            <td>${badgeAudit}</td>
            <td>${bukti}</td>
            <td>${aksi}</td>
        `;
        tbody.appendChild(tr);
    });

    let trTotal = document.createElement('tr');
    trTotal.style.fontWeight = "bold";
    trTotal.style.background = "#f1f5f9";
    trTotal.innerHTML = `
        <td colspan="7" style="text-align: right;">TOTAL</td>
        <td>Rp ${totalDebit.toLocaleString('id-ID')}</td>
        <td>Rp ${totalKredit.toLocaleString('id-ID')}</td>
        <td colspan="4"></td>
    `;
    tbody.appendChild(trTotal);
}

// --- VERIFIKASI / AUDIT JURNAL ---
async function verifikasiJurnal(idJurnal) {
    const nama = prompt("Masukkan nama Anda sebagai penanggung jawab verifikasi jurnal ini:");
    if (!nama || !nama.trim()) return;

    try {
        const fd = new FormData();
        fd.append('action', 'updateAuditJurnal');
        fd.append('idJurnal', idJurnal);
        fd.append('namaAuditor', nama.trim());
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
               if (result.result === 'success') {
            tarikDataKeuanganSaja();
        } else {
            alert('❌ Gagal verifikasi: ' + (result.message || 'error tidak diketahui'));
        }
    } catch (err) {
        alert('❌ Gagal verifikasi (koneksi): ' + err);
    }
}

// --- KOMPRESI GAMBAR (resize + turunkan kualitas) sebelum upload ---
// PDF tidak dikompres — Canvas tidak bisa memproses PDF, dikirim apa adanya.
function kompresGambar(file, maxWidth = 1400, kualitas = 0.75) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => resolve({ base64: reader.result.split(',')[1], mimeType: file.type, namaFile: file.name });
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) {
                    height = Math.round(height * (maxWidth / width));
                    width = maxWidth;
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', kualitas);
                resolve({
                    base64: dataUrl.split(',')[1],
                    mimeType: 'image/jpeg',
                    namaFile: file.name.replace(/\.\w+$/, '.jpg')
                });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// --- UPLOAD BUKTI NOTA/FOTO (otomatis dikompres dulu kalau gambar) ---
function pilihFileBuktiJurnal(idJurnal) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) { alert('Ukuran file maksimal 15MB (sebelum kompresi).'); return; }

        try {
            const ukuranAsliKB = (file.size / 1024).toFixed(0);
            const hasil = await kompresGambar(file);
            const ukuranSetelahKB = ((hasil.base64.length * 0.75) / 1024).toFixed(0);

            const fd = new FormData();
            fd.append('action', 'uploadBuktiJurnal');
            fd.append('idJurnal', idJurnal);
            fd.append('base64', hasil.base64);
            fd.append('mimeType', hasil.mimeType);
            fd.append('namaFile', hasil.namaFile);
            const res = await fetch(scriptURL, { method: 'POST', body: fd });
            const result = await res.json();
                       if (result.result === 'success') {
                console.log(`Bukti terupload. Ukuran asli ~${ukuranAsliKB}KB -> setelah kompresi ~${ukuranSetelahKB}KB`);
                tarikDataKeuanganSaja();
            } else {
                alert('❌ Gagal upload bukti: ' + (result.message || 'error tidak diketahui'));
            }
        } catch (err) {
            alert('❌ Gagal memproses/upload file: ' + err);
        }
    };
    input.click();
}

// --- HAPUS 1 BARIS JURNAL ---
async function hapusBarisJurnal(idJurnal, btnEl) {
    if (!confirm('Hapus baris jurnal ' + idJurnal + '? Tindakan ini tidak bisa dibatalkan.')) return;
    if (btnEl) btnEl.disabled = true;

    // Cari nomor baris di sheet berdasarkan ID (perlu index dari dataJurnalGlobal + 2, karena baris 1 = header)
    const idx = dataJurnalGlobal.findIndex(r => r.id === idJurnal);
    if (idx === -1) { alert('Baris tidak ditemukan di data lokal, refresh dulu.'); return; }
    const rowIndexSheet = idx + 2; // asumsi urutan dataJurnalGlobal = urutan baris sheet (baris 1 header)

    try {
        const fd = new FormData();
        fd.append('action', 'deleteJurnal');
        fd.append('rowIndex', rowIndexSheet);
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
              if (result.result === 'success') {
            tarikDataKeuanganSaja();
        } else {
            alert('❌ Gagal hapus: ' + (result.message || 'error tidak diketahui'));
            if (btnEl) btnEl.disabled = false;
        }
    } catch (err) {
        alert('❌ Gagal hapus (koneksi): ' + err);
        if (btnEl) btnEl.disabled = false;
    }
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

       const sembunyikanPribadi = document.getElementById('filterSembunyikanPribadi')?.checked || false;

    const dataFiltered = dataJurnalGlobal.filter(row => {
        let match = true;

        if (sembunyikanPribadi && isTransaksiPribadi_(row)) return false;

        let rowDate = '';
        if (row.tgl) {
            const d = new Date(row.tgl);
            if (!isNaN(d.getTime())) {
                rowDate = d.toISOString().split('T')[0]; 
            }
        }
        if (tglMulai && (!rowDate || rowDate < tglMulai)) match = false;
        if (tglSelesai && (!rowDate || rowDate > tglSelesai)) match = false;

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

    // FIX: Neraca sebelumnya tidak ikut ter-update saat filter diterapkan — sekarang ikut.
    renderJurnalTable(dataFiltered);
    hitungLabaRugi(dataFiltered);
    hitungArusKas(dataFiltered);
       hitungNeraca(dataFiltered);
    renderCostStructure(dataFiltered);

    // Panel evaluasi & insight otomatis
    renderInsightKeuangan(dataFiltered);
}

function resetFilter() {
    document.getElementById('filterTglMulai').value = '';
    document.getElementById('filterTglSelesai').value = '';
    document.getElementById('filterAkun').value = '';
    
    renderJurnalTable(dataJurnalGlobal);
    hitungLabaRugi(dataJurnalGlobal);
    hitungArusKas(dataJurnalGlobal);
    // FIX: sebelumnya memanggil hitungNeraca(dataFiltered) yang undefined -> error.
       hitungNeraca(dataJurnalGlobal);
    renderCostStructure(dataJurnalGlobal);

    renderInsightKeuangan(dataJurnalGlobal);
}

// --- Preset tambahan khusus tab Keuangan (Bulan Lalu & Tahun Ini) ---
function terapkanBulanLaluKeuangan() {
    let now = new Date();
    let awal = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let akhir = new Date(now.getFullYear(), now.getMonth(), 0);
    document.getElementById('filterTglMulai').value = awal.toISOString().split('T')[0];
    document.getElementById('filterTglSelesai').value = akhir.toISOString().split('T')[0];
    terapkanFilter();
}
function terapkanTahunIniKeuangan() {
    let now = new Date();
    document.getElementById('filterTglMulai').value = `${now.getFullYear()}-01-01`;
    document.getElementById('filterTglSelesai').value = now.toISOString().split('T')[0];
    terapkanFilter();
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
    let barisMentah = []; // { tgl, kode, nama, desc, jenis, nilai }

    dataJurnal.forEach(row => {
        if (isTransaksiPribadi_(row)) return; // lewati, bukan bagian P&L bisnis

        let deb = Number(row.debit) || 0;
        let kre = Number(row.kredit) || 0;

        let kode = (row.kode || "").toString().trim();
        let kategori = (row.kategori || "").toLowerCase();

        let isPendapatan = kode.startsWith("4") || kategori.includes("pendapatan");
        let isBeban = kode.startsWith("5") || kategori.includes("beban") || kategori.includes("biaya");

        if (isPendapatan) {
            let nilai = kre - deb;
            totalPendapatan += nilai;
            barisMentah.push({ tgl: row.tgl, kode, nama: row.nama, desc: row.desc, jenis: 'Pendapatan', nilai });
        }
        else if (isBeban) {
            let nilai = deb - kre;
            totalBeban += nilai;
            barisMentah.push({ tgl: row.tgl, kode, nama: row.nama, desc: row.desc, jenis: 'Beban', nilai });
        }
    });

    // --- Bangun HTML rincian dengan kolom % dari Pendapatan ---
    function persenDariPendapatan_(nilai) {
        if (totalPendapatan === 0) return '-';
        return (nilai / totalPendapatan * 100).toFixed(1) + '%';
    }
    let rincianHTML = barisMentah.map(b => {
        let warnaBadge = b.jenis === 'Pendapatan' ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;';
        let warnaNilai = b.jenis === 'Pendapatan' ? '#10b981' : '#ef4444';
        return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px;">${formatTanggalManusia(b.tgl)}</td>
                <td style="padding: 8px;">${b.kode} - ${b.nama}</td>
                <td style="padding: 8px;">${b.desc || '-'}</td>
                <td style="padding: 8px;"><span class="badge" style="${warnaBadge}">${b.jenis}</span></td>
                <td style="padding: 8px; text-align: right; font-weight: bold; color: ${warnaNilai};">Rp ${rp(b.nilai)}</td>
                <td style="padding: 8px; text-align: right; color: #64748b;">${persenDariPendapatan_(b.nilai)}</td>
            </tr>
        `;
    });

    let labaBersih = totalPendapatan - totalBeban;

    // --- Cetak ke UI (Ringkasan) ---
    const txtPendapatan = document.getElementById('val_pendapatan');
    const txtBeban = document.getElementById('val_beban');
    const txtLaba = document.getElementById('val_laba');
    if (txtPendapatan) txtPendapatan.innerText = "Rp " + rp(totalPendapatan);
    if (txtBeban) {
        let persenBeban = totalPendapatan > 0 ? (totalBeban / totalPendapatan * 100).toFixed(1) + '% dari pendapatan' : '';
        txtBeban.innerText = "Rp " + rp(totalBeban);
        const subBebanPersen = document.getElementById('val_beban_persen_pendapatan');
        if (subBebanPersen) subBebanPersen.innerText = persenBeban;
    }
    if (txtLaba) {
        let persenLaba = totalPendapatan > 0 ? (labaBersih / totalPendapatan * 100).toFixed(1) + '% dari pendapatan' : '';
        txtLaba.innerText = "Rp " + rp(labaBersih);
        txtLaba.style.color = labaBersih >= 0 ? "#059669" : "#dc2626";
        const subLabaPersen = document.getElementById('val_laba_persen_pendapatan');
        if (subLabaPersen) subLabaPersen.innerText = persenLaba;
    }

    // --- Cetak ke UI (Tabel Rincian) ---
    const tbodyLabaRugi = document.getElementById('listDetailLabaRugi');
    if (tbodyLabaRugi) {
        tbodyLabaRugi.innerHTML = rincianHTML.length > 0 ? rincianHTML.join('') : '<tr><td colspan="6" style="text-align:center; padding: 15px;">Tidak ada transaksi pada periode ini.</td></tr>';
    }
}

function hitungArusKas(dataJurnal) {
    if (!Array.isArray(dataJurnal)) return;

    let kasOps = 0, kasInv = 0, kasDan = 0, kasPribadi = 0;
    let totalMasuk = 0, totalKeluar = 0; // ringkasan Masuk/Keluar/Sisa (bisnis, non-pribadi)
    let rincianHTML = [];
    let rincianPribadiHTML = [];

    dataJurnal.forEach(row => {
        let deb = Number(row.debit) || 0;
        let kre = Number(row.kredit) || 0;
        
        let kode = (row.kode || "").toString().trim();
        let namaAkun = (row.nama || "").toLowerCase();
        let tipe = (row.tipe || "").toLowerCase();

        // Cari transaksi spesifik yang melibatkan Kas/Bank
        if (kode.startsWith("1") || namaAkun.includes("kas") || namaAkun.includes("bank")) {
            let pergerakanKas = deb - kre;

            // --- BARU: Pisahkan transaksi Pribadi SEBELUM masuk hitungan bisnis ---
            if (isTransaksiPribadi_(row)) {
                kasPribadi += pergerakanKas;
                rincianPribadiHTML.push(`
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 8px;">${formatTanggalManusia(row.tgl)}</td>
                        <td style="padding: 8px;">${kode} - ${row.nama}</td>
                        <td style="padding: 8px;">${row.desc || '-'}</td>
                        <td style="padding: 8px;"><span class="badge" style="background:#64748b; color:#fff;">Pribadi</span></td>
                        <td style="padding: 8px; text-align: right; color: #10b981; font-weight: bold;">${deb > 0 ? '+ Rp ' + rp(deb) : '-'}</td>
                        <td style="padding: 8px; text-align: right; color: #ef4444; font-weight: bold;">${kre > 0 ? '- Rp ' + rp(kre) : '-'}</td>
                    </tr>
                `);
                return; // lewati, tidak masuk hitungan Operasional/Investasi/Pendanaan bisnis
            }

            totalMasuk += deb;
            totalKeluar += kre;

            let badgeColor = "#3b82f6";
            let teksTipe = "Operasional";

            if (tipe.includes("investasi")) {
                kasInv += pergerakanKas;
                teksTipe = "Investasi";
                badgeColor = "#f59e0b";
            } else if (tipe.includes("pendanaan")) {
                kasDan += pergerakanKas;
                teksTipe = "Pendanaan";
                badgeColor = "#8b5cf6";
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

    let totalArusKas = kasOps + kasInv + kasDan; // TIDAK termasuk kasPribadi
    let sisaBersih = totalMasuk - totalKeluar; // sama nilainya dengan totalArusKas, ditampilkan lebih eksplisit

    // --- Ringkasan Masuk/Keluar/Sisa yang eksplisit (disisipkan otomatis
    //     di atas tabel rincian, tanpa perlu ubah HTML manual) ---
    let containerRingkasan = document.getElementById('ringkasanMasukKeluarKas');
    if (!containerRingkasan) {
        containerRingkasan = document.createElement('div');
        containerRingkasan.id = 'ringkasanMasukKeluarKas';
        const anchor = document.getElementById('insightArusKas');
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(containerRingkasan, anchor.nextSibling);
    }
    containerRingkasan.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:18px;">
            <div style="background:linear-gradient(160deg,#34d399,#059669); border-radius:12px; padding:16px; color:#fff;">
                <div style="font-size:11px; text-transform:uppercase; opacity:.9; font-weight:700;">⬆️ Total Uang Masuk</div>
                <div style="font-size:19px; font-weight:900; margin-top:4px;">Rp ${rp(totalMasuk)}</div>
            </div>
            <div style="background:linear-gradient(160deg,#fb7185,#be123c); border-radius:12px; padding:16px; color:#fff;">
                <div style="font-size:11px; text-transform:uppercase; opacity:.9; font-weight:700;">⬇️ Total Uang Keluar</div>
                <div style="font-size:19px; font-weight:900; margin-top:4px;">Rp ${rp(totalKeluar)}</div>
            </div>
            <div style="background:${sisaBersih >= 0 ? 'linear-gradient(160deg,#60a5fa,#1d4ed8)' : 'linear-gradient(160deg,#f87171,#7f1d1d)'}; border-radius:12px; padding:16px; color:#fff;">
                <div style="font-size:11px; text-transform:uppercase; opacity:.9; font-weight:700;">💧 Sisa (Net)</div>
                <div style="font-size:19px; font-weight:900; margin-top:4px;">Rp ${rp(sisaBersih)}</div>
            </div>
        </div>
    `;

    const txtKasOps = document.getElementById('val_kas_ops');
    const txtKasInv = document.getElementById('val_kas_inv');
    const txtKasDan = document.getElementById('val_kas_dan');
    const txtTotalKas = document.getElementById('val_total_kas');
    const txtKasPribadi = document.getElementById('val_kas_pribadi');

    if (txtKasOps) txtKasOps.innerText = "Rp " + rp(kasOps);
    if (txtKasInv) txtKasInv.innerText = "Rp " + rp(kasInv);
    if (txtKasDan) txtKasDan.innerText = "Rp " + rp(kasDan);
    if (txtTotalKas) {
        txtTotalKas.innerText = "Rp " + rp(totalArusKas);
        txtTotalKas.style.color = totalArusKas >= 0 ? "#059669" : "#dc2626";
    }
    if (txtKasPribadi) {
        txtKasPribadi.innerText = "Rp " + rp(kasPribadi);
        txtKasPribadi.style.color = kasPribadi >= 0 ? "#475569" : "#64748b";
    }

    const tbodyArusKas = document.getElementById('listDetailArusKas');
    if (tbodyArusKas) {
        tbodyArusKas.innerHTML = rincianHTML.length > 0 ? rincianHTML.join('') : '<tr><td colspan="6" style="text-align:center; padding: 15px;">Tidak ada mutasi kas bisnis pada periode ini.</td></tr>';
    }

    const tbodyPribadi = document.getElementById('listDetailArusKasPribadi');
    if (tbodyPribadi) {
        tbodyPribadi.innerHTML = rincianPribadiHTML.length > 0 ? rincianPribadiHTML.join('') : '<tr><td colspan="6" style="text-align:center; padding: 15px; font-style:italic; color:#94a3b8;">Tidak ada transaksi pribadi pada periode ini.</td></tr>';
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

       let asetPribadi = 0, kewajibanPribadi = 0;

    dataJurnal.forEach(row => {
        let deb = Number(row.debit) || 0;
        let kre = Number(row.kredit) || 0;
        
        let kode = (row.kode || "").toString().trim();
        let nama = (row.nama || "").toLowerCase();

        // --- BARU: transaksi Pribadi dihitung TERPISAH, tidak masuk Neraca bisnis ---
        if (isTransaksiPribadi_(row)) {
            if (kode.startsWith("1")) asetPribadi += (deb - kre);
            else if (kode.startsWith("2")) kewajibanPribadi += (kre - deb);
            return;
        }

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

    // --- BARU: tampilkan info Kekayaan Pribadi terpisah (kalau elemen HTML-nya ada) ---
    const elAsetPribadi = document.getElementById('val_neraca_aset_pribadi');
    const elKewajibanPribadi = document.getElementById('val_neraca_kewajiban_pribadi');
    if (elAsetPribadi) elAsetPribadi.innerText = "Rp " + rp(asetPribadi);
    if (elKewajibanPribadi) elKewajibanPribadi.innerText = "Rp " + rp(kewajibanPribadi);

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

// =========================================================================
// EVALUASI & INSIGHT OTOMATIS
// =========================================================================
function renderInsightKeuangan(dataFiltered) {
    if (!Array.isArray(dataFiltered)) return;

    const tglMulai = document.getElementById('filterTglMulai').value;
    const tglSelesai = document.getElementById('filterTglSelesai').value;

    let pendapatan = 0, beban = 0;
    let bebanPerAkun = {};

      dataFiltered.forEach(row => {
        if (isTransaksiPribadi_(row)) return; // lewati transaksi pribadi

        let deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
        let kode = (row.kode || '').toString().trim();
        let kategori = (row.kategori || '').toLowerCase();

        if (kode.startsWith('4') || kategori.includes('pendapatan')) {
            pendapatan += (kre - deb);
        } else if (kode.startsWith('5') || kategori.includes('beban') || kategori.includes('biaya')) {
            let nilai = deb - kre;
            beban += nilai;
            let namaAkun = row.nama || 'Lainnya';
            bebanPerAkun[namaAkun] = (bebanPerAkun[namaAkun] || 0) + nilai;
        }
    });

    let laba = pendapatan - beban;
    let margin = pendapatan > 0 ? (laba / pendapatan * 100) : 0;

    let subPendapatan = document.getElementById('val_pendapatan_sub');
    let subBeban = document.getElementById('val_beban_sub');
    let subLaba = document.getElementById('val_laba_sub');
    let kartuLaba = document.getElementById('kpiCardLaba');

    if (kartuLaba) {
        kartuLaba.classList.remove('fin-kpi-laba-untung', 'fin-kpi-laba-rugi');
        kartuLaba.classList.add(laba >= 0 ? 'fin-kpi-laba-untung' : 'fin-kpi-laba-rugi');
    }
    if (subPendapatan) subPendapatan.innerText = dataFiltered.length + ' entri jurnal di periode ini';
    if (subBeban) {
        let topAkun = Object.entries(bebanPerAkun).sort((a, b) => b[1] - a[1])[0];
        subBeban.innerText = topAkun ? `Terbesar: ${topAkun[0]}` : '-';
    }
    if (subLaba) subLaba.innerText = `Margin ${margin.toFixed(1)}%`;

    let insightBanding = '';
    if (tglMulai && tglSelesai) {
        let d1 = new Date(tglMulai), d2 = new Date(tglSelesai);
        let durasiHari = Math.round((d2 - d1) / 86400000) + 1;
        let prevEnd = new Date(d1); prevEnd.setDate(prevEnd.getDate() - 1);
        let prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - durasiHari + 1);
        let prevStartStr = prevStart.toISOString().split('T')[0];
        let prevEndStr = prevEnd.toISOString().split('T')[0];

        let dataPrev = dataJurnalGlobal.filter(row => {
            if (!row.tgl) return false;
            let d = new Date(row.tgl);
            if (isNaN(d.getTime())) return false;
            let rd = d.toISOString().split('T')[0];
            return rd >= prevStartStr && rd <= prevEndStr;
        });

        let pendapatanPrev = 0, bebanPrev = 0;
        dataPrev.forEach(row => {
            let deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
            let kode = (row.kode || '').toString().trim();
            let kategori = (row.kategori || '').toLowerCase();
            if (kode.startsWith('4') || kategori.includes('pendapatan')) pendapatanPrev += (kre - deb);
            else if (kode.startsWith('5') || kategori.includes('beban') || kategori.includes('biaya')) bebanPrev += (deb - kre);
        });
        let labaPrev = pendapatanPrev - bebanPrev;

        if (dataPrev.length > 0) {
            let pertumbuhan = labaPrev !== 0 ? ((laba - labaPrev) / Math.abs(labaPrev) * 100) : (laba > 0 ? 100 : 0);
            let arah = pertumbuhan >= 0 ? '📈 naik' : '📉 turun';
            insightBanding = `Dibanding periode sebelumnya dengan durasi sama (${prevStartStr} s/d ${prevEndStr}): laba bersih ${arah} <strong>${Math.abs(pertumbuhan).toFixed(1)}%</strong> (dari Rp ${labaPrev.toLocaleString('id-ID')} ke Rp ${laba.toLocaleString('id-ID')}).`;
        } else {
            insightBanding = 'Tidak ada data transaksi di periode sebelumnya untuk dibandingkan (kemungkinan ini periode paling awal).';
        }
    }

    let statusLabel, statusColor, statusPesan;
    if (pendapatan === 0 && beban === 0) {
        statusLabel = '⚪ Belum Ada Transaksi'; statusColor = '#64748b';
        statusPesan = 'Belum ada transaksi tercatat pada periode/filter yang sedang aktif.';
    } else if (laba < 0) {
        statusLabel = '🔴 Rugi'; statusColor = '#dc2626';
        statusPesan = 'Beban lebih besar dari pendapatan pada periode ini. Cek pos beban terbesar di bawah — apakah wajar (misal bulan investasi alat) atau perlu ditekan.';
    } else if (margin < 15) {
        statusLabel = '🟡 Untung Tipis'; statusColor = '#d97706';
        statusPesan = `Margin laba cuma ${margin.toFixed(1)}% dari pendapatan. Masih untung, tapi tipis — perhatikan efisiensi biaya operasional.`;
    } else {
        statusLabel = '🟢 Sehat'; statusColor = '#059669';
        statusPesan = `Margin laba ${margin.toFixed(1)}% — di atas ambang aman (15%). Pertahankan pola ini.`;
    }

    let topBebanList = Object.entries(bebanPerAkun).sort((a, b) => b[1] - a[1]).slice(0, 3);
    let insightTopBeban = topBebanList.length > 0
        ? 'Beban terbesar: ' + topBebanList.map(([nama, val]) => `${nama} (Rp ${val.toLocaleString('id-ID')})`).join(', ') + '.'
        : 'Belum ada data beban di periode ini.';

    let elInsightLR = document.getElementById('insightLabaRugi');
    if (elInsightLR) {
        elInsightLR.innerHTML = `
            <div class="fin-insight-title">💡 Evaluasi & Insight Otomatis — Laba Rugi</div>
            <div style="margin-bottom:14px;"><span class="fin-badge-status" style="background:${statusColor};">${statusLabel}</span></div>
            <div class="fin-insight-item">📊 ${statusPesan}</div>
            ${insightBanding ? `<div class="fin-insight-item">🔁 ${insightBanding}</div>` : ''}
            <div class="fin-insight-item">🧾 ${insightTopBeban}</div>
            <div class="fin-insight-item">📘 <strong>Cara baca Margin Laba:</strong> Laba Bersih ÷ Pendapatan × 100%. Semakin tinggi, semakin efisien bisnis mengubah omzet jadi keuntungan riil di kantong.</div>
        `;
    }

    let kasOps = 0, kasInv = 0, kasDan = 0;
    dataFiltered.forEach(row => {
        if (isTransaksiPribadi_(row)) return;

        let deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
        let kode = (row.kode || '').toString().trim();
        let namaAkun = (row.nama || '').toLowerCase();
        let tipe = (row.tipe || '').toLowerCase();
        if (kode.startsWith('1') || namaAkun.includes('kas') || namaAkun.includes('bank')) {
            let pergerakan = deb - kre;
            if (tipe.includes('investasi')) kasInv += pergerakan;
            else if (tipe.includes('pendanaan')) kasDan += pergerakan;
            else kasOps += pergerakan;
        }
    });
    let totalKas = kasOps + kasInv + kasDan;
    let kartuKasTotal = document.getElementById('kpiCardKasTotal');
    if (kartuKasTotal) {
        kartuKasTotal.classList.remove('fin-kpi-kastotal-plus', 'fin-kpi-kastotal-minus');
        kartuKasTotal.classList.add(totalKas >= 0 ? 'fin-kpi-kastotal-plus' : 'fin-kpi-kastotal-minus');
    }

    let elInsightAK = document.getElementById('insightArusKas');
    if (elInsightAK) {
        let statusKasLabel = totalKas >= 0 ? '🟢 Kas Bertambah' : '🔴 Kas Berkurang';
        let statusKasColor = totalKas >= 0 ? '#059669' : '#dc2626';
        let pesanOps = kasOps < 0
            ? '⚠️ Kas dari aktivitas operasional NEGATIF — artinya operasional harian menghabiskan lebih banyak kas daripada yang dihasilkan. Ini sinyal yang perlu diperhatikan meskipun laba akuntansi masih positif (karena piutang belum tertagih).'
            : 'Kas dari aktivitas operasional positif — bisnis menghasilkan kas riil dari kegiatan hariannya, bukan cuma laba di atas kertas.';
        elInsightAK.innerHTML = `
            <div class="fin-insight-title">💡 Evaluasi & Insight Otomatis — Arus Kas</div>
            <div style="margin-bottom:14px;"><span class="fin-badge-status" style="background:${statusKasColor};">${statusKasLabel}</span></div>
            <div class="fin-insight-item">💧 ${pesanOps}</div>
            <div class="fin-insight-item">📘 <strong>Kenapa Laba Rugi & Arus Kas bisa beda?</strong> Laba dihitung saat penjualan DIAKUI (walau baru DP/piutang), sedangkan Arus Kas dihitung saat uang BENAR-BENAR masuk/keluar dari rekening. Bisnis bisa untung di atas kertas tapi kasnya seret kalau banyak piutang belum tertagih.</div>
        `;
    }
}

// =========================================================================
// COST STRUCTURE & ANGGARAN BIAYA
// =========================================================================
function csBukaPengaturanAnggaran() {
    let tahunSekarang = new Date().getFullYear();
    document.getElementById('csSetTahun').value = tahunSekarang;
    csRenderFormAnggaran(tahunSekarang);
    document.getElementById('csModalSet').classList.add('active');
}

function csRenderFormAnggaran(tahun) {
    const options = document.getElementById('listAkun').options;
    let akunBeban = [];
    let sudahAda = new Set();
    for (let i = 0; i < options.length; i++) {
        let kode = options[i].getAttribute('data-kode');
        let nama = options[i].getAttribute('data-nama');
        if (kode && kode.toString().trim().startsWith('5') && !sudahAda.has(kode)) {
            sudahAda.add(kode);
            akunBeban.push({ kode, nama });
        }
    }

    let existing = {};
    dataAnggaranBiaya.filter(a => String(a.tahun) === String(tahun)).forEach(a => existing[a.kode_akun] = a.anggaran_bulanan);

    const body = document.getElementById('csSetBody');
    if (akunBeban.length === 0) {
        body.innerHTML = '<p style="color:#94a3b8; font-style:italic;">Belum ada akun beban (kode awalan 5) di master Buku Besar. Tambahkan dulu di tab Jurnal / DB_Akun.</p>';
        return;
    }
    body.innerHTML = akunBeban.map(a => `
        <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f1f5f9;">
            <div style="flex:1; font-size:13px; color:#334155;">${a.kode} - ${a.nama}</div>
            <input type="number" class="cs-input-anggaran" data-kode="${a.kode}" data-nama="${a.nama}"
                value="${existing[a.kode] || 0}" placeholder="0"
                style="width:160px; padding:8px; border-radius:6px; border:1px solid #cbd5e1; text-align:right;">
        </div>
    `).join('');
}

function csTutupPengaturan() {
    document.getElementById('csModalSet').classList.remove('active');
}

async function csSimpanPengaturan() {
    const tahun = document.getElementById('csSetTahun').value;
    const daftar = Array.from(document.querySelectorAll('.cs-input-anggaran')).map(el => ({
        kode_akun: el.dataset.kode,
        nama_akun: el.dataset.nama,
        anggaran_bulanan: Number(el.value) || 0
    }));

    const btn = document.getElementById('csBtnSimpanSet');
    const teksAsli = btn.innerText;
    btn.disabled = true; btn.innerText = 'Menyimpan...';

    try {
        const fd = new FormData();
        fd.append('action', 'saveAnggaranBiaya');
        fd.append('tahun', tahun);
        fd.append('anggaranJson', JSON.stringify(daftar));
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            csTutupPengaturan();
            tarikDataServer();
        } else {
            alert('❌ Gagal menyimpan: ' + (result.message || ''));
        }
    } catch (err) {
        alert('❌ Gagal (koneksi): ' + err);
    } finally {
        btn.disabled = false; btn.innerText = teksAsli;
    }
}

function csHitungJumlahBulan(tglMulai, tglSelesai) {
    if (!tglMulai || !tglSelesai) return 1;
    let d1 = new Date(tglMulai), d2 = new Date(tglSelesai);
    let bulanBeda = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()) + 1;
    return Math.max(1, bulanBeda);
}

function renderCostStructure(dataFiltered) {
    if (!Array.isArray(dataFiltered)) return;
    const tabelEl = document.getElementById('tabelCostStructure');
    const insightEl = document.getElementById('insightCostStructure');
    if (!tabelEl || !insightEl) return;

    const tglMulai = document.getElementById('filterTglMulai').value;
    const tglSelesai = document.getElementById('filterTglSelesai').value;
    const tahunAktif = tglMulai ? new Date(tglMulai).getFullYear() : new Date().getFullYear();
    const jmlBulan = csHitungJumlahBulan(tglMulai, tglSelesai);

    let realisasiPerAkun = {};
    dataFiltered.forEach(row => {
        let deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
        let kode = (row.kode || '').toString().trim();
        let kategori = (row.kategori || '').toLowerCase();
        if (kode.startsWith('5') || kategori.includes('beban') || kategori.includes('biaya')) {
            let nilai = deb - kre;
            if (!realisasiPerAkun[kode]) realisasiPerAkun[kode] = { nama: row.nama, nilai: 0 };
            realisasiPerAkun[kode].nilai += nilai;
        }
    });

    let anggaranTahunIni = dataAnggaranBiaya.filter(a => String(a.tahun) === String(tahunAktif));
    let semuaKode = new Set([...anggaranTahunIni.map(a => a.kode_akun), ...Object.keys(realisasiPerAkun)]);

    let baris = [];
    let totalAnggaran = 0, totalRealisasi = 0;
    let melebihi = [], kurangTerpakai = [];

    semuaKode.forEach(kode => {
        let anggaranItem = anggaranTahunIni.find(a => a.kode_akun === kode);
        let anggaranBulanan = anggaranItem ? anggaranItem.anggaran_bulanan : 0;
        let anggaranPeriode = anggaranBulanan * jmlBulan;
        let realisasi = realisasiPerAkun[kode] ? realisasiPerAkun[kode].nilai : 0;
        let nama = (realisasiPerAkun[kode] && realisasiPerAkun[kode].nama) || (anggaranItem && anggaranItem.nama_akun) || kode;

        if (anggaranPeriode <= 0 && realisasi <= 0) return;

        let persen = anggaranPeriode > 0 ? (realisasi / anggaranPeriode * 100) : (realisasi > 0 ? 999 : 0);
        totalAnggaran += anggaranPeriode;
        totalRealisasi += realisasi;

        let statusLabel, statusColor, warnaBar;
        if (anggaranPeriode <= 0) {
            statusLabel = '⚪ Belum Dianggarkan'; statusColor = '#64748b'; warnaBar = '#94a3b8';
        } else if (persen > 100) {
            statusLabel = '🔴 Melebihi Anggaran'; statusColor = '#dc2626'; warnaBar = '#ef4444';
            melebihi.push({ nama, kode, selisih: realisasi - anggaranPeriode });
        } else if (persen >= 85) {
            statusLabel = '🟡 Mendekati Batas'; statusColor = '#d97706'; warnaBar = '#f59e0b';
        } else if (persen >= 40) {
            statusLabel = '🟢 Efisien'; statusColor = '#059669'; warnaBar = '#10b981';
        } else {
            statusLabel = '🔵 Kurang Terpakai'; statusColor = '#2563eb'; warnaBar = '#60a5fa';
            kurangTerpakai.push({ nama, kode, sisa: anggaranPeriode - realisasi });
        }

        baris.push({ kode, nama, anggaranPeriode, realisasi, persen, statusLabel, statusColor, warnaBar });
    });

    baris.sort((a, b) => b.persen - a.persen);

    tabelEl.innerHTML = baris.length > 0 ? baris.map(b => `
        <tr>
            <td style="padding:10px; text-align:left;">${b.kode} - ${b.nama}</td>
            <td style="padding:10px; text-align:center;">Rp ${b.anggaranPeriode.toLocaleString('id-ID')}</td>
            <td style="padding:10px; text-align:center;">Rp ${b.realisasi.toLocaleString('id-ID')}</td>
            <td style="padding:10px; text-align:center;">${b.persen < 999 ? b.persen.toFixed(0) + '%' : '∞'}</td>
            <td style="padding:10px; min-width:140px;">
                <div style="background:#e2e8f0; border-radius:6px; height:10px; overflow:hidden;">
                    <div style="background:${b.warnaBar}; height:100%; width:${Math.min(100, b.persen)}%;"></div>
                </div>
            </td>
            <td style="padding:10px; text-align:center;"><span class="fin-badge-status" style="background:${b.statusColor}; font-size:11px;">${b.statusLabel}</span></td>
        </tr>
    `).join('') : '<tr><td colspan="6" style="text-align:center; padding:20px;">Belum ada anggaran atau realisasi beban untuk periode ini. Klik "⚙️ Atur Anggaran" untuk mulai.</td></tr>';

    let persenTotal = totalAnggaran > 0 ? (totalRealisasi / totalAnggaran * 100) : 0;
    let statusKeseluruhan, warnaKeseluruhan;
    if (totalAnggaran <= 0) { statusKeseluruhan = '⚪ Belum Ada Anggaran'; warnaKeseluruhan = '#64748b'; }
    else if (persenTotal > 100) { statusKeseluruhan = '🔴 Total Anggaran Terlampaui'; warnaKeseluruhan = '#dc2626'; }
    else if (persenTotal >= 85) { statusKeseluruhan = '🟡 Mendekati Batas Total'; warnaKeseluruhan = '#d97706'; }
    else { statusKeseluruhan = '🟢 Dalam Batas Anggaran'; warnaKeseluruhan = '#059669'; }

    let pesanMelebihi = melebihi.length > 0
        ? `${melebihi.length} akun melebihi anggaran, total kelebihan Rp ${melebihi.reduce((a, m) => a + m.selisih, 0).toLocaleString('id-ID')}: ${melebihi.slice(0, 3).map(m => m.nama).join(', ')}${melebihi.length > 3 ? ', dst' : ''}. Tinjau apakah ini kenaikan wajar (misal harga bahan naik) atau ada pemborosan yang perlu diaudit.`
        : 'Tidak ada akun yang melebihi anggaran pada periode ini.';

    let pesanKurang = '';
    if (kurangTerpakai.length > 0) {
        let terbesar = kurangTerpakai.sort((a, b) => b.sisa - a.sisa)[0];
        pesanKurang = `${kurangTerpakai.length} akun terpakai di bawah 40% dari anggarannya (terbesar: ${terbesar.nama}, sisa Rp ${terbesar.sisa.toLocaleString('id-ID')}). Ini bisa berarti dana idle yang bisa dialihkan ke pos lain, ATAU justru sinyal investasi yang kurang maksimal (misal budget marketing tidak terserap).`;
    }

    insightEl.innerHTML = `
        <div class="fin-insight-title">💡 Evaluasi Cost Structure — Anggaran vs Realisasi</div>
        <div style="margin-bottom:14px;">
            <span class="fin-badge-status" style="background:${warnaKeseluruhan};">${statusKeseluruhan}</span>
            <span style="margin-left:10px; opacity:0.85; font-size:12.5px;">Total realisasi Rp ${totalRealisasi.toLocaleString('id-ID')} dari anggaran Rp ${totalAnggaran.toLocaleString('id-ID')} (${persenTotal.toFixed(0)}%)</span>
        </div>
        <div class="fin-insight-item">🔴 ${pesanMelebihi}</div>
        ${pesanKurang ? `<div class="fin-insight-item">🔵 ${pesanKurang}</div>` : ''}
        <div class="fin-insight-item">📘 <strong>Untuk pemilik/investor:</strong> Akun "Melebihi Anggaran" yang berulang tiap bulan menandakan target perlu direvisi naik (jika memang wajar) atau ada kebocoran biaya yang perlu diaudit lebih dalam. Akun "Kurang Terpakai" terus-menerus adalah sinyal untuk merealokasi dana ke pos yang lebih produktif di periode anggaran berikutnya — bukan sekadar "sisa anggaran yang bagus".</div>
    `;
}

function hitungPersenPerubahan(nilai_lalu, nilai_sekarang) {
    if (nilai_lalu === 0 && nilai_sekarang === 0) return 0;
    if (nilai_lalu === 0) return nilai_sekarang > 0 ? 100 : -100;
    return ((nilai_sekarang - nilai_lalu) / Math.abs(nilai_lalu)) * 100;
}

function barisMoMYoY(label, nilaiLalu, nilaiSekarang) {
    let selisih = nilaiSekarang - nilaiLalu;
    let persen = hitungPersenPerubahan(nilaiLalu, nilaiSekarang);
    let warnaPersenClass = persen >= 0 ? 'komparasi-persen-pos' : 'komparasi-persen-neg';
    let tandaPlus = persen >= 0 ? '+' : '';

    return `
        <tr>
            <td>${label}</td>
            <td class="komparasi-num">Rp ${nilaiLalu.toLocaleString('id-ID')}</td>
            <td class="komparasi-num">Rp ${nilaiSekarang.toLocaleString('id-ID')}</td>
            <td class="komparasi-num">Rp ${selisih.toLocaleString('id-ID')}</td>
            <td class="komparasi-num"><span class="${warnaPersenClass}">${tandaPlus}${persen.toFixed(1)}%</span></td>
        </tr>
    `;
}

async function loadLaporanKomparasi() {
    const tahun = Number(document.getElementById('kompTahun').value);
    const bulan = Number(document.getElementById('kompBulan').value);

    if (!tahun || bulan < 1 || bulan > 12) {
        alert('Isi tahun dan bulan (1-12) dengan benar.');
        return;
    }

    try {
        const fd = new FormData();
        fd.append('action', 'getSnapshotLaporan');
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.snapshots) {
            snapshotLaporanGlobal = result.snapshots;
        }
    } catch (err) {
        console.error("Gagal ambil snapshot:", err);
    }

    const bulanNama = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][bulan - 1];
    const dataIni = snapshotLaporanGlobal.bulanan.find(b => b.tahun === tahun && b.bulan_num === bulan);
    const dataLalu = snapshotLaporanGlobal.bulanan.find(b =>
        b.tahun === (bulan === 1 ? tahun - 1 : tahun) && b.bulan_num === (bulan === 1 ? 12 : bulan - 1)
    );
    const dataTahunLalu = snapshotLaporanGlobal.bulanan.find(b =>
        b.tahun === (tahun - 1) && b.bulan_num === bulan
    );

    if (!dataIni) {
        alert('Tidak ada data untuk bulan ' + bulanNama + ' ' + tahun + '. Mungkin belum ada snapshot, atau periode belum selesai.');
        return;
    }

    const tableMoM = document.getElementById('tableMoM');
    let htmlMoM = '';
    const metrik = ['Pendapatan', 'Beban', 'Laba Bersih', 'Kas Total', 'Aset', 'Kewajiban', 'Modal'];
    const key = ['pendapatan', 'beban', 'laba_bersih', 'kas_total', 'aset', 'kewajiban', 'modal'];
    for (let i = 0; i < metrik.length; i++) {
        htmlMoM += barisMoMYoY(metrik[i],
            dataLalu ? (dataLalu[key[i]] || 0) : 0,
            dataIni[key[i]] || 0
        );
    }
    tableMoM.innerHTML = htmlMoM;

    const tableYoY = document.getElementById('tableYoY');
    let htmlYoY = '';
    for (let i = 0; i < metrik.length; i++) {
        htmlYoY += barisMoMYoY(metrik[i],
            dataTahunLalu ? (dataTahunLalu[key[i]] || 0) : 0,
            dataIni[key[i]] || 0
        );
    }
    tableYoY.innerHTML = htmlYoY;

    let validasi = '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">';
    let statusList = [
        {
            label: 'Balance Sheet Seimbang?',
            cek: Math.abs(dataIni.aset - (dataIni.kewajiban + dataIni.modal)) < 5,
            pesan: `Aset: Rp ${dataIni.aset.toLocaleString('id-ID')} = Kewajiban Rp ${dataIni.kewajiban.toLocaleString('id-ID')} + Modal Rp ${dataIni.modal.toLocaleString('id-ID')}`
        },
        {
            label: 'P&L Konsisten?',
            cek: dataIni.laba_bersih === (dataIni.pendapatan - dataIni.beban),
            pesan: `Laba: Rp ${dataIni.laba_bersih.toLocaleString('id-ID')} = Pendapatan - Beban`
        },
        {
            label: 'Kas Operasional Sehat?',
            cek: dataIni.kas_ops >= 0,
            pesan: `Kas dari operasi: Rp ${dataIni.kas_ops.toLocaleString('id-ID')} (${dataIni.kas_ops >= 0 ? 'Positif ✓' : 'Negatif ⚠️'})`
        },
        {
            label: 'Tidak Ada Aset Negatif?',
            cek: dataIni.aset >= 0,
            pesan: `Total Aset: Rp ${dataIni.aset.toLocaleString('id-ID')}`
        }
    ];

    statusList.forEach(s => {
        let icon = s.cek ? '🟢' : '🔴';
        validasi += `<div style="background:${s.cek ? '#dcfce7' : '#fee2e2'}; padding:10px; border-radius:8px; border-left:4px solid ${s.cek ? '#10b981' : '#ef4444'};">
            <div style="font-weight:700; color:${s.cek ? '#166534' : '#991b1b'}; margin-bottom:4px;">${icon} ${s.label}</div>
            <div style="font-size:11px; color:${s.cek ? '#065f46' : '#7f1d1d'};line-height:1.4;">${s.pesan}</div>
        </div>`;
    });
    validasi += '</div>';
    document.getElementById('validasiIntegritas').innerHTML = validasi;
}

async function simpanSignOffLaporan() {
    const tahun = Number(document.getElementById('kompTahun').value);
    const bulan = Number(document.getElementById('kompBulan').value);
    const nama = document.getElementById('signoffNama').value.trim();
    const catatan = document.getElementById('signoffCatatan').value.trim();

    if (!nama) {
        alert('Isi nama verifikator terlebih dahulu.');
        return;
    }

    const btn = event.target;
    const teksAsli = btn.innerText;
    btn.disabled = true;
    btn.innerText = '⏳ Menyimpan...';

    try {
        const fd = new FormData();
        fd.append('action', 'snapshotLaporanBulananSimpan');
        fd.append('tahun', tahun);
        fd.append('bulan', bulan);
        fd.append('verifikasiOleh', nama);
        fd.append('catatan', catatan);

        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();

        if (result.result === 'success') {
            const bulanNama = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][bulan - 1];
            alert(`✅ Laporan ${bulanNama} ${tahun} telah diverifikasi oleh ${nama}.\n\nPendapatan: Rp ${result.pendapatan.toLocaleString('id-ID')}\nBeban: Rp ${result.beban.toLocaleString('id-ID')}\nLaba Bersih: Rp ${result.laba_bersih.toLocaleString('id-ID')}`);
            document.getElementById('signoffNama').value = '';
            document.getElementById('signoffCatatan').value = '';
            loadLaporanKomparasi();
        } else {
            alert('❌ Gagal simpan: ' + (result.message || ''));
        }
    } catch (err) {
        alert('❌ Gagal (koneksi): ' + err);
    } finally {
        btn.disabled = false;
        btn.innerText = teksAsli;
    }
}

// Deteksi transaksi Pribadi/Rumah Tangga
function isTransaksiPribadi_(row) {
    let kategori = (row.kategori || '').toLowerCase();
    let nama = (row.nama || '').toLowerCase();
    return kategori.includes('pribadi') || nama.includes('pribadi');
}

// =========================================================================
// EXPORT PDF LAPORAN KEUANGAN — per bagian ATAU gabungan
// =========================================================================
async function tambahkanElemenKePdf_(pdf, elemen, judul, margin, mulaiHalamanBaru) {
    const lebarHalaman = pdf.internal.pageSize.getWidth();
    const tinggiHalaman = pdf.internal.pageSize.getHeight();

    const canvas = await html2canvas(elemen, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    const lebarGambar = lebarHalaman - (margin * 2);
    const rasioGambar = canvas.height / canvas.width;
    const tinggiGambar = lebarGambar * rasioGambar;

    if (mulaiHalamanBaru) pdf.addPage();

    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text(`Laporan Keuangan — ${judul}`, margin, margin + 5);
    pdf.setFontSize(9);
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(100);
    pdf.text(`Diekspor pada: ${new Date().toLocaleString('id-ID')}`, margin, margin + 11);
    pdf.setTextColor(0);

    let posisiY = margin + 16;
    const tinggiTersedia = tinggiHalaman - posisiY - margin;

    if (tinggiGambar <= tinggiTersedia) {
        pdf.addImage(imgData, 'JPEG', margin, posisiY, lebarGambar, tinggiGambar);
        return;
    }

    let sisaTinggiPx = canvas.height;
    let offsetYPx = 0;
    const tinggiPerHalamanPx = (tinggiTersedia / lebarGambar) * canvas.width;
    let bagianKe = 0;

    while (sisaTinggiPx > 0) {
        const tinggiPotonganPx = Math.min(tinggiPerHalamanPx, sisaTinggiPx);
        const canvasPotongan = document.createElement('canvas');
        canvasPotongan.width = canvas.width;
        canvasPotongan.height = tinggiPotonganPx;
        canvasPotongan.getContext('2d').drawImage(
            canvas, 0, offsetYPx, canvas.width, tinggiPotonganPx, 0, 0, canvas.width, tinggiPotonganPx
        );
        const imgPotongan = canvasPotongan.toDataURL('image/jpeg', 0.85);
        const tinggiPotonganMm = (tinggiPotonganPx / canvas.width) * lebarGambar;

        if (bagianKe > 0) { pdf.addPage(); posisiY = margin; }
        pdf.addImage(imgPotongan, 'JPEG', margin, posisiY, lebarGambar, tinggiPotonganMm);

        offsetYPx += tinggiPotonganPx;
        sisaTinggiPx -= tinggiPotonganPx;
        bagianKe++;
    }
}

async function exportSatuBagianKeuanganPDF(subTabId, judulBagian, btnEl) {
    const elemen = document.getElementById(subTabId);
    if (!elemen) { alert('Bagian tidak ditemukan: ' + subTabId); return; }

    const daftarSemuaSubTab = ['subJurnal', 'subLabaRugi', 'subArusKas', 'subNeraca', 'subDecisions', 'subDupont', 'subEkuitas', 'subCostStructure', 'subKomparasi', 'subTrenBulanan'];
    let subTabAktifSaatIni = null;
    daftarSemuaSubTab.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.style.display !== 'none') subTabAktifSaatIni = id;
    });

    const teksAsli = btnEl ? btnEl.innerText : '';
    if (btnEl) { btnEl.disabled = true; btnEl.innerText = '⏳...'; }

    try {
        daftarSemuaSubTab.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === subTabId) ? 'block' : 'none';
        });
        await new Promise(resolve => setTimeout(resolve, 200));

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        await tambahkanElemenKePdf_(pdf, elemen, judulBagian, 10, false);

        const namaFile = `Laporan_Keuangan_${judulBagian.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(namaFile);
    } catch (err) {
        console.error('Gagal export PDF:', err);
        alert('❌ Gagal membuat PDF: ' + err.message);
    } finally {
        daftarSemuaSubTab.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (id === subTabAktifSaatIni) ? 'block' : 'none';
        });
        if (btnEl) { btnEl.disabled = false; btnEl.innerText = teksAsli; }
    }
}

async function exportLaporanKeuanganLengkapPDF() {
    const daftarSubTab = [
        { id: 'subJurnal', judul: 'Jurnal (Buku Besar)' },
        { id: 'subLabaRugi', judul: 'Laba Rugi (Income Statement)' },
        { id: 'subArusKas', judul: 'Arus Kas (Cash Statement)' },
        { id: 'subNeraca', judul: 'Neraca (Balance Sheet)' },
        { id: 'subDecisions', judul: 'Decisions - Activities - Numbers' },
        { id: 'subDupont', judul: 'Analisis DuPont' },
        { id: 'subEkuitas', judul: 'Ekuitas & Kesiapan Investor' },
        { id: 'subCostStructure', judul: 'Cost Structure & Anggaran Biaya' },
        { id: 'subKomparasi', judul: 'Komparasi & Sign-Off' },
        { id: 'subTrenBulanan', judul: 'Tren Bulanan & Mingguan per Akun' }
    ];

    const btn = document.getElementById('btnExportPdfKeuangan');
    const teksAsliBtn = btn.innerText;
    btn.disabled = true;

    let subTabAktifSaatIni = null;
    daftarSubTab.forEach(s => {
        const el = document.getElementById(s.id);
        if (el && el.style.display !== 'none') subTabAktifSaatIni = s.id;
    });

    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        let halamanKe = 0;

        for (const sub of daftarSubTab) {
            const elSub = document.getElementById(sub.id);
            if (!elSub) continue;

            btn.innerText = `⏳ Memproses: ${sub.judul}...`;

            daftarSubTab.forEach(s2 => {
                const el2 = document.getElementById(s2.id);
                if (el2) el2.style.display = (s2.id === sub.id) ? 'block' : 'none';
            });
            await new Promise(resolve => setTimeout(resolve, 200));

            await tambahkanElemenKePdf_(pdf, elSub, sub.judul, 10, halamanKe > 0);
            halamanKe++;
        }

        const namaFile = `Laporan_Keuangan_Lengkap_${new Date().toISOString().split('T')[0]}.pdf`;
        pdf.save(namaFile);
    } catch (err) {
        console.error('Gagal export PDF:', err);
        alert('❌ Gagal membuat PDF: ' + err.message);
    } finally {
        daftarSubTab.forEach(s => {
            const el = document.getElementById(s.id);
            if (el) el.style.display = (s.id === subTabAktifSaatIni) ? 'block' : 'none';
        });
        btn.disabled = false;
        btn.innerText = teksAsliBtn;
    }
}

// =========================================================================
// ROSETTA STONE — kamus skenario transaksi -> jurnal (SOP PSAK EMKM + Profit First)
// =========================================================================
const ROSETTA_SOP = [
  ["Klien bayar DP", "111 Kas/Bank", "411 DP Sesi Foto", "Nominal DP diterima"],
  ["Klien pelunasan", "111 Kas/Bank", "410 Pelunasan Sesi Foto", "Sisa yang dibayar"],
  ["Bayar lunas di muka (cash)", "111 Kas/Bank", "410/411 Pendapatan", "Nominal penuh"],
  ["Piutang diakui (jasa selesai, belum dibayar)", "112 Piutang Usaha", "410 Pendapatan", "Sisa belum dibayar"],
  ["Piutang dilunasi", "111 Kas/Bank", "112 Piutang Usaha", "Nominal pelunasan"],
  ["Beli beban habis pakai (props, edit, bensin)", "5xx Beban", "111 Kas/Bank", "Nominal beban"],
  ["Beli aset (kamera, kendaraan) tunai", "1xx Aset Tetap", "111 Kas/Bank", "Harga beli"],
  ["Beli aset lewat hutang/cicilan", "1xx Aset Tetap", "21x Hutang Usaha", "Harga penuh"],
  ["Bayar cicilan hutang (pokok saja)", "21x Hutang", "111 Kas/Bank", "Nominal cicilan"],
  ["Bayar cicilan + bunga", "21x Hutang (pokok) & 5xx Beban Bunga (bunga)", "111 Kas/Bank", "Pokok + bunga, WAJIB dipisah baris"],
  ["Penyusutan aset tiap bulan", "5xx Beban Penyusutan", "1xx Akumulasi Penyusutan", "Harga/umur ekonomis ÷ 12"],
  ["Modal masuk dari pemilik", "111 Kas/Bank", "310 Modal Pemilik", "Nominal setoran"],
  ["Prive (tarik uang bisnis utk pribadi)", "350 Prive", "111 Kas/Bank Bisnis", "Nominal ditarik"],
  ["Alokasi Profit First — Profit", "111 Kas Cadangan Profit", "111 Kas Operasional", "% TAP Profit x pendapatan masuk"],
  ["Alokasi Profit First — Owner's Compensation", "111 Kas Gaji Pemilik", "111 Kas Operasional", "% TAP Owner's Comp"],
  ["Alokasi Profit First — Tax", "111 Kas Cadangan Pajak", "111 Kas Operasional", "% TAP Tax"],
  ["Transaksi ditandai Pribadi", "1xx/2xx berkategori 'Pribadi'", "111 Kas/Bank (kategori 'Pribadi')", "Dikecualikan dari P&L, Arus Kas & Neraca bisnis"],
  ["Setoran modal saham dari investor", "111 Kas/Bank", "310 Modal Saham + 311 Agio Saham (jika ada premium)", "Nominal setoran = jumlah lembar x harga per lembar"],
];

function renderRosettaStone() {
  const el = document.getElementById('rsBody');
  if (!el) return;
  const q = (document.getElementById('rsSearch')?.value || '').toLowerCase();
  const rows = ROSETTA_SOP.filter(r => r.join(' ').toLowerCase().includes(q));
  el.innerHTML = rows.map(r => `
    <tr>
      <td>${r[0]}</td>
      <td class="rs-debit">${r[1]}</td>
      <td class="rs-kredit">${r[2]}</td>
      <td>${r[3]}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center;padding:18px;color:#94a3b8;">Tidak ada skenario yang cocok.</td></tr>';
}

// =========================================================================
// AUDIT SOP OTOMATIS
// =========================================================================
const KATA_KUNCI_ASET = ['kamera','kendaraan','motor','mobil','laptop','drone','lighting','lensa','tripod','komputer','printer','genset','ac ','studio background'];
const KATA_KUNCI_BEBAN_RUTIN = ['bensin','konsumsi','sewa bulanan','jasa edit','listrik','internet','gaji','props','cetak','langganan'];
const AMBANG_ASET_RP = 1000000;
const AMBANG_BUKTI_RP = 1000000;
const AMBANG_PIUTANG_HARI = 90;

function jalankanAuditSOP() {
  if (!Array.isArray(dataJurnalGlobal)) { alert('Data jurnal belum dimuat.'); return; }
  const temuan = [];
  const mapClientByKode = {};
  (Array.isArray(dataGlobal) ? dataGlobal : []).forEach(c => { if (c.kode_leads) mapClientByKode[c.kode_leads] = c; });

  dataJurnalGlobal.forEach(row => {
    if (row.ref_tahap_bayar === 'DP' && Number(row.kredit) > 0) {
      const client = mapClientByKode[row.ref_kode_leads];
      if (client && Number(client.total) > 0 && Number(row.kredit) >= Number(client.total) && Number(client.jml_bayar2 || 0) === 0) {
        temuan.push({ level: 'kritis', judul: `DP tercatat sebesar TOTAL HARGA PENUH — ${row.nama || client.nama}`,
          detail: `Jurnal "${row.id}" (${row.tgl}) mencatat DP Rp ${Number(row.kredit).toLocaleString('id-ID')} = total harga klien Rp ${Number(client.total).toLocaleString('id-ID')}. Menurut SOP, saat DP hanya nominal DP yang boleh diakui sebagai pendapatan; sisanya harus jadi Piutang (112).` });
      }
    }
  });

  dataJurnalGlobal.forEach(row => {
    const nama = (row.nama || '').toLowerCase();
    const kode = (row.kode || '').toString().trim();
    const nominal = Math.max(Number(row.debit) || 0, Number(row.kredit) || 0);
    if (kode.startsWith('5') && KATA_KUNCI_ASET.some(k => nama.includes(k)) && nominal >= AMBANG_ASET_RP) {
      temuan.push({ level: 'peringatan', judul: `Kemungkinan salah kode: Beban tapi mirip Aset Tetap — "${row.nama}"`,
        detail: `Jurnal "${row.id}" (${row.tgl}), Rp ${nominal.toLocaleString('id-ID')}, dicatat sebagai Beban (kode ${kode}). Cek apakah seharusnya kode 1xx (Aset Tetap) + dijadwalkan penyusutan bulanan.` });
    }
    if (kode.startsWith('1') && KATA_KUNCI_BEBAN_RUTIN.some(k => nama.includes(k))) {
      temuan.push({ level: 'peringatan', judul: `Kemungkinan salah kode: Aset tapi mirip Beban Rutin — "${row.nama}"`,
        detail: `Jurnal "${row.id}" (${row.tgl}) dicatat sebagai Aset (kode ${kode}) tapi mengandung kata beban habis pakai. Cek apakah seharusnya kode 5xx.` });
    }
  });

  const piutangByRef = {};
  dataJurnalGlobal.forEach(row => {
    const kode = (row.kode || '').toString().trim();
    if (!kode.startsWith('112')) return;
    const ref = row.ref_kode_leads || row.desc || row.id;
    if (!piutangByRef[ref]) piutangByRef[ref] = { saldo: 0, tglAwal: row.tgl, nama: row.nama, desc: row.desc };
    piutangByRef[ref].saldo += (Number(row.debit) || 0) - (Number(row.kredit) || 0);
    if (new Date(row.tgl) < new Date(piutangByRef[ref].tglAwal)) piutangByRef[ref].tglAwal = row.tgl;
  });
  const hariIni = new Date();
  Object.keys(piutangByRef).forEach(ref => {
    const item = piutangByRef[ref];
    if (item.saldo <= 0) return;
    const umurHari = Math.floor((hariIni - new Date(item.tglAwal)) / 86400000);
    if (umurHari >= AMBANG_PIUTANG_HARI) {
      temuan.push({ level: 'kritis', judul: `Piutang menua ${umurHari} hari — ${item.desc || item.nama}`,
        detail: `Saldo piutang Rp ${item.saldo.toLocaleString('id-ID')} sejak ${item.tglAwal}, sudah lewat ambang 90 hari.` });
    } else if (umurHari >= 60) {
      temuan.push({ level: 'peringatan', judul: `Piutang mendekati kritis (${umurHari} hari) — ${item.desc || item.nama}`,
        detail: `Saldo piutang Rp ${item.saldo.toLocaleString('id-ID')} sejak ${item.tglAwal}. Masuk kategori 61-90 hari.` });
    }
  });

  dataJurnalGlobal.forEach(row => {
    const nominal = Math.max(Number(row.debit) || 0, Number(row.kredit) || 0);
    if (row.sumber_entri === 'Manual' && nominal >= AMBANG_BUKTI_RP && !row.url_bukti) {
      temuan.push({ level: 'info', judul: `Transaksi besar tanpa bukti nota — ${row.nama}`,
        detail: `Jurnal "${row.id}" (${row.tgl}), Rp ${nominal.toLocaleString('id-ID')}, dicatat manual tanpa lampiran bukti.` });
    }
  });

  renderHasilAudit(temuan);
}

function renderHasilAudit(temuan) {
  const kritis = temuan.filter(t => t.level === 'kritis').length;
  const peringatan = temuan.filter(t => t.level === 'peringatan').length;
  const info = temuan.filter(t => t.level === 'info').length;

  const summaryBox = document.getElementById('auditSummaryBox');
  if (summaryBox) {
    summaryBox.innerHTML = `
      <div class="audit-kpi kritis"><div class="n">${kritis}</div><div class="l">🔴 Kritis</div></div>
      <div class="audit-kpi peringatan"><div class="n">${peringatan}</div><div class="l">🟡 Peringatan</div></div>
      <div class="audit-kpi info"><div class="n">${info}</div><div class="l">🔵 Info</div></div>
      <div class="audit-kpi aman"><div class="n">${temuan.length}</div><div class="l">Total Temuan</div></div>
    `;
  }

  const listEl = document.getElementById('auditHasilList');
  if (!listEl) return;
  if (temuan.length === 0) {
    listEl.innerHTML = `<div class="audit-item" style="border-left-color:#10b981;"><div class="judul">✅ Tidak ada temuan.</div><div class="detail">Semua transaksi yang dipindai sudah sesuai pola SOP.</div></div>`;
    return;
  }
  const urutan = { kritis: 0, peringatan: 1, info: 2 };
  temuan.sort((a, b) => urutan[a.level] - urutan[b.level]);
  listEl.innerHTML = temuan.map(t => `
    <div class="audit-item ${t.level}">
      <span class="audit-badge ${t.level}">${t.level === 'kritis' ? '🔴 KRITIS' : t.level === 'peringatan' ? '🟡 PERINGATAN' : '🔵 INFO'}</span>
      <div class="judul" style="display:inline;">${t.judul}</div>
      <div class="detail" style="margin-top:6px;">${t.detail}</div>
    </div>
  `).join('');
}

// =========================================================================
// PENDAMPING SOP SAAT INPUT JURNAL (live suggestion + validasi sebelum posting)
// =========================================================================
function cariSaranSOP_(teksAkunUtama, teksAkunPasangan) {
  const gabungan = ((teksAkunUtama || '') + ' ' + (teksAkunPasangan || '')).toLowerCase();
  let terbaik = null, skorTerbaik = 0;
  ROSETTA_SOP.forEach(r => {
    const kataKunci = (r[0] + ' ' + r[1] + ' ' + r[2]).toLowerCase().split(/\s+/);
    let skor = 0;
    kataKunci.forEach(k => { if (k.length > 3 && gabungan.includes(k)) skor++; });
    const kodeUtama = (teksAkunUtama || '').split('-')[0].trim();
    const kodeExpected = (r[1].match(/\d+/) || [])[0];
    if (kodeExpected && kodeUtama.startsWith(kodeExpected.substring(0, 2))) skor += 2;
    if (skor > skorTerbaik) { skorTerbaik = skor; terbaik = r; }
  });
  return skorTerbaik >= 2 ? terbaik : null;
}

function renderKotakSaranSOP_() {
  const boxId = 'sopLiveSuggestionBox';
  let box = document.getElementById(boxId);
  const formArea = document.getElementById('jAkunPasangan')?.closest('.form-grid');
  if (!box && formArea) {
    box = document.createElement('div');
    box.id = boxId;
    box.style.cssText = 'grid-column:1/-1; margin-top:4px; padding:12px 16px; border-radius:8px; font-size:12.5px; line-height:1.6; display:none;';
    formArea.appendChild(box);
  }
  return box;
}

function perbaruiSaranSOPLive_() {
  const box = renderKotakSaranSOP_();
  if (!box) return;
  const utama = document.getElementById('jAkunUtama')?.value || '';
  const pasangan = document.getElementById('jAkunPasangan')?.value || '';
  if (!utama && !pasangan) { box.style.display = 'none'; return; }

  const saran = cariSaranSOP_(utama, pasangan);
  if (!saran) { box.style.display = 'none'; return; }

  box.style.display = 'block';
  box.style.background = '#eef2ff';
  box.style.border = '1px solid #c7d2fe';
  box.style.color = '#3730a3';
  box.innerHTML = `💡 <strong>Saran SOP — pola terdeteksi: "${saran[0]}"</strong><br>
    Debit seharusnya <b style="color:#059669;">${saran[1]}</b>, Kredit seharusnya <b style="color:#dc2626;">${saran[2]}</b>.
    ${saran[3] ? '<br>Catatan nominal: ' + saran[3] : ''}`;
}

function pasangPendampingSOPInput_() {
  const utama = document.getElementById('jAkunUtama');
  const pasangan = document.getElementById('jAkunPasangan');
  if (utama) utama.addEventListener('input', perbaruiSaranSOPLive_);
  if (pasangan) pasangan.addEventListener('input', perbaruiSaranSOPLive_);
}

function cekSopSebelumPosting_(optUtama, optPasangan, nominal) {
  const peringatan = [];
  const kodeUtama = (optUtama.getAttribute('data-kode') || '').toString().trim();
  const kodePasangan = (optPasangan.getAttribute('data-kode') || '').toString().trim();
  const namaUtama = (optUtama.getAttribute('data-nama') || '').toLowerCase();
  const nom = Number(nominal) || 0;

  if (kodeUtama.startsWith('5') && KATA_KUNCI_ASET.some(k => namaUtama.includes(k)) && nom >= AMBANG_ASET_RP) {
    peringatan.push(`Akun "${optUtama.getAttribute('data-nama')}" dicatat sebagai Beban (${kodeUtama}), tapi kata "${KATA_KUNCI_ASET.find(k => namaUtama.includes(k))}" + nominal Rp ${nom.toLocaleString('id-ID')} biasanya Aset Tetap (kode 1xx). Yakin ini Beban?`);
  }
  if ((kodePasangan.startsWith('411') || kodePasangan.startsWith('410')) && nom > 0) {
    peringatan.push(`Ini akan tercatat sebagai pendapatan (${kodePasangan}) sebesar Rp ${nom.toLocaleString('id-ID')}. Kalau ini DP, pastikan nominalnya BUKAN total harga penuh — sisanya harus jadi Piutang (112).`);
  }
  const descEl = document.getElementById('jDesc');
  const desc = (descEl?.value || '').toLowerCase();
  if ((kodeUtama.startsWith('21') || kodePasangan.startsWith('21')) && desc.includes('cicilan') && !desc.includes('bunga')) {
    peringatan.push(`Deskripsi mengandung "cicilan" tapi tidak menyebut bunga. Kalau ada komponen bunga, harus dipisah sebagai baris Beban Bunga (5xx) tersendiri.`);
  }
  return peringatan;
}

// =========================================================================
// TREN BULANAN & MINGGUAN PER AKUN — versi terkelompok, collapsible, + chart
// =========================================================================
let trenModeAktif = 'bisnis';
let trenJenisAktif = 'labarugi';
let trenTampilanAktif = 'rupiah';
let trenPeriodeAktif = 'bulanan'; // 'bulanan' | 'mingguan'
let trenSectionTertutup = {};     // { 'pendapatan': true, ... } -> collapsible per kategori
let trenChartInstance = null;

function trenGantiTampilan(tampilan, btnEl) {
    trenTampilanAktif = tampilan;
    document.querySelectorAll('.tren-toggle-btn[data-tampilan]').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderTrenBulanan();
}
function trenGantiMode(mode, btnEl) {
    trenModeAktif = mode;
    document.querySelectorAll('.tren-toggle-btn[data-mode]').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderTrenBulanan();
}
function trenGantiJenis(jenis, btnEl) {
    trenJenisAktif = jenis;
    document.querySelectorAll('.tren-toggle-btn[data-jenis]').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    renderTrenBulanan();
}
function trenGantiPeriode(periode, btnEl) {
    trenPeriodeAktif = periode;
    document.querySelectorAll('.tren-toggle-btn[data-periode]').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    document.getElementById('trenMingguanEosBar').style.display = periode === 'mingguan' ? 'flex' : 'none';
    const boxBulan = document.getElementById('trenBulanRangeBox');
    if (boxBulan) boxBulan.style.display = periode === 'mingguan' ? 'none' : 'block';
    renderTrenBulanan();
}
function trenToggleSection(key) {
    trenSectionTertutup[key] = !trenSectionTertutup[key];
    renderTrenBulanan();
}

// --- Helper ISO Week: dapatkan nomor minggu (1-53) dan tahun-minggu suatu tanggal
function dapatkanIsoWeek_(tgl) {
    const d = new Date(Date.UTC(tgl.getFullYear(), tgl.getMonth(), tgl.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return { tahun: d.getUTCFullYear(), minggu: weekNo };
}
function labelMingguDariTanggal_(tgl) {
    const { tahun, minggu } = dapatkanIsoWeek_(tgl);
    return `M${minggu}`;
}
// Senin awal minggu ISO ke-N di tahun tertentu (untuk quick filter EOS)
function tanggalAwalIsoWeek_(tahun, minggu) {
    const simple = new Date(Date.UTC(tahun, 0, 1 + (minggu - 1) * 7));
    const dow = simple.getUTCDay();
    const isoWeekStart = new Date(simple);
    if (dow <= 4) isoWeekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
    else isoWeekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
    return isoWeekStart;
}

// --- Filter cepat ala EOS (L10 weekly scorecard): Minggu Ini / Minggu Lalu / 4 Minggu Terakhir / 13 Minggu (Kuartal Rock)
function trenFilterEosCepat(jenisPreset) {
    const now = new Date();
    const { tahun: tahunSkrg, minggu: mingguSkrg } = dapatkanIsoWeek_(now);
    document.getElementById('trenTahun').value = tahunSkrg;
    trenPeriodeAktif = 'mingguan';
    document.querySelectorAll('.tren-toggle-btn[data-periode]').forEach(b => b.classList.toggle('active', b.dataset.periode === 'mingguan'));
    document.getElementById('trenMingguanEosBar').style.display = 'flex';

    document.querySelectorAll('.tren-eos-btn').forEach(b => b.classList.remove('active'));
    const btnAktif = document.querySelector(`.tren-eos-btn[data-preset="${jenisPreset}"]`);
    if (btnAktif) btnAktif.classList.add('active');

    // simpan rentang minggu yang ditandai untuk highlight kolom di tabel
    if (jenisPreset === 'minggu_ini') trenRentangMingguHighlight_ = { mulai: mingguSkrg, selesai: mingguSkrg };
    else if (jenisPreset === 'minggu_lalu') trenRentangMingguHighlight_ = { mulai: mingguSkrg - 1, selesai: mingguSkrg - 1 };
    else if (jenisPreset === '4_minggu') trenRentangMingguHighlight_ = { mulai: mingguSkrg - 3, selesai: mingguSkrg };
    else if (jenisPreset === '13_minggu') trenRentangMingguHighlight_ = { mulai: mingguSkrg - 12, selesai: mingguSkrg };
    else trenRentangMingguHighlight_ = null;

    renderTrenBulanan();
}
let trenRentangMingguHighlight_ = null;
let trenBulanRange_ = null; // { mulai: 1-12, selesai: 1-12 } -- filter manual rentang bulan utk mode Bulanan

// Ganti rentang bulan yang ditampilkan di tabel Tren Bulanan (mode 'bulanan').
// Kosongkan salah satu / keduanya untuk kembali ke mode otomatis (hanya
// tampilkan bulan yang ada datanya).
function trenTerapkanRentangBulan() {
    const dariEl = document.getElementById('trenBulanDari');
    const sampaiEl = document.getElementById('trenBulanSampai');
    const dari = dariEl ? Number(dariEl.value) : 0;
    const sampai = sampaiEl ? Number(sampaiEl.value) : 0;
    if (dari && sampai) {
        trenBulanRange_ = { mulai: Math.min(dari, sampai), selesai: Math.max(dari, sampai) };
    } else {
        trenBulanRange_ = null;
    }
    renderTrenBulanan();
}
function trenResetRentangBulan() {
    trenBulanRange_ = null;
    const dariEl = document.getElementById('trenBulanDari');
    const sampaiEl = document.getElementById('trenBulanSampai');
    if (dariEl) dariEl.value = '';
    if (sampaiEl) sampaiEl.value = '';
    renderTrenBulanan();
}

// Label tanggal untuk kolom minggu di tabel Tren Bulanan/Mingguan,
// contoh: "1-7 Sep" -- supaya "M32" tidak membingungkan.
function labelTanggalMingguKe_(tahun, mingguKe1based) {
    try {
        const awal = tanggalAwalIsoWeek_(tahun, mingguKe1based);
        const akhir = new Date(awal); akhir.setUTCDate(awal.getUTCDate() + 6);
        const namaBulanSingkat = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        const lblAwal = awal.getUTCDate() + ' ' + namaBulanSingkat[awal.getUTCMonth()];
        const lblAkhir = akhir.getUTCDate() + ' ' + namaBulanSingkat[akhir.getUTCMonth()];
        return lblAwal + '-' + lblAkhir;
    } catch (e) {
        return 'M' + mingguKe1based;
    }
}

// Hitung matrix TERKELOMPOK per section, bisa per BULAN (12 kolom) atau per MINGGU (kolom dinamis 1..53)
function hitungMatrixPeriodeTerkelompok_(tahun, mode, jenis, periode) {
    let sectionsConfig;
    if (jenis === 'labarugi') {
        sectionsConfig = [
            { key: 'pendapatan', label: '📈 Pendapatan (Sales)', className: 'tren-section-pendapatan' },
            { key: 'beban', label: '📉 Beban (Expenses)', className: 'tren-section-beban' }
        ];
    } else {
        sectionsConfig = [
            { key: 'operasional', label: '⚙️ Aktivitas Operasional', className: 'tren-section-operasional' },
            { key: 'investasi', label: '🏗️ Aktivitas Investasi', className: 'tren-section-investasi' },
            { key: 'pendanaan', label: '🏦 Aktivitas Pendanaan', className: 'tren-section-pendanaan' }
        ];
    }

    const jumlahKolom = periode === 'mingguan' ? 53 : 12;
    const sections = sectionsConfig.map(s => ({ ...s, akunMap: {}, totalPerKolom: new Array(jumlahKolom).fill(0) }));

    const filtered = dataJurnalGlobal.filter(r => {
        if (!r.tgl) return false;
        const d = new Date(r.tgl);
        if (isNaN(d.getTime())) return false;
        const { tahun: tahunIso } = periode === 'mingguan' ? dapatkanIsoWeek_(d) : { tahun: d.getFullYear() };
        const tahunBanding = periode === 'mingguan' ? tahunIso : d.getFullYear();
        if (tahunBanding !== tahun) return false;
        const pribadi = isTransaksiPribadi_(r);
        return mode === 'pribadi' ? pribadi : !pribadi;
    });

    filtered.forEach(r => {
        const d = new Date(r.tgl);
        const kolomIdx = periode === 'mingguan' ? (dapatkanIsoWeek_(d).minggu - 1) : d.getMonth();
        if (kolomIdx < 0 || kolomIdx >= jumlahKolom) return;

        const kode = (r.kode || '').toString().trim();
        const kategori = (r.kategori || '').toLowerCase();
        const namaAkun = (r.nama || '').toLowerCase();
        const tipe = (r.tipe || '').toLowerCase();
        const deb = Number(r.debit) || 0, kre = Number(r.kredit) || 0;

        let sectionKey = null, nilai = 0;

        if (jenis === 'labarugi') {
            const isRevenue = kode.startsWith('4') || kode.startsWith('7') || kategori.includes('pendapatan');
            const isExpense = kode.startsWith('5') || kode.startsWith('8') || kategori.includes('beban') || kategori.includes('biaya');
            if (isRevenue) { sectionKey = 'pendapatan'; nilai = kre - deb; }
            else if (isExpense) { sectionKey = 'beban'; nilai = deb - kre; }
        } else {
            if (kode.startsWith('1') || namaAkun.includes('kas') || namaAkun.includes('bank')) {
                nilai = deb - kre;
                if (tipe.includes('investasi')) sectionKey = 'investasi';
                else if (tipe.includes('pendanaan')) sectionKey = 'pendanaan';
                else sectionKey = 'operasional';
            }
        }

        if (!sectionKey) return;
        const section = sections.find(s => s.key === sectionKey);
        if (!section) return;

        const key = kode + ' - ' + (r.nama || '-');
        if (!section.akunMap[key]) section.akunMap[key] = { nama: r.nama || key, values: new Array(jumlahKolom).fill(0) };
        section.akunMap[key].values[kolomIdx] += nilai;
        section.totalPerKolom[kolomIdx] += nilai;
    });

    // Untuk mingguan: buang kolom minggu yang totalnya 0 di SEMUA section supaya tabel tidak 53 kolom kosong.
    // Untuk bulanan: kalau ada rentang bulan manual (trenBulanRange_), pakai itu; kalau tidak,
    // otomatis buang bulan yang datanya kosong supaya tidak selalu 12 kolom penuh.
    let kolomDipakai = Array.from({ length: jumlahKolom }, (_, i) => i);
    if (periode === 'mingguan') {
        kolomDipakai = kolomDipakai.filter(i => sections.some(s => s.totalPerKolom[i] !== 0) || (trenRentangMingguHighlight_ && (i + 1) >= trenRentangMingguHighlight_.mulai && (i + 1) <= trenRentangMingguHighlight_.selesai));
        if (kolomDipakai.length === 0) kolomDipakai = [new Date().getMonth()]; // fallback biar tidak kosong total
    } else {
        if (typeof trenBulanRange_ !== 'undefined' && trenBulanRange_ && trenBulanRange_.mulai && trenBulanRange_.selesai) {
            kolomDipakai = kolomDipakai.filter(i => (i + 1) >= trenBulanRange_.mulai && (i + 1) <= trenBulanRange_.selesai);
        } else {
            kolomDipakai = kolomDipakai.filter(i => sections.some(s => s.totalPerKolom[i] !== 0));
            if (kolomDipakai.length === 0) kolomDipakai = [new Date().getMonth()];
        }
    }

    return { sections, jenis, jumlahKolom, kolomDipakai };
}

function renderTrenBulanan() {
    const tahun = Number(document.getElementById('trenTahun').value) || new Date().getFullYear();
    const periode = trenPeriodeAktif;
    const { sections, jenis, kolomDipakai } = hitungMatrixPeriodeTerkelompok_(tahun, trenModeAktif, trenJenisAktif, periode);

    const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const labelKolom = periode === 'mingguan'
        ? kolomDipakai.map(i => labelTanggalMingguKe_(tahun, i + 1))
        : kolomDipakai.map(i => namaBulan[i]);
    const indeksAsli = kolomDipakai; // index asli di array 53/12 kolom

    // Total Sales per kolom (basis %) — selalu dari Laba Rugi biar konsisten
    let totalSalesPerKolom;
    if (jenis === 'labarugi') {
        const sectionPendapatan = sections.find(s => s.key === 'pendapatan');
        totalSalesPerKolom = indeksAsli.map(i => sectionPendapatan ? sectionPendapatan.totalPerKolom[i] : 0);
    } else {
        const { sections: sectionsLR } = hitungMatrixPeriodeTerkelompok_(tahun, trenModeAktif, 'labarugi', periode);
        const sectionPendapatan = sectionsLR.find(s => s.key === 'pendapatan');
        totalSalesPerKolom = indeksAsli.map(i => sectionPendapatan ? sectionPendapatan.totalPerKolom[i] : 0);
    }

    function formatNilaiSel_(nilai, posisiKolom) {
        if (trenTampilanAktif === 'persen') {
            const sales = totalSalesPerKolom[posisiKolom];
            if (!sales || sales === 0) return nilai === 0 ? '-' : '∞%';
            return (nilai / sales * 100).toFixed(1) + '%';
        }
        return nilai !== 0 ? 'Rp ' + nilai.toLocaleString('id-ID') : '-';
    }

    const theadEl = document.getElementById('theadTrenBulanan');
    theadEl.innerHTML = `<th>Akun</th>` + labelKolom.map((b, pos) => {
        const iAsli = indeksAsli[pos];
        const highlight = periode === 'mingguan' && trenRentangMingguHighlight_ && (iAsli + 1) >= trenRentangMingguHighlight_.mulai && (iAsli + 1) <= trenRentangMingguHighlight_.selesai;
        return `<th style="background:${highlight ? '#4338ca' : '#0f172a'};">${b}</th>`;
    }).join('') + `<th style="background:#0f172a;">Total</th>`;

    let adaData = sections.some(s => Object.keys(s.akunMap).length > 0);
    if (!adaData) {
        document.getElementById('tbodyTrenBulanan').innerHTML =
            `<tr><td colspan="${indeksAsli.length + 2}" style="text-align:center; padding:24px; color:#94a3b8; font-style:italic;">Tidak ada data untuk tahun ${tahun} pada kombinasi ini.</td></tr>`;
        document.getElementById('insightTrenBulanan').style.display = 'none';
        renderChartTrenBulanan_(null);
        return;
    }

    let html = '';
    const grandTotalPerKolom = new Array(indeksAsli.length).fill(0);

    sections.forEach(section => {
        const daftarAkun = Object.values(section.akunMap).map(a => ({
            nama: a.nama, values: indeksAsli.map(i => a.values[i]),
            total: indeksAsli.reduce((sum, i) => sum + a.values[i], 0)
        })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

        if (daftarAkun.length === 0) return;

        const tertutup = !!trenSectionTertutup[section.key];
        const subtotalPerKolom = indeksAsli.map(i => section.totalPerKolom[i]);

        html += `<tr class="tren-section-header ${section.className}" style="cursor:pointer;" onclick="trenToggleSection('${section.key}')">
            <td colspan="${indeksAsli.length + 2}">${tertutup ? '▶' : '▼'} ${section.label} <span style="opacity:.75; font-weight:400; font-size:10.5px;">(klik untuk ${tertutup ? 'buka' : 'tutup'})</span></td>
        </tr>`;

        if (!tertutup) {
            daftarAkun.forEach(akun => {
                const kolomBulan = akun.values.map((v, pos) => {
                    const kelas = v < 0 ? 'tren-nilai-neg' : (v > 0 ? 'tren-nilai-pos' : '');
                    return `<td class="${kelas}">${formatNilaiSel_(v, pos)}</td>`;
                }).join('');
                const kelasTotal = akun.total < 0 ? 'tren-nilai-neg' : 'tren-nilai-pos';
                html += `<tr><td>${akun.nama}</td>${kolomBulan}<td class="${kelasTotal}">Rp ${akun.total.toLocaleString('id-ID')}</td></tr>`;
            });
        }

        const subtotalKolomHtml = subtotalPerKolom.map((v, pos) => `<td>${formatNilaiSel_(v, pos)}</td>`).join('');
        const subtotalTotal = subtotalPerKolom.reduce((a, v) => a + v, 0);
        html += `<tr class="tren-subtotal-row"><td>Subtotal ${section.label.replace(/^[^\s]+\s/, '')}</td>${subtotalKolomHtml}<td>Rp ${subtotalTotal.toLocaleString('id-ID')}</td></tr>`;

        subtotalPerKolom.forEach((v, pos) => grandTotalPerKolom[pos] += (section.key === 'beban' ? -v : v));
    });

    const labelFinal = jenis === 'labarugi' ? '💎 LABA / RUGI BERSIH' : '💧 TOTAL ARUS KAS BERSIH';
    const grandTotalKolomHtml = grandTotalPerKolom.map((v, pos) => `<td>${formatNilaiSel_(v, pos)}</td>`).join('');
    const grandTotalKeseluruhan = grandTotalPerKolom.reduce((a, v) => a + v, 0);
    html += `<tr class="tren-final-row"><td>${labelFinal}</td>${grandTotalKolomHtml}<td>Rp ${grandTotalKeseluruhan.toLocaleString('id-ID')}</td></tr>`;

    document.getElementById('tbodyTrenBulanan').innerHTML = html;

    // Insight ringkas
    let idxTerbaik = 0, idxTerburuk = 0;
    grandTotalPerKolom.forEach((v, i) => {
        if (v > grandTotalPerKolom[idxTerbaik]) idxTerbaik = i;
        if (v < grandTotalPerKolom[idxTerburuk]) idxTerburuk = i;
    });
    const elInsight = document.getElementById('insightTrenBulanan');
    const labelMetrik = jenis === 'labarugi' ? 'Laba' : 'Arus Kas';
    const satuanPeriode = periode === 'mingguan' ? 'Minggu' : 'Bulan';
    elInsight.style.display = 'block';
    elInsight.innerHTML = `
        <div class="fin-insight-title">💡 Ringkasan Tren ${periode === 'mingguan' ? 'Mingguan' : 'Bulanan'} ${tahun}</div>
        <div class="fin-insight-item">🏆 ${satuanPeriode} terbaik: <strong>${labelKolom[idxTerbaik]}</strong> (${labelMetrik} Rp ${grandTotalPerKolom[idxTerbaik].toLocaleString('id-ID')})</div>
        <div class="fin-insight-item">⚠️ ${satuanPeriode} terlemah: <strong>${labelKolom[idxTerburuk]}</strong> (${labelMetrik} Rp ${grandTotalPerKolom[idxTerburuk].toLocaleString('id-ID')})</div>
        <div class="fin-insight-item">📊 Total ${labelMetrik} periode ini: <strong>Rp ${grandTotalKeseluruhan.toLocaleString('id-ID')}</strong></div>
    `;

    renderChartTrenBulanan_({ labelKolom, grandTotalPerKolom, labelMetrik });
}

function renderChartTrenBulanan_(data) {
    const canvas = document.getElementById('chartTrenBulanan');
    if (!canvas) return;
    if (trenChartInstance) { trenChartInstance.destroy(); trenChartInstance = null; }
    if (!data) return;

    const warnaBar = data.grandTotalPerKolom.map(v => v >= 0 ? 'rgba(16,185,129,0.75)' : 'rgba(239,68,68,0.75)');
    trenChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: data.labelKolom,
            datasets: [{
                label: data.labelMetrik,
                data: data.grandTotalPerKolom,
                backgroundColor: warnaBar,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => 'Rp ' + ctx.raw.toLocaleString('id-ID') } } },
            scales: { y: { ticks: { callback: (v) => 'Rp ' + Number(v).toLocaleString('id-ID') } } }
        }
    });
}

// =========================================================================
// INCOME STATEMENT LENGKAP (Sales, COGS: Beg Inv + Purchase - End Inv, Gross Profit, Expenses)
// =========================================================================
// Asumsi kode akun: 4xx = Sales/Pendapatan, 51x = Pembelian/Purchase bahan produksi
// (kategori mengandung "hpp"/"pembelian"/"cogs"), 113 = Persediaan (Inventory),
// 52xx+ = Expenses operasional lain. Kalau skema kode akun kamu beda, cukup
// sesuaikan filter kata kunci di bawah (KATA_KUNCI_PEMBELIAN / KATA_KUNCI_PERSEDIAAN).
const KATA_KUNCI_PEMBELIAN = ['pembelian', 'hpp', 'cogs', 'bahan baku', 'modal produksi'];
const KATA_KUNCI_PERSEDIAAN = ['persediaan', 'inventory', 'stok'];

function hitungIncomeStatementLengkap(dataJurnal) {
    if (!Array.isArray(dataJurnal)) return;

    let sales = 0, purchase = 0, expenses = 0;
    let beginningInv = 0, endingInv = 0; // dihitung dari saldo akun Persediaan sebelum & sesudah periode
    let rincianExpenses = [];

    const tglMulai = document.getElementById('filterTglMulai')?.value || '';
    const tglSelesai = document.getElementById('filterTglSelesai')?.value || '';

    // Beginning Inventory = saldo akun Persediaan SEBELUM tglMulai (semua histori)
    // Ending Inventory = saldo akun Persediaan SAMPAI tglSelesai (semua histori s/d akhir periode)
    if (Array.isArray(dataJurnalGlobal)) {
        dataJurnalGlobal.forEach(row => {
            const nama = (row.nama || '').toLowerCase();
            if (!KATA_KUNCI_PERSEDIAAN.some(k => nama.includes(k))) return;
            if (!row.tgl) return;
            const d = new Date(row.tgl);
            if (isNaN(d.getTime())) return;
            const rd = d.toISOString().split('T')[0];
            const deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
            if (tglMulai && rd < tglMulai) beginningInv += (deb - kre);
            if (!tglSelesai || rd <= tglSelesai) endingInv += (deb - kre);
        });
    }

    dataJurnal.forEach(row => {
        if (isTransaksiPribadi_(row)) return;
        const deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
        const kode = (row.kode || '').toString().trim();
        const kategori = (row.kategori || '').toLowerCase();
        const nama = (row.nama || '').toLowerCase();

        if (kode.startsWith('4') || kategori.includes('pendapatan')) {
            sales += (kre - deb);
        } else if (kode.startsWith('5') || kategori.includes('beban') || kategori.includes('biaya')) {
            const nilai = deb - kre;
            if (KATA_KUNCI_PEMBELIAN.some(k => kategori.includes(k) || nama.includes(k))) {
                purchase += nilai;
            } else {
                expenses += nilai;
                rincianExpenses.push({ nama: row.nama, kode, nilai });
            }
        }
    });

    const totalAvailableForSale = beginningInv + purchase;
    const cogs = totalAvailableForSale - endingInv;
    const grossProfit = sales - cogs;
    const netIncome = grossProfit - expenses;

    const set = (id, val, warna) => {
        const el = document.getElementById(id);
        if (el) { el.innerText = 'Rp ' + Math.round(val).toLocaleString('id-ID'); if (warna) el.style.color = warna; }
    };
    set('is_sales', sales);
    set('is_beginv', beginningInv);
    set('is_purchase', purchase);
    set('is_available', totalAvailableForSale);
    set('is_endinv', endingInv);
    set('is_cogs', cogs);
    set('is_grossprofit', grossProfit, grossProfit >= 0 ? '#059669' : '#dc2626');
    set('is_expenses', expenses);
    set('is_netincome', netIncome, netIncome >= 0 ? '#059669' : '#dc2626');

    const elMargin = document.getElementById('is_grossmargin');
    if (elMargin) elMargin.innerText = sales > 0 ? (grossProfit / sales * 100).toFixed(1) + '%' : '-';

    const tbodyExp = document.getElementById('is_rincian_expenses');
    if (tbodyExp) {
        tbodyExp.innerHTML = rincianExpenses.length > 0
            ? rincianExpenses.sort((a, b) => b.nilai - a.nilai).map(r => {
                let persenNilai = sales > 0 ? (r.nilai / sales * 100).toFixed(1) + '%' : '-';
                return `<tr><td>${r.kode} - ${r.nama}</td><td style="text-align:right;">Rp ${r.nilai.toLocaleString('id-ID')}</td><td style="text-align:right; color:#64748b;">${persenNilai}</td></tr>`;
            }).join('')
            : '<tr><td colspan="3" style="text-align:center; color:#94a3b8;">Tidak ada beban operasional pada periode ini.</td></tr>';
    }

    // Catatan SOP otomatis untuk Income Statement
    const elCatatan = document.getElementById('is_catatan_sop');
    if (elCatatan) {
        let catatan = grossProfit < 0
            ? 'Gross Profit negatif — HPP lebih besar dari penjualan. Cek harga jual paket vs biaya produksi aktual.'
            : (sales > 0 && (grossProfit / sales) < 0.4
                ? 'Gross Margin di bawah 40% — untuk bisnis jasa foto biasanya margin kotor sehat ada di atas 50-60%. Evaluasi harga paket atau biaya produksi.'
                : 'Gross Margin sehat. Pastikan Expenses operasional tetap terkendali supaya tidak menggerus Net Income.');
        elCatatan.innerHTML = '📘 <strong>Catatan SOP:</strong> ' + catatan;
    }
}

// =========================================================================
// CASH STATEMENT (format Rosetta Stone ala kampus: skedul Cash Flow bertahap)
// =========================================================================
function hitungCashStatementLengkap(dataJurnal) {
    if (!Array.isArray(dataJurnal)) return;
    let ocf = 0, icf = 0, fcf = 0;
    let rincianOps = [], rincianInv = [], rincianDan = [];

    dataJurnal.forEach(row => {
        if (isTransaksiPribadi_(row)) return;
        const deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
        const kode = (row.kode || '').toString().trim();
        const nama = (row.nama || '').toLowerCase();
        const tipe = (row.tipe || '').toLowerCase();
        if (!(kode.startsWith('1') || nama.includes('kas') || nama.includes('bank'))) return;

        const pergerakan = deb - kre;
        const item = { nama: row.nama, desc: row.desc, tgl: row.tgl, nilai: pergerakan };
        if (tipe.includes('investasi')) { icf += pergerakan; rincianInv.push(item); }
        else if (tipe.includes('pendanaan')) { fcf += pergerakan; rincianDan.push(item); }
        else { ocf += pergerakan; rincianOps.push(item); }
    });

    const netCash = ocf + icf + fcf;
    const set = (id, val, warna) => {
        const el = document.getElementById(id);
        if (el) { el.innerText = 'Rp ' + Math.round(val).toLocaleString('id-ID'); if (warna) el.style.color = warna; }
    };
    set('cs_ocf', ocf, ocf >= 0 ? '#059669' : '#dc2626');
    set('cs_icf', icf);
    set('cs_fcf', fcf);
    set('cs_net', netCash, netCash >= 0 ? '#059669' : '#dc2626');

    const renderSkedul = (id, list) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = list.length > 0
            ? list.map(r => `<tr><td>${formatTanggalManusia ? formatTanggalManusia(r.tgl) : r.tgl}</td><td>${r.nama}</td><td>${r.desc || '-'}</td><td style="text-align:right; color:${r.nilai >= 0 ? '#059669' : '#dc2626'};">${r.nilai >= 0 ? '+' : ''}Rp ${r.nilai.toLocaleString('id-ID')}</td></tr>`).join('')
            : '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Tidak ada mutasi.</td></tr>';
    };
    renderSkedul('cs_skedul_ops', rincianOps);
    renderSkedul('cs_skedul_inv', rincianInv);
    renderSkedul('cs_skedul_dan', rincianDan);

    const elCatatan = document.getElementById('cs_catatan_sop');
    if (elCatatan) {
        elCatatan.innerHTML = '📘 <strong>Catatan SOP:</strong> ' + (ocf < 0
            ? 'OCF (Operating Cash Flow) negatif — kas dari operasional harian lebih kecil dari yang dikeluarkan. Ini "pesan darurat", bahkan kalau Income Statement masih untung, karena Income Statement bisa untung di atas kertas (akrual) sementara kasnya belum masuk (piutang).'
            : 'OCF positif — bisnis mencetak kas riil dari kegiatan hariannya, fondasi paling sehat untuk menjalankan Profit First secara konsisten.');
    }
}

// =========================================================================
// SUB-MENU: DECISIONS / ACTIVITIES / NUMBERS (Profit & Cash impact log)
// Prinsip: Management -> Decisions -> Activities -> Numbers.
// Disimpan di localStorage per browser (ringan, tanpa perlu sheet baru).
// Kalau mau dipusatkan/dibagi ke tim, ini bisa dipindah ke Apps Script
// dengan pola doPost yang sama seperti fitur jurnal (lihat catatan di akhir file).
// =========================================================================
const LS_KEY_DECISIONS = 'financeai_decisions_log_v1';

function dlAmbilData_() {
    try { return JSON.parse(localStorage.getItem(LS_KEY_DECISIONS) || '[]'); } catch (e) { return []; }
}
function dlSimpanData_(arr) { localStorage.setItem(LS_KEY_DECISIONS, JSON.stringify(arr)); }

function dlTambahBaris() {
    const nama = document.getElementById('dlInputNama').value.trim();
    const profit = Number(document.getElementById('dlInputProfit').value) || 0;
    const cash = Number(document.getElementById('dlInputCash').value) || 0;
    const kategori = document.getElementById('dlInputKategori').value;
    if (!nama) { alert('Isi nama keputusan/aktivitas dulu.'); return; }

    const data = dlAmbilData_();
    data.push({ id: Date.now(), tgl: new Date().toISOString().split('T')[0], nama, kategori, profit, cash });
    dlSimpanData_(data);

    document.getElementById('dlInputNama').value = '';
    document.getElementById('dlInputProfit').value = '';
    document.getElementById('dlInputCash').value = '';
    renderDecisionsLog();
}

function dlHapusBaris(id) {
    if (!confirm('Hapus baris ini?')) return;
    dlSimpanData_(dlAmbilData_().filter(r => r.id !== id));
    renderDecisionsLog();
}

function renderDecisionsLog() {
    const tbody = document.getElementById('dlTableBody');
    if (!tbody) return;
    const data = dlAmbilData_();

    let kumulatifProfit = 0, kumulatifCash = 0;
    const rows = data.map(r => {
        kumulatifProfit += r.profit;
        kumulatifCash += r.cash;
        return `<tr>
            <td>${r.tgl}</td>
            <td>${r.nama} <span class="badge" style="background:#e0e7ff; color:#4338ca; font-size:10px;">${r.kategori}</span></td>
            <td style="text-align:right; color:${r.profit >= 0 ? '#059669' : '#dc2626'};">${r.profit >= 0 ? '+' : ''}${r.profit.toLocaleString('id-ID')}</td>
            <td style="text-align:right; color:${r.cash >= 0 ? '#059669' : '#dc2626'};">${r.cash >= 0 ? '+' : ''}${r.cash.toLocaleString('id-ID')}</td>
            <td style="text-align:right; font-weight:700;">${kumulatifProfit.toLocaleString('id-ID')}</td>
            <td style="text-align:right; font-weight:700;">${kumulatifCash.toLocaleString('id-ID')}</td>
            <td><button onclick="dlHapusBaris(${r.id})" style="border:none; background:#fee2e2; color:#991b1b; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:11px;">🗑️</button></td>
        </tr>`;
    }).join('');

    tbody.innerHTML = rows || '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:20px;">Belum ada keputusan/aktivitas yang dicatat. Tambahkan lewat form di atas.</td></tr>';

    const elEndProfit = document.getElementById('dlEndingProfit');
    const elEndCash = document.getElementById('dlEndingCash');
    if (elEndProfit) { elEndProfit.innerText = kumulatifProfit.toLocaleString('id-ID'); elEndProfit.style.color = kumulatifProfit >= 0 ? '#059669' : '#dc2626'; }
    if (elEndCash) { elEndCash.innerText = kumulatifCash.toLocaleString('id-ID'); elEndCash.style.color = kumulatifCash >= 0 ? '#059669' : '#dc2626'; }

    // Gap analysis: kalau Profit >> Cash, biasanya karena piutang/persediaan numpuk
    const elGap = document.getElementById('dlGapInsight');
    if (elGap) {
        const gap = kumulatifProfit - kumulatifCash;
        elGap.innerHTML = Math.abs(gap) < 1
            ? '✅ Profit dan Cash bergerak selaras — tidak ada "uang tertinggal di meja" yang signifikan.'
            : (gap > 0
                ? `⚠️ Ada gap Rp ${gap.toLocaleString('id-ID')}: Profit lebih besar dari Cash. Sesuai prinsip "Management → Decisions → Activities → Numbers", telusuri aktivitas mana yang mencatat untung di atas kertas tapi belum jadi uang tunai (piutang, persediaan menumpuk, dll).`
                : `ℹ️ Cash lebih besar dari Profit sebesar Rp ${Math.abs(gap).toLocaleString('id-ID')} — bisa jadi karena penerimaan DP/pendanaan yang belum sepenuhnya diakui sebagai laba.`);
    }
}

// =========================================================================
// ANALISIS DUPONT (ROE = Net Profit Margin x Asset Turnover x Equity Multiplier)
// =========================================================================
function hitungDupont(dataJurnal) {
    if (!Array.isArray(dataJurnal)) return;
    let pendapatan = 0, laba = 0, aset = 0, modal = 0;

    dataJurnal.forEach(row => {
        if (isTransaksiPribadi_(row)) return;
        const deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
        const kode = (row.kode || '').toString().trim();
        const kategori = (row.kategori || '').toLowerCase();
        if (kode.startsWith('4') || kategori.includes('pendapatan')) { pendapatan += (kre - deb); laba += (kre - deb); }
        else if (kode.startsWith('5') || kategori.includes('beban') || kategori.includes('biaya')) laba -= (deb - kre);
        if (kode.startsWith('1')) aset += (deb - kre);
        if (kode.startsWith('3')) modal += (kre - deb);
    });

    const totalEkuitas = modal + laba; // modal awal + laba berjalan periode ini (indikatif)
    const npm = pendapatan > 0 ? (laba / pendapatan) : 0;
    const assetTurnover = aset > 0 ? (pendapatan / aset) : 0;
    const equityMultiplier = totalEkuitas > 0 ? (aset / totalEkuitas) : 0;
    const roe = npm * assetTurnover * equityMultiplier;
    const roa = npm * assetTurnover;

    const setPct = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = (val * 100).toFixed(1) + '%'; };
    const setX = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val.toFixed(2) + 'x'; };
    setPct('dp_npm', npm);
    setX('dp_ato', assetTurnover);
    setX('dp_em', equityMultiplier);
    setPct('dp_roa', roa);
    setPct('dp_roe', roe);

    document.getElementById('dp_pendapatan') && (document.getElementById('dp_pendapatan').innerText = 'Rp ' + pendapatan.toLocaleString('id-ID'));
    document.getElementById('dp_laba') && (document.getElementById('dp_laba').innerText = 'Rp ' + laba.toLocaleString('id-ID'));
    document.getElementById('dp_aset') && (document.getElementById('dp_aset').innerText = 'Rp ' + aset.toLocaleString('id-ID'));
    document.getElementById('dp_ekuitas') && (document.getElementById('dp_ekuitas').innerText = 'Rp ' + totalEkuitas.toLocaleString('id-ID'));

    const elInterpretasi = document.getElementById('dp_interpretasi');
    if (elInterpretasi) {
        let bagianLemah = 'Net Profit Margin';
        let skorNpm = npm, skorAto = assetTurnover / 2, skorEm = equityMultiplier / 3; // dinormalisasi kasar untuk perbandingan visual
        if (skorAto < skorNpm && skorAto < skorEm) bagianLemah = 'Asset Turnover (efisiensi aset menghasilkan penjualan)';
        else if (skorEm < skorNpm && skorEm < skorAto) bagianLemah = 'Equity Multiplier (struktur permodalan)';

        elInterpretasi.innerHTML = `
            <div class="fin-insight-item">🔎 <strong>ROE ${(roe * 100).toFixed(1)}%</strong> = Net Profit Margin (${(npm * 100).toFixed(1)}%) × Asset Turnover (${assetTurnover.toFixed(2)}x) × Equity Multiplier (${equityMultiplier.toFixed(2)}x).</div>
            <div class="fin-insight-item">📘 <strong>Net Profit Margin</strong> — berapa persen dari tiap Rupiah penjualan yang jadi laba bersih. Naik/turunnya didorong oleh harga jual & efisiensi biaya (lihat Income Statement).</div>
            <div class="fin-insight-item">📘 <strong>Asset Turnover</strong> — seberapa efisien aset (kamera, kas, dll) "diputar" untuk menghasilkan penjualan. Rendah berarti banyak aset menganggur/kurang produktif.</div>
            <div class="fin-insight-item">📘 <strong>Equity Multiplier</strong> — seberapa besar aset dibiayai hutang vs modal sendiri. Tinggi berarti leverage (hutang) besar — bisa mendongkrak ROE, tapi juga menaikkan risiko.</div>
            <div class="fin-insight-item">🎯 <strong>Area yang paling perlu diperbaiki saat ini: ${bagianLemah}.</strong> Gunakan tombol "Analisis AI" di bawah untuk rekomendasi tindakan yang lebih spesifik.</div>
        `;
    }

    window._dupontTerakhir = { pendapatan, laba, aset, totalEkuitas, npm, assetTurnover, equityMultiplier, roe, roa };
}

async function jalankanAnalisisDupontGemini() {
    if (!window._dupontTerakhir) { alert('Hitung DuPont dulu (buka sub-tab ini agar terhitung otomatis).'); return; }
    const loadingEl = document.getElementById('dpGeminiLoading');
    const outEl = document.getElementById('dpGeminiOutput');
    loadingEl.style.display = 'block'; outEl.style.display = 'none';
    try {
        const fd = new FormData();
        fd.append('action', 'analisisAiGemini');
        fd.append('jenisAnalisis', 'dupont');
        fd.append('ringkasanJson', JSON.stringify(window._dupontTerakhir));
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        outEl.innerText = result.result === 'success' ? result.analisis : ('❌ Gagal: ' + (result.message || 'error tidak diketahui'));
    } catch (err) {
        outEl.innerText = '❌ Gagal koneksi: ' + err;
    } finally {
        loadingEl.style.display = 'none'; outEl.style.display = 'block';
    }
}

// =========================================================================
// EKUITAS & KESIAPAN INVESTOR (cap table sederhana, simulasi dilusi)
// =========================================================================
function ekHitungCapTable() {
    const lembarPemilik = Number(document.getElementById('ekLembarPemilik').value) || 0;
    const nilaiPerLembar = Number(document.getElementById('ekNilaiPerLembar').value) || 0;
    const persenDitawarkan = Number(document.getElementById('ekPersenDitawarkan').value) || 0;
    const valuasiPreMoney = Number(document.getElementById('ekValuasiPreMoney').value) || 0;

    if (lembarPemilik <= 0) { alert('Isi jumlah lembar saham pemilik dulu.'); return; }

    const modalPemilikSaatIni = lembarPemilik * nilaiPerLembar;
    // Simulasi round investasi baru:
    const lembarBaruUntukInvestor = persenDitawarkan > 0 && persenDitawarkan < 100
        ? Math.round((persenDitawarkan / (100 - persenDitawarkan)) * lembarPemilik)
        : 0;
    const totalLembarSetelahRound = lembarPemilik + lembarBaruUntukInvestor;
    const hargaPerLembarRound = totalLembarSetelahRound > 0 ? (valuasiPreMoney / lembarPemilik) : 0;
    const investasiMasuk = lembarBaruUntukInvestor * hargaPerLembarRound;
    const valuasiPostMoney = valuasiPreMoney + investasiMasuk;
    const persenPemilikSetelah = totalLembarSetelahRound > 0 ? (lembarPemilik / totalLembarSetelahRound * 100) : 100;

    const html = `
        <div class="kv"><span>Modal Pemilik saat ini (${lembarPemilik.toLocaleString('id-ID')} lembar × Rp ${nilaiPerLembar.toLocaleString('id-ID')})</span><b>Rp ${modalPemilikSaatIni.toLocaleString('id-ID')}</b></div>
        <div class="kv"><span>Valuasi Pre-Money (sebelum investor masuk)</span><b>Rp ${valuasiPreMoney.toLocaleString('id-ID')}</b></div>
        <div class="kv"><span>% saham ditawarkan ke investor</span><b>${persenDitawarkan}%</b></div>
        <div class="kv"><span>Lembar saham baru diterbitkan untuk investor</span><b>${lembarBaruUntukInvestor.toLocaleString('id-ID')} lembar</b></div>
        <div class="kv"><span>Harga per lembar saat round ini</span><b>Rp ${Math.round(hargaPerLembarRound).toLocaleString('id-ID')}</b></div>
        <div class="kv"><span>Dana investasi masuk (estimasi)</span><b style="color:#059669;">Rp ${Math.round(investasiMasuk).toLocaleString('id-ID')}</b></div>
        <div class="kv"><span>Valuasi Post-Money</span><b>Rp ${Math.round(valuasiPostMoney).toLocaleString('id-ID')}</b></div>
        <div class="kv"><span>Total lembar saham setelah round</span><b>${totalLembarSetelahRound.toLocaleString('id-ID')} lembar</b></div>
        <div class="kv" style="border-top:2px solid #0f172a; padding-top:10px; margin-top:6px;"><span><strong>Kepemilikan Pemilik SETELAH round ini</strong></span><b style="color:${persenPemilikSetelah >= 51 ? '#059669' : '#dc2626'};">${persenPemilikSetelah.toFixed(1)}%</b></div>
    `;
    document.getElementById('ekHasilSimulasi').innerHTML = html;

    const elCatatan = document.getElementById('ekCatatanSop');
    if (elCatatan) {
        elCatatan.innerHTML = '📘 <strong>Catatan kesiapan investor:</strong> ' + (persenPemilikSetelah < 51
            ? '⚠️ Kepemilikan pemilik turun di bawah 50% setelah round ini — kendali mayoritas berpindah. Pertimbangkan menawarkan persentase lebih kecil atau menaikkan valuasi pre-money (dengan basis Laba Bersih & pertumbuhan yang kuat dari Income Statement dan Tren Bulanan).'
            : 'Struktur kepemilikan pemilik masih mayoritas (≥51%) setelah round ini. Pastikan laporan Laba Rugi, Arus Kas, dan Neraca konsisten & terverifikasi (lihat sub-tab Komparasi & Sign-Off) sebelum due diligence investor.');
    }
}

// =========================================================================
// ANALISIS AKHIR AI (GEMINI) — umum (Laba Rugi/Arus Kas/Neraca periode aktif)
// =========================================================================
async function jalankanAnalisisGemini() {
    if (!Array.isArray(dataJurnalGlobal)) { alert('Data belum dimuat.'); return; }

    const tglMulai = document.getElementById('filterTglMulai')?.value || '';
    const tglSelesai = document.getElementById('filterTglSelesai')?.value || '';
    const dataPeriode = dataJurnalGlobal.filter(row => {
        if (!tglMulai && !tglSelesai) return true;
        if (!row.tgl) return false;
        const d = new Date(row.tgl);
        if (isNaN(d.getTime())) return false;
        const rowDate = d.toISOString().split('T')[0];
        if (tglMulai && rowDate < tglMulai) return false;
        if (tglSelesai && rowDate > tglSelesai) return false;
        return true;
    });

    let pendapatan = 0, beban = 0, kasOps = 0, kasInv = 0, kasDan = 0, aset = 0, hutang = 0, piutang = 0;
    dataPeriode.forEach(row => {
        if (isTransaksiPribadi_(row)) return;
        const deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
        const kode = (row.kode || '').toString().trim();
        const kategori = (row.kategori || '').toLowerCase();
        const nama = (row.nama || '').toLowerCase();
        if (kode.startsWith('4') || kategori.includes('pendapatan')) pendapatan += (kre - deb);
        else if (kode.startsWith('5') || kategori.includes('beban') || kategori.includes('biaya')) beban += (deb - kre);
        if (kode.startsWith('1') || nama.includes('kas') || nama.includes('bank')) {
            const pergerakan = deb - kre;
            const tipe = (row.tipe || '').toLowerCase();
            if (tipe.includes('investasi')) kasInv += pergerakan; else if (tipe.includes('pendanaan')) kasDan += pergerakan; else kasOps += pergerakan;
            aset += pergerakan;
        } else if (kode.startsWith('1')) aset += (deb - kre);
        if (kode.startsWith('2')) hutang += (kre - deb);
        if (kode.startsWith('112')) piutang += (deb - kre);
    });
    const laba = pendapatan - beban;
    const kasTotal = kasOps + kasInv + kasDan;
    const ringkasan = { pendapatan, beban, laba, kasOps, kasTotal, aset, hutang, piutang };

    const loadingEl = document.getElementById('geminiLoading');
    const outEl = document.getElementById('geminiOutput');
    loadingEl.style.display = 'block'; outEl.style.display = 'none';

    try {
        const fd = new FormData();
        fd.append('action', 'analisisAiGemini');
        fd.append('jenisAnalisis', 'umum');
        fd.append('ringkasanJson', JSON.stringify(ringkasan));
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        outEl.innerText = result.result === 'success' ? result.analisis : ('❌ Gagal: ' + (result.message || 'error tidak diketahui'));
    } catch (err) {
        outEl.innerText = '❌ Gagal koneksi: ' + err;
    } finally {
        loadingEl.style.display = 'none'; outEl.style.display = 'block';
    }
}

// =========================================================================
// HOOK: perluas terapkanFilter() & resetFilter() supaya Income Statement,
// Cash Statement, dan DuPont ikut ter-update setiap kali filter diterapkan
// tanpa perlu mengubah fungsi asli — kita "bungkus" (monkey-patch) di sini.
// =========================================================================
(function bungkusFilterUntukModulBaru_() {
    const asliTerapkanFilter = terapkanFilter;
    window.terapkanFilter = function () {
        asliTerapkanFilter.apply(this, arguments);
        const tglMulai = document.getElementById('filterTglMulai').value;
        const tglSelesai = document.getElementById('filterTglSelesai').value;
        const sembunyikanPribadi = document.getElementById('filterSembunyikanPribadi')?.checked || false;
        const dataFiltered = dataJurnalGlobal.filter(row => {
            if (sembunyikanPribadi && isTransaksiPribadi_(row)) return false;
            let rowDate = '';
            if (row.tgl) { const d = new Date(row.tgl); if (!isNaN(d.getTime())) rowDate = d.toISOString().split('T')[0]; }
            if (tglMulai && (!rowDate || rowDate < tglMulai)) return false;
            if (tglSelesai && (!rowDate || rowDate > tglSelesai)) return false;
            return true;
        });
        hitungIncomeStatementLengkap(dataFiltered);
        hitungCashStatementLengkap(dataFiltered);
        hitungDupont(dataFiltered);
    };

    const asliResetFilter = resetFilter;
    window.resetFilter = function () {
        asliResetFilter.apply(this, arguments);
        hitungIncomeStatementLengkap(dataJurnalGlobal);
        hitungCashStatementLengkap(dataJurnalGlobal);
        hitungDupont(dataJurnalGlobal);
    };
})();

// =========================================================================
// INISIALISASI SAAT HALAMAN SIAP
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    try { renderRosettaStone(); } catch (e) {}
    try { pasangPendampingSOPInput_(); } catch (e) {}
    try { renderDecisionsLog(); } catch (e) {}
});

// =========================================================================
// ROSETTA STONE — WORKSHEET TRANSAKSI (Assets = Liabilities + Equity per baris)
// =========================================================================
const KATA_KUNCI_PEMBELIAN_WS = KATA_KUNCI_PEMBELIAN; // reuse dari Income Statement

function klasifikasiKolomWorksheet_(row) {
    const kode = (row.kode || '').toString().trim();
    const nama = (row.nama || '').toLowerCase();
    const kategori = (row.kategori || '').toLowerCase();

    if (kode.startsWith('1')) {
        if (nama.includes('kas') || nama.includes('bank')) return 'cash';
        if (nama.includes('piutang')) return 'ar';
        if (nama.includes('persediaan') || nama.includes('inventory') || nama.includes('stok')) return 'inventory';
        return 'ppe';
    }
    if (kode.startsWith('2')) {
        if (nama.includes('pajak') || nama.includes('tax')) return 'taxpayable';
        if (nama.includes('bank') || nama.includes('pinjaman') || nama.includes('cicilan') || nama.includes('notes') || nama.includes('kredit')) return 'notespayable';
        return 'ap';
    }
    if (kode.startsWith('3')) {
        if (nama.includes('prive')) return 'retained';
        return 'commonstock';
    }
    if (kode.startsWith('4') || kategori.includes('pendapatan')) return 'retained';
    if (kode.startsWith('5') || kategori.includes('beban') || kategori.includes('biaya')) return 'retained';
    return null;
}

function nilaiEfekKolomWorksheet_(row, kolom) {
    const deb = Number(row.debit) || 0, kre = Number(row.kredit) || 0;
    if (['cash', 'ar', 'inventory', 'ppe'].includes(kolom)) return deb - kre;
    return kre - deb;
}

function kategoriNetIncomeWorksheet_(row) {
    const nama = (row.nama || '').toLowerCase();
    const kategori = (row.kategori || '').toLowerCase();
    const kode = (row.kode || '').toString().trim();
    if (kode.startsWith('4') || kategori.includes('pendapatan')) return 'revenue';
    if (KATA_KUNCI_PEMBELIAN_WS.some(k => nama.includes(k) || kategori.includes(k))) return 'cogs';
    if (nama.includes('bunga') || kategori.includes('bunga')) return 'interest';
    if (nama.includes('penyusutan') || nama.includes('depresiasi')) return 'depreciation';
    if (nama.includes('pajak') || kategori.includes('pajak')) return 'tax';
    return 'opex';
}

function tagOifWorksheet_(baris) {
    for (const r of baris) {
        const tipe = (r.tipe || '').toLowerCase();
        if (tipe.includes('investasi')) return 'I';
        if (tipe.includes('pendanaan')) return 'F';
    }
    if (baris.some(r => klasifikasiKolomWorksheet_(r) === 'ppe')) return 'I';
    if (baris.some(r => ['notespayable', 'commonstock'].includes(klasifikasiKolomWorksheet_(r)))) return 'F';
    return 'O';
}

const KOLOM_WORKSHEET = [
    { key: 'cash', label: 'Cash', grup: 'aset' },
    { key: 'ar', label: "Accts Rec'ble", grup: 'aset' },
    { key: 'inventory', label: 'Inventory', grup: 'aset' },
    { key: 'ppe', label: 'PPE (net)', grup: 'aset' },
    { key: 'ap', label: 'Accts Payable', grup: 'liab' },
    { key: 'taxpayable', label: 'Taxes Payable', grup: 'liab' },
    { key: 'notespayable', label: 'Notes Payable', grup: 'liab' },
    { key: 'commonstock', label: 'Common Stock', grup: 'ekuitas' },
    { key: 'retained', label: 'Retained Earning', grup: 'ekuitas' },
];

function renderRosettaStone() {
    const el = document.getElementById('rsBody');
    if (!el) return;
    const q = (document.getElementById('rsSearch')?.value || '').toLowerCase();
    const rows = ROSETTA_SOP.filter(r => r.join(' ').toLowerCase().includes(q));
    el.innerHTML = rows.map(r => `
        <tr><td>${r[0]}</td><td class="rs-debit">${r[1]}</td><td class="rs-kredit">${r[2]}</td><td>${r[3]}</td></tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;padding:18px;color:#94a3b8;">Tidak ada skenario yang cocok.</td></tr>';
}

// --- Kontrol periode worksheet (Semua / Bulanan / Mingguan) ---
let rwPeriodeAktif = 'semua';
let rwTahunPilih = new Date().getFullYear();
let rwBulanPilih = new Date().getMonth() + 1;
let rwMingguPilih = dapatkanIsoWeek_(new Date()).minggu;

function rwGantiPeriode(mode, btnEl) {
    rwPeriodeAktif = mode;
    document.querySelectorAll('.rw-periode-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    document.getElementById('rwBulanPicker').style.display = mode === 'bulanan' ? 'inline-block' : 'none';
    document.getElementById('rwMingguPicker').style.display = mode === 'mingguan' ? 'inline-block' : 'none';
    renderRosettaWorksheet();
}
function rwFilterEosCepat(jenisPreset) {
    const now = new Date();
    const { tahun, minggu } = dapatkanIsoWeek_(now);
    rwTahunPilih = tahun;
    document.getElementById('rwTahun').value = tahun;
    let mingguTarget = minggu;
    if (jenisPreset === 'minggu_lalu') mingguTarget = minggu - 1;
    rwMingguPilih = mingguTarget;
    document.getElementById('rwMinggu').value = mingguTarget;
    rwPeriodeAktif = 'mingguan';
    document.querySelectorAll('.rw-periode-btn').forEach(b => b.classList.toggle('active', b.dataset.periode === 'mingguan'));
    document.getElementById('rwBulanPicker').style.display = 'none';
    document.getElementById('rwMingguPicker').style.display = 'inline-block';
    document.querySelectorAll('.rw-eos-btn').forEach(b => b.classList.remove('active'));
    const btnAktif = document.querySelector(`.rw-eos-btn[data-preset="${jenisPreset}"]`);
    if (btnAktif) btnAktif.classList.add('active');
    renderRosettaWorksheet();
}
function rwTerapkanManual() {
    rwTahunPilih = Number(document.getElementById('rwTahun').value) || new Date().getFullYear();
    rwBulanPilih = Number(document.getElementById('rwBulan').value) || 1;
    rwMingguPilih = Number(document.getElementById('rwMinggu').value) || 1;
    document.querySelectorAll('.rw-eos-btn').forEach(b => b.classList.remove('active'));
    renderRosettaWorksheet();
}
function rwHitungRentangTanggal_() {
    if (rwPeriodeAktif === 'bulanan') {
        const d1 = new Date(rwTahunPilih, rwBulanPilih - 1, 1);
        const d2 = new Date(rwTahunPilih, rwBulanPilih, 0);
        return { mulai: d1.toISOString().split('T')[0], selesai: d2.toISOString().split('T')[0] };
    }
    if (rwPeriodeAktif === 'mingguan') {
        const d1 = tanggalAwalIsoWeek_(rwTahunPilih, rwMingguPilih);
        const d2 = new Date(d1); d2.setUTCDate(d1.getUTCDate() + 6);
        return { mulai: d1.toISOString().split('T')[0], selesai: d2.toISOString().split('T')[0] };
    }
    return null;
}


function amanTglIso_(val) {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
}

function renderRosettaWorksheet() {
    if (!Array.isArray(dataJurnalGlobal)) return;
    const rentangKhusus = rwHitungRentangTanggal_();
    const tglMulai = rentangKhusus ? rentangKhusus.mulai : (document.getElementById('filterTglMulai')?.value || '');
    const tglSelesai = rentangKhusus ? rentangKhusus.selesai : (document.getElementById('filterTglSelesai')?.value || '');

    const elLabelPeriode = document.getElementById('rwLabelPeriodeAktif');
    if (elLabelPeriode) {
        if (rwPeriodeAktif === 'bulanan') {
            const namaBulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][rwBulanPilih - 1];
            elLabelPeriode.innerText = `📅 Menampilkan: ${namaBulan} ${rwTahunPilih} (saldo Balance = akumulasi s.d. akhir bulan ini)`;
        } else if (rwPeriodeAktif === 'mingguan') {
            elLabelPeriode.innerText = `📅 Menampilkan: Minggu ke-${rwMingguPilih}, ${rwTahunPilih} (${tglMulai} s/d ${tglSelesai})`;
        } else {
            elLabelPeriode.innerText = `📅 Menampilkan: Semua transaksi s.d. ${tglSelesai || 'hari ini'} (ikut filter tanggal utama di atas)`;
        }
    }

    const dataDipakai = dataJurnalGlobal.filter(r => {
        if (isTransaksiPribadi_(r)) return false;
        if (!r.tgl) return true;
       if (tglSelesai) { const rd = amanTglIso_(r.tgl); if (rd && rd > tglSelesai) return false; }
        return true;
    });

    const grupById = {};
    const urutanId = [];
    dataDipakai.forEach(r => { if (!grupById[r.id]) { grupById[r.id] = []; urutanId.push(r.id); } grupById[r.id].push(r); });
    urutanId.sort((a, b) => new Date(grupById[a][0].tgl) - new Date(grupById[b][0].tgl));

    const balance = {}; KOLOM_WORKSHEET.forEach(k => balance[k.key] = 0);
    const netIncomeAkum = { revenue: 0, cogs: 0, opex: 0, interest: 0, depreciation: 0, tax: 0 };
    const netIncomePeriodeIni = { revenue: 0, cogs: 0, opex: 0, interest: 0, depreciation: 0, tax: 0 };
    let rowsHtml = ''; let adaTransaksiPeriodeIni = false;

    urutanId.forEach(id => {
        const baris = grupById[id];
        const efekPerKolom = {}; KOLOM_WORKSHEET.forEach(k => efekPerKolom[k.key] = 0);
        let deskripsi = baris[0].desc || baris[0].nama || id;
         const tglTransaksi = amanTglIso_(baris[0].tgl) || '0000-00-00';
        const isPeriodeIni = tglMulai ? (tglTransaksi >= tglMulai) : true;
        if (isPeriodeIni) adaTransaksiPeriodeIni = true;

        baris.forEach(r => {
            const kolom = klasifikasiKolomWorksheet_(r);
            if (!kolom) return;
            efekPerKolom[kolom] += nilaiEfekKolomWorksheet_(r, kolom);
            if (kolom === 'retained') {
                const kat = kategoriNetIncomeWorksheet_(r);
                const deb = Number(r.debit) || 0, kre = Number(r.kredit) || 0;
                const nilaiKat = kat === 'revenue' ? (kre - deb) : (deb - kre);
                if (kat === 'revenue') netIncomeAkum.revenue += nilaiKat; else netIncomeAkum[kat] += nilaiKat;
                if (isPeriodeIni) { if (kat === 'revenue') netIncomePeriodeIni.revenue += nilaiKat; else netIncomePeriodeIni[kat] += nilaiKat; }
            }
        });

        KOLOM_WORKSHEET.forEach(k => balance[k.key] += efekPerKolom[k.key]);
        if (rwPeriodeAktif !== 'semua' && !isPeriodeIni) return;

        const tag = tagOifWorksheet_(baris);
        const tagWarna = tag === 'O' ? '#2563eb' : tag === 'I' ? '#b45309' : '#6d28d9';
        rowsHtml += `<tr style="${isPeriodeIni ? '' : 'opacity:0.55;'}">
            <td style="text-align:left; font-weight:600;">${deskripsi} <span style="font-size:10px; color:${tagWarna}; font-weight:800; border:1px solid ${tagWarna}; border-radius:4px; padding:1px 5px; margin-left:4px;">${tag}</span></td>
            ${KOLOM_WORKSHEET.map(k => `<td class="${efekPerKolom[k.key] < 0 ? 'tren-nilai-neg' : (efekPerKolom[k.key] > 0 ? 'tren-nilai-pos' : '')}">${efekPerKolom[k.key] !== 0 ? efekPerKolom[k.key].toLocaleString('id-ID') : '-'}</td>`).join('')}
        </tr>`;
    });

    if (!adaTransaksiPeriodeIni && rwPeriodeAktif !== 'semua') {
        rowsHtml = `<tr><td colspan="${KOLOM_WORKSHEET.length + 1}" style="text-align:center; padding:20px; color:#94a3b8; font-style:italic;">Tidak ada transaksi pada periode ini.</td></tr>`;
    }

    const totalAset = balance.cash + balance.ar + balance.inventory + balance.ppe;
    const totalLiabEkuitas = balance.ap + balance.taxpayable + balance.notespayable + balance.commonstock + balance.retained;

    const theadEl = document.getElementById('theadRosettaWs');
    if (theadEl) theadEl.innerHTML = `<th style="text-align:left;">Transaction / Event</th>` + KOLOM_WORKSHEET.map(k => `<th style="background:${k.grup === 'aset' ? '#1d4ed8' : k.grup === 'liab' ? '#b45309' : '#047857'};">${k.label}</th>`).join('');

    const tbodyEl = document.getElementById('tbodyRosettaWs');
    if (tbodyEl) tbodyEl.innerHTML = rowsHtml + `<tr class="tren-final-row"><td>Balance ${tglSelesai ? ('s.d. ' + tglSelesai) : ''}</td>${KOLOM_WORKSHEET.map(k => `<td>${Math.round(balance[k.key]).toLocaleString('id-ID')}</td>`).join('')}</tr>`;

    const elCheck = document.getElementById('rwCheckBalance');
    if (elCheck) {
        const seimbang = Math.abs(totalAset - totalLiabEkuitas) < 5;
        elCheck.innerHTML = `
            <div class="kv"><span>Total Assets</span><b>Rp ${Math.round(totalAset).toLocaleString('id-ID')}</b></div>
            <div class="kv"><span>= Total Liabilities + Owner Equity</span><b>Rp ${Math.round(totalLiabEkuitas).toLocaleString('id-ID')}</b></div>
            <span class="fin-badge-status" style="background:${seimbang ? '#059669' : '#dc2626'}; margin-top:8px; display:inline-block;">${seimbang ? '✅ SEIMBANG' : '⚠️ TIDAK SEIMBANG'}</span>
        `;
    }

    const sumberNI = rwPeriodeAktif === 'semua' ? netIncomeAkum : netIncomePeriodeIni;
    const netIncome = sumberNI.revenue - sumberNI.cogs - sumberNI.opex - sumberNI.interest - sumberNI.depreciation - sumberNI.tax;
    const elNI = document.getElementById('rwNetIncomeBuild');
    if (elNI) {
        const b2 = (label, val) => `<div class="is-line sub"><span>${label}</span><span>${val < 0 ? '(' + Math.abs(Math.round(val)).toLocaleString('id-ID') + ')' : Math.round(val).toLocaleString('id-ID')}</span></div>`;
        elNI.innerHTML = `
            <div class="is-line"><span>Revenue</span><b>${Math.round(sumberNI.revenue).toLocaleString('id-ID')}</b></div>
            ${b2('− COGS', sumberNI.cogs)} ${b2('− Operating Expenses', sumberNI.opex)} ${b2('− Interest Expense', sumberNI.interest)}
            ${b2('− Depreciation', sumberNI.depreciation)} ${b2('− Tax Expense', sumberNI.tax)}
            <div class="is-line total"><span>Net Income (${rwPeriodeAktif === 'semua' ? 'kumulatif' : 'periode ini'})</span><b style="color:${netIncome >= 0 ? '#059669' : '#dc2626'};">${Math.round(netIncome).toLocaleString('id-ID')}</b></div>
        `;
    }

    let ocf = 0, icf = 0, fcf = 0;
   dataDipakai.forEach(r => {
        const tglTransaksi = amanTglIso_(r.tgl);
        if (!tglTransaksi) return;
        if (tglMulai && tglTransaksi < tglMulai) return;
        const kode = (r.kode || '').toString().trim();
        const nama = (r.nama || '').toLowerCase();
        if (!(kode.startsWith('1') && (nama.includes('kas') || nama.includes('bank')))) return;
        const pergerakan = (Number(r.debit) || 0) - (Number(r.kredit) || 0);
        const tipe = (r.tipe || '').toLowerCase();
        if (tipe.includes('investasi')) icf += pergerakan; else if (tipe.includes('pendanaan')) fcf += pergerakan; else ocf += pergerakan;
    });
    const elOif = document.getElementById('rwOifSummary');
    if (elOif) elOif.innerHTML = `
        <div class="kv"><span>OCF (periode ini)</span><b style="color:${ocf >= 0 ? '#059669' : '#dc2626'};">${Math.round(ocf).toLocaleString('id-ID')}</b></div>
        <div class="kv"><span>ICF (periode ini)</span><b>${Math.round(icf).toLocaleString('id-ID')}</b></div>
        <div class="kv"><span>FCF (periode ini)</span><b>${Math.round(fcf).toLocaleString('id-ID')}</b></div>
        <div class="kv" style="border-top:2px solid #0f172a; padding-top:8px; margin-top:4px;"><span><strong>Total Δ Cash</strong></span><b>${Math.round(ocf + icf + fcf).toLocaleString('id-ID')}</b></div>
    `;
}

(function sinkronRosettaKeTrenPeriode_() {
    const asliTrenGantiPeriode = window.trenGantiPeriode;
    window.trenGantiPeriode = function (periode, btnEl) {
        asliTrenGantiPeriode.apply(this, arguments);
        rwPeriodeAktif = periode === 'mingguan' ? 'mingguan' : 'semua';
        if (document.getElementById('rwTahun')) document.getElementById('rwTahun').value = document.getElementById('trenTahun').value;
        try { renderRosettaWorksheet(); } catch (e) {}
    };
    const asliTrenFilterEos = window.trenFilterEosCepat;
    window.trenFilterEosCepat = function (jenisPreset) {
        asliTrenFilterEos.apply(this, arguments);
        if (jenisPreset === 'minggu_ini' || jenisPreset === 'minggu_lalu') { try { rwFilterEosCepat(jenisPreset); } catch (e) {} }
    };
})();

(function bungkusFilterUntukRosettaWs_() {
    const asli = window.terapkanFilter;
    window.terapkanFilter = function () { asli.apply(this, arguments); try { renderRosettaWorksheet(); } catch (e) {} };
    const asliReset = window.resetFilter;
    window.resetFilter = function () { asliReset.apply(this, arguments); try { renderRosettaWorksheet(); } catch (e) {} };
})();

// =========================================================================
// PANDUAN & SOP (AI) — chat bebas + saran akun terstruktur
// =========================================================================
let panduanRiwayatChat = [];

function ambilDaftarAkunString_() {
    if (!Array.isArray(dataFinance?.accounts) || dataFinance.accounts.length === 0) {
        return '(belum ada akun terdaftar di Chart of Accounts / DB_Akun)';
    }
    return dataFinance.accounts.map(a => `${a.kode} - ${a.kategori}- ${a.nama}`).join('\n');
}

function panduanRenderChat() {
    const box = document.getElementById('panduanChatBox');
    if (!box) return;
    if (panduanRiwayatChat.length === 0) {
        box.innerHTML = '<p style="color:#94a3b8; font-style:italic; text-align:center; padding:30px 0;">Belum ada percakapan. Coba tanya: "Bagaimana cara mencatat pembelian tripod Rp 800.000?"</p>';
        return;
    }
    box.innerHTML = panduanRiwayatChat.map(m => `
        <div style="display:flex; ${m.role === 'user' ? 'justify-content:flex-end;' : 'justify-content:flex-start;'} margin-bottom:10px;">
            <div style="max-width:78%; padding:10px 14px; border-radius:12px; font-size:13px; line-height:1.6; white-space:pre-wrap;
                background:${m.role === 'user' ? '#0f172a' : '#eef2ff'}; color:${m.role === 'user' ? '#fff' : '#312e81'};">${m.text}</div>
        </div>`).join('');
    box.scrollTop = box.scrollHeight;
}

async function panduanKirimChat() {
    const input = document.getElementById('panduanChatInput');
    const teks = input.value.trim();
    if (!teks) return;
    panduanRiwayatChat.push({ role: 'user', text: teks });
    panduanRenderChat();
    input.value = '';
    panduanRiwayatChat.push({ role: 'model', text: '⏳ Mengetik...' });
    panduanRenderChat();
    try {
        const fd = new FormData();
        fd.append('action', 'tanyaSopAiGemini');
        fd.append('riwayatJson', JSON.stringify(panduanRiwayatChat.slice(0, -1)));
        fd.append('daftarAkun', ambilDaftarAkunString_());
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        panduanRiwayatChat.pop();
        panduanRiwayatChat.push({ role: 'model', text: result.result === 'success' ? result.jawaban : ('❌ ' + (result.message || 'Gagal mendapat jawaban.')) });
    } catch (err) {
        panduanRiwayatChat.pop();
        panduanRiwayatChat.push({ role: 'model', text: '❌ Gagal koneksi: ' + err });
    }
    panduanRenderChat();
}

function panduanBersihkanChat() {
    if (!confirm('Bersihkan riwayat percakapan?')) return;
    panduanRiwayatChat = [];
    panduanRenderChat();
}

let panduanSaranTerakhir = null;

async function panduanSarankanAkun() {
    const deskripsi = document.getElementById('panduanDeskripsiTransaksi').value.trim();
    const nominal = document.getElementById('panduanNominalTransaksi').value;
    if (!deskripsi) { alert('Deskripsikan transaksinya dulu.'); return; }
    const outEl = document.getElementById('panduanSaranOutput');
    const loadingEl = document.getElementById('panduanSaranLoading');
    outEl.style.display = 'none'; loadingEl.style.display = 'block';
    try {
        const fd = new FormData();
        fd.append('action', 'saranAkunAiGemini');
        fd.append('deskripsi', deskripsi);
        fd.append('nominal', nominal);
        fd.append('daftarAkun', ambilDaftarAkunString_());
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result !== 'success') throw new Error(result.message || 'Gagal mendapat saran.');
        let parsed;
        try { parsed = JSON.parse(result.saran); } catch (e) { throw new Error('AI tidak mengembalikan format JSON yang valid. Coba lagi.'); }
        panduanSaranTerakhir = parsed;
        outEl.style.display = 'block';
        outEl.innerHTML = `
            <div class="kv"><span>🟢 Akun Debit disarankan</span><b style="color:#059669;">${parsed.akun_debit}</b></div>
            <div class="kv"><span>🔴 Akun Kredit disarankan</span><b style="color:#dc2626;">${parsed.akun_kredit}</b></div>
            <div style="margin-top:10px; padding:10px 14px; background:#eef2ff; color:#3730a3; border-radius:8px; font-size:12.5px; line-height:1.6;">💡 ${parsed.penjelasan || ''}</div>
            <button type="button" class="btn-submit" style="width:auto; margin-top:14px; background:#0f172a;" onclick="panduanIsiKeFormJurnal()">✅ Isi ke Form Jurnal</button>
        `;
    } catch (err) {
        outEl.style.display = 'block';
        outEl.innerHTML = `<div style="color:#dc2626; font-size:12.5px;">❌ ${err.message}</div>`;
    } finally {
        loadingEl.style.display = 'none';
    }
}

function panduanIsiKeFormJurnal() {
    if (!panduanSaranTerakhir) return;
    const nominal = document.getElementById('panduanNominalTransaksi').value || '0';
    const deskripsi = document.getElementById('panduanDeskripsiTransaksi').value || '';
    const btnJurnal = Array.from(document.querySelectorAll('.sub-tab-btn')).find(b => b.getAttribute('onclick')?.includes("'subJurnal'"));
    if (btnJurnal) btnJurnal.click();
    setTimeout(() => {
        const elUtama = document.getElementById('jAkunUtama');
        const elPasangan = document.getElementById('jAkunPasangan');
        const elDebit = document.getElementById('jDebit');
        const elDesc = document.getElementById('jDesc');
        if (elUtama) { elUtama.value = panduanSaranTerakhir.akun_debit; elUtama.dispatchEvent(new Event('input')); }
        if (elPasangan) { elPasangan.value = panduanSaranTerakhir.akun_kredit; elPasangan.dispatchEvent(new Event('input')); }
        if (elDebit) elDebit.value = nominal;
        if (elDesc) elDesc.value = deskripsi;
        alert('✅ Form jurnal sudah terisi. Cek dulu akun & nominalnya, lalu klik "🚀 Posting Jurnal Otomatis".');
    }, 150);
}

// =========================================================================
// CUSTOMER & VENDOR WAJIB — Pendapatan harus ada Customer, Pembelian harus
// ada Vendor. Ini melengkapi cekSopSebelumPosting_ yang sudah ada.
// =========================================================================
let dataVendorGlobal = []; // diisi dari finance.vendors setelah data server dimuat

function butuhCustomer_(opt) {
    if (!opt) return false;
    const kode = (opt.getAttribute('data-kode') || '').toString().trim();
    return kode.startsWith('4');
}
function butuhVendor_(opt) {
    if (!opt) return false;
    const kode = (opt.getAttribute('data-kode') || '').toString().trim();
    const nama = (opt.getAttribute('data-nama') || '').toLowerCase();
    if (kode.startsWith('5')) return true;
    if (kode.startsWith('1') && !['kas', 'bank', 'piutang'].some(k => nama.includes(k))) return true;
    return false;
}
function isiDatalistCustomer_() {
    const list = document.getElementById('listCustomerLeads');
    if (!list || !Array.isArray(dataGlobal)) return;
    list.innerHTML = dataGlobal
        .filter(c => c.kode_leads)
        .map(c => {
            const namaTampil = c.nama || '(tanpa nama)';
            const hpTampil = c.no_hp || '-';
            const minatTampil = c.minat || '-';
            const dpTampil = c.tgl_bayar1 || '-';
            const label = `${namaTampil} \u2014 ${hpTampil} \u2014 ${minatTampil} \u2014 DP: ${dpTampil}`;
            return `<option value="${c.kode_leads}">${label}</option>`;
        })
        .join('');
}

function perbaruiPreviewCustomer_() {
    const input = document.getElementById('jCustomerPicker');
    const previewEl = document.getElementById('customerPreviewInfo');
    if (!input || !previewEl) return;
    const val = input.value.trim();
    if (!val) { previewEl.style.display = 'none'; return; }
    const client = (dataGlobal || []).find(c => c.kode_leads === val);
    if (client) {
        previewEl.style.display = 'block';
        previewEl.style.background = '#dcfce7';
        previewEl.style.color = '#166534';
        previewEl.innerHTML = `\u2705 <strong>${client.nama || '(tanpa nama)'}</strong> \u2014 ${client.no_hp || '-'} \u2014 ${client.minat || '-'}` +
            (client.tgl_bayar1 ? ` \u2014 DP: ${client.tgl_bayar1}` : '') +
            (client.total ? ` \u2014 Total: Rp ${Number(client.total).toLocaleString('id-ID')}` : '');
    } else {
        previewEl.style.display = 'block';
        previewEl.style.background = '#fef3c7';
        previewEl.style.color = '#92400e';
        previewEl.innerHTML = `\u26a0\ufe0f Kode Leads "${val}" tidak ditemukan di Database Klien. Pilih dari daftar saran (ketik nama/No HP), jangan ketik manual.`;
    }
}
function isiDatalistVendor_() {
    const list = document.getElementById('listVendor');
    if (!list) return;
    list.innerHTML = (dataVendorGlobal || []).map(v => `<option value="${v.id} - ${v.nama}">`).join('');
}
function perbaruiTampilanCustomerVendor_() {
    const inputUtama = document.getElementById('jAkunUtama');
    const inputPasangan = document.getElementById('jAkunPasangan');
    const options = document.getElementById('listAkun').options;
    const findOption = (val) => Array.from(options).find(o => o.value === val);
    const optUtama = findOption(inputUtama?.value);
    const optPasangan = findOption(inputPasangan?.value);
    const perluCustomer = butuhCustomer_(optUtama) || butuhCustomer_(optPasangan);
    const perluVendor = butuhVendor_(optUtama) || butuhVendor_(optPasangan);
    const boxCustomer = document.getElementById('boxCustomerPicker');
    const boxVendor = document.getElementById('boxVendorPicker');
    if (boxCustomer) boxCustomer.style.display = perluCustomer ? 'block' : 'none';
    if (boxVendor) boxVendor.style.display = perluVendor ? 'block' : 'none';
}
function pasangListenerCustomerVendor_() {
    const utama = document.getElementById('jAkunUtama');
    const pasangan = document.getElementById('jAkunPasangan');
    if (utama) utama.addEventListener('input', perbaruiTampilanCustomerVendor_);
    if (pasangan) pasangan.addEventListener('input', perbaruiTampilanCustomerVendor_);
    const inputCustomerPicker = document.getElementById('jCustomerPicker');
    if (inputCustomerPicker) inputCustomerPicker.addEventListener('input', perbaruiPreviewCustomer_);
    isiDatalistCustomer_();
    isiDatalistVendor_();
}
function validasiCustomerVendorSebelumPosting_(optUtama, optPasangan) {
    const perluCustomer = butuhCustomer_(optUtama) || butuhCustomer_(optPasangan);
    const perluVendor = butuhVendor_(optUtama) || butuhVendor_(optPasangan);
    if (perluCustomer && !document.getElementById('jCustomerPicker')?.value.trim()) {
        return '🧑‍💼 Transaksi ini melibatkan akun Pendapatan — WAJIB pilih Customer dulu (lihat kotak hijau di atas).';
    }
    if (perluVendor && !document.getElementById('jVendorPicker')?.value.trim()) {
        return '🏭 Transaksi ini melibatkan akun Beban/Aset (pembelian) — WAJIB pilih Vendor/Supplier dulu (lihat kotak oranye di atas), atau klik "+ Vendor Baru" kalau belum terdaftar.';
    }
    return null;
}
function bukaModalTambahVendor() {
    document.getElementById('vdrNama').value = '';
    document.getElementById('vdrKontak').value = '';
    document.getElementById('modalTambahVendor').style.display = 'flex';
}
async function simpanVendorBaru() {
    const nama = document.getElementById('vdrNama').value.trim();
    if (!nama) { alert('Nama vendor wajib diisi.'); return; }
    const kontak = document.getElementById('vdrKontak').value.trim();
    const kategori = document.getElementById('vdrKategori').value;
    try {
        const fd = new FormData();
        fd.append('action', 'tambahVendor');
        fd.append('nama', nama); fd.append('kontak', kontak); fd.append('kategori', kategori);
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            dataVendorGlobal.push({ id: result.id, nama: result.nama, kontak, kategori });
            isiDatalistVendor_();
            document.getElementById('jVendorPicker').value = `${result.id} - ${result.nama}`;
            document.getElementById('modalTambahVendor').style.display = 'none';
        } else {
            alert('❌ Gagal menambah vendor: ' + (result.message || ''));
        }
    } catch (err) {
        alert('❌ Gagal koneksi: ' + err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try { panduanRenderChat(); } catch (e) {}
    try { pasangListenerCustomerVendor_(); } catch (e) {}
});

// --- Auto-sync dataVendorGlobal dari dataFinance.vendors dan dataGlobal
// (customer), tanpa perlu edit Init.html secara manual (jaga-jaga kalau
// urutan load berbeda). Berhenti otomatis begitu berhasil sinkron atau
// setelah 20 detik. ---
(function autoSyncVendorDanCustomerGlobal_() {
    let percobaan = 0;
    let vendorSelesai = false;
    let customerSelesai = false;
    const interval = setInterval(() => {
        percobaan++;
        if (!vendorSelesai && typeof dataFinance !== 'undefined' && Array.isArray(dataFinance?.vendors)) {
            if (dataFinance.vendors.length > 0 || percobaan > 5) {
                dataVendorGlobal = dataFinance.vendors || [];
                isiDatalistVendor_();
                if (dataVendorGlobal.length > 0) vendorSelesai = true;
            }
        }
        if (!customerSelesai && typeof dataGlobal !== 'undefined' && Array.isArray(dataGlobal)) {
            if (dataGlobal.length > 0 || percobaan > 5) {
                isiDatalistCustomer_();
                if (dataGlobal.length > 0) customerSelesai = true;
            }
        }
        if ((vendorSelesai && customerSelesai) || percobaan > 40) clearInterval(interval);
    }, 500);
})();

function refreshDatalistCustomerManual() {
    isiDatalistCustomer_();
    alert('Datalist Customer di-refresh ulang. Coba ketik nama/No HP lagi di kotak Customer.');
}


// ==== SNIPPET 19: STOK & TUTUP BUKU (digabung otomatis) ====

// ============================================================================
// SNIPPET 19 — TEMPEL DI AKHIR UiFinance.html (sebelum "</script>" penutup)
// STOK & PERSEDIAAN + TUTUP BUKU
// ============================================================================

// =========================================================================
// A. STOK & PERSEDIAAN
// =========================================================================
function stokBukaSub(id, btnEl) {
    document.querySelectorAll('.stok-sub').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.stok-tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btnEl.classList.add('active');
}

// Hitung stok saat ini per barang dari seluruh dataFinance.mutasiStok
function stokHitungSaldoSemuaBarang_() {
    const saldo = {}; // idBarang -> qty
    (dataFinance?.mutasiStok || []).forEach(m => {
        if (!saldo[m.idBarang]) saldo[m.idBarang] = 0;
        saldo[m.idBarang] += (m.jenis === 'Masuk' ? 1 : -1) * (Number(m.qty) || 0);
    });
    return saldo;
}

function renderStokPersediaan() {
    const daftarBarang = dataFinance?.barang || [];
    const saldo = stokHitungSaldoSemuaBarang_();

    let totalJenis = daftarBarang.length;
    let jumlahDiBawahMinimum = 0;
    let totalNilaiPersediaan = 0;

    const tbody = document.getElementById('stokTabelDaftar');
    if (tbody) {
        tbody.innerHTML = daftarBarang.map(b => {
            const stokSaatIni = saldo[b.id] || 0;
            const nilaiPersediaan = stokSaatIni * b.hargaBeliStandar;
            totalNilaiPersediaan += nilaiPersediaan;
            const dibawahMinimum = stokSaatIni < b.stokMinimum;
            if (dibawahMinimum) jumlahDiBawahMinimum++;
            return `<tr class="${dibawahMinimum ? 'stok-alert-row' : ''}">
                <td>${b.nama} ${dibawahMinimum ? '<span class="badge" style="background:#fee2e2; color:#991b1b; font-size:10px;">⚠️ DI BAWAH MINIMUM</span>' : ''}</td>
                <td>${b.satuan}</td>
                <td style="font-weight:700;">${stokSaatIni.toLocaleString('id-ID')}</td>
                <td>${b.stokMinimum.toLocaleString('id-ID')}</td>
                <td>Rp ${b.hargaBeliStandar.toLocaleString('id-ID')}</td>
                <td>Rp ${nilaiPersediaan.toLocaleString('id-ID')}</td>
            </tr>`;
        }).join('') || '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">Belum ada barang. Tambahkan lewat form di atas.</td></tr>';
    }

    const kpiEl = document.getElementById('stokKpiGrid');
    if (kpiEl) kpiEl.innerHTML = `
        <div class="stok-kpi total"><div style="font-size:22px; font-weight:900;">${totalJenis}</div><div style="font-size:11px; opacity:.9;">Jenis Barang</div></div>
        <div class="stok-kpi minimum"><div style="font-size:22px; font-weight:900;">${jumlahDiBawahMinimum}</div><div style="font-size:11px; opacity:.9;">Di Bawah Stok Minimum</div></div>
        <div class="stok-kpi nilai"><div style="font-size:18px; font-weight:900;">Rp ${totalNilaiPersediaan.toLocaleString('id-ID')}</div><div style="font-size:11px; opacity:.9;">Total Nilai Persediaan</div></div>
    `;

    stokIsiDropdownBarang_();
    stokRenderTabelBOM_();
    stokIsiDatalistNamaPaket_();
}

function stokIsiDropdownBarang_() {
    const opsi = (dataFinance?.barang || []).map(b => `<option value="${b.id}">${b.nama} (${b.satuan})</option>`).join('');
    ['stokKartuPilihBarang', 'bomPilihBarang', 'mutasiPilihBarang'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { const val = el.value; el.innerHTML = opsi; if (val) el.value = val; }
    });
    if (document.getElementById('stokKartuPilihBarang') && !document.getElementById('stokKartuPilihBarang').value) renderKartuStok();
}

async function stokTambahBarang() {
    const nama = document.getElementById('stokBrgNama').value.trim();
    if (!nama) { alert('Nama barang wajib diisi.'); return; }
    const fd = new FormData();
    fd.append('action', 'tambahBarang');
    fd.append('nama', nama);
    fd.append('satuan', document.getElementById('stokBrgSatuan').value.trim() || 'pcs');
    fd.append('stokMinimum', document.getElementById('stokBrgMinimum').value || 0);
    fd.append('hargaBeliStandar', document.getElementById('stokBrgHarga').value || 0);
    fd.append('kategori', document.getElementById('stokBrgKategori').value.trim());
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            dataFinance.barang = dataFinance.barang || [];
            dataFinance.barang.push({ id: result.id, nama, satuan: document.getElementById('stokBrgSatuan').value || 'pcs', stokMinimum: Number(document.getElementById('stokBrgMinimum').value) || 0, hargaBeliStandar: Number(document.getElementById('stokBrgHarga').value) || 0, kategori: document.getElementById('stokBrgKategori').value });
            ['stokBrgNama','stokBrgSatuan','stokBrgMinimum','stokBrgHarga','stokBrgKategori'].forEach(id => document.getElementById(id).value = '');
            renderStokPersediaan();
        } else { alert('❌ Gagal: ' + (result.message || '')); }
    } catch (err) { alert('❌ Gagal koneksi: ' + err); }
}

function renderKartuStok() {
    const idBarang = document.getElementById('stokKartuPilihBarang')?.value;
    const tbody = document.getElementById('stokTabelKartu');
    if (!tbody) return;
    if (!idBarang) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">Pilih barang dulu.</td></tr>'; return; }

    const mutasi = (dataFinance?.mutasiStok || []).filter(m => m.idBarang === idBarang).sort((a, b) => new Date(a.tgl) - new Date(b.tgl));
    let saldo = 0;
    tbody.innerHTML = mutasi.map(m => {
        saldo += (m.jenis === 'Masuk' ? 1 : -1) * m.qty;
        const ref = m.refCustomer || m.refVendor || m.refPaket || '-';
        return `<tr>
            <td>${m.tgl}</td>
            <td><span class="badge" style="background:${m.jenis === 'Masuk' ? '#dcfce7' : '#fee2e2'}; color:${m.jenis === 'Masuk' ? '#166534' : '#991b1b'};">${m.jenis}</span></td>
            <td>${m.qty.toLocaleString('id-ID')}</td>
            <td style="font-size:11px;">${ref}</td>
            <td>${m.keterangan || '-'}</td>
            <td style="font-size:11px; color:#64748b;">${m.sumber}</td>
            <td style="font-weight:700;">${saldo.toLocaleString('id-ID')}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:16px;">Belum ada mutasi untuk barang ini.</td></tr>';
}

function stokRenderTabelBOM_() {
    const tbody = document.getElementById('stokTabelBOM');
    if (!tbody) return;
    tbody.innerHTML = (dataFinance?.bom || []).map(b => `
        <tr><td>${b.namaPaket}</td><td>${b.namaBarang}</td><td>${b.qty}</td>
        <td><button onclick="stokHapusBOM('${b.id}')" style="border:none; background:#fee2e2; color:#991b1b; border-radius:6px; padding:4px 8px; cursor:pointer; font-size:11px;">🗑️</button></td></tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding:16px;">Belum ada resep BOM.</td></tr>';
}

async function stokTambahBOM() {
    const namaPaket = document.getElementById('bomNamaPaket').value.trim();
    const selBarang = document.getElementById('bomPilihBarang');
    const idBarang = selBarang.value;
    const namaBarang = selBarang.options[selBarang.selectedIndex]?.text || '';
    const qty = Number(document.getElementById('bomQty').value) || 0;
    if (!namaPaket || !idBarang || qty <= 0) { alert('Lengkapi Nama Paket, Barang, dan Qty (>0).'); return; }

    const fd = new FormData();
    fd.append('action', 'tambahBOM');
    fd.append('itemsJson', JSON.stringify([{ namaPaket, idBarang, namaBarang, qty }]));
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            dataFinance.bom = dataFinance.bom || [];
            dataFinance.bom.push({ id: 'temp-' + Date.now(), namaPaket, idBarang, namaBarang, qty });
            document.getElementById('bomNamaPaket').value = ''; document.getElementById('bomQty').value = '';
            stokRenderTabelBOM_(); stokIsiDatalistNamaPaket_();
        } else { alert('❌ Gagal: ' + (result.message || '')); }
    } catch (err) { alert('❌ Gagal koneksi: ' + err); }
}

async function stokHapusBOM(idBom) {
    if (!confirm('Hapus resep BOM ini?')) return;
    const fd = new FormData(); fd.append('action', 'hapusBOM'); fd.append('idBom', idBom);
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            dataFinance.bom = (dataFinance.bom || []).filter(b => b.id !== idBom);
            stokRenderTabelBOM_(); stokIsiDatalistNamaPaket_();
        } else { alert('❌ Gagal: ' + (result.message || '')); }
    } catch (err) { alert('❌ Gagal koneksi: ' + err); }
}

function stokIsiDatalistNamaPaket_() {
    const list = document.getElementById('listNamaPaketBOM');
    if (!list) return;
    const namaUnik = [...new Set((dataFinance?.bom || []).map(b => b.namaPaket))];
    list.innerHTML = namaUnik.map(n => `<option value="${n}">`).join('');
}

async function stokProsesPenjualan() {
    const customerVal = document.getElementById('prosesCustomer').value.trim();
    const namaPaket = document.getElementById('prosesNamaPaket').value.trim();
    const faktorQty = document.getElementById('prosesFaktorQty').value || 1;
    const tgl = document.getElementById('prosesTanggal').value || new Date().toISOString().split('T')[0];
    const posJurnal = document.getElementById('prosesPosJurnal').checked;
    if (!namaPaket) { alert('Isi Nama Paket dulu (harus sama persis dengan yang ada di BOM).'); return; }

    const kodeLeads = customerVal.split(' - ')[0]?.trim() || '';

    const fd = new FormData();
    fd.append('action', 'prosesPenjualanKurangiStok');
    fd.append('namaPaket', namaPaket);
    fd.append('kodeLeads', kodeLeads);
    fd.append('faktorQty', faktorQty);
    fd.append('tgl', tgl);
    fd.append('posJurnalCOGS', posJurnal ? 'true' : 'false');
    if (posJurnal) {
        fd.append('akunCOGS', document.getElementById('prosesAkunCOGS').value);
        fd.append('akunPersediaan', document.getElementById('prosesAkunPersediaan').value);
    }

    const outEl = document.getElementById('prosesHasil');
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        outEl.style.display = 'block';
        if (result.result === 'success') {
            outEl.innerHTML = `
                <div style="font-weight:700; color:#059669; margin-bottom:8px;">✅ Stok berhasil dikurangi!</div>
                ${result.ringkasanBarang.map(r => `<div class="kv"><span>${r.nama}</span><b>-${r.qty}</b></div>`).join('')}
                ${result.totalNilaiCOGS > 0 ? `<div class="kv" style="border-top:1px solid #e2e8f0; padding-top:8px; margin-top:8px;"><span>Total Nilai COGS</span><b>Rp ${result.totalNilaiCOGS.toLocaleString('id-ID')}</b></div>` : ''}
                ${result.idJurnalCOGS ? `<div style="font-size:11px; color:#64748b; margin-top:6px;">Jurnal COGS: ${result.idJurnalCOGS}</div>` : ''}
            `;
            await tarikDataServer(); // refresh semua data (stok + jurnal baru)
        } else {
            outEl.innerHTML = `<div style="color:#dc2626;">❌ ${result.message}</div>`;
        }
    } catch (err) {
        outEl.style.display = 'block';
        outEl.innerHTML = `<div style="color:#dc2626;">❌ Gagal koneksi: ${err}</div>`;
    }
}

async function stokMutasiManual() {
    const selBarang = document.getElementById('mutasiPilihBarang');
    const idBarang = selBarang.value;
    const namaBarang = selBarang.options[selBarang.selectedIndex]?.text || '';
    const qty = Number(document.getElementById('mutasiQty').value) || 0;
    if (!idBarang || qty <= 0) { alert('Pilih barang dan isi Qty (>0).'); return; }

    const fd = new FormData();
    fd.append('action', 'mutasiStokManual');
    fd.append('tgl', document.getElementById('mutasiTgl').value || new Date().toISOString().split('T')[0]);
    fd.append('idBarang', idBarang);
    fd.append('namaBarang', namaBarang);
    fd.append('jenis', document.getElementById('mutasiJenis').value);
    fd.append('qty', qty);
    fd.append('refVendor', document.getElementById('mutasiVendor').value.trim());
    fd.append('keterangan', document.getElementById('mutasiKeterangan').value.trim());
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            dataFinance.mutasiStok = dataFinance.mutasiStok || [];
            dataFinance.mutasiStok.push({ id: result.id, tgl: document.getElementById('mutasiTgl').value, idBarang, namaBarang, jenis: document.getElementById('mutasiJenis').value, qty, refVendor: document.getElementById('mutasiVendor').value, keterangan: document.getElementById('mutasiKeterangan').value, sumber: 'Manual' });
            document.getElementById('mutasiQty').value = ''; document.getElementById('mutasiVendor').value = ''; document.getElementById('mutasiKeterangan').value = '';
            renderStokPersediaan(); renderKartuStok();
        } else { alert('❌ Gagal: ' + (result.message || '')); }
    } catch (err) { alert('❌ Gagal koneksi: ' + err); }
}

// =========================================================================
// B. TUTUP BUKU
// =========================================================================
function renderTutupBuku() {
    const daftar = dataFinance?.tutupBuku || [];
    const tbody = document.getElementById('tbTabelRiwayat');
    if (!tbody) return;
    const namaBulan = ['','Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    tbody.innerHTML = daftar.slice().reverse().map(t => `
        <tr>
            <td>${namaBulan[t.bulan]} ${t.tahun}</td>
            <td><span class="tb-status-badge ${t.status === 'Ditutup' ? 'tb-status-ditutup' : 'tb-status-terbuka'}">${t.status === 'Ditutup' ? '🔒 Ditutup' : '🔓 ' + t.status}</span></td>
            <td>Rp ${Number(t.pendapatan).toLocaleString('id-ID')}</td>
            <td>Rp ${Number(t.beban).toLocaleString('id-ID')}</td>
            <td style="font-weight:700; color:${t.labaBersih >= 0 ? '#059669' : '#dc2626'};">Rp ${Number(t.labaBersih).toLocaleString('id-ID')}</td>
            <td>${t.ditutupOleh}</td>
            <td style="font-size:11px;">${t.tglDitutup}</td>
            <td>${t.status === 'Ditutup' ? `<button onclick="tbBukaKembali(${t.tahun}, ${t.bulan})" style="border:none; background:#fef3c7; color:#92400e; border-radius:6px; padding:5px 10px; cursor:pointer; font-size:11px; font-weight:700;">🔓 Buka Kembali</button>` : '-'}</td>
        </tr>
    `).join('') || '<tr><td colspan="8" style="text-align:center; color:#94a3b8; padding:20px;">Belum ada periode yang ditutup.</td></tr>';
}

async function tbTutupBuku() {
    const tahun = Number(document.getElementById('tbTahun').value);
    const bulan = Number(document.getElementById('tbBulan').value);
    const penanggungJawab = document.getElementById('tbPenanggungJawab').value.trim();
    if (!penanggungJawab) { alert('Isi nama penanggung jawab dulu.'); return; }
    if (!confirm(`Yakin tutup buku periode ${bulan}/${tahun}?\n\nSetelah ditutup, jurnal di bulan ini TIDAK BISA diedit/dihapus lagi kecuali dibuka kembali. Pastikan sudah dicek di Audit SOP Otomatis dulu.`)) return;

    const fd = new FormData();
    fd.append('action', 'tutupBukuBulan');
    fd.append('tahun', tahun); fd.append('bulan', bulan); fd.append('penanggungJawab', penanggungJawab);
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            alert(`✅ Buku ${result.data.bulanNama} ${result.data.tahun} berhasil ditutup.\n\nPendapatan: Rp ${result.data.pendapatan.toLocaleString('id-ID')}\nBeban: Rp ${result.data.beban.toLocaleString('id-ID')}\nNet Income: Rp ${result.data.netIncome.toLocaleString('id-ID')}\n\nDipindahkan ke akun 320 Laba Ditahan.`);
            await tarikDataServer();
            renderTutupBuku();
        } else {
            alert('❌ Gagal tutup buku: ' + (result.message || ''));
        }
    } catch (err) {
        alert('❌ Gagal koneksi: ' + err);
    }
}

async function tbBukaKembali(tahun, bulan) {
    if (!confirm(`Buka kembali buku ${bulan}/${tahun}? Jurnal penutup akan dihapus dan periode ini bisa diedit lagi.`)) return;
    const fd = new FormData();
    fd.append('action', 'bukaKembaliBuku');
    fd.append('tahun', tahun); fd.append('bulan', bulan);
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            alert('✅ Buku dibuka kembali.');
            await tarikDataServer();
            renderTutupBuku();
        } else {
            alert('❌ Gagal: ' + (result.message || ''));
        }
    } catch (err) {
        alert('❌ Gagal koneksi: ' + err);
    }
}

// =========================================================================
// C. PATCH — kecualikan jurnal penutup (sumber_entri === 'Penutupan-Bulanan')
// dari SEMUA fungsi laporan PERIODIK (Income Statement, Insight, Tren),
// supaya angka bulan yang sudah ditutup tetap akurat apa adanya. Neraca
// SENGAJA TIDAK di-patch (harus tetap menghitung jurnal penutup supaya
// Laba Ditahan & Laba Berjalan terpisah dengan benar secara kumulatif).
// =========================================================================
(function patchKecualikanJurnalPenutup_() {
    const asliHitungLabaRugi = hitungLabaRugi;
    window.hitungLabaRugi = function (dataJurnal) {
        return asliHitungLabaRugi(Array.isArray(dataJurnal) ? dataJurnal.filter(r => r.sumber_entri !== 'Penutupan-Bulanan') : dataJurnal);
    };
    const asliHitungIS = hitungIncomeStatementLengkap;
    window.hitungIncomeStatementLengkap = function (dataJurnal) {
        return asliHitungIS(Array.isArray(dataJurnal) ? dataJurnal.filter(r => r.sumber_entri !== 'Penutupan-Bulanan') : dataJurnal);
    };
    const asliInsight = renderInsightKeuangan;
    window.renderInsightKeuangan = function (dataFiltered) {
        return asliInsight(Array.isArray(dataFiltered) ? dataFiltered.filter(r => r.sumber_entri !== 'Penutupan-Bulanan') : dataFiltered);
    };
})();

// Patch hitungMatrixPeriodeTerkelompok_ (Tren Bulanan/Mingguan): tambahkan
// exclude di filter internalnya dengan cara membungkus dataJurnalGlobal
// sementara saat fungsi ini dipanggil.
(function patchTrenKecualikanPenutup_() {
    const asliHitungMatrix = hitungMatrixPeriodeTerkelompok_;
    window.hitungMatrixPeriodeTerkelompok_ = function (tahun, mode, jenis, periode) {
        const asliData = dataJurnalGlobal;
        dataJurnalGlobal = asliData.filter(r => r.sumber_entri !== 'Penutupan-Bulanan');
        const hasil = asliHitungMatrix(tahun, mode, jenis, periode);
        dataJurnalGlobal = asliData;
        return hasil;
    };
})();

// Fix klasifikasi kolom Rosetta Worksheet: akun "320 Laba Ditahan" harus
// masuk kolom "Retained Earning", BUKAN "Common Stock".
(function patchKlasifikasiRetainedEarnings_() {
    const asliKlasifikasi = klasifikasiKolomWorksheet_;
    window.klasifikasiKolomWorksheet_ = function (row) {
        const kode = (row.kode || '').toString().trim();
        const nama = (row.nama || '').toLowerCase();
        if (kode.startsWith('3') && (nama.includes('laba ditahan') || nama.includes('retained'))) return 'retained';
        return asliKlasifikasi(row);
    };
})();

// Tag khusus "C" (Closing) untuk baris penutup di Rosetta Worksheet
(function patchTagClosingWorksheet_() {
    const asliTag = tagOifWorksheet_;
    window.tagOifWorksheet_ = function (baris) {
        if (baris.some(r => r.sumber_entri === 'Penutupan-Bulanan')) return 'C';
        return asliTag(baris);
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    const tglInputStok = document.getElementById('mutasiTgl');
    if (tglInputStok) tglInputStok.value = new Date().toISOString().split('T')[0];
    const tglProses = document.getElementById('prosesTanggal');
    if (tglProses) tglProses.value = new Date().toISOString().split('T')[0];
    try { renderStokPersediaan(); } catch (e) {}
    try { renderTutupBuku(); } catch (e) {}
});


// ==== SNIPPET 21b: NOTIFIKASI TELEGRAM/FONNTE (digabung otomatis) ====

// =========================================================================
// TOMBOL WEBHOOK BOT TELEGRAM (aktifkan/nonaktifkan interaktivitas bot)
// =========================================================================
async function notifPasangWebhook() {
    if (!confirm('Aktifkan bot Telegram interaktif? Pastikan Chat ID sudah diisi & disimpan dulu.')) return;
    const outEl = document.getElementById('notifHasilWebhook');
    outEl.style.display = 'block'; outEl.style.background = '#f1f5f9';
    outEl.innerText = '⏳ Memasang webhook...';
    const fd = new FormData(); fd.append('action', 'pasangWebhookTelegram');
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            outEl.style.background = '#dcfce7'; outEl.style.color = '#166534';
            outEl.innerText = '✅ Bot interaktif AKTIF! Coba chat bot kamu di Telegram sekarang, kirim "hai".';
        } else {
            outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
            outEl.innerText = '❌ Gagal: ' + (result.message || '');
        }
    } catch (err) {
        outEl.style.display = 'block'; outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
        outEl.innerText = '❌ Gagal koneksi: ' + err;
    }
}
async function notifHapusWebhook() {
    if (!confirm('Nonaktifkan bot interaktif? Notifikasi terjadwal (harian/mingguan/bulanan) TETAP jalan seperti biasa.')) return;
    const outEl = document.getElementById('notifHasilWebhook');
    outEl.style.display = 'block'; outEl.style.background = '#f1f5f9';
    outEl.innerText = '⏳ Melepas webhook...';
    const fd = new FormData(); fd.append('action', 'hapusWebhookTelegram');
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        outEl.style.background = result.result === 'success' ? '#dcfce7' : '#fee2e2';
        outEl.style.color = result.result === 'success' ? '#166534' : '#991b1b';
        outEl.innerText = result.result === 'success' ? '✅ Bot interaktif dinonaktifkan.' : '❌ Gagal: ' + (result.message || '');
    } catch (err) {
        outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
        outEl.innerText = '❌ Gagal koneksi: ' + err;
    }
}

// =========================================================================
// PENGATURAN NOTIFIKASI (Telegram & Fonnte) — panel pengaturan lengkap
// =========================================================================
function notifMuatPengaturan() {
    const p = dataFinance?.pengaturanNotifikasi;
    if (!p) return;
    document.getElementById('notifTelegramChatId').value = p.telegram_chat_id || '';
    document.getElementById('notifFonnteTarget').value = p.fonnte_target || '';
    document.getElementById('notifKirimTelegram').checked = !!p.kirim_ke_telegram;
    document.getElementById('notifKirimFonnte').checked = !!p.kirim_ke_fonnte;
    document.getElementById('notifAktifHarian').checked = !!p.aktif_harian;
    document.getElementById('notifAktifMingguan').checked = !!p.aktif_mingguan;
    document.getElementById('notifAktifBulanan').checked = !!p.aktif_bulanan;

    const statusEl = document.getElementById('notifStatusTrigger');
    if (statusEl) {
        statusEl.innerText = dataFinance?.triggerNotifikasiAktif ? '✅ Jadwal otomatis AKTIF' : '⏸️ Jadwal otomatis belum diaktifkan';
        statusEl.style.color = dataFinance?.triggerNotifikasiAktif ? '#059669' : '#94a3b8';
    }
}

async function notifSimpanPengaturan() {
    const fd = new FormData();
    fd.append('action', 'simpanPengaturanNotifikasi');
    fd.append('telegramChatId', document.getElementById('notifTelegramChatId').value.trim());
    fd.append('fonnteTarget', document.getElementById('notifFonnteTarget').value.trim());
    fd.append('kirimKeTelegram', document.getElementById('notifKirimTelegram').checked);
    fd.append('kirimKeFonnte', document.getElementById('notifKirimFonnte').checked);
    fd.append('aktifHarian', document.getElementById('notifAktifHarian').checked);
    fd.append('aktifMingguan', document.getElementById('notifAktifMingguan').checked);
    fd.append('aktifBulanan', document.getElementById('notifAktifBulanan').checked);
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') alert('✅ Pengaturan notifikasi tersimpan.');
        else alert('❌ Gagal: ' + (result.message || ''));
    } catch (err) { alert('❌ Gagal koneksi: ' + err); }
}

async function notifPasangTrigger() {
    if (!confirm('Aktifkan jadwal kirim otomatis (harian/mingguan/bulanan sesuai centang di atas)?\n\nPastikan sudah klik "Simpan Pengaturan" dulu.')) return;
    const fd = new FormData(); fd.append('action', 'pasangTriggerOtomatis');
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            alert('✅ Jadwal otomatis diaktifkan.');
            document.getElementById('notifStatusTrigger').innerText = '✅ Jadwal otomatis AKTIF';
            document.getElementById('notifStatusTrigger').style.color = '#059669';
        } else alert('❌ Gagal: ' + (result.message || ''));
    } catch (err) { alert('❌ Gagal koneksi: ' + err); }
}

async function notifHapusTrigger() {
    if (!confirm('Nonaktifkan SEMUA jadwal kirim otomatis?')) return;
    const fd = new FormData(); fd.append('action', 'hapusTriggerOtomatis');
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            alert('✅ Semua jadwal dinonaktifkan.');
            document.getElementById('notifStatusTrigger').innerText = '⏸️ Jadwal otomatis belum diaktifkan';
            document.getElementById('notifStatusTrigger').style.color = '#94a3b8';
        } else alert('❌ Gagal: ' + (result.message || ''));
    } catch (err) { alert('❌ Gagal koneksi: ' + err); }
}

async function notifTestKirim(jenis) {
    const outEl = document.getElementById('notifHasilTest');
    outEl.style.display = 'block';
    outEl.style.background = '#f1f5f9';
    outEl.innerText = '⏳ Mengirim pesan test (' + jenis + ')...';
    const fd = new FormData();
    fd.append('action', 'testKirimNotifikasi');
    fd.append('jenis', jenis);
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const result = await res.json();
        if (result.result === 'success') {
            outEl.style.background = '#dcfce7'; outEl.style.color = '#166534';
            outEl.innerText = '✅ Pesan test "' + jenis + '" berhasil dikirim! Cek Telegram/WA kamu.';
        } else {
            outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
            outEl.innerText = '❌ Gagal: ' + (result.message || '');
        }
    } catch (err) {
        outEl.style.background = '#fee2e2'; outEl.style.color = '#991b1b';
        outEl.innerText = '❌ Gagal koneksi: ' + err;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { try { notifMuatPengaturan(); } catch (e) {} }, 800);
});
