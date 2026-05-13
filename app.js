const DEFAULT_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxVMoCoW0Y4B_93cu3US7q6HN4hCJj0DtMmV9xmsE7Vb4h6GnSHiQ68X7qWAYFzdm9b/exec";

const SHEET_CONFIG = {
  spreadsheetId: "1Hc-U6YnTrFxIfeG_wjwLpbYV-ghR0XGDSjuXGyMtSCg",
  sheetName: "Master",
  appsScriptUrl: DEFAULT_APPS_SCRIPT_URL
};

const fallbackStaff = [
  {
    brand: "NEODERM", center: "Causeway Bay", floor: "12F", as: "Ada Wong", team: "Apex", tl: "Bella Chan",
    therapist: "Bella Chan", staffId: "N0018", kpi: 94, position: "TL", hrTitle: "Team Leader", misMismatch: false,
    serviceMonths: 68, lastJoinDate: "2020-09-14", target: 300000, currentSales: 326000,
    apr: 109, mar: 116, feb: 105, jan: 99, avg6: 108, catCurrent: 15, catPast3: 43, flagged: true
  },
  {
    brand: "NEODERM", center: "Causeway Bay", floor: "12F", as: "Ada Wong", team: "Apex", tl: "Bella Chan",
    therapist: "Ceci Lee", staffId: "N0042", kpi: 91, position: "E1", hrTitle: "Therapist", misMismatch: false,
    serviceMonths: 44, lastJoinDate: "2022-09-01", target: 220000, currentSales: 253000,
    apr: 115, mar: 109, feb: 101, jan: 97, avg6: 106, catCurrent: 10, catPast3: 29, flagged: true
  },
  {
    brand: "NEODERM", center: "Causeway Bay", floor: "12F", as: "Ada Wong", team: "Apex", tl: "Bella Chan",
    therapist: "Doris Ho", staffId: "N0066", kpi: 84, position: "E1", hrTitle: "Therapist", misMismatch: false,
    serviceMonths: 35, lastJoinDate: "2023-06-03", target: 210000, currentSales: 208000,
    apr: 99, mar: 103, feb: 94, jan: 98, avg6: 99, catCurrent: 8, catPast3: 24, flagged: false
  },
  {
    brand: "NEODERM", center: "Causeway Bay", floor: "12F", as: "Ada Wong", team: "Apex", tl: "Bella Chan",
    therapist: "Eunice Tang", staffId: "N0071", kpi: 89, position: "E1", hrTitle: "Senior Therapist", misMismatch: true,
    serviceMonths: 39, lastJoinDate: "2023-02-17", target: 215000, currentSales: 234000,
    apr: 109, mar: 111, feb: 104, jan: 100, avg6: 107, catCurrent: 9, catPast3: 28, flagged: false
  },
  {
    brand: "NEODERM", center: "Central", floor: "8F", as: "Ada Wong", team: "Nova", tl: "Fiona Lau",
    therapist: "Fiona Lau", staffId: "N0025", kpi: 92, position: "TL", hrTitle: "Team Leader", misMismatch: false,
    serviceMonths: 61, lastJoinDate: "2021-04-11", target: 290000, currentSales: 313000,
    apr: 108, mar: 112, feb: 106, jan: 101, avg6: 107, catCurrent: 14, catPast3: 40, flagged: false
  },
  {
    brand: "NEODERM", center: "Central", floor: "8F", as: "Ada Wong", team: "Nova", tl: "Fiona Lau",
    therapist: "Grace Hui", staffId: "N0058", kpi: 93, position: "E1", hrTitle: "Therapist", misMismatch: false,
    serviceMonths: 31, lastJoinDate: "2023-10-09", target: 220000, currentSales: 260000,
    apr: 118, mar: 113, feb: 108, jan: 104, avg6: 111, catCurrent: 12, catPast3: 31, flagged: true
  },
  {
    brand: "NEODERM", center: "Central", floor: "8F", as: "Ada Wong", team: "Nova", tl: "Fiona Lau",
    therapist: "Hazel Ng", staffId: "N0082", kpi: 78, position: "E1", hrTitle: "Therapist", misMismatch: false,
    serviceMonths: 22, lastJoinDate: "2024-07-18", target: 200000, currentSales: 182000,
    apr: 91, mar: 96, feb: 89, jan: 88, avg6: 92, catCurrent: 6, catPast3: 18, flagged: false
  },
  {
    brand: "DERMES", center: "Tsim Sha Tsui", floor: "5F", as: "Ivy Yip", team: "Pulse", tl: "Jade Lam",
    therapist: "Jade Lam", staffId: "D0011", kpi: 90, position: "TL", hrTitle: "Assistant Supervisor", misMismatch: true,
    serviceMonths: 76, lastJoinDate: "2019-12-02", target: 310000, currentSales: 326000,
    apr: 105, mar: 110, feb: 104, jan: 102, avg6: 105, catCurrent: 13, catPast3: 38, flagged: true
  },
  {
    brand: "DERMES", center: "Tsim Sha Tsui", floor: "5F", as: "Ivy Yip", team: "Pulse", tl: "Jade Lam",
    therapist: "Kathy So", staffId: "D0037", kpi: 88, position: "E1", hrTitle: "Therapist", misMismatch: false,
    serviceMonths: 29, lastJoinDate: "2023-12-04", target: 210000, currentSales: 225000,
    apr: 107, mar: 104, feb: 103, jan: 97, avg6: 103, catCurrent: 9, catPast3: 26, flagged: false
  },
  {
    brand: "DERMES", center: "Tsim Sha Tsui", floor: "6F", as: "Ivy Yip", team: "Pulse", tl: "Jade Lam",
    therapist: "Lana Ma", staffId: "D0049", kpi: 95, position: "E1", hrTitle: "Therapist", misMismatch: false,
    serviceMonths: 37, lastJoinDate: "2023-04-19", target: 225000, currentSales: 277000,
    apr: 123, mar: 116, feb: 112, jan: 106, avg6: 114, catCurrent: 13, catPast3: 34, flagged: true
  },
  {
    brand: "DERMES", center: "Mong Kok", floor: "9F", as: "Ivy Yip", team: "Spark", tl: "Mandy Kwok",
    therapist: "Mandy Kwok", staffId: "D0028", kpi: 86, position: "TL", hrTitle: "Team Leader", misMismatch: false,
    serviceMonths: 58, lastJoinDate: "2021-07-12", target: 285000, currentSales: 276000,
    apr: 97, mar: 101, feb: 95, jan: 100, avg6: 98, catCurrent: 11, catPast3: 33, flagged: false
  },
  {
    brand: "DERMES", center: "Mong Kok", floor: "9F", as: "Ivy Yip", team: "Spark", tl: "Mandy Kwok",
    therapist: "Nora Cheung", staffId: "D0063", kpi: 87, position: "E1", hrTitle: "Therapist", misMismatch: false,
    serviceMonths: 26, lastJoinDate: "2024-03-15", target: 205000, currentSales: 218000,
    apr: 106, mar: 103, feb: 98, jan: 95, avg6: 101, catCurrent: 8, catPast3: 23, flagged: false
  }
];

