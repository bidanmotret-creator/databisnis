// =========================================================================
// ui-antrean.js — Menu "Jurnal Antrean (Audit)" untuk index-keuangan.html
// Alur: draft dari Telegram (teks/foto) -> direview & direvisi di sini ->
// Setujui -> masuk DB_Jurnal (jurnal resmi). Endpoint server: lihat
// patch-backend.gs (getAntreanJurnal, simpanKoreksiAntrean,
// approveAntreanJurnal, tolakAntreanJurnal).
// =========================================================================

let antreanData = [];
let antreanAsli = {};

function antEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function antRp(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }

function antAuditor() {
    const nama = (document.getElementById('antNamaAuditor').value || '').trim();
    const pin = (document.getElementById('antPin').value || '').trim();
    if (nama) { try { localStorage.setItem('antNamaAuditor', nama); } catch (e) {} }
    return { nama, pin };
}

async function antreanMuat() {
    const box = document.getElementById('antreanList');
    if (!box) return;
    const filter = document.getElementById('antFilterStatus').value;
    try {
        await antMuatPengguna();
        const res = await fetchJsonAman(scriptURL + '?action=getAntreanJurnal&status=' + encodeURIComponent(filter));
        if (res.result !== 'success') throw new Error(res.message || 'Respon server tidak dikenal');
        antreanData = res.data || [];
        antreanAsli = {};
        antreanData.forEach(r => { antreanAsli[r.id] = JSON.parse(JSON.stringify(r)); });
        antRenderRingkas(res.ringkas || {});
        antRenderList();
    } catch (err) {
        box.innerHTML = '<div class="ant-empty" style="color:#b91c1c;">❌ Gagal memuat antrean: ' + antEsc(err.message || err) +
            '<br>Pastikan doGet di Code.gs sudah memanggil TGJ_getJson_ (lihat patch-backend.gs).</div>';
    }
}

function antRenderRingkas(r) {
    const tunggu = r['Menunggu Audit'] || 0, koreksi = r['Perlu Koreksi'] || 0;
    document.getElementById('antreanRingkas').innerHTML =
        '<span class="ant-chip ant-menunggu">' + tunggu + ' menunggu audit</span>' +
        '<span class="ant-chip ant-koreksi">' + koreksi + ' perlu koreksi</span>';
    const opt = document.querySelector('#keuanganSubTabSelect option[value="subAntrean"]');
    if (opt) opt.textContent = '📥 Jurnal Antrean (Audit)' + ((tunggu + koreksi) ? ' — ' + (tunggu + koreksi) + ' baru' : '');
}

function antBarisHtml(b) {
    const d = Number(b.debit) > 0 ? Number(b.debit) : '', k = Number(b.kredit) > 0 ? Number(b.kredit) : '';
    return '<tr><td><input type="text" data-b="akun" list="listAkun" value="' + antEsc(b.akun || '') + '" oninput="antHitungKartu(this.closest(\'.ant-card\'))"></td>' +
        '<td><input type="number" data-b="debit" min="0" value="' + d + '" oninput="antHitungKartu(this.closest(\'.ant-card\'))"></td>' +
        '<td><input type="number" data-b="kredit" min="0" value="' + k + '" oninput="antHitungKartu(this.closest(\'.ant-card\'))"></td>' +
        '<td><button type="button" class="ant-x" title="Hapus baris" onclick="antHapusBaris(this)">✕</button></td></tr>';
}

function antHitungKartu(card) {
    if (!card) return;
    const tot = card.querySelector('.ant-tot');
    if (!tot) return;
    let d = 0, k = 0;
    card.querySelectorAll('.ant-lines tbody tr').forEach(tr => {
        d += Number(tr.querySelector('[data-b="debit"]').value) || 0;
        k += Number(tr.querySelector('[data-b="kredit"]').value) || 0;
    });
    const ok = d > 0 && Math.round(d) === Math.round(k);
    tot.textContent = 'Debit ' + antRp(d) + '  |  Kredit ' + antRp(k) + (ok ? '  ✓ seimbang' : '  |  selisih ' + antRp(Math.abs(d - k)));
    tot.style.color = ok ? '#166534' : '#b91c1c';
}

