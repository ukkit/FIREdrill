const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.split('<script>')[1].split('</script>')[0];
const source = script.slice(0, script.indexOf('const box=document.getElementById("inputs");\nbox.addEventListener')) +
  script.slice(script.indexOf('/* ---------- model ---------- */'), script.indexOf('function calc()'));
const context = {sessionStorage: {getItem: () => null}};
vm.createContext(context);
vm.runInContext(source, context);

assert.equal(vm.runInContext('changeAge("age",45)', context), '');
assert.equal(vm.runInContext('S.profile.retAge', context), 55);
assert.equal(vm.runInContext('S.profile.life', context), 95);
assert.equal(vm.runInContext('S.profile.spAge', context), 42);
assert.equal(vm.runInContext('S.profile.spRet', context), 60);
assert.equal(vm.runInContext('S.income[1].from', context), 63);
assert.equal(vm.runInContext('S.income[1].to', context), 120);
assert.equal(vm.runInContext('S.goals[0].age', context), 50);
assert.equal(vm.runInContext('changeAge("age",80)', context), '');
assert.equal(vm.runInContext('S.profile.life', context), 100, 'age shift caps the plan horizon');
assert.equal(vm.runInContext('changeAge("age",95)', context).includes('follow'), true);
assert.equal(vm.runInContext('S.profile.age', context), 80, 'invalid retirement shift is atomic');
vm.runInContext('S.profile.sp=true', context);
assert.equal(vm.runInContext('changeAge("spAge",79)', context), '');
assert.equal(vm.runInContext('S.profile.spRet', context), 97);
assert.equal(vm.runInContext('S.profile.retAge', context), 90, 'spouse age change leaves your retirement age alone');

const handlers = {};
context.document = {getElementById: id => id === 'inputs' ? {addEventListener(name, fn) {handlers[name] = fn;}} : {addEventListener() {}}};
const listeners = script.slice(script.indexOf('const box=document.getElementById("inputs");\nbox.addEventListener'), script.indexOf('/* ---------- model ---------- */'));
vm.runInContext(listeners, context);
vm.runInContext('render=()=>{};showError=()=>{};calc=()=>{}', context);
handlers.input({target: {dataset: {g: 'profile', k: 'age'}, value: '81'}});
assert.equal(vm.runInContext('S.profile.age', context), 80, 'typing does not shift ages mid-edit');
handlers.change({target: {dataset: {g: 'profile', k: 'age'}, value: '81'}});
assert.equal(vm.runInContext('S.profile.age', context), 81);
assert.equal(vm.runInContext('S.profile.retAge', context), 91, 'committing age shifts the linked retirement age');
assert.equal(vm.runInContext('S.profile.life', context), 100);
handlers.input({target: {dataset: {g: 'profile', k: 'age'}, value: '81'}});
handlers.focusout({target: {dataset: {g: 'profile', k: 'age'}, value: '81'}});
assert.equal(vm.runInContext('pendingAgeError', context), '', 'leaving an unchanged field clears the edit state');
const lifeField = {dataset: {g: 'profile', k: 'life'}, value: '105', type: 'number', tagName: 'INPUT', classList: {contains: () => false}};
handlers.input({target: lifeField});
assert.equal(lifeField.value, '100');
assert.equal(vm.runInContext('S.profile.life', context), 100);
assert.equal(vm.runInContext('cappedPlanAge', context), true);

function scenario(changes) {
  vm.runInContext(`S=clone(EX);
    S.profile={age:40,retAge:50,life:90,sp:false,spAge:40,spRet:50};
    S.asm={infG:0,infH:0,infE:0,post:0,swr:4,step:0,reserve:0};
    S.monthly=[];S.yearly=[];S.loans=[];S.assets=[];S.sips=[];S.income=[];S.goals=[];
    ${changes}`, context);
  return {error: vm.runInContext('stateError()', context), model: vm.runInContext('stateError()?null:model()', context)};
}

