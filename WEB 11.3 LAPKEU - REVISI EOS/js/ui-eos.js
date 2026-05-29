// FUNGSI RENDER EOS (SISI KIRI: TABEL AKTIF)
// ============================================================================

// 1. FUNGSI METRIK (PASTIKAN INI ADA DI ATAS)
// 1. FUNGSI METRIK (DENGAN SABUK PENGAMAN)
function hitungMetrikEksekusi() {
    let elRock = document.getElementById('kpi_rock');
    let elTodo = document.getElementById('kpi_todo');
    let elIssue = document.getElementById('kpi_issue');

    // Hanya update jika elemen kpi_rock masih ada di HTML
    if (elRock) {
        let totalRocks = STUDIO_CONFIG.rocks.length;
        let doneRocks = STUDIO_CONFIG.rocks.filter(r => r.status === 'Done').length;
        elRock.innerText = totalRocks > 0 ? Math.round((doneRocks / totalRocks) * 100) + "%" : "0%";
    }

    if (elTodo) {
        let totalTodos = STUDIO_CONFIG.todos.length;
        let doneTodos = STUDIO_CONFIG.todos.filter(t => t.done).length;
        elTodo.innerText = totalTodos > 0 ? Math.round((doneTodos / totalTodos) * 100) + "%" : "0%";
    }

    if (elIssue) {
        let totalIssues = STUDIO_CONFIG.issues.length;
        let solveIssues = STUDIO_CONFIG.issues.filter(i => i.status === 'Solve').length;
        elIssue.innerText = totalIssues > 0 ? Math.round((solveIssues / totalIssues) * 100) + "%" : "0%";
    }
}

function updateDashboardUI() {
    hitungMetrikEksekusi(); 

    // --- UPDATE LIST PENCAPAIAN LAMA ---
    let pending = [
        ...STUDIO_CONFIG.rocks.filter(r => r.status !== 'Done'),
        ...STUDIO_CONFIG.todos.filter(t => !t.done),
        ...STUDIO_CONFIG.issues.filter(i => i.status !== 'Solve')
    ];

    let done = [
        ...STUDIO_CONFIG.rocks.filter(r => r.status === 'Done'),
        ...STUDIO_CONFIG.todos.filter(t => t.done),
        ...STUDIO_CONFIG.issues.filter(i => i.status === 'Solve')
    ];

    let listAktifEl = document.getElementById('listAktif');
    if (listAktifEl) {
        listAktifEl.innerHTML = pending.length > 0 
            ? pending.map(item => `<div style="padding:2px 0;">• ${item.teks || 'Tugas Baru'}</div>`).join('') 
            : 'Semua target tuntas! 🎉';
    }

    let listPencapaianEl = document.getElementById('listPencapaian');
    if (listPencapaianEl) {
        listPencapaianEl.innerHTML = done.length > 0 
            ? done.map(item => `<div style="padding:2px 0;">✅ ${item.teks || 'Tugas Selesai'}</div>`).join('') 
            : 'Belum ada pencapaian.';
    }

    // --- UPDATE REKAP DASHBOARD BARU (Kolom Rocks, Issues, Todo Aktif) ---
    let rekapRocks = document.getElementById('rekap_rocks_aktif');
    if (rekapRocks) {
        let activeRocks = STUDIO_CONFIG.rocks.filter(r => r.status !== 'Done');
        rekapRocks.innerHTML = activeRocks.length > 0
            ? activeRocks.map(r => `<li>${r.teks || 'Rock Baru'} <span style="color:#2563eb;">(@${r.pic || '?'})</span></li>`).join('')
            : '<li>🎉 Semua Rocks Selesai!</li>';
    }

    let rekapIssues = document.getElementById('rekap_issues_aktif');
    if (rekapIssues) {
        let activeIssues = STUDIO_CONFIG.issues.filter(i => i.status !== 'Solve');
        rekapIssues.innerHTML = activeIssues.length > 0
            ? activeIssues.map(i => `<li>${i.teks || 'Issue Baru'} <span style="color:#2563eb;">(@${i.pic || '?'})</span></li>`).join('')
            : '<li>🎉 Tidak ada masalah!</li>';
    }

    let rekapTodo = document.getElementById('rekap_todo_aktif');
    if (rekapTodo) {
        let activeTodos = STUDIO_CONFIG.todos.filter(t => !t.done);
        rekapTodo.innerHTML = activeTodos.length > 0
            ? activeTodos.map(t => `<li>${t.teks || 'Tugas Baru'} <span style="color:#2563eb;">(@${t.pic || '?'})</span></li>`).join('')
            : '<li>🎉 Semua tugas tuntas!</li>';
    }

    // Render ulang tabel
    renderRocks();
    renderTodos();
    renderIssuesIDS();
}

