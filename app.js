// ==========================================
// 1. 全域變數與資料庫定義
// ==========================================

// 職級與月目標資料庫 (投影片 P.10 績效目標)
const TARGETS_DB = {
  OA: {
    sales: { // 營業同仁
      1: { sales: 20, newDev: 2, newMach: 2 }, // 業績(萬元), 新開發台數, 新機台數
      2: { sales: 30, newDev: 2, newMach: 2 },
      3: { sales: 40, newDev: 3, newMach: 3 },
      4: { sales: 45, newDev: 3, newMach: 3 }
    },
    supervisor: { // 營業主任
      4: { sales: 45, newDev: 3, newMach: 3 },
      5: { sales: 50, newDev: 3, newMach: 3 },
      6: { sales: 55, newDev: 3, newMach: 3 }
    }
  },
  CA: {
    sales: { // CA 營業同仁
      1: { sales: 40, newDev: 1, newMach: 1 }, // 業績(萬元), 交換機目標, MFP銷售目標(新機+舊機)
      2: { sales: 60, newDev: 1, newMach: 1 },
      3: { sales: 80, newDev: 2, newMach: 2 },
      4: { sales: 100, newDev: 2, newMach: 2 }
    },
    supervisor: { // CA 營業主任
      4: { sales: 100, newDev: 2, newMach: 2 },
      5: { sales: 120, newDev: 2, newMach: 2 },
      6: { sales: 130, newDev: 2, newMach: 2 }
    }
  }
};

// 租機獎金費率對照表 (投影片 P.6 租機獎金)
const RENTAL_RATES = {
  existing: { // 現有顧客
    blackPP: 1600, blackHigh: 1300, blackMed: 1000, blackLow: 700,
    colorPP: 2500, colorHigh: 2000, colorMed: 1500, colorLow: 1000,
    old: 500
  },
  newDev: { // 新開發顧客
    blackPP: 2100, blackHigh: 1800, blackMed: 1500, blackLow: 1200,
    colorPP: 3000, colorHigh: 2500, colorMed: 2000, colorLow: 1500,
    old: 1000
  }
};

// 狀態管理
let currentTab = 'appraisal';
let outrightCounter = 0;
let rentalCounter = 0;
let teamMembers = [{ id: 1, level: 1 }, { id: 2, level: 1 }]; // 預設 2 位組員，職級皆為 1
let memberIdCounter = 2;


// ==========================================
// 2. 系統啟動初始化
// ==========================================
window.onload = function() {
  // 初始化分頁顯示
  switchTab('appraisal');
  
  // 嘗試從本地載入存檔，若無存檔則執行預設初始化
  const hasSavedState = loadAppState();
  if (!hasSavedState) {
    onAppraisalConfigChange();
  }

  const tbody = document.getElementById('appr-input-tbody');
  if (tbody) {
    tbody.addEventListener('input', () => {
      saveAppState();
      showSaveStatus();
    });
  }

  
  // 成交獎金預設新增一列
  addOutrightRow();
  addRentalRow();
};


// ==========================================
// 3. 通用功能: 分頁切換
// ==========================================
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));

  if (tabId === 'appraisal') {
    document.querySelector('.tab-btn[onclick="switchTab(\'appraisal\')"]').classList.add('active');
    document.getElementById('tab-appraisal').classList.add('active');
  } else {
    document.querySelector('.tab-btn[onclick="switchTab(\'commission\')"]').classList.add('active');
    document.getElementById('tab-commission').classList.add('active');
  }
}

// ==========================================
// 4. 績效考核模組 (Appraisal Module)
// ==========================================

// 當下拉選單配置改變時
function onAppraisalConfigChange() {
  const channel = document.getElementById('appr-channel').value;
  const role = document.getElementById('appr-role').value;
  const levelSelect = document.getElementById('appr-level');
  
  // 1. 根據身分動態填入可選職級
  const oldLevelVal = levelSelect.value;
  levelSelect.innerHTML = '';
  
  const levels = Object.keys(TARGETS_DB[channel][role]);
  levels.forEach(lvl => {
    const opt = document.createElement('option');
    opt.value = lvl;
    opt.textContent = `職級 ${lvl}`;
    levelSelect.appendChild(opt);
  });
  
  // 儘量保留原本的職級選擇，如果不合法則選第一個
  if (levels.includes(oldLevelVal)) {
    levelSelect.value = oldLevelVal;
  } else {
    levelSelect.value = levels[0];
  }

  // 2. 根據考評目的設定預設統計月數
  const mode = document.getElementById('appr-mode').value;


  // 3. 營業主任編制卡片顯示切換
  const teamConfigWrap = document.getElementById('supervisor-team-config-wrap');
  if (role === 'supervisor') {
    teamConfigWrap.style.display = 'block';
    renderTeamMembersList();
  } else {
    teamConfigWrap.style.display = 'none';
  }

  // 4. 重繪逐月輸入表格
  renderInputTable();
  saveAppState();
}



// 根據考評目的獲取月數
function getEvaluationMonths() {
  const mode = document.getElementById('appr-mode').value;
  if (mode === 'promotion-sup' || mode === 'probation') {
    return 3;
  }
  return 6;
}

