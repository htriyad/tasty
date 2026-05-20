import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, Swords, Clock, Trophy, Zap, Check, X, Minus, ChevronDown, BookOpen, Layers } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/folder/MathText";
import { motion, AnimatePresence } from "framer-motion";
import { useBattle, type BattleScope } from "@/hooks/useBattle";

// ── Types ──────────────────────────────────────────────────────────────────────
interface FolderItem { id: number; name: string; parentId: number | null; }
interface SetItem { id: number; name: string; examType: string | null; totalQuestions: number; }

// ── Sub-components ─────────────────────────────────────────────────────────────
function RatingBadge({ rating, delta }: { rating: number; delta?: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold">
      <Zap className="w-3.5 h-3.5 text-yellow-500" />
      {rating}
      {delta != null && delta !== 0 && (
        <span className={delta > 0 ? "text-green-500" : "text-red-500"}>{delta > 0 ? "+" : ""}{delta}</span>
      )}
    </span>
  );
}

function TimerBar({ timeLimit, startTime, active }: { timeLimit: number; startTime: number; active: boolean }) {
  const [pct, setPct] = useState(100);
  useEffect(() => {
    if (!active) { setPct(100); return; }
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setPct(Math.max(0, ((timeLimit - elapsed) / timeLimit) * 100));
    }, 50);
    return () => clearInterval(interval);
  }, [active, startTime, timeLimit]);
  const color = pct > 50 ? "bg-green-500" : pct > 20 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-colors duration-100 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Scope selector ─────────────────────────────────────────────────────────────
