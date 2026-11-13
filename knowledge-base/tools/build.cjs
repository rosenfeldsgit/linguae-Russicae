'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const out=path.resolve(process.argv[2]||path.join(root,'generated'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,'chapter-index.json'),'utf8'));
const sources=JSON.parse(fs.readFileSync(path.join(root,'sources.json'),'utf8'));
const expected=[1,4,5,6,7,...Array.from({length:14},(_,i)=>i+9)];
assert.deepEqual(Object.keys(catalog).map(Number),expected);
const ids=new Set,chapters=[],rules=[];
for(const [number,entry] of Object.entries(catalog)){
 for(const id of entry.sourceIds)assert(sources.sources[id],id);
 assert(entry.sourceIds.some(id=>sources.sources[id].kind==='primary'),number);
 const body=fs.readFileSync(path.join(root,entry.path),'utf8');
 for(const title of ['Что проверяется','Правила','Как применять','Разборы','Типичные ошибки','Источники'])assert(body.includes('## '+title),number+': '+title);
 const matches=[...body.matchAll(/^### (R\d{2}-\d{2})\. (.+)$/gm)];
 assert(matches.length>=5,number);
 const ruleIds=[];
 matches.forEach((m,i)=>{
  assert(m[1].startsWith('R'+number.padStart(2,'0')+'-'),m[1]);
  assert(!ids.has(m[1]),m[1]);ids.add(m[1]);ruleIds.push(m[1]);
  const next=i+1<matches.length?matches[i+1].index:body.indexOf('\n## Как применять',m.index);
  const markdown=body.slice(m.index+m[0].length,next).trim();assert(markdown.length>60,m[1]);
  rules.push({id:m[1],task:Number(number),title:m[2],markdown,sourceIds:entry.sourceIds});
 });
 chapters.push({task:Number(number),...entry,ruleIds,markdown:body});
}
for(const file of ['stress-words.json','paronym-groups.json','current-inventory.json'])JSON.parse(fs.readFileSync(path.join(root,'data',file),'utf8'));
const stress=JSON.parse(fs.readFileSync(path.join(root,'data/stress-words.json'),'utf8'));
for(const x of stress.entries){assert.equal((x.form.match(/[АЕЁИОУЫЭЮЯ]/g)||[]).length,1,x.form);assert(x.stressIndex>=0,x.form);}
const groups=JSON.parse(fs.readFileSync(path.join(root,'data/paronym-groups.json'),'utf8')).groups;
for(const x of groups){assert(x.forms.length>=2);assert(x.meanings);assert(x.cardIds.length);}
fs.mkdirSync(out,{recursive:true});
const metadata={schemaVersion:1,title:'Русский — база знаний',checkedOn:'2026-11-13',targetExamYear:2027,canonicalSource:'../chapters/*.md',chapterCount:chapters.length,ruleCount:rules.length,notCovered:[2,3,8,23,24,25,26,27]};
for(const [name,data]of Object.entries({'chapters.json':{metadata,chapters},'rules.json':{metadata,rules}}))fs.writeFileSync(path.join(out,name),JSON.stringify(data,null,2)+'\n');
fs.writeFileSync(path.join(out,'KNOWLEDGE_BASE_ALL.md'),'# Русский — база знаний\n\nВерсия 1.0. Дата 13.11.2026.\n\n'+fs.readFileSync(path.join(root,'README.md'),'utf8').replace(/\]\((?!https?:|#)([^)]+)\)/g,'](../$1)')+'\n\n'+chapters.map(c=>c.markdown).join('\n\n---\n\n'));
console.log(JSON.stringify({output:out,chapters:chapters.length,rules:rules.length,stressForms:stress.entries.length,paronymGroups:groups.length}));
