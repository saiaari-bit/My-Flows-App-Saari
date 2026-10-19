import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ActivitiesPanel } from './ActivitiesPanel';

import type { ActivityServiceStub } from '@/__mocks__/activityService';
import {
  createActivityServiceStub,
  makeActivity,
} from '@/__mocks__/activityService';
import { createTestQueryClient } from '@/__mocks__/queryClient';
import { CdfServiceError } from '@/services/cdfError';
import {
  ActivityServiceContext,
  DEFAULT_ACTIVITY_SERVICE_DEPS,
} from '@/services/useActivityService';

const ASSET = { space: 'my-space', externalId: 'PUMP-001' };

describe(ActivitiesPanel.name, () => {
  let service: ActivityServiceStub;

  beforeEach(() => {
    service = createActivityServiceStub();
  });

  it('shows an independent loading state', () => {
    service.getAssetActivities.mockReturnValue(new Promise(() => undefined));

    renderPanel();

    expect(screen.getByText('Loading activities...')).toBeInTheDocument();
  });

  it('renders populated activities and verified timestamps', async () => {
    service.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', {
        name: 'Replace mechanical seal',
        description: 'Planned maintenance',
        scheduledStartTime: Date.parse('2026-03-01T08:00:00.000Z'),
        endTime: Date.parse('2026-03-01T16:00:00.000Z'),
      }),
    ]);

    renderPanel();

    expect(await screen.findByText('Replace mechanical seal')).toBeInTheDocument();
    expect(screen.getByText('WO-1')).toBeInTheDocument();
    expect(screen.getByText('Planned maintenance')).toBeInTheDocument();
    expect(screen.getByText('Scheduled start')).toBeInTheDocument();
    expect(screen.getByText('2026-03-01T08:00:00.000Z')).toBeInTheDocument();
    expect(screen.getByText('Actual end')).toBeInTheDocument();
  });

  it('renders an activity when every optional field is absent', async () => {
    service.getAssetActivities.mockResolvedValue([makeActivity('WO-EMPTY')]);

    renderPanel();

    expect(await screen.findByRole('heading', { name: 'WO-EMPTY' })).toBeInTheDocument();
    expect(screen.queryByText('Scheduled start')).not.toBeInTheDocument();
    expect(screen.queryByText('Actual start')).not.toBeInTheDocument();
  });

  it('shows an empty state when no activities are linked', async () => {
    renderPanel();

    expect(await screen.findByRole('heading', { name: 'No linked activities' })).toBeInTheDocument();
  });

  it('shows a classified error and retries when asked', async () => {
    service.getAssetActivities.mockRejectedValueOnce(
      new CdfServiceError('Forbidden', { kind: 'no-access', status: 403 })
    );
    renderPanel();
    expect(await screen.findByText('Could not load activities')).toBeInTheDocument();
    expect(screen.getByText(/do not have access to read linked activities/i)).toBeInTheDocument();

    service.getAssetActivities.mockResolvedValue([
      makeActivity('WO-1', { name: 'Replace mechanical seal' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Replace mechanical seal')).toBeInTheDocument();
  });

  function renderPanel() {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <ActivityServiceContext.Provider
          value={{
            ...DEFAULT_ACTIVITY_SERVICE_DEPS,
            useActivityService: () => service,
          }}
        >
          <ActivitiesPanel asset={ASSET} />
        </ActivityServiceContext.Provider>
      </QueryClientProvider>
    );
  }
});
