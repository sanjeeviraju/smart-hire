import { api } from './axios';
import type { Candidate, CandidateDetail, CandidateListResponse, ResumeScore, ScreeningConfig, ScreeningResponse } from '../types';

export type CandidateFilters = {
  min_score?: number;
  max_score?: number;
  skill?: string;
  passed_only?: boolean;
};

export async function getCandidates(jdId: number, filters: CandidateFilters = {}): Promise<Candidate[]> {
  const response = await api.get<CandidateListResponse>(`/jd/${jdId}/candidates`, {
    params: {
      min_score: filters.min_score,
      max_score: filters.max_score,
      skill: filters.skill || undefined,
      passed_only: filters.passed_only || undefined,
    },
  });
  return response.data.items;
}

export async function getCandidate(candidateId: number): Promise<CandidateDetail> {
  const response = await api.get<CandidateDetail>(`/candidates/${candidateId}`);
  return response.data;
}

export async function getCandidateScore(candidateId: number, jdId: number): Promise<ResumeScore> {
  const response = await api.get<ResumeScore>(`/candidates/${candidateId}/scores/${jdId}`);
  return response.data;
}

export async function runScreening(jdId: number, candidateIds: number[], config: ScreeningConfig): Promise<ScreeningResponse> {
  const response = await api.post<ScreeningResponse>(`/jd/${jdId}/screen`, {
    candidate_ids: candidateIds,
    skill_importance: config.skill_importance,
    exp_importance: config.exp_importance,
    edu_importance: config.edu_importance,
    project_importance: config.project_importance,
    active_skills: config.active_skills.length > 0 ? config.active_skills : null,
    threshold: config.threshold,
  });
  return response.data;
}

export async function shortlistCandidates(candidate_ids: number[]): Promise<void> {
  await api.post('/candidates/shortlist', { candidate_ids });
}

export async function bulkDeleteCandidates(candidate_ids: number[]): Promise<{ deleted: number }> {
  const response = await api.delete<{ deleted: number }>('/candidates/bulk', {
    data: { candidate_ids },
  });
  return response.data;
}

export async function sendInterviews(candidate_ids: number[], force_resend = false): Promise<{ sent: number; results: Array<{ candidate_id: number; success: boolean; token?: string | null; error?: string | null }> }> {
  const response = await api.post<{
    sent: number;
    results: Array<{ candidate_id: number; success: boolean; token?: string | null; error?: string | null }>;
  }>('/candidates/send-interviews', { candidate_ids, force_resend });
  return response.data;
}
