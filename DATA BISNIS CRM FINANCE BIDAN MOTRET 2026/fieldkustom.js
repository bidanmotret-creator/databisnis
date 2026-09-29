// fieldkustom.js — Modul 5 Field Kustom (frontend untuk crm.html)
// Butuh: scriptURL (crm.html), fetchJsonAman (api-crm.js), modalKode (ui-crm.js).
// Dua bagian:
//   A. Field kustom di dalam modal "Edit Lead" (dimuat otomatis saat modal terbuka)
//   B. Editor definisi field (tombol "🧩 Field Kustom" di topbar)
(function () {
  'use strict';

  function fkEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // =====================================================================
  // A. FIELD KUSTOM DI MODAL EDIT LEAD
  // =====================================================================
  var fkDef = [];            // definisi yang berlaku untuk lead yang sedang dibuka
  var fkStatus = 'idle';     // idle | memuat | ok | gagal
  var fkModalTerbuka = false;

  function fkBox() { return document.getElementById('mFieldKustom'); }

  function fkKodeAktif() {
    try { return (typeof modalKode !== 'undefined' && modalKode) ? String(modalKode) : ''; }
    catch (e) { return ''; }
  }

  function fkInputHtml(d, nilai) {
    var v = nilai == null ? '' : String(nilai);
    var attr = ' data-fk="' + fkEsc(d.key) + '"';
    if (d.tipe === 'pilihan') {
      return '<select' + attr + '><option value=""></option>' +
        (d.pilihan || []).map(function (p) {
          return '<option value="' + fkEsc(p) + '"' + (p === v ? ' selected' : '') + '>' + fkEsc(p) + '</option>';
        }).join('') + '</select>';
    }
    if (d.tipe === 'ya_tidak') {
      return '<select' + attr + '><option value=""></option>' +
        '<option value="ya"' + (v === 'ya' ? ' selected' : '') + '>Ya</option>' +
        '<option value="tidak"' + (v === 'tidak' ? ' selected' : '') + '>Tidak</option></select>';
    }
    if (d.tipe === 'tanggal') return '<input type="date"' + attr + ' value="' + fkEsc(v) + '">';
    if (d.tipe === 'angka') return '<input type="text" inputmode="decimal"' + attr + ' value="' + fkEsc(v) + '">';
    return '<input type="text" maxlength="1000"' + attr + ' value="' + fkEsc(v) + '">';
  }

  function fkRender(definisi, nilai) {
    var box = fkBox();
    if (!box) return;
    if (!definisi.length) { box.innerHTML = ''; return; }
    var html = '<div style="border-top:1px dashed #cbd5e1; margin-top:4px; padding-top:10px;">' +
      '<div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:8px;">🧩 Field Kustom</div>' +
      '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">';
    definisi.forEach(function (d) {
      var n = nilai[d.key];
      html += '<div><label>' + fkEsc(d.label) +
        (d.wajib ? ' <span style="color:#dc2626;">*</span>' : '') +
        (n && n.sumber === 'chat' ? ' <span style="font-weight:600; color:#0369a1;">· dari chat</span>' : '') +
        '</label>' + fkInputHtml(d, n ? n.nilai : '') +
        (d.petunjuk ? '<small style="color:#94a3b8;">' + fkEsc(d.petunjuk) + '</small>' : '') +
        '</div>';
    });
    html += '</div></div>';
    box.innerHTML = html;
  }

  async function fkMuat() {
    var box = fkBox();
    if (!box) return;
    var kode = fkKodeAktif();
    fkDef = [];
    if (!kode) { fkStatus = 'idle'; box.innerHTML = ''; return; }
    fkStatus = 'memuat';
    box.innerHTML = '<small style="color:#94a3b8;">Memuat field kustom…</small>';
    try {
      var r = await fetchJsonAman(scriptURL + '?action=getFieldKustomLead&kode=' + encodeURIComponent(kode));
      if (kode !== fkKodeAktif()) return; // modal sudah ditutup / ganti lead
      fkDef = r.definisi || [];
      fkRender(fkDef, r.nilai || {});
      fkStatus = 'ok';
    } catch (err) {
      if (kode !== fkKodeAktif()) return;
      fkStatus = 'gagal';
      box.innerHTML = '<small style="color:#b45309;">⚠️ Field kustom gagal dimuat (' + fkEsc(err.message) +
        '). Simpan tetap jalan tanpa field kustom. <a href="#" onclick="fkMuat(); return false;">Coba lagi</a></small>';
    }
  }

  // Dipanggil simpanLead(). Return { ok, pesan?, data } — data null = jangan kirim apa-apa.
  function fkAmbilNilai() {
    if (fkStatus === 'memuat') return { ok: false, pesan: 'Field kustom masih dimuat, tunggu sebentar lalu klik Simpan lagi.' };
    if (fkStatus !== 'ok') return { ok: true, data: null };
    var box = fkBox(), data = {}, wajibKosong = [], salah = [];
    fkDef.forEach(function (d) {
      var el = box.querySelector('[data-fk="' + d.key + '"]');
      if (!el) return;
      var v = String(el.value || '').trim();
      if (!v) { if (d.wajib) wajibKosong.push(d.label); data[d.key] = ''; return; }
      if (d.tipe === 'angka' && !/^-?\d+([.,]\d+)?$/.test(v)) { salah.push(d.label + ' harus berupa angka'); return; }
      data[d.key] = v;
    });
    var pesan = [];
    if (wajibKosong.length) pesan.push('Wajib diisi: ' + wajibKosong.join(', '));
    if (salah.length) pesan.push(salah.join('; '));
    if (pesan.length) return { ok: false, pesan: pesan.join('\n') };
    return { ok: true, data: data };
  }

  // Dipanggil simpanLead() setelah sukses: kembalikan teks peringatan (atau '').
  function fkPeringatan(r) {
    if (!r) return '';
    var out = [];
    if (r.fieldKustomDitolak && r.fieldKustomDitolak.length) out.push('Nilai tidak valid, tidak disimpan: ' + r.fieldKustomDitolak.join(', '));
    if (typeof r.fieldKustom === 'string' && r.fieldKustom.indexOf('error') === 0) out.push('Field kustom gagal disimpan (' + r.fieldKustom + ')');
    return out.length ? '⚠️ Data lead tersimpan, tetapi:\n- ' + out.join('\n- ') : '';
  }

  // Muat otomatis tiap modal Edit Lead terbuka, tanpa perlu mengubah ui-crm.js.
  function fkPasangObserver() {
    var modal = document.getElementById('modalCrm');
    if (!modal) return;
    new MutationObserver(function () {
      var buka = getComputedStyle(modal).display !== 'none';
      if (buka && !fkModalTerbuka) {
        fkModalTerbuka = true;
        fkMuat();
      } else if (!buka && fkModalTerbuka) {
        fkModalTerbuka = false; fkStatus = 'idle'; fkDef = [];
        var b = fkBox(); if (b) b.innerHTML = '';
      }
    }).observe(modal, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  // =====================================================================
  // B. EDITOR DEFINISI FIELD
  // =====================================================================
  var FK_TIPE = [['teks', 'Teks'], ['angka', 'Angka'], ['tanggal', 'Tanggal'], ['pilihan', 'Pilihan'], ['ya_tidak', 'Ya / Tidak']];
  var fkEdit = [];        // state editor
  var fkMinatDasar = [];  // daftar minat dari server

  function fkSlug(s) {
    var k = String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!/^[a-z]/.test(k)) k = 'f_' + k;
    return k.substring(0, 40).replace(/_+$/, '');
  }

  function fkPasangEditor() {
    var st = document.createElement('style');
    st.textContent =
      '#modalFieldKustom{display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9300;align-items:center;justify-content:center;padding:16px}' +
      '#modalFieldKustom .fkbox{background:#fff;border-radius:14px;width:100%;max-width:900px;max-height:92vh;display:flex;flex-direction:column}' +
      '.fk-card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;margin-bottom:10px}' +
      '.fk-g{display:grid;grid-template-columns:2fr 1.4fr 1fr;gap:8px}' +
      '@media(max-width:640px){.fk-g{grid-template-columns:1fr}}' +
      '.fk-card label{display:block;font-size:11px;font-weight:700;color:#475569;margin:6px 0 3px}' +
      '.fk-card input[type=text],.fk-card select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:6px;padding:7px 9px;font-size:13px}' +
      '.fk-card input[readonly]{background:#f1f5f9;color:#64748b}' +
      '.fk-chip{display:inline-flex;align-items:center;gap:4px;margin:2px 12px 2px 0;font-size:12px;font-weight:600}' +
      '.fk-chip input{width:auto}';
    document.head.appendChild(st);

    var m = document.createElement('div');
    m.id = 'modalFieldKustom';
    m.innerHTML =
      '<div class="fkbox">' +
      '<div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
      '<h3 style="margin:0;font-size:15px;">🧩 Field Kustom per Industri</h3>' +
      '<div style="display:flex;gap:6px;">' +
      '<button type="button" class="btn-co-secondary" onclick="fkTambah()">➕ Tambah Field</button>' +
      '<button type="button" class="btn-co-secondary" onclick="tutupEditorFieldKustom()">✖ Tutup</button>' +
      '</div></div>' +
      '<div style="padding:16px;overflow:auto;">' +
      '<p style="font-size:12px;color:#64748b;margin-top:0;">Field tambahan yang muncul di form Edit Lead. <b>Kunci</b> dipakai untuk mengaitkan data (huruf kecil/angka/_) dan tidak bisa diubah setelah disimpan. ' +
      'Kalau kunci sama dengan informasi di Alur Klasifikasi, isiannya otomatis terisi dari chat. ' +
      '<b>Berlaku untuk minat</b> dikosongkan = semua produk. Menghapus field TIDAK menghapus nilai yang sudah tersimpan.</p>' +
      '<div id="fkList"></div>' +
      '</div>' +
      '<div style="padding:12px 18px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:8px;">' +
      '<button type="button" class="btn-co-secondary" onclick="tutupEditorFieldKustom()">Batal</button>' +
      '<button type="button" class="btn-co-primary" id="fkBtnSimpan" onclick="fkSimpanDefinisi()">💾 Simpan Field</button>' +
      '</div></div>';
    document.body.appendChild(m);

    m.addEventListener('change', function (e) {
      if (e.target && e.target.getAttribute('data-f') === 'tipe') {
        var card = e.target.closest('.fk-card');
        var w = card && card.querySelector('.fk-pilihan-wrap');
        if (w) w.style.display = e.target.value === 'pilihan' ? 'block' : 'none';
      }
    });
  }

  function fkMinatGabungan() {
    var set = {}, out = [];
    function tambah(x) { x = String(x || '').trim(); if (x && !set[x.toLowerCase()]) { set[x.toLowerCase()] = true; out.push(x); } }
    fkMinatDasar.forEach(tambah);
    fkEdit.forEach(function (f) { (f.minat || []).forEach(tambah); });
    return out;
  }

  function fkRenderEditor() {
    var box = document.getElementById('fkList');
    if (!fkEdit.length) {
      box.innerHTML = '<p style="color:#94a3b8;font-size:13px;">Belum ada field. Klik ➕ Tambah Field.</p>';
      return;
    }
    var minatList = fkMinatGabungan();
    box.innerHTML = fkEdit.map(function (f, i) {
      var tipeOpts = FK_TIPE.map(function (t) {
        return '<option value="' + t[0] + '"' + (f.tipe === t[0] ? ' selected' : '') + '>' + t[1] + '</option>';
      }).join('');
      var chips = minatList.length ? minatList.map(function (m) {
        var on = (f.minat || []).some(function (x) { return String(x).toLowerCase() === m.toLowerCase(); });
        return '<label class="fk-chip"><input type="checkbox" data-minat value="' + fkEsc(m) + '"' + (on ? ' checked' : '') + '> ' + fkEsc(m) + '</label>';
      }).join('') : '<small style="color:#94a3b8;">Belum ada daftar minat.</small>';
      return '<div class="fk-card" data-i="' + i + '">' +
        '<div class="fk-g">' +
        '<div><label>Label (tampil di form)</label><input type="text" data-f="label" maxlength="60" value="' + fkEsc(f.label) + '"></div>' +
        '<div><label>Kunci' + (f.lama ? ' (terkunci)' : ' (kosong = otomatis dari label)') + '</label><input type="text" data-f="key" maxlength="40" value="' + fkEsc(f.key) + '"' + (f.lama ? ' readonly' : '') + '></div>' +
        '<div><label>Tipe</label><select data-f="tipe">' + tipeOpts + '</select></div>' +
        '</div>' +
        '<div class="fk-pilihan-wrap" style="display:' + (f.tipe === 'pilihan' ? 'block' : 'none') + ';"><label>Daftar pilihan (pisahkan dengan koma)</label>' +
        '<input type="text" data-f="pilihan" value="' + fkEsc(f.pilihanText) + '" placeholder="Contoh: Kecil, Sedang, Besar"></div>' +
        '<label>Berlaku untuk minat (kosong = semua produk)</label><div>' + chips + '</div>' +
        '<label>Petunjuk input (opsional)</label><input type="text" data-f="petunjuk" value="' + fkEsc(f.petunjuk) + '">' +
        '<div style="display:flex;align-items:center;gap:14px;margin-top:10px;flex-wrap:wrap;">' +
        '<label class="fk-chip" style="margin:0;"><input type="checkbox" data-f="wajib"' + (f.wajib ? ' checked' : '') + '> Wajib diisi</label>' +
        '<label class="fk-chip" style="margin:0;"><input type="checkbox" data-f="aktif"' + (f.aktif ? ' checked' : '') + '> Aktif</label>' +
        '<span style="margin-left:auto;display:flex;gap:6px;">' +
        '<button type="button" class="btn-co-secondary" style="padding:4px 9px;font-size:12px;" onclick="fkGeser(' + i + ',-1)">↑</button>' +
        '<button type="button" class="btn-co-secondary" style="padding:4px 9px;font-size:12px;" onclick="fkGeser(' + i + ',1)">↓</button>' +
        '<button type="button" class="btn-co-secondary" style="padding:4px 9px;font-size:12px;color:#b91c1c;" onclick="fkHapus(' + i + ')">🗑 Hapus</button>' +
        '</span></div></div>';
    }).join('');
  }

  // Salin isian di layar ke state supaya tidak hilang saat render ulang.
  function fkSinkron() {
    var cards = document.querySelectorAll('#fkList .fk-card');
    Array.prototype.forEach.call(cards, function (c) {
      var f = fkEdit[Number(c.getAttribute('data-i'))];
      if (!f) return;
      function el(n) { return c.querySelector('[data-f="' + n + '"]'); }
      f.label = el('label').value;
      if (!f.lama) f.key = el('key').value.trim().toLowerCase();
      f.tipe = el('tipe').value;
      f.pilihanText = el('pilihan').value;
      f.petunjuk = el('petunjuk').value;
      f.wajib = el('wajib').checked;
      f.aktif = el('aktif').checked;
      f.minat = Array.prototype.map.call(c.querySelectorAll('[data-minat]:checked'), function (x) { return x.value; });
    });
  }

  async function bukaEditorFieldKustom() {
    var m = document.getElementById('modalFieldKustom');
    var box = document.getElementById('fkList');
    m.style.display = 'flex';
    box.innerHTML = '<p style="color:#94a3b8;">Memuat…</p>';
    try {
      var r = await fetchJsonAman(scriptURL + '?action=getFieldKustom');
      fkMinatDasar = r.daftarMinat || [];
      fkEdit = (r.definisi || []).map(function (d) {
        return {
          key: d.key, label: d.label, tipe: d.tipe, wajib: !!d.wajib,
          pilihanText: (d.pilihan || []).join(', '), minat: d.minat || [],
          petunjuk: d.petunjuk || '', aktif: d.aktif !== false, lama: true
        };
      });
      fkRenderEditor();
    } catch (err) {
      box.innerHTML = '<p style="color:#ef4444;">❌ Gagal memuat: ' + fkEsc(err.message) + '</p>';
    }
  }

  function tutupEditorFieldKustom() {
    document.getElementById('modalFieldKustom').style.display = 'none';
  }

  function fkTambah() {
    fkSinkron();
    fkEdit.push({ key: '', label: '', tipe: 'teks', wajib: false, pilihanText: '', minat: [], petunjuk: '', aktif: true, lama: false });
    fkRenderEditor();
    var box = document.getElementById('fkList');
    if (box && box.parentNode) box.parentNode.scrollTop = box.parentNode.scrollHeight;
  }

  function fkGeser(i, arah) {
    fkSinkron();
    var j = i + arah;
    if (j < 0 || j >= fkEdit.length) return;
    var t = fkEdit[i]; fkEdit[i] = fkEdit[j]; fkEdit[j] = t;
    fkRenderEditor();
  }

  function fkHapus(i) {
    fkSinkron();
    var f = fkEdit[i];
    if (!f) return;
    if (!confirm('Hapus field "' + (f.label || f.key || 'baru') + '" dari daftar? Nilai yang sudah tersimpan di lead TIDAK ikut terhapus.')) return;
    fkEdit.splice(i, 1);
    fkRenderEditor();
  }

  async function fkSimpanDefinisi() {
    fkSinkron();
    var list = [], dipakai = {};
    fkEdit.forEach(function (f) { if (f.lama) dipakai[f.key] = true; });

    for (var i = 0; i < fkEdit.length; i++) {
      var f = fkEdit[i];
      if (!f.lama && !String(f.label).trim() && !f.key) continue; // baris kosong dilewati
      if (!String(f.label).trim()) { alert('⚠️ Field #' + (i + 1) + ': label wajib diisi.'); return; }
      var key = f.key;
      if (!key) {
        var dasar = fkSlug(f.label), n = 2;
        key = dasar;
        while (dipakai[key]) { key = dasar.substring(0, 37) + '_' + n; n++; }
        dipakai[key] = true;
      }
      list.push({
        key: key,
        label: String(f.label).trim(),
        tipe: f.tipe,
        wajib: !!f.wajib,
        pilihan: f.tipe === 'pilihan' ? f.pilihanText.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [],
        minat: f.minat || [],
        petunjuk: String(f.petunjuk || '').trim(),
        aktif: !!f.aktif
      });
    }

    var btn = document.getElementById('fkBtnSimpan');
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try {
      var p = new URLSearchParams();
      p.append('action', 'simpanFieldKustom');
      p.append('dataJson', JSON.stringify(list));
      var r = await fetchJsonAman(scriptURL, { method: 'POST', body: p });
      if (r.result === 'success') {
        alert('✅ ' + (r.data && r.data.tersimpan != null ? r.data.tersimpan : list.length) + ' field kustom tersimpan.');
        tutupEditorFieldKustom();
      } else {
        alert('❌ Gagal: ' + (r.message || 'unknown'));
      }
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      btn.disabled = false; btn.textContent = '💾 Simpan Field';
    }
  }

  // =====================================================================
  // Ekspor ke global (dipakai onclick HTML & api-crm.js) + inisialisasi
  // =====================================================================
  window.fkMuat = fkMuat;
  window.fkAmbilNilai = fkAmbilNilai;
  window.fkPeringatan = fkPeringatan;
  window.bukaEditorFieldKustom = bukaEditorFieldKustom;
  window.tutupEditorFieldKustom = tutupEditorFieldKustom;
  window.fkTambah = fkTambah;
  window.fkGeser = fkGeser;
  window.fkHapus = fkHapus;
  window.fkSimpanDefinisi = fkSimpanDefinisi;

  function init() { fkPasangEditor(); fkPasangObserver(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
