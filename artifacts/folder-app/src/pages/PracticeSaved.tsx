import { useState, useEffect, useCallback } from "react";
import { Link, useSearch } from "wouter";
import {
  Home as HomeIcon, ChevronRight, BookOpen,
  CheckCircle, XCircle, AlertCircle,
  RotateCcw, ArrowLeft, ArrowRight, Star,
} from "lucide-react";
import { getSessionId } from "@/lib/localStore";
import { MathText } from "@/components/folder/MathText";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = ((import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

type PracticeQ = {
  id: number;
  question_text: string;
  options: { letter: string; text: string }[];
  answer: string;
  set_name: string | null;
  is_starred: boolean;
};

type Step = "loading" | "empty" | "exam" | "results";

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

export function PracticeSaved() {
  const search = useSearch();
  const starredOnly = new URLSearchParams(search).get("starred") === "1";

  const [step, setStep] = useState<Step>("loading");
  const [questions, setQuestions] = useState<PracticeQ[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showReview, setShowReview] = useState(false);

  const load = useCallback(() => {
    setStep("loading");
    setAnswers({});
    setCurrentIdx(0);
    setSubmitted(false);
    setShowReview(false);
    const session = getSessionId();
    const url = `${API_BASE}/api/saved/practice?session=${session}${starredOnly ? "&starred=true" : ""}`;
    fetch(url)
      .then(r => r.json())
      .then((data: PracticeQ[]) => {
        if (!Array.isArray(data) || data.length === 0) setStep("empty");
        else { setQuestions(data); setStep("exam"); }
      })
      .catch(() => setStep("empty"));
  }, [starredOnly]);

  useEffect(() => { load(); }, [load]);

  const q = questions[currentIdx];
  const answered = Object.keys(answers).length;
  const correct = questions.filter(qq => answers[qq.id] === qq.answer).length;
  const wrong = questions.filter(qq => answers[qq.id] && answers[qq.id] !== qq.answer).length;
  const skipped = questions.length - answered;
  const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

  const handleAnswer = useCallback((letter: string) => {
    if (submitted || !q) return;
    setAnswers(prev => {
      const next = { ...prev, [q.id]: letter };
      setTimeout(() => {
        setCurrentIdx(cur => {
          const nextUnanswered = questions.findIndex((qq, i) => i > cur && !next[qq.id]);
          if (nextUnanswered !== -1) return nextUnanswered;
          const any = questions.findIndex((qq, i) => i !== cur && !next[qq.id]);
          return any !== -1 ? any : cur;
        });
      }, 500);
      return next;
    });
  }, [q, submitted, questions]);

  useEffect(() => {
    if (step !== "exam" || submitted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      if (OPTION_LETTERS.includes(key)) handleAnswer(key);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setCurrentIdx(i => Math.min(i + 1, questions.length - 1));
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setCurrentIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, submitted, handleAnswer, questions.length]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-xl border-b border-white/6">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/bookmarks">
            <button className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm">
              <HomeIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Saved</span>
            </button>
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-white/20" />
          <span className="text-sm font-semibold text-white/80 flex items-center gap-1.5">
            {starredOnly && <Star className="w-4 h-4 text-amber-400" fill="currentColor" />}
            Practice {starredOnly ? "Starred" : "Saved"}
          </span>
          {step === "exam" && !submitted && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-white/35">{answered}/{questions.length} answered</span>
              <Button size="sm"
                onClick={() => { setSubmitted(true); setStep("results"); }}
                className="rounded-xl text-xs font-semibold"
                style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                Submit
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">

          {/* Loading */}
          {step === "loading" && (
            <motion.div key="loading" className="flex flex-col items-center gap-4 py-32"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="w-10 h-10 rounded-full border-2 border-amber-500/40 border-t-amber-400 animate-spin" />
              <p className="text-white/40 text-sm">Loading saved questions…</p>
            </motion.div>
          )}

          {/* Empty */}
          {step === "empty" && (
            <motion.div key="empty"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 py-32 text-center">
              <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center">
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm">
                {starredOnly ? "No starred MCQ questions to practise." : "No saved MCQ questions to practise."}
              </p>
              <p className="text-muted-foreground/60 text-xs">Save some MCQ questions from any question set first.</p>
              <Link href="/bookmarks">
                <Button variant="outline" className="rounded-xl mt-2">Go to Saved</Button>
              </Link>
            </motion.div>
          )}

          {/* Exam */}
          {step === "exam" && q && (
            <motion.div key="exam"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-5">

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/30">
                  <span>Q{currentIdx + 1} of {questions.length}</span>
                  <span>{answered} answered</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
                </div>
              </div>

              {/* Dot nav */}
              <div className="flex flex-wrap gap-1.5">
                {questions.map((qq, i) => (
                  <button key={qq.id} onClick={() => setCurrentIdx(i)}
                    className={`w-7 h-7 rounded-lg text-[10px] font-bold transition-all ${
                      i === currentIdx ? "ring-2 ring-amber-400 scale-110 bg-amber-500/20 text-amber-300" :
                      answers[qq.id] ? "bg-indigo-500/30 text-indigo-300" :
                      "bg-white/6 text-white/30 hover:bg-white/12"
                    }`}>
                    {i + 1}
                  </button>
                ))}
              </div>

              {/* Question card */}
              <motion.div key={q.id}
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                className="rounded-2xl border border-white/8 bg-white/3 p-5 space-y-4">

                <div className="flex items-center gap-2">
                  {q.is_starred && <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" />}
                  <span className="text-xs text-white/30 truncate">{q.set_name}</span>
                </div>

                <div className="text-sm text-white/90 leading-relaxed">
                  <MathText text={q.question_text} />
                </div>

                <div className="space-y-2">
                  {q.options.map(opt => {
                    const selected = answers[q.id] === opt.letter;
                    return (
                      <button key={opt.letter}
                        onClick={() => handleAnswer(opt.letter)}
                        className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                          selected
                            ? "bg-indigo-500/20 border-indigo-400/50 text-white"
                            : "border-white/8 bg-white/3 text-white/70 hover:bg-white/8 hover:border-white/15"
                        }`}>
                        <span className={`font-bold w-5 flex-shrink-0 mt-0.5 ${selected ? "text-indigo-300" : "text-white/30"}`}>
                          {opt.letter}.
                        </span>
                        <span className="leading-relaxed"><MathText text={opt.text} /></span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Nav */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm"
                  onClick={() => setCurrentIdx(i => Math.max(i - 1, 0))}
                  disabled={currentIdx === 0}
                  className="rounded-xl border-white/10 text-white/50 gap-1.5">
                  <ArrowLeft className="w-4 h-4" />Prev
                </Button>
                <Button variant="outline" size="sm"
                  onClick={() => setCurrentIdx(i => Math.min(i + 1, questions.length - 1))}
                  disabled={currentIdx === questions.length - 1}
                  className="rounded-xl border-white/10 text-white/50 gap-1.5">
                  Next<ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Results */}
          {step === "results" && (
            <motion.div key="results"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-6 max-w-lg mx-auto">

              <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-5 text-center">
                <div className={`text-6xl font-black ${pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-red-400"}`}>
                  {pct}%
                </div>
                <p className="text-white/40 text-sm">
                  {pct >= 70 ? "Great job! 🎉" : pct >= 40 ? "Keep practising!" : "Review and retry"}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Correct", value: correct, color: "text-emerald-400" },
                    { label: "Wrong", value: wrong, color: "text-red-400" },
                    { label: "Skipped", value: skipped, color: "text-white/30" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl bg-white/5 p-3">
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-white/30 mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="h-2 rounded-full bg-white/8 overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(correct / Math.max(questions.length, 1)) * 100}%` }} />
                  <div className="h-full bg-red-500/70 transition-all" style={{ width: `${(wrong / Math.max(questions.length, 1)) * 100}%` }} />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={load}
                  className="flex-1 rounded-xl border-white/10 text-white/60 hover:text-white gap-2 h-11">
                  <RotateCcw className="w-4 h-4" />Retry
                </Button>
                <Button onClick={() => setShowReview(v => !v)}
                  className="flex-1 rounded-xl gap-2 h-11"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                  {showReview ? "Hide" : "Review Answers"}
                </Button>
              </div>

              <AnimatePresence>
                {showReview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-3">
                    {questions.map((qq, i) => {
                      const myAns = answers[qq.id];
                      const isCorrect = myAns === qq.answer;
                      const isWrong = myAns && !isCorrect;
                      return (
                        <div key={qq.id}
                          className={`rounded-2xl border p-5 space-y-3 ${
                            isCorrect ? "border-emerald-500/25 bg-emerald-500/6" :
                            isWrong ? "border-red-500/20 bg-red-500/5" :
                            "border-white/8 bg-white/3"
                          }`}>
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-bold text-white/30 mt-1 flex-shrink-0">Q{i + 1}</span>
                            <div className="flex-1 text-sm text-white/80 leading-relaxed min-w-0">
                              <MathText text={qq.question_text} />
                            </div>
                            {isCorrect && <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />}
                            {isWrong && <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                            {!myAns && <AlertCircle className="w-5 h-5 text-white/25 flex-shrink-0" />}
                          </div>
                          {qq.options.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5 ml-7">
                              {qq.options.map(opt => {
                                const isAns = opt.letter === qq.answer;
                                const isMy = opt.letter === myAns;
                                return (
                                  <div key={opt.letter}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                                      isAns ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" :
                                      isMy ? "bg-red-500/12 border-red-500/25 text-red-300" :
                                      "border-transparent text-white/30"
                                    }`}>
                                    <span className="font-bold w-4 flex-shrink-0">{opt.letter}.</span>
                                    <span className="truncate"><MathText text={opt.text} /></span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="ml-7 flex items-center gap-2 text-xs flex-wrap">
                            {myAns ? (
                              <>
                                <span className="text-white/30">Your answer:</span>
                                <span className={`font-bold ${isCorrect ? "text-emerald-400" : "text-red-400"}`}>{myAns}</span>
                                {!isCorrect && qq.answer && (
                                  <><span className="text-white/20">·</span>
                                  <span className="text-white/30">Correct:</span>
                                  <span className="font-bold text-emerald-400">{qq.answer}</span></>
                                )}
                              </>
                            ) : (
                              <span className="text-white/30">
                                Skipped{qq.answer ? ` · Answer: ${qq.answer}` : ""}
                              </span>
                            )}
                          </div>
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
