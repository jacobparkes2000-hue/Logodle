import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const resultKey = date => `logodle:${date}`;
const today = () => new Date().toLocaleDateString('en-CA');
const dateText = date => new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric'
}).format(new Date(`${date}T12:00:00`));

function loadSaved(date) {
  try {
    return JSON.parse(localStorage.getItem(resultKey(date)));
  } catch {
    return null;
  }
}

function savedAnswers(date, length) {
  const saved = loadSaved(date);
  return Array.from({ length }, (_, index) => {
    const record = saved?.answers?.[index];
    return record ? {
      guess: record.guess ?? 'No answer',
      answer: record.answer ?? 'No answer',
      correct: !!record.correct
    } : null;
  });
}

function assetUrl(entry, src) {
  if (!src) return '';
  if (/^(?:[a-z]+:)?\/\//i.test(src)) return src;
  const directory = entry.path.replace(/\/[^/]+$/, '/');
  return new URL(`${directory}${src}`, window.location.href).href;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function App() {
  const [catalogue, setCatalogue] = useState([]);
  const [active, setActive] = useState(null);
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [loadingError, setLoadingError] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveFromResults, setArchiveFromResults] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [result, setResult] = useState(null);
  const answerTimer = useRef(null);
  const loadRequest = useRef(0);
  const choicesRef = useRef(null);
  const dialogRef = useRef(null);
  const confettiRef = useRef(null);

  const loadDay = useCallback(async entry => {
    if (!entry) return;
    const requestId = ++loadRequest.current;
    clearTimeout(answerTimer.current);
    answerTimer.current = null;
    setLoadingError('');
    try {
      const response = await fetch(entry.path);
      if (!response.ok) throw new Error(`Could not load ${entry.path}`);
      const day = await response.json();
      if (!Array.isArray(day.rounds) || !day.rounds.length) {
        throw new Error(`No quiz rounds found in ${entry.path}`);
      }
      if (requestId !== loadRequest.current) return;
      setActive({ ...day, path: entry.path });
      setRound(0);
      setAnswers(savedAnswers(day.date, day.rounds.length));
      setFeedback(null);
      setResult(null);
      setResultsOpen(false);
      setArchiveOpen(false);
    } catch (error) {
      if (requestId === loadRequest.current) {
        setLoadingError(error instanceof Error ? error.message : 'Unable to load this quiz day.');
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('days/index.json')
      .then(response => {
        if (!response.ok) throw new Error('Could not load days/index.json');
        return response.json();
      })
      .then(days => {
        const sortedDays = days.sort((a, b) => a.date.localeCompare(b.date));
        if (!sortedDays.length) throw new Error('No quiz days are available.');
        if (cancelled) return;
        setCatalogue(sortedDays);
        const requestedDay = new URLSearchParams(window.location.search).get('day');
        const entry = sortedDays.find(day => day.date === requestedDay)
          || [...sortedDays].reverse().find(day => day.date <= today())
          || sortedDays[0];
        return loadDay(entry);
      })
      .catch(error => {
        if (!cancelled) {
          setLoadingError(error instanceof Error ? error.message : 'Unable to load quiz days.');
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(answerTimer.current);
    };
  }, [loadDay]);

  useEffect(() => {
    function handlePopState() {
      const requestedDate = new URLSearchParams(window.location.search).get('day');
      const entry = catalogue.find(day => day.date === requestedDate);
      if (entry) loadDay(entry);
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [catalogue, loadDay]);

  useEffect(() => {
    if (!resultsOpen || !dialogRef.current) return undefined;
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [resultsOpen]);

  useEffect(() => {
    if (!resultsOpen || !confettiRef.current) return undefined;
    const canvas = confettiRef.current;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -30,
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 2 + 2,
      life: 1
    }));
    const colours = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
    let animationFrame;
    function animate() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(piece => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.life -= 0.01;
        context.globalAlpha = piece.life;
        context.fillStyle = colours[Math.floor(Math.random() * colours.length)];
        context.fillRect(piece.x, piece.y, 5, 5);
      });
      if (pieces.some(piece => piece.life > 0)) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        context.globalAlpha = 1;
      }
    }
    animate();
    return () => cancelAnimationFrame(animationFrame);
  }, [resultsOpen]);

  const isCompleted = !!loadSaved(active?.date)?.completed;
  const currentRound = active?.rounds[round];
  const record = answers[round] || null;
  const roundAnswered = !!record || isCompleted;
  const options = useMemo(
    () => currentRound ? shuffle(currentRound.options) : [],
    [active, round]
  );

  useEffect(() => {
    if (!active || !currentRound) return undefined;
    const connection = navigator.connection;
    if (round + 1 >= active.rounds.length
      || connection?.saveData
      || ['slow-2g', '2g'].includes(connection?.effectiveType)) return undefined;
    const nextImage = new Image();
    nextImage.decoding = 'async';
    nextImage.fetchPriority = 'low';
    nextImage.src = assetUrl(active, active.rounds[round + 1].image);
    return () => {
      nextImage.onload = null;
    };
  }, [active, currentRound, round]);

  const updateRoute = date => {
    const url = new URL(window.location.href);
    url.searchParams.set('day', date);
    window.history.pushState({}, '', url);
  };

  const navigateDay = offset => {
    const position = catalogue.findIndex(item => item.date === active?.date);
    const target = catalogue[position + offset];
    if (!target) return;
    clearTimeout(answerTimer.current);
    updateRoute(target.date);
    loadDay(target);
  };

  const completeDay = useCallback((finalAnswers = answers) => {
    if (!active) return;
    clearTimeout(answerTimer.current);
    answerTimer.current = null;
    const score = finalAnswers.filter(answer => answer?.correct).length;
    const completedResult = {
      score,
      completed: true,
      answers: Array.from({ length: active.rounds.length }, (_, index) => {
        const answer = finalAnswers[index];
        return answer ? {
          guess: answer.guess,
          answer: answer.answer,
          correct: !!answer.correct
        } : null;
      })
    };
    localStorage.setItem(resultKey(active.date), JSON.stringify(completedResult));
    setResult({
      score,
      message: score === active.rounds.length
        ? 'Perfect score!'
        : `You got ${score}/${active.rounds.length} correct!`
    });
    setResultsOpen(true);
  }, [active, answers]);

  const advanceRound = () => {
    if (!active) return;
    clearTimeout(answerTimer.current);
    answerTimer.current = null;
    if (isCompleted && round === active.rounds.length - 1) {
      const position = catalogue.findIndex(item => item.date === active.date);
      const nextDay = catalogue[position + 1];
      if (nextDay) {
        updateRoute(nextDay.date);
        loadDay(nextDay);
      }
      return;
    }
    if (!isCompleted && !record) return;
    if (!isCompleted && round === active.rounds.length - 1) {
      completeDay();
      return;
    }
    setRound(current => current + 1);
    setFeedback(null);
  };

  const chooseAnswer = choice => {
    if (!active || !currentRound || roundAnswered) return;
    const answer = {
      guess: choice,
      answer: currentRound.answer,
      correct: choice === currentRound.answer
    };
    const updatedAnswers = [...answers];
    updatedAnswers[round] = answer;
    setAnswers(updatedAnswers);
    localStorage.setItem(resultKey(active.date), JSON.stringify({
      score: updatedAnswers.filter(item => item?.correct).length,
      completed: false,
      answers: updatedAnswers
    }));
    setFeedback({
      text: answer.correct ? 'Correct — great eye!' : `Not quite — this is ${currentRound.answer}.`,
      className: answer.correct ? 'good' : 'bad'
    });
    answerTimer.current = window.setTimeout(() => {
      answerTimer.current = null;
      if (round === active.rounds.length - 1) completeDay(updatedAnswers);
      else {
        setRound(current => current + 1);
        setFeedback(null);
      }
    }, 2000);
  };

  const handleChoiceKeyDown = event => {
    const direction = {
      ArrowUp: [0, -1],
      ArrowRight: [1, 0],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0]
    }[event.key];
    const current = event.target;
    if (!direction || !(current instanceof HTMLButtonElement) || current.disabled) return;

    const [dx, dy] = direction;
    const currentBounds = current.getBoundingClientRect();
    const currentX = currentBounds.left + currentBounds.width / 2;
    const currentY = currentBounds.top + currentBounds.height / 2;
    const candidates = [...choicesRef.current.querySelectorAll('button:not(:disabled)')]
      .filter(button => button !== current)
      .map(button => {
        const bounds = button.getBoundingClientRect();
        const offsetX = bounds.left + bounds.width / 2 - currentX;
        const offsetY = bounds.top + bounds.height / 2 - currentY;
        const primary = offsetX * dx + offsetY * dy;
        const cross = Math.abs(offsetX * dy - offsetY * dx);
        return { button, primary, score: Math.abs(primary) + cross * 2 };
      });
    if (!candidates.length) return;

    const forward = candidates.filter(candidate => candidate.primary > 0);
    const pool = forward.length ? forward : candidates;
    pool.sort((a, b) => a.score - b.score);
    event.preventDefault();
    pool[0].button.focus();
  };

  const openArchive = () => {
    clearTimeout(answerTimer.current);
    setArchiveFromResults(resultsOpen);
    setResultsOpen(false);
    setArchiveOpen(true);
  };

  const closeArchive = () => {
    setArchiveOpen(false);
    if (archiveFromResults) setResultsOpen(true);
    setArchiveFromResults(false);
  };

  const chooseArchiveDay = entry => {
    setArchiveFromResults(false);
    updateRoute(entry.date);
    loadDay(entry);
  };

  const lastRound = !!active && round === active.rounds.length - 1;
  const activePosition = catalogue.findIndex(item => item.date === active?.date);
  const hasNextDay = activePosition >= 0 && activePosition < catalogue.length - 1;
  const continueHidden = isCompleted && lastRound && !hasNextDay;
  const continueLabel = isCompleted
    ? lastRound ? 'Next day' : 'Next'
    : record ? lastRound ? 'Show results' : 'Next' : 'Choose an answer';

  return (
    <>
      <canvas id="confetti" aria-hidden="true" ref={confettiRef} />
      <header>
        <button id="archive-toggle" aria-label="Open archive" title="Archive" onClick={openArchive}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16v12H4zM3 4h18v4H3zM9 12h6" /></svg>
        </button>
        <a className="brand" href="./">
          <img src="/assets/Minimalist%20Geometric%20Lambda%20Logo.png" alt="" />
          LOGODLE
        </a>
      </header>
      <main>
        <h1 className="visually-hidden">Logodle: the free daily logo quiz</h1>
        {loadingError && <p className="load-error" role="alert">{loadingError}</p>}
        {!loadingError && !active && <p role="status">Loading today&apos;s quiz…</p>}
        <section id="game" hidden={archiveOpen || !active}>
          <nav className="day-nav" aria-label="Quiz day navigation">
            <button aria-label="Previous day" disabled={activePosition <= 0} onClick={() => navigateDay(-1)}>‹</button>
            <div>
              <small>DAILY LOGO QUIZ</small>
              <h2>{active ? `${active.title} · ${dateText(active.date)}` : ''}</h2>
            </div>
            <button aria-label="Next day" disabled={activePosition < 0 || activePosition >= catalogue.length - 1} onClick={() => navigateDay(1)}>›</button>
          </nav>
          {active && round < active.rounds.length && currentRound && (
            <>
              <div className="progress">
                <span id="round-label">Round {round + 1} of {active.rounds.length}</span>
                <i><b id="progress-fill" style={{ width: `${round / active.rounds.length * 100}%` }} /></i>
              </div>
              <section className="logo-stage" aria-label="Mystery logo">
                <img src={assetUrl(active, currentRound.image)} alt="Mystery logo" fetchPriority="high" decoding="async" />
              </section>
              <p className="question">Which logo is this?</p>
              <div
                id="choices"
                className="choices"
                role="group"
                aria-label="Answer choices. Use the arrow keys to move between answers and Enter to select."
                onKeyDown={handleChoiceKeyDown}
                ref={choicesRef}
              >
                {options.map(option => {
                  const correct = roundAnswered && option === currentRound.answer;
                  const incorrect = record && option === record.guess && !record.correct;
                  const animation = feedback && option === record?.guess
                    ? record.correct ? ' rumble-correct' : ' rumble-incorrect'
                    : '';
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={roundAnswered}
                      className={`${correct ? 'correct' : ''}${incorrect ? ' incorrect' : ''}${animation}`}
                      onClick={() => chooseAnswer(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <p id="feedback" className={`feedback${feedback ? ` ${feedback.className}` : record || isCompleted ? ` ${record?.correct ? 'good' : 'bad'}` : ''}`} aria-live="polite">
                {feedback?.text || (roundAnswered
                  ? record?.correct
                    ? `Correct — you guessed ${record.guess}.`
                    : `You guessed ${record?.guess ?? 'No answer'}; the correct answer was ${currentRound.answer}.`
                  : '')}
              </p>
            </>
          )}
          <div className="controls">
            <button className="muted" hidden={round === 0 || !active} disabled={round === 0 || !active} onClick={() => {
              clearTimeout(answerTimer.current);
              answerTimer.current = null;
              setRound(current => Math.max(0, current - 1));
              setFeedback(null);
            }}>Back</button>
            <button disabled={!isCompleted && !record} hidden={continueHidden || !active} onClick={advanceRound}>
              {continueLabel}
            </button>
          </div>
        </section>
        <section id="archive" hidden={!archiveOpen}>
          <div className="archive-head">
            <div><small>PAST &amp; UPCOMING</small><h2>Archive</h2></div>
            <button onClick={closeArchive}>Back</button>
          </div>
          <div id="archive-list">
            {catalogue.map(entry => {
              const saved = loadSaved(entry.date);
              return (
                <article key={entry.date}>
                  <a
                    className="archive-link"
                    href={`?day=${encodeURIComponent(entry.date)}`}
                    onClick={event => {
                      event.preventDefault();
                      chooseArchiveDay(entry);
                    }}
                  >
                    <h3>{entry.date}</h3>
                    <span>{saved ? `${saved.score}/${active?.rounds.length ?? 10}` : 'Not played'}</span>
                  </a>
                </article>
              );
            })}
          </div>
          <section className="about" aria-labelledby="about-title">
            <h3 id="about-title">A free daily logo quiz</h3>
            <p>Think you know the brands behind the logos? Play ten rounds of Logodle and identify each mystery logo from eight choices. Track your score, then browse the archive to replay past challenges.</p>
            <h4>How to play</h4>
            <ol>
              <li>Study the mystery logo.</li>
              <li>Choose the brand you think it belongs to.</li>
              <li>Complete all ten rounds and see your score.</li>
            </ol>
          </section>
        </section>
      </main>
      <dialog id="results" ref={dialogRef} onCancel={event => {
        event.preventDefault();
        setResultsOpen(false);
      }}>
        <button className="close" aria-label="Close" onClick={() => setResultsOpen(false)}>×</button>
        <small>QUIZ COMPLETE</small>
        <h2>Nice work!</h2>
        <strong>{result?.message}</strong>
        <p>Share your results</p>
        <button className="muted full" onClick={openArchive}>Browse archive</button>
      </dialog>
    </>
  );
}

export default App;
