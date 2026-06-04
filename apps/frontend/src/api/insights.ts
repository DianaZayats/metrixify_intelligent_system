import type { GenerateInsightsResponse, InsightsListResponse, LatestInsightsResponse } from '@metrixify/shared-types';
import { apiFetch } from './client';

function appendLocaleParam(params: URLSearchParams): void {
  const storedLocale = localStorage.getItem('metrixify_locale');
  if (storedLocale === 'uk' || storedLocale === 'en') {
    params.set('locale', storedLocale);
  }
}

export async function fetchInsightsList(limit = 20): Promise<InsightsListResponse> {
  const params = new URLSearchParams({ limit: String(limit) });
  appendLocaleParam(params);
  const response = await apiFetch(`/api/insights?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load insights (${response.status})`);
  }
  return response.json() as Promise<InsightsListResponse>;
}

export async function fetchLatestInsights(): Promise<LatestInsightsResponse> {
  const params = new URLSearchParams();
  appendLocaleParam(params);
  const query = params.toString();
  const response = await apiFetch(`/api/insights/latest${query ? `?${query}` : ''}`);
  if (!response.ok) {
    throw new Error(`Failed to load insights (${response.status})`);
  }
  return response.json() as Promise<LatestInsightsResponse>;
}

export async function generateInsights(): Promise<GenerateInsightsResponse> {
  const params = new URLSearchParams();
  appendLocaleParam(params);
  const query = params.toString();
  const response = await apiFetch(`/api/insights/generate${query ? `?${query}` : ''}`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to generate insights (${response.status})`);
  }
  return response.json() as Promise<GenerateInsightsResponse>;
}
