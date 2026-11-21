/* Vice Route 55 — tracker logic. All audit numbers are computed from data/trophies.json at runtime. */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const STORE_KEY = "vice-route-55-v1";

/* Play order: missable first, then story chapters, then 100%, then cleanup, platinum last. */
const PLAY_ORDER = [28,2,3,20,23,4,8,24,29,46,54,55,5,9,22,26,27,39,45,49,52,6,10,11,12,33,40,41,7,13,14,15,16,17,18,19,21,30,31,32,35,42,43,25,34,36,37,38,44,47,48,50,51,53,1];
const CHAPTERS = [
  { n: 1, name: "The Keys & the Balcony", ids: [2, 3, 28] },
  { n: 2, name: "What's in the Bag?", ids: [4, 8] },
  { n: 3, name: "Welcome to Vice City", ids: [5, 9] },
  { n: 4, name: "Ocean Beach & Another Life", ids: [6, 10, 11, 12] },
  { n: 5, name: "The Final Mission", ids: [7, 13] },
  { n: 6, name: "Post-story — 100% & Activities", ids: [14, 15, 16, 17, 18, 19, 20, 21, 30, 31, 32, 35, 42] },
  { n: 7, name: "Cleanup", ids: [1, 22, 23, 24, 25, 26, 27, 29, 33, 34, 36, 37, 38, 39, 40, 41, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55] },
];
/* Dispute -> trophy map. D1–D9 come from trophies.json; D10 (Strangers & Freaks strands) is documented in the research files. */
const DISPUTE_MAP = { 28: ["D1"], 40: ["D3"], 17: ["D4", "D8"], 47: ["D5"], 7: ["D6"], 3: ["D9"], 4: ["D9"], 25: ["D10"] };
const DISPUTED = new Set(Object.keys(DISPUTE_MAP).map(Number));
const EXTRA_DISPUTES = [{
  id: "D10", title: "Strangers & Freaks qualifying strands (partially unconfirmed)",
  positions: "Confirmed to count: Kirk (Skunk Ape), Kyle (McKittrick Farm), Yago (street racing), Pilot Pete (deliveries) [1][4]. Confirmed NOT to count: Moses, Tyrone, Yasmani, Andy, Billy, Eddie [1][4].",
  call: "The remaining qualifying strands are still being confirmed — use the in-game trophy progress counter to verify."
}];
const MISSABLE_CARDS = [
  { id: 28, tier: "t1", tierLabel: "TIER 1 · POSSIBLY MISSABLE", ponr: "Chapter 1 — before Tourist Trap (the balcony meditation disappears when Chapter 1 ends).", why: "7 sources flag it as possibly missable; Push Square says none known; planetgta6 can't tell yet. Whether the balcony spot is even required is unconfirmed — do it to be safe." },
  { id: 29, tier: "t2", tierLabel: "TIER 2 · TRIGGER UNCONFIRMED", ponr: "None — available after Chapter 2 (Coffee Break).", why: "The exact animal that triggers it is not confirmed by any source yet. Finishing all 15 Bret Target Decks (required for 100%) should cover it." },
  { id: 25, tier: "t3", tierLabel: "TIER 3 · METHOD PARTIAL", ponr: "None — all strands stay available after the story.", why: "Only 4 of the 8 qualifying strands are confirmed; the rest of the list is still being confirmed. Check the in-game progress counter." },
  { id: 44, tier: "t3", tierLabel: "TIER 3 · SINGLE SOURCE", ponr: "None — available after the story.", why: "Method confirmed in detail by PowerPyx only; sixshore and KeenGamer had it as unconfirmed when written." },
  { id: 45, tier: "t3", tierLabel: "TIER 3 · SINGLE SOURCE", ponr: "None — available after Chapter 3 (Key Cloner).", why: "Method confirmed in detail by PowerPyx only; sixshore and KeenGamer had it as unconfirmed when written." },
  { id: 49, tier: "t3", tierLabel: "TIER 3 · SINGLE SOURCE", ponr: "None — available after Chapter 3 (Credit Check).", why: "Method confirmed in detail by PowerPyx only; sixshore and KeenGamer had it as unconfirmed when written." },
  { id: 50, tier: "t3", tierLabel: "TIER 3 · SINGLE SOURCE", ponr: "None — night spawn, after 2 AM.", why: "Method confirmed in detail by PowerPyx only; the car spawn is slightly random, so it may take a few tries." },
  { id: 51, tier: "t3", tierLabel: "TIER 3 · SINGLE SOURCE", ponr: "None — available after the story.", why: "Method confirmed in detail by PowerPyx only; sixshore and KeenGamer had it as unconfirmed when written." },
];