// 重繪逐月輸入表格
function renderInputTable() {
  const channel = document.getElementById('appr-channel').value;
  const role = document.getElementById('appr-role').value;
  const level = document.getElementById('appr-level').value;
  const mode = document.getElementById('appr-mode').value;
  const isProbation = (mode === 'probation');
  const isFirstMonthZero = false;
  const monthsCount = getEvaluationMonths();
  
  // 更新徽章數字
  document.getElementById('month-count-badge').textContent = `${monthsCount} 個月`;

  // 獲取目前角色的月目標設定
  const targets = TARGETS_DB[channel][role][level];

  // 欄位標題定義
  let col2Name = channel === 'OA' ? 'MFP新開發 (台)' : '交換機銷售 (台)';
  let col3Name = channel === 'OA' ? 'MFP新機 (台)' : 'MFP銷售 (台)';

  const headerRow = document.getElementById('table-header-row');
  const tbody = document.getElementById('appr-input-tbody');

  // 組裝表頭 HTML
  let headerHtml = `
    <th style="padding: 0.4rem 0.6rem; text-align: center;">月份</th>
    <th style="padding: 0.4rem 0.6rem; text-align: center;">個人業績 (萬)</th>
    <th style="padding: 0.4rem 0.6rem; text-align: center;">個人 ${col2Name}</th>
    <th style="padding: 0.4rem 0.6rem; text-align: center;">個人 ${col3Name}</th>
  `;

  if (role === 'supervisor') {
    headerHtml += `
      <th style="padding: 0.4rem 0.6rem; text-align: center;">小組業績 (萬)</th>
      <th style="padding: 0.4rem 0.6rem; text-align: center;">小組 ${col2Name}</th>
      <th style="padding: 0.4rem 0.6rem; text-align: center;">小組 ${col3Name}</th>
    `;
  }
  headerRow.innerHTML = headerHtml;

  // 組裝表身 HTML
  tbody.innerHTML = '';
  for (let m = 1; m <= monthsCount; m++) {
    const isFirstMonth = (m === 1 && isFirstMonthZero);
    
    // 首月不設目標時，目標值寫為0；否則帶入資料庫預設
    const tSales = isFirstMonth ? 0 : targets.sales;
    const tNewDev = isFirstMonth ? 0 : targets.newDev;
    const tNewMach = isFirstMonth ? 0 : targets.newMach;

    // 小組目標預設值 (營業組各員(含主任)目標總和)
    let tgSales = isFirstMonth ? 0 : targets.sales;
    let tgNewDev = isFirstMonth ? 0 : targets.newDev;
    let tgNewMach = isFirstMonth ? 0 : targets.newMach;

    if (role === 'supervisor' && !isFirstMonth) {
      teamMembers.forEach(member => {
        const mTargets = TARGETS_DB[channel]['sales'][member.level];
        if (mTargets) {
          tgSales += mTargets.sales;
          tgNewDev += mTargets.newDev;
          tgNewMach += mTargets.newMach;
        }
      });
    }

    let rowHtml = `
      <td style="padding: 0.4rem 0.6rem; text-align: center; font-size: 0.85rem;">第 ${m} 月${isFirstMonth ? '<br><small class="text-danger" style="font-size: 0.75rem;">(免計)</small>' : ''}</td>
      <td style="padding: 0.4rem 0.6rem;">
        <div class="cell-stack">
          <span class="target-lbl">目標: ${tSales}</span>
          <input type="hidden" id="t-sales-${m}" value="${tSales}">
          <input type="number" step="any" id="a-sales-${m}" value="" placeholder="實際" class="actual-input">
        </div>
      </td>
      <td style="padding: 0.4rem 0.6rem;">
        <div class="cell-stack">
          <span class="target-lbl">目標: ${tNewDev}</span>
          <input type="hidden" id="t-dev-${m}" value="${tNewDev}">
          <input type="number" id="a-dev-${m}" value="" placeholder="實際" class="actual-input">
        </div>
      </td>
      <td style="padding: 0.4rem 0.6rem;">
        <div class="cell-stack">
          <span class="target-lbl">目標: ${tNewMach}</span>
          <input type="hidden" id="t-mach-${m}" value="${tNewMach}">
          <input type="number" id="a-mach-${m}" value="" placeholder="實際" class="actual-input">
        </div>
      </td>
    `;

    if (role === 'supervisor') {
      rowHtml += `
        <td style="padding: 0.4rem 0.6rem;">
          <div class="cell-stack">
            <span class="target-lbl">目標: ${tgSales}</span>
            <input type="hidden" id="tg-sales-${m}" value="${tgSales}">
            <input type="number" step="any" id="ag-sales-${m}" value="" placeholder="實際" class="actual-input">
          </div>
        </td>
        <td style="padding: 0.4rem 0.6rem;">
          <div class="cell-stack">
            <span class="target-lbl">目標: ${tgNewDev}</span>
            <input type="hidden" id="tg-dev-${m}" value="${tgNewDev}">
            <input type="number" id="ag-dev-${m}" value="" placeholder="實際" class="actual-input">
          </div>
        </td>
        <td style="padding: 0.4rem 0.6rem;">
          <div class="cell-stack">
            <span class="target-lbl">目標: ${tgNewMach}</span>
            <input type="hidden" id="tg-mach-${m}" value="${tgNewMach}">
            <input type="number" id="ag-mach-${m}" value="" placeholder="實際" class="actual-input">
          </div>
        </td>
      `;
    }

    const tr = document.createElement('tr');
    tr.id = `input-row-${m}`;
    tr.innerHTML = rowHtml;
    tbody.appendChild(tr);
  }
  updatePassConditions();
}


