// =========================================================================
// EOSDashboard.gs — Weekly Scorecard & Quarterly Rocks ala EOS
// (Entrepreneurial Operating System), dihitung dari data yang SUDAH ada
// di sheet (Leads, Journey History, Follow-up State, WA Send Log, AI
// Analysis/Error Log) -- tidak perlu input manual kecuali Rocks.
//
// Sheet baru (dibuat otomatis):
// - DB_EOS_Target : target tiap metrik scorecard (key-value, bisa diedit
//                   dari dashboard)
// - DB_EOS_Rocks  : daftar Rocks kuartalan (prioritas 90 hari) per pemilik
// =========================================================================

var SHEET_EOS_TARGET = "DB_EOS_Target";
var SHEET_EOS_ROCKS = "DB_EOS_Rocks";

var TARGET_DEFAULT_EOS = {
  leads_baru: 10,
  leads_masuk_followup: 8,
  pl_terkirim: 8,
  closing: 3,
  tingkat_konversi_90hr: 15, // persen
  ai_error_rate: 5,          // persen, target MAKSIMAL (semakin kecil semakin baik)
  pesan_terkirim: 50
};

// =========================================================================
// A. TARGET (bisa diedit dari dashboard)
// =========================================================================

function getTargetEOS_(ss) {
  var sheet = ss.getSheetByName(SHEET_EOS_TARGET);
  var hasil = Object.assign({}, TARGET_DEFAULT_EOS);
  if (!sheet || sheet.getLastRow() < 2) return hasil;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var key = data[i][0];
    if (hasil.hasOwnProperty(key)) hasil[key] = Number(data[i][1]) || hasil[key];
  }
  return hasil;
}

function simpanTargetEOS_(ss, targetBaru) {
  var sheet = ss.getSheetByName(SHEET_EOS_TARGET);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EOS_TARGET);
    sheet.appendRow(["metrik", "target"]);
  }
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  var rows = Object.keys(TARGET_DEFAULT_EOS).map(function (key) {
    return [key, Number(targetBaru[key]) || TARGET_DEFAULT_EOS[key]];
  });
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  SpreadsheetApp.flush();
}

// =========================================================================
// B. HITUNG ANGKA SCORECARD untuk 1 rentang waktu [mulai, sampai)
// =========================================================================

function _dalamRentang_(waktuRaw, mulai, sampai) {
  var w = (waktuRaw instanceof Date) ? waktuRaw : new Date(String(waktuRaw).replace(" ", "T"));
  if (isNaN(w.getTime())) return false;
  return w >= mulai && w < sampai;
}

