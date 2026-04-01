export type UserRole = "STUDENT" | "TEACHER" | "ADMIN" | "SUPERADMIN";

export type StudentLevel = "L1" | "L2" | "L3" | "M1" | "M2" | "Doctorat";

export type OTPPurpose =
  | "ACCOUNT_ACTIVATION"
  | "TEACHER_ONBOARDING"
  | "PASSWORD_RESET";

export type ContributionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type PipelineStatus = "QUEUED" | "PROCESSING" | "INDEXED" | "FAILED";

export type CourseStatus = "PROCESSING" | "INDEXED" | "FAILED";

export type ReviewRating = "AGAIN" | "HARD" | "GOOD" | "EASY";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  username?: string;
  role: UserRole;
  establishment_id: string | null;
  is_active: boolean;
  is_verified: boolean;
  onboarding_completed?: boolean;
  verified_at: string | null;
  filiere: string | null;
  niveau: StudentLevel | null;
  level?: StudentLevel | null;
  created_at: string;
  last_login_at?: string;
}

export interface TeacherProfile {
  id: string;
  user_id: string;
  department_id: string | null;
  specialization: string | null;
  modules: string | null;
  invite_token: string | null;
  invite_expires_at: string | null;
}

export interface Department {
  id: string;
  name: string;
  establishment_id: string;
  created_at: string;
}

export interface Establishment {
  id: string;
  name: string;
  domain: string;
  status?: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
  role: "STUDENT" | "TEACHER";
  filiere?: string;
  niveau?: StudentLevel;
  level?: StudentLevel; // Alias for niveau for backward compatibility
}

export interface VerifyOTPRequest {
  email: string;
  code?: string;
  otp_code?: string;
  purpose?: OTPPurpose;
}

export interface RequestOTPRequest {
  email: string;
  purpose?: OTPPurpose;
}

export interface ResetPasswordRequest {
  email: string;
  code?: string;
  otp_code?: string;
  new_password?: string;
  password?: string;
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  department_id?: string;
  filiere: string | null;
  niveau: StudentLevel | null;
  level?: StudentLevel | null; // Alias for niveau
  type?: string;
  course_type?: string;
  language?: string | null;
  annee?: string | number;
  academic_year?: string | null;
  current_version_id?: string;
  uploader_id?: string;
  university_id?: string;
  is_deleted?: boolean;
  is_official?: boolean;
  tags?: string[];
  created_at: string;
}

export interface CourseVersion {
  id: string;
  course_id: string;
  version_number: number;
  storage_path: string;
  file_url?: string;
  file_size_bytes?: number;
  mime_type?: string;
  sha256_hash?: string;
  ocr_text?: string | null;
  language?: string | null;
  pipeline_status: CourseStatus;
  uploaded_at: string;
  uploader_id?: string;
  quality_score?: number | null;
}

export interface CourseWithVersion extends Course {
  current_version?: CourseVersion;
}

export interface CourseStats {
  version_count: number;
  contribution_count: number;
  approved_contribution_count: number;
  learner_count: number;
  generated_assets_count: number;
  estimated_read_minutes: number;
  last_updated_at: string | null;
}

export interface DashboardProgress {
  overall_completion_percentage: number;
  active_streak_days: number;
  today_study_minutes?: number;
}

export interface AIGoal {
  id: string;
  description: string;
  is_completed: boolean;
  priority?: number;
}

export interface CourseRecommendation {
  course_id: string;
  title: string;
  progress_percentage: number;
  thumbnail_url?: string;
}

export interface WeakTopic {
  topic_name: string;
  accuracy_percentage: number;
  suggested_action: string;
}

export interface SuggestedFlashcardDeck {
  deck_id: string;
  title: string;
  due_cards_count: number;
}

export interface SmartOverviewResponse {
  greeting: string;
  progress: DashboardProgress;
  daily_goals: AIGoal[];
  recommended_courses: CourseRecommendation[];
  weak_topics: WeakTopic[];
  suggested_flashcards: SuggestedFlashcardDeck[];
}

export interface CourseProgressDetail {
  course_id: string;
  title: string;
  completion_percentage: number;
  time_spent_hours: number;
}

export interface LearningEfficiency {
  focus_score: number;
  xp_per_hour: number;
  trend: "improving" | "declining" | "stable";
}

export interface KnowledgeRetention {
  retention_score: number;
  decay_warning: boolean;
  optimal_review_window: string;
}

export interface AIForecast {
  target_course: string;
  predicted_completion_date: string;
  confidence_interval: string;
}

