const $ = id => document.getElementById(id);
const grades = {platinum:"P", gold:"G", silver:"S", bronze:"B"};
const kinds = {all:"All kinds",story:"Story",missable:"Missable",collectibles:"Collectibles",activities:"Activities",online:"Online"};
const tabs = ["roadmap","tracker","missables","sources"];
const storageKey = "vice-route-55.v1";
const defaults = {earned:[],shield:true,crew:"all",minutes:30,tab:"roadmap",selected:28};
let data, state, earned, shown = [];
const esc = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
const cited = value => esc(value).replace(/\[(\d+)\]/g, '<a class="cite" href="#source-$1" data-source="$1" aria-label="Source $1">[$1]</a>');
const markers = ids => ids.map(n => `[${n}]`).join("");
const number = t => `#${String(t.id).padStart(2,"0")}`;
const concealed = t => state.shield && t.hidden && t.kind === "story" && !earned.has(t.id);
const name = t => concealed(t) ? `Hidden story trophy ${number(t)}` : t.name;
const description = t => concealed(t) ? "Reveals when earned." : t.description;
const gradeBadge = t => `<span class="grade ${t.grade}" aria-label="${t.grade}" title="${t.grade}">${grades[t.grade]}</span>`;
const keyValid = id => Number.isInteger(id) && data.trophies.some(t => t.id === id);
const tabOf = id => tabs.includes(id) ? id : defaults.tab;

function normalize(input) {
  if (!input || !Array.isArray(input.earned) || !input.earned.every(keyValid)) throw Error("Expected an earned array of trophy IDs from 1 to 55.");
  return {
    earned:[...new Set(input.earned)].sort((a,b)=>a-b),
    shield:typeof input.shield === "boolean" ? input.shield : defaults.shield,
    crew:["all","jason","lucia"].includes(input.crew) ? input.crew : defaults.crew,
    minutes:[30,60,120].includes(input.minutes) ? input.minutes : defaults.minutes,
    tab:tabOf(input.tab),
    selected:keyValid(input.selected) ? input.selected : defaults.selected
  };
}

function fromHash() {
  if (!location.hash.startsWith("#run=")) return null;
  return normalize(JSON.parse(decodeURIComponent(location.hash.slice(5))));
}

function hashForState() {
  return `#run=${encodeURIComponent(JSON.stringify(state))}`;
}

function save() {
  state.earned = [...earned].sort((a,b)=>a-b);
  try { localStorage.setItem(storageKey,JSON.stringify(state)); }
  catch { $("notice").textContent = "Local storage unavailable. Export JSON to keep your progress."; }
  history.replaceState(null,"",hashForState());
}

function routeDrawing() {
  return `<svg viewBox="0 0 350 145" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
    <path d="M126 0 Q176 36 267 29T355 61M105 145Q151 93 209 115T350 98M231 0Q245 65 317 76T359 137M156 0Q102 46 183 77T220 145M89 63Q145 29 203 59T350 38M137 145Q215 72 269 122T350 127" fill="none" stroke="#789689" opacity=".45"/>
    <path d="M120 105 Q177 71 210 93 T281 60 L319 28" fill="none" stroke="#075a50" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>
    <circle cx="120" cy="105" r="5" fill="#075a50"/><circle cx="210" cy="93" r="5" fill="#075a50"/><circle cx="281" cy="60" r="5" fill="#075a50"/>
    <path d="M319 19l9 9-9 9-9-9z" fill="#865007"/>
    <text x="132" y="120" class="map-label">01</text><text x="214" y="111" class="map-label">02</text><text x="288" y="75" class="map-label">03</text>
  </svg>`;
}

