const form = document.querySelector("#generator-form");
const promptInput = document.querySelector("#prompt");
const statusEl = document.querySelector("#status");
const resultsEl = document.querySelector("#results");
const cardTemplate = document.querySelector("#card-template");
const copyAllButton = document.querySelector("#copy-all");

const angleFormats = [
  "Beginner myth-buster",
  "Before vs after story",
  "Cost breakdown",
  "Step-by-step framework",
  "Mistakes to avoid",
  "Busy person shortcut",
  "Science-backed explanation",
  "A day-in-the-life angle",
  "Comparison angle",
  "Checklist angle",
  "Q&A angle",
  "Personal confession angle",
  "Challenge angle",
  "Trend remix",
  "Unexpected truth",
  "Routine breakdown",
  "Results timeline",
  "Do this, not that",
  "Minimalist approach",
  "Premium upgrade angle"
];

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const basePrompt = promptInput.value.trim();
  if (!basePrompt) {
    setStatus("Please enter a prompt first.", true);
    return;
  }

  const cards = angleFormats.map((format, index) => buildCardData(basePrompt, format, index + 1));
  renderCards(cards);
  setStatus("Done. 20 angles generated.");
});

copyAllButton.addEventListener("click", async () => {
  const text = [...document.querySelectorAll(".card")]
    .map((card) => {
      const heading = card.querySelector("h2")?.textContent || "";
      const angle = card.querySelector(".angle")?.textContent || "";
      const content = card.querySelector(".content")?.textContent || "";
      const photo = card.querySelector(".photo")?.textContent || "";
      const hashtags = card.querySelector(".hashtags")?.textContent || "";
      return `${heading}\n${angle}\nContent: ${content}\nPhoto: ${photo}\nHashtags: ${hashtags}`;
    })
    .join("\n\n");

  if (!text) {
    setStatus("Generate first, then copy.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus("All 20 angles copied.");
  } catch {
    setStatus("Copy failed. You can still copy manually.", true);
  }
});

function buildCardData(basePrompt, format, number) {
  const topic = basePrompt.replace(/[.?!]$/, "");
  const angle = `${format}: ${topic}`;

  return {
    title: `Angle ${number}`,
    angle,
    content: `Use a strong opening about \"${topic}\" from the ${format.toLowerCase()} perspective. Keep it practical, include one clear takeaway, and close with a direct call for comments or saves.`,
    photo: `Create 3-5 visuals: cover image with bold text, one close-up detail, one process shot, and one result shot. Keep lighting natural and colors consistent with your niche style.`,
    hashtags: makeHashtags(topic, format)
  };
}

function makeHashtags(topic, format) {
  const base = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => `#${word}`);

  const extras = [
    `#xiaohongshu`,
    `#littleredbook`,
    `#contentideas`,
    `#${format.toLowerCase().replace(/[^a-z0-9]+/g, "")}`
  ];

  return [...new Set([...base, ...extras])].join(" ");
}

function renderCards(cards) {
  resultsEl.innerHTML = "";
  for (const card of cards) {
    const node = cardTemplate.content.cloneNode(true);
    node.querySelector("h2").textContent = card.title;
    node.querySelector(".angle").textContent = card.angle;
    node.querySelector(".content").textContent = card.content;
    node.querySelector(".photo").textContent = card.photo;
    node.querySelector(".hashtags").textContent = card.hashtags;
    resultsEl.appendChild(node);
  }
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#b33a16" : "";
}