// 動態更新保級與免遭調降的條件
function updatePassConditions() {
  const channel = document.getElementById('appr-channel').value;
  const role = document.getElementById('appr-role').value;
  const level = document.getElementById('appr-level').value;
  const mode = document.getElementById('appr-mode').value;
  const isProbation = (mode === 'probation');
  const isFirstMonthZero = false;
  
  let monthsCount = getEvaluationMonths();
  let activeMonths = monthsCount;
  if (isFirstMonthZero) {
    activeMonths = monthsCount - 1;
  }

  const targets = TARGETS_DB[channel][role][level];
  if (!targets) return;

  // 計算期間內的個人加總目標
  const tSales = targets.sales * activeMonths;
  const tDev = targets.newDev * activeMonths;
  const tMach = targets.newMach * activeMonths;

  // 計算期間內的小組加總目標
  let gMonthlySales = targets.sales;
  let gMonthlyDev = targets.newDev;
  let gMonthlyMach = targets.newMach;

  if (role === 'supervisor') {
    teamMembers.forEach(member => {
      const mTargets = TARGETS_DB[channel]['sales'][member.level];
      if (mTargets) {
        gMonthlySales += mTargets.sales;
        gMonthlyDev += mTargets.newDev;
        gMonthlyMach += mTargets.newMach;
      }
    });
  }
  const tgSales = gMonthlySales * activeMonths;
  const tgDev = gMonthlyDev * activeMonths;
  const tgMach = gMonthlyMach * activeMonths;

  const m2Name = channel === 'OA' ? 'MFP新開發台數' : '交換機銷售台數';
  const m3Name = channel === 'OA' ? 'MFP新機台數' : 'MFP銷售台數(新+舊)';

  // 方案一：業績主攻 (業績達成率達 90%，得分 30 + 20 + 12 = 62)
  const s1Sales = (tSales * 0.9).toFixed(1);
  const g1Sales = (tgSales * 0.9).toFixed(1);
  
  // 方案二：台數主攻 (項目二達成率 80%，得分 30；項目三達成率 60%，得分 14；總分 20 + 30 + 14 = 64)
  const s2Dev = Math.ceil(tDev * 0.8);
  const s2Mach = Math.ceil(tMach * 0.6);
  const g2Dev = Math.ceil(tgDev * 0.8);
  const g2Mach = Math.ceil(tgMach * 0.6);

  // 方案三：均衡達成 (業績 80% 得25分；項目二 60% 得25分；項目三 60% 得14分；總分 25 + 25 + 14 = 64)
  const s3Sales = (tSales * 0.8).toFixed(1);
  const s3Dev = Math.ceil(tDev * 0.6);
  const s3Mach = Math.ceil(tMach * 0.6);
  const g3Sales = (tgSales * 0.8).toFixed(1);
  const g3Dev = Math.ceil(tgDev * 0.6);
  const g3Mach = Math.ceil(tgMach * 0.6);

  let html = `
    <div class="ref-period-desc">
      評核期間：${monthsCount} 個月 ${isFirstMonthZero ? '(首月免計目標，實計 2 個月)' : ''}
    </div>
    <ul class="ref-target-list">
      <li><span>個人業績累計總目標:</span> <strong>${tSales.toFixed(1)} 萬元</strong></li>
      <li><span>個人 ${m2Name} 累計:</span> <strong>${tDev} 台</strong></li>
      <li><span>個人 ${m3Name} 累計:</span> <strong>${tMach} 台</strong></li>
  `;

  if (role === 'supervisor') {
    html += `
      <hr style="margin: 0.5rem 0; border: none; border-top: 1px dashed var(--border-color);">
      <li><span>小組業績累計總目標:</span> <strong>${tgSales.toFixed(1)} 萬元</strong></li>
      <li><span>小組 ${m2Name} 累計:</span> <strong>${tgDev} 台</strong></li>
      <li><span>小組 ${m3Name} 累計:</span> <strong>${tgMach} 台</strong></li>
    `;
  }

  html += `
    </ul>
    
    <h4 class="ref-note" style="font-weight: 700; color: var(--navy); margin-bottom: 0.5rem; font-size: 0.9rem;">💡 保級最低門檻方案 (達 60 分免遭調降) :</h4>
  `;

  if (role === 'supervisor') {
    html += `
      <div class="ref-scheme-card sales-focus">
        <div class="ref-scheme-title">
          <span>方案一：業績主攻型</span>
          <span class="badge bg-blue">62分保級</span>
        </div>
        <div class="ref-scheme-desc" style="line-height: 1.6;">
          • <strong>個人</strong>：累計業績達 <strong>${s1Sales} 萬元</strong> (達成率 90%)<br>
          • <strong>小組</strong>：累計業績達 <strong>${g1Sales} 萬元</strong> (達成率 90%)<br>
          <small class="text-muted">此時縱使新開發與新機台數均低於標準，總分仍有 62 分安全保級。</small>
        </div>
      </div>

      <div class="ref-scheme-card qty-focus">
        <div class="ref-scheme-title">
          <span>方案二：台數主攻型</span>
          <span class="badge bg-orange">64分保級</span>
        </div>
        <div class="ref-scheme-desc" style="line-height: 1.6;">
          • <strong>個人</strong>：累計 ${m2Name} 達 <strong>${s2Dev} 台</strong> 且 ${m3Name} 達 <strong>${s2Mach} 台</strong><br>
          • <strong>小組</strong>：累計 ${m2Name} 達 <strong>${g2Dev} 台</strong> 且 ${m3Name} 達 <strong>${g2Mach} 台</strong><br>
          <small class="text-muted">此時縱使業績低於 80%，總分仍有 64 分安全保級。</small>
        </div>
      </div>

      <div class="ref-scheme-card balanced-focus">
        <div class="ref-scheme-title">
          <span>方案三：均衡達成型</span>
          <span class="badge bg-red">64分保級</span>
        </div>
        <div class="ref-scheme-desc" style="line-height: 1.6;">
          • <strong>個人</strong>：業績 <strong>${s3Sales} 萬</strong>、${m2Name} <strong>${s3Dev} 台</strong>、${m3Name} <strong>${s3Mach} 台</strong><br>
          • <strong>小組</strong>：業績 <strong>${g3Sales} 萬</strong>、${m2Name} <strong>${g3Dev} 台</strong>、${m3Name} <strong>${g3Mach} 台</strong><br>
          <small class="text-muted">個人與小組指標均達均衡標準，以 64 分保級。</small>
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="ref-scheme-card sales-focus">
        <div class="ref-scheme-title">
          <span>方案一：業績主攻型</span>
          <span class="badge bg-blue">62分保級</span>
        </div>
        <div class="ref-scheme-desc">
          累計業績實績達 <strong>${s1Sales} 萬元</strong> (達成率 90%，得30分)。此時縱使新開發與新機台數均低於標準，總分仍有 62 分安全保級。
        </div>
      </div>

      <div class="ref-scheme-card qty-focus">
        <div class="ref-scheme-title">
          <span>方案二：台數主攻型</span>
          <span class="badge bg-orange">64分保級</span>
        </div>
        <div class="ref-scheme-desc">
          累計 ${m2Name} 達 <strong>${s2Dev} 台</strong> (80%，得30分) 且 ${m3Name} 達 <strong>${s2Mach} 台</strong> (60%，得14分)。此時縱使業績低於 80%，總分仍有 64 分安全保級。
        </div>
      </div>

      <div class="ref-scheme-card balanced-focus">
        <div class="ref-scheme-title">
          <span>方案三：均衡達成型</span>
          <span class="badge bg-red">64分保級</span>
        </div>
        <div class="ref-scheme-desc">
          累計業績達 <strong>${s3Sales} 萬元</strong> (80%，得25分)，且 ${m2Name} 達 <strong>${s3Dev} 台</strong> (60%，得25分)，且 ${m3Name} 達 <strong>${s3Mach} 台</strong> (60%，得14分)，總分 64 分保級。
        </div>
      </div>
    `;
  }


  if (role === 'supervisor') {
    html += `
      <div class="ref-note text-danger" style="margin-top: 0.8rem; font-weight: bold; font-size: 0.8rem; line-height: 1.4;">
        ⚠️ 營業主任特別說明：<br>
        主任總分 = 個人得分 * 70% + 小組得分 * 30%。<br>
        此保級計算需在個人與小組皆滿足該方案的情況下成立，建議個人與團隊業績均以此底線自我要求。
      </div>
    `;
  } else {
    html += `
      <p class="ref-note">* 以上保級門檻為根據扣分區間設計的參考組合，只要綜合考核總分達 60 分（含）以上即可免遭降級。</p>
    `;
  }

  document.getElementById('pass-conditions-content').innerHTML = html;
}

// 新增小組組員
function addTeamMember() {
  memberIdCounter++;
  teamMembers.push({ id: memberIdCounter, level: 1 });
  renderTeamMembersList();
  renderInputTable();
}

// 移除小組組員
function removeTeamMember(id) {
  teamMembers = teamMembers.filter(m => m.id !== id);
  renderTeamMembersList();
  renderInputTable();
}

// 變更個別組員職級
function onMemberLevelChange(id, newLevel) {
  const member = teamMembers.find(m => m.id === id);
  if (member) {
    member.level = parseInt(newLevel);
  }
  renderInputTable();
}

// 渲染小組組員選單清單
function renderTeamMembersList() {
  const listDiv = document.getElementById('team-members-list');
  if (!listDiv) return;
  listDiv.innerHTML = '';
  
  teamMembers.forEach((member, index) => {
    const row = document.createElement('div');
    row.className = 'team-member-row';
    row.innerHTML = `
      <span>組員 ${index + 1}:</span>
      <select onchange="onMemberLevelChange(${member.id}, this.value)">
        <option value="1" ${member.level === 1 ? 'selected' : ''}>職級 1</option>
        <option value="2" ${member.level === 2 ? 'selected' : ''}>職級 2</option>
        <option value="3" ${member.level === 3 ? 'selected' : ''}>職級 3</option>
        <option value="4" ${member.level === 4 ? 'selected' : ''}>職級 4</option>
      </select>
      <button type="button" class="btn-delete-member" onclick="removeTeamMember(${member.id})">×</button>
    `;
    listDiv.appendChild(row);
  });
}



