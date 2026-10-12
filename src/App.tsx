import { useEffect, useMemo, useState } from 'react';
import {
  Lightbulb, Pencil, Eraser, Undo2, RotateCcw, Volume2, VolumeX,
  Pause, Play, Settings2, Trophy, Check, ChevronDown, Sparkles, X
} from 'lucide-react';

type Size = 6 | 9;
type Difficulty = 'Easy' | 'Medium' | 'Hard';
type Cell = { value: number; given: boolean; notes: number[] };
type Snapshot = { board: Cell[][]; selected: [number, number] | null; mistakes: number };

const storageKey = (size: Size) => `sudoku-save-${size}`;
const boxShape = (size: Size): [number, number] => size === 6 ? [2, 3] : [3, 3];
const copyBoard = (board: Cell[][]): Cell[][] =>
  board.map(row => row.map(cell => ({ ...cell, notes: [...cell.notes] })));

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function candidates(board: number[][], row: number, col: number, size: Size): number[] {
  const [boxHeight, boxWidth] = boxShape(size);
  const used = new Set<number>();

  for (let i = 0; i < size; i++) {
    used.add(board[row][i]);
    used.add(board[i][col]);
  }

  const rowStart = Math.floor(row / boxHeight) * boxHeight;
  const colStart = Math.floor(col / boxWidth) * boxWidth;

  for (let r = rowStart; r < rowStart + boxHeight; r++) {
    for (let c = colStart; c < colStart + boxWidth; c++) {
      used.add(board[r][c]);
    }
  }

  const result: number[] = [];
  for (let n = 1; n <= size; n++) {
    if (!used.has(n)) result.push(n);
  }
  return result;
}

function countSolutions(board: number[][], size: Size, limit = 2): number {
  let bestRow = -1;
  let bestCol = -1;
  let bestOptions: number[] | null = null;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r][c] !== 0) continue;
      const options = candidates(board, r, c, size);
      if (options.length === 0) return 0;
      if (bestOptions === null || options.length < bestOptions.length) {
        bestRow = r;
        bestCol = c;
        bestOptions = options;
      }
      if (bestOptions.length === 1) break;
    }
    if (bestOptions?.length === 1) break;
  }

  if (bestOptions === null) return 1;

  let count = 0;
  for (const number of bestOptions) {
    board[bestRow][bestCol] = number;
    count += countSolutions(board, size, limit - count);
    board[bestRow][bestCol] = 0;
    if (count >= limit) return count;
  }
  return count;
}

function createSolvedBoard(size: Size): number[][] {
  const board = Array.from({ length: size }, () => Array<number>(size).fill(0));

  function fill(index = 0): boolean {
    if (index >= size * size) return true;

    const row = Math.floor(index / size);
    const col = index % size;

    for (const number of shuffle(candidates(board, row, col, size))) {
      board[row][col] = number;
      if (fill(index + 1)) return true;
    }

    board[row][col] = 0;
    return false;
  }

  fill();
  return board;
}

function createPuzzle(size: Size, difficulty: Difficulty) {
  const solution = createSolvedBoard(size);
  const puzzle = solution.map(row => [...row]);
  const targetRemovals = size === 6
    ? ({ Easy: 12, Medium: 18, Hard: 23 } as const)[difficulty]
    : ({ Easy: 34, Medium: 43, Hard: 51 } as const)[difficulty];

  let removed = 0;
  const positions = shuffle(
    Array.from({ length: size * size }, (_, index) => [
      Math.floor(index / size), index % size
    ] as [number, number])
  );

  for (const [row, col] of positions) {
    if (removed >= targetRemovals) break;
    const oldValue = puzzle[row][col];
    puzzle[row][col] = 0;

    if (countSolutions(puzzle.map(line => [...line]), size, 2) === 1) {
      removed++;
    } else {
      puzzle[row][col] = oldValue;
    }
  }

  return { puzzle, solution };
}

