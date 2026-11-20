import { readFileSync } from "node:fs";

const { trophies, sources, meta, disagreements } = JSON.parse(readFileSync(new URL("./app/data/trophies.json", import.meta.url)));
const ids = sources.map(source => source.n);
const counts = key => Object.groupBy(trophies, t => t[key]);
const refs = text => Array.from(text.matchAll(/\[(\d+)\]/g), match => Number(match[1]));
const steps = trophies.flatMap(t => t.steps);
function check(label, result) {
  console.log(`${result ? "PASS" : "FAIL"} ${label}`);
  if (!result) process.exitCode = 1;
}
check("55 consecutive trophy IDs", trophies.length === 55 && trophies.every((t,i) => t.id === i+1));
check("grades: 1P 2G 6S 46B", Object.entries({platinum:1,gold:2,silver:6,bronze:46}).every(([k,n]) => counts("grade")[k]?.length === n && meta.grades[k] === n));
check("visibility: 27 visible, 28 hidden", trophies.filter(t => t.hidden === true).length === 28 && trophies.filter(t => t.hidden === false).length === 27 && meta.hidden === 28 && meta.visible === 27);
check("every name, description, guide and step is nonblank", trophies.every(t => t.name.trim() && t.description.trim() && t.steps.length && t.steps.every(s => s.trim()) && t.guide === t.steps.join(" ")));
check("18 consecutive sources; all step citations resolve", ids.length === 18 && ids.every((n,i) => n === i+1) && trophies.every(t => t.sources.every(n => ids.includes(n)) && t.steps.every(s => /(?:\[\d+\])+$/.test(s) && refs(s).every(n => ids.includes(n) && t.sources.includes(n)))));
check("confidence and missable IDs match research", counts("confidence").high?.length === 47 && counts("confidence").medium?.map(t=>t.id).join() === "25,28,44,45,49,50,51" && counts("confidence").low?.map(t=>t.id).join() === "29" && trophies.filter(t=>t.missable).map(t=>t.id).join() === "28");
check("audit totals and D1–D9", meta.total === trophies.length && meta.sourceCount === ids.length && meta.citedSteps === steps.length && meta.stepReferences === steps.flatMap(refs).length && disagreements.map(d=>d.id).join() === "D1,D2,D3,D4,D5,D6,D7,D8,D9");
console.log(`Audit: ${steps.length} cited steps, ${steps.flatMap(refs).length} citation markers.`);