// 重設考評表單
function resetAppraisalForm() {
  const inputs = document.querySelectorAll('#appr-input-tbody input[type="number"]');
  inputs.forEach(input => {
    // 唯讀目標不清除，只清除使用者填入的實際值（placeholder 為 "實際" 的那些）
    if (input.placeholder === '實際') {
      input.value = '';
    }
  });
  // 隱藏結果區
  document.getElementById('appr-result-area').style.display = 'none';
  document.getElementById('tab-appraisal').classList.remove('has-result');
}

// 根據達成率換算得分 (投影片 P.9 評分標準)
function getMetricScore(metricIndex, rate) {
  // rate 為小數，例如 1.05 代表 105%
  if (metricIndex === 1) { // 業績達成率 (配分 40)
    if (rate >= 1.10) return 40;
    if (rate >= 1.00) return 35;
    if (rate >= 0.90) return 30;
    if (rate >= 0.80) return 25;
    return 20;
  } else if (metricIndex === 2) { // MFP新開發 / CA交換機銷售 (配分 40)
    if (rate >= 1.20) return 40;
    if (rate >= 1.00) return 35;
    if (rate >= 0.80) return 30;
    if (rate >= 0.60) return 25;
    return 20;
  } else if (metricIndex === 3) { // MFP新機 / CA MFP銷售 (配分 20)
    if (rate >= 1.20) return 20;
    if (rate >= 1.00) return 18;
    if (rate >= 0.80) return 16;
    if (rate >= 0.60) return 14;
    return 12;
  }
  return 0;
}