function renderRoadmap() {
  const m = data.meta;
  const gradeLine = Object.entries(grades).map(([key,letter])=>`${m.grades[key]}${letter}`).join(" ");
  const checks = data.checklist.map(group=>`<div class="check-group"><h3>${esc(group.title)} ${cited(markers(group.sources))}</h3><dl>${group.items.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></div>`).join("");
  const legs = data.roadmap.map(leg=>`<li class="leg">
    <span class="milestone" aria-hidden="true">0${leg.stage}</span><div class="leg-top"><h3>${esc(leg.title)}</h3><span class="hours">${esc(leg.hours)}</span></div>
    <p>${cited(leg.summary)}</p>
    ${leg.focus ? `<p class="warning"><strong>Chapter 1 checkpoint.</strong> ${cited(leg.focus)} <button class="text-button" data-tab="missables">Open missable guide</button></p>` : ""}
    ${leg.stage === 2 ? `<details><summary>Open 100% completion checklist</summary><p class="fine">${cited("The in-game checklist covers roughly 60% of everything available. [1]")}</p><div class="check-grid">${checks}</div></details>` : ""}
    ${leg.stage === 3 ? `<p><button class="text-button" data-open="1">Finish line: Vice Got a Price!</button></p>` : ""}
  </li>`).join("");
  $("roadmap").innerHTML = `<div class="audit" aria-label="Research audit"><span>${m.total}/55 trophies</span><span>${gradeLine}</span><span>${m.visible} visible · ${m.hidden} hidden</span><span>${m.citedSteps} cited steps</span><span>${m.sourceCount} sources</span><span>Read ${esc(m.read)}</span></div>
    <div class="route-intro">${routeDrawing()}<div class="copy"><p class="eyebrow">ROUTE SHEET / 01–03</p><h2>The road to platinum</h2><p>${cited("Plan for about 200 hours. Push Square estimates 250–300 hours or more. [1][3][4][8]")}</p><div class="facts"><span>${cited("4/10 difficulty [1][4][8]")}</span><span>${cited("1 playthrough [1]")}</span><span>${cited("0 online / 0 DLC [4]")}</span></div></div></div>
    <ol class="route">${legs}</ol>
    <p class="fine warning">${cited("Keep cheats off: they disable trophies and saving. Use the 15 manual slots and 1 autosave; keep saves at chapter boundaries. [1][3][4][5]")}</p>`;
}

function renderSources() {
  const cards = data.sources.map(s=>`<article class="source-card" id="source-${s.n}" tabindex="-1"><p class="eyebrow">[${s.n}] ${esc(s.site)}</p><h3>${esc(s.title)}</h3><p class="fine">${esc(s.access)}</p><p>${esc(s.claims)}</p><code>${esc(s.url)}</code></article>`).join("");
  const disputes = data.disagreements.map(d=>`<article class="dispute"><p class="eyebrow">${esc(d.id)}</p><h3>${esc(d.topic)}</h3><p>${cited(d.a)}</p><p>${cited(d.b)}</p><p class="verdict"><strong>Our call:</strong> ${cited(d.call)}</p></article>`).join("");
  $("sources").innerHTML = `<div class="section-head"><div><p class="eyebrow">REFERENCE INDEX / 18 SOURCES</p><h2>Sources & field notes</h2></div><a href="#disagreements" data-disputes>Disagreements</a></div>
    <p>${cited("Official wording follows the PSN list reported by planetgta6. [2]")}</p>
    <details><summary>Confidence: ${data.meta.confidence.high} high · ${data.meta.confidence.medium} medium · ${data.meta.confidence.low} low</summary><p>High: strong agreement in the research. Medium: one detailed method source or a detail remains unconfirmed. Low: the exact trigger is unconfirmed.</p></details>
    <div class="source-grid">${cards}</div><section id="disagreements" tabindex="-1"><h2>Disagreements</h2>${disputes}</section>`;
}

function matchesCrew(t) {
  return state.crew === "all" || ["both","either",state.crew].includes(t.protagonist);
}

function confidenceMeter(t) {
  const level = {high:3,medium:2,low:1}[t.confidence];
  return `<span class="tag ${t.confidence}"><span class="meters" aria-hidden="true">${[1,2,3].map(n=>`<i class="${n<=level?"on":""}"></i>`).join("")}</span>${t.confidence} confidence</span>`;
}