// Leads Baru = nomor HP yang MUNCUL PERTAMA KALI (di seluruh histori sheet)
// dalam rentang waktu ini -- bukan cuma hitung baris. Kalau ada baris
// dobel untuk nomor yang sama (repeat customer chat lagi, atau baris
// duplikat), tetap dihitung 1x sesuai tanggal kemunculan PERTAMANYA saja.
function hitungLeadsBaru_(ss, mulai, sampai) {
  var sheet = ss.getSheetByName(SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var data = sheet.getDataRange().getValues();

  var tanggalPertamaByHp = {};
  for (var i = 1; i < data.length; i++) {
    var noHp = normalizeTelepon_(data[i][2]); // kolom C = no HP di SHEET_LEADS
    if (!noHp) continue;
    var tglRaw = data[i][0];
    var tgl = (tglRaw instanceof Date) ? tglRaw : new Date(String(tglRaw).replace(" ", "T"));
    if (isNaN(tgl.getTime())) continue;
    if (!tanggalPertamaByHp[noHp] || tgl < tanggalPertamaByHp[noHp]) tanggalPertamaByHp[noHp] = tgl;
  }

  var n = 0;
  Object.keys(tanggalPertamaByHp).forEach(function (noHp) {
    var tglPertama = tanggalPertamaByHp[noHp];
    if (tglPertama >= mulai && tglPertama < sampai) n++;
  });
  return n;
}

function hitungLeadsMasukFollowUp_(ss, mulai, sampai) {
  var sheet = ss.getSheetByName(SHEET_FOLLOWUP_STATE);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var data = sheet.getDataRange().getValues();
  var setNomor = {};
  for (var i = 1; i < data.length; i++) {
    var stage = Number(data[i][1]) || 0;
    if (stage <= 0) continue;
    if (_dalamRentang_(data[i][3], mulai, sampai)) {
      setNomor[normalizeTelepon_(data[i][0])] = true;
    }
  }
  return Object.keys(setNomor).length;
}

function hitungPlTerkirim_(ss, mulai, sampai) {
  var sheet = ss.getSheetByName(SHEET_WA_SEND_LOG);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var data = sheet.getDataRange().getValues();
  var n = 0;
  for (var i = 1; i < data.length; i++) {
    var jenis = String(data[i][2] || "");
    var berhasil = (data[i][6] === true || data[i][6] === "TRUE");
    if (jenis.indexOf("document") === 0 && berhasil && _dalamRentang_(data[i][0], mulai, sampai)) n++;
  }
  return n;
}

function hitungPesanTerkirim_(ss, mulai, sampai) {
  var sheet = ss.getSheetByName(SHEET_WA_SEND_LOG);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var data = sheet.getDataRange().getValues();
  var n = 0;
  for (var i = 1; i < data.length; i++) {
    var berhasil = (data[i][6] === true || data[i][6] === "TRUE");
    if (berhasil && _dalamRentang_(data[i][0], mulai, sampai)) n++;
  }
  return n;
}

function hitungClosing_(ss, mulai, sampai) {
  var sheet = ss.getSheetByName(SHEET_JOURNEY_HISTORY);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  var data = sheet.getDataRange().getValues();
  var setKode = {};
  for (var i = 1; i < data.length; i++) {
    var tahapBaru = String(data[i][3] || "");
    if (tahapBaru !== "Purchase") continue;
    if (_dalamRentang_(data[i][5], mulai, sampai)) setKode[data[i][0]] = true;
  }
  return Object.keys(setKode).length;
}

function hitungAiErrorRate_(ss, mulai, sampai) {
  var sheetErr = ss.getSheetByName(SHEET_AI_ERROR_LOG);
  var sheetAnalisis = ss.getSheetByName(SHEET_AI_ANALYSIS);
  var jumlahError = 0, jumlahTotal = 0;

  if (sheetErr && sheetErr.getLastRow() > 1) {
    var dataErr = sheetErr.getDataRange().getValues();
    for (var i = 1; i < dataErr.length; i++) {
      if (_dalamRentang_(dataErr[i][0], mulai, sampai)) jumlahError++;
    }
  }
  if (sheetAnalisis && sheetAnalisis.getLastRow() > 1) {
    var dataAn = sheetAnalisis.getDataRange().getValues();
    for (var j = 1; j < dataAn.length; j++) {
      if (_dalamRentang_(dataAn[j][10], mulai, sampai)) jumlahTotal++;
    }
  }
  jumlahTotal += jumlahError; // error juga termasuk 1 "percobaan" AI
  if (jumlahTotal === 0) return 0;
  return Math.round((jumlahError / jumlahTotal) * 1000) / 10; // 1 desimal
}

// =========================================================================
// C. RINGKASAN MINGGUAN (7 hari terakhir) + STATUS vs TARGET
// =========================================================================

function getRingkasanEOSMingguan_(ss) {
  var sekarang = new Date();
  var mulaiMinggu = new Date(sekarang.getTime() - 7 * 86400000);
  var mulai90Hari = new Date(sekarang.getTime() - 90 * 86400000);

  var target = getTargetEOS_(ss);

  var leadsBaru = hitungLeadsBaru_(ss, mulaiMinggu, sekarang);
  var leadsMasukFu = hitungLeadsMasukFollowUp_(ss, mulaiMinggu, sekarang);
  var plTerkirim = hitungPlTerkirim_(ss, mulaiMinggu, sekarang);
  var closing = hitungClosing_(ss, mulaiMinggu, sekarang);
  var pesanTerkirim = hitungPesanTerkirim_(ss, mulaiMinggu, sekarang);
  var aiErrorRate = hitungAiErrorRate_(ss, mulaiMinggu, sekarang);

  var leadsBaru90 = hitungLeadsBaru_(ss, mulai90Hari, sekarang);
  var closing90 = hitungClosing_(ss, mulai90Hari, sekarang);
  var tingkatKonversi90 = leadsBaru90 > 0 ? Math.round((closing90 / leadsBaru90) * 1000) / 10 : 0;

  function baris(label, key, nilai, satuan, semakinKecilLebihBaik) {
    var targetNilai = target[key];
    var tercapai = semakinKecilLebihBaik ? (nilai <= targetNilai) : (nilai >= targetNilai);
    return { label: label, key: key, nilai: nilai, target: targetNilai, satuan: satuan || "", status: tercapai ? "hijau" : "merah" };
  }

  return {
    periode: Utilities.formatDate(mulaiMinggu, "GMT+7", "d MMM") + " – " + Utilities.formatDate(sekarang, "GMT+7", "d MMM yyyy"),
    scorecard: [
      baris("Leads Baru", "leads_baru", leadsBaru),
      baris("Leads Masuk Follow-Up", "leads_masuk_followup", leadsMasukFu),
      baris("PL Terkirim", "pl_terkirim", plTerkirim),
      baris("Closing (Purchase)", "closing", closing),
      baris("Tingkat Konversi (rolling 90 hari)", "tingkat_konversi_90hr", tingkatKonversi90, "%"),
      baris("AI Error Rate", "ai_error_rate", aiErrorRate, "%", true),
      baris("Total Pesan WA Terkirim", "pesan_terkirim", pesanTerkirim)
    ]
  };
}

// =========================================================================
// D. TREN MINGGUAN (untuk chart kuartalan -- 13 minggu terakhir)
// =========================================================================

function getTrenKonversiMingguan_(ss, jumlahMinggu) {
  jumlahMinggu = jumlahMinggu || 13;
  var hasil = [];
  var sekarang = new Date();

  for (var m = jumlahMinggu - 1; m >= 0; m--) {
    var sampai = new Date(sekarang.getTime() - m * 7 * 86400000);
    var mulai = new Date(sampai.getTime() - 7 * 86400000);

    var leadsBaru = hitungLeadsBaru_(ss, mulai, sampai);
    var closing = hitungClosing_(ss, mulai, sampai);

    hasil.push({
      label: Utilities.formatDate(mulai, "GMT+7", "d MMM"),
      leads_baru: leadsBaru,
      closing: closing,
      tingkat_konversi: leadsBaru > 0 ? Math.round((closing / leadsBaru) * 1000) / 10 : null
    });
  }
  return hasil;
}

// =========================================================================
// E. ROCKS KUARTALAN (prioritas 90 hari, diisi manual dari dashboard)
// =========================================================================

var KOLOM_ROCKS = ["id", "quarter", "pemilik", "deskripsi", "target_selesai", "status", "catatan_progress"];

function getSemuaRocks_(ss) {
  var sheet = ss.getSheetByName(SHEET_EOS_ROCKS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var hasil = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var obj = {};
    KOLOM_ROCKS.forEach(function (key, idx) { obj[key] = data[i][idx]; });
    hasil.push(obj);
  }
  return hasil;
}

function simpanRocks_(ss, daftarRocks) {
  var sheet = ss.getSheetByName(SHEET_EOS_ROCKS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EOS_ROCKS);
    sheet.appendRow(KOLOM_ROCKS);
  }
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, KOLOM_ROCKS.length).clearContent();

  var rows = daftarRocks.map(function (item) {
    return KOLOM_ROCKS.map(function (key) {
      if (key === "id") return item.id || ("rock_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
      return item[key] !== undefined ? item[key] : "";
    });
  });
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, KOLOM_ROCKS.length).setValues(rows);
  SpreadsheetApp.flush();
}