function ScopeSelector({ scope, onChange }: { scope: BattleScope; onChange: (s: BattleScope) => void }) {
  const base = import.meta.env.BASE_URL;
  const [rootFolders, setRootFolders] = useState<FolderItem[]>([]);   // HSC, Engineering
  const [subjectFolders, setSubjectFolders] = useState<FolderItem[]>([]); // Physics, Chemistry…
  const [paperFolders, setPaperFolders] = useState<FolderItem[]>([]);  // 1st paper, 2nd paper…
  const [open, setOpen] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingPapers, setLoadingPapers] = useState(false);

  // Selection state: group → subject → paper
  const [groupId, setGroupId] = useState<number | undefined>();
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [paperId, setPaperId] = useState<number | undefined>();

  // Load top-level folders (HSC, Engineering…)
  useEffect(() => {
    fetch(`${base}api/folders`)
      .then(r => r.json())
      .then((d: FolderItem[]) => setRootFolders(Array.isArray(d) ? d.filter(f => !f.parentId) : []))
      .catch(() => {});
  }, [base]);

  // Load subjects when a group is picked
  useEffect(() => {
    if (!groupId) { setSubjectFolders([]); return; }
    setLoadingSubjects(true);
    fetch(`${base}api/folders?parentId=${groupId}`)
      .then(r => r.json())
      .then((d: FolderItem[]) => setSubjectFolders(Array.isArray(d) ? d : []))
      .catch(() => setSubjectFolders([]))
      .finally(() => setLoadingSubjects(false));
  }, [groupId, base]);

  // Load papers when a subject is picked
  useEffect(() => {
    if (!subjectId) { setPaperFolders([]); return; }
    setLoadingPapers(true);
    fetch(`${base}api/folders?parentId=${subjectId}`)
      .then(r => r.json())
      .then((d: FolderItem[]) => setPaperFolders(Array.isArray(d) ? d : []))
      .catch(() => setPaperFolders([]))
      .finally(() => setLoadingPapers(false));
  }, [subjectId, base]);

  const selectedGroup   = rootFolders.find(f => f.id === groupId);
  const selectedSubject = subjectFolders.find(f => f.id === subjectId);
  const selectedPaper   = paperFolders.find(f => f.id === paperId);

  const scopeLabel = paperId && selectedPaper
    ? `${selectedSubject?.name ?? "?"} · ${selectedPaper.name}`
    : subjectId && selectedSubject
      ? `${selectedSubject.name} · Any paper`
      : groupId && selectedGroup
        ? `${selectedGroup.name} · Any subject`
        : "All subjects (random)";

  const pickGroup = (id: number) => {
    setGroupId(id); setSubjectId(undefined); setPaperId(undefined);
    onChange({ folderId: id, setId: undefined });
  };

  const pickSubject = (id: number) => {
    setSubjectId(id); setPaperId(undefined);
    onChange({ folderId: id, setId: undefined });
  };

  const pickPaper = (id: number) => {
    setPaperId(id);
    onChange({ folderId: id, setId: undefined });
    setOpen(false);
  };

  const pickAll = () => {
    setGroupId(undefined); setSubjectId(undefined); setPaperId(undefined);
    onChange({});
    setOpen(false);
  };

  return (
    <div className="w-full">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate font-medium">{scopeLabel}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-border bg-card p-3 space-y-3">

              {/* Level 1: Group (HSC, Engineering…) */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Group</p>
                <div className="grid gap-1 max-h-36 overflow-y-auto pr-1">
                  <button onClick={pickAll}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${!groupId ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent"}`}>
                    All (random)
                  </button>
                  {rootFolders.map(f => (
                    <button key={f.id} onClick={() => pickGroup(f.id)}
                      className={`text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${groupId === f.id ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent"}`}>
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Level 2: Subject (Physics, Chemistry…) */}
              {groupId && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Subject</p>
                  {loadingSubjects ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">Loading…</p>
                  ) : (
                    <div className="grid gap-1 max-h-36 overflow-y-auto pr-1">
                      <button onClick={() => { setSubjectId(undefined); setPaperId(undefined); onChange({ folderId: groupId, setId: undefined }); setOpen(false); }}
                        className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${!subjectId ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent"}`}>
                        Any subject
                      </button>
                      {subjectFolders.map(f => (
                        <button key={f.id} onClick={() => pickSubject(f.id)}
                          className={`text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${subjectId === f.id ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent"}`}>
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Level 3: Paper (1st paper, 2nd paper…) */}
              {subjectId && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Paper</p>
                  {loadingPapers ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">Loading…</p>
                  ) : paperFolders.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-3 py-2">All questions from {selectedSubject?.name} will be used.</p>
                  ) : (
                    <div className="grid gap-1 max-h-36 overflow-y-auto pr-1">
                      <button onClick={() => { setPaperId(undefined); onChange({ folderId: subjectId, setId: undefined }); setOpen(false); }}
                        className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${!paperId ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent"}`}>
                        Both papers
                      </button>
                      {paperFolders.map(f => (
                        <button key={f.id} onClick={() => pickPaper(f.id)}
                          className={`text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${paperId === f.id ? "bg-primary/15 text-primary font-semibold" : "hover:bg-accent"}`}>
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function Battle() {
  const { state, joinQueue, joinBotQueue, leaveQueue, submitAnswer, playAgain } = useBattle();
  const [scope, setScope] = useState<BattleScope>({});
  const yourName = "You";

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </Link>
        <div className="flex items-center gap-2 font-bold text-sm tracking-wider uppercase text-foreground">
          <Swords className="w-4 h-4 text-rose-500" />
          Quiz Battle
        </div>
        <ThemeToggle size="sm" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <AnimatePresence mode="wait">

          {/* ── LOBBY ── */}
          {state.phase === "lobby" && (
            <motion.div key="lobby" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="w-full max-w-sm flex flex-col gap-5">
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
                  <Swords className="w-10 h-10 text-rose-500" />
                </div>
                <h2 className="text-2xl font-bold">Quiz Battle</h2>
                <p className="text-muted-foreground mt-1 text-sm">Answer 10 MCQs faster than your opponent</p>
              </div>

              {/* Scope selector */}
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Pick subject &amp; paper
                </p>
                <ScopeSelector scope={scope} onChange={setScope} />
              </div>

              {/* Game rules */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Questions</span><span className="font-medium">10 MCQs</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Time per question</span><span className="font-medium">15 seconds</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tiebreak</span><span className="font-medium">Faster answer wins</span></div>
              </div>

              {state.error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{state.error}</p>
              )}

              <div className="flex flex-col gap-2">
                <Button onClick={() => joinQueue(scope)} size="lg" className="w-full gap-2 text-base bg-rose-600 hover:bg-rose-500">
                  <Swords className="w-5 h-5" /> Find Match
                </Button>
                <Button onClick={() => joinBotQueue(scope)} size="lg" variant="outline" className="w-full gap-2 text-base">
                  <span className="text-base">🤖</span> Practice vs Bot
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── SEARCHING ── */}
          {state.phase === "searching" && (
            <motion.div key="searching" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 text-center">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-rose-500/20" />
                <div className="absolute inset-0 rounded-full border-4 border-rose-500 border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Swords className="w-8 h-8 text-rose-500" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold">Finding opponent…</h2>
                <p className="text-muted-foreground text-sm mt-1">Matching players</p>
              </div>
              <Button variant="outline" onClick={leaveQueue}>Cancel</Button>
            </motion.div>
          )}

          {/* ── MATCHED ── */}
          {state.phase === "matched" && (
            <motion.div key="matched" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} transition={{ duration: 0.5 }}>
                <div className="text-3xl font-black text-rose-500 tracking-wider">MATCH FOUND!</div>
              </motion.div>
              <div className="flex items-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary ring-2 ring-primary/30">Y</div>
                  <p className="text-sm font-semibold">{yourName}</p>
                  <RatingBadge rating={state.yourRating} />
                </div>
                <div className="text-2xl font-black text-muted-foreground">VS</div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-14 h-14 rounded-full bg-rose-500/20 flex items-center justify-center text-xl font-bold text-rose-500 ring-2 ring-rose-500/30">
                    {(state.opponentName ?? "?")[0]?.toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold">{state.opponentName ?? "Opponent"}</p>
                  <RatingBadge rating={state.opponentRating} />
                </div>
              </div>
              <p className="text-muted-foreground text-sm">Get ready…</p>
            </motion.div>
          )}

          {/* ── COUNTDOWN ── */}
          {state.phase === "countdown" && (
            <motion.div key={`cd-${state.countdownSeconds}`}
              initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
              className="flex flex-col items-center gap-4">
              <div className="text-9xl font-black text-primary tabular-nums">
                {state.countdownSeconds === 0 ? "GO!" : state.countdownSeconds}
              </div>
              <p className="text-muted-foreground">Get ready!</p>
            </motion.div>
          )}

          {/* ── PLAYING / RESULT ── */}
          {(state.phase === "playing" || state.phase === "question_result") && state.currentQuestion && (
            <motion.div key="playing" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
              className="w-full max-w-2xl flex flex-col gap-4">
              {/* Scoreboard */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-xs text-muted-foreground">You</p>
                  <p className="text-3xl font-black leading-none">{state.yourScore}</p>
                </div>
                <div className="text-center px-2">
                  <p className="text-xs text-muted-foreground">Q {state.currentQuestionIndex + 1}/{state.totalQuestions}</p>
                  {state.opponentAnswered && state.phase === "playing" && (
                    <p className="text-xs text-yellow-500 font-medium mt-0.5">Opp answered ✓</p>
                  )}
                </div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-xs text-muted-foreground truncate max-w-[80px]">{state.opponentName ?? "Opp"}</p>
                  <p className="text-3xl font-black leading-none">{state.opponentScore}</p>
                </div>
              </div>

              {/* Timer */}
              <TimerBar timeLimit={state.timeLimit} startTime={state.questionStartTime}
                active={state.phase === "playing" && !state.selectedOption} />

              {/* Question */}
              <div className="rounded-xl border border-border bg-card p-5">
                {state.currentQuestion.stemImages?.length > 0 && (
                  <div className="mb-3 flex gap-2 flex-wrap">
                    {state.currentQuestion.stemImages.map((src, i) => (
                      <img key={i} src={src} alt="" className="max-h-32 rounded-lg border border-border bg-white object-contain p-1" />
                    ))}
                  </div>
                )}
                <div className="text-base leading-relaxed font-medium">
                  <MathText text={state.currentQuestion.text} imageBlock={false} />
                </div>
              </div>

              {/* Options */}
              <div className="grid gap-2">
                {state.currentQuestion.options.map(opt => {
                  const isSelected = state.selectedOption === opt.letter;
                  const result = state.questionResult;
                  const isCorrect = result?.correctOption === opt.letter;
                  const isWrong = isSelected && result && !result.yourCorrect;
                  let cls = "w-full flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm transition-all hover:bg-accent";
                  if (state.phase === "question_result") {
                    if (isCorrect) cls = "w-full flex items-start gap-3 rounded-xl border-2 border-green-500 bg-green-500/10 px-4 py-3 text-left text-sm";
                    else if (isWrong) cls = "w-full flex items-start gap-3 rounded-xl border-2 border-red-500 bg-red-500/10 px-4 py-3 text-left text-sm";
                    else cls = "w-full flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm opacity-50";
                  } else if (isSelected) {
                    cls = "w-full flex items-start gap-3 rounded-xl border-2 border-primary bg-primary/10 px-4 py-3 text-left text-sm ring-1 ring-primary";
                  }
                  return (
                    <motion.button key={opt.letter} className={cls}
                      onClick={() => submitAnswer(opt.letter)}
                      disabled={!!state.selectedOption || state.phase === "question_result"}
                      whileTap={!state.selectedOption ? { scale: 0.98 } : undefined}>
                      <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center font-bold text-xs">
                        {opt.letter}
                      </span>
                      <span className="flex-1 leading-snug">
                        <MathText text={opt.text} imageBlock={false} />
                      </span>
                      {state.phase === "question_result" && isCorrect && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                      {state.phase === "question_result" && isWrong && <X className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Result message */}
              {state.phase === "question_result" && state.questionResult && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`rounded-xl p-3 text-center text-sm font-semibold ${state.questionResult.yourCorrect ? "bg-green-500/15 text-green-600 dark:text-green-400" : state.questionResult.yourAnswer ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground"}`}>
                  {state.questionResult.yourCorrect ? "✓ Correct!" : state.questionResult.yourAnswer ? "✗ Wrong" : "⏰ Time's up"}
                  {" · "}
                  {state.questionResult.opponentCorrect ? "Opponent got it right" : "Opponent got it wrong"}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── GAME OVER ── */}
          {state.phase === "game_over" && state.gameOver && (
            <motion.div key="game_over" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
              {state.gameOver.isDraw ? (
                <><Minus className="w-12 h-12 text-yellow-500 mx-auto" /><h2 className="text-3xl font-black">DRAW!</h2></>
              ) : state.gameOver.youWon ? (
                <><Trophy className="w-12 h-12 text-yellow-500 mx-auto" /><h2 className="text-3xl font-black text-yellow-500">VICTORY!</h2></>
              ) : (
                <><X className="w-12 h-12 text-muted-foreground mx-auto" /><h2 className="text-3xl font-black text-muted-foreground">DEFEAT</h2></>
              )}

              <div className="w-full rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">You</p>
                    <p className="text-4xl font-black">{state.gameOver.yourScore}</p>
                  </div>
                  <div className="text-muted-foreground font-bold">—</div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">{state.opponentName ?? "Opponent"}</p>
                    <p className="text-4xl font-black">{state.gameOver.opponentScore}</p>
                  </div>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between text-sm">
                  <RatingBadge rating={state.gameOver.yourRatingAfter} delta={state.gameOver.yourRatingAfter - state.gameOver.yourRatingBefore} />
                  <p className="text-xs text-muted-foreground">rating</p>
                  <RatingBadge rating={state.gameOver.opponentRatingAfter} delta={state.gameOver.opponentRatingAfter - state.gameOver.opponentRatingBefore} />
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={playAgain} className="flex-1 gap-2">
                  <Swords className="w-4 h-4" /> Play Again
                </Button>
                <Link href="/" className="flex-1">
                  <Button variant="ghost" className="w-full">Home</Button>
                </Link>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
