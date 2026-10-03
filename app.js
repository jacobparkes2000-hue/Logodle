(() => {
  const days = [...window.LOGODLE_DAYS].sort((a,b) => a.date.localeCompare(b.date));
  const $ = id => document.getElementById(id);
  const key = date => `logodle:result:${date}`;
  let activeDay, roundIndex = 0, answers = [], selected = false, advanceTimer = null;
  const today = () => new Date().toLocaleDateString('en-CA');
  const getDay = () => {
    const requested = new URLSearchParams(location.search).get('day');
    if (requested && days.some(d => d.date === requested)) return days.find(d => d.date === requested);
    return [...days].reverse().find(d => d.date <= today()) || days[0];
  };
  const formatDate = date => new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(`${date}T12:00:00`));
  const saved = date => { try { return JSON.parse(localStorage.getItem(key(date))); } catch { return null; } };
  const escape = value => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const logoFallback = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="220" viewBox="0 0 500 220"><rect width="500" height="220" rx="30" fill="#ffffff"/><circle cx="250" cy="110" r="56" fill="#f0f2f7"/><path d="M225 110h50M250 85v50" stroke="#aab1c2" stroke-width="12" stroke-linecap="round"/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };
  function setUrl(date, replace = false) { const url = new URL(location); url.searchParams.set('day',date); history[replace ? 'replaceState' : 'pushState']({},'',url); }
  function loadDay(day, fresh = false) {
    clearTimeout(advanceTimer); advanceTimer = null;
    activeDay = day; roundIndex = 0; selected = false;
    const prior = saved(day.date);
    answers = prior?.answers?.length === day.rounds.length ? prior.answers : [];
    if (prior?.completed && !fresh) { showRound(); showResults(); return; }
    showRound();
  }
  function showRound() {
    if (roundIndex >= activeDay.rounds.length) return finish();
    selected = false;
    const round = activeDay.rounds[roundIndex];
    $('day-title').textContent = `${activeDay.label} · ${formatDate(activeDay.date)}`;
    $('round-label').textContent = `Round ${roundIndex + 1} of ${activeDay.rounds.length}`;
    $('progress-bar').style.width = `${(roundIndex / activeDay.rounds.length) * 100}%`;
    $('logo-image').src = round.logo; $('logo-image').alt = 'Mystery logo';
    $('logo-image').onerror = () => { $('logo-image').onerror = null; $('logo-image').src = logoFallback(); };
    $('feedback').textContent = ''; $('feedback').className = 'feedback';
    $('next-round').disabled = true; $('next-round').textContent = 'Choose an answer';
    const options = [...round.options].sort(() => Math.random() - .5);
    $('options').replaceChildren(...options.map(choice => {
      const button = document.createElement('button'); button.className = 'option'; button.textContent = choice;
      button.addEventListener('click', () => choose(choice, button)); return button;
    }));
  }
  function choose(choice, button) {
    if (selected) return; selected = true;
    const round = activeDay.rounds[roundIndex], correct = choice === round.answer;
    answers[roundIndex] = { choice, correct };
    document.querySelectorAll('.option').forEach(el => { el.disabled = true; if (el.textContent === round.answer) el.classList.add('correct'); });
    button.classList.add(correct ? 'rumble-correct' : 'rumble-incorrect');
    if (!correct) button.classList.add('incorrect');
    $('feedback').textContent = correct ? 'Correct — great eye!' : `Not quite — this is ${round.answer}.`;
    $('feedback').classList.add(correct ? 'good' : 'bad');
    $('next-round').disabled = false;
    $('next-round').textContent = roundIndex === activeDay.rounds.length - 1 ? 'Show results now' : 'Next round';
    advanceTimer = setTimeout(() => { advanceTimer = null; roundIndex++; showRound(); }, 2000);
  }
  function giveUp() { if (selected) return; const round = activeDay.rounds[roundIndex]; choose('__gave_up__', document.createElement('button')); answers[roundIndex] = { choice:'Gave up', correct:false }; }
  function nextRound() { if (!selected) return; clearTimeout(advanceTimer); advanceTimer = null; roundIndex++; showRound(); }
  function finish() { $('progress-bar').style.width = '100%'; const result = { completed:true, answers, score:answers.filter(a => a.correct).length, completedAt:new Date().toISOString() }; localStorage.setItem(key(activeDay.date),JSON.stringify(result)); showResults(); }
  function showResults() {
    const result = saved(activeDay.date) || {answers,score:answers.filter(a=>a.correct).length};
    const score = result.score, tone = score >= 4 ? 'green' : score >= 2 ? 'yellow' : 'red';
    $('score-display').textContent = `${score}/${activeDay.rounds.length}`; $('score-display').className = `score ${tone}`;
    $('score-message').textContent = score === 5 ? 'A perfect Logodle. Exceptional!' : score >= 4 ? 'Almost flawless.' : score >= 2 ? 'A solid round — try another day.' : 'Every logo is a new chance to learn.';
    $('answer-recap').innerHTML = activeDay.rounds.map((r,i) => `<div><span>${i+1}. ${escape(r.answer)}</span><b class="${result.answers[i]?.correct ? '' : 'miss'}">${result.answers[i]?.correct ? 'Correct' : 'Missed'}</b></div>`).join('');
    if (!$('results-modal').open) $('results-modal').showModal(); if (score === 5) confetti();
  }
  function renderArchive() {
    $('archive-grid').innerHTML = days.map(day => { const result=saved(day.date); return `<article class="archive-card"><p>${formatDate(day.date)}</p><h2>${escape(day.label)}</h2><p>${result?.completed ? `Completed · ${result.score}/5` : 'Not played yet'}</p><button class="button ${day.date === activeDay.date ? 'secondary' : 'primary'}" data-day="${day.date}">${day.date === activeDay.date ? 'Current day' : 'Play day'}</button></article>`; }).join('');
    document.querySelectorAll('[data-day]').forEach(button => button.addEventListener('click',() => { const day=days.find(d=>d.date===button.dataset.day); setUrl(day.date); $('archive-view').classList.add('hidden'); $('game-view').classList.remove('hidden'); loadDay(day); }));
  }
  function openArchive() { $('results-modal').close(); renderArchive(); $('game-view').classList.add('hidden'); $('archive-view').classList.remove('hidden'); }
  function showStats() { const results=days.map(d=>saved(d.date)).filter(r=>r?.completed); const total=results.length, totalScore=results.reduce((n,r)=>n+r.score,0), perfect=results.filter(r=>r.score===5).length; $('stats-content').innerHTML=`<div><strong>${total}</strong><span>Played</span></div><div><strong>${total ? Math.round(totalScore/(total*5)*100) : 0}%</strong><span>Average</span></div><div><strong>${perfect}</strong><span>Perfect</span></div>`; $('stats-modal').showModal(); }
  function confetti() { const canvas=$('confetti'),ctx=canvas.getContext('2d'); canvas.width=innerWidth;canvas.height=innerHeight; const bits=Array.from({length:170},()=>({x:Math.random()*canvas.width,y:-20-Math.random()*canvas.height*.3,vx:(Math.random()-.5)*5,vy:2+Math.random()*5,s:5+Math.random()*6,c:['#293b78','#e5525a','#f5c84c','#41aa79'][Math.floor(Math.random()*4)]})); let frame=0; (function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);bits.forEach(b=>{b.x+=b.vx;b.y+=b.vy;b.vy+=.06;ctx.fillStyle=b.c;ctx.fillRect(b.x,b.y,b.s,b.s*.55)});if(frame++<160)requestAnimationFrame(draw);else ctx.clearRect(0,0,canvas.width,canvas.height)})(); }
  $('next-round').addEventListener('click',nextRound); $('give-up').addEventListener('click',giveUp); $('archive-button').addEventListener('click',openArchive); $('close-archive').addEventListener('click',()=>{$('archive-view').classList.add('hidden');$('game-view').classList.remove('hidden')}); $('results-archive').addEventListener('click',openArchive); $('close-results').addEventListener('click',()=>$('results-modal').close()); $('stats-button').addEventListener('click',showStats); $('close-stats').addEventListener('click',()=>$('stats-modal').close());
  $('random-day').addEventListener('click',()=>{const choices=days.filter(d=>d.date!==activeDay.date);const day=choices[Math.floor(Math.random()*choices.length)]||days[0];$('results-modal').close();setUrl(day.date);loadDay(day,true)});
  $('previous-day').addEventListener('click',()=>{const i=days.indexOf(activeDay);if(i>0){setUrl(days[i-1].date);loadDay(days[i-1])}}); $('next-day').addEventListener('click',()=>{const i=days.indexOf(activeDay);if(i<days.length-1){setUrl(days[i+1].date);loadDay(days[i+1])}});
  addEventListener('popstate',()=>loadDay(getDay())); addEventListener('resize',()=>{const c=$('confetti');c.width=innerWidth;c.height=innerHeight});
  const initial=getDay(); setUrl(initial.date,true); loadDay(initial);
})();