let result = scenario('S.sips=[{n:"SIP",a:100000,b:0,r:0}];S.goals=[{n:"College",a:3000000,age:41,yrs:1,inf:"G"}];');
assert.equal(result.error, '');
assert.equal(result.model.acc.unfunded.length, 1);
assert.equal(result.model.acc.unfunded[0].amount, 1800000);
assert.ok(Math.abs(result.model.extra - 150000) < 1, 'extra SIP must fund the goal when it is due');

result = scenario('S.sips=[{n:"SIP",a:100000,b:0,r:0}];S.goals=[{n:"Today",a:3000000,age:40,yrs:1,inf:"G"}];');
assert.equal(result.model.extra, Infinity, 'future SIPs cannot pay a goal due today');

result = scenario('S.profile.retAge=40;S.profile.life=44;S.asm.swr=100;S.goals=[{n:"College",a:100000,age:41,yrs:3,inf:"E"}];');
assert.equal(result.error, '');
assert.equal(result.model.F.goals, 300000, 'three college payments enter the FIRE rule');
assert.equal(result.model.F.cash, 300000, 'three college payments enter cash flow');
result = scenario('S.profile.retAge=40;S.profile.life=45;S.asm.swr=100;S.income=[{n:"Rent",a:1000,from:40,to:43}];');
assert.equal(result.error, '');
assert.equal(result.model.F.inc, 12000, 'rent is received in its first year');
assert.deepEqual(Array.from(result.model.tm.series,row=>row[1]), [0,12000,24000,36000,36000,36000], 'rent stops when the sale age is reached');
result = scenario('S.profile.retAge=40;S.profile.life=43;S.asm.infG=10;S.income=[{n:"Rent",a:1000,from:40,to:42}];');
assert.deepEqual(Array.from(result.model.tm.series,row=>Math.round(row[1])), [0,12000,25200,25200], 'rent grows with inflation only while received');
result = scenario('S.profile.retAge=40;S.profile.life=44;S.asm.infE=10;S.goals=[{n:"College",a:100000,age:41,yrs:3,inf:"E"}];');
assert.equal(Math.round(result.model.F.goals), 364100, 'each college year is inflated separately');
result = scenario('S.goals=[{n:"College",a:100000,age:41,yrs:0,inf:"E"}];');
assert.match(result.error, /Goal years/);
result = scenario('S.income=[{n:"Rent",a:1000,from:50,to:49}];');
assert.match(result.error, /stop age/);

result = scenario('S.asm.swr=0;');
assert.match(result.error, /Safe withdrawal rate/);
result = scenario('S.profile.life=101;');
assert.match(result.error, /life.*100/);
result = scenario('S.loans=[{n:"Loan",emi:1000,yrs:1000000}];');
assert.match(result.error, /yrs/);
result = scenario('S.yearly=[{n:"Spend",a:-100000,pct:100,inf:"G"}];');
assert.match(result.error, /yearly/i);

result = scenario('S.profile.retAge=40;S.profile.life=60;S.asm.swr=100;S.yearly=[{n:"Spend",a:10000000000,pct:100,inf:"G"}];');
assert.equal(result.error, '');
assert.ok(result.model.F.cash > 1e11, 'cash-flow search must pass its former ceiling');

result = scenario('S.profile.retAge=41;S.profile.life=45;S.goals=[{n:"Goal",a:10000000000,age:41,yrs:1,inf:"G"}];');
assert.equal(result.error, '');
assert.ok(result.model.extra > 1e8, 'extra SIP search must pass its former ceiling');

result = scenario('S.profile.retAge=40;S.profile.life=45;S.yearly=[{n:"Spend",a:100000,pct:100,inf:"G"}];S.assets=[{n:"Cash",a:1000000,b:0,r:0}];');
assert.equal(result.model.F.total, 2500000);
assert.equal(result.model.acc.total, 1000000);
assert.equal(result.model.F.total - result.model.acc.total, 1500000, 'shortfall compares amounts at the same age');

