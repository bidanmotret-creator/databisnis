// =========================================================================
// tenant-config.js — SISTEM CONFIG TERPUSAT (VERSI PROJECT MARKETING BERDIRI SENDIRI)
// =========================================================================
// PENTING: file ini KHUSUS untuk project index-marketing.html (marketing
// standalone) dan TIDAK terhubung/bergantung dengan project index.html
// (gabungan finance+marketing). Keduanya sengaja dua project terpisah;
// masing-masing punya salinan tenant-config.js sendiri yang independen,
// supaya perubahan config di satu project tidak memengaruhi yang lain.
// =========================================================================
// Tujuan: supaya tool ini bisa dipakai untuk bisnis lain hanya dengan
// mengganti isi file ini (atau menariknya dari server per klien),
// TANPA mengubah kode di ui-marketing.js / ui-finance.js / api.js.
//
// CARA PAKAI:
// 1. Load file ini SEBELUM ui-marketing.js / ui-finance.js / api.js
//    di index.html:
//      <script src="tenant-config.js"></script>
//      <script src="utils.js"></script>
//      <script src="ui-finance.js"></script>
//      ...
// 2. Di kode lain, akses lewat variabel global TENANT_CONFIG.
// 3. Untuk klien baru: copy file ini, ganti nilainya, tidak perlu sentuh
//    file .js lain sama sekali (kecuali menambah integrasi baru — lihat
//    catatan INTEGRASI di ui-marketing.js).
//
// Nilai default di bawah ini SENGAJA disetel supaya perilaku tool TETAP
// SAMA seperti sebelum config ini ada (studio foto SentuhanMomen3D).
// Ganti isinya untuk klien lain, jangan ganti strukturnya (supaya kode
// yang membaca TENANT_CONFIG tidak perlu ikut berubah).
// =========================================================================

const TENANT_CONFIG = {

  // -----------------------------------------------------------------------
  // 1. IDENTITAS & FORMAT UMUM
  // -----------------------------------------------------------------------
  meta: {
    namaBisnis: "SentuhanMomen3D",
    mataUang: "Rp",
    localeAngka: "id-ID",
    localeTanggal: "id-ID"
  },

  // -----------------------------------------------------------------------
  // 2. KAMUS LABEL — semua teks UI yang tadinya hardcoded di HTML/JS
  // sebaiknya diambil dari sini. Struktur mengikuti bagian-bagian yang
  // sudah ada di index.html supaya gampang dipetakan satu-satu.
  // -----------------------------------------------------------------------
  labels: {
    funnel: {
      awareness: { title: "AWARENESS", desc: "Seberapa luas iklan dilihat", icon: "👁️" },
      leads:     { title: "LEADS",     desc: "Yang mulai chat",            icon: "💬" },
      closing:   { title: "CLOSING",   desc: "Yang jadi bayar",            icon: "🤝" },
      revenue:   { title: "REVENUE",   desc: "Hasil akhirnya",             icon: "💰" }
    },
    metrik: {
      spend: "Ad Spend",
      reach: "Reach (Org Unik)",
      impressions: "Impresi (Tayang)",
      ctr: "CTR Meta",
      leadsMeta: "Leads (Meta Ads)",
      leadsCrm: "Leads (CRM/Real)",
      matchRate: "Match Rate",
      cpl: "CPL / Lead",
      closing: "Closing (DP+)",
      convRate: "Conv. Rate",
      cac: "CAC / Closing",
      avgTime: "Avg. Waktu Closing",
      omzet: "Total Omzet",
      roas: "ROAS"
    },
    menuKeuangan: {
      jurnal: "Jurnal",
      labaRugi: "Income Statement",
      arusKas: "Cash Statement",
      neraca: "Neraca",
      dupont: "Analisis DuPont",
      rosetta: "Rosetta Stone"
      // dst — tinggal ditambah sesuai kebutuhan, tidak wajib lengkap
      // dari awal karena kode lama tetap fallback ke teks aslinya kalau
      // key belum ada (lihat fungsi ambilLabel() di bawah).
    }
  },

  // -----------------------------------------------------------------------
  // 3. FUNNEL RULES — kondisi yang mendefinisikan tiap tahap funnel.
  // Bisnis lain (bukan jasa foto) bisa punya definisi "closing" & field
  // yang berbeda total, jadi ini dibuat bisa diatur, bukan hardcode
  // `status.includes('DP')` di tengah-tengah fungsi render.
  // -----------------------------------------------------------------------
  funnelRules: {
    leadIdentifierField: "no_hp",     // field yang menandai 1 leads unik
    statusField: "status",
    closingStatusValues: ["DP", "Lunas"],  // status yang dihitung sbg closing
    revenueField: "total",
    tanggalClosingField: "tgl_bayar1"      // dipakai untuk hitung avg waktu closing
  },

  // -----------------------------------------------------------------------
  // 4. MAPPING MINAT/PRODUK DARI KEYWORD CAMPAIGN
  // Dipakai untuk menormalisasi nama campaign yang beragam jadi kategori
  // "minat" yang konsisten. Kalau tidak ada pattern yang cocok, nilai
  // asli (mentah) dipakai sebagai fallback — lihat normalisasiMinat().
  // Urutan penting: pattern pertama yang cocok yang dipakai.
  // -----------------------------------------------------------------------
  minatKeywordMap: [
    // Contoh untuk studio foto (default). Ganti/ isi ulang per klien.
    // { pattern: /newborn/i,          minat: "Newborn" },
    // { pattern: /maternity|hamil/i,  minat: "Maternity" },
    // { pattern: /family|keluarga/i,  minat: "Family" },
  ],

  // -----------------------------------------------------------------------
  // 5. THRESHOLD & WARNA — angka ambang yang sebelumnya hardcoded di
  // banyak tempat (renderBreakdownAdset, renderScorecardMingguan, dst).
  // -----------------------------------------------------------------------
  thresholds: {
    cplMahalRp: 30000,       // di atas ini -> merah di breakdown adset/content
    ctrRendahPersen: 1,      // di bawah ini -> insight "CTR rendah"
    matchRateSehatPersen: 70,// di bawah ini -> insight "match rate rendah"
    roasSehat: 2,            // >= ini -> hijau
    roasTipisBawah: 1,       // < ini -> merah (belum untung), di antara -> kuning
    crSehatPersen: 15,       // scorecard mingguan: >=15% hijau
    crWaspadaPersen: 8,      // 8-15% kuning, <8% merah
    clickToLeadSehatPersen: 15,
    clickToLeadWaspadaPersen: 5,
    adsetBorosMinSpendRp: 5000,     // ambang "boros" utk kandidat terburuk
    polaBerulangMinSpendRp: 15000,  // ambang utk agregasi lintas-campaign
    efisienDariRataRataPersen: 30   // adset "efisien" = CPL < 70% rata-rata (100-30)
  },

  // -----------------------------------------------------------------------
  // 6. TARGET MINGGUAN DEFAULT — pengganti TARGET_DEFAULT_FALLBACK yang
  // sebelumnya konstanta tetap di ui-marketing.js.
  // -----------------------------------------------------------------------
  targetMingguanDefault: {
    closingMin: 5,
    omzetMin: 10000000,
    roasMin: 2,
    creativeBaruMin: 2
  },

  // -----------------------------------------------------------------------
  // 7. FIELD MAP (ADAPTER) — pemetaan nama field di data mentah klien ke
  // nama field internal yang dipakai fungsi render. Kalau data klien lain
  // punya nama kolom beda (mis. "phone" bukan "no_hp"), cukup ubah di sini.
  // -----------------------------------------------------------------------
  fieldMap: {
    leads: {
      noHp: "no_hp",
      nama: "nama",
      minat: "minat",
      status: "status",
      total: "total",
      tanggalChat: "tanggal_chat",
      tglBayar1: "tgl_bayar1"
    },
    ads: {
      spend: "spend",
      campaign: "campaign",
      tanggal: "tanggal",
      results: "results",
      impressions: "impressions",
      reach: "reach",
      linkClicks: "link_clicks",
      namaCampaignMeta: "nama_campaign_meta"
    }
  }
};

