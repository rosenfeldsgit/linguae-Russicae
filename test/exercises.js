'use strict';
(() => {
  const managed = window.EGE_MANAGED || {exams:[],disabled:[]};
  const overrides = new Map(managed.exams.map(q=>[q.id,q]));
  const existing = [...(window.EGE_EXAM_BANK || []), ...(window.EGE_EXAM_MANIFEST || [])];
  const bank = [...existing.filter(q=>!managed.disabled.includes(q.id)).map(q=>overrides.get(q.id)||q),...managed.exams.filter(q=>!existing.some(old=>old.id===q.id))];
  const normalize = value => value.toLowerCase().replace(/ё/g, 'е').replace(/[\s,;]/g, '');
  function score(question, value) {
    const answer = normalize(value);
    if (!answer) return 0;
    if (question.answerType === 'matching') {
      if (!/^[1-9]{1,5}$/.test(answer)) return 0;
      const errors = [...question.answers[0]].filter((digit, i) => digit !== answer[i]).length;
      return errors === 0 ? 2 : errors <= 2 ? 1 : 0;
    }
    if (question.answerType === 'set') {
      if (!/^\d+$/.test(answer) || new Set(answer).size !== answer.length) return 0;
      return question.answers.some(expected => [...answer].sort().join('') === [...expected].sort().join('')) ? question.maxPrimary : 0;
    }
    return question.answers.some(expected => normalize(expected) === answer) ? question.maxPrimary : 0;
  }
  function formattedText(node, text) {
    node.replaceChildren();
    text.split('**').forEach((part, index) => {
      const element = index % 2 ? document.createElement('strong') : document.createTextNode(part);
      if (index % 2) element.textContent = part;
      node.append(element);
    });
  }
  let passageId = 0;
  function renderPassage(node, question, collapsed = false, onToggle = () => {}) {
    node.replaceChildren();
    node.hidden = !question.passage;
    if (!question.passage) return;
    const text = document.createElement('div');
    text.className = 'passage';
    text.id = `exam-passage-${++passageId}`;
    formattedText(text, question.passage);
    const collapsible = Number(question.task) === 1 || (Number(question.task) >= 23 && Number(question.task) <= 27);
    if (collapsible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'passage-toggle quiet';
      button.setAttribute('aria-controls', text.id);
      const update = () => {
        text.hidden = collapsed;
        button.setAttribute('aria-expanded', String(!collapsed));
        button.textContent = collapsed ? 'Показать текст ↓' : 'Свернуть текст ↑';
      };
      button.addEventListener('click', () => {
        collapsed = !collapsed;
        update();
        onToggle(collapsed);
      });
      update();
      node.append(button);
    }
    node.append(text);
  }
  function renderQuestion(node,question) {
    const match=question.answerType==='matching' && question.prompt.match(/^([\s\S]+?)\n\n(Грамматические ошибки|Предложения)\n([\s\S]+?)\n\n(Предложения|Средства выразительности)\n([\s\S]+)$/);
    if (!match) {formattedText(node,question.prompt);return;}
    node.replaceChildren();
    const intro=document.createElement('p');intro.textContent=match[1];node.append(intro);
    const columns=document.createElement('div');columns.className='matching-columns';
    for (const [title,text] of [[match[2],match[3]],[match[4],match[5]]]) {
      const column=document.createElement('section');
      const heading=document.createElement('h3');heading.textContent=title;
      const body=document.createElement('div');formattedText(body,text);
      column.append(heading,body);columns.append(column);
    }
    node.append(columns);
  }
  window.EGE_EXERCISES = {bank, score, renderPassage, renderQuestion};
})();
