/* FIREdrill input backup. Kept separate so both layouts use the same file format. */
const CSV_HEADER=["section","index","field","value"];
const CSV_FORMAT="firedrill-csv-v2";
const CSV_PROFILE=["age","retAge","life","sp","spAge","spRet"];

function csvFilename(date=new Date()){
 const two=n=>String(n).padStart(2,"0");
 return `firedrill_${two(date.getDate())}${two(date.getMonth()+1)}${two(date.getFullYear()%100)}_${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}.csv`;
}

function csvExport(plan,sections,assumptions){
 const rows=[CSV_HEADER,["meta","","format",CSV_FORMAT]];
 for(const key of CSV_PROFILE) rows.push(["profile","",key,String(plan.profile[key])]);
 for(const [key] of assumptions) rows.push(["asm","",key,String(plan.asm[key])]);
 for(const sec of sections){
  rows.push([sec.k,"","count",String(plan[sec.k].length)]);
  plan[sec.k].forEach((row,index)=>{
   for(const [key] of sec.cols) rows.push([sec.k,String(index),key,key==="n"?"name:"+row[key]:String(row[key])]);
  });
 }
 const cell=value=>'"'+String(value).replace(/"/g,'""')+'"';
 return rows.map(row=>row.map(cell).join(",")).join("\r\n")+"\r\n";
}

function csvRecords(text){
 if(typeof text!=="string"||text.length>2_000_000) throw Error("CSV file is too large or invalid.");
 const rows=[];let row=[],field="",quoted=false,closed=false,started=false;
 const endField=()=>{row.push(field);field="";closed=false;started=false;};
 const endRow=()=>{endField();if(row.length!==4||rows.length>=3000) throw Error("CSV has an invalid row.");rows.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'&&text[i+1]==='"'){field+='"';i++;}
   else if(c==='"'){quoted=false;closed=true;}
   else field+=c;
  }else if(c==='"'){
   if(started||closed) throw Error("CSV has invalid quoting.");
   quoted=true;started=true;
  }else if(c===","){endField();}
  else if(c==="\r"||c==="\n"){
   if(c==="\r"&&text[i+1]==="\n") i++;
   endRow();
  }else{
   if(closed) throw Error("CSV has invalid quoting.");
   field+=c;started=true;
  }
 }
 if(quoted) throw Error("CSV has an unfinished quoted field.");
 if(started||closed||row.length) endRow();
 return rows;
}

function csvImport(text,sections,assumptions,validate){
 const rows=csvRecords(text.replace(/^\uFEFF/,""));
 if(rows.length<2||rows[0].some((value,i)=>value!==CSV_HEADER[i])||
    rows[1][0]!=="meta"||rows[1][1]!==""||rows[1][2]!=="format"||!([CSV_FORMAT,"firedrill-csv-v1"].includes(rows[1][3])))
  throw Error("This is not a supported FIREdrill CSV file.");
 const legacy=rows[1][3]==="firedrill-csv-v1";
 const plan={v:3,profile:{},asm:{}};
 const fields=new Map(),counts=new Map(),seen=new Set();
 for(const sec of sections){plan[sec.k]=[];fields.set(sec.k,sec.cols.filter(([key])=>!legacy||!((sec.k==="income"&&key==="to")||(sec.k==="goals"&&key==="yrs"))).map(([key])=>key));}
 const asmKeys=assumptions.map(([key])=>key);
 for(const [group,index,key,value] of rows.slice(2)){
  const id=[group,index,key].join("/");
  if(seen.has(id)) throw Error("CSV has duplicate fields.");
  seen.add(id);
  if(group==="profile"||group==="asm"){
   if(index!==""||!(group==="profile"?CSV_PROFILE:asmKeys).includes(key)) throw Error("CSV has an unknown field.");
   if(group==="profile"&&key==="sp"){
    if(value!=="true"&&value!=="false") throw Error("CSV has an invalid spouse setting.");
    plan.profile.sp=value==="true";
   }else plan[group][key]=csvNumber(value);
  }else if(fields.has(group)){
   if(index===""&&key==="count"){
    if(!/^(?:0|[1-9]\d*)$/.test(value)||Number(value)>100) throw Error("CSV has an invalid row count.");
    counts.set(group,Number(value));
   }else{
    if(!/^(?:0|[1-9]\d*)$/.test(index)||Number(index)>=100||!fields.get(group).includes(key)) throw Error("CSV has an unknown row field.");
    const n=Number(index);
    plan[group][n]??={};
    if(key==="n"){
     if(!value.startsWith("name:")) throw Error("CSV has an invalid name field.");
     plan[group][n].n=value.slice(5);
    }else if(key==="inf") plan[group][n].inf=value;
    else plan[group][n][key]=csvNumber(value);
   }
  }else throw Error("CSV has an unknown section.");
 }
 if(Object.keys(plan.profile).length!==CSV_PROFILE.length||Object.keys(plan.asm).length!==asmKeys.length)
  throw Error("CSV is missing household or assumption fields.");
 for(const sec of sections){
  const count=counts.get(sec.k),items=plan[sec.k];
  if(count===undefined||items.length!==count||items.some(item=>!item||Object.keys(item).length!==fields.get(sec.k).length))
   throw Error(`CSV is missing ${sec.t} data.`);
 }
 if(legacy){plan.income.forEach(row=>row.to=120);plan.goals.forEach(row=>row.yrs=1);}
 const problem=validate(plan);
 if(problem) throw Error(problem);
 return plan;
}

function csvNumber(value){
 if(!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) throw Error("CSV has an invalid number.");
 const number=Number(value);
 if(!Number.isFinite(number)) throw Error("CSV has an invalid number.");
 return number;
}

function setupCsvControls(getPlan,applyPlan,sections,assumptions,validate){
 const message=document.getElementById("fileMessage");
 const fileInput=document.getElementById("csvFile");
 let noticeTimer;
 const say=(text,error,dismissAfter=0)=>{
  clearTimeout(noticeTimer);
  message.textContent=text;message.hidden=false;message.dataset.error=String(error);
  if(dismissAfter) noticeTimer=setTimeout(()=>{message.hidden=true;},dismissAfter);
 };
 document.getElementById("exportCsv").addEventListener("click",()=>{
  const plan=getPlan(),problem=validate(plan);
  if(problem){say(problem,true);return;}
  const blob=new Blob(["\uFEFF",csvExport(plan,sections,assumptions)],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download=csvFilename();document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60_000);
  say("CSV exported. Keep the file somewhere private so you can import it later.",false);
 });
 document.getElementById("importCsv").addEventListener("click",()=>fileInput.click());
 fileInput.addEventListener("change",async()=>{
  const file=fileInput.files?.[0];fileInput.value="";
  if(!file) return;
  if(!/\.csv$/i.test(file.name)||file.size>2_000_000){say("Choose a FIREdrill CSV file under 2 MB.",true);return;}
  let contents;
  try{contents=await file.text();}
  catch{say("Could not read this CSV file.",true);return;}
  try{
   const plan=csvImport(contents,sections,assumptions,validate);
   const saved=applyPlan(plan);
   say(saved?"CSV imported. Your plan has been restored.":"CSV imported, but this browser could not save it in this tab. Export it again before closing the page.",!saved,saved?5_000:0);
  }catch(error){
   say(error instanceof Error?error.message:"Could not read this CSV file.",true);
  }
 });
}
