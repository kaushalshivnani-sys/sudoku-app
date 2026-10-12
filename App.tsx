import { useEffect, useMemo, useState } from 'react';
import { Lightbulb, Pencil, Eraser, Undo2, RotateCcw, Volume2, VolumeX, Pause, Play, Settings2, Trophy, Check, ChevronDown, Sparkles, X } from 'lucide-react';

type Size = 6 | 9;
type Difficulty = 'Easy' | 'Medium' | 'Hard';
type Cell = { value: number; given: boolean; notes: number[] };
type Snapshot = { board: Cell[][]; selected: [number, number] | null; mistakes: number };
const keyFor = (size: Size) => `sudoku-save-${size}`;
const boxShape = (size: Size) => size === 6 ? [2, 3] : [3, 3];
const copyBoard = (b: Cell[][]): Cell[][] => b.map(row => row.map(c => ({ ...c, notes: [...c.notes] })));
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - .5);

function candidates(board: number[][], r: number, c: number, size: Size) {
  const [bh, bw] = boxShape(size);
  const used = new Set<number>();
  for (let i = 0; i < size; i++) { used.add(board[r][i]); used.add(board[i][c]); }
  const r0 = Math.floor(r / bh) * bh, c0 = Math.floor(c / bw) * bw;
  for (let y = r0; y < r0 + bh; y++) for (let x = c0; x < c0 + bw; x++) used.add(board[y][x]);
  const out: number[] = [];
  for (let n = 1; n <= size; n++) if (!used.has(n)) out.push(n);
  return out;
}
function solve(board: number[][], size: Size, limit = 2): number {
  let best: [number, number, number[]] | null = null;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (!board[r][c]) {
    const opts = candidates(board, r, c, size);
    if (!opts.length) return 0;
    if (!best || opts.length < best[2].length) best = [r, c, opts];
    if (opts.length === 1) break;
  }
  if (!best) return 1;
  let count = 0;
  for (const n of shuffle(best[2])) {
    board[best[0]][best[1]] = n;
    count += solve(board, size, limit - count);
    board[best[0]][best[1]] = 0;
    if (count >= limit) return count;
  }
  return count;
}
function makeSolved(size: Size) {
  const b = Array.from({length:size}, () => Array(size).fill(0));
  const fill = (idx = 0): boolean => {
    if (idx === size * size) return true;
    const r = Math.floor(idx / size), c = idx % size;
    for (const n of shuffle(candidates(b, r, c, size))) { b[r][c] = n; if (fill(idx + 1)) return true; }
    b[r][c] = 0; return false;
  };
  fill(); return b;
}
function newPuzzle(size: Size, difficulty: Difficulty) {
  const solution = makeSolved(size);
  const puzzle = solution.map(r => [...r]);
  const removals = size === 6 ? ({Easy: 12, Medium: 18, Hard: 23}[difficulty]) : ({Easy: 34, Medium: 43, Hard: 51}[difficulty]);
  let removed = 0;
  for (const [r,c] of shuffle(Array.from({length:size*size}, (_,i) => [Math.floor(i/size), i%size] as [number,number]))) {
    if (removed >= removals) break;
    const old = puzzle[r][c]; puzzle[r][c] = 0;
    const test = puzzle.map(row => [...row]);
    if (solve(test, size, 2) !== 1) puzzle[r][c] = old; else removed++;
  }
  return { puzzle, solution };
}
function initialCells(p: number[][]): Cell[][] { return p.map(row => row.map(value => ({value, given: value !== 0, notes: []}))); }
function formatTime(s: number) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

