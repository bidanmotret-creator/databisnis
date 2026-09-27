// =========================================================================
// TAMBAHKAN ke doGet(e), sejajar action lain:
// =========================================================================
if (action === "getEOSDashboard") return getEOSDashboardJson_();

// =========================================================================
// TAMBAHKAN ke doPost(e), sejajar action lain:
// =========================================================================
if (action === "simpanTargetEOS") {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    simpanTargetEOS_(ss, JSON.parse(e.parameter.dataJson));
    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) { return jsonError_(err, action); }
}

if (action === "simpanRocksEOS") {
  try {
    var ss2 = SpreadsheetApp.getActiveSpreadsheet();
    simpanRocks_(ss2, JSON.parse(e.parameter.dataJson));
    return ContentService.createTextOutput(JSON.stringify({ result: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) { return jsonError_(err, action); }
}