export interface ActionableInsight {
  insight_text: string;
  action_type: "REVIEW_FLASHCARDS" | "TAKE_QUIZ" | "CONTINUE_COURSE" | "NONE";
  action_payload: string;
}

export interface AdvancedAnalyticsResponse {
  course_progress: CourseProgressDetail[];
  efficiency: LearningEfficiency;
  retention: KnowledgeRetention;
  forecasts: AIForecast[];
  insights: ActionableInsight[];
}

export interface SearchResultItem {
  document_version_id: string;
  course_id?: string;
  title: string;
  teacher_name: string | null;
  is_official: boolean;
  quality_score: number;
  snippet: string;
  tags: string[];
  filiere: string | null;
  niveau?: string | null;
  rrf_score: number;
  source_page?: number;
}

export interface SearchParams {
  q?: string;
  filiere?: string;
  niveau?: string;
  type?: string;
  annee?: string | number;
  langue?: string;
  is_official?: boolean;
  page?: number;
  limit?: number;
}

export interface AutocompleteResult {
  title: string;
  course_id: string;
  type: string;
}

export interface Contribution {
  id: string;
  title: string;
  description: string | null;
  uploader_id: string;
  course_id?: string;
  s3_key?: string;
  filiere: string;
  status: ContributionStatus;
  created_at: string;
  updated_at: string | null;
  reviewed_by?: string | null;
  review_note?: string | null;
}

export interface ContributionQueryResponse {
  items: Contribution[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface DocumentVersion {
  id: string;
  version_number: number;
  storage_path: string;
  file_url?: string;
  file_size_bytes: number;
  mime_type: string;
  sha256_hash: string;
  ocr_text: string | null;
  language: string | null;
  pipeline_status: PipelineStatus;
  uploaded_at: string;
  contribution_id: string;
  quality_score: number | null;
}

export interface FlashcardDeck {
  id: string;
  document_version_id: string;
  title: string;
  card_count: number;
  share_token: string | null;
  created_at: string;
  mastery_percentage?: number;
  due_cards_count?: number;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  repetitions: number;
  ease_factor: number;
  interval: number;
  next_review_at: string;
}

export interface StudyGenerationResponse {
  job_id: string;
  status: string;
}

export interface ReviewCardResponse {
  id: string;
  next_review_at: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
}

export interface FlashcardDeckDetail {
  id: string;
  title: string;
  card_count: number;
  share_token: string | null;
  cards: Flashcard[];
}

export interface QuizSession {
  id: string;
  score: number | null;
  total_questions: number;
  is_completed: boolean;
  created_at: string;
  submitted_at: string | null;
}

export interface QuizQuestion {
  id: string;
  question: string;
  question_type: string;
  options: string[];
  source_page?: number | null;
}

export interface QuizDetail {
  id: string;
  total_questions: number;
  time_limit_minutes: number;
  questions: QuizQuestion[];
}

export interface QuizSubmitRequest {
  answers: Record<string, string>;
}

export interface QuizSubmitResponse {
  score: number;
  results: Array<{
    question_id: string;
    correct_answer: string;
    explanation: string | null;
    is_correct: boolean;
    source_page?: number | null;
  }>;
}

export interface QuizHistoryItem {
  id: string;
  score: number;
  submitted_at: string;
  total_questions: number;
}

export interface Summary {
  id: string;
  format: string;
  target_lang: string;
  content: string;
  created_at: string;
}

export interface Mindmap {
  id: string;
  title: string;
  target_lang: string;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  created_at: string;
}

export interface MindmapNode extends Record<string, unknown> {}

export interface MindmapEdge extends Record<string, unknown> {}

export interface GamificationProfile {
  user_id: string;
  total_xp: number;
  level: number;
  next_level_xp?: number;
  xp_to_next_level?: number;
  badges: Badge[];
}

export interface Badge {
  id: string;
  slug?: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  awarded_at?: string;
  xp_threshold?: number;
  condition?: Record<string, unknown>;
}

export interface LeaderboardEntry {
  user_id: string;
  name: string;
  username?: string;
  filiere: string | null;
  xp: number;
  level?: number;
  avatar_url?: string;
  is_anonymous?: boolean;
}

export interface XPBreakdown {
  category: string;
  xp: number;
  percentage: number;
}

export interface UserXP {
  total_xp: number;
  level: number;
  streak_days: number;
  breakdown: XPBreakdown[];
}

export interface XPTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: string;
  description: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}

export interface RAGSession {
  id: string;
  course_id: string;
  message_count: number;
  created_at: string;
}

export interface RAGMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  sources: Array<{
    course_id: string;
    title: string;
    page: number;
  }>;
}