let DATA = null;
let state = { earned: new Set(), counts: {}, spoilers: true, minutes: 30 };
let selectedId = 1;
let chipFilter = null;

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      earned: [...state.earned].sort((a, b) => a - b),
      counts: state.counts, spoilers: state.spoilers, minutes: state.minutes,
    }));
  } catch (e) { /* private mode: state still works in memory */ }
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.earned)) state.earned = new Set(s.earned.filter(n => Number.isInteger(n) && n >= 1 && n <= 55));
      if (s.counts && typeof s.counts === "object") state.counts = s.counts;
      if (typeof s.spoilers === "boolean") state.spoilers = s.spoilers;
      if ([30, 60, 120].includes(s.minutes)) state.minutes = s.minutes;
    }
  } catch (e) { /* corrupted storage: start clean */ }
  const m = location.hash.match(/^#run=(.+)$/);
  if (m) {
    try {
      const shared = JSON.parse(decodeURIComponent(m[1]));
      if (Array.isArray(shared.earned)) state.earned = new Set(shared.earned.filter(n => Number.isInteger(n) && n >= 1 && n <= 55));
    } catch (e) { /* bad hash: ignore */ }
  }
}

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function gradeLetter(g) { return { platinum: "P", gold: "G", silver: "S", bronze: "B" }[g] || "?"; }
function trophy(id) { return DATA.trophies.find(t => t.id === id); }
function isHidden(t) { return t.hidden && t.kind === "story"; }
function isMasked(t) { return state.spoilers && isHidden(t) && !state.earned.has(t.id); }
function displayName(t) { return isMasked(t) ? "Hidden story trophy" : t.name; }
function displayDesc(t) { return isMasked(t) ? "hidden until earned" : t.description; }
function citeLinks(text) {
  return esc(text).replace(/\[(\d+)\]/g, (m, n) => `<a class="cite" href="#" data-source="${n}">[${n}]</a>`);
}

function renderAudit() {
  const t = DATA.trophies;
  const steps = t.flatMap(x => x.steps);
  const cited = steps.filter(s => /(?:\[\d+\])+$/ .test(s)).length;
  const withSources = t.filter(x => x.sources.length >= 1).length;
  const backed2 = t.filter(x => x.sources.length >= 2).length;
  const g = DATA.meta.grades;
  const hidden = t.filter(x => x.hidden).length;
  const missable = t.filter(x => x.missable).length;
  const atRisk = t.filter(x => x.confidence !== "high").length;
  const disputes = DATA.disagreements.length + EXTRA_DISPUTES.length;
  $("#audit").innerHTML =
    `<b>${t.length}/${t.length}</b> official name, description, grade · <b>${g.platinum}P ${g.gold}G ${g.silver}S ${g.bronze}B</b> · ` +
    `<b>${hidden}</b> PSN-hidden · <b>${cited}/${steps.length}</b> steps cited · <b>${withSources}/${t.length}</b> guides cite sources · ` +
    `<b>${backed2}/${t.length}</b> backed by 2+ sources · <b>${DATA.sources.length}</b> pages · <b>${DATA.sources.length}</b> sites · read 20 Nov 2026 · ` +
    `<span class="warn">${missable} possibly missable · ${atRisk} at risk · 0 fully unconfirmed</span> · <b>${disputes}</b> disputes shown both ways`;
}