// =========================================================================
// HELPER — dipakai bertahap saat mengganti titik-titik hardcoded.
// Aman dipanggil walau sebagian config belum lengkap (fallback ke
// default/teks asli supaya tidak merusak tampilan yang sudah ada).
// =========================================================================

// Ambil label dari kamus, fallback ke teks asli kalau key belum ada.
// Contoh: ambilLabel('funnel.awareness.title', 'AWARENESS')
function ambilLabel(pathDotNotation, fallbackText) {
  try {
    const parts = pathDotNotation.split('.');
    let cur = TENANT_CONFIG.labels;
    for (const p of parts) {
      if (cur == null) return fallbackText;
      cur = cur[p];
    }
    return (cur === undefined || cur === null || cur === '') ? fallbackText : cur;
  } catch (e) {
    return fallbackText;
  }
}

// Ambil threshold, fallback ke nilai default kalau belum diset.
function ambilThreshold(key, fallbackVal) {
  const v = TENANT_CONFIG?.thresholds?.[key];
  return (v === undefined || v === null) ? fallbackVal : v;
}

// Cek apakah sebuah row leads dihitung sebagai "closing", sesuai
// TENANT_CONFIG.funnelRules — pengganti pola `r.status.includes('DP')`
// yang tersebar di ui-marketing.js.
function isClosingRow(row) {
  const rules = TENANT_CONFIG.funnelRules;
  const val = row?.[rules.statusField];
  if (!val) return false;
  return rules.closingStatusValues.some(v => String(val).includes(v));
}

// Normalisasi nama campaign -> kategori minat, berdasarkan
// TENANT_CONFIG.minatKeywordMap. Fallback ke nilai asli kalau tidak ada
// pattern yang cocok (jadi aman dipakai walau map masih kosong).
function normalisasiMinat(namaCampaignAtauMinatAsli) {
  const map = TENANT_CONFIG.minatKeywordMap || [];
  const teks = String(namaCampaignAtauMinatAsli || '');
  for (const rule of map) {
    if (rule.pattern.test(teks)) return rule.minat;
  }
  return namaCampaignAtauMinatAsli; // fallback: pakai apa adanya
}

// Format Rupiah generik pakai mata uang & locale dari config (pengganti
// rp() yang di utils.js masih hardcode 'id-ID').
function formatUang(num) {
  const locale = TENANT_CONFIG?.meta?.localeAngka || 'id-ID';
  const simbol = TENANT_CONFIG?.meta?.mataUang || 'Rp';
  return simbol + ' ' + Math.round(Number(num) || 0).toLocaleString(locale);
}