export interface RAGStreamEvent {
  type: "token" | "sources" | "done" | "error";
  content?: string;
  sources?: Array<{
    course_id: string;
    title: string;
    page: number;
  }>;
  error?: string;
}

export interface XRayMetadata {
  type: "xray_metadata";
  source_page: number;
  chunk_text: string;
}

export interface ForumPost {
  id: string;
  course_id: string;
  author_id: string;
  title: string;
  content: Record<string, unknown>;
  status: string;
  reply_count: number;
  score: number;
  created_at: string;
  updated_at: string | null;
}

export interface ForumReply {
  id: string;
  post_id: string;
  author_id: string;
  content: Record<string, unknown>;
  is_pinned: boolean;
  created_at: string;
}

export interface Vote {
  id: string;
  user_id: string;
  target_type: "post" | "reply";
  target_id: string;
  value: 1 | -1;
}

export interface Report {
  id: string;
  type?: string;
  severity?: string | null;
  status?: "PENDING" | "RESOLVED";
  screenshot_url?: string | null;
  title: string;
  description: string;
  is_resolved: boolean;
  created_at: string;
}

export interface Annotation {
  id: string;
  user_id: string;
  doc_version_id: string;
  page_number: number;
  x_percent: number;
  y_percent: number;
  width_percent?: number;
  height_percent?: number;
  content: string;
  color?: string;
  created_at: string;
}

export interface TeacherAnalytics {
  total_courses: number;
  total_uploads: number;
  approved_uploads: number;
  pending_uploads: number;
  rejected_uploads: number;
  recent_uploads_7d: number;
  top_courses: Array<{
    course_id: string;
    title: string;
    uploads: number;
    approved_uploads: number;
    last_submission_at: string | null;
  }>;
}

export interface CourseAnalytics {
  course_id: string;
  title: string;
  views_per_week: Array<{ week: string; views: number }>;
  quiz_scores_distribution: Array<{ range: string; count: number }>;
  top_questions: Array<{ question: string; times_asked: number }>;
}

export interface AdminDashboard {
  total_users: number;
  total_courses: number;
  total_contributions: number;
  pending_contributions: number;
  total_reports: number;
  pending_reports: number;
  users_by_role: Record<string, number>;
  contributions_by_status: Record<string, number>;
}

export interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  role: UserRole;
  filiere: string | null;
  level_label?: StudentLevel | null;
  xp: number;
  level: number;
  establishment_name: string | null;
  created_at: string;
  stats: {
    badges_count: number;
    contributions_count: number;
    approved_contributions_count: number;
    forum_posts_count: number;
    study_assets_count: number;
  };
  badges: Badge[];
  recent_activity: Array<{
    id: string;
    type: "CONTRIBUTION" | "FORUM_POST" | "XP";
    title: string;
    description: string;
    created_at: string;
  }>;
}

export interface ActivityLogItem {
  id: string;
  activity_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  field?: string;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}

export interface ApiError {
  detail?: string | ApiErrorResponse;
  status_code?: number;
}

export interface UploadResponse {
  message: string;
  course_id: string;
  version_id: string;
  task_id?: string;
}

export interface GenerationStatus {
  job_id: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  progress?: number;
  result?: unknown;
  error?: string;
}

export interface StudyGroup {
  id: string;
  name: string;
  module: string;
  module_id?: string;
  description?: string;
  owner_id: string;
  owner_name?: string;
  member_count: number;
  max_members: number;
  is_public: boolean;
  invite_code?: string;
  created_at: string;
  last_active?: string;
}

export interface StudyGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  user_name?: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface SharedNote {
  id: string;
  group_id: string;
  user_id: string;
  user_name?: string;
  title: string;
  content: string;
  updated_at: string;
  is_pinned: boolean;
}

export interface GroupChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  user_name?: string;
  content: string;
  created_at: string;
  is_system?: boolean;
}

export interface LiveSession {
  id: string;
  title: string;
  description?: string;
  course_id?: string;
  host_id: string;
  host_name?: string;
  status: "scheduled" | "live" | "ended";
  scheduled_at?: string;
  started_at?: string;
  ended_at?: string;
  max_participants?: number;
  participant_count?: number;
  recording_url?: string;
}

export interface LiveSessionParticipant {
  id: string;
  session_id: string;
  user_id: string;
  user_name?: string;
  joined_at: string;
  is_presenter?: boolean;
}
