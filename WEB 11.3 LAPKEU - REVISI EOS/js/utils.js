        function rp(num) { return Number(num).toLocaleString('id-ID'); }
        function prc(part, total) { return total==0 ? "0%" : ((part/total)*100).toFixed(1) + "%"; }
        function getTime(d) { return new Date(d).setHours(0,0,0,0); }
        function daysDiff(start, end) { return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (1000*3600*24)); }
        function monthDiff(start, end) { let d1=new Date(start), d2=new Date(end); return (d2.getFullYear()-d1.getFullYear())*12 + (d2.getMonth()-d1.getMonth()); }
        function formatd(iso) { try { let d=new Date(iso); if(isNaN(d))return"-"; return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'2-digit'});}catch(e){return"-";} }
        function formati(iso) { try { let d = new Date(iso); if (isNaN(d.getTime())) return ""; let m = ''+(d.getMonth()+1), day = ''+d.getDate(), y = d.getFullYear(); if(m.length<2) m='0'+m; if(day.length<2) day='0'+day; return [y,m,day].join('-'); } catch(e) { return ""; } }
        function cleanHP(hp) { let s = hp.toString().trim(); return s.startsWith('0') ? '62'+s.substring(1) : s; }

         // --- HELPER DI LUAR FUNGSI ---
function formatTanggalManusia(tglInput) {
    if (!tglInput || tglInput === "-") return "-";
    let d = new Date(tglInput);
    if (isNaN(d.getTime())) return tglInput;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
}

//RUMUS BANTUAN UNTUK MENGHITUNG SELISIH HARI//
// ==========================================
        function daysDiff(tgl1, tgl2) {
            if (!tgl1 || !tgl2) return 0;
            try {
            let d1 = new Date(tgl1);
            let d2 = new Date(tgl2);
        // Hitung selisih waktu dalam milidetik, lalu ubah ke hari
            let diffTime = d2.getTime() - d1.getTime();
            let diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
            return diffDays > 0 ? diffDays : 0; // Jangan biarkan minus
            } catch(e) {
            return 0;
            }
        };
