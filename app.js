(() => {
  const $ = id => document.getElementById(id);
  let catalogue = [], active, round = 0, answers = [], answered = false, timer = null, prefetchedImage = null;
  const resultKey = date => `logodle:${date}`;
  const today = () => new Date().toLocaleDateString('en-CA');
  const dateText = date => new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(`${date}T12:00:00`));
  const loadSaved = date => { try{return JSON.parse(localStorage.getItem(resultKey(date)))}catch{return null} };
  const save = value => localStorage.setItem(resultKey(active.date),JSON.stringify(value));
  const saveProgress = () => {
    const safeAnswers = Array.from({ length: active.rounds.length }, (_, index) => {
      const entry = answers[index];
      return entry ? { guess: entry.guess, answer: entry.answer, correct: !!entry.correct } : null;
    });
    save({ score: safeAnswers.filter(Boolean).filter(x => x.correct).length, completed: false, answers: safeAnswers });
  };
  const route = () => new URLSearchParams(location.search).get('day');
  const setRoute = date => { const url = new URL(location);url.searchParams.set('day',date);history.pushState({},'',url); };
  const entryFor = () => catalogue.find(x=>x.date===route()) || [...catalogue].reverse().find(x=>x.date<=today()) || catalogue[0];
  const assetUrl = src => new URL(src, new URL(active.path, location.href)).href;
  function preloadNextRoundImage() {
    const connection = navigator.connection;
    if (round + 1 >= active.rounds.length || connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return;
    const src = assetUrl(active.rounds[round + 1].image);
    if (prefetchedImage?.src === src) return;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.src = src;
    prefetchedImage = image;
  }
  const isCompletedDay = () => !!loadSaved(active?.date)?.completed;
  function renderRoundControls() {
    const completed = isCompletedDay();
    const firstRound = round === 0;
    const lastRound = round === active.rounds.length - 1;
    const position = catalogue.findIndex(item => item.date === active.date);
    const hasNextDay = position < catalogue.length - 1;

    $('give-up').textContent = 'Back';
    $('give-up').hidden = firstRound;
    $('give-up').disabled = firstRound;

    if (!completed) {
      $('continue').hidden = false;
      const record = answers[round] || (loadSaved(active.date)?.answers || [])[round];
      $('continue').textContent = record
        ? round === active.rounds.length - 1 ? 'Show results' : 'Next'
        : 'Choose an answer';
      $('continue').disabled = !record;
      return;
    }

    if (lastRound && !hasNextDay) {
      $('continue').hidden = true;
      return;
    }

    $('continue').hidden = false;
    if (lastRound && hasNextDay) {
      $('continue').textContent = 'Next day';
      $('continue').disabled = false;
      return;
    }
    $('continue').textContent = 'Next';
    $('continue').disabled = false;
  }
  async function loadDay(entry) {
    clearTimeout(timer); timer = null;
    const response = await fetch(entry.path); if (!response.ok) throw new Error(`Could not load ${entry.path}`);
    active = await response.json(); active.path = entry.path; round = 0; answers = Array.from({ length: active.rounds.length }, () => null); const saved = loadSaved(active.date);
    if (saved?.answers) {
      answers = Array.from({ length: active.rounds.length }, (_, index) => {
        const record = (saved.answers || [])[index];
        return record ? { guess: record.guess ?? 'No answer', answer: record.answer ?? 'No answer', correct: !!record.correct } : null;
      });
    }
    $('day-title').textContent = `${active.title} · ${dateText(active.date)}`;
    const position = catalogue.findIndex(item => item.date === active.date);
    $('previous').disabled = position <= 0;
    $('next').disabled = position < 0 || position >= catalogue.length - 1;
    $('game').hidden = false; $('archive').hidden = true; showRound();
  }
  function showRound() {
    if (round === active.rounds.length) return finish();
    const completed = isCompletedDay();
    const item = active.rounds[round];
    const saved = loadSaved(active.date);
    const record = (answers[round] || (saved?.answers || [])[round] || null);
    answered = !!record || completed;
    $('round-label').textContent = `Round ${round + 1} of ${active.rounds.length}`;
    $('progress-fill').style.width = `${round / active.rounds.length * 100}%`;
    const logo = $('logo');
    logo.decoding = 'async';
    logo.fetchPriority = 'high';
    logo.addEventListener('load', preloadNextRoundImage, { once: true });
    logo.src = assetUrl(item.image); logo.alt = 'Mystery logo';
    $('feedback').textContent = ''; $('feedback').className = 'feedback';
    renderRoundControls();
    const shuffled = [...item.options].sort(()=>Math.random()-.5);
    $('choices').replaceChildren(...shuffled.map(option => {
      const button = document.createElement('button');
      button.textContent = option;
      if (record || completed) {
        button.disabled = true;
        if (option === item.answer) button.classList.add('correct');
        if (option === record?.guess) {
          button.classList.add(record.correct ? 'correct' : 'incorrect');
          if (!record.correct) button.classList.add('incorrect');
        }
      } else {
        button.addEventListener('click',()=>answer(option,button));
      }
      return button;
    }));
    if (record || completed) {
      const guess = record?.guess ?? 'No answer';
      $('feedback').textContent = record?.correct ? `Correct — you guessed ${guess}.` : `You guessed ${guess}; the correct answer was ${item.answer}.`;
      $('feedback').classList.add(record?.correct ? 'good' : 'bad');
    }
  }
  function answer(choice, button) {
    if (answered) return; answered = true; const item=active.rounds[round], correct=choice===item.answer;
    answers[round] = {guess: choice, answer:item.answer, correct};
    saveProgress();
    document.querySelectorAll('#choices button').forEach(el=>{el.disabled=true;if(el.textContent===item.answer)el.classList.add('correct')});
    button.classList.add(correct?'rumble-correct':'rumble-incorrect'); if(!correct) button.classList.add('incorrect');
    $('feedback').textContent=correct?'Correct — great eye!':`Not quite — this is ${item.answer}.`;$('feedback').classList.add(correct?'good':'bad');
    $('continue').disabled=false;$('continue').textContent=round===active.rounds.length-1?'Show results':'Next round';
    timer=setTimeout(()=>{timer=null;round++;showRound()},2000);
  }
  function continueRound(){
    if (isCompletedDay()) {
      const position = catalogue.findIndex(item => item.date === active.date);
      if (round === active.rounds.length - 1) {
        if (position < catalogue.length - 1) {
          const nextDay = catalogue[position + 1];
          setRoute(nextDay.date);
          loadDay(nextDay);
        }
        return;
      }
      clearTimeout(timer); timer = null; round++; showRound();
      return;
    }
    if(!answered)return;clearTimeout(timer);timer=null;round++;showRound()
  }
  function giveUp(){
    if (round === 0) return;
    clearTimeout(timer); timer = null; round--; showRound();
  }
  function finish(){ $('progress-fill').style.width='100%';const safeAnswers = Array.from({ length: active.rounds.length }, (_, index) => { const entry = answers[index]; return entry ? { guess: entry.guess, answer: entry.answer, correct: !!entry.correct } : null; }); const score=safeAnswers.filter(Boolean).filter(x=>x.correct).length;save({score,completed:true,answers:safeAnswers});$('score').textContent=`${score}/${active.rounds.length}`;$('score').style.color=score>=8?'#259657':score>=4?'#b98511':'#c13d47';$('message').textContent=score===10?'Perfect Logodle!':score>=7?'Strong result.':score>=4?'A solid round.':'Tomorrow is another puzzle.';$('results').showModal();if(score===10)confetti(); }
  function openArchive(){clearTimeout(timer);$('results').close();$('game').hidden=true;$('archive').hidden=false;$('archive-list').replaceChildren(...catalogue.map(entry=>{const r=loadSaved(entry.date);const card=document.createElement('article');card.innerHTML=`<div><h2>${dateText(entry.date)}</h2><p>${r?.completed?`Completed · ${r.score}/10`:'Ready to play'}</p></div>`;const button=document.createElement('button');button.textContent=r?.completed?'Review':'Play';button.addEventListener('click',()=>{setRoute(entry.date);loadDay(entry)});card.append(button);return card;}));}
  function confetti(){const c=$('confetti'),x=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;const bits=Array.from({length:120},()=>({x:Math.random()*c.width,y:-30,vx:(Math.random()-.5)*5,vy:2+Math.random()*4,s:5+Math.random()*5,c:['#293b78','#40a86d','#f1bb32','#db5960'][Math.floor(Math.random()*4)]}));let n=0;(function draw(){x.clearRect(0,0,c.width,c.height);bits.forEach(b=>{b.x+=b.vx;b.y+=b.vy;b.vy+=.06;x.fillStyle=b.c;x.fillRect(b.x,b.y,b.s,b.s)});if(n++<150)requestAnimationFrame(draw);else x.clearRect(0,0,c.width,c.height)})()}
  $('continue').addEventListener('click',continueRound);$('give-up').addEventListener('click',giveUp);$('archive-toggle').addEventListener('click',openArchive);$('open-archive').addEventListener('click',openArchive);$('back').addEventListener('click',()=>{$('archive').hidden=true;$('game').hidden=false});$('close-results').addEventListener('click',()=>$('results').close());
  $('previous').addEventListener('click',()=>{const i=catalogue.findIndex(x=>x.date===active.date);if(i>0){setRoute(catalogue[i-1].date);loadDay(catalogue[i-1])}});$('next').addEventListener('click',()=>{const i=catalogue.findIndex(x=>x.date===active.date);if(i<catalogue.length-1){setRoute(catalogue[i+1].date);loadDay(catalogue[i+1])}});addEventListener('popstate',()=>loadDay(entryFor()));
  fetch('days/index.json').then(r=>r.json()).then(days=>{catalogue=days.sort((a,b)=>a.date.localeCompare(b.date));return loadDay(entryFor())}).catch(()=>{$('day-title').textContent='Unable to load today’s quiz';});
})();
