import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { useListFolders, useListQuestionSets, Folder, QuestionSet } from "@workspace/api-client-react";
import { MathText } from "@/components/folder/MathText";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home as HomeIcon, ChevronRight, ChevronDown, FolderOpen, BookOpen,
  Timer, Trophy, RotateCcw, Zap, CheckCircle, XCircle, AlertCircle,
  Play, Square, Check, Minus, Plus, Shuffle, Clock, Target,
  ArrowLeft, ArrowRight, List, X,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { getIcon } from "@/lib/folderIcons";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DbQuestion {
  id: number;
  setId: number;
  questionText: string;
  type: string;
  options: Array<{ letter: string; text: string }>;
  answer: string | null;
  solution: string | null;
  stemImages: string[];
  aiExplanation: string | null;
  hidden: boolean;
}

type Step = "select" | "configure" | "exam" | "results";

const ANSWER_COLORS: Record<string, string> = {
  A: "#22c55e", B: "#3b82f6", C: "#f59e0b", D: "#ef4444", E: "#8b5cf6",
};

// ─── Folder tree + set selector ───────────────────────────────────────────────
function FolderTree({
  parentId,
  depth,
  selectedSets,
  onToggleSet,
}: {
  parentId: number | null;
  depth: number;
  selectedSets: Set<number>;
  onToggleSet: (set: QuestionSet) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const { data: folders = [] } = useListFolders({ parentId: parentId ?? undefined });

  const toggle = (id: number) =>
    setExpanded((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  if (folders.length === 0) return null;
  return (
    <div className={depth > 0 ? "ml-4 border-l border-white/6 pl-3" : ""}>
      {folders.map((folder) => (
        <FolderTreeNode
          key={folder.id}
          folder={folder}
          depth={depth}
          expanded={expanded.has(folder.id)}
          onToggle={() => toggle(folder.id)}
          selectedSets={selectedSets}
          onToggleSet={onToggleSet}
        />
      ))}
    </div>
  );
}

function FolderTreeNode({
  folder, depth, expanded, onToggle, selectedSets, onToggleSet,
}: {
  folder: Folder; depth: number; expanded: boolean; onToggle: () => void;
  selectedSets: Set<number>; onToggleSet: (set: QuestionSet) => void;
}) {
  const IconComponent = getIcon(folder.icon);
  const { data: sets = [] } = useListQuestionSets(expanded ? folder.id : -1);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 py-2 px-3 rounded-xl hover:bg-white/5 transition-all group text-left"
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
        }
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${folder.color}22` }}>
          <IconComponent className="w-3.5 h-3.5" style={{ color: folder.color }} strokeWidth={1.8} />
        </div>
        <span className="text-sm font-medium text-white/75 group-hover:text-white/90 transition-colors truncate">
          {folder.name}
        </span>
        {folder.childCount > 0 && (
          <span className="ml-auto text-xs text-white/25 flex-shrink-0">{folder.childCount}</span>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            {/* Question Sets inside folder */}
            {sets.filter(s => s.examType === "mcq" || !s.examType).length > 0 && (
              <div className="ml-10 space-y-0.5 mb-1">
                {sets.filter(s => s.examType === "mcq" || !s.examType || s.examType === "mixed").map((set) => {
                  const isSelected = selectedSets.has(set.id);
                  return (
                    <button
                      key={set.id}
                      onClick={() => onToggleSet(set)}
                      className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-xl transition-all text-left group ${
                        isSelected ? "bg-indigo-500/15 border border-indigo-500/25" : "hover:bg-white/4 border border-transparent"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-all ${
                        isSelected ? "bg-indigo-500 border-indigo-400" : "border-white/20 bg-white/5"
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <BookOpen className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                      <span className={`text-sm truncate transition-colors ${isSelected ? "text-white/90" : "text-white/55 group-hover:text-white/75"}`}>
                        {set.name}
                      </span>
                      <span className="ml-auto text-xs text-white/25 flex-shrink-0">{set.totalQuestions}q</span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Subfolders */}
            <FolderTree
              parentId={folder.id}
              depth={depth + 1}
              selectedSets={selectedSets}
              onToggleSet={onToggleSet}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Exam timer ───────────────────────────────────────────────────────────────
function useTimer(totalSeconds: number, running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const remaining = Math.max(0, totalSeconds - elapsed);
  const percent = totalSeconds > 0 ? 1 - elapsed / totalSeconds : 0;
  return { elapsed, remaining, percent, expired: remaining === 0 && totalSeconds > 0 };
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MockExam() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("select");

  // Step 1: Selection
  const [selectedSets, setSelectedSets] = useState<Set<number>>(new Set());
  const [selectedSetMeta, setSelectedSetMeta] = useState<Map<number, QuestionSet>>(new Map());

  // Step 2: Config
  const [questionCount, setQuestionCount] = useState(25);
  const [timePerQuestion, setTimePerQuestion] = useState(60); // seconds
  const [shuffle, setShuffle] = useState(true);
  const [negativeMarking, setNegativeMarking] = useState(false);

  // Step 3: Exam
  const [questions, setQuestions] = useState<DbQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({}); // qId -> letter
  const [submitted, setSubmitted] = useState(false);
  const [examRunning, setExamRunning] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true); // auto-advance to next unanswered after selecting

  const totalTime = questionCount * timePerQuestion;
  const { remaining, percent, expired } = useTimer(totalTime, examRunning && !submitted);

  // Auto-submit on time expiry
  useEffect(() => {
    if (expired && !submitted && step === "exam") handleSubmit();
  }, [expired]);

  const toggleSet = useCallback((set: QuestionSet) => {
    setSelectedSets((prev) => {
      const next = new Set(prev);
      if (next.has(set.id)) {
        next.delete(set.id);
        setSelectedSetMeta((m) => { const nm = new Map(m); nm.delete(set.id); return nm; });
      } else {
        next.add(set.id);
        setSelectedSetMeta((m) => new Map(m).set(set.id, set));
      }
      return next;
    });
  }, []);

  const totalAvailable = [...selectedSetMeta.values()].reduce((s, set) => s + set.totalQuestions, 0);

  const startExam = async () => {
    if (selectedSets.size === 0) {
      toast({ title: "Select question sets", description: "Choose at least one question set to continue.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/chorcha/mock-exam/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setIds: [...selectedSets],
          count: questionCount,
          shuffle,
          types: ["mcq"],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const data = await res.json();
      if (data.questions.length === 0) {
        toast({ title: "No MCQ questions found", description: "The selected sets have no MCQ questions.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setQuestions(data.questions);
      setCurrentIdx(0);
      setAnswers({});
      setSubmitted(false);
      setShowReview(false);
      setExamRunning(true);
      setStep("exam");
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = useCallback(() => {
    setSubmitted(true);
    setExamRunning(false);
    setStep("results");
  }, []);

  const handleAnswer = (letter: string) => {
    if (submitted) return;
    const qId = questions[currentIdx]?.id;
    if (!qId) return;
    setAnswers((prev) => {
      const next = { ...prev, [qId]: letter };
      // Auto-scroll: advance to next unanswered question after a short delay
      if (autoScroll) {
        setTimeout(() => {
          setCurrentIdx(cur => {
            // Find next unanswered after current
            const nextUnanswered = questions.findIndex((q, i) => i > cur && !next[q.id]);
            if (nextUnanswered !== -1) return nextUnanswered;
            // Wrap: find any unanswered
            const anyUnanswered = questions.findIndex((q, i) => i !== cur && !next[q.id]);
            if (anyUnanswered !== -1) return anyUnanswered;
            return cur;
          });
        }, 600);
      }
      return next;
    });
  };

  const goTo = (idx: number) => {
    if (idx < 0 || idx >= questions.length) return;
    setCurrentIdx(idx);
  };

  // Results
  const score = questions.reduce((s, q) => {
    const ans = answers[q.id];
    if (!ans) return s;
    if (ans === q.answer) return s + 1;
    if (negativeMarking) return s - 0.25;
    return s;
  }, 0);
  const correct = questions.filter((q) => answers[q.id] === q.answer).length;
  const wrong = questions.filter((q) => answers[q.id] && answers[q.id] !== q.answer).length;
  const skipped = questions.filter((q) => !answers[q.id]).length;
  const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  const reset = () => {
    setStep("select");
    setSelectedSets(new Set());
    setSelectedSetMeta(new Map());
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setExamRunning(false);
    setShowReview(false);
    setCurrentIdx(0);
  };

  // ── Keyboard shortcuts in exam mode
  useEffect(() => {
    if (step !== "exam" || submitted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D", "E"].includes(key)) handleAnswer(key);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goTo(currentIdx + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") goTo(currentIdx - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, submitted, currentIdx, questions]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-white/6">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm">
              <HomeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Home</span>
            </button>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-white/20" />
          <span className="text-sm font-semibold text-white/80 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            Mock Exam
          </span>

          {step === "exam" && !submitted && (
            <div className="ml-auto flex items-center gap-3">
              {/* Timer */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${
                remaining < 60 ? "bg-red-500/15 border-red-500/30" :
                remaining < 300 ? "bg-amber-500/10 border-amber-500/25" :
                "bg-white/5 border-white/10"
              }`}>
                <Timer className={`w-3.5 h-3.5 ${remaining < 60 ? "text-red-400" : remaining < 300 ? "text-amber-400" : "text-white/50"}`} />
                <span className={`font-mono text-sm font-semibold ${remaining < 60 ? "text-red-400" : remaining < 300 ? "text-amber-300" : "text-white/70"}`}>
                  {formatTime(remaining)}
                </span>
              </div>
              <span className="text-xs text-white/35">{Object.keys(answers).length}/{questions.length}</span>
              <Button
                size="sm"
                onClick={handleSubmit}
                className="rounded-xl text-xs font-semibold gap-1.5"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
              >
                <Square className="w-3 h-3" />Submit
              </Button>
            </div>
          )}

          {step !== "exam" && <div className="ml-auto"><ThemeToggle /></div>}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">

          {/* ── STEP 1: SELECT ───────────────────────────────────── */}
          {step === "select" && (
            <motion.div key="select"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-6"
            >
              {/* Title */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <span className="text-xs font-bold text-amber-400">১/৩</span>
                  </div>
                  <h1 className="text-2xl font-bold text-white/90">Select Question Sets</h1>
                </div>
                <p className="text-sm text-white/40 pl-10">Choose which question sets to pull MCQ questions from.</p>
              </div>

              {/* Selected sets summary */}
              {selectedSets.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2 p-3 rounded-2xl bg-indigo-500/8 border border-indigo-500/20"
                >
                  {[...selectedSetMeta.values()].map((set) => (
                    <span key={set.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/25 text-xs text-indigo-300"
                    >
                      {set.name}
                      <button onClick={() => toggleSet(set)} className="text-indigo-400 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </motion.div>
              )}

              {/* Folder tree */}
              <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-white/30" />
                  <span className="text-sm font-medium text-white/50">Your Question Bank</span>
                </div>
                <div className="p-2 max-h-[50vh] overflow-y-auto">
                  <FolderTree parentId={null} depth={0} selectedSets={selectedSets} onToggleSet={toggleSet} />
                </div>
              </div>

              {/* Proceed */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-white/40">
                  {selectedSets.size > 0
                    ? <span><span className="text-white/70 font-semibold">{selectedSets.size}</span> set{selectedSets.size !== 1 ? "s" : ""} · ~<span className="text-white/70 font-semibold">{totalAvailable}</span> questions</span>
                    : "No sets selected"}
                </div>
                <Button
                  onClick={() => setStep("configure")}
                  disabled={selectedSets.size === 0}
                  className="rounded-xl gap-2 font-semibold"
                  style={{ background: selectedSets.size > 0 ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : undefined }}
                >
                  Configure <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: CONFIGURE ────────────────────────────────── */}
          {step === "configure" && (
            <motion.div key="configure"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-6 max-w-lg mx-auto"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
                    <span className="text-xs font-bold text-indigo-400">২/৩</span>
                  </div>
                  <h1 className="text-2xl font-bold text-white/90">Configure Exam</h1>
                </div>
                <p className="text-sm text-white/40 pl-10">Set up your exam parameters.</p>
              </div>

              <div className="space-y-4">
                {/* Question count */}
                <div className="p-5 rounded-2xl bg-white/4 border border-white/8 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-white/50" />
                      <span className="font-semibold text-white/80">Questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQuestionCount(q => Math.max(5, q - 5))}
                        className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/12 flex items-center justify-center transition-all">
                        <Minus className="w-3.5 h-3.5 text-white/60" />
                      </button>
                      <span className="w-12 text-center font-bold text-xl text-white">{questionCount}</span>
                      <button onClick={() => setQuestionCount(q => Math.min(Math.max(totalAvailable, 200), q + 5))}
                        className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/12 flex items-center justify-center transition-all">
                        <Plus className="w-3.5 h-3.5 text-white/60" />
                      </button>
                    </div>
                  </div>
                  <input type="range" min={5} max={Math.max(200, totalAvailable)} step={5}
                    value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer" />
                  <p className="text-xs text-white/30">{totalAvailable} available in selected sets</p>
                </div>

                {/* Time per question */}
                <div className="p-5 rounded-2xl bg-white/4 border border-white/8 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-white/50" />
                    <span className="font-semibold text-white/80">Time per Question</span>
                  </div>
                  {/* Quick presets */}
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { label: "30s", val: 30 },
                      { label: "45s", val: 45 },
                      { label: "1m",  val: 60 },
                      { label: "1.5m", val: 90 },
                      { label: "2m",  val: 120 },
                    ].map(({ label, val }) => (
                      <button key={val} onClick={() => setTimePerQuestion(val)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          timePerQuestion === val
                            ? "bg-indigo-500/25 border-indigo-500/50 text-indigo-300"
                            : "bg-white/5 border-white/10 text-white/45 hover:bg-white/10 hover:text-white/70"
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {/* Fine-tune */}
                  <div className="flex items-center justify-between">
                    <button onClick={() => setTimePerQuestion(t => Math.max(15, t - 15))}
                      className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/14 flex items-center justify-center transition-all active:scale-95">
                      <Minus className="w-3.5 h-3.5 text-white/60" />
                    </button>
                    <div className="text-center">
                      <div className="font-bold text-2xl text-white tabular-nums">{formatTime(timePerQuestion)}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">per question</div>
                    </div>
                    <button onClick={() => setTimePerQuestion(t => Math.min(300, t + 15))}
                      className="w-9 h-9 rounded-xl bg-white/8 hover:bg-white/14 flex items-center justify-center transition-all active:scale-95">
                      <Plus className="w-3.5 h-3.5 text-white/60" />
                    </button>
                  </div>
                  {/* Total time display */}
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-500/8 border border-indigo-500/20">
                    <span className="text-xs text-white/40">Total exam duration</span>
                    <span className="text-sm font-bold text-indigo-300 tabular-nums">
                      {Math.floor(questionCount * timePerQuestion / 60)}m {(questionCount * timePerQuestion) % 60 > 0 ? `${(questionCount * timePerQuestion) % 60}s` : ""}
                    </span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  {[
                    {
                      icon: <Shuffle className="w-4 h-4" />, label: "Shuffle Questions",
                      desc: "Randomize question order", value: shuffle, onChange: setShuffle,
                      color: "#8b5cf6",
                    },
                    {
                      icon: <XCircle className="w-4 h-4" />, label: "Negative Marking",
                      desc: "−¼ mark for wrong answers", value: negativeMarking, onChange: setNegativeMarking,
                      color: "#ef4444",
                    },
                  ].map(({ icon, label, desc, value, onChange, color }) => (
                    <div key={label} className="flex items-center justify-between p-4 rounded-2xl bg-white/4 border border-white/8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${color}18`, color }}>
                          {icon}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white/80">{label}</div>
                          <div className="text-xs text-white/35">{desc}</div>
                        </div>
                      </div>
                      <button onClick={() => onChange(v => !v)}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${value ? "bg-indigo-500" : "bg-white/10"}`}>
                        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${value ? "left-6" : "left-0.5"}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => setStep("select")} className="rounded-xl border-white/10 text-white/50 hover:text-white gap-2">
                  <ArrowLeft className="w-4 h-4" />Back
                </Button>
                <Button
                  onClick={startExam}
                  disabled={loading}
                  className="flex-1 rounded-xl gap-2 font-semibold text-base h-12"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444, #8b5cf6)" }}
                >
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Loading...</>
                    : <><Play className="w-5 h-5" />শুরু করুন (Start Exam)</>
                  }
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: EXAM ─────────────────────────────────────── */}
          {step === "exam" && questions.length > 0 && (
            <motion.div key="exam"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-white/6 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
                  animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Timer progress ring (compact) */}
              <div className="flex items-center justify-between text-xs text-white/35">
                <span>প্রশ্ন {currentIdx + 1} / {questions.length}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-32 rounded-full bg-white/8 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full transition-colors ${percent < 0.2 ? "bg-red-500" : percent < 0.4 ? "bg-amber-400" : "bg-emerald-500"}`}
                      animate={{ width: `${Math.max(0, percent) * 100}%` }}
                    />
                  </div>
                  <span className={`font-mono font-semibold ${remaining < 60 ? "text-red-400" : remaining < 300 ? "text-amber-400" : "text-white/50"}`}>
                    {formatTime(remaining)}
                  </span>
                </div>
              </div>

              {/* Question card */}
              <AnimatePresence mode="wait">
                <motion.div key={currentIdx}
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden"
                >
                  {(() => {
                    const q = questions[currentIdx];
                    const myAnswer = answers[q.id];
                    return (
                      <div className="p-6 space-y-5">
                        {/* Stem images */}
                        {q.stemImages?.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {q.stemImages.map((url, i) => (
                              <img key={i} src={url} alt="stem"
                                className="max-h-40 rounded-xl border border-white/8 bg-white object-contain"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                              />
                            ))}
                          </div>
                        )}

                        {/* Question text */}
                        <div className="text-white/90 text-base leading-relaxed">
                          <MathText text={q.questionText} />
                        </div>

                        {/* Options */}
                        <div className="space-y-2.5">
                          {q.options?.map((opt) => {
                            const isSelected = myAnswer === opt.letter;
                            const color = ANSWER_COLORS[opt.letter] ?? "#8b5cf6";
                            return (
                              <button
                                key={opt.letter}
                                onClick={() => handleAnswer(opt.letter)}
                                className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                                  isSelected
                                    ? "border-opacity-60 scale-[1.01]"
                                    : "border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15"
                                }`}
                                style={isSelected ? {
                                  borderColor: `${color}60`,
                                  backgroundColor: `${color}12`,
                                  boxShadow: `0 0 0 1px ${color}30, 0 4px 20px ${color}15`,
                                } : {}}
                              >
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all"
                                  style={isSelected ? { backgroundColor: color, color: "#fff" } : {
                                    backgroundColor: "rgba(255,255,255,0.06)",
                                    color: "rgba(255,255,255,0.4)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                  }}
                                >
                                  {opt.letter}
                                </div>
                                <span className={`text-sm leading-relaxed mt-0.5 transition-colors ${isSelected ? "text-white/95" : "text-white/65"}`}>
                                  <MathText text={opt.text} />
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="space-y-2">
                {/* Question grid */}
                <div className="flex items-center gap-1.5 overflow-x-auto px-1 py-1">
                  {questions.map((q, i) => {
                    const answered = !!answers[q.id];
                    const isCurrent = i === currentIdx;
                    return (
                      <button key={i} onClick={() => goTo(i)}
                        className={`w-7 h-7 rounded-lg text-xs font-semibold flex-shrink-0 transition-all ${
                          isCurrent ? "ring-2 ring-indigo-400/70 scale-110 bg-indigo-500/50 text-white" :
                          answered ? "bg-indigo-500/30 text-indigo-200 hover:bg-indigo-500/45" :
                          "bg-white/6 text-white/35 hover:bg-white/12"
                        }`}>
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
                {/* Prev / Auto-scroll / Next row */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}
                    className="rounded-xl border-white/10 text-white/50 hover:text-white gap-1.5">
                    <ArrowLeft className="w-4 h-4" />Prev
                  </Button>
                  {/* ⚡ Auto-scroll toggle */}
                  <button
                    onClick={() => setAutoScroll(v => !v)}
                    title={autoScroll ? "Auto-advance: ON — tap to turn off" : "Auto-advance: OFF — tap to turn on"}
                    className={`flex items-center gap-1.5 rounded-xl text-xs font-semibold border transition-all px-2.5 py-1.5 ${
                      autoScroll
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                        : "bg-white/5 border-white/10 text-white/30 hover:text-white/55"
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {autoScroll && <span>Auto</span>}
                  </button>
                  <div className="flex-1" />
                  {currentIdx < questions.length - 1 ? (
                    <Button size="sm" onClick={() => goTo(currentIdx + 1)}
                      className="rounded-xl gap-1.5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                      Next <ArrowRight className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleSubmit}
                      className="rounded-xl gap-1.5 font-semibold" style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                      <Square className="w-3.5 h-3.5" />Submit
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── STEP 4: RESULTS ──────────────────────────────────── */}
          {step === "results" && (
            <motion.div key="results"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="space-y-6 max-w-2xl mx-auto"
            >
              {/* Score card */}
              <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 text-center"
                style={{
                  background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.10), rgba(236,72,153,0.08))",
                }}>
                <div className="absolute inset-0 opacity-20"
                  style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.4), transparent)" }} />

                <div className="relative z-10 space-y-4">
                  <Trophy className="w-12 h-12 mx-auto text-amber-400" />
                  <div>
                    <div className="text-6xl font-black text-white">{pct}%</div>
                    <div className="text-white/50 mt-1">
                      {score.toFixed(2)} / {questions.length} marks
                    </div>
                  </div>

                  <div className="flex justify-center gap-6">
                    {[
                      { label: "Correct", value: correct, color: "#22c55e", Icon: CheckCircle },
                      { label: "Wrong", value: wrong, color: "#ef4444", Icon: XCircle },
                      { label: "Skipped", value: skipped, color: "#64748b", Icon: AlertCircle },
                    ].map(({ label, value, color, Icon }) => (
                      <div key={label} className="text-center">
                        <div className="flex items-center justify-center gap-1 text-2xl font-bold" style={{ color }}>
                          <Icon className="w-5 h-5" />
                          {value}
                        </div>
                        <div className="text-xs text-white/40 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Result bar */}
                  <div className="h-2.5 rounded-full bg-white/8 overflow-hidden flex">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(correct / questions.length) * 100}%` }} />
                    <div className="h-full bg-red-500/70 transition-all" style={{ width: `${(wrong / questions.length) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button variant="outline" onClick={reset}
                  className="flex-1 rounded-xl border-white/10 text-white/60 hover:text-white gap-2 h-11">
                  <RotateCcw className="w-4 h-4" />New Exam
                </Button>
                <Button onClick={() => setShowReview(!showReview)}
                  className="flex-1 rounded-xl gap-2 h-11"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  <List className="w-4 h-4" />{showReview ? "Hide" : "Review Answers"}
                </Button>
              </div>

              {/* Answer review */}
              <AnimatePresence>
                {showReview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-3"
                  >
                    {questions.map((q, i) => {
                      const myAns = answers[q.id];
                      const isCorrect = myAns === q.answer;
                      const isWrong = myAns && !isCorrect;
                      return (
                        <div key={q.id}
                          className={`rounded-2xl border p-5 space-y-3 ${
                            isCorrect ? "border-emerald-500/25 bg-emerald-500/6" :
                            isWrong ? "border-red-500/20 bg-red-500/5" :
                            "border-white/8 bg-white/3"
                          }`}>
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-bold text-white/30 mt-1">Q{i + 1}</span>
                            <div className="flex-1">
                              <div className="text-sm text-white/80 leading-relaxed">
                                <MathText text={q.questionText} />
                              </div>
                            </div>
                            {isCorrect && <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />}
                            {isWrong && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />}
                            {!myAns && <AlertCircle className="w-5 h-5 text-white/25 flex-shrink-0 mt-0.5" />}
                          </div>

                          {q.options?.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5 ml-7">
                              {q.options.map((opt) => {
                                const isAns = opt.letter === q.answer;
                                const isMy = opt.letter === myAns;
                                return (
                                  <div key={opt.letter}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                                      isAns ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" :
                                      isMy && !isAns ? "bg-red-500/12 border-red-500/25 text-red-300" :
                                      "border-transparent text-white/35"
                                    }`}>
                                    <span className="font-bold w-4">{opt.letter}.</span>
                                    <span className="truncate"><MathText text={opt.text} /></span>
                                    {isAns && <Check className="w-3 h-3 ml-auto flex-shrink-0" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {myAns && (
                            <div className="ml-7 flex items-center gap-2 text-xs">
                              <span className="text-white/30">Your answer:</span>
                              <span className={`font-bold ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>{myAns}</span>
                              {!isCorrect && q.answer && (
                                <><span className="text-white/20">·</span>
                                <span className="text-white/30">Correct:</span>
                                <span className="font-bold text-emerald-400">{q.answer}</span></>
                              )}
                            </div>
                          )}

                          {!myAns && (
                            <div className="ml-7 text-xs text-white/30 flex items-center gap-2">
                              <span>Skipped</span>
                              {q.answer && <><span>·</span><span>Answer: <span className="text-emerald-400 font-bold">{q.answer}</span></span></>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