function antBacaBaris(card) {
    const out = [];
    card.querySelectorAll('.ant-lines tbody tr').forEach(tr => {
        const akun = tr.querySelector('[data-b="akun"]').value.trim();
        const debit = Number(tr.querySelector('[data-b="debit"]').value) || 0;
        const kredit = Number(tr.querySelector('[data-b="kredit"]').value) || 0;
        if (akun || debit || kredit) out.push({ akun, debit, kredit });
    });
    return out;
}

function antTambahBaris(id) {
    const tb = document.querySelector('#ant-' + id + ' .ant-lines tbody');
    tb.insertAdjacentHTML('beforeend', antBarisHtml({}));
}
function antHapusBaris(btn) {
    const card = btn.closest('.ant-card');
    btn.closest('tr').remove();
    antHitungKartu(card);
}

// Ubah draft 2-baris menjadi editor multi-baris (nilai yang sudah diketik ikut terbawa)
function antPecahBaris(id) {
    const r = antreanData.find(x => x.id === id), card = document.getElementById('ant-' + id);
    card.querySelectorAll('[data-f]').forEach(el => { r[el.getAttribute('data-f')] = el.value; });
    const nom = Number(r.nominal) || 0;
    r.baris = [{ akun: r.akun_debit, debit: nom, kredit: 0 }, { akun: r.akun_kredit, debit: 0, kredit: nom }];
    r._multi = true;
    card.outerHTML = antCardHtml(r);
    antHitungKartu(document.getElementById('ant-' + id));
}

