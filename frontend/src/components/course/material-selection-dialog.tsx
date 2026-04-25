"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  FileText, 
  User as UserIcon, 
  Calendar, 
  ChevronRight, 
  FileType, 
  Clock,
  ExternalLink,
  GraduationCap
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCourseVersionsQuery } from "@/queries/courses";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { CourseVersion } from "@/types/api.types";

interface MaterialSelectionDialogProps {
  courseId: string | null;
  courseTitle?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Add metadata to CourseVersion type for this component
interface ExtendedCourseVersion extends CourseVersion {
  uploader_name?: string;
  course_type?: string;
  language?: string;
  title?: string;
  academic_year?: string;
}

export function MaterialSelectionDialog({ 
  courseId, 
  courseTitle, 
  isOpen, 
  onClose 
}: MaterialSelectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: versions, isLoading } = useCourseVersionsQuery(courseId || "");

  const filteredVersions = (versions as ExtendedCourseVersion[])?.filter(v => 
    v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.course_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.uploader_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden shadow-2xl border-none glass-dark">
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{courseTitle || "Select Course Material"}</DialogTitle>
              <DialogDescription className="text-xs">
                Browse all available PDFs, Lectures, and Exercises for this subject.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by title, type (TD, Lecture), or teacher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-background/50 border-muted-foreground/20"
            />
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 space-y-3">
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl border bg-muted/50 animate-pulse" />
              ))
            ) : filteredVersions?.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No materials found for this search.</p>
              </div>
            ) : (
              filteredVersions?.map((version) => (
                <Link
                  key={version.id}
                  href={`/courses/${courseId}?version=${version.id}`}
                  onClick={onClose}
                  className="group block"
                >
                  <div className="flex items-center gap-4 rounded-xl border bg-card/50 p-4 transition-all hover:bg-accent hover:border-primary/50 hover:shadow-md">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <FileType className="h-6 w-6" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm truncate">
                          {version.title || `Document Version ${version.version_number}`}
                        </h4>
                        <span className="shrink-0 rounded-full bg-secondary/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-secondary-foreground">
                          {version.course_type || "Lecture"}
                        </span>
                      </div>
                      
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          <span className="truncate max-w-[120px]">{version.uploader_name}</span>
                        </div>
                        {version.academic_year && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{version.academic_year}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDistanceToNow(new Date(version.uploaded_at))} ago</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileType className="h-3 w-3" />
                          <span>v{version.version_number}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
          <span>{filteredVersions?.length || 0} Materials Identified</span>
          <div className="flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            <span>Select to start learning</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
