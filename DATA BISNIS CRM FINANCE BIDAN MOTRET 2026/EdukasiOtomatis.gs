// =========================================================================
// EdukasiOtomatis.gs — rangkaian edukasi otomatis (teks/gambar/link video)
// yang dikirim bertahap dalam jam-jam pertama sejak customer PERTAMA KALI
// chat, terpisah dari alur qualifying/PL. SEKARANG PER PRODUK: tiap
// minat/produk bisa punya rangkaian materi sendiri, dengan fallback ke
// __GLOBAL__ kalau produk itu belum ada rangkaiannya sendiri (atau kalau
// produk customer belum diketahui/masih "Unknown").
//
// Sheet baru yang dipakai (dibuat otomatis kalau belum ada):
// - DB_Edukasi_Sequence : daftar materi per produk + jam pengiriman
// - DB_Edukasi_Terkirim : catatan materi mana yang SUDAH terkirim ke nomor
//                         mana (anti-kirim-dobel)
// =========================================================================

var SHEET_EDUKASI_SEQUENCE = "DB_Edukasi_Sequence";
var SHEET_EDUKASI_TERKIRIM = "DB_Edukasi_Terkirim";
var KOLOM_EDUKASI = ["id", "minat", "jam_setelah_chat", "jenis", "teks_pesan", "url_media", "aktif"];

// Kalau trigger sempat telat/mati, materi yang "harusnya" terkirim tapi
// sudah lewat dari (jam_setelah_chat + TOLERANSI_JAM) tidak dikirim lagi
// (dianggap kadaluarsa) -- supaya tidak nyasar kirim "edukasi jam ke-2"
// ke customer yang sudah chat 3 hari lalu.
var TOLERANSI_JAM_EDUKASI = 4;

// =========================================================================
// A. BACA & SIMPAN PENGATURAN (dipanggil dari dashboard)
// =========================================================================

function getSemuaEdukasiSequence_(ss) {
  var sheet = ss.getSheetByName(SHEET_EDUKASI_SEQUENCE);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getDataRange().getValues();
  var hasil = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var obj = {};
    KOLOM_EDUKASI.forEach(function (key, idx) { obj[key] = data[i][idx]; });
    obj.jam_setelah_chat = Number(obj.jam_setelah_chat) || 0;
    obj.aktif = (obj.aktif === true || obj.aktif === "TRUE");
    hasil.push(obj);
  }
  hasil.sort(function (a, b) { return a.jam_setelah_chat - b.jam_setelah_chat; });
  return hasil;
}

function simpanEdukasiSequence_(ss, daftarMateri) {
  var sheet = ss.getSheetByName(SHEET_EDUKASI_SEQUENCE);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EDUKASI_SEQUENCE);
    sheet.appendRow(KOLOM_EDUKASI);
  }
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, KOLOM_EDUKASI.length).clearContent();

  var rows = daftarMateri.map(function (item) {
    return KOLOM_EDUKASI.map(function (key) {
      if (key === "id") return item.id || ("mat_" + Date.now() + "_" + Math.floor(Math.random() * 1000));
      if (key === "minat") return item.minat || "__GLOBAL__";
      if (key === "aktif") return item.aktif ? "TRUE" : "FALSE";
      if (key === "jam_setelah_chat") return Number(item.jam_setelah_chat) || 0;
      return item[key] !== undefined ? item[key] : "";
    });
  });
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, KOLOM_EDUKASI.length).setValues(rows);
  SpreadsheetApp.flush();
}

// Kelompokkan flat list jadi { [minat]: [item, item, ...] }, dipakai baik
// oleh scan (backend) maupun render per-kartu-produk (frontend).
function kelompokkanEdukasiPerMinat_(daftarMateri) {
  var map = {};
  daftarMateri.forEach(function (item) {
    var key = item.minat || "__GLOBAL__";
    if (!map[key]) map[key] = [];
    map[key].push(item);
  });
  return map;
}

// Ambil rangkaian materi UNTUK SATU PRODUK, fallback ke __GLOBAL__ kalau
// produk itu belum punya rangkaian sendiri (satu set utuh, bukan gabung
// field per field seperti template pesan).
function getEdukasiUntukMinat_(mapPerMinat, minat) {
  var target = String(minat || "").trim();
  if (target && mapPerMinat[target] && mapPerMinat[target].length > 0) return mapPerMinat[target];
  return mapPerMinat["__GLOBAL__"] || [];
}

// =========================================================================
// B. WAKTU CHAT PERTAMA per nomor (dari histori pesan masuk DB_Messages)
// =========================================================================

function kumpulkanWaktuChatPertamaSemuaNomor_(ss) {
  var sheetMsg = ss.getSheetByName(SHEET_MESSAGES);
  var hasil = {};
  if (!sheetMsg || sheetMsg.getLastRow() < 2) return hasil;

  var data = sheetMsg.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var noHp = normalizeTelepon_(data[i][0]);
    if (!noHp) continue;
    var waktuRaw = data[i][3];
    var waktu = (waktuRaw instanceof Date) ? waktuRaw : new Date(String(waktuRaw).replace(" ", "T"));
    if (isNaN(waktu.getTime())) continue;
    if (!hasil[noHp] || waktu < hasil[noHp]) hasil[noHp] = waktu;
  }
  return hasil;
}

function kumpulkanEdukasiSudahTerkirim_(ss) {
  var sheet = ss.getSheetByName(SHEET_EDUKASI_TERKIRIM);
  var set = {};
  if (!sheet || sheet.getLastRow() < 2) return set;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var noHp = normalizeTelepon_(data[i][0]);
    var idMateri = data[i][1];
    if (noHp && idMateri) set[noHp + "|" + idMateri] = true;
  }
  return set;
}

