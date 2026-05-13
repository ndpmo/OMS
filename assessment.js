const params = new URLSearchParams(window.location.search);
const staffId = params.get("staffId") || "unknown";
const staffName = params.get("name") || "Staff assessment";
const staffPosition = params.get("position") || "";
const staffBrand = params.get("brand") || "";
const staffCenter = params.get("center") || "";
const suggestedTier = params.get("tier") || "";
const currentCount = parseNumber(params.get("currentCount"));

const fields = {
  name: document.querySelector("#assessmentName"),
  meta: document.querySelector("#assessmentMeta"),
  form: document.querySelector("#programAssessmentForm"),
  willingJoin: document.querySelector("#willingJoin"),
  targetTier: document.querySelector("#targetTier"),
  offerGap: document.querySelector("#offerGap"),
  targetCompletionDate: document.querySelector("#targetCompletionDate")
};

fields.name.textContent = staffName;
fields.meta.textContent = [staffId, staffPosition, staffBrand, staffCenter].filter(Boolean).join(" | ");

const saved = loadAssessment(staffId);
fields.willingJoin.value = saved.willingJoin || "";
fields.targetTier.value = saved.targetTier || suggestedTier || "";
fields.offerGap.value = saved.offerGap || "";
fields.targetCompletionDate.value = saved.targetCompletionDate || "";
updateOfferGap();

fields.targetTier.addEventListener("change", updateOfferGap);

fields.form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateOfferGap();
  saveAssessment(staffId, {
    staffId,
    staffName,
    staffPosition,
    staffBrand,
    staffCenter,
    willingJoin: fields.willingJoin.value,
    targetTier: fields.targetTier.value,
    targetTierLabel: tierLabel(fields.targetTier.value),
    currentCount,
    offerGap: fields.offerGap.value.trim(),
    targetCompletionDate: fields.targetCompletionDate.value,
    updatedAt: new Date().toISOString()
  });
  window.location.href = "index.html#leaders";
});

function loadAssessment(id) {
  try {
    const all = JSON.parse(localStorage.getItem("programAssessments")) || {};
    return all[id] || {};
  } catch {
    return {};
  }
}

function saveAssessment(id, value) {
  try {
    const all = JSON.parse(localStorage.getItem("programAssessments")) || {};
    all[id] = value;
    localStorage.setItem("programAssessments", JSON.stringify(all));
  } catch {
    window.alert("評估已暫存在本次瀏覽階段，但此頁面無法使用瀏覽器儲存空間。");
  }
}

function updateOfferGap() {
  const tier = fields.targetTier.value;
  if (!tier) {
    fields.offerGap.value = "";
    return;
  }

  const target = tier === "as" ? 14 : 6;
  const unit = tier === "as" ? "HC（不包括本人）" : "E1（不包括本人）";
  const gap = Math.max(target - currentCount, 0);
  fields.offerGap.value = `現時：${currentCount}/${target} ${unit}。差距：${gap} ${unit}。`;
}

function tierLabel(value) {
  if (value === "as") return "AS 層級 -> 1:14";
  if (value === "tl") return "Team Leader 層級 -> 1:6";
  return "";
}

function parseNumber(value) {
  const numeric = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}