function toCells(puzzle: number[][]): Cell[][] {
  return puzzle.map(row => row.map(value => ({
    value,
    given: value !== 0,
    notes: []
  })));
}

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function App() {
  const [size, setSize] = useState<Size>(9);
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [board, setBoard] = useState<Cell[][]>(() =>
    toCells(Array.from({ length: 9 }, () => Array<number>(9).fill(0)))
  );
  const [solution, setSolution] = useState<number[][]>(
    Array.from({ length: 9 }, () => Array<number>(9).fill(0))
  );
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [showNewGame, setShowNewGame] = useState(false);

  const numbers = useMemo(() => Array.from({ length: size }, (_, index) => index + 1), [size]);

  const selectedCell = selected ? board[selected[0]]?.[selected[1]] : null;
  const selectedValue = selectedCell?.value ?? 0;

  const wrong = useMemo(() => {
    const conflicts = new Set<string>();

    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const value = board[row][col].value;
        if (!value) continue;

        for (let i = 0; i < size; i++) {
          if (i !== col && board[row][i].value === value) {
            conflicts.add(`${row},${col}`);
            conflicts.add(`${row},${i}`);
          }
          if (i !== row && board[i][col].value === value) {
            conflicts.add(`${row},${col}`);
            conflicts.add(`${i},${col}`);
          }
        }

        const [boxHeight, boxWidth] = boxShape(size);
        const rowStart = Math.floor(row / boxHeight) * boxHeight;
        const colStart = Math.floor(col / boxWidth) * boxWidth;

        for (let r = rowStart; r < rowStart + boxHeight; r++) {
          for (let c = colStart; c < colStart + boxWidth; c++) {
            if ((r !== row || c !== col) && board[r][c].value === value) {
              conflicts.add(`${row},${col}`);
              conflicts.add(`${r},${c}`);
            }
          }
        }
      }
    }

    return conflicts;
  }, [board, size]);

  const complete =
    board.every(row => row.every(cell => cell.value > 0)) &&
    wrong.size === 0 &&
    board.every((row, r) => row.every((cell, c) => cell.value === solution[r]?.[c]));

  function tone(frequency = 520) {
    if (!sound || typeof window === 'undefined') return;
    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.035;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.11);
      oscillator.stop(context.currentTime + 0.12);
      oscillator.onended = () => { void context.close(); };
    } catch {
      // Audio is optional; the game remains playable if unavailable.
    }
  }

  function buzz() {
    if (vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }
  }

  function startNew(nextSize: Size = size, nextDifficulty: Difficulty = difficulty, announce = true) {
    const { puzzle, solution: nextSolution } = createPuzzle(nextSize, nextDifficulty);
    setBoard(toCells(puzzle));
    setSolution(nextSolution);
    setSelected(null);
    setMistakes(0);
    setSeconds(0);
    setPaused(false);
    setShowWin(false);
    setHistory([]);
    setDifficulty(nextDifficulty);
    setSize(nextSize);
    setMessage('');
    if (announce) {
      tone(640);
      setShowNewGame(false);
    }
  }

  function pushHistory() {
    setHistory(previous => [
      ...previous.slice(-39),
      {
        board: copyBoard(board),
        selected: selected ? [...selected] as [number, number] : null,
        mistakes
      }
    ]);
  }

  function enterNumber(number: number) {
    if (!selected || paused || showWin) return;
    const [row, col] = selected;
    if (board[row][col].given) return;

    pushHistory();
    const next = copyBoard(board);
    const cell = next[row][col];

    if (notesMode) {
      cell.notes = cell.notes.includes(number)
        ? cell.notes.filter(value => value !== number)
        : [...cell.notes, number].sort((a, b) => a - b);
    } else {
      cell.value = number;
      cell.notes = [];

      if (number !== solution[row][col]) {
        setMistakes(value => value + 1);
        setMessage('Not quite — try another number');
        tone(180);
      } else {
        setMessage('');
        tone(650);
      }

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (next[r][c].notes.includes(number)) {
            next[r][c].notes = next[r][c].notes.filter(value => value !== number);
          }
        }
      }
    }

    setBoard(next);
    buzz();
  }

  function erase() {
    if (!selected || paused || showWin) return;
    const [row, col] = selected;
    if (board[row][col].given) return;

    pushHistory();
    const next = copyBoard(board);
    next[row][col] = { ...next[row][col], value: 0, notes: [] };
    setBoard(next);
    setMessage('');
    tone(360);
    buzz();
  }

  function undo() {
    if (!history.length) return;
    const previous = history[history.length - 1];
    setBoard(previous.board);
    setSelected(previous.selected);
    setMistakes(previous.mistakes);
    setHistory(items => items.slice(0, -1));
    setMessage('');
    tone(400);
  }

  function hint() {
    if (!selected || paused || showWin) {
      setMessage('Select an empty square first');
      return;
    }
    const [row, col] = selected;
    if (board[row][col].given) return;

    pushHistory();
    const next = copyBoard(board);
    next[row][col] = { value: solution[row][col], given: true, notes: [] };
    setBoard(next);
    setMessage('A helpful hint, just for you');
    tone(720);
    buzz();
  }

  function isPeer(row: number, col: number) {
    if (!selected) return false;
    const [selectedRow, selectedCol] = selected;
    const [boxHeight, boxWidth] = boxShape(size);
    return selectedRow === row ||
      selectedCol === col ||
      (
        Math.floor(selectedRow / boxHeight) === Math.floor(row / boxHeight) &&
        Math.floor(selectedCol / boxWidth) === Math.floor(col / boxWidth)
      );
  }

  useEffect(() => {
    if (paused || showWin) return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [paused, showWin]);

  useEffect(() => {
    if (complete && solution[0]?.[0]) {
      setShowWin(true);
      setPaused(true);
    }
  }, [complete, solution]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(size));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.board && parsed.solution) {
          setBoard(parsed.board);
          setSolution(parsed.solution);
          setDifficulty(parsed.difficulty ?? 'Easy');
          setSeconds(parsed.seconds ?? 0);
          setMistakes(parsed.mistakes ?? 0);
          setSelected(parsed.selected ?? null);
          return;
        }
      }
    } catch {
      // Start a fresh game if stored data is invalid.
    }
    startNew(size, difficulty, false);
    // This effect intentionally runs when the grid size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(size), JSON.stringify({
        board, solution, difficulty, seconds, mistakes, selected
      }));
    } catch {
      // Saving is best-effort; gameplay should continue if storage is unavailable.
    }
  }, [board, solution, difficulty, seconds, mistakes, selected, size]);

  const filledCounts = numbers.map(number =>
    board.flat().filter(cell => cell.value === number).length
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span>9</span><span>6</span><span>3</span><span>1</span></div>
          <div>
            <div className="brand-title">sudoku<span>.</span></div>
            <div className="brand-sub">A little calm, one square at a time</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="icon-btn" aria-label="Sound" onClick={() => setSound(value => !value)}>
            {sound ? <Volume2 size={19} /> : <VolumeX size={19} />}
          </button>
          <button className="icon-btn" aria-label="Settings" onClick={() => setShowSettings(true)}>
            <Settings2 size={19} />
          </button>
        </div>
      </header>

      <section className="game-card">
        <div className="game-heading">
          <div>
            <div className="eyebrow">YOUR DAILY RESET</div>
            <h1>Find your <em>focus.</em></h1>
            <p>A fresh puzzle is waiting for you.</p>
          </div>
          <div className="daily-badge"><Sparkles size={16} /><span>Mindful<br />moments</span></div>
        </div>

        <div className="control-row">
          <div className="segmented size-tabs">
            <button className={size === 6 ? 'active' : ''} onClick={() => startNew(6, difficulty)}>6 × 6</button>
            <button className={size === 9 ? 'active' : ''} onClick={() => startNew(9, difficulty)}>9 × 9</button>
          </div>
          <div className="difficulty-wrap">
            <select value={difficulty} onChange={event => startNew(size, event.target.value as Difficulty)} aria-label="Difficulty">
              <option>Easy</option><option>Medium</option><option>Hard</option>
            </select>
            <ChevronDown size={14} />
          </div>
        </div>

        <div className="stats-row">
          <div className="stat"><span className="stat-label">TIME</span><strong>{formatTime(seconds)}</strong></div>
          <div className="stat"><span className="stat-label">MISTAKES</span><strong className={mistakes > 0 ? 'mistake-num' : ''}>{mistakes}<small> / 3+</small></strong></div>
          <button className="pause-btn" onClick={() => setPaused(value => !value)}>
            {paused ? <Play size={16} /> : <Pause size={16} />} {paused ? 'Resume' : 'Pause'}
          </button>
        </div>

        <div className="board-wrap">
          <div
            className={`sudoku-board size-${size} ${paused ? 'is-paused' : ''}`}
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
          >
            {board.flatMap((row, r) =>
              row.map((cell, c) => {
                const isSelected = selected?.[0] === r && selected?.[1] === c;
                const sameNumber = selectedValue > 0 && cell.value === selectedValue;
                const bad = wrong.has(`${r},${c}`);
                const [boxHeight, boxWidth] = boxShape(size);

                const classes = [
                  'cell',
                  isSelected ? 'selected' : '',
                  isPeer(r, c) ? 'peer' : '',
                  sameNumber ? 'same-number' : '',
                  cell.given ? 'given' : '',
                  bad ? 'bad' : '',
                  r % boxHeight === boxHeight - 1 && r !== size - 1 ? 'box-bottom' : '',
                  c % boxWidth === boxWidth - 1 && c !== size - 1 ? 'box-right' : ''
                ].filter(Boolean).join(' ');

                return (
                  <button
                    key={`${r}-${c}`}
                    className={classes}
                    onClick={() => {
                      if (!paused && !showWin) {
                        setSelected([r, c]);
                        tone(470);
                      }
                    }}
                    aria-label={`Row ${r + 1}, column ${c + 1}${cell.value ? ', ' + cell.value : ''}`}
                  >
                    {cell.value ? (
                      <span>{cell.value}</span>
                    ) : (
                      <span className="notes-grid">
                        {numbers.map(number => (
                          <i key={number}>{cell.notes.includes(number) ? number : ''}</i>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {paused && (
              <div className="pause-overlay">
                <div>
                  <Pause size={26} />
                  <b>Take a breather</b>
                  <button onClick={() => setPaused(false)}>Resume puzzle</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="board-caption">
          <span><i className="legend-dot given-dot" />Starting number</span>
          <span><i className="legend-dot selected-dot" />Selected square</span>
          <button onClick={() => setShowNewGame(true)}><RotateCcw size={14} /> New game</button>
        </div>

        <div className="number-pad" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
          {numbers.map((number, index) => (
            <button
              key={number}
              disabled={filledCounts[index] >= size || paused || showWin}
              className={selectedValue === number ? 'number-active' : ''}
              onClick={() => enterNumber(number)}
            >
              {number}<span className="remaining">{Math.max(0, size - filledCounts[index])}</span>
            </button>
          ))}
        </div>

        <div className="tools-row">
          <button className={`tool ${notesMode ? 'tool-active' : ''}`} onClick={() => setNotesMode(value => !value)}><Pencil size={18} /><span>Pencil</span></button>
          <button className="tool" onClick={erase}><Eraser size={18} /><span>Erase</span></button>
          <button className="tool" onClick={undo} disabled={!history.length}><Undo2 size={18} /><span>Undo</span></button>
          <button className="tool hint-tool" onClick={hint}><Lightbulb size={18} /><span>Hint</span></button>
        </div>

        {notesMode && <div className="mode-tip"><Pencil size={13} /> Pencil mode is on — tap numbers to add or remove notes.</div>}
        {message && (
          <div className="message-line">
            {message}
            <button onClick={() => setMessage('')} aria-label="Dismiss"><X size={14} /></button>
          </div>
        )}
      </section>

      <footer><span>Made for a clearer mind.</span><span>Offline play · No ads</span></footer>

      {showNewGame && (
        <div className="modal-backdrop" onClick={() => setShowNewGame(false)}>
          <div className="modal" onClick={event => event.stopPropagation()}>
            <div className="modal-icon"><RotateCcw /></div>
            <h2>Start a new puzzle?</h2>
            <p>Your current puzzle will be replaced with a fresh one.</p>
            <div className="modal-actions">
              <button className="secondary-btn" onClick={() => setShowNewGame(false)}>Keep playing</button>
              <button className="primary-btn" onClick={() => startNew(size, difficulty)}>New puzzle</button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal settings-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-top">
              <div><div className="eyebrow">MAKE IT YOURS</div><h2>Settings</h2></div>
              <button className="icon-btn" onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>
            <div className="setting-item">
              <div><b>Sound effects</b><small>Soft taps and feedback</small></div>
              <button className={`toggle ${sound ? 'on' : ''}`} onClick={() => setSound(value => !value)}><span /></button>
            </div>
            <div className="setting-item">
              <div><b>Vibration</b><small>Gentle touch feedback</small></div>
              <button className={`toggle ${vibration ? 'on' : ''}`} onClick={() => setVibration(value => !value)}><span /></button>
            </div>
            <div className="setting-item">
              <div><b>Highlight related squares</b><small>Row, column and box</small></div>
              <span className="setting-check"><Check size={15} /></span>
            </div>
            <div className="setting-item">
              <div><b>Autosave</b><small>Your game stays on this phone</small></div>
              <span className="setting-check"><Check size={15} /></span>
            </div>
            <button className="primary-btn full-btn" onClick={() => setShowSettings(false)}>Done</button>
          </div>
        </div>
      )}

      {showWin && (
        <div className="modal-backdrop">
          <div className="modal win-modal">
            <div className="win-icon"><Trophy size={30} /></div>
            <div className="eyebrow">PUZZLE COMPLETE</div>
            <h2>Beautifully done!</h2>
            <p>You gave yourself a moment of focus.</p>
            <div className="win-time"><span>FINISH TIME</span><strong>{formatTime(seconds)}</strong></div>
            <button className="primary-btn full-btn" onClick={() => startNew(size, difficulty)}>Play another puzzle <Sparkles size={16} /></button>
            <button className="text-btn" onClick={() => { setShowWin(false); setPaused(false); }}>Review completed board</button>
          </div>
        </div>
      )}
    </main>
  );
}
