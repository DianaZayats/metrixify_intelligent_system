import type {
  MetricDefinitionListItem,
  MetricObservationItem,
} from '@metrixify/shared-types';
import { apiFetch } from './client';

export async function fetchMetrics(): Promise<{ items: MetricDefinitionListItem[] }> {
  const response = await apiFetch('/api/metrics');
  if (!response.ok) {
    throw new Error(`Failed to load metrics (${response.status})`);
  }
  return response.json() as Promise<{ items: MetricDefinitionListItem[] }>;
}

export async function fetchMetricObservations(params?: {
  metricId?: string;
}): Promise<{ items: MetricObservationItem[] }> {
  const search = new URLSearchParams();
  if (params?.metricId) {
    search.set('metricId', params.metricId);
  }
  const query = search.toString();
  const response = await apiFetch(`/api/metrics/observations${query ? `?${query}` : ''}`);
  if (!response.ok) {
    throw new Error(`Failed to load observations (${response.status})`);
  }
  return response.json() as Promise<{ items: MetricObservationItem[] }>;
}

export async function fetchMetric(id: string): Promise<MetricDefinitionListItem> {
  const response = await apiFetch(`/api/metrics/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load metric (${response.status})`);
  }
  return response.json() as Promise<MetricDefinitionListItem>;
}

export type UpdateMetricPayload = {
  title?: string;
  description?: string | null;
  aliases?: string[];
  tags?: string[];
};

export async function updateMetric(
  id: string,
  payload: UpdateMetricPayload,
): Promise<MetricDefinitionListItem> {
  const response = await apiFetch(`/api/metrics/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to update metric (${response.status})`);
  }
  return response.json() as Promise<MetricDefinitionListItem>;
}

export async function archiveMetric(id: string): Promise<MetricDefinitionListItem> {
  const response = await apiFetch(`/api/metrics/${id}/archive`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to archive metric (${response.status})`);
  }
  return response.json() as Promise<MetricDefinitionListItem>;
}

export type UpdateObservationPayload = {
  valueNumber?: number | null;
  valueText?: string | null;
  valueBoolean?: boolean | null;
  observedAt?: string;
  evidenceText?: string | null;
  editedVia?: 'api' | 'telegram' | 'system';
};

export async function patchObservation(
  id: string,
  payload: UpdateObservationPayload,
): Promise<MetricObservationItem> {
  const response = await apiFetch(`/api/observations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Failed to update observation (${response.status})`);
  }
  return response.json() as Promise<MetricObservationItem>;
}

export async function deleteObservation(id: string): Promise<void> {
  const response = await apiFetch(`/api/observations/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editedVia: 'api' }),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete observation (${response.status})`);
  }
}