// 計算考核總分與合格判定
function calculateAppraisal() {
  const channel = document.getElementById('appr-channel').value;
  const role = document.getElementById('appr-role').value;
  const mode = document.getElementById('appr-mode').value;
  const isProbation = (mode === 'probation');
  const isFirstMonthZero = false;
  const monthsCount = getEvaluationMonths();

  // 累加變數 (個人)
  let sumTSales = 0, sumASales = 0;
  let sumTDev = 0, sumADev = 0;
  let sumTMach = 0, sumAMach = 0;

  // 累加變數 (小組)
  let sumTgSales = 0, sumAgSales = 0;
  let sumTgDev = 0, sumAgDev = 0;
  let sumTgMach = 0, sumAgMach = 0;

  // 逐月加總
  for (let m = 1; m <= monthsCount; m++) {
    // 如果是試用期首月不設目標，在計算累計達成率時完全跳過首月
    if (m === 1 && isFirstMonthZero) {
      continue; 
    }

    // 取得輸入值，若未填寫則預設實際為0，目標為預設
    const tSales = parseFloat(document.getElementById(`t-sales-${m}`).value) || 0;
    const aSales = parseFloat(document.getElementById(`a-sales-${m}`).value) || 0;
    const tDev = parseInt(document.getElementById(`t-dev-${m}`).value) || 0;
    const aDev = parseInt(document.getElementById(`a-dev-${m}`).value) || 0;
    const tMach = parseInt(document.getElementById(`t-mach-${m}`).value) || 0;
    const aMach = parseInt(document.getElementById(`a-mach-${m}`).value) || 0;

    sumTSales += tSales;
    sumASales += aSales;
    sumTDev += tDev;
    sumADev += aDev;
    sumTMach += tMach;
    sumAMach += aMach;

    if (role === 'supervisor') {
      const tgSales = parseFloat(document.getElementById(`tg-sales-${m}`).value) || 0;
      const agSales = parseFloat(document.getElementById(`ag-sales-${m}`).value) || 0;
      const tgDev = parseInt(document.getElementById(`tg-dev-${m}`).value) || 0;
      const agDev = parseInt(document.getElementById(`ag-dev-${m}`).value) || 0;
      const tgMach = parseInt(document.getElementById(`tg-mach-${m}`).value) || 0;
      const agMach = parseInt(document.getElementById(`ag-mach-${m}`).value) || 0;

      sumTgSales += tgSales;
      sumAgSales += agSales;
      sumTgDev += tgDev;
      sumAgDev += agDev;
      sumTgMach += tgMach;
      sumAgMach += agMach;
    }
  }

  // 1. 計算個人指標達成率與得分
  const rSales = sumTSales > 0 ? (sumASales / sumTSales) : 0;
  const rDev = sumTDev > 0 ? (sumADev / sumTDev) : 0;
  const rMach = sumTMach > 0 ? (sumAMach / sumTMach) : 0;

  const sSales = getMetricScore(1, rSales);
  const sDev = getMetricScore(2, rDev);
  const sMach = getMetricScore(3, rMach);
  const personalTotal = sSales + sDev + sMach;

  let finalScore = personalTotal;

  // 2. 如果是營業主任，計算小組指標達成率與得分，並作 70/30 加權
  let groupTotal = 0;
  if (role === 'supervisor') {
    const rgSales = sumTgSales > 0 ? (sumAgSales / sumTgSales) : 0;
    const rgDev = sumTgDev > 0 ? (sumAgDev / sumTgDev) : 0;
    const rgMach = sumTgMach > 0 ? (sumAgMach / sumTgMach) : 0;

    const sgSales = getMetricScore(1, rgSales);
    const sgDev = getMetricScore(2, rgDev);
    const sgMach = getMetricScore(3, rgMach);
    groupTotal = sgSales + sgDev + sgMach;

    // 加權公式: 個人 70% + 小組 30%
    finalScore = Math.round((personalTotal * 0.7 + groupTotal * 0.3) * 10) / 10;
  }

  // ==========================================
  // 結果數據渲染到 DOM
  // ==========================================
  
  // 更新總分
  document.getElementById('res-total-score').textContent = finalScore;

  // 顯示主任小組加權面板
  const supWeightPanel = document.getElementById('supervisor-weight-panel');
  if (role === 'supervisor') {
    supWeightPanel.style.display = 'block';
    document.getElementById('res-personal-score').textContent = personalTotal;
    document.getElementById('res-personal-weighted').textContent = (personalTotal * 0.7).toFixed(1);
    document.getElementById('res-group-score').textContent = groupTotal;
    document.getElementById('res-group-weighted').textContent = (groupTotal * 0.3).toFixed(1);
  } else {
    supWeightPanel.style.display = 'none';
  }

  // 指標名稱更新 (OA 與 CA 名稱不同)
  const col2Label = channel === 'OA' ? 'MFP新開發台數達成率' : '交換機銷售台數達成率';
  const col3Label = channel === 'OA' ? 'MFP新機台數達成率' : 'MFP銷售台數達成率(新+舊)';
  document.getElementById('res-m2-name').textContent = `2. ${col2Label} (配分 40%)`;
  document.getElementById('res-m3-name').textContent = `3. ${col3Label} (配分 20%)`;

  // 明細更新: 業績
  document.getElementById('res-m1-score').textContent = `${sSales} / 40 分`;
  document.getElementById('res-m1-target').textContent = sumTSales.toFixed(1);
  document.getElementById('res-m1-actual').textContent = sumASales.toFixed(1);
  document.getElementById('res-m1-rate').textContent = (rSales * 100).toFixed(1) + '%';
  document.getElementById('res-m1-progress').style.width = Math.min((rSales * 100), 100) + '%';

  // 明細更新: 項目2 (新開發 / 交換機)
  document.getElementById('res-m2-score').textContent = `${sDev} / 40 分`;
  document.getElementById('res-m2-target').textContent = sumTDev;
  document.getElementById('res-m2-actual').textContent = sumADev;
  document.getElementById('res-m2-rate').textContent = (rDev * 100).toFixed(1) + '%';
  document.getElementById('res-m2-progress').style.width = Math.min((rDev * 100), 100) + '%';

  // 明細更新: 項目3 (新機 / MFP銷售)
  document.getElementById('res-m3-score').textContent = `${sMach} / 20 分`;
  document.getElementById('res-m3-target').textContent = sumTMach;
  document.getElementById('res-m3-actual').textContent = sumAMach;
  document.getElementById('res-m3-rate').textContent = (rMach * 100).toFixed(1) + '%';
  document.getElementById('res-m3-progress').style.width = Math.min((rMach * 100), 100) + '%';

  // ==========================================
  // 合格判定邏輯 (投影片 P.8)
  // ==========================================
  const badge = document.getElementById('res-decision-badge');
  const desc = document.getElementById('res-decision-desc');

  // 初始化 checklist 狀態
  const chk80 = document.getElementById('chk-score-80');
  const chk60 = document.getElementById('chk-score-60');
  const chkProb = document.getElementById('chk-probation-pass');
  
  chk80.className = '';
  chk60.className = '';
  chkProb.className = '';
  chkProb.style.display = 'none';

  document.getElementById('chk-score-80-val').textContent = finalScore;
  document.getElementById('chk-score-60-val').textContent = finalScore;

  if (mode === 'probation') {
    // 試用期判定: 80分以上應正式任用晉升一職級；低於60分得調降或停止試用
    chkProb.style.display = 'flex';
    chk80.style.display = 'none';
    chk60.style.display = 'none';
    document.getElementById('chk-prob-score-val').textContent = finalScore;
    
    if (finalScore >= 80) {
      badge.textContent = '符合正式任用';
      badge.className = 'decision-badge pass';
      desc.innerHTML = `試用期綜合考評為 <strong class="text-success">${finalScore}分</strong> (達80分)，符合「正式任用並晉升一職級」標準。`;
      chkProb.className = 'checked-pass';
    } else if (finalScore < 60) {
      badge.textContent = '停止試用/調降';
      badge.className = 'decision-badge fail';
      desc.innerHTML = `試用期綜合考評為 <strong class="text-danger">${finalScore}分</strong> (低於60分)，符合「調降或停止試用」標準。`;
      chkProb.className = 'checked-fail';
    } else {
      badge.textContent = '符合留任標準';
      badge.className = 'decision-badge warning';
      desc.innerHTML = `試用期綜合考評為 <strong>${finalScore}分</strong> (介於60至79分)，得繼續試用或以原職級正式任用。`;
      chkProb.className = 'checked-pass'; // 留任視同及格
    }
  } else if (mode === 'promotion-sup') {
    // 同仁晉升主任 (3個月)
    chkProb.style.display = 'none';
    chk80.style.display = 'flex';
    chk60.style.display = 'none';
    
    if (finalScore >= 80) {
      badge.textContent = '符合晉升主任';
      badge.className = 'decision-badge pass';
      desc.innerHTML = `近三個月綜合考評為 <strong class="text-success">${finalScore}分</strong> (達80分門檻)，符合晉升營業主任資格！`;
      chk80.className = 'checked-pass';
    } else {
      badge.textContent = '未達晉升門檻';
      badge.className = 'decision-badge warning';
      desc.innerHTML = `近三個月綜合考評為 <strong>${finalScore}分</strong>，未達晉升之 80 分門檻，建議留任原職級。`;
      chk80.className = 'checked-fail';
    }
  } else {
    // 標準半年度考核 (6個月) [整合晉升與調降]
    chkProb.style.display = 'none';
    chk80.style.display = 'flex';
    chk60.style.display = 'flex';
    
    if (finalScore >= 80) {
      badge.textContent = '符合晉升資格';
      badge.className = 'decision-badge pass';
      desc.innerHTML = `近半年綜合考評為 <strong class="text-success">${finalScore}分</strong> (已達80分晉升門檻)，符合晉升一職級標準！`;
      chk80.className = 'checked-pass';
      chk60.className = 'checked-pass';
    } else if (finalScore < 60) {
      badge.textContent = '建議調降職級';
      badge.className = 'decision-badge fail';
      desc.innerHTML = `近半年綜合考評為 <strong class="text-danger">${finalScore}分</strong> (低於60分保級門檻)，已觸發職級調降機制！`;
      chk80.className = 'checked-fail';
      chk60.className = 'checked-fail';
    } else {
      badge.textContent = '符合留任標準';
      badge.className = 'decision-badge warning';
      desc.innerHTML = `近半年綜合考評為 <strong>${finalScore}分</strong> (介於60至79分)，未達80分晉升門檻但高於60分，予以原職級留任。`;
      chk80.className = 'checked-fail';
      chk60.className = 'checked-pass';
    }
  }

  // ==========================================
  // 未來月份業績與台數缺額預估 (Gap Estimation)
  // ==========================================
  let filledMonthsCount = 0;
  let activeMonthsFilled = 0;
  
  for (let m = 1; m <= monthsCount; m++) {
    const sInput = document.getElementById(`a-sales-${m}`);
    const dInput = document.getElementById(`a-dev-${m}`);
    const mInput = document.getElementById(`a-mach-${m}`);
    
    let isMonthFilled = (sInput && sInput.value.trim() !== '') || 
                         (dInput && dInput.value.trim() !== '') || 
                         (mInput && mInput.value.trim() !== '');
                         
    if (role === 'supervisor') {
      const gsInput = document.getElementById(`ag-sales-${m}`);
      const gdInput = document.getElementById(`ag-dev-${m}`);
      const gmInput = document.getElementById(`ag-mach-${m}`);
      if ((gsInput && gsInput.value.trim() !== '') || 
          (gdInput && gdInput.value.trim() !== '') || 
          (gmInput && gmInput.value.trim() !== '')) {
        isMonthFilled = true;
      }
    }
    
    if (isMonthFilled) {
      filledMonthsCount++;
      if (!(m === 1 && isFirstMonthZero)) {
        activeMonthsFilled++;
      }
    }
  }

  const activeMonths = isFirstMonthZero ? monthsCount - 1 : monthsCount;
  const remActiveMonths = activeMonths - activeMonthsFilled;
  const estPanel = document.getElementById('future-estimation-panel');
  
  if (filledMonthsCount > 0 && remActiveMonths > 0) {
    estPanel.style.display = 'block';
    document.getElementById('est-filled-months').textContent = filledMonthsCount;
    document.getElementById('est-rem-months').textContent = remActiveMonths;

    // 1. 滿分 100% 目標
    document.getElementById('est-100-s-sales').textContent = Math.max(0, (sumTSales - sumASales) / remActiveMonths).toFixed(1) + ' 萬';
    document.getElementById('est-100-s-dev').textContent = Math.max(0, Math.ceil((sumTDev - sumADev) / remActiveMonths)) + ' 台';
    document.getElementById('est-100-s-mach').textContent = Math.max(0, Math.ceil((sumTMach - sumAMach) / remActiveMonths)) + ' 台';

    // 2. 60分保級目標 (均衡型)
    document.getElementById('est-60-s-sales').textContent = Math.max(0, (sumTSales * 0.8 - sumASales) / remActiveMonths).toFixed(1) + ' 萬';
    document.getElementById('est-60-s-dev').textContent = Math.max(0, Math.ceil((sumTDev * 0.6 - sumADev) / remActiveMonths)) + ' 台';
    document.getElementById('est-60-s-mach').textContent = Math.max(0, Math.ceil((sumTMach * 0.6 - sumAMach) / remActiveMonths)) + ' 台';

    if (role === 'supervisor') {
      document.getElementById('est-100-g-sales').textContent = Math.max(0, (sumTgSales - sumAgSales) / remActiveMonths).toFixed(1) + ' 萬';
      document.getElementById('est-100-g-dev').textContent = Math.max(0, Math.ceil((sumTgDev - sumAgDev) / remActiveMonths)) + ' 台';
      document.getElementById('est-100-g-mach').textContent = Math.max(0, Math.ceil((sumTgMach - sumAgMach) / remActiveMonths)) + ' 台';

      document.getElementById('est-60-g-sales').textContent = Math.max(0, (sumTgSales * 0.8 - sumAgSales) / remActiveMonths).toFixed(1) + ' 萬';
      document.getElementById('est-60-g-dev').textContent = Math.max(0, Math.ceil((sumTgDev * 0.6 - sumAgDev) / remActiveMonths)) + ' 台';
      document.getElementById('est-60-g-mach').textContent = Math.max(0, Math.ceil((sumTgMach * 0.6 - sumAgMach) / remActiveMonths)) + ' 台';
    }

    // 控制小組欄位顯示
    const displayGroup = (role === 'supervisor') ? 'table-cell' : 'none';
    document.querySelectorAll('.est-group-th').forEach(el => el.style.display = displayGroup);
    document.querySelectorAll('.est-group-td').forEach(el => el.style.display = displayGroup);
  } else {
    estPanel.style.display = 'none';
  }

  // 顯現結果區域
  document.getElementById('appr-result-area').style.display = 'block';
  document.getElementById('tab-appraisal').classList.add('has-result');


  // 滾動到結果畫面
  document.getElementById('appr-result-area').scrollIntoView({ behavior: 'smooth' });
  
  // 儲存狀態至本地
  saveAppState();
}



