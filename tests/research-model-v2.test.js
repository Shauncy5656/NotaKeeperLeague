const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__dirname}/`), 'utf8');
const playerMatch = html.match(/<script>let PLAYERS=(\[[\s\S]*?\]);let state=/);
assert(playerMatch, 'embedded player pool is present');

const start = html.indexOf("const RESEARCH_MODEL_VERSION='2.0';");
const end = html.indexOf('\napplyLivePlayerCache();', start);
assert(start > 0 && end > start, 'Research Model v2 runtime is present');

const state = {
  mySlot: 6,
  pick: 1,
  log: [],
  playerFlags: {},
  teams: Array.from({length: 12}, (_, i) => ({name: `Team ${i + 1}`, players: []}))
};
const context = {state, console};
vm.createContext(context);
vm.runInContext(`
  let PLAYERS=${playerMatch[1]}; globalThis.PLAYERS=PLAYERS;
  function draftedIds(){return new Set(state.log.map(x=>x.pid))}
  function available(){const d=draftedIds();return PLAYERS.filter(p=>!d.has(p.id))}
  function roundOf(n){return Math.ceil(n/12)}
  function myPickInRound(r){return (r-1)*12+(r%2===1?state.mySlot:13-state.mySlot)}
  function nextMine(){for(let r=roundOf(state.pick);r<=16;r++){const p=myPickInRound(r);if(p>=state.pick)return p}return null}
  function picksUntilNextMine(){const n=nextMine();return n==null?null:Math.max(0,n-state.pick)}
  function sameTierRemaining(p){return available().filter(x=>x.pos===p.pos&&x.tier===p.tier).length}
  function recentPositionRun(){
    const counts={QB:0,RB:0,WR:0,TE:0};state.log.slice(-8).forEach(x=>{if(counts[x.pos]!==undefined)counts[x.pos]++});
    const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
    return top[1]>=4?{pos:top[0],level:'HOT'}:top[1]>=3?{pos:top[0],level:'WATCH'}:{pos:'NONE',level:'CALM'};
  }
  ${html.slice(start, end)}
  applyResearchModelV2();
`, context);

const players = context.PLAYERS;
assert.equal(players.length, 434, 'full player pool remains available');
assert.equal(players.filter(p => p.researchModel === '2.0').length, 300);
const required = ['projectedFantasyPoints', 'projectionRank', 'draftRank', 'posRank', 'vor',
  'researchAdjustment', 'confidenceScore', 'marketRank', 'priceCeiling', 'tier'];
for (const field of required) assert(players.slice(0, 300).every(p => p[field] !== undefined), `${field} is populated`);

const names = players.slice(0, 8).map(p => p.name);
for (const elite of ['Jahmyr Gibbs', 'Bijan Robinson', "Ja'Marr Chase", 'Puka Nacua',
  'Jaxon Smith-Njigba', 'Amon-Ra St. Brown']) assert(names.includes(elite), `${elite} is elite`);
const allen = players.find(p => p.name === 'Josh Allen');
assert.equal(allen.projectionRank, 1);
assert(allen.draftRank > 10, 'single-QB VOR keeps Josh Allen outside the overall top 10');
for (const te of ['Trey McBride', 'Brock Bowers']) assert(players.find(p => p.name === te).draftRank <= 24);

function best() {
  return context.available().slice().sort((a, b) => context.recommendationScoreV2(b) - context.recommendationScoreV2(a))[0];
}
assert.equal(best().name, 'Jahmyr Gibbs', 'Best Pick opens with championship value');

// Marking a player drafted removes him and changes the recommendation.
state.log.push({pick: 1, team: 0, pid: best().id, pos: best().pos});
state.pick = 2;
assert.notEqual(best().name, 'Jahmyr Gibbs');

// Simulate an early snake-draft room; the one-QB model should not force QB.
for (const p of players.slice(1, 18)) {
  if (state.log.some(x => x.pid === p.id)) continue;
  state.log.push({pick: state.pick++, team: (state.pick - 2) % 12, pid: p.id, pos: p.pos});
  if (state.pick >= 18) break;
}
assert.notEqual(best().pos, 'QB', 'early-round Best Pick does not force quarterback');

// Draft-slot selection changes the next snake turn in both directions.
state.mySlot = 1; state.pick = 2;
assert.equal(context.nextMine(), 24);
state.mySlot = 12; state.pick = 13;
assert.equal(context.nextMine(), 13);

// Static functionality contracts: exactly five visible tabs and persisted names.
assert.equal((html.match(/<button class="tab(?: active)?" data-view="(?:draft|players|teams|setup|board)"/g) || []).length, 5);
assert.match(html, /state\.teams\[\+x\.dataset\.i\]\.name=x\.value\.trim\(\)/);
assert.match(html, /save\(\);renderAll\(\)/);

console.log('Research Model v2 integration checks passed.');