let staff = fallbackStaff;

const state = {
  flags: loadJson("talentFlags", {}),
  coaching: loadJson("coachingNotes", {}),
  assessments: loadJson("programAssessments", {})
};

SHEET_CONFIG.appsScriptUrl = loadText("appsScriptUrl", DEFAULT_APPS_SCRIPT_URL) || DEFAULT_APPS_SCRIPT_URL;

const money = new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 0 });

const elements = {
  brandFilter: document.querySelector("#brandFilter"),
  centerFilter: document.querySelector("#centerFilter"),
  viewFilter: document.querySelector("#viewFilter"),
  performanceMetricFilter: document.querySelector("#performanceMetricFilter"),
  performanceStatusFilter: document.querySelector("#performanceStatusFilter"),
  orgChart: document.querySelector("#orgChart"),
  formationSummary: document.querySelector("#formationSummary"),
  positionFilter: document.querySelector("#positionFilter"),
  assessmentBrandFilter: document.querySelector("#assessmentBrandFilter"),
  floorFilter: document.querySelector("#floorFilter"),
  searchInput: document.querySelector("#searchInput"),
  staffTable: document.querySelector("#staffTable"),
  metricPotential: document.querySelector("#metricPotential"),
  metricTeams: document.querySelector("#metricTeams"),
  metricReadiness: document.querySelector("#metricReadiness"),
  dialog: document.querySelector("#coachDialog"),
  coachForm: document.querySelector("#coachForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  coachStaffId: document.querySelector("#coachStaffId"),
  assessmentResult: document.querySelector("#assessmentResult"),
  commitmentTarget: document.querySelector("#commitmentTarget"),
  coachNotes: document.querySelector("#coachNotes"),
  saveCoach: document.querySelector("#saveCoach"),
  dataStatus: document.querySelector("#dataStatus"),
  refreshData: document.querySelector("#refreshData"),
  setAppsScriptUrl: document.querySelector("#setAppsScriptUrl")
};

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local file previews can deny storage; the dashboard still works for the session.
  }
}

function loadText(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function saveText(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Local file previews can deny storage; use the in-memory value for this session.
  }
}

function hasAssessment(person) {
  return Boolean(state.assessments[person.staffId]);
}

function assessmentLabel(person) {
  if (!hasAssessment(person)) return "";
  return `<span class="assessment-label">已完成評估</span>`;
}