// --- RENDER ROCKS ---
// --- RENDER ROCKS (SUDAH DISERAGAMKAN DENGAN ISSUES & TODO) ---
function renderRocks() {
    let tbody = document.getElementById('listRocks');
    if (!tbody) return;
    
    tbody.innerHTML = STUDIO_CONFIG.rocks.map((r, i) => `
        <tr style="border-bottom:1px solid #e2e8f0; display: ${r.status === 'Done' ? 'none' : 'table-row'};">
            
            <td data-label="Kuartal" style="padding:10px;">
                <input type="text" class="eos-input" value="${r.kuartal||''}" onchange="updateArray('rocks', ${i}, 'kuartal', this.value)" 
                style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px;">
            </td>
            
            <td data-label="Nama Rock" style="padding:10px;">
                <input type="text" class="eos-input" value="${r.teks||''}" onchange="updateArray('rocks', ${i}, 'teks', this.value)" 
                style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px;">
            </td>
            
            <td data-label="PIC" style="padding:10px;">
                <input type="text" class="eos-input" value="${r.pic||''}" onchange="updateArray('rocks', ${i}, 'pic', this.value)" 
                style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px;">
            </td>
            
            <td data-label="Status" style="padding:10px;">
                <select class="eos-input" onchange="updateArray('rocks', ${i}, 'status', this.value)" 
                style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; font-size:14px; cursor:pointer;">
                    <option value="On Track" ${r.status === 'On Track' ? 'selected' : ''}>🟢 Track</option>
                    <option value="Off Track" ${r.status === 'Off Track' ? 'selected' : ''}>🔴 Off</option>
                    <option value="Done" ${r.status === 'Done' ? 'selected' : ''}>✅ Done</option>
                </select>
            </td>
            
            <td data-label="Aksi" style="text-align:center; padding:10px;">
                <button onclick="hapusArrayItem('rocks', ${i})" 
                style="background:#fee2e2; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;" title="Hapus Rock">
                    🗑️
                </button>
            </td>
            
        </tr>
    `).join('');
}

function tambahRock() {
    STUDIO_CONFIG.rocks.push({ kuartal: "", teks: "", pic: "", status: "On Track" });
    updateDashboardUI();
}

// --- RENDER TODOS ---
function renderTodos() {
    let tbody = document.getElementById('listTodos');
    if (!tbody) return;
    
    let issueOptions = '<option value="">-- Tidak Terkait --</option>' + 
        (STUDIO_CONFIG.issues || []).map(iss => `<option value="${iss.teks}">${iss.teks.substring(0,20)}...</option>`).join('');

    tbody.innerHTML = STUDIO_CONFIG.todos.map((t, i) => `
        <tr style="border-bottom:1px solid #e2e8f0; ${t.done ? 'background:#f0fdf4;' : ''}">
            <td data-label="Done" style="padding:10px; text-align:center;"><input type="checkbox" ${t.done ? 'checked' : ''} onchange="updateArray('todos', ${i}, 'done', this.checked)"></td>
            <td data-label="Detail Tugas" style="padding:10px;">
                <input type="text" class="eos-input" value="${t.teks||''}" onchange="updateArray('todos', ${i}, 'teks', this.value)" 
                style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px;">
            </td>
            <td data-label="Berasal dari Issue?" style="padding:10px;"><select class="eos-input" onchange="updateArray('todos', ${i}, 'issue_terkait', this.value)">${issueOptions.replace(`value="${t.issue_terkait || ''}"`, `value="${t.issue_terkait || ''}" selected`)}</select></td>
            <td data-label="PIC" style="padding:10px;"><input type="text" class="eos-input" value="${t.pic||''}" onchange="updateArray('todos', ${i}, 'pic', this.value)" style="width:80px;"></td>
            <td data-label="Batas Waktu" style="padding:10px;"><input type="date" class="eos-input" value="${t.deadline ? t.deadline.split('T')[0] : ''}" onchange="updateArray('todos', ${i}, 'deadline', this.value)"></td>
            <td data-label="Aksi" style="text-align:center;"><button onclick="hapusArrayItem('todos', ${i})" style="background:#fee2e2; border:none; padding:6px; cursor:pointer;">🗑️</button></td>
        </tr>
    `).join('');
}

