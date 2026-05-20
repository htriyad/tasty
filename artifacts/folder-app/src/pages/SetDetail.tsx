import { useParams, Link } from "wouter";
import { useGetQuestionSet, getGetQuestionSetQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, ChevronDown, ChevronUp, CheckCircle2, LayoutList } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function SetDetail() {
  const { id } = useParams();
  const setId = Number(id);

  const { data, isLoading } = useGetQuestionSet(setId, {
    query: { enabled: !!setId, queryKey: getGetQuestionSetQueryKey(setId) }
  });

  const [expandedQuestions, setExpandedQuestions] = useState<Record<number, boolean>>({});

  const toggleQuestion = (questionId: number) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const expandAll = () => {
    if (!data?.questions) return;
    const all = data.questions.reduce((acc, q) => ({ ...acc, [q.id]: true }), {});
    setExpandedQuestions(all);
  };

  const collapseAll = () => {
    setExpandedQuestions({});
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div>Question set not found.</div>;
  }

  const { set, questions } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link href={`/manage/folders/${set.folderId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{set.name}</h1>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium text-foreground">{set.totalQuestions} Questions</span>
            </div>
            {set.examType && (
              <div className="flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                <span className="font-medium text-foreground">{set.examType}</span>
              </div>
            )}
            <div>
              Created: <span className="font-medium text-foreground">{format(new Date(set.createdAt), 'PPpp')}</span>
            </div>
            {set.sourceUrl && (
              <div>
                Source: <a href={set.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">Link</a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Questions</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>Expand All</Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>Collapse All</Button>
        </div>
      </div>

      <div className="space-y-4">
        {questions?.map((q) => {
          const isExpanded = expandedQuestions[q.id];
          return (
            <Card key={q.id} className="border-border overflow-hidden">
              <div 
                className="p-4 cursor-pointer hover:bg-accent/30 transition-colors flex items-start gap-4"
                onClick={() => toggleQuestion(q.id)}
              >
                <div className="font-mono text-sm font-bold bg-secondary text-secondary-foreground px-2 py-1 rounded">
                  Q{q.questionIndex}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="uppercase text-[10px] tracking-wider">
                      {q.type}
                    </Badge>
                    <span className="text-sm font-medium line-clamp-1">{q.questionText}</span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>

              {isExpanded && (
                <div className="p-4 pt-0 border-t border-border bg-accent/5">
                  <div className="py-4 space-y-4">
                    <div className="text-base" dangerouslySetInnerHTML={{ __html: q.questionText }} />

                    {/* MCQ Options */}
                    {q.type === 'mcq' && q.options && q.options.length > 0 && (
                      <div className="grid gap-2 sm:grid-cols-2 mt-4">
                        {q.options.map((opt, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-start gap-3 p-3 rounded-md border ${
                              q.answer === opt.letter 
                                ? "border-primary/50 bg-primary/10" 
                                : "border-border bg-card"
                            }`}
                          >
                            <span className={`font-mono font-bold shrink-0 ${q.answer === opt.letter ? "text-primary" : "text-muted-foreground"}`}>
                              {opt.letter}.
                            </span>
                            <span dangerouslySetInnerHTML={{ __html: opt.text }} />
                            {q.answer === opt.letter && (
                              <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0 mt-0.5" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CQ Parts */}
                    {(q.type === 'cq' || q.type === 'sq') && q.parts && q.parts.length > 0 && (
                      <div className="space-y-4 mt-4">
                        {q.parts.map((part, idx) => (
                          <div key={idx} className="bg-card border border-border rounded-md p-4 space-y-3">
                            <div className="flex items-start gap-2">
                              <span className="font-bold shrink-0">({part.label})</span>
                              <span dangerouslySetInnerHTML={{ __html: part.text }} />
                            </div>
                            {part.solution && (
                              <div className="bg-accent/20 rounded p-3 text-sm border border-border/50">
                                <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block mb-1">Solution</span>
                                <div dangerouslySetInnerHTML={{ __html: part.solution }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* General Solution / Answer (for non-part questions if applicable) */}
                    {(q.answer || q.solution) && q.type !== 'mcq' && (!q.parts || q.parts.length === 0) && (
                      <div className="space-y-2 mt-4">
                        {q.answer && (
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="text-muted-foreground uppercase tracking-wider text-xs">Answer:</span>
                            <span>{q.answer}</span>
                          </div>
                        )}
                        {q.solution && (
                          <div className="bg-accent/20 rounded p-3 text-sm border border-border/50 mt-2">
                            <span className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block mb-1">Solution</span>
                            <div dangerouslySetInnerHTML={{ __html: q.solution }} />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Stem Images */}
                    {q.stemImages && q.stemImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {q.stemImages.map((img, i) => (
                          <img key={i} src={img} alt={`Stem image ${i + 1}`} className="max-w-full h-auto max-h-[300px] rounded-md border border-border bg-white p-1" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
        {questions?.length === 0 && (
          <div className="py-12 text-center border border-dashed rounded-lg text-muted-foreground">
            No questions found in this set.
          </div>
        )}
      </div>
    </div>
  );
}
