const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const csv=fs.readFileSync(path.join(root,'csv-plan.js'),'utf8');
function contextFor(page){
 const html=fs.readFileSync(path.join(root,page),'utf8');
 const script=html.split('<script>')[1].split('</script>')[0];
 const source=script.slice(0,script.indexOf('const box=document.getElementById("inputs");\nbox.addEventListener'))+
  script.slice(script.indexOf('/* ---------- model ---------- */'),script.indexOf('function calc()'));
 const context={sessionStorage:{getItem:()=>null},document:{querySelector:()=>({addEventListener(){}})}};
 vm.createContext(context);
 vm.runInContext(csv+'\n'+source,context);
 return context;
}
const single=contextFor('index.html');
const guided=contextFor('tabbed.html');
assert.equal(vm.runInContext('csvFilename(new Date(2026,10,20,9,5,7))',single),'firedrill_201126_090507.csv');

vm.runInContext('S.profile.sp=true;S.monthly[0].n="=SUM(1,2)\\nsecond line";S.assets[0].b=12345;',single);
const exported=vm.runInContext('csvExport(S,SEC,ASM)',single);
assert.ok(exported.startsWith('"section","index","field","value"\r\n'));
assert.ok(exported.includes('"meta","","format","firedrill-csv-v2"'));
assert.ok(exported.includes('"name:=SUM(1,2)\nsecond line"'), 'names are safe in spreadsheet cells');
guided.csvText=exported;
const imported=vm.runInContext('csvImport(csvText,SEC,ASM,stateError)',guided);
single.imported=imported;
assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(imported)',single)),
 JSON.parse(vm.runInContext('JSON.stringify(S)',single)),'both layouts can restore every input');
assert.equal(vm.runInContext('stateError(imported)',single),'');

const original=vm.runInContext('JSON.stringify(S)',guided);
const rejects=(text,pattern)=>{
 guided.csvText=text;
 assert.throws(()=>vm.runInContext('csvImport(csvText,SEC,ASM,stateError)',guided),pattern);
 assert.equal(vm.runInContext('JSON.stringify(S)',guided),original,'failed import leaves current inputs intact');
};
rejects(exported.replace('"monthly","","count","11"','"monthly","","count","12"'),/missing Monthly expenses/);
rejects(exported.replace('"profile","","life","90"','"profile","","life","101"'),/100/);
rejects(exported.replace('"profile","","sp","true"','"profile","","sp","maybe"'),/spouse setting/);
rejects(exported.replace('"name:=SUM(1,2)\nsecond line"','"=SUM(1,2)\nsecond line"'),/name field/);
rejects(exported.replace('"meta","","format","firedrill-csv-v2"','"meta","","format","other"'),/supported FIREdrill/);
rejects(exported+'"profile","","age","40"\r\n',/duplicate fields/);
rejects(exported.replace('"profile","","age","40"','"profile","","age","40'),/unfinished quoted field|invalid quoting/);
rejects(exported.replace('"profile","","age","40"','"profile","","age","1e6"'),/invalid number/);
const oldCsv=exported.replace('"meta","","format","firedrill-csv-v2"','"meta","","format","firedrill-csv-v1"')
 .split('\r\n').filter(line=>!/^"(?:income|goals)","\d+","(?:to|yrs)",/.test(line)).join('\r\n');
guided.csvText=oldCsv;
const restored=vm.runInContext('csvImport(csvText,SEC,ASM,stateError)',guided);
assert.ok(restored.income.every(row=>row.to===120));
assert.ok(restored.goals.every(row=>row.yrs===1));

const listeners=new Map(), timers=[];
const message={hidden:true,dataset:{},textContent:''};
const fileInput={files:[],value:'',addEventListener(name,handler){listeners.set(name,handler);}};
single.document={getElementById(id){
 if(id==='fileMessage') return message;
 if(id==='csvFile') return fileInput;
 return {addEventListener(){}};
}};
single.setTimeout=(callback,delay)=>{const timer={callback,delay,active:true};timers.push(timer);return timer;};
single.clearTimeout=timer=>{if(timer) timer.active=false;};
vm.runInContext('setupCsvControls(()=>S,()=>true,SEC,ASM,stateError)',single);
(async()=>{
 fileInput.files=[{name:'plan.csv',size:exported.length,text:async()=>exported}];
 await listeners.get('change')();
 assert.equal(message.textContent,'CSV imported. Your plan has been restored.');
 assert.equal(message.hidden,false);
 assert.equal(timers.at(-1).delay,5000);
 timers.at(-1).callback();
 assert.equal(message.hidden,true,'successful import notice clears after five seconds');

 fileInput.files=[{name:'plan.csv',size:exported.length,text:async()=>exported}];
 await listeners.get('change')();
 const pending=timers.at(-1);
 fileInput.files=[{name:'bad.csv',size:3,text:async()=>'bad'}];
 await listeners.get('change')();
 assert.equal(pending.active,false,'a later error cancels the old dismissal');
 assert.equal(message.hidden,false,'the later error stays visible');
 console.log('CSV backup checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
