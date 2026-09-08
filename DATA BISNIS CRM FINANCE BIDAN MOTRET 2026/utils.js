// =========================================================================
// utils.js — disalin PERSIS dari fungsi-fungsi bantuan di Init.html/Utils.html
// Apps Script Anda, supaya perilakunya identik di versi Vercel.
// =========================================================================

function rp(num) { return Math.round(Number(num) || 0).toLocaleString('id-ID'); }
function prc(part, total) { return total == 0 ? "0%" : ((part / total) * 100).toFixed(1) + "%"; }
function getTime(d) { return new Date(d).setHours(0, 0, 0, 0); }
function monthDiff(start, end) { let d1 = new Date(start), d2 = new Date(end); return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth()); }
function formatd(iso) { try { let d = new Date(iso); if (isNaN(d)) return "-"; return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }); } catch (e) { return "-"; } }
function formati(iso) { try { let d = new Date(iso); if (isNaN(d.getTime())) return ""; let m = '' + (d.getMonth() + 1), day = '' + d.getDate(), y = d.getFullYear(); if (m.length < 2) m = '0' + m; if (day.length < 2) day = '0' + day; return [y, m, day].join('-'); } catch (e) { return ""; } }
function cleanHP(hp) { let s = hp.toString().trim(); return s.startsWith('0') ? '62' + s.substring(1) : s; }

// --- HELPER DI LUAR FUNGSI ---
function formatTanggalManusia(tglInput) {
    if (!tglInput || tglInput === "-") return "-";
    let d = new Date(tglInput);
    if (isNaN(d.getTime())) return tglInput;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
}

// RUMUS BANTUAN UNTUK MENGHITUNG SELISIH HARI
// (versi ini menggantikan versi awal daysDiff di atas — dipakai apa adanya
// sesuai urutan definisi asli, JS memakai definisi function yang terakhir)
function daysDiff(tgl1, tgl2) {
    if (!tgl1 || !tgl2) return 0;
    try {
        let d1 = new Date(tgl1);
        let d2 = new Date(tgl2);
        let diffTime = d2.getTime() - d1.getTime();
        let diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
        return diffDays > 0 ? diffDays : 0;
    } catch (e) {
        return 0;
    }
}

// Wrapper khusus tombol sub-tab "Wilayah & Kota" di Audience Intelligence.
// Chart.js yang dibuat saat container-nya masih display:none akan ke-render
// 0x0 -- jadi kita panggil resize() setelah kontainernya benar-benar tampil.
function bukaSubTabWilayah(subId, btnElement) {
    bukaSubTab(subId, btnElement);
    setTimeout(() => {
        if (window.chartRegionReachInstance) window.chartRegionReachInstance.resize();
        if (window.chartCityReachInstance) window.chartCityReachInstance.resize();
    }, 50);
}

// =========================================================================
// FUNGSI DI BAWAH INI SEKARANG SUDAH VERSI ASLI (disalin persis dari
// Init.html/Utils.html Apps Script Anda), menggantikan versi perkiraan
// sebelumnya.
// =========================================================================

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

// ==========================================
// WIDGET REUSABLE: Preset rentang tanggal cepat
// ==========================================

function terapkanRentangCepat(startId, endId, tipe, callback, btnGroupId) {
    const hariIni = new Date();
    let start, end = new Date(hariIni);

    switch (tipe) {
        case 'hari_ini':
            start = new Date(hariIni);
            break;
        case '7_hari':
            start = new Date(hariIni);
            start.setDate(start.getDate() - 6);
            break;
        case '30_hari':
            start = new Date(hariIni);
            start.setDate(start.getDate() - 29);
            break;
        case 'bulan_ini':
            start = new Date(hariIni.getFullYear(), hariIni.getMonth(), 1);
            end = new Date(hariIni.getFullYear(), hariIni.getMonth() + 1, 0);
            break;
        default:
            return;
    }

    const fmt = (d) => {
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const elStart = document.getElementById(startId);
    const elEnd = document.getElementById(endId);
    if (elStart) elStart.value = fmt(start);
    if (elEnd) elEnd.value = fmt(end);

    if (btnGroupId) {
        const grup = document.getElementById(btnGroupId);
        if (grup) {
            grup.querySelectorAll('.btn-preset-tgl').forEach(b => b.classList.remove('active'));
            const btnAktif = grup.querySelector(`[data-preset="${tipe}"]`);
            if (btnAktif) btnAktif.classList.add('active');
        }
    }

    if (typeof callback === 'function') callback();
}

function terapkanBulanPilihan(startId, endId, bulanValue, callback, btnGroupId) {
    if (!bulanValue) return;
    const [y, m] = bulanValue.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);

    const fmt = (d) => {
        const yy = d.getFullYear(), mm = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}`;
    };

    const elStart = document.getElementById(startId);
    const elEnd = document.getElementById(endId);
    if (elStart) elStart.value = fmt(start);
    if (elEnd) elEnd.value = fmt(end);

    if (btnGroupId) {
        const grup = document.getElementById(btnGroupId);
        if (grup) grup.querySelectorAll('.btn-preset-tgl').forEach(b => b.classList.remove('active'));
    }

    if (typeof callback === 'function') callback();
}

// =========================================================================
// NAVIGASI ANTAR MENU (Keuangan <-> Marketing) — versi ringkas untuk mirror
// Vercel ini (aslinya bukaTab() di Apps Script menangani banyak tab CRM;
// di sini hanya 2 menu: tabKeuangan & tabMarketing).
// =========================================================================
function bukaTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    const target = document.getElementById(tabId);
    if (target) target.classList.add('active');
    if (btnElement) btnElement.classList.add('active');

    const topbarTitle = document.getElementById('topbarTitle');
    if (topbarTitle && btnElement) topbarTitle.textContent = btnElement.textContent.trim();

    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) sidebarEl.classList.remove('open');

    if (tabId === 'tabMarketing' && typeof renderMarketingTab === 'function') {
        renderMarketingTab();
    }
}
