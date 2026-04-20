"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Copy,
  Download,
  FileQuestion,
  FileText,
  GitBranch,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { useCreateRagSessionMutation } from "@/queries";
import {
  useGenerateFlashcardsMutation,
  useDocumentAssetManifestQuery,
  useGenerateQuizMutation,
} from "@/queries/study";
import {
  documentAssetsApi,
  flashcardsApi,
  quizApi,
  ragApi,
} from "@/lib/api";
import type {
  Course,
  FlashcardDeckDetail,
  Mindmap,
  QuizDetail,
  RAGMessage,
  RAGStreamEvent,
  Summary,
} from "@/types/api.types";

export type AIToolType = "chat" | "summary" | "flashcards" | "quiz" | "mindmap";

interface AIToolsTabPanelProps {
  tool: AIToolType;
  course: Course | null;
  className?: string;
}

const toolConfig = {
  chat: {
    label: "Chat",
    icon: MessageSquare,
    emptyTitle: "Start a conversation",
    emptyDescription:
      "Ask questions about the course content and get AI-powered answers.",
  },
  summary: {
    label: "Summary",
    icon: FileText,
    emptyTitle: "Generate a Summary",
    emptyDescription: "Get an AI-powered summary of the course content.",
  },
  flashcards: {
    label: "Flashcards",
    icon: Layers,
    emptyTitle: "Generate Flashcards",
    emptyDescription: "Create interactive flashcards from the course material.",
  },
  quiz: {
    label: "Quiz",
    icon: FileQuestion,
    emptyTitle: "Take a Quiz",
    emptyDescription: "Test your knowledge with AI-generated quizzes.",
  },
  mindmap: {
    label: "Mind Map",
    icon: GitBranch,
    emptyTitle: "Generate Mind Map",
    emptyDescription:
      "Visualize the course structure as an interactive mind map.",
  },
} as const;

const assetTypeMap: Partial<
  Record<Exclude<AIToolType, "chat">, "SUMMARY" | "MINDMAP" | "FLASHCARDS" | "QUIZ">
> = {
  summary: "SUMMARY",
  mindmap: "MINDMAP",
  flashcards: "FLASHCARDS",
  quiz: "QUIZ",
};

interface ChatPanelProps {
  course: Course | null;
}

type ToolResult =
  | { kind: "summary"; data: Summary }
  | { kind: "flashcards"; data: FlashcardDeckDetail }
  | { kind: "quiz"; data: QuizDetail }
  | { kind: "mindmap"; data: Mindmap };