function guide(t) {
  return `<div class="guide-body"><p class="eyebrow">FIELD NOTE ${number(t)} · ${t.grade}</p><h3>${esc(name(t))}</h3><p>${esc(description(t))}</p>
    <div class="actions">${confidenceMeter(t)}${!concealed(t) && t.chapter ? `<span class="tag">Chapter ${t.chapter}</span>`:""}${!concealed(t) && t.protagonist !== "either" ? `<span class="tag">${t.protagonist === "both" ? "Jason + Lucia" : t.protagonist}</span>`:""}</div>
    ${concealed(t) ? "" : `<ol>${t.steps.map(step=>`<li>${cited(step)}</li>`).join("")}</ol><p class="fine">PSN wording ${cited("[2]")}</p>`}
    <div class="actions"><button class="primary" data-mark="${t.id}" aria-pressed="${earned.has(t.id)}">${earned.has(t.id)?"Earned · undo":"Mark earned"}</button></div></div>`;
}

function renderTracker() {
  const q = $("query").value.trim().toLocaleLowerCase();
  const kind = $("kind").value;
  const status = $("earned-filter").value;
  shown = data.trophies.filter(t=>matchesCrew(t) &&
    (kind === "all" || t.kind === kind || (kind === "collectibles" && t.id === 28)) &&
    (status === "all" || earned.has(t.id) === (status === "earned")) &&
    (!q || `${name(t)} ${description(t)} ${number(t)} #${t.id}`.toLocaleLowerCase().includes(q)));
  if (shown.length && !shown.some(t=>t.id===state.selected)) state.selected = shown[0].id;
  $("match-count").textContent = `${shown.length} / ${data.trophies.length} trophies`;
  const scroll = $("trophy-list").scrollTop;
  $("trophy-list").innerHTML = shown.length ? shown.map(t=>`<li class="trophy-row${t.id===state.selected?" active":""}">
    <input type="checkbox" data-earned="${t.id}" aria-label="Earned: ${esc(name(t))}" ${earned.has(t.id)?"checked":""}>
    <button data-pick="${t.id}" ${t.id===state.selected?'aria-current="true"':""}>${number(t)} ${esc(name(t))}<small>${esc(description(t))}</small></button>${gradeBadge(t)}</li>`).join("") : `<li class="empty">${kind==="online"?"There are no online trophies.":"No trophies match these filters."}</li>`;
  $("trophy-list").scrollTop = scroll;
  const current = shown.find(t=>t.id===state.selected);
  $("trophy-detail").innerHTML = current ? guide(current) : `<p class="empty">No guide selected.</p><button id="reset-filters">Clear filters</button>`;
}

function renderMissables() {
  const t = data.trophies.find(t=>t.missable);
  $("missables").innerHTML = `<div class="section-head"><div><p class="eyebrow">CHAPTER 1 / BEFORE YOU LEAVE</p><h2>Missables</h2></div><span class="tag medium">1 possible</span></div>
    <p class="warning">${cited("Treat the balcony meditation as missable. Whether it is required for the trophy remains unconfirmed. [1][4][5]")}</p>
    <article class="guide-card">${guide(t)}</article>`;
}