function antCardHtml(r) {
    const edit = (r.status === 'Menunggu Audit' || r.status === 'Perlu Koreksi');
    const multi = edit && (r.mode === 'multi' || r._multi);
    const dis = edit ? '' : ' disabled';
    const kls = r.status === 'Menunggu Audit' ? 'ant-menunggu' : r.status === 'Perlu Koreksi' ? 'ant-koreksi' : r.status === 'Disetujui' ? 'ant-ok' : 'ant-tolak';
    const id = antEsc(r.id);
    const barisTabel = (r.baris || []).map(b =>
        '<tr><td>' + antEsc(b.kode) + ' ' + antEsc(b.nama || b.akun) + '</td><td class="ant-num">' + (b.debit ? antRp(b.debit) : '') + '</td><td class="ant-num">' + (b.kredit ? antRp(b.kredit) : '') + '</td></tr>').join('');

    let bagianAkun;
    if (multi) {
        const awal = (r.baris || []).map(b => ({ akun: b.akun || (b.kode ? b.kode + ' - ' + b.nama : ''), debit: b.debit, kredit: b.kredit }));
        bagianAkun =
            '<div class="ant-full"><div class="ant-meta" style="margin-bottom:4px;">Baris jurnal (satu nota, beberapa akun)</div>' +
            '<table class="ant-tbl ant-lines"><thead><tr><th>Akun</th><th>Debit</th><th>Kredit</th><th></th></tr></thead><tbody>' + awal.map(antBarisHtml).join('') + '</tbody></table>' +
            '<div class="ant-tot" style="font-size:12.5px;font-weight:700;margin:6px 0;"></div>' +
            '<button type="button" class="ant-btn ant-b-simpan" style="padding:6px 12px;" onclick="antTambahBaris(\'' + id + '\')">+ Tambah baris</button></div>';
    } else {
        bagianAkun =
            '<label>Nominal (Rp)<input type="number" data-f="nominal" value="' + (Number(r.nominal) || 0) + '"' + dis + '></label>' +
            '<label class="ant-full">Akun Debit<input type="text" data-f="akun_debit" list="listAkun" value="' + antEsc(r.akun_debit) + '"' + dis + '></label>' +
            '<label class="ant-full">Akun Kredit<input type="text" data-f="akun_kredit" list="listAkun" value="' + antEsc(r.akun_kredit) + '"' + dis + '></label>';
    }

    return '<div class="ant-card" id="ant-' + id + '">' +
        '<div class="ant-head"><div><b>' + id + '</b> <span class="ant-meta">' + antEsc(r.sumber) + ' dari ' + antEsc(r.pengirim_nama) + ', ' + antEsc(r.waktu) + (r.mode === 'multi' ? ' · multi-baris' : '') + '</span></div>' +
        '<span class="ant-badge ' + kls + '">' + antEsc(r.status) + '</span></div>' +
        (r.peringatan ? '<div class="ant-warn">' + antEsc(r.peringatan).replace(/ \| /g, '<br>') + '</div>' : '') +
        '<div class="ant-grid">' +
        '<label>Tanggal<input type="date" data-f="tgl" value="' + antEsc(r.tgl) + '"' + dis + '></label>' +
        '<label>Vendor<input type="text" data-f="vendor" list="listVendorAntrean" value="' + antEsc(r.vendor) + '"' + dis + '></label>' +
        '<label class="ant-full">Keterangan<input type="text" data-f="desc" value="' + antEsc(r.desc) + '"' + dis + '></label>' +
        bagianAkun +
        '</div>' +
        (r.penjelasan ? '<div class="ant-ai">💡 ' + antEsc(r.penjelasan) + '</div>' : '') +
        (!multi && barisTabel ? '<table class="ant-tbl"><tr><th>Jurnal yang akan diposting</th><th>Debit</th><th>Kredit</th></tr>' + barisTabel + '</table>' : '') +
        (r.url_bukti ? '<div><a href="' + antEsc(r.url_bukti) + '" target="_blank" rel="noopener">📎 Buka bukti nota</a></div>' : '') +
        (edit
            ? '<div class="ant-actions"><button type="button" class="ant-btn ant-b-simpan" onclick="antSimpan(\'' + id + '\')">💾 Simpan revisi</button>' +
              (multi ? '' : '<button type="button" class="ant-btn ant-b-simpan" style="background:#7c3aed;" onclick="antPecahBaris(\'' + id + '\')">🧾 Pecah jadi beberapa baris</button>') +
              '<button type="button" class="ant-btn ant-b-setuju" onclick="antSetujui(\'' + id + '\')">✅ Setujui, masuk jurnal</button>' +
              '<button type="button" class="ant-btn ant-b-tolak" onclick="antTolak(\'' + id + '\')">❌ Tolak</button></div>'
            : (r.mode === 'multi' && barisTabel ? '<table class="ant-tbl"><tr><th>Jurnal</th><th>Debit</th><th>Kredit</th></tr>' + barisTabel + '</table>' : '') +
              '<div class="ant-meta">' + (r.putus_oleh ? 'Diputuskan oleh ' + antEsc(r.putus_oleh) + ', ' + antEsc(r.putus_waktu) : '') + (r.alasan ? '. Alasan: ' + antEsc(r.alasan) : '') + '</div>') +
        '</div>';
}

function antRenderList() {
    const box = document.getElementById('antreanList');
    if (!antreanData.length) {
        box.innerHTML = '<div class="ant-empty">Tidak ada draft untuk status ini. Kirim transaksi (teks atau foto nota) ke topik Catat di Telegram atau lewat kotak di atas, drafnya muncul di sini.</div>';
        return;
    }
    box.innerHTML = antreanData.map(antCardHtml).join('');
    box.querySelectorAll('.ant-card').forEach(antHitungKartu);
}