function syncDefaultFlags() {
  staff.forEach((person) => {
    if (state.flags[person.staffId] === undefined) state.flags[person.staffId] = person.flagged;
  });
  saveJson("talentFlags", state.flags);
}

async function loadStaffData() {
  if (!SHEET_CONFIG.appsScriptUrl) {
    staff = fallbackStaff;
    syncDefaultFlags();
    initFilters();
    renderAll();
    setDataStatus("請設定 Apps Script URL 以載入即時資料。");
    return;
  }

  setDataStatus("正在載入試算表資料...");
  try {
    const rows = await loadAppsScriptRows();
    const mappedStaff = mapSheetRows(rows);
    if (!mappedStaff.length) throw new Error("Master 分頁沒有可用員工資料。");
    staff = mappedStaff;
    syncDefaultFlags();
    initFilters();
    renderAll();
    setDataStatus(`即時資料：${staff.length} 位員工`);
  } catch (error) {
    staff = fallbackStaff;
    syncDefaultFlags();
    initFilters();
    renderAll();
    setDataStatus("正在顯示示例資料。Apps Script 未有回傳資料。");
    console.warn(error);
  }
}

function setDataStatus(message) {
  if (elements.dataStatus) elements.dataStatus.textContent = message;
}

function loadAppsScriptRows() {
  return new Promise((resolve, reject) => {
    const callbackName = `sheetCallback_${Date.now()}`;
    const script = document.createElement("script");
    const separator = SHEET_CONFIG.appsScriptUrl.includes("?") ? "&" : "?";
    let settled = false;
    const timeout = window.setTimeout(() => {
      fail(new Error("Apps Script 讀取逾時。"));
    }, 8000);

    window[callbackName] = (payload) => {
      try {
        if (payload.error) {
          fail(new Error(payload.error));
          return;
        }
        resolveOnce(payload.values || payload.rows || payload.records || []);
      } catch (error) {
        fail(error);
      }
    };

    script.onerror = () => {
      fail(new Error("Apps Script 讀取失敗。"));
    };

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    function resolveOnce(value) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    }

    function fail(error) {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    }

    script.src = `${SHEET_CONFIG.appsScriptUrl}${separator}sheet=${encodeURIComponent(SHEET_CONFIG.sheetName)}&callback=${callbackName}&cacheBust=${Date.now()}`;
    document.body.appendChild(script);
  });
}

function mapSheetRows(rowsOrRecords) {
  if (!rowsOrRecords.length) return [];
  if (!Array.isArray(rowsOrRecords[0])) {
    return deriveLeaders(rowsOrRecords.map((record) => normalizeSheetRecord(record)).filter(Boolean));
  }

  const [headers, ...rows] = rowsOrRecords;
  const normalizedHeaders = headers.map(normalizeHeader);
  const records = rows.map((row) => {
    const record = {};
    normalizedHeaders.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return normalizeSheetRecord(record);
  }).filter(Boolean);

  return deriveLeaders(records);
}

