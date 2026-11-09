'use strict';
(() => {
 const number = document.getElementById('rail-number');
 const topic = document.getElementById('rail-topic');
 const label = document.getElementById('task-label');
 if (!number || !topic || !label) return;
 const topics = {1:'Части речи',4:'Поставь ударение',9:'Гласные в корне',10:'Приставки',11:'Суффиксы',12:'Спряжение и причастия',13:'НЕ и НИ',14:'Слитно, раздельно, через дефис',15:'Н и НН',16:'Однородные члены',17:'Обособление',18:'Вводные конструкции',19:'Сложные предложения',20:'Стык союзов',21:'Знаки препинания'};
 const update = () => {const task = label.textContent.match(/\d+/)?.[0]; number.textContent = task ? task.padStart(2,'0') : 'Ѣ'; topic.textContent = topics[task] || 'Русский язык на практике';};
 new MutationObserver(update).observe(label,{childList:true,characterData:true,subtree:true});
 update();
})();