function catatEdukasiTerkirim_(ss, noHp, idMateri, jenis, statusKirim) {
  var sheet = ss.getSheetByName(SHEET_EDUKASI_TERKIRIM);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EDUKASI_TERKIRIM);
    sheet.appendRow(["no_hp", "id_materi", "jenis", "waktu_kirim", "status"]);
  }
  sheet.appendRow([
    noHp, idMateri, jenis || "",
    Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss"),
    statusKirim || "terkirim"
  ]);
}

// =========================================================================
// C. KIRIM GAMBAR via Kirimdev (dokumen & teks sudah ada di
// KirimdevSend.gs, gambar belum -- ditambahkan di sini)
// =========================================================================

function kirimGambarKirimdev_(noTujuan, urlGambar, caption) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('KIRIMDEV_API_KEY');
  var phoneNumberId = '916711704861994';
  if (!apiKey) throw new Error('KIRIMDEV_API_KEY belum diset.');

  var url = 'https://api.kirimdev.com/v1/' + phoneNumberId + '/messages';
  var payload = {
    messaging_product: 'whatsapp',
    to: noTujuan,
    type: 'image',
    image: { link: urlGambar, caption: caption || '' }
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var kodeRespon = res.getResponseCode();
  var isiRespon = res.getContentText();
  Logger.log('Kirim gambar response (' + kodeRespon + '): ' + isiRespon);
  catatPercobaanKirimWa_(noTujuan, 'image', caption || '', kodeRespon, isiRespon);

  if (kodeRespon < 200 || kodeRespon >= 300) {
    throw new Error('Gagal kirim gambar WA ke ' + noTujuan + ' (HTTP ' + kodeRespon + '): ' + isiRespon);
  }
}

// =========================================================================
// D. SCAN & KIRIM (dipicu trigger tiap 15 menit)
// =========================================================================

function scanEdukasiOtomatis() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var semuaMateri = getSemuaEdukasiSequence_(ss).filter(function (m) { return m.aktif; });
  if (semuaMateri.length === 0) return;

  var mapPerMinat = kelompokkanEdukasiPerMinat_(semuaMateri);
  var jamMaksimalGlobal = semuaMateri.reduce(function (mx, m) { return Math.max(mx, m.jam_setelah_chat); }, 0);
  var batasScanJam = jamMaksimalGlobal + TOLERANSI_JAM_EDUKASI;

  var waktuPertamaByHp = kumpulkanWaktuChatPertamaSemuaNomor_(ss);
  var sudahTerkirim = kumpulkanEdukasiSudahTerkirim_(ss);
  var now = new Date();
  var jumlahDikirim = 0;

  Object.keys(waktuPertamaByHp).forEach(function (noHp) {
    var waktuPertama = waktuPertamaByHp[noHp];
    var jamBerlalu = (now - waktuPertama) / 3600000;

    if (jamBerlalu > batasScanJam) return; // lead sudah lama, di luar jangkauan sequence manapun
    if (!nomorWaValid_(noHp)) return;

    // Produk customer ini SAAT INI (bisa berubah seiring waktu, misal awalnya
    // belum kepilih/"Unknown" lalu customer memilih produk tertentu di jam
    // berikutnya -- scan berikutnya otomatis pakai rangkaian produk itu).
    var produkCustomer = ambilProductInterestFollowUp_(ss, noHp) || "Unknown";
    var materiUntukNomor = getEdukasiUntukMinat_(mapPerMinat, produkCustomer);
    if (materiUntukNomor.length === 0) return;

    materiUntukNomor.forEach(function (item) {
      var kunci = noHp + "|" + item.id;
      if (sudahTerkirim[kunci]) return; // sudah pernah dikirim
      if (jamBerlalu < item.jam_setelah_chat) return; // belum waktunya

      if (jamBerlalu > item.jam_setelah_chat + TOLERANSI_JAM_EDUKASI) {
        catatEdukasiTerkirim_(ss, noHp, item.id, item.jenis, "dilewati_kadaluarsa");
        return;
      }

      try {
        if (item.jenis === "gambar") {
          kirimGambarKirimdev_(noHp, item.url_media, item.teks_pesan || "");
        } else if (item.jenis === "video_link") {
          var teksVideo = (item.teks_pesan ? item.teks_pesan + "\n" : "") + item.url_media;
          kirimPesanKirimdev_(noHp, teksVideo);
        } else {
          kirimPesanKirimdev_(noHp, item.teks_pesan || "");
        }
        catatEdukasiTerkirim_(ss, noHp, item.id, item.jenis, "terkirim");
        jumlahDikirim++;
      } catch (errKirim) {
        Logger.log("Gagal kirim edukasi ke " + noHp + " (materi " + item.id + "): " + errKirim.toString());
        catatEdukasiTerkirim_(ss, noHp, item.id, item.jenis, "gagal: " + errKirim.toString().substring(0, 150));
      }
    });
  });

  SpreadsheetApp.flush();
  Logger.log("Scan edukasi otomatis selesai. " + jumlahDikirim + " materi terkirim.");
}

function pasangTriggerEdukasiOtomatis() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scanEdukasiOtomatis') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('scanEdukasiOtomatis')
    .timeBased()
    .everyMinutes(15)
    .create();
  Logger.log('Trigger edukasi otomatis (tiap 15 menit) berhasil dipasang.');
}

function hapusTriggerEdukasiOtomatis() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scanEdukasiOtomatis') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Trigger edukasi otomatis dihapus.');
}