function normalizeHeader(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function readCell(record, names) {
  for (const name of names) {
    const normalized = normalizeHeader(name);
    if (record[normalized] !== undefined && String(record[normalized]).trim() !== "") return String(record[normalized]).trim();
  }
  return "";
}

function parseNumber(value) {
  const numeric = Number(String(value || "").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function parsePercent(value) {
  return parseNumber(value);
}

function normalizeSheetRecord(record) {
  const therapist = readCell(record, ["Therapist"]);
  const staffId = readCell(record, ["Staff ID", "Staff ID ", "Therapist Staff No"]);
  if (!therapist || !staffId) return null;

  const brand = readCell(record, ["Brand"]) || "Unassigned";
  const center = readCell(record, ["Center"]) || "Unassigned";
  const asName = readCell(record, ["AS NAME", "AS Team"]) || "Unassigned";
  const tlName = readCell(record, ["TL NAME", "TL Team"]) || "Unassigned";
  const position = readCell(record, ["KPI Position", "Position"]) || "Unassigned";
  const target = parseNumber(readCell(record, ["Current Sales Target", "Current Sales Target", "MTD Target"]));
  const currentSales = parseNumber(readCell(record, ["Current month Sales", "Current month Sales", "Actual Sales (MTD)"]));
  const mayMtdValue = readCell(record, ["This Month Sales %", "May MTD %", "MTD%"]);
  const currentSalesPercent = target ? Math.round((currentSales / target) * 100) : parsePercent(mayMtdValue);
  const mayMtd = mayMtdValue === "" ? currentSalesPercent : parsePercent(mayMtdValue);

  return {
    brand,
    center,
    floor: center,
    asTeamId: asName,
    tlTeamId: tlName,
    as: `${asName} | ${center}`,
    team: `${asName} | ${center} | TL ${tlName}`,
    tl: `TL ${tlName}`,
    therapist,
    staffId,
    kpi: position === "NJ" ? 0 : currentSalesPercent,
    position,
    hrTitle: readCell(record, ["HR Position"]) || "Unassigned",
    misMismatch: /miss|mismatch/i.test(readCell(record, ["Title mis matach", "Title mismatch"])),
    serviceMonths: parseNumber(readCell(record, ["Total Service time (Months)"])),
    lastJoinDate: readCell(record, ["Last Join Date"]),
    target,
    currentSales,
    mayMtd,
    apr: parsePercent(readCell(record, ["M-1 Sales %", "Sales % April 26"])),
    mar: parsePercent(readCell(record, ["M-2 Sales %", "Sales % March 26"])),
    feb: parsePercent(readCell(record, ["M-3 Sales %", "Sales % Feb 26"])),
    jan: parsePercent(readCell(record, ["M-4 Sales %", "Sales % Jan 26"])),
    avg6: parseNumber(readCell(record, ["Past 6 month Average sales", "P6M Average Sales (Raw) along Brand, PIC, Center"])),
    catCurrent: parsePercent(readCell(record, ["Current Cat1/2", "Current Cat1/2", "Cat 1/2"])),
    catPast3: parseNumber(readCell(record, ["Past 3 month Cat 1/2"])),
    cvSince2026: parseNumber(readCell(record, ["Number of upcoming CV Since 2026", "CV Since 2026"])),
    offerSince2026: parseNumber(readCell(record, ["Number of upcoming offer Since 2026", "offer Since 2026"])),
    onboardSince2026: parseNumber(readCell(record, ["Number of upcoming on board Since 2026", "on board Since 2026"])),
    flagged: false
  };
}

function deriveLeaders(records) {
  const byAs = groupBy(records, "as");
  Object.values(byAs).forEach((members) => {
    const leader = members.find(isTopLeader) || members.find((person) => /floor supervisor|assistant centre supervisor|assistant center supervisor/i.test(person.hrTitle));
    const asLabel = leader ? `${leader.therapist} | ${leader.center}` : members[0].as;
    members.forEach((person) => { person.as = asLabel; });
  });

  const byTeam = groupBy(records, "team");
  Object.values(byTeam).forEach((members) => {
    const leader = members.find(isTeamLeader);
    const teamLabel = leader ? `${leader.therapist} | ${leader.center} | TL ${leader.tlTeamId}` : members[0].team;
    members.forEach((person) => {
      person.tl = leader ? leader.therapist : person.tl;
      person.team = teamLabel;
    });
  });
  return records;
}

function isTopLeader(person) {
  return ["S", "AS"].includes(normalizeRole(person.position));
}

function isTeamLeader(person) {
  return normalizeRole(person.position) === "TL" || /team leader/i.test(person.hrTitle);
}

function isTherapistContributor(person) {
  return normalizeRole(person.position) === "E1";
}

function hasTlAssignment(person) {
  const value = String(person.tlTeamId || "").replace(/\s+/g, "").toLowerCase();
  return value !== "" && value !== "unassigned" && value !== "na" && value !== "n/a" && value !== "-";
}

function normalizeRole(value) {
  return String(value || "").replace(/\s+/g, "").trim().toUpperCase();
}

function uniqueValues(key, source = staff) {
  return ["All", ...Array.from(new Set(source.map((item) => item[key]))).sort()];
}

function fillSelect(select, values) {
  const current = select.value;
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
  if (values.includes(current)) select.value = current;
}

function initFilters() {
  fillSelect(elements.brandFilter, uniqueValues("brand"));
  fillSelect(elements.centerFilter, uniqueValues("center"));
  fillSelect(elements.positionFilter, uniqueValues("position"));
  fillSelect(elements.assessmentBrandFilter, uniqueValues("brand"));
  fillSelect(elements.floorFilter, uniqueValues("floor"));
}

function isFlagged(person) {
  return Boolean(state.flags[person.staffId]);
}

function leaderFilteredStaff() {
  return staff.filter((person) => {
    const brandMatch = elements.brandFilter.value === "All" || person.brand === elements.brandFilter.value;
    const centerMatch = elements.centerFilter.value === "All" || person.center === elements.centerFilter.value;
    const flagMatch = elements.viewFilter.value !== "flagged" || isFlagged(person);
    const mismatchMatch = elements.viewFilter.value !== "mismatch" || person.misMismatch;
    const performanceMatch = matchesPerformanceFilter(person);
    return brandMatch && centerMatch && flagMatch && mismatchMatch && performanceMatch;
  });
}

function matchesPerformanceFilter(person) {
  const metric = elements.performanceMetricFilter.value;
  const status = elements.performanceStatusFilter.value;
  if (metric === "all" && status === "all") return true;

  const metrics = metric === "all"
    ? ["thisMonth", "m1", "m2", "m3", "m4"]
    : [metric];

  return metrics.some((metricKey) => {
    const value = performanceValue(person, metricKey);
    if (!Number.isFinite(value)) return false;
    if (status === "all") return true;
    return salesStatusKey(value) === status;
  });
}

function performanceValue(person, metricKey) {
  const values = {
    thisMonth: person.mayMtd ?? salesPercent(person),
    m1: person.apr,
    m2: person.mar,
    m3: person.feb,
    m4: person.jan
  };
  return Number(values[metricKey]);
}

function renderMetrics() {
  const flaggedCount = staff.filter(isFlagged).length;
  const teams = new Set(staff.map((person) => person.team)).size;
  const readiness = Math.round(staff.reduce((total, person) => total + person.kpi, 0) / staff.length);
  elements.metricPotential.textContent = flaggedCount;
  elements.metricTeams.textContent = teams;
  elements.metricReadiness.textContent = `${readiness}%`;
}

function renderFormationSummary(source) {
  const teamMembers = source.filter((person) => (isTeamLeader(person) || isTherapistContributor(person)) && hasTlAssignment(person));
  const teams = groupBy(teamMembers, "team");
  const asGroups = groupBy(source, "as");
  const asNames = new Set(Object.keys(asGroups));
  const tlNames = source.filter(isTeamLeader).length;
  const idealTlCount = asNames.size * 2;
  const completeTlTeams = Object.values(teams).filter((members) => members.filter(isTherapistContributor).length >= 6).length;
  const completeAsTeams = Object.values(asGroups).filter((members) => members.filter((person) => !isTopLeader(person)).length >= 14).length;
  elements.formationSummary.innerHTML = [
    ["AS 領袖", asNames.size],
    ["現有 TL", tlNames],
    ["理想 TL", idealTlCount],
    ["TL 團隊 >= 6 E1", `${completeTlTeams}/${Object.keys(teams).length}`],
    ["AS 團隊 >= 14 HC", `${completeAsTeams}/${Object.keys(asGroups).length}`]
  ].map(([label, value]) => `<div class="summary-item"><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function groupBy(source, key) {
  return source.reduce((acc, item) => {
    const groupKey = item[key];
    acc[groupKey] = acc[groupKey] || [];
    acc[groupKey].push(item);
    return acc;
  }, {});
}

function average(source, key) {
  if (!source.length) return 0;
  return Math.round(source.reduce((total, item) => total + item[key], 0) / source.length);
}

function salesPercent(person) {
  if (!person.target) return 0;
  return Math.round((person.currentSales / person.target) * 100);
}

function renderOrgChart() {
  const source = leaderFilteredStaff();
  const byAs = groupBy(source, "as");
  renderFormationSummary(source);

  if (!source.length) {
    elements.orgChart.innerHTML = `<div class="org-tree"><div class="org-node as-node">沒有員工符合目前篩選條件。</div></div>`;
    return;
  }

  elements.orgChart.innerHTML = Object.entries(byAs).map(([asName, asMembers]) => {
    const branchMembers = asMembers.filter((person) => (isTeamLeader(person) || isTherapistContributor(person)) && hasTlAssignment(person));
    const teams = groupBy(branchMembers, "team");
    const asMismatch = asMembers.some((person) => person.misMismatch);
    const asFlagged = asMembers.some(isFlagged);
    const teamCards = Object.entries(teams).map(([teamName, members]) => renderTeamCard(teamName, members)).join("");
    const teamCount = Object.keys(teams).length;
    const topLeader = asMembers.find(isTopLeader);
    const roleLabel = topLeader ? String(topLeader.position).toUpperCase() : "S/AS";
    return `
      <article class="org-tree ${asFlagged ? "is-flagged" : ""} ${asMismatch ? "mismatch" : ""}">
        <div class="org-node as-node">
          <div class="node-copy">
            <span class="role-chip">${roleLabel}</span>
            <strong>${asName}</strong>
            <small>${membersMeta(asMembers)}</small>
          </div>
          <div class="node-kpis">
            <span>HC ${asMembers.filter((person) => !isTopLeader(person)).length}/14</span>
          </div>
          <span class="status-chip ${teamCount < 2 || asMembers.filter((person) => !isTopLeader(person)).length < 14 ? "warning" : ""}">${teamCount >= 2 && asMembers.filter((person) => !isTopLeader(person)).length >= 14 ? "符合 AS 比例" : "需建立 TL 梯隊"}</span>
          ${topLeader ? renderPotentialButton(topLeader) : ""}
          ${topLeader ? assessmentLabel(topLeader) : ""}
          ${topLeader ? renderPersonalDetails(topLeader, {
            suggestedTier: "as",
            currentCount: asMembers.filter((person) => !isTopLeader(person)).length
          }) : ""}
        </div>
        ${teamCards ? `<div class="team-branches">${teamCards}</div>` : ""}
      </article>
    `;
  }).join("");
}

function membersMeta(members) {
  const brands = Array.from(new Set(members.map((person) => person.brand))).join(", ");
  const centers = Array.from(new Set(members.map((person) => person.center))).join(", ");
  return `${brands} | ${centers}`;
}

function renderTeamCard(teamName, members) {
  const leader = members.find(isTeamLeader);
  const childMembers = members.filter(isTherapistContributor);
  const teamMismatch = members.some((person) => person.misMismatch);
  const flagged = members.some(isFlagged);
  const e1Count = childMembers.length;
  return `
    <article class="team-branch ${flagged ? "is-flagged" : ""} ${teamMismatch ? "mismatch" : ""}">
      <div class="org-node tl-node">
        <div class="node-copy">
          <span class="role-chip">TL</span>
          <strong>${leader ? leader.therapist : "未設定 TL"}</strong>
          <small>${teamName}</small>
        </div>
        <div class="node-kpis">
          <span>E1 ${e1Count}/6</span>
        </div>
        <span class="status-chip ${e1Count < 6 || !leader ? "warning" : ""}">${leader ? (e1Count >= 6 ? "符合 TL 比例" : "需建立團隊") : "需指定 TL"}</span>
        ${leader ? renderPotentialButton(leader) : ""}
        ${leader ? assessmentLabel(leader) : ""}
        ${leader ? renderPersonalDetails(leader, {
          suggestedTier: "tl",
          currentCount: e1Count
        }) : ""}
      </div>
      ${childMembers.length ? `<div class="therapist-list">${childMembers.map(renderTherapistNode).join("")}</div>` : ""}
    </article>
  `;
}

function renderTherapistNode(person) {
  return `
    <div class="therapist-node ${isFlagged(person) ? "is-flagged" : ""} ${person.misMismatch ? "mismatch" : ""}">
      <span class="node-dot" aria-hidden="true"></span>
      <div class="therapist-copy">
        <strong>${person.therapist}</strong>
        <small>${person.position} | ${person.staffId}${person.misMismatch ? " | MIS mismatch" : ""}</small>
      </div>
      <div class="mini-kpis">
        <span>KPI ${person.kpi}%</span>
        <span class="${salesStatusClass(person.mayMtd ?? salesPercent(person))}">銷售 ${formatPercent(person.mayMtd ?? salesPercent(person))}</span>
        <span>Cat ${person.catCurrent}</span>
      </div>
      ${renderPotentialButton(person)}
      ${assessmentLabel(person)}
      ${renderPersonalDetails(person, {
        suggestedTier: "tl",
        currentCount: 0
      })}
    </div>
  `;
}

function renderPotentialButton(person) {
  return `<button class="talent-button compact" data-flag="${person.staffId}" aria-pressed="${isFlagged(person)}">${isFlagged(person) ? "高潛人才" : "標記高潛"}</button>`;
}

function renderPersonalDetails(person, assessmentContext = {}) {
  const profileDetails = [
    ["年資", `${formatPlain(person.serviceMonths)} 月`],
    ["入職日", person.lastJoinDate || "-"],
    ["目標", formatMoneyOrDash(person.target)],
    ["銷售", formatMoneyOrDash(person.currentSales)]
  ];
  const salesDetails = [
    ["本月", formatPercent(person.mayMtd ?? salesPercent(person)), salesStatusClass(person.mayMtd ?? salesPercent(person))],
    ["M-1", formatPercent(person.apr), salesStatusClass(person.apr)],
    ["M-2", formatPercent(person.mar), salesStatusClass(person.mar)],
    ["M-3", formatPercent(person.feb), salesStatusClass(person.feb)],
    ["M-4", formatPercent(person.jan), salesStatusClass(person.jan)],
    ["6M 平均", formatMoneyOrDash(person.avg6)]
  ];
  const categoryDetails = [
    ["現時", formatPercent(person.catCurrent)],
    ["過去 3M", formatPlain(person.catPast3)]
  ];
  const recruitmentDetails = [
    ["CV", formatPlain(person.cvSince2026)],
    ["Offer", formatPlain(person.offerSince2026)],
    ["入職", formatPlain(person.onboardSince2026)]
  ];

  return `
    <div class="personal-details">
      ${renderDetailGroup("個人資料", profileDetails)}
      ${renderDetailGroup("銷售表現", salesDetails)}
      ${renderDetailGroup("招聘", recruitmentDetails)}
      ${renderDetailGroup("Cat 1/2", categoryDetails)}
      <div class="assessment-action">
        <a class="assessment-button" href="${assessmentUrl(person, assessmentContext)}">評估</a>
      </div>
    </div>
  `;
}

function assessmentUrl(person, assessmentContext = {}) {
  const params = new URLSearchParams({
    staffId: person.staffId,
    name: person.therapist,
    position: person.position,
    brand: person.brand,
    center: person.center,
    tier: assessmentContext.suggestedTier || "",
    currentCount: String(assessmentContext.currentCount ?? "")
  });
  return `assessment.html?${params.toString()}`;
}

function renderDetailGroup(title, details) {
  return `
    <section class="detail-group is-collapsible">
      <button class="detail-toggle" type="button" aria-expanded="false">${title}</button>
      <dl>
        ${details.map(([label, value, statusClass]) => `<div><dt>${label}</dt><dd class="${statusClass || ""}">${value}</dd></div>`).join("")}
      </dl>
    </section>
  `;
}

function kpiGrid(items) {
  return `<div class="kpi-grid">${items.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>`;
}

function renderStaffTable() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const rows = staff.filter((person) => {
    const assessmentMatch = hasAssessment(person);
    const positionMatch = elements.positionFilter.value === "All" || person.position === elements.positionFilter.value;
    const brandMatch = elements.assessmentBrandFilter.value === "All" || person.brand === elements.assessmentBrandFilter.value;
    const floorMatch = elements.floorFilter.value === "All" || person.floor === elements.floorFilter.value;
    const queryMatch = !query || [person.therapist, person.staffId, person.team, person.center].join(" ").toLowerCase().includes(query);
    return assessmentMatch && positionMatch && brandMatch && floorMatch && queryMatch;
  });

  if (!rows.length) {
    elements.staffTable.innerHTML = `<tr><td colspan="9">沒有已完成評估的人員符合目前篩選條件。</td></tr>`;
    return;
  }

  elements.staffTable.innerHTML = rows.map((person) => {
    const coaching = state.coaching[person.staffId];
    const assessment = state.assessments[person.staffId] || {};
    return `
      <tr class="${isFlagged(person) ? "flagged-row" : ""}">
        <td>
          <div class="staff-name">${person.therapist}</div>
          <div class="staff-meta">${person.staffId} | ${person.serviceMonths} months | joined ${person.lastJoinDate}</div>
          ${isFlagged(person) ? `<span class="role-chip">高潛人才</span>` : ""}
          ${assessmentLabel(person)}
        </td>
        <td>${person.brand}<br><span class="staff-meta">${person.center} | ${person.floor}</span></td>
        <td>${person.position}<br><span class="staff-meta">HR: ${person.hrTitle}</span>${person.misMismatch ? `<br><span class="status-chip warning">職位不一致</span>` : ""}</td>
        <td>${person.team}<br><span class="staff-meta">TL: ${person.tl}</span></td>
        <td>${person.kpi}%<div class="progress"><span style="width:${Math.min(person.kpi, 100)}%"></span></div></td>
        <td>${salesPercent(person)}%<br><span class="staff-meta">${money.format(person.currentSales)} / ${money.format(person.target)}</span></td>
        <td>
          M-1 ${person.apr}% | M-2 ${person.mar}%<br>
          <span class="staff-meta">M-3 ${person.feb}% | M-4 ${person.jan}% | 6M 平均 ${formatMoneyOrDash(person.avg6)}</span>
        </td>
        <td>${person.catCurrent}<br><span class="staff-meta">過去 3M：${person.catPast3}</span></td>
        <td>
          <button class="edit-button" data-edit="${person.staffId}">${coaching ? "編輯" : "輸入"}</button>
          <a class="edit-button link-button" href="${assessmentUrl(person)}">評估</a>
          <div class="coach-note">加入：${assessment.willingJoin || "-"} | ${assessment.targetTierLabel || assessment.targetTier || "未設定層級目標"}</div>
        </td>
      </tr>
    `;
  }).join("");
}

function openCoachDialog(staffId) {
  const person = staff.find((item) => item.staffId === staffId);
  const coaching = state.coaching[staffId] || {};
  elements.dialogTitle.textContent = `${person.therapist} | ${person.staffId}`;
  elements.coachStaffId.value = staffId;
  elements.assessmentResult.value = coaching.result || "已準備晉升下一層級";
  elements.commitmentTarget.value = coaching.target || "";
  elements.coachNotes.value = coaching.notes || "";
  elements.dialog.showModal();
}

function bindEvents() {
  [
    elements.brandFilter,
    elements.centerFilter,
    elements.viewFilter,
    elements.performanceMetricFilter,
    elements.performanceStatusFilter,
    elements.positionFilter,
    elements.assessmentBrandFilter,
    elements.floorFilter
  ].forEach((element) => element.addEventListener("change", renderAll));
  elements.searchInput.addEventListener("input", renderStaffTable);
  elements.refreshData.addEventListener("click", loadStaffData);
  elements.setAppsScriptUrl.addEventListener("click", () => {
    const nextUrl = window.prompt("請貼上已部署的 Apps Script Web App URL：", SHEET_CONFIG.appsScriptUrl);
    if (nextUrl === null) return;
    SHEET_CONFIG.appsScriptUrl = nextUrl.trim();
    saveText("appsScriptUrl", SHEET_CONFIG.appsScriptUrl);
    loadStaffData();
  });

  document.addEventListener("click", (event) => {
    const flagButton = event.target.closest("[data-flag]");
    const editButton = event.target.closest("[data-edit]");
    if (flagButton) {
      const staffId = flagButton.dataset.flag;
      state.flags[staffId] = !state.flags[staffId];
      saveJson("talentFlags", state.flags);
      renderAll();
    }
    const toggleButton = event.target.closest(".detail-toggle");
    if (toggleButton) {
      const group = toggleButton.closest(".detail-group");
      const isExpanded = group.classList.toggle("is-expanded");
      toggleButton.setAttribute("aria-expanded", String(isExpanded));
    }
    if (editButton) openCoachDialog(editButton.dataset.edit);
  });

  elements.saveCoach.addEventListener("click", () => {
    const staffId = elements.coachStaffId.value;
    state.coaching[staffId] = {
      result: elements.assessmentResult.value,
      target: elements.commitmentTarget.value.trim(),
      notes: elements.coachNotes.value.trim(),
      updatedAt: new Date().toISOString()
    };
    saveJson("coachingNotes", state.coaching);
    elements.dialog.close();
    renderStaffTable();
  });
}

function renderAll() {
  renderMetrics();
  renderOrgChart();
  renderStaffTable();
}

function formatMoneyOrDash(value) {
  return value ? money.format(value) : "-";
}

function formatPercent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${Math.round(numeric)}%` : "-";
}

function formatPlain(value) {
  const text = String(value ?? "").trim();
  return text === "" || text === "0" ? "-" : text;
}

function salesStatusClass(value) {
  const key = salesStatusKey(value);
  if (key === "good") return "sales-good";
  if (key === "watch") return "sales-watch";
  if (key === "risk") return "sales-risk";
  return "";
}

function salesStatusKey(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (numeric >= 100) return "good";
  if (numeric >= 90) return "watch";
  return "risk";
}

function drawCampaignCanvas() {
  const canvas = document.querySelector("#campaignCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(4, 6, 18, 0.2)");
  gradient.addColorStop(0.5, "rgba(65, 34, 126, 0.26)");
  gradient.addColorStop(1, "rgba(4, 8, 20, 0.12)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(width / 2, height * 0.76);
  for (let i = 0; i < 18; i += 1) {
    const y = i * 22;
    ctx.strokeStyle = `rgba(179, 99, 255, ${0.28 - i * 0.01})`;
    ctx.beginPath();
    ctx.ellipse(0, y, 160 + i * 56, 22 + i * 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = -14; i <= 14; i += 1) {
    ctx.strokeStyle = "rgba(109, 216, 255, 0.12)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(i * 80, height * 0.42);
    ctx.stroke();
  }
  ctx.restore();

  const skylineBase = height * 0.68;
  for (let i = 0; i < 54; i += 1) {
    const x = (i / 54) * width;
    const buildingWidth = 10 + (i % 5) * 5;
    const buildingHeight = 42 + ((i * 37) % 120);
    ctx.fillStyle = "rgba(8, 11, 28, 0.78)";
    ctx.fillRect(x, skylineBase - buildingHeight, buildingWidth, buildingHeight);
    ctx.fillStyle = i % 3 === 0 ? "rgba(242, 198, 106, 0.65)" : "rgba(109, 216, 255, 0.45)";
    ctx.fillRect(x + buildingWidth / 2 - 1, skylineBase - buildingHeight - 18, 2, 18);
  }

  for (let i = 0; i < 120; i += 1) {
    const x = (i * 97) % width;
    const y = (i * 53) % (height * 0.62);
    const radius = i % 7 === 0 ? 1.8 : 0.8;
    ctx.fillStyle = i % 5 === 0 ? "rgba(242, 198, 106, 0.72)" : "rgba(198, 138, 255, 0.62)";
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

window.addEventListener("resize", drawCampaignCanvas);
syncDefaultFlags();
initFilters();
bindEvents();
renderAll();
setDataStatus("Sample data shown while live sheet loads...");
loadStaffData();
drawCampaignCanvas();