// ==========================================
// 5. 成交獎金估算模組 (Commission Module)
// ==========================================

// --- 賣斷獎金處理 ---

// 新增賣斷交易列
function addOutrightRow() {
  outrightCounter++;
  const tbody = document.getElementById('outright-tbody');
  
  const tr = document.createElement('tr');
  tr.id = `outright-row-${outrightCounter}`;
  tr.innerHTML = `
    <td>T${outrightCounter}</td>
    <td><input type="number" class="out-sales" placeholder="例: 100000" oninput="calculateCommissionLine(this, 'outright')"></td>
    <td><input type="number" class="out-rate" value="5" step="0.1" oninput="calculateCommissionLine(this, 'outright')"> %</td>
    <td>
      <select class="out-new-cust-rate" onchange="calculateCommissionLine(this, 'outright')">
        <option value="0">無 (現有顧客)</option>
        <option value="1">另加 1.0% (新開發)</option>
        <option value="1.5" selected>另加 1.5% (新開發)</option>
        <option value="2">另加 2.0% (新開發)</option>
      </select>
    </td>
    <td>NT$ <span class="out-total-sales-lbl">0</span></td>
    <td>NT$ <span class="out-comm-lbl">0</span></td>
    <td><button class="btn btn-danger" onclick="deleteRow(this)">刪除</button></td>
  `;
  tbody.appendChild(tr);
}

// --- 租機獎金處理 ---

// 新增租機交易列
function addRentalRow() {
  rentalCounter++;
  const tbody = document.getElementById('rental-tbody');
  
  const tr = document.createElement('tr');
  tr.id = `rental-row-${rentalCounter}`;
  tr.innerHTML = `
    <td>R${rentalCounter}</td>
    <td>
      <select class="ren-type" onchange="onRentalTypeChange(this)">
        <option value="black">黑白機新機</option>
        <option value="color">彩色機新機</option>
        <option value="old">舊機</option>
      </select>
    </td>
    <td>
      <select class="ren-spec" onchange="calculateCommissionLine(this, 'rental')">
        <option value="blackPP">PP機 (1,600元)</option>
        <option value="blackHigh">高速機 (1,300元)</option>
        <option value="blackMed" selected>中速機 (1,000元)</option>
        <option value="blackLow">低速機 (700元)</option>
      </select>
    </td>
    <td>
      <select class="ren-cust" onchange="calculateCommissionLine(this, 'rental')">
        <option value="existing">現有顧客</option>
        <option value="newDev" selected>新開發顧客 (+500元)</option>
      </select>
    </td>
    <td>
      <select class="ren-term" onchange="calculateCommissionLine(this, 'rental')">
        <option value="36">租期滿 36期以上 (全額)</option>
        <option value="less36">租期未達 36期 (折半)</option>
      </select>
    </td>
    <td><input type="number" class="ren-qty" value="1" min="1" oninput="calculateCommissionLine(this, 'rental')"></td>
    <td>NT$ <span class="ren-unit-comm-lbl">1,500</span></td>
    <td>NT$ <span class="ren-total-comm-lbl">1,500</span> <span class="qty-warning text-danger" style="display:none;"><br><small>⚠️需個案核定</small></span></td>
    <td><button class="btn btn-danger" onclick="deleteRow(this)">刪除</button></td>
  `;
  tbody.appendChild(tr);
  
  // 觸發一次機型下拉選單連動
  const typeSelect = tr.querySelector('.ren-type');
  onRentalTypeChange(typeSelect);
}

// 處理租機機型(黑白/彩色/舊機)下拉選單與規格下拉選單的連動
function onRentalTypeChange(selectElement) {
  const tr = selectElement.closest('tr');
  const specSelect = tr.querySelector('.ren-spec');
  const type = selectElement.value;
  
  specSelect.innerHTML = '';
  
  if (type === 'black') {
    specSelect.innerHTML = `
      <option value="blackPP">PP機</option>
      <option value="blackHigh">高速機</option>
      <option value="blackMed" selected>中速機</option>
      <option value="blackLow">低速機</option>
    `;
    specSelect.disabled = false;
  } else if (type === 'color') {
    specSelect.innerHTML = `
      <option value="colorPP">PP機</option>
      <option value="colorHigh">高速機</option>
      <option value="colorMed" selected>中速機</option>
      <option value="colorLow">低速機</option>
    `;
    specSelect.disabled = false;
  } else if (type === 'old') {
    specSelect.innerHTML = `
      <option value="old" selected>舊機 (不分規格)</option>
    `;
    specSelect.disabled = true;
  }
  
  calculateCommissionLine(selectElement, 'rental');
}

