const data = await fetch("./data/trophies.json").then(r => r.json());
const trophies = data.trophies, sources = data.sources, disagreements = data.disagreements;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cite = v => esc(v).replace(/\[(\d+)\]/g, (match,n) => '<button class="cite" data-source="'+n+'">['+n+']</button>');
const gradeLetter = {platinum:"P",gold:"G",silver:"S",bronze:"B"};
const kinds = ["all","story","missable","collectibles","activities","crime","strangers","money","misc","online"];
const state = {query:"",kind:"all",progress:"all",crew:"all",minutes:30,selected:1,earned:new Set()};
const sharedLink = location.hash.startsWith("#run=");
const ids = new Set(trophies.map(t => t.id));
const find = id => trophies.find(t => t.id === Number(id));
function load() {
  try {
    if (location.hash.startsWith("#run=")) {
      const x = JSON.parse(decodeURIComponent(location.hash.slice(5)));
      state.earned = new Set((x.earned || []).map(Number).filter(id => ids.has(id))); return;
    }
  } catch {}
  try { state.earned = new Set((JSON.parse(localStorage.getItem("vice-route-55-earned") || "[]") || []).map(Number).filter(id => ids.has(id))); } catch {}
}
function save() { try { localStorage.setItem("vice-route-55-earned", JSON.stringify([...state.earned].sort((a,b)=>a-b))); } catch {} }
function crewOK(t) { return state.crew === "all" || ["both","either",state.crew].includes(t.protagonist); }
function kindOK(t) { return state.kind === "all" || t.kind === state.kind || (state.kind === "collectibles" && t.id === 28); }
function searchOK(t) { const q=state.query.toLowerCase().trim(); return !q || [t.name,t.description,t.guide,String(t.id)].some(x=>x.toLowerCase().includes(q)); }
function progressOK(t) { return state.progress === "all" || state.progress === "earned" === state.earned.has(t.id); }
function filtered() { return trophies.filter(t => crewOK(t) && kindOK(t) && searchOK(t) && progressOK(t)); }
function shield(t) { return t.hidden && $("#spoilers").checked && !state.earned.has(t.id); }
function tab(name) { $$(".views > section").forEach(s => s.hidden = s.id !== name); $$("nav [data-tab]").forEach(b => b.setAttribute("aria-current", b.dataset.tab === name ? "page" : "false")); if (name === "sources") $("#trophy-detail [data-disputes]")?.remove(); }
function select(id, goTracker) { if (!find(id)) return; state.selected=Number(id); if (goTracker) tab("tracker"); list(); detail(); }
function earned(id, value) { const n=Number(id); if (value === undefined ? state.earned.has(n) : !value) state.earned.delete(n); else state.earned.add(n); save(); all(); }
function list() {
  const shown=filtered(); $("#match-count").textContent=shown.length+" / 55 trophies";
  $("#trophy-list").innerHTML = shown.length ? shown.map(t => {
    const hidden=shield(t);
    return '<li class="trophy-row'+(t.id===state.selected?" active":"")+'"><input type="checkbox" data-earned="'+t.id+'" '+(state.earned.has(t.id)?"checked":"")+' aria-label="Mark '+esc(t.name)+' earned"><button data-pick="'+t.id+'" aria-current="'+(t.id===state.selected?"true":"false")+'"><span class="grade '+t.grade+'">'+gradeLetter[t.grade]+"</span> "+(hidden?"Hidden trophy":esc(t.name))+"<small>"+(hidden?"":esc(t.description))+"</small></button></li>";
  }).join("") : '<li class="empty">'+(state.kind==="online"?"There are no online trophies.":"No trophies match these filters.")+"</li>";
}
function detail() {
  const t=find(state.selected)||trophies[0], hidden=shield(t), title=hidden?"Hidden "+t.kind+" trophy":t.name;
  const level={high:3,medium:2,low:1}[t.confidence];
  const meter='<span class="meters" aria-label="'+t.confidence+' confidence">'+[1,2,3].map(n=>'<i class="'+(n<=level?"on":"")+'"></i>').join("")+"</span>";
  const ctag=["medium","low"].includes(t.confidence)?'<span class="tag '+t.confidence+'">'+t.confidence+"</span>":"";
  const tags='<div class="tags">'+meter+'<span class="tag">'+esc(t.kind)+"</span> "+ctag+" "+(t.missable?'<span class="tag">Missable</span> ':"")+'<span class="tag">'+esc(t.protagonist)+"</span></div>";
  $("#trophy-detail").innerHTML='<div class="guide-body"><h3>'+esc(title)+'</h3><div><span class="grade '+t.grade+'">'+gradeLetter[t.grade]+"</span> "+tags+"</div><p>"+esc(t.description)+"</p><ol>"+t.steps.map(s=>"<li>"+cite(s)+"</li>").join("")+'</ol><button data-mark="'+t.id+'" aria-pressed="'+state.earned.has(t.id)+'">'+(state.earned.has(t.id)?"Mark unearned":"Mark earned")+'</button> <button data-disputes>View source disagreements</button></div>';
}
function progress() {
  const n=state.earned.size, pct=Math.round(n/55*100), dash=n*100/55+" 100";
  const gs=["platinum","gold","silver","bronze"].map(g=>'<div><b>'+g[0].toUpperCase()+g.slice(1)+"</b>"+trophies.filter(t=>t.grade===g&&state.earned.has(t.id)).length+"/"+trophies.filter(t=>t.grade===g).length+"</div>").join("");
  $("#progress").innerHTML='<div class="odometer"><div class="dial" aria-label="'+pct+'% complete"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="#d9ddcf" stroke-width="3"></circle><circle cx="20" cy="20" r="16" fill="none" stroke="#075a50" stroke-width="3" pathLength="100" stroke-dasharray="'+dash+'"></circle></svg><b>'+pct+'%</b></div><div><b>'+n+' / 55</b><br><span class="fine">trophies earned</span></div></div><div class="grades">'+gs+'</div><p class="fine">≈ '+Math.round(200*(55-n)/55)+' h left of ~200 h</p>';
}
function crew() {
  $$("[data-crew]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.crew===state.crew)));
  const count=c=>trophies.filter(t=>["both","either",c].includes(t.protagonist));
  $("#crew-counts").innerHTML='<div class="crew-totals"><div><b>Jason</b>'+count("jason").filter(t=>state.earned.has(t.id)).length+"/"+count("jason").length+'</div><div><b>Lucia</b>'+count("lucia").filter(t=>state.earned.has(t.id)).length+"/"+count("lucia").length+"</div></div>";
}
function plan() {
  $$("[data-minutes]").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.minutes)===state.minutes)));
  const n={30:1,60:2,120:4}[state.minutes], stops=trophies.filter(t=>!state.earned.has(t.id)).sort((a,b)=>Number(b.missable)-Number(a.missable)||a.id-b.id).slice(0,n);
  $("#plan").innerHTML='<ol class="plan-list">'+stops.map(t=>'<li><button data-open="'+t.id+'">'+esc(t.name)+"</button></li>").join("")+"</ol>";
}
function roadmap() {
  const groups=[["Story and exploration","100 optional missions","200/277 vehicles","100/255 animals","15/18 meditations","70/80 challenges","300/397 stunts","100 WAiNK scans","15/18 card sets"],["Completion activities","33/33 underwater","42/42 shooting-range golds","42/42 drone races","15/15 Bret Target Decks","30/40 races","10/13 race-challenge golds","all robberies","Kenton 5/7","magazines 30/34"],["Collections and money","Cocaine Flamingos 100/125","playlists 2/2","styles 70/79","weapons 50/66","Smash 'N' Grabs 34/35","Stick Ups 50/91","fenced amounts"],["Leisure","4 video games","pool 5/7","mini golf 2/3","basketball 90/100"]];
  const checks=groups.map(g=>'<div class="check-group"><h3>'+g[0]+"</h3><dl>"+g.slice(1).map(x=>"<div><dt>"+x+"</dt><dd>✓</dd></div>").join("")+"</dl></div>").join("");
  $("#roadmap").innerHTML='<div class="route-intro"><p class="eyebrow">THE LONG WAY HOME</p><h2>A clean run through Leonida.</h2><p class="copy">One offline route, one careful Chapter 1 choice, and a checklist built for the long haul.</p><div class="facts"><span>Difficulty 4/10</span><span>~200 hours</span><span>1 playthrough</span><span>0 online trophies</span><span>55 trophies</span></div></div><div class="audit"><span>1 Platinum</span><span>2 Gold</span><span>6 Silver</span><span>46 Bronze</span><span>27 visible / 28 hidden</span><span>18 sources</span><span>1 missable</span></div><ol class="route"><li class="leg"><span class="milestone">01</span><div class="leg-top"><h3>Build the story spine</h3><span class="hours">60–80 h</span></div><p>Finish the story, optional missions, scans and the Chapter 1 balcony meditation before moving on.</p><div class="actions"><button data-open="1">Vice Got a Price!</button><button data-open="28">Positive Mental Attitude</button></div></li><li class="leg"><span class="milestone">02</span><div class="leg-top"><h3>Complete the atlas</h3><span class="hours">~100 h</span></div><p>Work through the 100% Completion checklist and 70 of 80 challenges after the story.</p><div class="actions"><button data-open="14">A Long Road</button></div></li><li class="leg"><span class="milestone">03</span><div class="leg-top"><h3>Clean up the edges</h3><span class="hours">~10 h</span></div><p>Finish Strangers & Freaks, crimes, collectibles and the final miscellaneous tasks.</p><div class="actions"><button data-open="25">Strangers & Freaks</button></div></li></ol><details><summary>100% Completion checklist</summary><div class="check-grid">'+checks+'</div></details><p class="actions"><button data-tab="missables">See the missable trophy</button></p>';
}
function missables() { const t=find(28); $("#missables").innerHTML='<div class="warning">Only one trophy can be missed: do the Chapter 1 balcony meditation before leaving the chapter.</div><article class="guide-card"><p class="eyebrow">MISSABLE / 01</p><h2>'+esc(t.name)+"</h2><p>"+esc(t.description)+'</p><p class="fine">During Chapter 1, follow Lucia to Jason’s balcony, accept the optional meditation and complete it.</p><button data-mark="28" aria-pressed="'+state.earned.has(28)+'">'+(state.earned.has(28)?"Mark unearned":"Mark earned")+"</button></article>"; }
function sourceView() {
  const cards=sources.map(s=>'<article class="source-card" id="source-'+s.n+'" tabindex="-1"><h3>'+esc(s.title)+"</h3><p>"+esc(s.publisher)+"</p><code>"+esc(s.url)+"</code></article>").join("");
  const ds=disagreements.map(d=>'<article class="dispute"><h3>'+esc(d.id)+" — "+esc(d.title)+"</h3><p>"+esc(d.positions)+'</p><p class="verdict">'+esc(d.call)+"</p></article>").join("");
  $("#sources").innerHTML='<div class="section-head"><div><p class="eyebrow">FIELD NOTES</p><h2>Sources and calls</h2></div></div><div class="source-grid">'+cards+'</div><section id="disagreements" tabindex="-1"><h2>Source disagreements</h2>'+ds+'</section><p class="actions"><button data-disputes>Focus disagreements</button></p>';
}
function printView() { $("#print-sheet").innerHTML="<h2>Vice Route 55 — Trophy Checklist</h2><ul>"+trophies.map(t=>"<li>"+esc(t.name)+" <small>["+gradeLetter[t.grade]+"]</small></li>").join("")+"</ul>"; }
function all() { list(); detail(); progress(); crew(); plan(); missables(); printView(); }

