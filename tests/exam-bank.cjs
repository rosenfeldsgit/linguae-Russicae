'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..'),ctx={window:{}};
for(const file of ['exam-config.js','test/bank.js','test/bank-manifest.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
const bank=[...ctx.window.EGE_EXAM_BANK];
for(let v=3;v<=36;v++){
 const data=JSON.parse(fs.readFileSync(path.join(root,`test/doshchinsky-2027/v${v}.json`),'utf8'));
 assert.equal(data.questions.length,26);
 for(const p of Object.values(data.passages)){assert(p.text.length>250);assert(!p.blocks);}
 for(const q of data.questions){
  assert.equal(q.source.variant,v);assert.equal(q.displayId,(v-1)*26+q.task);assert(q.prompt.length>25);
  assert.equal(q.maxPrimary,[8,22].includes(q.task)?2:1);assert(q.answers.length);assert(q.answers.every(a=>typeof a==='string'&&a.length));
  if(q.answerType==='matching')for(const a of q.answers)assert(/^[1-9]{5}$/.test(a)&&new Set(a).size===5,`${q.id}: ${a}`);
  if(q.answerType==='set')for(const a of q.answers)assert(/^[1-9]+$/.test(a)&&new Set(a).size===a.length,`${q.id}: ${a}`);
  if(q.answerType==='number')assert(q.answers.every(a=>/^\d+$/.test(a)));
  assert.equal(q.passageKey,q.task<=3?'first':q.task>=23?'last':null);
  const pp=data.passages[q.passageKey];
  assert(!q.presentation,'Only ordinary text belongs in the question bank');
  assert(!/<(?:img|script)|data:image|maskImage|\.png/.test(q.prompt+(pp?.text||'')));
  bank.push({...q,passage:pp?.text||''});
 }
}
assert.equal(bank.length,936);assert.equal(new Set(bank.map(q=>q.id)).size,936);assert.equal(new Set(bank.map(q=>q.displayId)).size,936);
assert.equal(ctx.window.EGE_EXAM_MANIFEST.length,1820);
for(let task=1;task<=26;task++)assert.equal(bank.filter(q=>q.task===task).length,36);
for(let v=1;v<=36;v++)assert.equal(bank.filter(q=>q.source.variant===v).reduce((sum,q)=>sum+q.maxPrimary,0),28);
// Exercise the actual scoring implementation, including multi-digit sentence numbers.
const js=fs.readFileSync(path.join(root,'test/test.js'),'utf8');
vm.runInNewContext(fs.readFileSync(path.join(root,'test/exercises.js'),'utf8'),ctx);
const scoring=ctx.window.EGE_EXERCISES;
for(const q of bank)for(const answer of q.answers){assert.equal(scoring.score(q,answer),q.maxPrimary,q.id);assert.equal(scoring.score(q,''),0);}
const matching=bank.find(q=>q.answerType==='matching'),correct=matching.answers[0];
assert.equal(scoring.score(matching,'0'+correct.slice(1)),0);
assert.equal(scoring.score(matching,correct.slice(0,4)),1);
assert.equal(scoring.score(bank.find(q=>q.id==='doshchinsky-2027-v21-q26'),'6357'),1);
assert.equal(bank.find(q=>q.id==='doshchinsky-2027-v11-q8').answers[0],'74158');
assert(bank.find(q=>q.id==='doshchinsky-2027-v3-q7').prompt.includes('НЕДРЫ'),'Preserve the deliberate incorrect form');
assert(bank.find(q=>q.id==='doshchinsky-2027-v3-q15').prompt.includes('бессо(3)ых'));
for(const q of bank.filter(q=>q.source.variant>=3&&q.task===26)) {
 const nums=[...q.passage.matchAll(/\((\d{1,2})\)/g)].map(m=>Number(m[1]));
 assert(nums.length>10,q.id);for(let n=1;n<=Math.max(...nums);n++)assert(nums.includes(n),`${q.id}: missing sentence ${n}`);
}
console.log('936 questions, 36 variants, keys, text-only content, scoring and shared passages: OK');
(async()=>{
 const calls=[];const context={window:{},Map,Set,Promise,URL,AbortController,setTimeout,clearTimeout,document:{baseURI:'https://example.test/linguae-Russicae/feed/',currentScript:{src:'https://example.test/linguae-Russicae/test/bank-loader.js'}},fetch:async url=>{calls.push(String(url));assert(String(url).startsWith('https://example.test/linguae-Russicae/test/'));return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,'test',new URL(url).pathname.split('/test/')[1]),'utf8'))};}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'test/bank-loader.js'),'utf8'),context);
 const loader=context.window.EGE_EXAM_LOADER;
 const loaded=await Promise.all(ctx.window.EGE_EXAM_MANIFEST.map(q=>loader.load(q)));
 assert.equal(loaded.length,1820);assert.equal(calls.length,70,'one request per variant, including parallel calls');
 assert(loaded.every(q=>q.task<=3||q.task>=23?q.passage.length>250:!q.passage));
 bank.push(...loaded.filter(q=>q.id.startsWith('doshchinsky-2026-')));
 assert.equal(new Set(bank.map(q=>q.displayId)).size,1872);
 for(const q of bank)for(const a of q.answers)assert.equal(scoring.score(q,a),q.maxPrimary,q.id);
 const selectionCode=js.slice(js.indexOf('    const variants = {};'),js.indexOf('    return Promise.all(selected'));
 for(let i=0;i<50;i++){
  const selectionContext={numbers:Array.from({length:26},(_,i)=>i+1),bank,randomItem:xs=>xs[Math.floor(Math.random()*xs.length)]};
  vm.runInNewContext(selectionCode+'\nthis.selected=selected;',selectionContext);
  for(const group of [[1,2,3],[23,24,25,26]])assert.equal(new Set(selectionContext.selected.filter(q=>group.includes(q.task)).map(q=>JSON.stringify([q.source.title,q.source.variant]))).size,1);
 }
 context.window.EGE_READY_VARIANTS=ctx.window.EGE_READY_VARIANTS;
 const ready=await loader.loadReady(context.window.EGE_READY_VARIANTS[0]);
 assert.deepEqual(Array.from(ready,q=>q.task),Array.from({length:27},(_,i)=>i+1));
 assert.equal(ready[26].answerType,'essay');
 assert.equal(ready[26].passage,ready[22].passage);
 assert.equal(ready.slice(0,26).reduce((sum,q)=>sum+scoring.score(q,q.answers[0]),0),28);
 const summaries=ctx.window.EGE_READY_QUESTIONS;
 assert.equal(new Set([...bank,...summaries].map(q=>q.displayId)).size,bank.length+summaries.length);
 assert(summaries.every(q=>scoring.bank.some(item=>item.id===q.id)));
 for(const summary of summaries) {
  const question=await loader.load(summary);
  assert.equal(question.id,summary.id);
  assert.equal(question.displayId,summary.displayId);
 }
 assert.equal(calls.length,70+context.window.EGE_READY_VARIANTS.length,'ready and individual exam views share one fetch');
 const essaySummaries=ctx.window.EGE_ESSAY_QUESTIONS;
 assert.equal(essaySummaries.length,72);
 assert.equal(new Set([...bank,...summaries,...essaySummaries].map(q=>q.displayId)).size,bank.length+summaries.length+72);
 const passagesById=new Map(bank.map(q=>[q.id,q.passage]));
 for(const summary of essaySummaries){
  const essay=await loader.load(summary);
  const edition=summary.essayYear;
  assert.equal(essay.task,27);
  assert.equal(essay.essayYear,edition);
  assert.equal(essay.answerType,'essay');
  assert.equal(essay.maxPrimary,22);
  assert.equal(scoring.score(essay,'Первый абзац'),0);
  assert(essay.prompt.includes(essay.problem) && essay.problem.endsWith('?'),essay.id);
  assert(essay.authorPosition.length>50,essay.id);
  assert(essay.answerPage >= (edition===2026?342:327) && essay.answerPage <= (edition===2026?347:332),essay.id);
  assert.equal(essay.passage,passagesById.get(summary.passageSource.id),essay.id);
 }
 assert.equal(calls.length,70+context.window.EGE_READY_VARIANTS.length+2,'one essay key fetch per edition');
 console.log('Lazy loading, parallel request cache, random shared-text grouping: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
