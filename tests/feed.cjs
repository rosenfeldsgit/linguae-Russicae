'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
class Element {
  constructor(){this.value='';this.textContent='';this.hidden=false;this.dataset={};this.listeners={};this.children=[];this.attributes={};this.parts={};}
  querySelector(selector){return this.parts[selector] ||= new Element();}
  addEventListener(name,fn){this.listeners[name]=fn;}
  fire(name){this.listeners[name]({preventDefault(){}});}
  add(option){this.children.push(option);}
  append(...children){this.children.push(...children);}
  replaceChildren(){this.children=[];}
  setAttribute(name,value){this.attributes[name]=value;}
  removeAttribute(name){delete this.attributes[name];if(name==='data-result')delete this.dataset.result;}
  cloneNode(){return new Element();}
}
(async()=>{
 const nodes={};const document={getElementById:id=>nodes[id] ||= new Element()};
 document.getElementById('exercise').content={firstElementChild:new Element()};
 const bank=[{id:'doshchinsky-2027-v1-q8',displayId:8,task:8,maxPrimary:2,answerType:'matching',answers:['12345'],explanation:'Разбор соответствий'}];
 const window={EGE_EXERCISES:{bank,score:(q,value)=>value==='12345'?2:value==='12344'?1:0,renderPassage(){},renderQuestion(){},renderAnswer(node,q){node.textContent=q.answers.join(" / ");}},EGE_EXAM_LOADER:{load:async q=>q}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../feed/feed.js'),'utf8'),{window,document,Map,Set,Option:function(text,value){this.text=text;this.value=value;}});
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 await tick();
 let card=nodes.feed.children[0],input=card.querySelector('input'),result=card.querySelector('.result');
 assert.equal(result.hidden,true);
 for(const [answer,outcome,title] of [['12345','correct','Верно · 2 из 2'],['12344','partial','Частично верно · 1 из 2'],['99999','incorrect','Неверно · 0 из 2']]){
  input.value=answer;input.fire('input');assert.equal(result.hidden,true);assert.equal(card.dataset.result,undefined);
  card.querySelector('form').fire('submit');assert.equal(result.hidden,false);assert.equal(result.querySelector('.answer-content').textContent,'12345');assert.equal(card.dataset.result,outcome);assert.equal(result.querySelector('.result-points').textContent,title);
 }
 assert.equal(input.attributes['aria-invalid'],'true');
 nodes.task.value='8';nodes.task.fire('change');await tick();
 card=nodes.feed.children[0];input=card.querySelector('input');result=card.querySelector('.result');
 assert.equal(input.value,'99999');assert.equal(card.dataset.result,'incorrect');assert.equal(result.hidden,false);
 input.value='12345';input.fire('input');assert.equal(input.attributes['aria-invalid'],undefined);assert.equal(result.hidden,true);
 card.querySelector('form').fire('submit');assert.equal(result.querySelector('.result-points').textContent,'Верно · 2 из 2');
 nodes['search-id'].value='999';nodes.search.fire('submit');await tick();assert.equal(nodes.feed.children.length,0);
 nodes.reset.fire('click');await tick();assert.equal(nodes.feed.children[0].dataset.result,'correct');
 console.log('Feed feedback, partial credit, editing, filter restoration and empty search: OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