export default function App() {
  const [size, setSize] = useState<Size>(9);
  const [difficulty, setDifficulty] = useState<Difficulty>('Easy');
  const [board, setBoard] = useState<Cell[][]>(() => initialCells(Array.from({length:9},()=>Array(9).fill(0))));
  const [solution, setSolution] = useState<number[][]>(Array.from({length:9},()=>Array(9).fill(0)));
  const [selected, setSelected] = useState<[number,number] | null>(null);
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
  const [bestTime, setBestTime] = useState<string | null>(null);
  const [showNewGame, setShowNewGame] = useState(false);

  const numbers = useMemo(() => Array.from({length:size}, (_,i)=>i+1), [size]);
  const selectedCell = selected ? board[selected[0]]?.[selected[1]] : null;
  const wrong = useMemo(() => {
    const set = new Set<string>();
    for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
      const v=board[r][c].value; if (!v) continue;
      for(let i=0;i<size;i++) if(i!==c && board[r][i].value===v) {set.add(`${r},${c}`);set.add(`${r},${i}`);}
      for(let i=0;i<size;i++) if(i!==r && board[i][c].value===v) {set.add(`${r},${c}`);set.add(`${i},${c}`);}
      const [bh,bw]=boxShape(size), r0=Math.floor(r/bh)*bh,c0=Math.floor(c/bw)*bw;
      for(let y=r0;y<r0+bh;y++)for(let x=c0;x<c0+bw;x++)if((y!==r||x!==c)&&board[y][x].value===v){set.add(`${r},${c}`);set.add(`${y},${x}`);}
    }
    return set;
  }, [board,size]);
  const complete = board.every(row => row.every(c => c.value > 0)) && wrong.size === 0 && board.every((row,r)=>row.every((c,col)=>c.value===solution[r]?.[col]));
  useEffect(() => { if (!paused && !showWin) { const id = window.setInterval(() => setSeconds(s=>s+1),1000); return ()=>clearInterval(id); } }, [paused,showWin]);
  useEffect(() => {
    if (complete && solution[0]?.[0]) { setShowWin(true); setPaused(true); const t=formatTime(seconds); setBestTime(t); }
  }, [complete]);
  useEffect(() => {
    try { const raw=localStorage.getItem(keyFor(size)); if(raw){ const s=JSON.parse(raw); setBoard(s.board); setSolution(s.solution); setDifficulty(s.difficulty); setSeconds(s.seconds||0); setMistakes(s.mistakes||0); setSelected(s.selected||null); } else startNew(size,difficulty,false); } catch { startNew(size,difficulty,false); }
  }, [size]);
  useEffect(() => { try { localStorage.setItem(keyFor(size), JSON.stringify({board,solution,difficulty,seconds,mistakes,selected})); } catch {} }, [board,solution,difficulty,seconds,mistakes,selected,size]);

  function tone(freq=520) {
    if (!sound) return;
    try { const Ctx = window.AudioContext || (window as any).webkitAudioContext; const ctx=new Ctx(); const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=freq; g.gain.value=.035; o.connect(g);g.connect(ctx.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.11);o.stop(ctx.currentTime+.12);o.onended=()=>ctx.close(); } catch {}
  }
  function buzz() { if(vibration && 'vibrate' in navigator) navigator.vibrate(12); }
  function pushHistory() { setHistory(h=>[...h.slice(-39), {board:copyBoard(board),selected:selected?[...selected] as [number,number]:null,mistakes}]); }
  function startNew(nextSize: Size = size, nextDifficulty: Difficulty = difficulty, announce=true) {
    const {puzzle,solution:sol}=newPuzzle(nextSize,nextDifficulty);
    setBoard(initialCells(puzzle)); setSolution(sol); setSelected(null); setMistakes(0); setSeconds(0); setPaused(false); setShowWin(false); setHistory([]); setDifficulty(nextDifficulty); setSize(nextSize); setMessage('');
    if(announce){tone(640);setShowNewGame(false);}
  }
  function enterNumber(n: number) {
    if (!selected || paused || showWin) return;
    const [r,c]=selected; if(board[r][c].given) return;
    pushHistory(); const next=copyBoard(board); const cell=next[r][c];
    if(notesMode) cell.notes=cell.notes.includes(n)?cell.notes.filter(v=>v!==n):[...cell.notes,n].sort((a,b)=>a-b);
    else {
      cell.value=n; cell.notes=[];
      if(n!==solution[r][c]) { setMistakes(m=>m+1);setMessage('Not quite — try another number');tone(180); }
      else { setMessage('');tone(650); }
      for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(next[y][x].notes.includes(n))next[y][x].notes=next[y][x].notes.filter(v=>v!==n);
    }
    setBoard(next);buzz();
  }
  function erase() {
    if(!selected || paused || showWin) return; const [r,c]=selected; if(board[r][c].given)return;
    pushHistory(); const next=copyBoard(board);next[r][c]={...next[r][c],value:0,notes:[]};setBoard(next);setMessage('');tone(360);buzz();
  }
  function undo() {
    if(!history.length)return; const h=history[history.length-1];setBoard(h.board);setSelected(h.selected);setMistakes(h.mistakes);setHistory(v=>v.slice(0,-1));setMessage('');tone(400);
  }
  function hint() {
    if(!selected || paused || showWin) {setMessage('Select an empty square first');return;}
    const [r,c]=selected;if(board[r][c].given)return;
    pushHistory();const next=copyBoard(board);next[r][c]={value:solution[r][c],given:true,notes:[]};setBoard(next);setMessage('A helpful hint, just for you');tone(720);buzz();
  }
  const peer = (r:number,c:number) => !!selected && (selected[0]===r || selected[1]===c || (Math.floor(selected[0]/boxShape(size)[0])===Math.floor(r/boxShape(size)[0]) && Math.floor(selected[1]/boxShape(size)[1])===Math.floor(c/boxShape(size)[1])));
  const selectedValue = selectedCell?.value || 0;
  const filledCounts = numbers.map(n=>board.flat().filter(c=>c.value===n).length);
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><span>9</span><span>6</span><span>3</span><span>1</span></div><div><div className="brand-title">sudoku<span>.</span></div><div className="brand-sub">A little calm, one square at a time</div></div></div>
      <div className="header-actions">
        <button className="icon-btn" aria-label="Sound" onClick={()=>{setSound(!sound);tone(520)}}>{sound?<Volume2 size={19}/>:<VolumeX size={19}/>}</button>
        <button className="icon-btn" aria-label="Settings" onClick={()=>setShowSettings(true)}><Settings2 size={19}/></button>
      </div>
    </header>
    <section className="game-card">
      <div className="game-heading"><div><div className="eyebrow">YOUR DAILY RESET</div><h1>Find your <em>focus.</em></h1><p>A fresh puzzle is waiting for you.</p></div><div className="daily-badge"><Sparkles size={16}/><span>Mindful<br/>moments</span></div></div>
      <div className="control-row">
        <div className="segmented size-tabs"><button className={size===6?'active':''} onClick={()=>startNew(6,difficulty)}>6 × 6</button><button className={size===9?'active':''} onClick={()=>startNew(9,difficulty)}>9 × 9</button></div>
        <div className="difficulty-wrap"><select value={difficulty} onChange={e=>startNew(size,e.target.value as Difficulty)} aria-label="Difficulty"><option>Easy</option><option>Medium</option><option>Hard</option></select><ChevronDown size={14}/></div>
      </div>
      <div className="stats-row"><div className="stat"><span className="stat-label">TIME</span><strong>{formatTime(seconds)}</strong></div><div className="stat"><span className="stat-label">MISTAKES</span><strong className={mistakes>0?'mistake-num':''}>{mistakes}<small> / 3+</small></strong></div><button className="pause-btn" onClick={()=>setPaused(!paused)}>{paused?<Play size={16}/>:<Pause size={16}/>} {paused?'Resume':'Pause'}</button></div>
      <div className="board-wrap">
        <div className={`sudoku-board size-${size} ${paused?'is-paused':''}`} style={{gridTemplateColumns:`repeat(${size},minmax(0,1fr))`}}>
          {board.map((row,r)=>row.map((cell,c)=>{
            const isSelected=selected?.[0]===r&&selected?.[1]===c;
            const sameNumber=selectedValue>0&&cell.value===selectedValue;
            const bad=wrong.has(`${r},${c}`);
            const box=boxShape(size);
            return <button key={`${r}-${c}`} className={`cell ${isSelected?'selected':''} ${peer(r,c)?'peer':''} ${sameNumber?'same-number':''} ${cell.given?'given':''} ${bad?'bad':''} ${r%box[0]===box[0]-1&&r!==size-1?'box-bottom':''} ${c%box[1]===box[1]-1&&c!==size-1?'box-right':''}`} onClick={()=>{if(!paused&&!showWin){setSelected([r,c]);tone(470);}}} aria-label={`Row ${r+1}, column ${c+1}${cell.value?', '+cell.value:''}`}>
              {cell.value ? <span>{cell.value}</span> : <span className="notes-grid">{numbers.map(n=><i key={n}>{cell.notes.includes(n)?n:''}</i>)}</span>}
            </button>
          )).flat())}
          {paused && <div className="pause-overlay"><div><Pause size={26}/><b>Take a breather</b><button onClick={()=>setPaused(false)}>Resume puzzle</button></div></div>}
        </div>
      </div>
      <div className="board-caption"><span><i className="legend-dot given-dot"></i>Starting number</span><span><i className="legend-dot selected-dot"></i>Selected square</span><button onClick={()=>setShowNewGame(true)}><RotateCcw size={14}/> New game</button></div>
      <div className="number-pad" style={{gridTemplateColumns:`repeat(${size},minmax(0,1fr))`}}>{numbers.map((n,i)=><button key={n} disabled={filledCounts[i]>=size || paused || showWin} className={selectedValue===n?'number-active':''} onClick={()=>enterNumber(n)}>{n}<span className="remaining">{Math.max(0,size-filledCounts[i])}</span></button>)}</div>
      <div className="tools-row">
        <button className={`tool ${notesMode?'tool-active':''}`} onClick={()=>{setNotesMode(!notesMode);tone(430)}}><Pencil size={18}/><span>Pencil</span></button>
        <button className="tool" onClick={erase}><Eraser size={18}/><span>Erase</span></button>
        <button className="tool" onClick={undo} disabled={!history.length}><Undo2 size={18}/><span>Undo</span></button>
        <button className="tool hint-tool" onClick={hint}><Lightbulb size={18}/><span>Hint</span></button>
      </div>
      {notesMode&&<div className="mode-tip"><Pencil size={13}/> Pencil mode is on — tap numbers to add or remove notes.</div>}
      {message&&<div className="message-line">{message}<button onClick={()=>setMessage('')} aria-label="Dismiss"><X size={14}/></button></div>}
    </section>
    <footer><span>Made for a clearer mind.</span><span>Offline play · No ads</span></footer>

    {showNewGame&&<div className="modal-backdrop" onClick={()=>setShowNewGame(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-icon"><RotateCcw/></div><h2>Start a new puzzle?</h2><p>Your current puzzle will be replaced with a fresh one.</p><div className="modal-actions"><button className="secondary-btn" onClick={()=>setShowNewGame(false)}>Keep playing</button><button className="primary-btn" onClick={()=>startNew(size,difficulty)}>New puzzle</button></div></div></div>}
    {showSettings&&<div className="modal-backdrop" onClick={()=>setShowSettings(false)}><div className="modal settings-modal" onClick={e=>e.stopPropagation()}><div className="modal-top"><div><div className="eyebrow">MAKE IT YOURS</div><h2>Settings</h2></div><button className="icon-btn" onClick={()=>setShowSettings(false)}><X size={18}/></button></div><div className="setting-item"><div><b>Sound effects</b><small>Soft taps and feedback</small></div><button className={`toggle ${sound?'on':''}`} onClick={()=>setSound(!sound)}><span/></button></div><div className="setting-item"><div><b>Vibration</b><small>Gentle touch feedback</small></div><button className={`toggle ${vibration?'on':''}`} onClick={()=>setVibration(!vibration)}><span/></button></div><div className="setting-item"><div><b>Highlight related squares</b><small>Row, column and box</small></div><span className="setting-check"><Check size={15}/></span></div><div className="setting-item"><div><b>Autosave</b><small>Your game stays on this phone</small></div><span className="setting-check"><Check size={15}/></span></div><button className="primary-btn full-btn" onClick={()=>setShowSettings(false)}>Done</button></div></div>}
    {showWin&&<div className="modal-backdrop"><div className="modal win-modal"><div className="win-icon"><Trophy size={30}/></div><div className="eyebrow">PUZZLE COMPLETE</div><h2>Beautifully done!</h2><p>You gave yourself a moment of focus.</p><div className="win-time"><span>FINISH TIME</span><strong>{formatTime(seconds)}</strong></div><button className="primary-btn full-btn" onClick={()=>startNew(size,difficulty)}>Play another puzzle <Sparkles size={16}/></button><button className="text-btn" onClick={()=>{setShowWin(false);setPaused(false)}}>Review completed board</button></div></div>}
  </main>;
}