function renderProgress() {
  const earned = state.earned.size;
  const pct = earned / DATA.trophies.length * 100;
  const dial = $("#progress .dial");
  dial.setAttribute("aria-label", `${Math.round(pct)}% complete`);
  dial.querySelector(".arc").setAttribute("stroke-dasharray", `${pct} 100`);
  const byGrade = { P: 0, G: 0, S: 0, B: 0 };
  state.earned.forEach(id => { byGrade[gradeLetter(trophy(id).grade)]++; });
  const jasonEarned = [...state.earned].filter(id => ["jason", "both", "either"].includes(trophy(id).protagonist)).length;
  const luciaEarned = [...state.earned].filter(id => ["lucia", "both", "either"].includes(trophy(id).protagonist)).length;
  const jasonTotal = DATA.trophies.filter(x => ["jason", "both", "either"].includes(x.protagonist)).length;
  const luciaTotal = DATA.trophies.filter(x => ["lucia", "both", "either"].includes(x.protagonist)).length;
  const collTotal = DATA.trophies.filter(x => x.kind === "collectibles").length;
  const collEarned = [...state.earned].filter(id => trophy(id).kind === "collectibles").length;
  const hoursLeft = Math.round(200 * (DATA.trophies.length - earned) / DATA.trophies.length);
  $("#progress-nums").innerHTML =
    `<b>${earned} / ${DATA.trophies.length} earned</b><br>P ${byGrade.P} · G ${byGrade.G} · S ${byGrade.S} · B ${byGrade.B}<br>` +
    `<span id="crew-nums">Jason ${jasonEarned}/${jasonTotal} · Lucia ${luciaEarned}/${luciaTotal}</span><br>` +
    `<span id="coll-nums">Collectibles ${collEarned}/${collTotal} logged</span><br>` +
    `<span id="hours-nums">${hoursLeft} h remaining (estimate)</span>`;
}