$("#kind").innerHTML=kinds.map(k=>'<option value="'+k+'">'+(k==="all"?"All kinds":k[0].toUpperCase()+k.slice(1))+"</option>").join("");
const reset=document.createElement("button"); reset.id="reset-filters"; reset.type="button"; reset.textContent="Reset filters"; $(".filters").append(reset);
load(); roadmap(); sourceView(); all(); tab(sharedLink ? "tracker" : "roadmap");
document.addEventListener("click", e => {
  const t=e.target.closest("[data-tab]"); if(t){tab(t.dataset.tab);return;}
  const p=e.target.closest("[data-pick]"); if(p){select(p.dataset.pick);return;}
  const o=e.target.closest("[data-open]"); if(o){select(o.dataset.open,true);return;}
  const m=e.target.closest("[data-mark]"); if(m){earned(m.dataset.mark);return;}
  const c=e.target.closest(".cite"); if(c){tab("sources");const x=$("#source-"+c.dataset.source);x.focus();x.scrollIntoView({block:"nearest"});return;}
  const d=e.target.closest("[data-disputes]"); if(d){tab("sources");const x=$("#disagreements");x.focus();x.scrollIntoView({block:"nearest"});return;}
  const b=e.target.closest("[data-earned]"); if(b){earned(b.dataset.earned,b.checked);return;}
  const cr=e.target.closest("[data-crew]"); if(cr){state.crew=cr.dataset.crew;list();crew();return;}
  const min=e.target.closest("[data-minutes]"); if(min){state.minutes=Number(min.dataset.minutes);plan();}
});
$("#query").addEventListener("input",e=>{state.query=e.target.value;list();});
$("#kind").addEventListener("change",e=>{state.kind=e.target.value;list();});
$("#earned-filter").addEventListener("change",e=>{state.progress=e.target.value;list();});
$("#spoilers").addEventListener("change",all);
reset.addEventListener("click",()=>{state.query="";state.kind="all";state.progress="all";state.crew="all";$("#query").value="";$("#kind").value="all";$("#earned-filter").value="all";list();crew();});
$("#import").addEventListener("click",()=>$("#import-file").click());
$("#import-file").addEventListener("change",async e=>{try{const x=JSON.parse(await e.target.files[0].text());state.earned=new Set((x.earned||[]).map(Number).filter(id=>ids.has(id)));save();all();$("#notice").textContent="Imported "+state.earned.size+" earned trophies.";}catch{$("#notice").textContent="Could not import progress.";}e.target.value="";});
$("#export").addEventListener("click",()=>{const a=document.createElement("a"),b=new Blob([JSON.stringify({version:1,earned:[...state.earned].sort((x,y)=>x-y)})],{type:"application/json"});a.href=URL.createObjectURL(b);a.download="vice-route-55-progress.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);});
$("#share").addEventListener("click",async()=>{const h="#run="+encodeURIComponent(JSON.stringify({earned:[...state.earned].sort((a,b)=>a-b)}));history.replaceState(null,"",h);try{await navigator.clipboard.writeText(location.href);$("#notice").textContent="Progress link copied";}catch{$("#share-fallback").hidden=false;$("#share-fallback").value=location.href;$("#notice").textContent="Select and copy this progress link";}});
$("#print").addEventListener("click",()=>window.print());
document.addEventListener("keydown",e=>{if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName))return;const v=filtered(),i=v.findIndex(t=>t.id===state.selected);if(e.key==="j"&&v.length)select(v[(i+1+v.length)%v.length].id);if(e.key==="k"&&v.length)select(v[(i-1+v.length)%v.length].id);if(e.key==="x"&&state.selected)earned(state.selected);if(e.key==="/"){e.preventDefault();tab("tracker");$("#query").focus();}});