// Hanya kirim yang berubah dibanding data server. Mode multi: kirim seluruh baris bila ada perubahan.
function antPerubahan(id) {
    const card = document.getElementById('ant-' + id), asli = antreanAsli[id], ov = {};
    card.querySelectorAll('[data-f]').forEach(el => {
        const k = el.getAttribute('data-f');
        if (String(el.value).trim() !== String(asli[k] == null ? '' : asli[k]).trim()) ov[k] = el.value.trim();
    });
    if (card.querySelector('.ant-lines')) {
        const baru = antBacaBaris(card);
        const lama = (asli.mode === 'multi')
            ? (asli.baris || []).map(b => ({ akun: b.akun || (b.kode ? b.kode + ' - ' + b.nama : ''), debit: Number(b.debit) || 0, kredit: Number(b.kredit) || 0 }))
            : null;
        if (!lama || JSON.stringify(lama) !== JSON.stringify(baru)) ov.baris = JSON.stringify(baru);
    }
    return ov;
}

async function antKirim(action, id, extra) {
    const a = antAuditor();
    if (!a.nama) { alert('Isi nama auditor dulu (kolom di atas daftar).'); return null; }
    const fd = new FormData();
    fd.append('action', action); fd.append('idAntrean', id); fd.append('namaAuditor', a.nama);
    if (a.pin) fd.append('pin', a.pin);
    Object.keys(extra || {}).forEach(k => fd.append(k, extra[k]));
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const j = await res.json();
        if (j.result !== 'success') { alert('❌ ' + (j.message || 'Gagal')); return null; }
        return j;
    } catch (err) { alert('❌ Gagal koneksi: ' + err); return null; }
}

async function antSimpan(id) {
    const ov = antPerubahan(id);
    if (!Object.keys(ov).length) { alert('Belum ada yang diubah.'); return; }
    if (await antKirim('simpanKoreksiAntrean', id, { overrideJson: JSON.stringify(ov) })) antreanMuat();
}

async function antSetujui(id) {
    const ov = antPerubahan(id);
    if (!confirm('Setujui draft ' + id + ' dan posting ke jurnal resmi?' + (Object.keys(ov).length ? '\n(Revisi yang belum disimpan ikut diterapkan.)' : ''))) return;
    const extra = Object.keys(ov).length ? { overrideJson: JSON.stringify(ov) } : {};
    if (await antKirim('approveAntreanJurnal', id, extra)) {
        alert('✅ Masuk jurnal resmi.');
        if (typeof tarikDataKeuanganSaja === 'function') tarikDataKeuanganSaja(); else antreanMuat();
    }
}

async function antTolak(id) {
    const alasan = prompt('Alasan menolak draft ' + id + ':');
    if (alasan === null) return;
    if (await antKirim('tolakAntreanJurnal', id, { alasan: alasan || 'Ditolak auditor' })) antreanMuat();
}

// ------------------- Input dari web (teks / foto nota) -------------------
function antStatusBaru(teks, warna) {
    const el = document.getElementById('antStatusBaru');
    el.style.color = warna || '#64748b';
    el.textContent = teks;
}

async function antKirimDraft(action, extra) {
    const nama = (document.getElementById('antNamaPencatat').value || '').trim();
    if (!nama) { alert('Isi nama pencatat dulu.'); return null; }
    try { localStorage.setItem('antNamaPencatat', nama); } catch (e) {}
    const pin = (document.getElementById('antPin').value || '').trim();
    const fd = new FormData();
    fd.append('action', action); fd.append('namaPencatat', nama);
    if (pin) fd.append('pin', pin);
    Object.keys(extra).forEach(k => fd.append(k, extra[k]));
    try {
        const res = await fetch(scriptURL, { method: 'POST', body: fd });
        const j = await res.json();
        if (j.result !== 'success') { antStatusBaru('❌ ' + (j.message || 'Gagal'), '#b91c1c'); return null; }
        return j;
    } catch (err) { antStatusBaru('❌ Gagal koneksi: ' + err, '#b91c1c'); return null; }
}