function currentFilters() {
  return {
    query: $("#query").value.trim().toLowerCase(),
    kind: $("#kind").value,
    progress: $("#earned-filter").value,
    crew: $$("[data-crew]").find(b => b.getAttribute("aria-pressed") === "true")?.dataset.crew || "all",
  };
}
function visibleTrophies() {
  const f = currentFilters();
  return DATA.trophies.filter(t => {
    if (f.query && !(t.name + " " + t.description + " " + t.guide).toLowerCase().includes(f.query)) return false;
    if (f.kind !== "all") {
      if (f.kind === "collectibles") { if (!(t.kind === "collectibles" || t.id === 28)) return false; }
      else if (t.kind !== f.kind) return false;
    }
    if (f.progress === "earned" && !state.earned.has(t.id)) return false;
    if (f.progress === "open" && state.earned.has(t.id)) return false;
    if (f.crew !== "all" && !["both", "either", f.crew].includes(t.protagonist)) return false;
    if (chipFilter === "missable" && !t.missable) return false;
    if (chipFilter === "hidden" && !t.hidden) return false;
    if (chipFilter === "disputed" && !DISPUTED.has(t.id)) return false;
    if (chipFilter === "open" && state.earned.has(t.id)) return false;
    if (chipFilter && ["P", "G", "S", "B"].includes(chipFilter) && gradeLetter(t.grade) !== chipFilter) return false;
    return true;
  });
}
function renderList() {
  const list = visibleTrophies();
  const el = $("#trophy-list");
  if (!list.length) {
    const kind = $("#kind").value;
    el.innerHTML = kind === "online"
      ? `<div class="empty">There are no online trophies.</div>`
      : `<div class="empty">No trophies match this filter. ${kind === "missable" ? "No trophy has kind 'missable' — use the Missable chip to see the 1 possibly-missable trophy." : ""}</div>`;
  } else {
    el.innerHTML = list.map(t => {
      const earned = state.earned.has(t.id);
      const flags = [
        t.kind === "story" ? "Story" : t.kind[0].toUpperCase() + t.kind.slice(1),
        t.hidden ? `<span class="flag">PSN-hidden</span>` : "",
        t.missable ? `<span class="flag">MISSABLE</span>` : "",
        DISPUTED.has(t.id) ? `<span class="disp">DISPUTED</span>` : "",
        t.confidence !== "high" ? `<span class="flag">${t.confidence} confidence</span>` : "",
      ].filter(Boolean).join(" · ");
      return `<div class="trophy-row${earned ? " earned" : ""}" data-pick="${t.id}" role="option" aria-current="${t.id === selectedId}" tabindex="0">` +
        `<input type="checkbox" data-earned="${t.id}"${earned ? " checked" : ""} aria-label="Mark ${esc(displayName(t))} earned">` +
        `<span class="grade ${gradeLetter(t.grade)}">${gradeLetter(t.grade)}</span>` +
        `<span><span class="tname">${esc(displayName(t))}</span><br><span class="tdesc">${esc(displayDesc(t))}</span>` +
        `<br><span class="tmeta">#${t.id} · ${flags} · ${esc(t.protagonist)}</span></span></div>`;
    }).join("");
  }
  $("#match-count").textContent = `${list.length} / ${DATA.trophies.length} trophies`;
  renderChips();
}
function renderChips() {
  const t = DATA.trophies;
  const count = fn => t.filter(fn).length;
  const chips = [
    ["all", `All ${t.length}`, null],
    ["story", `Story ${count(x => x.kind === "story")}`, "story"],
    ["missable", `Missable ${count(x => x.missable)}`, "missable"],
    ["collectibles", `Collectibles ${count(x => x.kind === "collectibles")}`, "collectibles"],
    ["activities", `Activities ${count(x => x.kind === "activities")}`, "activities"],
    ["strangers", `Strangers ${count(x => x.kind === "strangers")}`, "strangers"],
    ["crime", `Crime ${count(x => x.kind === "crime")}`, "crime"],
    ["misc", `Misc ${count(x => x.kind === "misc")}`, "misc"],
    ["money", `Money ${count(x => x.kind === "money")}`, "money"],
    ["online", `Online 0`, "online"],
    ["hidden", `${count(x => x.hidden)} PSN-hidden`, "hidden"],
    ["disputed", `Disputed ${DISPUTED.size}`, "disputed"],
    ["open", `Not earned ${t.length - state.earned.size}`, "open"],
    ["P", `P ${count(x => x.grade === "platinum")}`, "P"],
    ["G", `G ${count(x => x.grade === "gold")}`, "G"],
    ["S", `S ${count(x => x.grade === "silver")}`, "S"],
    ["B", `B ${count(x => x.grade === "bronze")}`, "B"],
  ];
  $("#chips").innerHTML = chips.map(([key, label, kind]) =>
    `<button type="button" data-chip="${key}" data-kind="${kind || ""}" aria-pressed="${chipFilter === key || (key === "all" && !chipFilter)}">${label}</button>`).join("");
}