function getMindmapNodeLabel(node: Record<string, unknown>): string {
  const keys = ["label", "title", "text", "name", "id"];
  for (const key of keys) {
    const value = node[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "Untitled node";
}

function getCourseDocumentVersionId(course: Course | null): string | null {
  if (!course) return null;
  return course.current_version_id || course.current_version?.id || null;
}

function normalizeSummaryContent(
  summary: Summary["content"],
): { text: string; title?: string } {
  if (typeof summary === "string") {
    return { text: summary };
  }

  const overview =
    typeof summary.overview === "string" ? summary.overview : "";
  const keyConcepts = Array.isArray(summary.key_concepts)
    ? summary.key_concepts
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => `- ${item}`)
        .join("\n")
    : "";
  const conclusion =
    typeof summary.conclusion === "string" && summary.conclusion.trim()
      ? `\n\nConclusion\n${summary.conclusion}`
      : "";

  const sections = [overview];
  if (keyConcepts) {
    sections.push(`Key concepts\n${keyConcepts}`);
  }
  if (conclusion) {
    sections.push(conclusion.trim());
  }
  return { text: sections.filter(Boolean).join("\n\n") };
}

function toSummaryResult(documentVersionId: string, cache: Awaited<ReturnType<typeof documentAssetsApi.get>>): Summary {
  return {
    id: cache.id,
    format: cache.profile.toUpperCase(),
    target_lang: cache.target_lang,
    content: cache.content,
    created_at: cache.updated_at,
  };
}

function toMindmapResult(documentVersionId: string, cache: Awaited<ReturnType<typeof documentAssetsApi.get>>): Mindmap {
  const content = cache.content;
  return {
    id: cache.id,
    title:
      typeof content.title === "string" && content.title.trim()
        ? content.title
        : `Mind map ${documentVersionId.slice(0, 8)}`,
    target_lang: cache.target_lang,
    nodes: Array.isArray(content.nodes) ? (content.nodes as Mindmap["nodes"]) : [],
    edges: Array.isArray(content.edges) ? (content.edges as Mindmap["edges"]) : [],
    created_at: cache.updated_at,
  };
}

function buildCopyContent(result: ToolResult): string {
  switch (result.kind) {
    case "summary":
      return normalizeSummaryContent(result.data.content).text;
    case "flashcards":
      return result.data.cards
        .map(
          (card, index) =>
            `${index + 1}. ${card.question}\nAnswer: ${card.answer}`,
        )
        .join("\n\n");
    case "quiz":
      return result.data.questions
        .map((question, index) => {
          const options = question.options
            .map((option, optionIndex) => `${optionIndex + 1}. ${option}`)
            .join("\n");
          return `${index + 1}. ${question.question}\n${options}`;
        })
        .join("\n\n");
    case "mindmap":
      return [
        result.data.title,
        `Nodes: ${result.data.nodes.length}`,
        `Edges: ${result.data.edges.length}`,
        "",
        ...result.data.nodes
          .slice(0, 10)
          .map((node) => `- ${getMindmapNodeLabel(node)}`),
      ].join("\n");
  }
}

function buildDownloadPayload(result: ToolResult): {
  content: string;
  fileName: string;
  mimeType: string;
} {
  switch (result.kind) {
    case "summary":
      return {
        content: normalizeSummaryContent(result.data.content).text,
        fileName: `summary-${result.data.id}.txt`,
        mimeType: "text/plain;charset=utf-8",
      };
    case "flashcards":
      return {
        content: JSON.stringify(result.data, null, 2),
        fileName: `flashcards-${result.data.id}.json`,
        mimeType: "application/json;charset=utf-8",
      };
    case "quiz":
      return {
        content: JSON.stringify(result.data, null, 2),
        fileName: `quiz-${result.data.id}.json`,
        mimeType: "application/json;charset=utf-8",
      };
    case "mindmap":
      return {
        content: JSON.stringify(result.data, null, 2),
        fileName: `mindmap-${result.data.id}.json`,
        mimeType: "application/json;charset=utf-8",
      };
  }
}

function ResultContent({ result }: { result: ToolResult }) {
  if (result.kind === "summary") {
    const normalized = normalizeSummaryContent(result.data.content);
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap">
        {normalized.text}
      </div>
    );
  }

  if (result.kind === "flashcards") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">Deck</p>
          <h3 className="text-lg font-semibold">{result.data.title}</h3>
          <p className="text-sm text-muted-foreground">
            {result.data.card_count} cards ready for review
          </p>
        </div>
        <div className="space-y-3">
          {result.data.cards.slice(0, 5).map((card, index) => (
            <div key={card.id} className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Card {index + 1}
              </p>
              <p className="mt-2 font-medium">{card.question}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {card.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (result.kind === "quiz") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">Quiz Ready</p>
          <h3 className="text-lg font-semibold">
            {result.data.total_questions} questions
          </h3>
          <p className="text-sm text-muted-foreground">
            Time limit: {result.data.time_limit_minutes} minutes
          </p>
        </div>
        <div className="space-y-3">
          {result.data.questions.slice(0, 5).map((question, index) => (
            <div key={question.id} className="rounded-lg border p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {index + 1}
              </p>
              <p className="mt-2 font-medium">{question.question}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <div
                    key={`${question.id}-${optionIndex}`}
                    className="rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    {option}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">Mind Map</p>
        <h3 className="text-lg font-semibold">{result.data.title}</h3>
        <p className="text-sm text-muted-foreground">
          {result.data.nodes.length} nodes and {result.data.edges.length} edges
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {result.data.nodes.slice(0, 8).map((node, index) => (
          <div key={index} className="rounded-lg border p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Node {index + 1}
            </p>
            <p className="mt-2 font-medium">
              {getMindmapNodeLabel(node as Record<string, unknown>)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel({ course }: ChatPanelProps) {
  const [messages, setMessages] = useState<RAGMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamContent, setCurrentStreamContent] = useState("");
  const [currentSources, setCurrentSources] = useState<RAGMessage["sources"]>(
    [],
  );

  const createSession = useCreateRagSessionMutation(course?.id || "");

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !course || isStreaming) return;

    const userMessage: RAGMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputMessage,
      created_at: new Date().toISOString(),
      sources: [],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsStreaming(true);
    setCurrentStreamContent("");
    setCurrentSources([]);

    try {
      let sessionId = "";

      if (!createSession.data?.id) {
        const session = await createSession.mutateAsync();
        sessionId = session.id;
      } else {
        sessionId = createSession.data.id;
      }

      let fullContent = "";
      const sources: RAGMessage["sources"] = [];

      await new Promise<void>((resolve, reject) => {
        const streamHandler = (event: RAGStreamEvent) => {
          if (event.type === "token" && event.content) {
            fullContent += event.content;
            setCurrentStreamContent(fullContent);
          }

          if (event.type === "sources" && event.sources) {
            sources.splice(0, sources.length, ...event.sources);
            setCurrentSources([...sources]);
          }

          if (event.type === "done") {
            resolve();
          }

          if (event.type === "error") {
            reject(new Error(event.error || "Streaming failed"));
          }
        };

        ragApi.streamMessage(sessionId, inputMessage, streamHandler);
      });

      if (fullContent.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: fullContent,
            sources,
            created_at: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsStreaming(false);
      setCurrentStreamContent("");
      setCurrentSources([]);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 && !isStreaming ? (
          <EmptyState type="chat" className="h-full" />
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" && "flex-row-reverse",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  {msg.sources.length > 0 && (
                    <div className="mt-2 border-t border-border pt-2">
                      <p className="mb-1 text-xs opacity-70">Sources:</p>
                      {msg.sources.slice(0, 3).map((src, index) => (
                        <div
                          key={`${msg.id}-${src.course_id}-${src.page}-${index}`}
                          className="flex items-center gap-1 text-xs opacity-70"
                        >
                          <span className="font-medium">{src.page}</span>
                          <span className="truncate">{src.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isStreaming && currentStreamContent && (
              <div className="flex gap-3">
                <div className="max-w-[80%] rounded-lg bg-muted px-4 py-2">
                  <p className="text-sm whitespace-pre-wrap">
                    {currentStreamContent}
                  </p>
                  {currentSources.length > 0 && (
                    <div className="mt-2 border-t border-border pt-2">
                      <p className="mb-1 text-xs opacity-70">Sources:</p>
                      {currentSources.slice(0, 3).map((src, index) => (
                        <div
                          key={`${src.course_id}-${src.page}-${index}`}
                          className="flex items-center gap-1 text-xs opacity-70"
                        >
                          <span className="font-medium">{src.page}</span>
                          <span className="truncate">{src.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {isStreaming && (
        <div className="border-t px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>ATLAS is thinking...</span>
          </div>
        </div>
      )}

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask about the course..."
            value={inputMessage}
            onChange={(event) => setInputMessage(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSendMessage()}
            disabled={!course || isStreaming}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!course || isStreaming || !inputMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ToolPanelProps {
  tool: Exclude<AIToolType, "chat">;
  course: Course | null;
  className?: string;
}

function ToolPanel({ tool, course, className }: ToolPanelProps) {
  const config = toolConfig[tool];
  const documentVersionId = getCourseDocumentVersionId(course);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydratingCached, setIsHydratingCached] = useState(false);
  const generateFlashcards = useGenerateFlashcardsMutation();
  const generateQuiz = useGenerateQuizMutation();
  const manifestQuery = useDocumentAssetManifestQuery(documentVersionId || "");
  const sourceAssetType = assetTypeMap[tool];

  const hasCachedAsset =
    Boolean(
      sourceAssetType &&
        manifestQuery.data?.items.some((item) => item.asset_type === sourceAssetType),
    );

  useEffect(() => {
    if (!documentVersionId || result || isHydratingCached) return;
    if (tool !== "summary" && tool !== "mindmap") return;
    if (!hasCachedAsset) return;

    let cancelled = false;
    setIsHydratingCached(true);
    setErrorMessage(null);

    const run = async () => {
      try {
        const cache = await documentAssetsApi.get(
          documentVersionId,
          tool.toUpperCase() as "SUMMARY" | "MINDMAP",
        );
        if (cancelled) return;
        if (tool === "summary") {
          setResult({ kind: "summary", data: toSummaryResult(documentVersionId, cache) });
        } else {
          setResult({ kind: "mindmap", data: toMindmapResult(documentVersionId, cache) });
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      } finally {
        if (!cancelled) {
          setIsHydratingCached(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [documentVersionId, hasCachedAsset, isHydratingCached, result, tool]);

  const handleGenerate = async () => {
    if (!course) return;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      if (tool === "flashcards") {
        const generation = await generateFlashcards.mutateAsync({
          courseId: course.id,
        });
        const deck = await flashcardsApi.getDeck(generation.job_id);
        setResult({ kind: "flashcards", data: deck });
      } else if (tool === "quiz") {
        const generation = await generateQuiz.mutateAsync({
          courseId: course.id,
        });
        const quiz = await quizApi.getQuiz(generation.job_id);
        setResult({ kind: "quiz", data: quiz });
      } else if (tool === "summary") {
        if (!documentVersionId) {
          throw new Error("No document version available for summary generation.");
        }
        const cache = await documentAssetsApi.generate(documentVersionId, {
          asset_type: "SUMMARY",
          target_lang: "fr",
          profile: "executive",
        });
        const summary = toSummaryResult(documentVersionId, cache);
        setResult({ kind: "summary", data: summary });
      } else {
        if (!documentVersionId) {
          throw new Error("No document version available for mind map generation.");
        }
        const cache = await documentAssetsApi.generate(documentVersionId, {
          asset_type: "MINDMAP",
          target_lang: "fr",
        });
        const mindmap = toMindmapResult(documentVersionId, cache);
        setResult({ kind: "mindmap", data: mindmap });
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        `Failed to generate ${config.label.toLowerCase()}. Please try again.`,
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!result || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(buildCopyContent(result));
    } catch (error) {
      console.error("Failed to copy generated content:", error);
    }
  };

  const handleDownload = () => {
    if (!result || typeof window === "undefined") return;
    const payload = buildDownloadPayload(result);
    const blob = new Blob([payload.content], { type: payload.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = payload.fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <ScrollArea className="flex-1 p-4">
        {result ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <config.icon className="h-5 w-5 text-primary" />
                    <span className="font-medium">{config.label}</span>
                    {hasCachedAsset ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        {tool === "flashcards" || tool === "quiz" ? "Source cached" : "Cached"}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={handleCopy}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDownload}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      <RefreshCw
                        className={cn("h-4 w-4", isGenerating && "animate-spin")}
                      />
                    </Button>
                  </div>
                </div>
                <ResultContent result={result} />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-primary/10 p-4">
              <config.icon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">{config.emptyTitle}</h3>
            <p className="mb-6 max-w-sm text-muted-foreground">
              {config.emptyDescription}
            </p>
            {hasCachedAsset ? (
              <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <BadgeCheck className="h-3.5 w-3.5" />
                {tool === "flashcards" || tool === "quiz"
                  ? "Cached document source is ready for faster generation"
                  : "Cached result available for this document"}
              </p>
            ) : null}
            <Button onClick={handleGenerate} disabled={!course || isGenerating}>
              {isGenerating || isHydratingCached ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isHydratingCached ? "Loading..." : "Generating..."}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {hasCachedAsset
                    ? tool === "flashcards" || tool === "quiz"
                      ? `Generate ${config.label}`
                      : `Open ${config.label}`
                    : `Generate ${config.label}`}
                </>
              )}
            </Button>
            {errorMessage && (
              <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
            )}
            {!course && (
              <p className="mt-2 text-sm text-muted-foreground">
                Select a course to use this feature
              </p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function AIToolsTabPanel({
  tool,
  course,
  className,
}: AIToolsTabPanelProps) {
  if (tool === "chat") {
    return (
      <div className={cn("flex h-full flex-col bg-background", className)}>
        <ChatPanel course={course} />
      </div>
    );
  }

  return <ToolPanel tool={tool} course={course} className={className} />;
}

interface AIToolsSidebarProps {
  activeTab: AIToolType;
  onTabChange: (tab: AIToolType) => void;
  className?: string;
}

const tabs = [
  { id: "chat" as const, label: "Chat", icon: MessageSquare },
  { id: "summary" as const, label: "Summary", icon: FileText },
  { id: "flashcards" as const, label: "Flashcards", icon: Layers },
  { id: "quiz" as const, label: "Quiz", icon: FileQuestion },
  { id: "mindmap" as const, label: "Mind Map", icon: GitBranch },
];

export function AIToolsSidebar({
  activeTab,
  onTabChange,
  className,
}: AIToolsSidebarProps) {
  return (
    <div className={cn("p-4", className)}>
      <div className="space-y-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