// 刪除表格列
function deleteRow(buttonElement) {
  const tr = buttonElement.closest('tr');
  tr.remove();
  calculateCommission(); // 刪除後自動重新估算總合
}

// 計算單列的小計
function calculateCommissionLine(element, type) {
  const tr = element.closest('tr');
  
  if (type === 'outright') {
    // 賣斷計算
    const sales = parseFloat(tr.querySelector('.out-sales').value) || 0;
    const baseRate = parseFloat(tr.querySelector('.out-rate').value) || 0;
    const newCustRate = parseFloat(tr.querySelector('.out-new-cust-rate').value) || 0;
    
    const totalRate = (baseRate + newCustRate) / 100;
    const comm = Math.round(sales * totalRate);
    
    tr.querySelector('.out-total-sales-lbl').textContent = sales.toLocaleString();
    tr.querySelector('.out-comm-lbl').textContent = comm.toLocaleString();
    
  } else if (type === 'rental') {
    // 租機計算
    const spec = tr.querySelector('.ren-spec').value;
    const custType = tr.querySelector('.ren-cust').value; // existing / newDev
    const term = tr.querySelector('.ren-term').value;
    const qty = parseInt(tr.querySelector('.ren-qty').value) || 0;
    
    // 1. 查找定額費率
    let unitComm = RENTAL_RATES[custType][spec] || 0;
    
    // 2. 判斷租期折半
    let multiplier = 1;
    if (term === 'less36') {
      multiplier = 0.5;
    }
    
    // 3. 判斷大批採購個案核定提示 (數量 >= 10)
    const warningSpan = tr.querySelector('.qty-warning');
    if (qty >= 10) {
      warningSpan.style.display = 'inline';
    } else {
      warningSpan.style.display = 'none';
    }
    
    // 計算單台金額與小計金額
    const displayUnitComm = unitComm * multiplier;
    const totalComm = Math.round(displayUnitComm * qty);
    
    tr.querySelector('.ren-unit-comm-lbl').textContent = displayUnitComm.toLocaleString();
    tr.querySelector('.ren-total-comm-lbl').firstChild.textContent = totalComm.toLocaleString() + ' ';
  }
}

// 估算總成交獎金
function calculateCommission() {
  // 1. 賣斷加總
  let outrightTotalSales = 0;
  let outrightTotalComm = 0;
  let outrightCount = 0;
  
  const outRows = document.querySelectorAll('#outright-tbody tr');
  outRows.forEach(tr => {
    outrightCount++;
    // 觸發重算單列以防未觸發 input
    const salesInput = tr.querySelector('.out-sales');
    calculateCommissionLine(salesInput, 'outright');
    
    const sales = parseFloat(tr.querySelector('.out-sales').value) || 0;
    const commText = tr.querySelector('.out-comm-lbl').textContent.replace(/,/g, '');
    const comm = parseInt(commText) || 0;
    
    outrightTotalSales += sales;
    outrightTotalComm += comm;
  });

  // 2. 租機加總
  let rentalTotalQty = 0;
  let rentalTotalComm = 0;
  
  const renRows = document.querySelectorAll('#rental-tbody tr');
  renRows.forEach(tr => {
    const qtyInput = tr.querySelector('.ren-qty');
    calculateCommissionLine(qtyInput, 'rental');
    
    const qty = parseInt(tr.querySelector('.ren-qty').value) || 0;
    const commText = tr.querySelector('.ren-total-comm-lbl').firstChild.textContent.replace(/,/g, '');
    const comm = parseInt(commText) || 0;
    
    rentalTotalQty += qty;
    rentalTotalComm += comm;
  });

  // 3. 輸出到總計看板
  const totalAmount = outrightTotalComm + rentalTotalComm;
  document.getElementById('com-total-amount').textContent = totalAmount.toLocaleString();
  
  document.getElementById('com-outright-count').textContent = outrightCount;
  document.getElementById('com-outright-total').textContent = outrightTotalComm.toLocaleString();
  document.getElementById('com-rental-qty').textContent = rentalTotalQty;
  document.getElementById('com-rental-total').textContent = rentalTotalComm.toLocaleString();
}

// 重設成交獎金表單
function resetCommissionForm() {
  document.getElementById('outright-tbody').innerHTML = '';
  document.getElementById('rental-tbody').innerHTML = '';
  outrightCounter = 0;
  rentalCounter = 0;
  
  // 重新建立預設各一列
  addOutrightRow();
  addRentalRow();
  
  // 清除看板數字
  document.getElementById('com-total-amount').textContent = '0';
  document.getElementById('com-outright-count').textContent = '0';
  document.getElementById('com-outright-total').textContent = '0';
  document.getElementById('com-rental-qty').textContent = '0';
  document.getElementById('com-rental-total').textContent = '0';
}

// 快速模擬填寫實績
function quickFillActuals(type) {
  const monthsCount = getEvaluationMonths();
  const role = document.getElementById('appr-role').value;
  
  for (let m = 1; m <= monthsCount; m++) {
    // 檢查輸入項是否存在 (避免試用期首月唯讀欄位)
    const tSales = parseFloat(document.getElementById(`t-sales-${m}`).value) || 0;
    const tDev = parseInt(document.getElementById(`t-dev-${m}`).value) || 0;
    const tMach = parseInt(document.getElementById(`t-mach-${m}`).value) || 0;

    let aSales = 0, aDev = 0, aMach = 0;

    if (type === '100') {
      aSales = tSales;
      aDev = tDev;
      aMach = tMach;
    } else if (type === '90') {
      aSales = tSales * 0.9;
      aDev = Math.ceil(tDev * 0.9);
      aMach = Math.ceil(tMach * 0.9);
    } else if (type === 'pass-s1') {
      aSales = tSales * 0.9;
      aDev = Math.ceil(tDev * 0.5); // 低於 60% 得低消分
      aMach = Math.ceil(tMach * 0.5);
    } else if (type === 'pass-s3') {
      aSales = tSales * 0.8;
      aDev = Math.ceil(tDev * 0.6);
      aMach = Math.ceil(tMach * 0.6);
    }

    // 填入個人實際值
    // 若為 0 則不填寫顯示 placeholder
    document.getElementById(`a-sales-${m}`).value = aSales > 0 ? parseFloat(aSales.toFixed(1)) : '';
    document.getElementById(`a-dev-${m}`).value = aDev > 0 ? aDev : '';
    document.getElementById(`a-mach-${m}`).value = aMach > 0 ? aMach : '';

    if (role === 'supervisor') {
      const tgSales = parseFloat(document.getElementById(`tg-sales-${m}`).value) || 0;
      const tgDev = parseInt(document.getElementById(`tg-dev-${m}`).value) || 0;
      const tgMach = parseInt(document.getElementById(`tg-mach-${m}`).value) || 0;

      let agSales = 0, agDev = 0, agMach = 0;

      if (type === '100') {
        agSales = tgSales;
        agDev = tgDev;
        agMach = tgMach;
      } else if (type === '90') {
        agSales = tgSales * 0.9;
        agDev = Math.ceil(tgDev * 0.9);
        agMach = Math.ceil(tgMach * 0.9);
      } else if (type === 'pass-s1') {
        agSales = tgSales * 0.9;
        agDev = Math.ceil(tgDev * 0.5);
        agMach = Math.ceil(tgMach * 0.5);
      } else if (type === 'pass-s3') {
        agSales = tgSales * 0.8;
        agDev = Math.ceil(tgDev * 0.6);
        agMach = Math.ceil(tgMach * 0.6);
      }

      // 填入小組實際值
      document.getElementById(`ag-sales-${m}`).value = agSales > 0 ? parseFloat(agSales.toFixed(1)) : '';
      document.getElementById(`ag-dev-${m}`).value = agDev > 0 ? agDev : '';
      document.getElementById(`ag-mach-${m}`).value = agMach > 0 ? agMach : '';
    }
  }

  // 填寫完畢自動進行計算
  calculateAppraisal();
}

