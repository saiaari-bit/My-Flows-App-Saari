import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PUMP_REF,
  pendingDocument,
  pumpMatch,
  stubAsset360Service,
  uploadedDocument,
  type StubAsset360Service,
} from '../__mocks__/asset360Fixtures';
import { renderInWorkspace } from '../__mocks__/renderWorkspace';
import { SEARCH_DEBOUNCE_MS } from '../hooks/useAssetSearchViewModel';
import { Asset360Error } from '../services/asset360Service';

import { Asset360Workspace } from './Asset360Workspace';

const SELECTED_STATE = JSON.stringify({ selected: PUMP_REF });

describe('Asset360Workspace', () => {
  let service: StubAsset360Service;

  beforeEach(() => {
    service = stubAsset360Service();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('asks the analyst to pick an asset before loading anything', () => {
    renderInWorkspace(<Asset360Workspace />, { service });

    expect(screen.getByRole('heading', { name: 'Start with an asset' })).toBeInTheDocument();
    expect(service.getSignals).not.toHaveBeenCalled();
  });

  it('finds an asset by tag and opens its investigation', async () => {
    const user = userEvent.setup({ delay: null });
    renderInWorkspace(<Asset360Workspace />, { service });

    await user.click(screen.getByRole('button', { name: 'Search for an asset' }));
    await user.type(await screen.findByRole('combobox', { name: 'Asset name or tag' }), '23-HA');

    await waitFor(() => expect(service.searchAssets).toHaveBeenCalledWith('23-HA'), {
      timeout: SEARCH_DEBOUNCE_MS + 1000,
    });
    await user.click(await screen.findByText(pumpMatch.label));

    expect(await screen.findByRole('heading', { name: /Cooling water pump/ })).toBeInTheDocument();
    expect(service.getSignals).toHaveBeenCalledWith(PUMP_REF);
  });

  it('shows the asset identity and its tags', async () => {
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    expect(await screen.findByRole('heading', { name: /Cooling water pump/ })).toBeInTheDocument();
    expect(screen.getByText('SAP-4711')).toBeInTheDocument();
    expect(screen.getByText('rotating')).toBeInTheDocument();
    expect(screen.getByText('Main cooling water circulation pump')).toBeInTheDocument();
  });

  it('lists signals with their latest reading, unit, and type', async () => {
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    const grid = await screen.findByRole('table', { name: 'Time series related to this asset' });

    expect(within(grid).getByText('Discharge pressure')).toBeInTheDocument();
    expect(within(grid).getByText('4.2')).toBeInTheDocument();
    expect(within(grid).getByText('bar')).toBeInTheDocument();
    expect(within(grid).getByText('RUNNING')).toBeInTheDocument();
  });

  it('says "No data" for a signal that has never reported, rather than showing zero', async () => {
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    const grid = await screen.findByRole('table', { name: 'Time series related to this asset' });
    const row = within(grid).getByText('Bearing vibration').closest('[role="row"]');

    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('No data')).toBeInTheDocument();
  });

  it('warns about degraded enrichment without hiding the signal list', async () => {
    service.getSignals.mockResolvedValue({
      signals: [{ ...uploadedSignal() }],
      warnings: ['Latest readings could not be loaded. The signal list is still complete.'],
    });
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    expect(await screen.findByText(/Latest readings could not be loaded/)).toBeInTheDocument();
    expect(screen.getByText('Discharge pressure')).toBeInTheDocument();
  });

  it('explains an empty signal panel in the analyst\u2019s terms', async () => {
    service.getSignals.mockResolvedValue({ signals: [], warnings: [] });
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    expect(await screen.findByText('No time series linked to this asset')).toBeInTheDocument();
  });

  it('offers a retry when a panel fails, and keeps the other panels', async () => {
    service.getSignals.mockRejectedValueOnce(
      new Asset360Error('Could not load time series for this asset.')
    );
    const user = userEvent.setup({ delay: null });
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    expect(await screen.findByText('Could not load time series for this asset.')).toBeInTheDocument();
    // The asset header still rendered, so the failure stayed inside the panel.
    expect(screen.getByRole('heading', { name: /Cooling water pump/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Discharge pressure')).toBeInTheDocument();
  });

  it('never shows a raw SDK message to the analyst', async () => {
    service.getSignals.mockRejectedValue(new Error('Request failed with status code 500'));
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/500/)).not.toBeInTheDocument();
  });

  it('moves between panels and shows how much each one holds', async () => {
    const user = userEvent.setup({ delay: null });
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    const workOrdersTab = await screen.findByRole('tab', { name: /Work orders/ });
    await waitFor(() => expect(workOrdersTab).toHaveTextContent('2'));

    await user.click(workOrdersTab);

    expect(await screen.findByText('Replace mechanical seal')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
  });

  it('marks a planned time as planned so it is not read as recorded', async () => {
    const user = userEvent.setup({ delay: null });
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    await user.click(await screen.findByRole('tab', { name: /Work orders/ }));
    const grid = await screen.findByRole('table', { name: 'Work orders related to this asset' });

    expect(within(grid).getAllByText('(planned)').length).toBeGreaterThan(0);
  });

  it('opens an uploaded document in a new tab through the host', async () => {
    const user = userEvent.setup({ delay: null });
    const { harness } = renderInWorkspace(<Asset360Workspace />, {
      service,
      initialState: JSON.stringify({ selected: PUMP_REF, tab: 'documents' }),
    });

    const grid = await screen.findByRole('table', { name: 'Documents related to this asset' });
    await user.click(
      within(grid).getByRole('button', { name: `Open ${uploadedDocument.label} in a new tab` })
    );

    await waitFor(() =>
      expect(harness.openExternalUrl).toHaveBeenCalledWith('https://files.example.test/file-pid')
    );
  });

  it('disables opening a file whose content is not in CDF yet', async () => {
    renderInWorkspace(<Asset360Workspace />, {
      service,
      initialState: JSON.stringify({ selected: PUMP_REF, tab: 'documents' }),
    });

    const grid = await screen.findByRole('table', { name: 'Documents related to this asset' });

    expect(within(grid).getByRole('button', { name: `Cannot open ${pendingDocument.label}` })).toBeDisabled();
    expect(within(grid).getByText('Not uploaded')).toBeInTheDocument();
  });

  it('changes the chart window and requeries only the chart', async () => {
    const user = userEvent.setup({ delay: null });
    renderInWorkspace(<Asset360Workspace />, { service, initialState: SELECTED_STATE });

    await waitFor(() => expect(service.getChartSeries).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('tab', { name: 'Last 30 days' }));

    await waitFor(() => expect(service.getChartSeries).toHaveBeenCalledTimes(2));
    expect(service.getSignals).toHaveBeenCalledTimes(1);
    expect(service.getChartSeries.mock.calls[1]?.[1]?.granularity).toBe('6h');
  });

  it('restores the panel and window from a shared link', async () => {
    renderInWorkspace(<Asset360Workspace />, {
      service,
      initialState: JSON.stringify({ selected: PUMP_REF, tab: 'documents', window: '7d' }),
    });

    expect(
      await screen.findByRole('table', { name: 'Documents related to this asset' })
    ).toBeInTheDocument();
    await waitFor(() => expect(service.getChartSeries.mock.calls[0]?.[1]?.granularity).toBe('1h'));
  });
});

function uploadedSignal() {
  return {
    ref: { space: 'test-instances', externalId: 'ts-pressure' },
    label: 'Discharge pressure',
    name: 'Discharge pressure',
    kind: 'numeric' as const,
    unit: 'bar',
  };
}
