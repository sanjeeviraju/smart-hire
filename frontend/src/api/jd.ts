import { api } from './axios';
import type { JobDescription, JobHiringStatus } from '../types';

export type CreateJDPayload = {
  title: string;
  department: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  min_experience_years: number;
  max_experience_years: number | null;
  education_requirement: string;
  screening_threshold: number;
};

export type UpdateJDPayload = Partial<CreateJDPayload>;

export async function getJDs(): Promise<JobDescription[]> {
  const response = await api.get<JobDescription[]>('/jd/');
  return response.data;
}

export async function getJD(id: number): Promise<JobDescription> {
  const response = await api.get<JobDescription>(`/jd/${id}`);
  return response.data;
}

export async function createJD(data: CreateJDPayload): Promise<JobDescription> {
  const response = await api.post<JobDescription>('/jd/', data);
  return response.data;
}

export async function updateJD(id: number, data: UpdateJDPayload): Promise<JobDescription> {
  const response = await api.put<JobDescription>(`/jd/${id}`, data);
  return response.data;
}

export async function updateJDHiringStatus(id: number, hiring_status: JobHiringStatus): Promise<JobDescription> {
  const response = await api.patch<JobDescription>(`/jd/${id}/status`, { hiring_status });
  return response.data;
}

export async function deleteJD(id: number): Promise<{ message: string }> {
  const response = await api.delete<{ message: string }>(`/jd/${id}`);
  return response.data;
}

export async function uploadCandidateResumes(jdId: number, files: File[]): Promise<{ uploaded: number; failed: Array<{ file: string; error: string }> }> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const response = await api.post<{ uploaded: number; failed: Array<{ file: string; error: string }> }>(
    `/jd/${jdId}/candidates/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return response.data;
}

export async function runJDScreening(jdId: number): Promise<{ task_id: string; status: string }> {
  const response = await api.post<{ task_id: string; status: string }>(`/jd/${jdId}/screen`);
  return response.data;
}

export async function getJDScreeningStatus(
  jdId: number,
  taskId: string,
): Promise<{ task_id: string; state: string; meta?: { current?: number; total?: number } | null }> {
  const response = await api.get<{ task_id: string; state: string; meta?: { current?: number; total?: number } | null }>(
    `/jd/${jdId}/screen/${taskId}`,
  );
  return response.data;
}
