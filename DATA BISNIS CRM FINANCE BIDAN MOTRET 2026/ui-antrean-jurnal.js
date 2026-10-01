// =========================================================================
// ui-antrean-jurnal.js — Panel audit untuk draft jurnal dari Telegram.
// Pasang SETELAH ui-finance.js & api-keuangan.js di index-keuangan.html:
//   <div id="antreanJurnalPanel"></div>     (taruh di sub-tab Jurnal / Audit)
//   <script src="ui-antrean-jurnal.js"></script>
// Memakai: scriptURL, fetchJsonAman, dataFinance.accounts, tarikDataKeuanganSaja.
// =========================================================================
(function () {
  var statusFilter = 'Menunggu Audit';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rp(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }
  function namaAuditor() {
    var n = '';
    try { n = localStorage.getItem('antrean_nama_auditor') || ''; } catch (e) { }
    if (!n) { n = (prompt('Nama Anda sebagai auditor:') || '').trim(); if (n) try { localStorage.setItem('antrean_nama_auditor', n); } catch (e) { } }
    return n;
  }
  function ambil(id) { var el = document.getElementById(id); return el ? el.value : ''; }

  async function post(action, params) {
    var fd = new FormData();
    fd.append('action', action);
    Object.keys(params).forEach(function (k) { fd.append(k, params[k]); });
    var res = await fetch(scriptURL, { method: 'POST', body: fd });
    return res.json();
  }

  function overrideDari(id) {
    return {
      tgl: ambil('aj_tgl_' + id), nominal: ambil('aj_nom_' + id), desc: ambil('aj_desc_' + id),
      akun_debit: ambil('aj_deb_' + id), akun_kredit: ambil('aj_kre_' + id)
    };
  }

  window.antreanSimpan = async function (id) {
    var n = namaAuditor(); if (!n) return;
    var r = await post('simpanKoreksiAntrean', { idAntrean: id, namaAuditor: n, overrideJson: JSON.stringify(overrideDari(id)) });
    if (r.result !== 'success') return alert('❌ ' + (r.message || 'Gagal simpan'));
    muatAntreanJurnal();
  };
  window.antreanSetujui = async function (id) {
    var n = namaAuditor(); if (!n) return;
    if (!confirm('Setujui & posting ke jurnal resmi?\n(Setelah posting, koreksi lewat jurnal balik / Tutup Buku rules.)')) return;
    var r = await post('approveAntreanJurnal', { idAntrean: id, namaAuditor: n, overrideJson: JSON.stringify(overrideDari(id)) });
    if (r.result !== 'success') return alert('❌ ' + (r.message || 'Gagal'));
    muatAntreanJurnal();
    if (typeof tarikDataKeuanganSaja === 'function') tarikDataKeuanganSaja();
  };
  window.antreanTolak = async function (id) {
    var n = namaAuditor(); if (!n) return;
    var alasan = prompt('Alasan penolakan:'); if (alasan === null) return;
    var r = await post('tolakAntreanJurnal', { idAntrean: id, namaAuditor: n, alasan: alasan });
    if (r.result !== 'success') return alert('❌ ' + (r.message || 'Gagal'));
    muatAntreanJurnal();
  };
  window.antreanGantiFilter = function (v) { statusFilter = v; muatAntreanJurnal(); };

  function kartu(r) {
    var bisaEdit = r.status === 'Menunggu Audit' || r.status === 'Perlu Koreksi';
    var warna = r.status === 'Disetujui' ? '#16a34a' : (r.status === 'Menunggu Audit' ? '#d97706' : (r.status === 'Perlu Koreksi' ? '#dc2626' : '#6b7280'));
    var ro = bisaEdit ? '' : ' disabled';
    var inp = 'style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box"';
    return '<div style="border:1px solid #e5e7eb;border-left:4px solid ' + warna + ';border-radius:8px;padding:12px;margin-bottom:10px;background:#fff">' +
      '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:12px;color:#6b7280">' +
      '<span><b>' + esc(r.id) + '</b> · ' + esc(r.pengirim_nama) + ' · ' + esc(r.sumber) + ' · ' + esc(r.waktu) + '</span>' +
      '<span style="color:' + warna + ';font-weight:600">' + esc(r.status) + '</span></div>' +
      (r.peringatan ? '<div style="margin:6px 0;font-size:12px;color:#b45309;white-space:pre-line">' + esc(String(r.peringatan).split(' | ').join('\n')) + '</div>' : '') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:8px">' +
      '<label style="font-size:12px">Tanggal<input id="aj_tgl_' + r.id + '" type="date" value="' + esc(r.tgl) + '" ' + inp + ro + '></label>' +
      '<label style="font-size:12px">Nominal<input id="aj_nom_' + r.id + '" type="number" value="' + (r.nominal || 0) + '" ' + inp + ro + '></label>' +
      '<label style="font-size:12px">Akun Debit<input id="aj_deb_' + r.id + '" list="ajAkunList" value="' + esc(r.akun_debit) + '" ' + inp + ro + '></label>' +
      '<label style="font-size:12px">Akun Kredit<input id="aj_kre_' + r.id + '" list="ajAkunList" value="' + esc(r.akun_kredit) + '" ' + inp + ro + '></label>' +
      '</div>' +
      '<label style="font-size:12px;display:block;margin-top:8px">Keterangan<input id="aj_desc_' + r.id + '" value="' + esc(r.desc) + '" ' + inp + ro + '></label>' +
      (r.penjelasan ? '<div style="font-size:12px;color:#4b5563;margin-top:6px">💡 ' + esc(r.penjelasan) + '</div>' : '') +
      '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      (r.url_bukti ? '<a href="' + esc(r.url_bukti) + '" target="_blank" rel="noopener">📎 Lihat bukti</a>' : '<span style="font-size:12px;color:#9ca3af">Tanpa bukti</span>') +
      (bisaEdit ?
        '<button onclick="antreanSimpan(\'' + r.id + '\')" style="padding:6px 10px">💾 Simpan koreksi</button>' +
        (r.status === 'Menunggu Audit' ? '<button onclick="antreanSetujui(\'' + r.id + '\')" style="padding:6px 10px;background:#16a34a;color:#fff;border:0;border-radius:6px">✅ Setujui</button>' : '') +
        '<button onclick="antreanTolak(\'' + r.id + '\')" style="padding:6px 10px;background:#dc2626;color:#fff;border:0;border-radius:6px">❌ Tolak</button>'
        : (r.putus_oleh ? '<span style="font-size:12px;color:#6b7280">Diputuskan ' + esc(r.putus_oleh) + ' · ' + esc(r.putus_waktu) + (r.alasan ? ' · ' + esc(r.alasan) : '') + '</span>' : '')) +
      '</div></div>';
  }

  window.muatAntreanJurnal = async function () {
    var box = document.getElementById('antreanJurnalPanel');
    if (!box) return;
    box.innerHTML = '<div style="padding:12px;color:#6b7280">⏳ Memuat antrean...</div>';
    try {
      var d = await fetchJsonAman(scriptURL + '?action=getAntreanJurnal&status=' + encodeURIComponent(statusFilter));
      var akun = (typeof dataFinance !== 'undefined' && dataFinance.accounts) ? dataFinance.accounts : [];
      var opsi = ['Menunggu Audit', 'Perlu Koreksi', 'Disetujui', 'Ditolak', 'Dibatalkan', 'Semua'].map(function (s) {
        return '<option' + (s === statusFilter ? ' selected' : '') + '>' + s + '</option>';
      }).join('');
      var rg = d.ringkas || {};
      box.innerHTML =
        '<datalist id="ajAkunList">' + akun.map(function (a) { return '<option value="' + esc(a.kode + ' - ' + a.nama) + '">'; }).join('') + '</datalist>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">' +
        '<b>📥 Antrean Audit Jurnal Telegram</b>' +
        '<span style="font-size:12px;background:#fef3c7;padding:2px 8px;border-radius:99px">Menunggu: ' + (rg['Menunggu Audit'] || 0) + '</span>' +
        '<span style="font-size:12px;background:#fee2e2;padding:2px 8px;border-radius:99px">Perlu koreksi: ' + (rg['Perlu Koreksi'] || 0) + '</span>' +
        '<select onchange="antreanGantiFilter(this.value)">' + opsi + '</select>' +
        '<button onclick="muatAntreanJurnal()">🔄</button></div>' +
        ((d.data || []).length ? d.data.map(kartu).join('') : '<div style="padding:12px;color:#6b7280">Tidak ada data untuk filter ini.</div>');
    } catch (err) {
      box.innerHTML = '<div style="padding:12px;color:#dc2626">❌ Gagal memuat antrean: ' + esc(err) + '</div>';
    }
  };

  document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { if (document.getElementById('antreanJurnalPanel')) muatAntreanJurnal(); }, 800); });
})();