function antSetelahDraft(j) {
    const ket = j.status === 'Perlu Koreksi'
        ? '⚠️ Draft ' + j.id + ' dibuat, tapi perlu koreksi: ' + j.peringatan
        : '✅ Draft ' + j.id + ' (' + antRp(j.nominal) + ') menunggu audit.';
    antStatusBaru(ket, j.status === 'Perlu Koreksi' ? '#92400e' : '#166534');
    const f = document.getElementById('antFilterStatus');
    f.value = j.status === 'Perlu Koreksi' ? 'Perlu Koreksi' : 'Menunggu Audit';
    antreanMuat();
}

async function antBuatDariTeks() {
    const teks = (document.getElementById('antTeksBaru').value || '').trim();
    if (!teks) { alert('Tulis transaksinya dulu.'); return; }
    const btn = document.getElementById('btnAntTeks'); btn.disabled = true;
    antStatusBaru('⏳ AI sedang membaca transaksi...');
    const j = await antKirimDraft('buatDraftTeksWeb', { teks });
    btn.disabled = false;
    if (j) { document.getElementById('antTeksBaru').value = ''; antSetelahDraft(j); }
}

// Perkecil foto di browser (maks 1600px, JPEG) supaya muat dikirim ke Apps Script
function antKompres(file) {
    return new Promise((resolve, reject) => {
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => {
            const sk = Math.min(1, 1600 / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * sk); c.height = Math.round(img.height * sk);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            URL.revokeObjectURL(url);
            resolve(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Foto tidak bisa dibaca. Pakai JPG/PNG/WebP (bukan HEIC).')); };
        img.src = url;
    });
}

async function antBuatDariFoto(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (!(document.getElementById('antNamaPencatat').value || '').trim()) { alert('Isi nama pencatat dulu.'); input.value = ''; return; }
    antStatusBaru('⏳ Memproses foto & membaca nota...');
    try {
        const base64 = await antKompres(file);
        const caption = (document.getElementById('antTeksBaru').value || '').trim();
        const j = await antKirimDraft('buatDraftFotoWeb', { base64, mimeType: 'image/jpeg', caption });
        if (j) { document.getElementById('antTeksBaru').value = ''; antSetelahDraft(j); }
    } catch (err) { antStatusBaru('❌ ' + err.message, '#b91c1c'); }
    input.value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    try { const n = localStorage.getItem('antNamaPencatat'); if (n) document.getElementById('antNamaPencatat').value = n; } catch (e) {}
});

// ------------------- Daftar pengguna (dropdown) -------------------
let antPenggunaMuat = false;

async function antMuatPengguna() {
    if (antPenggunaMuat) return;
    const selA = document.getElementById('antNamaAuditor'), selP = document.getElementById('antNamaPencatat');
    try {
        const res = await fetchJsonAman(scriptURL + '?action=getPenggunaAntrean');
        if (res.result !== 'success') throw new Error(res.message || 'Respon tidak dikenal');
        const isi = (sel, peran, kunciSimpan) => {
            const daftar = (res.data || []).filter(u => u[peran]);
            sel.innerHTML = '<option value="">' + (daftar.length ? '— pilih nama —' : 'Belum ada di DB_TelegramPengguna') + '</option>' +
                daftar.map(u => '<option value="' + antEsc(u.nama) + '">' + antEsc(u.nama) + (u.adaPin ? '' : ' (PIN belum diatur)') + '</option>').join('');
            try { const t = localStorage.getItem(kunciSimpan); if (t && daftar.some(u => u.nama === t)) sel.value = t; } catch (e) {}
        };
        isi(selA, 'auditor', 'antNamaAuditor');
        isi(selP, 'pencatat', 'antNamaPencatat');
        antPenggunaMuat = true;
    } catch (err) {
        const msg = '<option value="">Gagal memuat daftar nama</option>';
        selA.innerHTML = msg; selP.innerHTML = msg;
        console.error('getPenggunaAntrean:', err);
    }
}
