import { describe, expect, it, vi } from 'vitest';

import { createCdfOperationsService } from './CdfOperationsService';
import type { CdfHttp } from './operationsService';

describe('createCdfOperationsService', () => {
  it('lists running workflow executions with a status filter', async () => {
    const post = vi.fn(async (path: string) => {
      if (path.includes('workflows/executions/list')) {
        return {
          data: {
            items: [
              {
                id: 'ex-1',
                workflowExternalId: 'wf-cnt',
                version: '1',
                status: 'RUNNING',
                createdTime: 1000,
                startTime: 1000,
              },
            ],
          },
        };
      }
      throw new Error(`unexpected post ${path}`);
    });
    const get = vi.fn(async (path: string) => {
      if (path.includes('workflows/executions/ex-1')) {
        return { data: { executedTasks: [] } };
      }
      if (path.endsWith('/functions')) {
        return { data: { items: [] } };
      }
      if (path.endsWith('/transformations')) {
        return { data: { items: [] } };
      }
      return { data: { items: [] } };
    });
    const http: CdfHttp = { project: 'celanse-dev', post, get };
    const service = createCdfOperationsService(http);
    const snapshot = await service.loadWindow(50_000);
    expect(post).toHaveBeenCalled();
    const runningCall = post.mock.calls.find((call) => {
      const body = call[1]?.data;
      return typeof body === 'object' && body !== null && 'filter' in body;
    });
    expect(runningCall).toBeDefined();
    expect(snapshot.executions.some((execution) => execution.id === 'ex-1')).toBe(true);
  });

  it('records an error when workflows list fails', async () => {
    const http: CdfHttp = {
      project: 'celanse-dev',
      post: vi.fn(async () => {
        throw new Error('403 Forbidden');
      }),
      get: vi.fn(async (path: string) => {
        if (path.endsWith('/functions') || path.endsWith('/transformations')) {
          return { data: { items: [] } };
        }
        return { data: { items: [] } };
      }),
    };
    const service = createCdfOperationsService(http);
    const snapshot = await service.loadWindow(50_000);
    expect(snapshot.sourceErrors.some((message) => message.includes('403'))).toBe(true);
  });
});