function tambahTodo() {
    STUDIO_CONFIG.todos.push({ teks: "", pic: "", deadline: "", done: false, issue_terkait: "" });
    updateDashboardUI();
}

// --- RENDER ISSUES ---
function renderIssuesIDS() {
    let tbody = document.getElementById('listIssuesIDS');
    if (!tbody) return;
    let rocksOptions = '<option value="">-- Rock --</option>' + STUDIO_CONFIG.rocks.map(r => `<option value="${r.teks}">${r.teks}</option>`).join('');

    tbody.innerHTML = STUDIO_CONFIG.issues.map((iss, i) => `
        <tr style="border-bottom:1px solid #e2e8f0; display: ${iss.status === 'Solve' ? 'none' : 'table-row'};">
            <td data-label="Tgl Dibuat" style="padding:6px;"><input type="date" class="eos-input input-date" value="${iss.tglDibuat ? iss.tglDibuat.split('T')[0] : ''}" onchange="updateArray('issues', ${i}, 'tglDibuat', this.value)"></td>
            <td data-label="Prio" style="padding:6px;"><select class="eos-input input-pic" onchange="updateArray('issues', ${i}, 'prio', this.value)"><option value="Tinggi">🔥 T</option><option value="Sedang">⚡ S</option><option value="Rendah">❄️ R</option></select></td>
            <td data-label="Masalah (Issue)" style="padding:6px;"><textarea class="eos-input input-area" rows="2" onchange="updateArray('issues', ${i}, 'teks', this.value)">${iss.teks||''}</textarea></td>
            <td data-label="DIV" style="padding:6px;"><input type="text" class="eos-input input-pic" value="${iss.divisi||''}" onchange="updateArray('issues', ${i}, 'divisi', this.value)"></td>
            <td data-label="PIC" style="padding:6px;"><input type="text" class="eos-input input-pic" value="${iss.pic||''}" onchange="updateArray('issues', ${i}, 'pic', this.value)"></td>
            <td data-label="Batas Waktu" style="padding:6px;"><input type="date" class="eos-input input-date" value="${iss.deadline ? iss.deadline.split('T')[0] : ''}" onchange="updateArray('issues', ${i}, 'deadline', this.value)"></td>
            <td data-label="Tgl Selesai" style="padding:6px;"><input type="date" class="eos-input input-date" value="${iss.tglSolve ? iss.tglSolve.split('T')[0] : ''}" onchange="updateArray('issues', ${i}, 'tglSolve', this.value)"></td>
            <td data-label="Status" style="padding:6px;"><select class="eos-input" onchange="updateArray('issues', ${i}, 'status', this.value)"><option value="Issue">🔴 Issue</option><option value="Discuss">🟡 Discuss</option><option value="Solve">🟢 Solve</option></select></td>
            <td data-label="Solusi / Discuss" style="padding:6px;"><textarea class="eos-input input-area" rows="2" onchange="updateArray('issues', ${i}, 'discuss', this.value)">${iss.discuss||''}</textarea></td>
            <td data-label="Rock Terkait" style="padding:6px;"><select class="eos-input" onchange="updateArray('issues', ${i}, 'rock', this.value)">${rocksOptions.replace(`value="${iss.rock}"`, `value="${iss.rock}" selected`)}</select></td>
            <td data-label="Bukti" style="padding:6px;"><input type="text" class="eos-input input-pic" value="${iss.bukti||''}" onchange="updateArray('issues', ${i}, 'bukti', this.value)"></td>
            <td data-label="Aksi" style="text-align:center;"><button onclick="hapusArrayItem('issues', ${i})" style="background:#fee2e2; border:none; border-radius:4px; padding:6px; cursor:pointer;">🗑️</button></td>
        </tr>
    `).join('');
}

function tambahIssue() {
    let today = new Date().toISOString().split('T')[0];
    STUDIO_CONFIG.issues.push({ tglDibuat: today, prio: "Sedang", teks: "", divisi: "", pic: "", deadline: "", tglSolve: "", status: "Issue", discuss: "", rock: "", bukti: "" });
    updateDashboardUI();
}

// --- UTILITY ---
function updateArray(tipe, index, key, value) {
    STUDIO_CONFIG[tipe][index][key] = value;
    updateDashboardUI();
}

function hapusArrayItem(tipe, index) {
    if (confirm("Hapus baris ini?")) {
        STUDIO_CONFIG[tipe].splice(index, 1);
        updateDashboardUI();
    }
}

