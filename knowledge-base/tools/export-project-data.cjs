'use strict';
// Export repository data without loading DOM, API credentials or administrator records.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const repo=path.resolve(__dirname,'../..');
const target=path.resolve(process.argv[2]||path.join(repo,'knowledge-base/data'));
fs.mkdirSync(target,{recursive:true});
const ctx={window:{}};
for(const file of ['cards.js','explanations.js','punctuation.js','adapted-cards.js','collection-cards.js','paronyms.js','prefix-explanations.js','audited-explanations.js','reasoned-explanations.js','collection-rule-hints.js','ne-explanations.js']){
 vm.runInNewContext(fs.readFileSync(path.join(repo,file),'utf8'),ctx,{filename:file});
}
const app=fs.readFileSync(path.join(repo,'app.js'),'utf8');
const stress=app.match(/const stressWords = `([\s\S]*?)`\.trim/)[1].trim().split(/\s+/);
const choices=JSON.parse(app.match(/const wordChoiceCards = (\[[\s\S]*?\n \]);/)[1]);
const all=[...choices,...ctx.window.EGE_CARDS,...ctx.window.EGE_ADAPTED_CARDS,...ctx.window.EGE_COLLECTION_CARDS,...ctx.window.EGE_PARONYMS,...ctx.window.EGE_PUNCTUATION];
const meta={asOf:'2026-11-13',scope:'current_repository_snapshot',official2027FullList:false,managedOverridesIncluded:false};
const write=(name,value)=>fs.writeFileSync(path.join(target,name),JSON.stringify(value,null,2)+'\n');
write('stress-words.json',{metadata:{...meta,source:'app.js: stressWords; source comment says FIPI 2026',verification:'Project spellings retained; not a new word-by-word verification against 2027 normative dictionaries'},entries:stress.map(form=>({form,word:form.toLowerCase(),stressIndex:form.search(/[АЕЁИОУЫЭЮЯ]/),context:form==='Отзыв'?'о книге':form==='отзЫв'?'посла из страны':''}))});
const groups=new Map;
for(const card of ctx.window.EGE_PARONYMS){
 const key=[...card.options].map(x=>x.toLowerCase()).sort().join('|');
 if(!groups.has(key))groups.set(key,{id:'PG-'+String(groups.size+1).padStart(3,'0'),forms:[...card.options],meanings:card.explanation,cardIds:[]});
 groups.get(key).cardIds.push(card.id);
}
write('paronym-groups.json',{metadata:{...meta,verification:'Existing authored project meanings; groups distinguish inflected forms, not necessarily unique lemma families'},groups:[...groups.values()]});
const counts={};for(const c of all)counts[c.task]=(counts[c.task]||0)+1;counts[4]=(counts[4]||0)+stress.length;
write('current-inventory.json',{metadata:meta,cardCountsByTask:counts,stressForms:stress.length,paronymGroups:groups.size,paronymCards:ctx.window.EGE_PARONYMS.length});
// Optional large reference export. Do not use legacy annotations as a source of linguistic truth.
if(process.argv.includes('--with-hints'))write('card-explanations.json',{metadata:{...meta,verification:'Project annotations of mixed review status. Prefer chapters and sources over legacy generic hints.'},entries:all.map(c=>({id:c.id,task:c.task,kind:c.kind||'letter',explanation:c.explanation||ctx.window.EGE_HINTS?.get(c.id)||''}))});
console.log(JSON.stringify({target,stressForms:stress.length,paronymGroups:groups.size,projectCards:all.length}));
