import type { OperationsSnapshot } from '../domain/operationsTypes';

export type CdfHttp = {
  project: string;
  post: <T = unknown>(path: string, options?: { data?: unknown }) => Promise<{ data: T }>;
  get: <T = unknown>(path: string, options?: { params?: Record<string, unknown> }) => Promise<{
    data: T;
  }>;
};

export interface OperationsService {
  loadWindow(nowMs: number): Promise<OperationsSnapshot>;
}
