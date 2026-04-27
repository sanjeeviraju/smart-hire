import { api } from './axios';
import type { ActivityItem, DashboardStats, InterviewTrackingItem } from '../types';

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await api.get<DashboardStats>('/dashboard/stats');
  return response.data;
}

export async function getDashboardActivity(): Promise<ActivityItem[]> {
  const response = await api.get<ActivityItem[]>('/dashboard/activity');
  return response.data;
}

export async function getActivity(): Promise<ActivityItem[]> {
  const response = await api.get<ActivityItem[]>('/dashboard/activity');
  return response.data;
}

export async function deleteActivity(id: number): Promise<void> {
  await api.delete(`/dashboard/activity/${id}`);
}

export async function getJDInterviewResults(jdId: number): Promise<InterviewTrackingItem[]> {
  const response = await api.get<InterviewTrackingItem[]>(`/jd/${jdId}/interview-results`);
  return response.data;
}
