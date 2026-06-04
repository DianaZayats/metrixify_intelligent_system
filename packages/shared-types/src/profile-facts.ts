import type { ProfileFactReliability } from './profile-fact-reliability.js';

export type ProfileFactListItem = {
  id: string;
  key: string;
  valueText: string;
  reliability: ProfileFactReliability;
  factType:
    | 'work'
    | 'health_context'
    | 'routine'
    | 'preference'
    | 'habit'
    | 'goal'
    | 'constraint'
    | 'personal_context';
  stability: 'stable' | 'evolving' | 'temporary';
  status: 'active' | 'archived' | 'outdated';
  confidence: number | null;
  evidenceCount: number;
  firstSeenEntryId: string | null;
  lastSeenEntryId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProfileFactsListResponse = {
  items: ProfileFactListItem[];
};

export type UpdateProfileFactPayload = {
  valueText?: string;
  factType?: ProfileFactListItem['factType'];
};