const elements = new Map();
context.document = {getElementById(id) {
  if (!elements.has(id)) elements.set(id, {innerHTML: '', textContent: '', className: '', hidden: false, disabled: false});
  return elements.get(id);
}};
vm.runInContext(script.slice(script.indexOf('function calc()'), script.indexOf('/* ---------- CSV backup ---------- */')), context);
vm.runInContext('calc()', context);
assert.equal(elements.get('statusLabel').textContent, 'Shortfall');
assert.equal(elements.get('statusValue').textContent, '15,00,000');
assert.match(elements.get('status').className, /bad/);
assert.match(elements.get('fireTodayAmount').textContent, /\d/);
assert.match(elements.get('tSubValue').textContent, /\d/);

scenario('S.profile.retAge=40;S.profile.life=45;S.yearly=[{n:"Spend",a:100000,pct:100,inf:"G"}];S.assets=[{n:"Cash",a:3000000,b:0,r:0}];');
vm.runInContext('calc()', context);
assert.equal(elements.get('statusLabel').textContent, 'Access');
assert.equal(elements.get('statusValue').textContent, '5,00,000');
assert.match(elements.get('status').className, /good/);

scenario('S.profile.retAge=40;S.profile.life=45;S.yearly=[{n:"Spend",a:100000,pct:100,inf:"G"}];S.assets=[{n:"Cash",a:2500000,b:0,r:0}];');
vm.runInContext('calc()', context);
assert.equal(elements.get('statusLabel').textContent, 'On target');
assert.equal(elements.get('statusValue').textContent, '0');
assert.match(elements.get('status').className, /neutral/);

const firstCard = html.slice(html.indexOf('id="fLabel"'), html.indexOf('class="card tmw"'));
assert.ok(firstCard.indexOf('id="projL"') < firstCard.indexOf('id="status"'));
assert.ok(firstCard.indexOf('id="status"') < firstCard.indexOf('id="extra"'));
assert.match(firstCard, /id="status"><span id="statusLabel">.*<span id="statusValue">/);
assert.match(firstCard, /<strong id="fireTodayAmount"><\/strong>/);
assert.match(firstCard, /<strong id="fireTodayYears"><\/strong>/);
assert.match(html, /gap<0\?"Shortfall":gap>0\?"Access":"On target"/);

assert.ok(!/https?:\/\//.test(html), 'page must not load external assets');
assert.match(html, /id="exportCsv"/);
assert.match(html, /id="importCsv"/);
assert.match(html, /src="csv-plan.js"/);
assert.ok(!html.includes('window.print()'));

const malformed = {sessionStorage: {getItem: () => JSON.stringify({v: 3, profile: {sp: false}})}};
vm.createContext(malformed);
vm.runInContext(source, malformed);
assert.equal(vm.runInContext('loadError', malformed), true, 'malformed saved data must be reported');
assert.equal(vm.runInContext('stateError()', malformed), '', 'example state must remain usable');

const legacyState = JSON.parse(vm.runInContext('JSON.stringify(S)', context));
legacyState.profile.life = 105;
let migrated;
const legacy = {sessionStorage: {
  getItem: () => JSON.stringify(legacyState),
  setItem: (_, value) => {migrated = JSON.parse(value);}
}};
vm.createContext(legacy);
vm.runInContext(source, legacy);
assert.equal(vm.runInContext('S.profile.life', legacy), 100);
assert.equal(vm.runInContext('cappedPlanAge', legacy), true);
assert.equal(vm.runInContext('loadError', legacy), false);
assert.equal(migrated.profile.life, 100, 'older saved plan is capped and retained');
assert.match(vm.runInContext('kvRows(LIFE,"profile")', legacy), /max="100"/);
const priorPlan = JSON.parse(vm.runInContext('JSON.stringify(EX)', context));
priorPlan.income.forEach(row => delete row.to);
priorPlan.goals.forEach(row => delete row.yrs);
const prior = {sessionStorage: {getItem: () => JSON.stringify(priorPlan)}};
vm.createContext(prior);
vm.runInContext(source, prior);
assert.equal(vm.runInContext('stateError()', prior), '');
assert.equal(vm.runInContext('S.income[0].to', prior), 120);
assert.equal(vm.runInContext('S.goals[0].yrs', prior), 1);
console.log('calculator regressions passed');