function renderProgress() {
  const total = data.trophies.length;
  const percent = Math.round(100 * earned.size / total);
  const hours = Math.round(data.meta.hours * (total-earned.size) / total);
  $("progress").innerHTML = `<div class="odometer"><div class="dial" role="img" aria-label="${percent}% complete"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="37" fill="none" stroke="#d3d8c9" stroke-width="7"/><circle cx="45" cy="45" r="37" fill="none" stroke="#075a50" stroke-width="7" pathLength="100" stroke-dasharray="${100*earned.size/total} 100"/></svg><b>${percent}%</b></div><div><strong>${earned.size} / ${total} earned</strong><p>~${hours} h remaining</p><small>By share of trophies earned</small></div></div>
    <div class="grades">${Object.entries(grades).map(([grade,label])=>`<div title="${grade}"><b>${label}</b>${data.trophies.filter(t=>t.grade===grade&&earned.has(t.id)).length}/${data.meta.grades[grade]}</div>`).join("")}</div>`;
  $("crew-counts").innerHTML = `<div class="crew-totals">${["jason","lucia"].map(crew=>{
    const tagged=data.trophies.filter(t=>[crew,"both"].includes(t.protagonist));
    return `<div><b>${crew==="jason"?"Jason":"Lucia"}</b>${tagged.filter(t=>earned.has(t.id)).length}/${tagged.length} tagged</div>`;
  }).join("")}</div>`;
  document.querySelectorAll("[data-crew]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.crew===state.crew));
}

function renderPlan() {
  document.querySelectorAll("[data-minutes]").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.minutes===state.minutes));
  const pending = data.trophies.filter(t=>!earned.has(t.id)&&matchesCrew(t)&&(t.id!==1 || earned.size===54))
    .sort((a,b)=>Number(b.missable)-Number(a.missable)||a.roadmapStage-b.roadmapStage||(a.chapter??9)-(b.chapter??9)||a.id-b.id);
  const slots = {30:1,60:2,120:4}[state.minutes];
  $("plan").innerHTML = pending.length ? `<p class="fine">Priority stops · completion times unconfirmed</p><ol class="plan-list">${pending.slice(0,slots).map(t=>`<li><button data-open="${t.id}">${esc(name(t))}</button><br>${t.missable?"Chapter 1 checkpoint first":`Leg ${t.roadmapStage}`}</li>`).join("")}</ol>` : `<p class="fine">No eligible stops left for this crew.</p>`;
}

function renderPrint() {
  $("print-sheet").innerHTML = `<h2>Vice Route 55 · Trophy checklist</h2><p>${earned.size} / ${data.trophies.length} earned</p><ul>${data.trophies.map(t=>`<li>${earned.has(t.id)?"☑":"☐"} ${number(t)} · ${grades[t.grade]} · ${esc(name(t))}<small>${esc(description(t))}</small></li>`).join("")}</ul>`;
}

function render() {
  tabs.forEach(tab=>$(tab).hidden=state.tab!==tab);
  document.querySelectorAll("nav [data-tab]").forEach(b=>{
    if (b.dataset.tab===state.tab) b.setAttribute("aria-current","page");
    else b.removeAttribute("aria-current");
  });
  $("spoilers").checked = state.shield;
  renderProgress();
  renderPlan();
  if (state.tab==="tracker") renderTracker();
  if (state.tab==="missables") renderMissables();
  renderPrint();
}

function update() { render(); save(); }
function clearFilters() { $("kind").value="all"; $("query").value=""; $("earned-filter").value="all"; }
function openTrophy(id) {
  clearFilters();
  if (!matchesCrew(data.trophies.find(t=>t.id===id))) state.crew="all";
  state.selected=id;
  state.tab="tracker";
  update();
  revealSelection(true);
}

function revealSelection(focus=false) {
  const row=$("trophy-list").querySelector("[aria-current=true]");
  if (!row) return;
  row.scrollIntoView({block:"nearest"});
  if (focus) row.focus({preventScroll:true});
}

function toggleEarned(id) {
  if (earned.has(id)) earned.delete(id);
  else earned.add(id);
  update();
}