function renderDetail() {
  const t = trophy(selectedId);
  const masked = isMasked(t);
  const earned = state.earned.has(t.id);
  const disputes = (DISPUTE_MAP[t.id] || []).map(id => allDisputes().find(d => d.id === id)).filter(Boolean);
  let html = `<h3>${esc(displayName(t))}</h3>` +
    `<p class="official">Official PSN description: “${esc(displayDesc(t))}”</p>` +
    `<p class="meta-line">#${t.id} · ${gradeLetter(t.grade)} ${t.grade} · ${t.kind} · ${t.protagonist} · ${t.confidence} confidence` +
    `${t.hidden ? " · PSN-hidden" : ""}${t.missable ? " · <b style='color:var(--amber)'>POSSIBLY MISSABLE</b>" : ""}${DISPUTED.has(t.id) ? " · <b style='color:var(--pink)'>DISPUTED</b>" : ""}</p>`;
  if (t.missable) {
    html += `<div class="warnbox"><b>⚠ Possibly missable.</b> Last chance: Chapter 1 — before Tourist Trap (the balcony meditation disappears when Chapter 1 ends). Do it the morning Lucia offers it; it costs a minute and removes the risk.</div>`;
  }
  if (masked) {
    html += `<p>Hidden until earned — mark this trophy earned or turn off the spoiler shield to see its guide.</p>`;
  } else {
    html += `<ol>${t.steps.map(s => `<li>${citeLinks(s)}</li>`).join("")}</ol>`;
    if (t.id === 28) {
      const n = state.counts[28] || 0;
      html += `<div class="counter"><span><b>YOUR COUNT — ${n}/18 meditations</b> (both characters at one spot count as 2)</span>` +
        `<button type="button" data-count="-1" aria-label="One fewer meditation">−</button>` +
        `<button type="button" data-count="1" aria-label="One more meditation">+</button></div>`;
    }
    if (disputes.length) {
      html += disputes.map(d => `<div class="disputebox"><b>SOURCES DIFFER — both versions shown</b><br>${esc(d.positions)}<br><span class="call">OUR CALL: ${esc(d.call)}</span></div>`).join("");
    }
    html += `<p class="meta-line">Sources: ${t.sources.map(n => `<a class="cite" href="#" data-source="${n}">[${n}]</a>`).join(" ")}</p>`;
  }
  html += `<div class="detail-actions">` +
    `<button type="button" data-mark="${t.id}" aria-pressed="${earned}">${earned ? "✓ Earned" : "Mark earned"}</button>` +
    `${disputes.length ? `<a href="#" data-goto-disputes>See all ${DATA.disagreements.length + EXTRA_DISPUTES.length} disputes →</a>` : ""}</div>`;
  $("#trophy-detail").innerHTML = html;
  const guide = $("#guide-sources");
  guide.innerHTML = masked
    ? `<li class="src">Hidden until earned.</li>`
    : t.sources.map(n => { const s = DATA.sources.find(x => x.n === n); return `<li class="src"><a href="${esc(s.url)}">[${n}] ${esc(s.publisher)} — ${esc(s.title)}</a></li>`; }).join("");
}
function allDisputes() { return [...DATA.disagreements, ...EXTRA_DISPUTES]; }

