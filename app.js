'use strict';
(() => {
 // ФИПИ, Орфоэпический список – 2026. Прописная гласная отмечает ударение.
 const stressWords = `аэропОрты бАнты бОроду бухгАлтеров вероисповЕдание водопровОд газопровОд граждАнство 
дефИс дешевИзна диспансЕр договорЁнность докумЕнт досУг еретИк жалюзИ 
знАчимость Иксы каталОг квартАл киломЕтр кОнусов корЫсть крАны 
кремЕнь кремнЯ лЕкторов лОктя локтЕй лыжнЯ мЕстностей намЕрение 
нЕдруг недУг некролОг нЕнависть нефтепровОд новостЕй нОгтя ногтЕй 
Отзыв отзЫв Отрочество партЕр портфЕль придАное призЫв свЁкла 
сирОты созЫв сосредотОчение срЕдства стАтуя столЯр тамОжня тОрты 
тУфля цемЕнт цЕнтнер цепОчка шАрфы шофЁр экспЕрт вернА 
знАчимый красИвее красИвейший кУхонный ловкА мозаИчный оптОвый прозорлИвый 
прозорлИва слИвовый бралА бралАсь взялА взялАсь влилАсь ворвалАсь 
воспринЯть воспринялА воссоздалА вручИт гналА гналАсь добралА добралАсь 
дождалАсь дозвонИтся дозИровать ждалА закУпорить занЯть зАнял занялА 
зАняли заперлА запломбировАть защемИт звалА звонИт кАшлянуть клАла 
клЕить крАлась кровоточИть лгалА лилА лилАсь наделИт надорвалАсь 
назвалАсь накренИтся налилА нарвалА начАть нАчал началА нАчали 
обзвонИт облегчИть облегчИт облилАсь обнялАсь обогналА ободралА ободрИть 
ободрИт ободрИться ободрИтся обострИть одолжИть одолжИт озлОбить оклЕить 
окружИт опОшлить освЕдомиться освЕдомится отбылА отдалА откУпорить отозвалА 
отозвалАсь перезвонИт перелилА плодоносИть пломбировАть повторИт позвалА позвонИт 
полилА положИть положИл понЯть понялА послАла прибЫть прИбыл 
прибылА прИбыли принЯть прИнял принялА прИняли рвалА сверлИт 
снялА создалА сорвалА убралА углубИть укрепИт чЕрпать щемИт 
щЁлкать довезЁнный зАгнутый зАнятый занятА зАпертый заселЁнный заселенА 
кровоточАщий нажИвший налИвший нанЯвшийся начАвший нАчатый низведЁнный облегчЁнный 
ободрЁнный обострЁнный отключЁнный повторЁнный поделЁнный понЯвший прИнятый принятА 
приручЁнный прожИвший снятА сОгнутый углублЁнный закУпорив начАв начАвшись 
отдАв понЯв прибЫв создАв вОвремя дОверху дОнизу дОсуха 
зАсветло надОлго ненадОлго`.trim().split(/\s+/);
 const stressCards = stressWords.map(form => {
   const position = form.search(/[АЕЁИОУЫЭЮЯ]/);
   const word = form.toLowerCase();
   const context = form === 'Отзыв' ? 'о книге' : form === 'отзЫв' ? 'посла из страны' : '';
   return { id: 'stress-' + form, task: 4, kind: 'stress', prompt: word,
     before: word.slice(0, position), after: word.slice(position + 1),
     spelling: word[position],
     answer: String(position), context };
 });
 const wordChoiceCards = [
   {
     "id": "task1-50641",
     "task": 1,
     "kind": "word-choice",
     "instruction": "Подберите притяжательное местоимение",
     "before": "Даль изучал жизнь простых людей и хорошо понимал ",
     "after": " психологию.",
     "answer": "их",
     "options": [
       "их",
       "его",
       "свою"
     ],
     "explanation": "Психологию чью? Простых людей → их. «Свою» относилось бы к самому Далю."
   },
   {
     "id": "task1-50675",
     "task": 1,
     "kind": "word-choice",
     "instruction": "Подберите подчинительный союз со значением условия",
     "before": "",
     "after": " человек высший смысл видит в куске прожаренного мяса, то ему подвиг Гумбольдта покажется вздорным сумасбродством.",
     "answer": "Если",
     "options": [
       "Если",
       "Хотя",
       "Поскольку"
     ],
     "explanation": "«Если …, то …» — условие и его следствие. «Хотя» выражает уступку, «поскольку» — причину."
   }
 ];
 const stableId = id => 200000 + [...id].reduce((hash, c) => (Math.imul(hash, 31) + c.codePointAt(0)) >>> 0, 0);
 const managed = window.EGE_MANAGED || {cards:[],disabled:[],tasks:{}};
 const overrides = new Map(managed.cards.map(c => [c.id,c]));
 const staticCards = [...wordChoiceCards, ...(window.EGE_PARONYMS || []), ...(window.EGE_ADAPTED_CARDS || []), ...(window.EGE_COLLECTION_CARDS || []), ...(window.EGE_CARDS || []), ...stressCards, ...(window.EGE_PUNCTUATION || [])];
 const staticIds = new Set(staticCards.map(c=>c.id));
 const cards = [...staticCards,...managed.cards.filter(c=>!staticIds.has(c.id))].filter(c => !managed.disabled.includes(c.id)).map(c => overrides.get(c.id) || c).map(card => ({ ...card, displayId: card.displayId || stableId(card.id), maxPrimary: (managed.tasks[card.task] || window.EGE_EXAM_CONFIG.tasks[card.task] || {maxPrimary:1}).maxPrimary }));
 const $=id=>document.getElementById(id);
 const sections=[['all','Все подряд'],['1','1'],['5','5'],...Array.from({length:7},(_,i)=>[String(i+9),String(i+9)]),['stress','Ударение'],['punctuation','Пунктуация']];
 for (const task of Object.values(managed.tasks)) { if (!sections.some(s=>s[0]===String(task.number)) && cards.some(c=>c.task===task.number)) sections.splice(sections.length-2,0,[String(task.number),String(task.number)]); }
 let pool=[],current=null,timer=null,locked=false,correct=0,wrong=0;
 const rotations = new Map();
 let rotation;
 let historySequence = 0;
 let selectedSlots = new Set();
 const random=n=>Math.floor(Math.random()*n);
 function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
 // Source IDs differ across editions, so rotate by the exercise content.
 function exerciseKey(card) {
   const normalize = value => String(value || '').normalize('NFC').toLowerCase()
     .replace(/ё/g, 'е').replace(/\*\*/g, '').replace(/(?:\.{2,}|…|___)/g, '…')
     .replace(/\s+/g, ' ').trim();
   const prompt = card.kind === 'word-choice' || card.kind === 'letter'
     ? card.before + '…' + card.after
     : card.kind === 'punctuation' ? card.parts.join('…') : card.prompt;
   return JSON.stringify([card.task, card.kind, normalize(prompt),
     card.kind === 'stress' ? '' : normalize(card.context), card.answer, card.mark || '']);
 }
 function createRotation(items) {
   const groups = new Map();
   for (const card of items) {
     const key = exerciseKey(card);
     if (!groups.has(key)) groups.set(key, []);
     groups.get(key).push(card);
   }
   return {groups, remaining: [], lastKey: null};
 }
 function nextCard(state) {
   if (!state.remaining.length) {
     state.remaining = shuffle([...state.groups.keys()]);
     // Avoid repeating the last exercise at the boundary between rounds.
     const last = state.remaining.length - 1;
     if (last > 0 && state.remaining[last] === state.lastKey) {
       [state.remaining[0], state.remaining[last]] = [state.remaining[last], state.remaining[0]];
     }
   }
   state.lastKey = state.remaining.pop();
   const copies = state.groups.get(state.lastKey);
   return copies[random(copies.length)];
 }
 function solution(node,c){if(c.kind === 'punctuation'){node.replaceChildren();c.parts.forEach((part,index)=>{node.append(document.createTextNode(part));if(index<c.parts.length-1){if(c.answer.includes(index)){const m=document.createElement('mark');m.textContent=c.mark==='—'?' —':c.mark;node.append(m);}node.append(document.createTextNode(' '));}});return;}node.replaceChildren(document.createTextNode(c.before));const m=document.createElement('mark');m.textContent=c.spelling||c.answer;node.append(m,document.createTextNode(c.after));}
 function addExplanation(item, word, card) {
   let hint = card.explanation || window.EGE_HINTS?.get(card.id);
   if (card.kind === 'stress' && !hint) {
     const syllable = (card.before.match(/[аеёиоуыэюя]/g) || []).length + 1;
     hint = 'Словарное ударение падает на ' + syllable + '-й слог: ' +
       card.before + card.spelling.toUpperCase() + card.after + '.';
   }
   if (!hint) return;
   const note = document.createElement('p');
   note.className = 'rule-note';
   note.id = 'rule-' + card.id + '-' + historySequence;
   note.textContent = hint;
   note.hidden = true;
   const toggle = document.createElement('button');
   toggle.type = 'button';
   toggle.className = 'rule-toggle';
   toggle.textContent = 'ⓘ';
   toggle.setAttribute('aria-label', 'Пояснение к ' + (card.kind === 'punctuation' ? 'предложению' : 'слову «' + (card.kind === 'stress' ? card.prompt : card.spelling || card.before + card.answer + card.after) + '»') );
   toggle.setAttribute('aria-controls', note.id);
   toggle.setAttribute('aria-expanded', 'false');
   toggle.addEventListener('click', () => {
     note.hidden = !note.hidden;
     toggle.setAttribute('aria-expanded', String(!note.hidden));
   });
   word.append(toggle);
   item.append(note);
 }
 function showStress(card) {
   const word = $('word');
   word.replaceChildren();
   const letters = [...card.prompt];
   const vowels = letters.filter(letter => /[аеёиоуыэюя]/.test(letter)).length;
   word.style.setProperty('--units', vowels * 1.5 + (letters.length - vowels) * 0.8);
   letters.forEach((letter, index) => {
     if (!/[аеёиоуыэюя]/.test(letter)) {
       word.append(document.createTextNode(letter));
       return;
     }
     const button = document.createElement('button');
     button.type = 'button';
     button.className = 'option vowel';
     button.dataset.value = String(index);
     button.textContent = letter === 'ё' ? 'е' : letter;
     button.setAttribute('aria-label', 'Ударение на ' + button.textContent + ', позиция ' + (index + 1));
     button.addEventListener('click', () => answer(button.dataset.value));
     word.append(button);
   });
 }

 function showPunctuation(card) {
   const word = $('word');
   word.replaceChildren();
   selectedSlots = new Set();
   card.parts.forEach((part, index) => {
     word.append(document.createTextNode(part));
     if (index === card.parts.length - 1) return;
     const button = document.createElement('button');
     button.type = 'button';
     button.className = 'option punct-slot';
     button.dataset.value = String(index);
     button.textContent = '·';
     button.setAttribute('aria-label', ({',':'Запятая',':':'Двоеточие','—':'Тире'}[card.mark]) + ' после «' + part + '»');
     button.setAttribute('aria-pressed', 'false');
     button.addEventListener('click', () => {
       if (locked) return;
       if (selectedSlots.has(index)) selectedSlots.delete(index);
       else selectedSlots.add(index);
       const selected = selectedSlots.has(index);
       button.textContent = selected ? card.mark : '·';
       button.classList.toggle('selected', selected);
       button.setAttribute('aria-pressed', String(selected));
     });
     word.append(document.createTextNode(' '), button, document.createTextNode(' '));
   });
 }
 function choices() {
   return (['stress', 'punctuation'].includes(current?.kind) ? $('word') : $('options')).querySelectorAll('button');
 }
 function chooseNext(){
  clearTimeout(timer);timer=null;locked=false;
  if(!pool.length)return;
  current=nextCard(rotation);
  const punctuation = current.kind === 'punctuation';
  const phrase=['spelling','join','word-choice'].includes(current.kind);
  $('instruction').textContent=current.instruction || (phrase?'Выбери написание':'');
  $('instruction').hidden=!(phrase || punctuation);
  $('check-answer').hidden=!punctuation;
  $('check-answer').disabled=false;
  $('word').classList.toggle('punctuation-word', punctuation);
  $('word').textContent=current.kind==='word-choice'?current.before+'___'+current.after:current.kind==='spelling'?(current.context||current.prompt):current.prompt;
  $('word').classList.toggle('sentence',phrase);
  $('word').classList.toggle('long',(current.prompt || '').length>23||current.kind==='spelling');
  $('context').textContent=current.kind==='spelling'?'':current.context || '';
  $('feedback').textContent='';$('feedback').className='feedback';
  $('task-label').textContent=`Задание ${current.task}`;
  $('options').replaceChildren();
  $('word').classList.toggle('stress-word', current.kind === 'stress');
  if (punctuation) {
    showPunctuation(current);
    return;
  }
  if (current.kind === 'stress') {
    showStress(current);
    return;
  }
  (current.kind==='join'?current.options:shuffle(current.options)).forEach(value=>{const b=document.createElement('button');b.type='button';b.className='option'+(phrase?' phrase':'');b.textContent=value;if(value==='∅')b.setAttribute('aria-label','Нет буквы');b.dataset.value=value;b.addEventListener('click',()=>answer(value));$('options').append(b);});
 }
 function addHistory(card, good) {
   historySequence++;
   const item = document.createElement('li');
   item.className = good ? 'history-correct' : 'history-incorrect';
   item.setAttribute('aria-label', good ? 'Верный ответ' : 'Ошибка');
   const word = document.createElement('div');
   word.className = 'mistake-word';
   solution(word, card);
   if (card.kind === 'punctuation') {
     word.replaceChildren();
     card.parts.forEach((part, index) => {
       word.append(document.createTextNode(part));
       if (index === card.parts.length - 1) return;
       const expected = card.answer.includes(index);
       const selected = selectedSlots.has(index);
       if (expected || selected) {
         const mark = document.createElement('mark');
         mark.className = expected && selected ? 'history-right' : 'history-wrong';
         mark.textContent = card.mark === '—' ? ' —' : card.mark;
         word.append(mark);
       }
       word.append(document.createTextNode(' '));
     });
   }
   item.append(word);
   if (card.context) {
     const context = document.createElement('small');
     context.textContent = card.context;
     item.append(context);
   }
   if (!good) addExplanation(item, word, card);
   $('mistake-list').prepend(item);
   $('empty').hidden = true;
 }
 function answer(value){
  if(locked||!current)return;locked=true;
  const punctuation = current.kind === 'punctuation';
  const good=punctuation ? selectedSlots.size===current.answer.length && current.answer.every(index=>selectedSlots.has(index)) : value===current.answer;
  $('check-answer').disabled=true;
  if(good)correct++;else wrong++;
  addHistory(current, good);
  $('correct').textContent=correct;$('wrong').textContent=wrong;
  for(const b of choices()){b.disabled=true;if(punctuation){const index=Number(b.dataset.value);const expected=current.answer.includes(index);b.textContent=expected || selectedSlots.has(index) ? current.mark : '·';b.classList.add(expected===selectedSlots.has(index)?'right':'wrong');continue;}if(b.dataset.value===current.answer)b.classList.add('right');else if(b.dataset.value===value)b.classList.add('wrong');}
  if (current.kind === 'stress') {
    const right = $('word').querySelector('.right');
    right.textContent = current.prompt[Number(current.answer)];
  } else if (!punctuation) solution($('word'),current);
  $('feedback').textContent=good ? (punctuation && !current.answer.length ? 'Верно! ' + ({',':'Запятые',':':'Двоеточия','—':'Тире'}[current.mark]) + ' не нужны.' : 'Верно!') : 'Вы ошиблись.';$('feedback').className='feedback'+(good?'':' error');
  timer=setTimeout(chooseNext,punctuation ? (good?1800:3000) : good?600:1200);
 }
 function select(id){
  clearTimeout(timer);timer=null;current=null;locked=false;$('instruction').hidden=true;
  correct=wrong=0;$('correct').textContent='0';$('wrong').textContent='0';$('mistake-list').replaceChildren();$('empty').hidden=false;
  for(const b of $('sections').children)b.setAttribute('aria-pressed',String(b.dataset.section===id));
  pool = id === 'all' ? cards : id === 'stress' ? cards.filter(c => c.kind === 'stress') : id === 'punctuation' ? cards.filter(c => c.kind === 'punctuation') : cards.filter(c => c.task === Number(id));
  if(!pool.length){$('word').textContent='Не удалось загрузить карточки';$('context').textContent='Проверьте, что файл cards.js находится рядом с index.html.';$('skip').hidden=true;return;}
  if (!rotations.has(id)) rotations.set(id, createRotation(pool));
  rotation = rotations.get(id);
  chooseNext();
 }
 sections.forEach(([id,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.section=id;b.setAttribute('aria-label',/^\d+$/.test(id)?`Задание ${id}`:label);b.addEventListener('click',()=>select(id));$('sections').append(b);});
 $('check-answer').addEventListener('click', () => { if (current?.kind === 'punctuation') answer(); });
 $('skip').addEventListener('click',chooseNext);
 document.addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey||e.repeat||locked)return;if (e.key === 'Enter' && current?.kind === 'punctuation' && e.target?.tagName !== 'BUTTON') { e.preventDefault(); answer(); return; }const n=Number(e.key);if(n>=1&&n<=9){const b=choices()[n-1];if(b){e.preventDefault();b.click();}}});
 select('all');
})();
