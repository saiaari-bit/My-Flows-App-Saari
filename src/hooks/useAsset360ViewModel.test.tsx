import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  completedWorkOrder,
  PUMP_REF,
  pressureChartSeries,
  pressureSignal,
  pumpSummary,
  signalsResult,
  stubAsset360Service,
  uploadedDocument,
  type StubAsset360Service,
} from '../__mocks__/asset360Fixtures';
import { renderWorkspaceHook } from '../__mocks__/renderWorkspace';
import { Asset360Error } from '../services/asset360Service';

import { useAsset360ViewModel } from './useAsset360ViewModel';

const SELECTED_STATE = JSON.stringify({ selected: PUMP_REF });

describe(useAsset360ViewModel.name, () => {
  let service: StubAsset360Service;

  beforeEach(() => {
    service = stubAsset360Service();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('loads nothing until an asset is selected', () => {
    const { result } = renderWorkspaceHook(useAsset360ViewModel, { service });

    expect(result.current.selected).toBeNull();
    expect(result.current.asset.isLoading).toBe(false);
    expect(service.getSignals).not.toHaveBeenCalled();
  });

  it('reports loading while the panels are in flight', () => {
    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    expect(result.current.asset.isLoading).toBe(true);
    expect(result.current.signals.isLoading).toBe(true);
    expect(result.current.workOrders.isLoading).toBe(true);
    expect(result.current.documents.isLoading).toBe(true);
  });

  it('loads the asset and all three panels for the selected asset', async () => {
    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.signals.isLoading).toBe(false));

    expect(result.current.asset.data).toEqual(pumpSummary);
    expect(result.current.signals.data).toEqual(signalsResult);
    expect(result.current.workOrders.data?.[0]).toEqual(completedWorkOrder);
    expect(result.current.documents.data?.[0]).toEqual(uploadedDocument);
    expect(service.getSignals).toHaveBeenCalledWith(PUMP_REF);
  });

  it('charts only the numeric signals that came back', async () => {
    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.chart.data).toEqual([pressureChartSeries]));

    const [charted] = service.getChartSeries.mock.calls[0] ?? [];
    expect(charted?.map((signal) => signal.kind)).toEqual(['numeric', 'numeric']);
  });

  it('does not request a chart when the asset has no numeric signals', async () => {
    service.getSignals.mockResolvedValue({ signals: [], warnings: [] });

    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.signals.isLoading).toBe(false));

    expect(service.getChartSeries).not.toHaveBeenCalled();
  });

  it('surfaces a displayable message when a panel fails', async () => {
    service.getWorkOrders.mockRejectedValue(new Asset360Error('Could not load work orders for this asset.'));

    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() =>
      expect(result.current.workOrders.errorMessage).toBe('Could not load work orders for this asset.')
    );
  });

  it('hides the detail of an unexpected error behind generic copy', async () => {
    service.getDocuments.mockRejectedValue(new Error('Request failed with status 500 at /api/v1/…'));

    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.documents.errorMessage).toBeDefined());
    expect(result.current.documents.errorMessage).not.toContain('500');
  });

  it('keeps the other panels working when one fails', async () => {
    service.getDocuments.mockRejectedValue(new Asset360Error('Could not load documents for this asset.'));

    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.documents.errorMessage).toBeDefined());

    expect(result.current.signals.data).toEqual(signalsResult);
    expect(result.current.workOrders.data).toHaveLength(2);
  });

  it('refetches a failed panel on retry', async () => {
    service.getWorkOrders.mockRejectedValueOnce(new Asset360Error('Could not load work orders.'));

    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.workOrders.errorMessage).toBeDefined());
    await act(async () => {
      result.current.workOrders.retry();
    });

    await waitFor(() => expect(result.current.workOrders.data).toHaveLength(2));
  });

  it('shows no data from the previous asset after switching selection', async () => {
    const otherRef = { space: 'test-instances', externalId: '23-HA-0001' };
    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.workOrders.data).toHaveLength(2));

    service.getWorkOrders.mockResolvedValue([]);
    service.getSignals.mockResolvedValue({ signals: [pressureSignal], warnings: [] });
    act(() => result.current.setTab('workOrders'));

    const { result: switched } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: JSON.stringify({ selected: otherRef }),
    });

    await waitFor(() => expect(switched.current.workOrders.isLoading).toBe(false));
    expect(switched.current.workOrders.data).toEqual([]);
    expect(service.getWorkOrders).toHaveBeenLastCalledWith(otherRef);
  });

  it('opens a document through the host and reports which one is opening', async () => {
    const { result, harness } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.documents.data).toHaveLength(2));
    await act(async () => {
      result.current.openDocument(uploadedDocument);
    });

    expect(service.getDocumentDownloadUrl).toHaveBeenCalledWith(uploadedDocument.ref);
    expect(harness.openExternalUrl).toHaveBeenCalledWith('https://files.example.test/file-pid');
    expect(result.current.openingDocumentKey).toBeUndefined();
  });

  it('reports a displayable message when opening a document fails', async () => {
    service.getDocumentDownloadUrl.mockRejectedValue(new Asset360Error('Could not open this document.'));

    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.documents.data).toHaveLength(2));
    await act(async () => {
      result.current.openDocument(uploadedDocument);
    });

    await waitFor(() =>
      expect(result.current.openDocumentErrorMessage).toBe('Could not open this document.')
    );
  });

  it('exposes the resolved time window and refetches the chart when it changes', async () => {
    const { result } = renderWorkspaceHook(useAsset360ViewModel, {
      service,
      initialState: SELECTED_STATE,
    });

    await waitFor(() => expect(result.current.chart.data).toBeDefined());
    expect(result.current.timeWindow.granularity).toBe('5m');

    act(() => result.current.setWindow('30d'));

    await waitFor(() => expect(result.current.timeWindow.granularity).toBe('6h'));
    await waitFor(() => expect(service.getChartSeries).toHaveBeenCalledTimes(2));
  });
});
