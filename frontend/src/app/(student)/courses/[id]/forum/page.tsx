"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, ThumbsUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { AtlasApiError, forumsApi } from "@/lib/api";

export default function ForumPage() {
  const params = useParams();
  const courseId = params.id as string;
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const postsQuery = useQuery({
    queryKey: ["forums", "posts", courseId],
    queryFn: () => forumsApi.listPosts({ course_id: courseId, limit: 20, offset: 0 }),
    enabled: Boolean(courseId),
  });

  const createPostMutation = useMutation({
    mutationFn: () =>
      forumsApi.createPost({
        course_id: courseId,
        title,
        content: { text: body },
      }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["forums", "posts", courseId] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: (postId: string) => forumsApi.vote(postId, 1),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forums", "posts", courseId] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discussion Forum</h1>
          <p className="text-muted-foreground">
            Ask questions and follow the live discussion for this course.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Start a New Discussion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Discussion title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="Describe your question or topic"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => createPostMutation.mutate()}
              disabled={!title.trim() || !body.trim() || createPostMutation.isPending}
            >
              Create Discussion
            </Button>
          </div>
          {createPostMutation.error ? (
            <p className="text-sm text-destructive">
              {(createPostMutation.error as AtlasApiError).message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Discussions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {postsQuery.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((key) => (
                <Skeleton key={key} className="h-24 w-full" />
              ))}
            </div>
          ) : postsQuery.data?.items.length ? (
            <div className="space-y-3">
              {postsQuery.data.items.map((post) => (
                <div key={post.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{post.title}</p>
                        <StatusChip status={post.status} />
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {typeof post.content?.text === "string"
                          ? post.content.text
                          : JSON.stringify(post.content)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>{post.reply_count} replies</span>
                        <span>Score {post.score.toFixed(2)}</span>
                        <span>{new Date(post.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => voteMutation.mutate(post.id)}
                      disabled={voteMutation.isPending}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Upvote
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              type="forum"
              title="No discussions yet"
              description="Create the first real discussion thread for this course."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
