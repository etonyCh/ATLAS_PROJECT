"use client";

import { useState } from "react";
import { Trophy, Medal, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useLeaderboardQuery } from "@/queries";
import { useAuthStore } from "@/store/auth.store";
import { useRegistrationOptionsQuery } from "@/queries/auth";
import { useTranslation } from "@/hooks/use-translation";

export default function LeaderboardPage() {
  const { t, tSection } = useTranslation();
  const leaderboardT = tSection("leaderboard");
  
  const { user } = useAuthStore();
  const [filiere, setFiliere] = useState<string>("All");
  const [limit, setLimit] = useState(20);

  const { data: options } = useRegistrationOptionsQuery();
  const filieres = ["All", ...(options?.departments.map(d => d.name) || [])];

  const { data: leaderboard, isLoading } = useLeaderboardQuery(
    limit,
    filiere === "All" ? undefined : filiere,
  );

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-amber-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Medal className="h-6 w-6 text-amber-700" />;
      default:
        return <span className="font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{leaderboardT.leaderboard}</h1>
        <p className="text-muted-foreground">
          {leaderboardT.rankDescription}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={filiere}
          onChange={(e) => setFiliere(e.target.value)}
          className="min-h-11 w-full sm:w-48"
        >
          {filieres.map((f) => (
            <option key={f} value={f}>
              {f === "All" ? leaderboardT.allPrograms : f}
            </option>
          ))}
        </Select>
        <Select
          value={String(limit)}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="min-h-11 w-full sm:w-32"
        >
          <option value="10">{t("leaderboard.topN", { n: 10 })}</option>
          <option value="20">{t("leaderboard.topN", { n: 20 })}</option>
          <option value="50">{t("leaderboard.topN", { n: 50 })}</option>
          <option value="100">{t("leaderboard.topN", { n: 100 })}</option>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : leaderboard?.length === 0 ? (
        <EmptyState
          type="no-results"
          title={leaderboardT.noDataYet}
          description={leaderboardT.noDataDescription}
        />
      ) : leaderboard ? (
        <div className="space-y-3">
          {leaderboard.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser = entry.user_id === user?.id;

            return (
              <Card
                key={entry.user_id}
                className={`transition-colors ${
                  isCurrentUser
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <CardContent className="flex items-center gap-3 py-3 sm:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                    {getRankIcon(rank)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-medium truncate ${isCurrentUser ? "text-primary" : ""}`}
                    >
                      {entry.name}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({leaderboardT.you})
                        </span>
                      )}
                    </p>
                    {entry.filiere && (
                      <p className="text-xs text-muted-foreground">
                        {entry.filiere}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-bold text-lg">
                      {entry.xp.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">XP</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {leaderboardT.howXPWorks}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="font-medium">{leaderboardT.studySessions}</p>
              <p className="text-sm text-muted-foreground">{t("leaderboard.xpPerHour", { xp: 10 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">{leaderboardT.flashcards}</p>
              <p className="text-sm text-muted-foreground">{t("leaderboard.xpPerReview", { xp: 2 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">{leaderboardT.quizCompletion}</p>
              <p className="text-sm text-muted-foreground">{t("leaderboard.xpPerQuiz", { xp: 20 })}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-medium">{leaderboardT.contributions}</p>
              <p className="text-sm text-muted-foreground">{t("leaderboard.xpPerUpload", { xp: 50 })}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