// ==========================================
// 8. 本地資料存檔與備份匯入/匯出 (Local Storage & Backup Tool)
// ==========================================

// 收集目前的應用程式狀態
function collectAppState() {
  const channel = document.getElementById('appr-channel').value;
  const role = document.getElementById('appr-role').value;
  const level = document.getElementById('appr-level').value;
  const mode = document.getElementById('appr-mode').value;
  const probationFirstMonthZero = false;
  
  const monthsCount = getEvaluationMonths();
  const actuals = {
    personal: {},
    group: {}
  };

  for (let m = 1; m <= monthsCount; m++) {
    const sInput = document.getElementById(`a-sales-${m}`);
    const dInput = document.getElementById(`a-dev-${m}`);
    const mInput = document.getElementById(`a-mach-${m}`);

    actuals.personal[m] = {
      sales: sInput ? sInput.value : '',
      dev: dInput ? dInput.value : '',
      mach: mInput ? mInput.value : ''
    };

    if (role === 'supervisor') {
      const gsInput = document.getElementById(`ag-sales-${m}`);
      const gdInput = document.getElementById(`ag-dev-${m}`);
      const gmInput = document.getElementById(`ag-mach-${m}`);
      
      actuals.group[m] = {
        sales: gsInput ? gsInput.value : '',
        dev: gdInput ? gdInput.value : '',
        mach: gmInput ? gmInput.value : ''
      };
    }
  }

  return {
    channel,
    role,
    level,
    mode,
    probationFirstMonthZero,
    teamMembers,
    actuals
  };
}

// 儲存狀態至 LocalStorage
function saveAppState() {
  try {
    const state = collectAppState();
    localStorage.setItem('huxen_appraisal_state', JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// 顯示已自動存檔狀態提示
let saveStatusTimeout;
function showSaveStatus() {
  const msgSpan = document.getElementById('save-status-msg');
  if (!msgSpan) return;
  msgSpan.style.display = 'inline';
  clearTimeout(saveStatusTimeout);
  saveStatusTimeout = setTimeout(() => {
    msgSpan.style.display = 'none';
  }, 1500);
}

// 從 LocalStorage 載入狀態
function loadAppState() {
  try {
    const stateStr = localStorage.getItem('huxen_appraisal_state');
    if (!stateStr) return false;
    
    const state = JSON.parse(stateStr);
    
    // 1. 還原設定值
    document.getElementById('appr-channel').value = state.channel;
    document.getElementById('appr-role').value = state.role;
    
    // 還原主任組員編制
    if (state.teamMembers) {
      teamMembers = state.teamMembers;
      // 獲取最大 ID 作為計數器基準
      memberIdCounter = teamMembers.reduce((max, m) => Math.max(max, m.id), 0);
    }
    
    // 重建職級選單以防選取不對
    const levelSelect = document.getElementById('appr-level');
    levelSelect.innerHTML = '';
    const levels = Object.keys(TARGETS_DB[state.channel][state.role]);
    levels.forEach(lvl => {
      const opt = document.createElement('option');
      opt.value = lvl;
      opt.textContent = `職級 ${lvl}`;
      levelSelect.appendChild(opt);
    });
    levelSelect.value = state.level;

    document.getElementById('appr-mode').value = state.mode;
    
    const probationCheckbox = document.getElementById('probation-first-month-zero');
    if (probationCheckbox) {
      probationCheckbox.checked = state.probationFirstMonthZero;
    }
    
    // 切換顯示組員設定與試用期選項
    const teamConfigWrap = document.getElementById('supervisor-team-config-wrap');
    if (state.role === 'supervisor') {
      teamConfigWrap.style.display = 'block';
      renderTeamMembersList();
    } else {
      teamConfigWrap.style.display = 'none';
    }
    


    // 2. 繪製輸入表格
    renderInputTable();
    
    // 3. 填入實際值
    const monthsCount = getEvaluationMonths();
    for (let m = 1; m <= monthsCount; m++) {
      const pData = state.actuals.personal[m];
      if (pData) {
        if (document.getElementById(`a-sales-${m}`)) document.getElementById(`a-sales-${m}`).value = pData.sales;
        if (document.getElementById(`a-dev-${m}`)) document.getElementById(`a-dev-${m}`).value = pData.dev;
        if (document.getElementById(`a-mach-${m}`)) document.getElementById(`a-mach-${m}`).value = pData.mach;
      }
      
      if (state.role === 'supervisor') {
        const gData = state.actuals.group[m];
        if (gData) {
          if (document.getElementById(`ag-sales-${m}`)) document.getElementById(`ag-sales-${m}`).value = gData.sales;
          if (document.getElementById(`ag-dev-${m}`)) document.getElementById(`ag-dev-${m}`).value = gData.dev;
          if (document.getElementById(`ag-mach-${m}`)) document.getElementById(`ag-mach-${m}`).value = gData.mach;
        }
      }
    }
    
    // 4. 重新計算一次
    calculateAppraisal();
    return true;
  } catch (e) {
    console.error('Failed to load state:', e);
    return false;
  }
}

// 匯出 JSON 備份檔
function exportDataToFile() {
  try {
    const state = collectAppState();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    // 命名格式: huxen_appraisal_OA_supervisor_2026-07-05.json
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `huxen_appraisal_${state.channel}_${state.role}_lvl${state.level}_${dateStr}.json`;
    downloadAnchor.setAttribute("download", filename);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (e) {
    alert('匯出失敗，請確認輸入欄位是否正確。');
  }
}

// 點擊隱藏的上傳 input
function triggerImportFile() {
  document.getElementById('import-file-input').click();
}

// 讀取 JSON 並匯入
function importDataFromFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const state = JSON.parse(e.target.result);
      // 先存入 localStorage
      localStorage.setItem('huxen_appraisal_state', JSON.stringify(state));
      // 載入
      const success = loadAppState();
      if (success) {
        alert('🎉 資料匯入成功！');
      } else {
        alert('匯入失敗，檔案格式不正確。');
      }
    } catch (err) {
      alert('解析檔案失敗，請上傳正確的 .json 格式檔案。');
    }
    // 重設 input
    event.target.value = '';
  };
  reader.readAsText(file);
}