// =========================================================================
// G. DETEKSI NOMOR DUPLIKAT (kualitas data) -- dipisah: yang sudah pernah
// closing (Purchase) vs yang belum, supaya kelihatan mana duplikat yang
// "aman" (repeat customer wajar) vs yang perlu dibersihkan/di-follow-up.
// =========================================================================

function hitungNomorDuplikat_(ss) {
  var sheet = ss.getSheetByName(SHEET_LEADS);
  if (!sheet || sheet.getLastRow() < 2) {
    return { totalNomorUnik: 0, totalNomorDuplikat: 0, duplikatSudahBeli: [], duplikatBelumBeli: [] };
  }
  var data = sheet.getDataRange().getValues();

  // Nomor yang SUDAH DITANDAI MANUAL oleh CS (lewat tombol "Bukan Duplikat"
  // di CRM) sebagai transaksi terpisah yang sah -- dikecualikan dari daftar
  // ini supaya konsisten dengan keputusan yang sudah diambil CS, bukan
  // ditampilkan lagi seolah-olah belum ditangani.
  var dikecualikan = {};
  var sheetExc = ss.getSheetByName(SHEET_DUPLIKAT_EXCLUDED);
  if (sheetExc && sheetExc.getLastRow() > 1) {
    var dataExc = sheetExc.getDataRange().getValues();
    for (var e = 1; e < dataExc.length; e++) {
      if (dataExc[e][0]) dikecualikan[String(dataExc[e][0])] = true;
    }
  }

  // Kumpulkan semua baris per nomor HP
  var barisByHp = {};
  for (var i = 1; i < data.length; i++) {
    var noHp = normalizeTelepon_(data[i][2]); // kolom C = no HP
    if (!noHp) continue;
    if (!barisByHp[noHp]) barisByHp[noHp] = [];
    barisByHp[noHp].push({ rowIndex: i + 1, nama: data[i][1] || "", tahap: data[i][39] || "" });
  }

  // Nomor yang PERNAH closing (Purchase), dicek dari Journey History supaya
  // tidak bergantung sepenuhnya pada kolom tahap_journey di Leads (yang
  // hanya simpan status TERAKHIR per baris).
  var pernahPurchase = {};
  var sheetJH = ss.getSheetByName(SHEET_JOURNEY_HISTORY);
  if (sheetJH && sheetJH.getLastRow() > 1) {
    var dataJH = sheetJH.getDataRange().getValues();
    for (var j = 1; j < dataJH.length; j++) {
      if (String(dataJH[j][3] || "") === "Purchase") {
        pernahPurchase[normalizeTelepon_(dataJH[j][1])] = true;
      }
    }
  }

  var duplikatSudahBeli = [];
  var duplikatBelumBeli = [];
  var totalUnik = 0;

  Object.keys(barisByHp).forEach(function (noHp) {
    totalUnik++;
    var baris = barisByHp[noHp];
    if (baris.length <= 1) return; // bukan duplikat
    if (dikecualikan[noHp]) return; // sudah ditandai CS sebagai repeat order yang sah

    var sudahBeli = pernahPurchase[noHp] ||
      baris.some(function (b) { return String(b.tahap) === "Purchase" || String(b.tahap) === "Completed"; });

    var entry = {
      no_hp: noHp,
      nama: baris[baris.length - 1].nama, // ambil nama dari baris terakhir
      jumlah_baris: baris.length,
      nomor_baris: baris.map(function (b) { return b.rowIndex; })
    };

    if (sudahBeli) duplikatSudahBeli.push(entry);
    else duplikatBelumBeli.push(entry);
  });

  return {
    totalNomorUnik: totalUnik,
    totalNomorDuplikat: duplikatSudahBeli.length + duplikatBelumBeli.length,
    duplikatSudahBeli: duplikatSudahBeli,
    duplikatBelumBeli: duplikatBelumBeli
  };
}


function getEOSDashboardJson_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hasil = {
    result: "success",
    ringkasanMingguan: getRingkasanEOSMingguan_(ss),
    trenMingguan: getTrenKonversiMingguan_(ss, 13),
    rocks: getSemuaRocks_(ss),
    target: getTargetEOS_(ss),
    kualitasData: hitungNomorDuplikat_(ss)
  };
  return ContentService.createTextOutput(JSON.stringify(hasil)).setMimeType(ContentService.MimeType.JSON);
}
