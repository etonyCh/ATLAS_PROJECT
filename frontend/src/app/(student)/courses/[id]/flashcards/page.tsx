"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Brain, FlipVertical, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCourseQuery, useFlashcardDueQuery, useGenerateFlashcardsMutation, useReviewFlashcardMutation } from "@/queries";
import type { ReviewRating } from "@/types/api.types";

const reviewButtons: Array<{ label: string; rating: ReviewRating; variant: "destructive" | "secondary" | "success" }> = [
  { label: "Again", rating: "AGAIN", variant: "destructive" },
  { label: "Hard", rating: "HARD", variant: "secondary" },
  { label: "Good", rating: "GOOD", variant: "secondary" },
  { label: "Easy", rating: "EASY", variant: "success" },
];

export default function FlashcardsPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { data: course, isLoading: isCourseLoading } = useCourseQuery(courseId);
  const dueQuery = useFlashcardDueQuery();
  const generateMutation = useGenerateFlashcardsMutation();
  const reviewMutation = useReviewFlashcardMutation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const cards = dueQuery.data?.items || [];
  const currentCard = cards[currentIndex];
  const isLoading = isCourseLoading || dueQuery.isLoading;

  const heading = useMemo(
    () => course?.title || "this course",
    [course],
  );

  const resetCardState = () => {
    setIsFlipped(false);
  };

  const handleGenerate = async () => {
    await generateMutation.mutateAsync({ courseId });
    await dueQuery.refetch();
    setCurrentIndex(0);
    resetCardState();
  };

  const handleReview = async (rating: ReviewRating) => {
    if (!currentCard) return;
    await reviewMutation.mutateAsync({ cardId: currentCard.id, rating });
    await dueQuery.refetch();
    setCurrentIndex((prev) => {
      if (cards.length <= 1) return 0;
      return Math.min(prev, cards.length - 2);
    });
    resetCardState();
  };

  if (isLoading) {
    return <Skeleton className="h-[480px] w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Flashcards</h1>
          <p className="text-muted-foreground">
            Review flashcards generated from {heading}.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              Generate Flashcards
            </>
          )}
        </Button>
      </div>

      {currentCard ? (
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Card {currentIndex + 1} of {cards.length}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {currentCard.difficulty || "Unrated"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <button
              type="button"
              className={`flex min-h-[240px] w-full items-center justify-center rounded-lg border-2 p-6 text-left transition-colors ${
                isFlipped ? "border-primary bg-primary/5" : "bg-muted/40"
              }`}
              onClick={() => setIsFlipped((value) => !value)}
            >
              <p className="text-center text-lg font-medium">
                {isFlipped ? currentCard.answer : currentCard.question}
              </p>
            </button>

            <div className="flex justify-center">
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => setIsFlipped((value) => !value)}
              >
                <FlipVertical className="h-4 w-4" />
                Flip Card
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 border-t pt-4">
              {reviewButtons.map((action) => (
                <Button
                  key={action.rating}
                  variant={action.variant}
                  className="min-h-11"
                  disabled={reviewMutation.isPending}
                  onClick={() => handleReview(action.rating)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          type="flashcards"
          title="No due flashcards yet"
          description="Generate flashcards for this course to start reviewing real study cards."
          action={{ label: "Generate Flashcards", onClick: handleGenerate }}
        />
      )}
    </div>
  );
}