function renderOrgChart() {
    let container = document.getElementById('orgContainer');
    container.innerHTML = '';
    
    let defaultOrg = [
        {title: "Visionary", name: "", roles: "1. Ide & Visi Baru\n2. Hubungan Strategis\n3. Budaya Perusahaan", level: "1"},
        {title: "Integrator", name: "Karvien", roles: "1. Eksekusi Rencana Bisnis\n2. Menyatukan Tim (LMA)\n3. P&L (Laba Rugi)", level: "1"},
        {title: "Manager Marketing", name: "", roles: "1. Meta Ads Optimization\n2. Funneling Strategy\n3. Konten Sosmed", level: "2"},
        {title: "Staff Marketing / Editor", name: "", roles: "1. Edit Hasil Foto\n2. Jadwal Posting\n3. Balas Chat Awal", level: "3"}
    ];
    
    let orgData = STUDIO_CONFIG.orgChart && STUDIO_CONFIG.orgChart.length > 0 ? STUDIO_CONFIG.orgChart : defaultOrg;
    orgData.forEach(box => { 
        tambahOrgBox(box.title, box.name, box.roles, box.level || "1"); 
    });
}

function tambahOrgBox(t = "", n = "", r = "", lvl = "1") {
    let container = document.getElementById('orgContainer');
    let boxHtml = `
        <div class="org-box lvl-${lvl}">
            <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 12px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 5px;">
                <span style="font-weight:800; color:var(--text-light); font-size:11px;">📍 ATUR POSISI:</span>
                <div style="display:flex; gap:4px;">
                    <button type="button" class="ctrl-btn" onclick="geserBox(this, 'atas')" title="Geser Naik">🔼</button>
                    <button type="button" class="ctrl-btn" onclick="geserBox(this, 'bawah')" title="Geser Turun">🔽</button>
                </div>
            </div>
            
            <label>Tingkatan Jabatan (Hirarki)</label>
            <select class="org-level" onchange="updateWarnaBox(this)">
                <option value="1" ${lvl === "1" ? "selected" : ""}>⭐ Level 1: Core / Direksi</option>
                <option value="2" ${lvl === "2" ? "selected" : ""}>⚡ Level 2: Manajer / Head</option>
                <option value="3" ${lvl === "3" ? "selected" : ""}>👥 Level 3: Staff / Eksekutor</option>
            </select>

            <label>Posisi / Peran</label>
            <input type="text" class="org-title" value="${t}" placeholder="Cth: Manajer Operasional" style="font-weight:bold;">
            
            <label>Nama Pengemban</label>
            <input type="text" class="org-name" value="${n}" placeholder="Cth: Budi">
            
            <label>Tanggung Jawab Utama</label>
            <textarea class="org-roles" rows="5" placeholder="1.\n2.\n3.">${r}</textarea>
            
            <button type="button" onclick="this.parentElement.remove()" style="background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:11px; width:100%; font-weight:bold; margin-top:5px;">🗑️ Hapus Posisi</button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', boxHtml);
}

window.geserBox = function(btn, arah) {
    let box = btn.closest('.org-box');
    if (arah === 'atas') {
        let prev = box.previousElementSibling;
        if (prev) box.parentElement.insertBefore(box, prev);
    } else {
        let next = box.nextElementSibling;
        if (next) box.parentElement.insertBefore(next, box);
    }
};

window.updateWarnaBox = function(selectEl) {
    let box = selectEl.closest('.org-box');
    box.className = 'org-box lvl-' + selectEl.value;
};

function hitungStrategi() {
    let target = parseFloat(document.getElementById('calc_target_omzet').value) || 0;
    let aov = parseFloat(document.getElementById('calc_aov').value) || 0;
    let cr = (parseFloat(document.getElementById('calc_closing_rate').value) || 0) / 100;
    let cpl = parseFloat(document.getElementById('calc_cpl').value) || 0;

    let resBox = document.getElementById('calc_result');

    if(target > 0 && aov > 0 && cr > 0) {
        let targetSales = Math.ceil(target / aov);
        let targetLeads = Math.ceil(targetSales / cr);
        let dailyLeads = Math.ceil(targetLeads / 30);
        let adBudget = targetLeads * cpl;

        document.getElementById('res_sales').innerText = targetSales + " Klien";
        document.getElementById('res_leads').innerText = targetLeads + " Leads";
        document.getElementById('res_leads_daily').innerText = dailyLeads + " Leads/hari";
        document.getElementById('res_budget').innerText = "Rp " + adBudget.toLocaleString('id-ID');
        
        resBox.style.display = 'block';
    } else {
        resBox.style.display = 'none';
    }
}