function wireControls() {
  document.addEventListener("click",event=>{
    const b=event.target.closest("button, a");
    if (!b) return;
    const d=b.dataset;
    if (d.source || "disputes" in d) {
      event.preventDefault();
      state.tab="sources";
      update();
      const target=$(d.source ? `source-${d.source}` : "disagreements");
      target.focus({preventScroll:true});
      target.scrollIntoView({block:"start"});
    } else if (d.tab) { state.tab=d.tab; update(); }
    else if (d.open) openTrophy(+d.open);
    else if (d.pick) { state.selected=+d.pick; update(); revealSelection(true); }
    else if (d.mark) {
      toggleEarned(+d.mark);
      const activeView = $(state.tab);
      (activeView.querySelector(`[data-mark="${d.mark}"]`) ?? activeView.querySelector("[data-pick][aria-current], #reset-filters"))?.focus();
    }
    else if (d.crew) {
      state.crew=d.crew;
      state.tab="tracker";
      update();
    } else if (d.minutes) { state.minutes=+d.minutes; update(); }
    else if (b.id==="reset-filters") { clearFilters(); state.crew="all"; update(); $("query").focus(); }
  });
  $("trophy-list").addEventListener("change",event=>{
    const id=+event.target.dataset.earned;
    if (!id) return;
    toggleEarned(id);
    $("trophy-list").querySelector(`[data-earned="${id}"]`)?.focus();
  });
  $("spoilers").addEventListener("change",event=>{state.shield=event.target.checked;update();});
  $("query").addEventListener("input",update);
  ["kind","earned-filter"].forEach(id=>$(id).addEventListener("change",update));
  window.addEventListener("hashchange",()=>{
    try {
      const incoming=fromHash();
      if (incoming) {state=incoming;earned=new Set(state.earned);clearFilters();update();}
    } catch { $("notice").textContent="This progress link is invalid."; }
  });
  document.addEventListener("keydown",event=>{
    if (event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||event.target.closest("input, select, textarea, [contenteditable]")) return;
    const k=event.key.toLowerCase();
    if (k==="/") {event.preventDefault();state.tab="tracker";update();$("query").focus();return;}
    if (state.tab!=="tracker"||!shown.length||!["j","k","x"].includes(k)) return;
    event.preventDefault();
    if (k==="x") toggleEarned(state.selected);
    else {
      const index=shown.findIndex(t=>t.id===state.selected);
      state.selected=shown[Math.max(0,Math.min(shown.length-1,index+(k==="j"?1:-1)))].id;
      update();
    }
    revealSelection(true);
  });
  $("share").addEventListener("click",async()=>{
    save();
    const link=$("share-fallback");
    try { await navigator.clipboard.writeText(location.href); link.hidden=true; $("notice").textContent="Progress link copied."; }
    catch {link.value=location.href;link.hidden=false;link.focus();link.select();$("notice").textContent="Select and copy this progress link.";}
  });
  $("export").addEventListener("click",()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,...state},null,2)],{type:"application/json"}));
    const link=document.createElement("a");
    link.href=url;link.download="vice-route-55-progress.json";link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $("import").addEventListener("click",()=>$("import-file").click());
  $("import-file").addEventListener("change",async event=>{
    const file=event.target.files[0];
    if (!file) return;
    try {
      if (file.size>32768) throw Error("File is too large.");
      state=normalize(JSON.parse(await file.text()));
      earned=new Set(state.earned);
      clearFilters();update();
      $("notice").textContent=`Imported ${earned.size} earned trophies.`;
    } catch(error) { $("notice").textContent=`Import failed: ${error.message}`; }
    finally {event.target.value="";}
  });
  $("print").addEventListener("click",()=>window.print());
}

async function start() {
  const response=await fetch("./data/trophies.json");
  if (!response.ok) throw Error("Trophy data unavailable.");
  data=await response.json();
  state=normalize(defaults);
  try {state=normalize(JSON.parse(localStorage.getItem(storageKey)));} catch {}
  try {state=fromHash()??state;} catch {$("notice").textContent="This progress link is invalid.";}
  earned=new Set(state.earned);
  $("kind").innerHTML=Object.entries(kinds).map(([kind,label])=>`<option value="${kind}">${label}${kind==="online"?` (${data.meta.online})`:""}</option>`).join("");
  renderRoadmap();
  renderSources();
  wireControls();
  render();
}

start().catch(()=>{
  $("roadmap").innerHTML="<p class='empty' role='alert'>Could not load trophy data. Open the guide through its local server and reload.</p>";
});
