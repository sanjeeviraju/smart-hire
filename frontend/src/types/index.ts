export type CandidateStatus =
  | 'Uploaded'
  | 'Screened'
  | 'Shortlisted'
  | 'Interview Sent'
  | 'Interviewed'
  | 'Selected'
  | 'Rejected';

export interface DashboardStats {
  total_jds: number;
  total_candidates: number;
  screened: number;
  interviews_sent: number;
  interviewed: number;
  screened_candidates?: number;
  interviews_completed?: number;
}

export interface ResumeScore {
  id?: number;
  candidate_id?: number;
  jd_id?: number;
  skill_score: number;
  exp_score: number;
  edu_score: number;
  project_score: number;
  overall_score: number;
  passed: boolean;
  matched_skills: string[];
  missing_skills: string[];
  screened_at: string;
}

export interface InterviewSessionSummary {
  total_score?: number | null;
  recommendation?: string | null;
  completed_at?: string | null;
}

export type JobHiringStatus = 'active' | 'applications_closed' | 'hiring_ended';

export interface JobDescription {
  id: number;
  hr_user_id?: number;
  title: string;
  department: string | null;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  min_experience_years: number;
  max_experience_years: number | null;
  education_requirement: string | null;
  screening_threshold: number;
  is_active: boolean;
  hiring_status: JobHiringStatus;
  created_at: string;
  candidate_count?: number;
  pass_rate?: number;
}

export interface Candidate {
  id: number;
  jd_id?: number;
  job_description_id?: number;
  full_name: string;
  email: string;
  phone: string | null;
  skills?: string[];
  extracted_skills?: string[];
  years_of_experience?: number;
  extracted_experience_years?: number;
  education_level?: string | null;
  extracted_education?: string | null;
  status: CandidateStatus;
  selection?: 'selected' | 'rejected' | null;
  resume_url: string;
  resume_text?: string;
  interview_token_expires: string | null;
  created_at?: string;
  extracted_projects?: Array<Record<string, unknown>>;
  resume_score?: ResumeScore | null;
  interview_session?: InterviewSessionSummary | null;
}

export interface CandidateDetail {
  id: number;
  jd_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  skills: string[];
  years_of_experience: number;
  education_level: string | null;
  projects: string | null;
  resume_url: string | null;
  resume_filename: string | null;
  resume_text?: string | null;
  status: CandidateStatus;
  selection?: 'selected' | 'rejected' | null;
  created_at: string;
  updated_at: string;
  resume_score: ResumeScore | null;
}

export interface ScreeningResult {
  candidate_id: number;
  candidate_name: string;
  skill_score: number;
  exp_score: number;
  edu_score: number;
  project_score: number;
  overall_score: number;
  passed: boolean;
  matched_skills: string[];
  missing_skills: string[];
}

export interface ScreeningResponse {
  results: ScreeningResult[];
  total_screened: number;
  total_passed: number;
  total_failed: number;
}

export interface ScreeningConfig {
  skill_importance: number;
  exp_importance: number;
  edu_importance: number;
  project_importance: number;
  active_skills: string[];
  threshold: number;
}

export const DEFAULT_SCREENING_CONFIG: ScreeningConfig = {
  skill_importance: 4,
  exp_importance: 3,
  edu_importance: 2,
  project_importance: 2,
  active_skills: [],
  threshold: 65,
};

export interface CandidateListResponse {
  items: Candidate[];
  total: number;
}

export interface ActivityItem {
  id: number;
  type: 'jd_created' | 'jd_deleted' | 'resumes_uploaded' | 'screening_done' | 'interviews_sent' | 'shortlisted';
  message: string;
  created_at: string;
}

export type InterviewTokenValidation = {
  valid: boolean;
  message: string;
  candidate_name?: string;
  job_title?: string;
  expires_at?: string;
  started?: boolean;
  completed?: boolean;
};

export type InterviewEmailVerificationResponse = {
  verified: boolean;
  message: string;
};

export type InterviewQuestion = {
  question_index: number;
  question_text: string;
  question_type: string;
  total_questions: number;
};

export type InterviewStartResponse = {
  message: string;
  total_questions: number;
  time_limit_minutes: number;
  warning_limit: number;
};

export type InterviewAnswerSubmitResponse = {
  message: string;
  question_index: number;
  next_question_index: number | null;
  total_questions: number;
  interview_completed: boolean;
  answer_saved: boolean;
};

export type JDInterviewResultItem = {
  candidate_id: number;
  candidate_name: string;
  email: string;
  total_score: number | null;
  recommendation: string | null;
  status: CandidateStatus;
  completed_at: string | null;
};

export type JDInterviewResultsResponse = {
  jd_id: number;
  total: number;
  items: JDInterviewResultItem[];
};

export type InterviewTrackingItem = {
  candidate_id: number;
  candidate_name: string;
  email: string;
  overall_score: number | null;
  sent_at: string;
  opened_at: string | null;
  completed_at: string | null;
  is_used: boolean;
  status: 'Pending' | 'Opened' | 'Completed';
  can_force_resend: boolean;
};

export type InterviewAnswerDetail = {
  question_index: number;
  question_text: string;
  question_type: string;
  answer_text: string | null;
  audio_url?: string | null;
  video_url: string | null;
  score: number | null;
  ai_feedback:
    | {
        feedback_text?: string;
        strengths?: string[];
        improvements?: string[];
        communication_rating?: number;
        technical_accuracy_rating?: number;
      }
    | null;
  answered_at: string;
};

export type CandidateInterviewDetail = {
  candidate_id: number;
  candidate_name: string;
  email: string;
  job_title: string;
  status: CandidateStatus;
  interview_date: string | null;
  total_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  behavioral_score: number | null;
  confidence_score: number | null;
  recommendation: string | null;
  ai_analysis:
    | {
        key_strengths?: string[];
        key_concerns?: string[];
        cultural_fit_assessment?: string;
        narrative_analysis?: string;
        hire_recommendation_reason?: string;
        proctoring?: {
          warnings?: number;
          terminated?: boolean;
          events?: Array<{
            timestamp?: string;
            reasons?: string[];
          }>;
        };
      }
    | null;
  video_url: string | null;
  answers: InterviewAnswerDetail[];
};

export type ProctoringCheckResponse = {
  ok: boolean;
  suspicious: boolean;
  warning_count: number;
  warning_limit: number;
  terminate_interview: boolean;
  reasons: string[];
  message: string;
  face_count?: number | null;
  model?: string | null;
};
