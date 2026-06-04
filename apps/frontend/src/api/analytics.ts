import type {
  CorrelationDetail,
  CorrelationsListResponse,
  DashboardResponse,
  RecalculateResponse,
} from '@metrixify/shared-types';
import { apiFetch } from './client';

export async function fetchDashboard(params?: {
  chartMetricId?: string;
}): Promise<DashboardResponse> {
  const search = new URLSearchParams();
  if (params?.chartMetricId) {
    search.set('chartMetricId', params.chartMetricId);
  }
  const query = search.toString();
  const response = await apiFetch(`/api/analytics/dashboard${query ? `?${query}` : ''}`);
  if (!response.ok) {
    throw new Error(`Failed to load dashboard (${response.status})`);
  }
  return response.json() as Promise<DashboardResponse>;
}

export async function recalculateAnalytics(): Promise<RecalculateResponse> {
  const response = await apiFetch('/api/analytics/recalculate', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Failed to recalculate analytics (${response.status})`);
  }
  return response.json() as Promise<RecalculateResponse>;
}

export async function fetchCorrelations(params?: {
  method?: string;
  lagDays?: number;
  minSample?: number;
}): Promise<CorrelationsListResponse> {
  const search = new URLSearchParams();
  if (params?.method) {
    search.set('method', params.method);
  }
  if (params?.lagDays !== undefined) {
    search.set('lagDays', String(params.lagDays));
  }
  if (params?.minSample !== undefined) {
    search.set('minSample', String(params.minSample));
  }
  const query = search.toString();
  const response = await apiFetch(`/api/analytics/correlations${query ? `?${query}` : ''}`);
  if (!response.ok) {
    throw new Error(`Failed to load correlations (${response.status})`);
  }
  return response.json() as Promise<CorrelationsListResponse>;
}

export async function fetchCorrelation(id: string): Promise<CorrelationDetail> {
  const response = await apiFetch(`/api/analytics/correlations/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load correlation (${response.status})`);
  }
  return response.json() as Promise<CorrelationDetail>;
}
