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
  const assetUrl = src => {
    if (!src) return '';
    if (/^(?:[a-z]+:)?\/\//i.test(src)) return src;

    const base = new URL(location.href);
    base.search = '';
    base.hash = '';

    if (active?.path) {
      const directory = active.path.replace(/[^/]+$/, '');
      base.pathname = directory || '/';
    } else {
      base.pathname = base.pathname.replace(/[^/]*$/, '');
    }

    return new URL(src, base).href;
  };
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
  function finish(){ $('progress-fill').style.width='100%';const safeAnswers = Array.from({ length: active.rounds.length }, (_, index) => { const entry = answers[index]; return entry ? { guess: entry.guess, answer: entry.answer, correct: !!entry.correct } : null; }); const score = safeAnswers.filter(Boolean).filter(x => x.correct).length; const total = active.rounds.length; const seal = document.createElement('span'); seal.textContent = `${score}/${total}`; $('score').textContent = seal.textContent; const message = score === total ? 'Perfect round.' : score >= total * .7 ? 'Strong work.' : score >= total * .4 ? 'Nice effort.' : 'A few to go.'; $('message').textContent = message; $('results').showModal(); }
  function openArchive(){clearTimeout(timer);$('results').close();$('game').hidden=true;$('archive').hidden=false;$('archive-list').replaceChildren(...catalogue.map(entry=>{const r=loadSaved(entry.date);const item=document.createElement('button');item.className='archive-item';item.innerHTML=`<strong>${entry.date}</strong><span>${r?.completed ? 'Completed' : 'Open'}</span>`;item.addEventListener('click',()=>{setRoute(entry.date);loadDay(entry)});return item})); }
  function confetti(){const c=$('confetti'),x=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;const bits=Array.from({length:120},()=>({x:Math.random()*c.width,y:-30,vx:(Math.random()-0.5)*5,vy:Math.random()*3+2,life:Math.random()*100+40,color:`hsl(${Math.random()*360},90%,60%)`}));const render=()=>{x.clearRect(0,0,c.width,c.height);bits.forEach(bit=>{bit.x+=bit.vx;bit.y+=bit.vy;bit.vy+=0.05;x.fillStyle=bit.color;x.fillRect(bit.x,bit.y,6,6);});requestAnimationFrame(render)};requestAnimationFrame(render)}
  $('continue').addEventListener('click',continueRound);$('give-up').addEventListener('click',giveUp);$('archive-toggle').addEventListener('click',openArchive);$('open-archive').addEventListener('click',openArchive);$('close-results').addEventListener('click',()=>$('results').close());$('previous').addEventListener('click',()=>{const i=catalogue.findIndex(x=>x.date===active.date);if(i>0){setRoute(catalogue[i-1].date);loadDay(catalogue[i-1])}});$('next').addEventListener('click',()=>{const i=catalogue.findIndex(x=>x.date===active.date);if(i>=0&&i<catalogue.length-1){setRoute(catalogue[i+1].date);loadDay(catalogue[i+1])}});$('back').addEventListener('click',()=>{const current=entryFor();$('archive').hidden=true;$('game').hidden=false;loadDay(current)});
  fetch('days/index.json').then(r=>r.json()).then(days=>{catalogue=days.sort((a,b)=>a.date.localeCompare(b.date));return loadDay(entryFor())}).catch(()=>{$('day-title').textContent='Unable to load daily content.';});
  confetti();
})();