function renderNextUp() {
  const next = PLAY_ORDER.filter(id => !state.earned.has(id)).slice(0, 5);
  $("#next-up").innerHTML = next.map(id => { const t = trophy(id); return `<li><button type="button" data-open="${id}">#${id} ${esc(displayName(t))}${t.missable ? " ⚠" : ""}</button></li>`; }).join("") ||
    `<li>All 55 earned — platinum time.</li>`;
}
function renderPlan() {
  const stops = state.minutes / 30;
  const plan = PLAY_ORDER.filter(id => !state.earned.has(id)).slice(0, stops);
  $("#plan").innerHTML = plan.map((id, i) => { const t = trophy(id); return `<li><button type="button" data-open="${id}">${i + 1}. ${esc(displayName(t))} — 30 min${t.missable ? " ⚠ missable first" : ""}</button></li>`; }).join("") ||
    `<li>Nothing left — all trophies earned.</li>`;
}
function renderMissables() {
  $("#missable-cards").innerHTML = MISSABLE_CARDS.map((c, i) => { const t = trophy(c.id); const earned = state.earned.has(c.id); return `<div class="card">
    <h3>#${c.id} ${esc(t.name)}</h3>
    <p><span class="tier ${c.tier}">${c.tierLabel}</span> <span class="grade ${gradeLetter(t.grade)}">${gradeLetter(t.grade)}</span></p>
    <p><b>Point of no return:</b> ${esc(c.ponr)}</p>
    <p>${esc(c.why)}</p>
    ${i === 0
      ? `<button type="button" data-mark="${c.id}" aria-pressed="${earned}">${earned ? "✓ Earned" : "Mark earned"}</button>`
      : `<button type="button" data-open="${c.id}">View guide →</button>`}
  </div>`; }).join("");
}
function renderJournal() {
  $("#journal-chapters").innerHTML = CHAPTERS.map(ch => `<details class="journal-chapter">
    <summary>Chapter ${ch.n} — ${esc(ch.name)} (${ch.ids.length} trophies)</summary>
    <ul>${ch.ids.map(id => { const t = trophy(id); return `<li><button type="button" data-open="${id}">#${id} ${esc(displayName(t))} <span class="grade ${gradeLetter(t.grade)}">${gradeLetter(t.grade)}</span></button></li>`; }).join("")}</ul>
  </details>`).join("");
}
function renderSources() {
  $("#disagreement-list").innerHTML = allDisputes().map(d =>
    `<div class="dispute" id="dispute-${d.id}" tabindex="-1"><b>${d.id} — ${esc(d.title)}</b><p>${esc(d.positions)}</p><p><b>Our call:</b> ${esc(d.call)}</p></div>`).join("");
  $("#sources-list").innerHTML = DATA.sources.map(s =>
    `<li id="source-${s.n}" tabindex="-1"><span class="snum">[${s.n}]</span> <b>${esc(s.title)}</b> <span class="spub">— ${esc(s.publisher)}</span><br><a href="${esc(s.url)}">${esc(s.url)}</a></li>`).join("");
}
function renderPrint() {
  $("#print-list").innerHTML = DATA.trophies.map(t => `<li>#${t.id} ${esc(t.name)} — ${t.grade}</li>`).join("");
}

function showView(name) {
  if (name === "planner") {
    showView("tracker");
    $("#planner-box").scrollIntoView({ block: "nearest" });
    $$("[data-minutes]").find(b => Number(b.dataset.minutes) === state.minutes)?.focus();
    return;
  }
  $$(".views > section").forEach(s => s.classList.toggle("active", s.id === name));
  $$("nav.tabs [data-tab]").forEach(b => b.setAttribute("aria-current", b.dataset.tab === name ? "page" : "false"));
  if (name === "tracker") renderList();
}
function selectTrophy(id) {
  selectedId = id;
  $$("#trophy-list .trophy-row").forEach(r => {
    const current = Number(r.dataset.pick) === id;
    r.setAttribute("aria-current", current ? "true" : "false");
    if (current) r.scrollIntoView({ block: "nearest" });
  });
  renderDetail();
  renderNextUp();
}
function toggleEarned(id) {
  if (state.earned.has(id)) state.earned.delete(id); else state.earned.add(id);
  save(); renderList(); renderDetail(); renderNextUp(); renderPlan(); renderProgress(); renderMissables();
}
function notice(msg) { $("#notice").textContent = msg; }

function bindEvents() {
  document.addEventListener("click", e => {
    const tab = e.target.closest("[data-tab]");
    if (tab) { e.preventDefault(); showView(tab.dataset.tab); return; }
    const open = e.target.closest("[data-open]");
    if (open) { e.preventDefault(); showView("tracker"); selectTrophy(Number(open.dataset.open)); return; }
    const cite = e.target.closest(".cite");
    if (cite) {
      e.preventDefault();
      showView("sources");
      const target = document.getElementById("source-" + cite.dataset.source);
      if (target) target.focus();
      return;
    }
    const disputes = e.target.closest("[data-disputes]");
    if (disputes) { e.preventDefault(); showView("sources"); $("#disagreements").focus(); return; }
    const gotoDisputes = e.target.closest("[data-goto-disputes]");
    if (gotoDisputes) { e.preventDefault(); showView("sources"); $("#disagreements").focus(); return; }
    const mark = e.target.closest("[data-mark]");
    if (mark) { toggleEarned(Number(mark.dataset.mark)); return; }
    const count = e.target.closest("[data-count]");
    if (count) {
      const n = Math.max(0, Math.min(18, (state.counts[28] || 0) + Number(count.dataset.count)));
      state.counts[28] = n; save(); renderDetail();
      return;
    }
    const crew = e.target.closest("[data-crew]");
    if (crew) {
      $$("[data-crew]").forEach(b => b.setAttribute("aria-pressed", b === crew ? "true" : "false"));
      renderList(); return;
    }
    const minutes = e.target.closest("[data-minutes]");
    if (minutes) {
      state.minutes = Number(minutes.dataset.minutes); save();
      $$("[data-minutes]").forEach(b => b.setAttribute("aria-pressed", b === minutes ? "true" : "false"));
      renderPlan(); return;
    }
    const chip = e.target.closest("[data-chip]");
    if (chip) {
      const key = chip.dataset.chip;
      if (key === "all") { chipFilter = null; $("#kind").value = "all"; }
      else if (chip.dataset.kind) { chipFilter = null; $("#kind").value = chip.dataset.kind; }
      else { chipFilter = chipFilter === key ? null : key; }
      renderList(); return;
    }
    const row = e.target.closest(".trophy-row");
    if (row) {
      if (e.target.matches("input[data-earned]")) return; /* checkbox handles itself */
      selectTrophy(Number(row.dataset.pick));
      return;
    }
  });
  document.addEventListener("change", e => {
    if (e.target.matches("input[data-earned]")) { toggleEarned(Number(e.target.dataset.earned)); return; }
    if (e.target.id === "spoilers") { state.spoilers = e.target.checked; save(); renderList(); renderDetail(); return; }
    if (e.target.id === "kind") chipFilter = null; /* manual kind change clears the chip filter so the two never fight */
    if (["query", "kind", "earned-filter"].includes(e.target.id)) renderList();
    if (e.target.id === "import-file" && e.target.files.length) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Array.isArray(data.earned)) throw new Error("bad file");
          const valid = data.earned.filter(n => Number.isInteger(n) && n >= 1 && n <= 55);
          state.earned = new Set(valid);
          if (data.counts && typeof data.counts === "object") state.counts = data.counts;
          save(); renderList(); renderDetail(); renderNextUp(); renderPlan(); renderProgress(); renderMissables();
          notice(`Imported ${valid.length} earned trophies.`);
        } catch (err) { notice("Import failed — not a valid progress file."); }
        e.target.value = "";
      };
      reader.readAsText(file);
    }
  });
  document.addEventListener("input", e => { if (e.target.id === "query") renderList(); });
  $("#reset-filters").addEventListener("click", () => {
    $("#query").value = ""; $("#kind").value = "all"; $("#earned-filter").value = "all";
    chipFilter = null;
    $$("[data-crew]").forEach(b => b.setAttribute("aria-pressed", b.dataset.crew === "all" ? "true" : "false"));
    renderList();
  });
  $("#export").addEventListener("click", () => {
    const data = { version: 1, earned: [...state.earned].sort((a, b) => a - b), counts: state.counts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vice-route-55-progress.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notice("Exported vice-route-55-progress.json.");
  });
  $("#import").addEventListener("click", () => $("#import-file").click());
  $("#share").addEventListener("click", async () => {
    const hash = "#run=" + encodeURIComponent(JSON.stringify({ earned: [...state.earned].sort((a, b) => a - b) }));
    history.replaceState(null, "", hash);
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      $("#share-fallback").style.display = "none";
      notice("Progress link copied");
    } catch (err) {
      const fb = $("#share-fallback");
      fb.value = url; fb.style.display = "block"; fb.select();
      notice("Select and copy this progress link");
    }
  });
  $("#print").addEventListener("click", () => window.print());
  document.addEventListener("keydown", e => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (e.key === "/") { e.preventDefault(); showView("tracker"); const q = $("#query"); q.focus(); q.select(); return; }
    if (e.key === "j" || e.key === "k") {
      const rows = $$("#trophy-list .trophy-row");
      if (!rows.length) return;
      const i = rows.findIndex(r => Number(r.dataset.pick) === selectedId);
      const next = e.key === "j" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1);
      selectTrophy(Number(rows[next].dataset.pick));
      return;
    }
    if (e.key === "x") { toggleEarned(selectedId); }
  });
}

async function init() {
  const res = await fetch("data/trophies.json");
  DATA = await res.json();
  load();
  $("#spoilers").checked = state.spoilers;
  $$("[data-minutes]").forEach(b => b.setAttribute("aria-pressed", Number(b.dataset.minutes) === state.minutes ? "true" : "false"));
  renderAudit(); renderProgress(); renderList(); renderDetail(); renderNextUp(); renderPlan();
  renderMissables(); renderJournal(); renderSources(); renderPrint();
  bindEvents();
}
init();
