const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPage(name) {
  const html = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  const script = html.split('<script>')[1].split('</script>')[0];
  const source = script.slice(0, script.indexOf('const box=document.getElementById("inputs");\nbox.addEventListener')) +
    script.slice(script.indexOf('/* ---------- model ---------- */'), script.indexOf('function calc()'));
  const inputs = {innerHTML: ''};
  const keys = ['overview', 'household', 'spending', 'investing', 'future', 'outlook', 'assumptions', 'insights'];
  const tabs = keys.map(key => ({dataset: {tab: key}, setAttribute(name, value) {this[name] = value;}, focus() {this.focused = true;}}));
  const panels = keys.map(key => ({id: `panel-${key}`, hidden: key !== 'overview'}));
  const listeners = {};
  const context = {sessionStorage: {getItem: () => null}, document: {
    body: {dataset: {}},
    querySelector: () => ({addEventListener(name, fn) {listeners[name] = fn;}}),
    querySelectorAll: selector => selector.includes('role="tab"') ? tabs : panels,
    getElementById: () => inputs
  }};
  vm.createContext(context);
  vm.runInContext(source, context);
  return {html, context, inputs, tabs, panels, listeners};
}

const original = loadPage('index.html');
const guided = loadPage('tabbed.html');
const output = page => JSON.parse(vm.runInContext('JSON.stringify(model())', page.context));
assert.deepEqual(output(guided), output(original), 'guided view must preserve default calculations');

const caseData = 'S.goals=[{n:"College",a:3000000,age:41,inf:"G"}];S.assets=[];S.sips=[{n:"SIP",a:100000,b:0,r:0}];';
vm.runInContext(caseData, original.context);
vm.runInContext(caseData, guided.context);
assert.deepEqual(output(guided), output(original), 'guided view must preserve goal and SIP behavior');
assert.equal(vm.runInContext('changeAge("age",45)', original.context), '');
assert.equal(vm.runInContext('changeAge("age",45)', guided.context), '');
assert.deepEqual(output(guided), output(original), 'guided view must preserve age shifts');
assert.equal(vm.runInContext('changeAge("age",60)', original.context), '');
assert.equal(vm.runInContext('changeAge("age",60)', guided.context), '');
assert.equal(vm.runInContext('S.profile.life', guided.context), 100);
assert.deepEqual(output(guided), output(original), 'guided view must preserve the age cap');
assert.match(vm.runInContext('kvRows(LIFE,"profile")', guided.context), /max="100"/);

vm.runInContext('calc=()=>{};render()', guided.context);
const markup = guided.inputs.innerHTML;
const groups = {
  overview: ['Financial Independence, Retire Early', 'FIRE number', 'household spends'],
  household: ['summary', 'profile-age'],
  spending: ['data-add="monthly"', 'data-add="yearly"', 'data-add="loans"'],
  investing: ['data-add="assets"', 'data-add="sips"'],
  future: ['data-add="income"', 'data-add="goals"'],
  assumptions: ['asm-swr']
};
const keys = Object.keys(groups);
for (let i = 0; i < keys.length; i++) {
  const start = markup.indexOf(`id="panel-${keys[i]}"`);
  const end = i + 1 < keys.length ? markup.indexOf(`id="panel-${keys[i + 1]}"`) : markup.length;
  assert.ok(start >= 0 && end > start, `${keys[i]} panel exists`);
  for (const marker of groups[keys[i]]) assert.ok(markup.slice(start, end).includes(marker), `${marker} appears in ${keys[i]}`);
}
const navigation = guided.html.split('<nav class="tabs"')[1].split('</nav>')[0];
assert.equal((navigation.match(/role="tab"/g) || []).length, 8);
assert.ok(navigation.indexOf('data-tab="future"') < navigation.indexOf('data-tab="outlook"'));
assert.ok(navigation.indexOf('data-tab="outlook"') < navigation.indexOf('data-tab="assumptions"'));
assert.match(navigation, /class="outlook-tab" id="tab-outlook"/);
const outlook = guided.html.slice(guided.html.indexOf('id="panel-outlook"'), guided.html.indexOf('id="panel-insights"'));
assert.ok(outlook.includes('id="fLabel"') && outlook.includes('id="tYears"'));
assert.equal(guided.context.document.body.dataset.tab, 'overview');
guided.listeners.keydown({target: guided.tabs[0], key: 'ArrowRight', preventDefault() {}});
assert.equal(guided.context.document.body.dataset.tab, 'household');
assert.equal(guided.tabs[1]['aria-selected'], 'true');
assert.equal(guided.panels.find(p => p.id === 'panel-household').hidden, false);
assert.equal(guided.panels.find(p => p.id === 'panel-overview').hidden, true);
guided.listeners.keydown({target: guided.tabs[4], key: 'ArrowRight', preventDefault() {}});
assert.equal(guided.context.document.body.dataset.tab, 'outlook');
assert.equal(guided.panels.find(p => p.id === 'panel-outlook').hidden, false);
const firstCard = guided.html.slice(guided.html.indexOf('id="fLabel"'), guided.html.indexOf('class="card tmw"'));
assert.ok(firstCard.indexOf('id="projL"') < firstCard.indexOf('id="status"'));
assert.ok(firstCard.indexOf('id="status"') < firstCard.indexOf('id="extra"'));
assert.match(firstCard, /id="status"><span id="statusLabel">.*<span id="statusValue">/);
assert.match(firstCard, /<strong id="fireTodayAmount"><\/strong>/);
assert.match(firstCard, /<strong id="fireTodayYears"><\/strong>/);
assert.match(guided.html, /<strong id="tSubValue"><\/strong>/);
assert.match(guided.html, /gap<0\?"Shortfall":gap>0\?"Access":"On target"/);
assert.ok(!/https?:\/\//.test(guided.html), 'guided page makes no third-party requests');
assert.match(guided.html, /id="exportCsv"/);
assert.match(guided.html, /id="importCsv"/);
assert.match(guided.html, /src="csv-plan.js"/);
console.log('guided view checks passed');
