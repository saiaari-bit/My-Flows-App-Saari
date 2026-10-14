import { act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { pumpMatch, stubAsset360Service, type StubAsset360Service } from '../__mocks__/asset360Fixtures';
import { renderWorkspaceHook } from '../__mocks__/renderWorkspace';
import { Asset360Error } from '../services/asset360Service';

import { SEARCH_DEBOUNCE_MS, useAssetSearchViewModel } from './useAssetSearchViewModel';

describe(useAssetSearchViewModel.name, () => {
  let service: StubAsset360Service;

  beforeEach(() => {
    service = stubAsset360Service();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle and does not search on an empty box', () => {
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    expect(result.current.status).toBe('idle');
    expect(service.searchAssets).not.toHaveBeenCalled();
  });

  it('does not search on whitespace alone', async () => {
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    act(() => result.current.setInputValue('   '));
    await advanceDebounce();

    expect(result.current.status).toBe('idle');
    expect(service.searchAssets).not.toHaveBeenCalled();
  });

  it('waits for the debounce before querying CDF', async () => {
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    act(() => result.current.setInputValue('23-HA'));
    expect(service.searchAssets).not.toHaveBeenCalled();

    await advanceDebounce();

    expect(service.searchAssets).toHaveBeenCalledWith('23-HA');
  });

  it('issues one request for a burst of keystrokes', async () => {
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    act(() => result.current.setInputValue('2'));
    act(() => result.current.setInputValue('23'));
    act(() => result.current.setInputValue('23-H'));
    await advanceDebounce();

    await waitFor(() => expect(service.searchAssets).toHaveBeenCalledTimes(1));
    expect(service.searchAssets).toHaveBeenCalledWith('23-H');
  });

  it('reports results once they arrive', async () => {
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    act(() => result.current.setInputValue('pump'));
    await advanceDebounce();

    await waitFor(() => expect(result.current.status).toBe('results'));
    expect(result.current.results).toEqual([pumpMatch]);
  });

  it('distinguishes no matches from an error', async () => {
    service.searchAssets.mockResolvedValue([]);
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    act(() => result.current.setInputValue('nothing'));
    await advanceDebounce();

    await waitFor(() => expect(result.current.status).toBe('empty'));
    expect(result.current.errorMessage).toBeUndefined();
  });

  it('reports a displayable error when the search fails', async () => {
    service.searchAssets.mockRejectedValue(new Asset360Error('Could not search for assets.'));
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    act(() => result.current.setInputValue('pump'));
    await advanceDebounce();

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Could not search for assets.');
  });

  it('stores the selection and shows its label in the box', async () => {
    const { result, harness } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    act(() => result.current.selectAsset(pumpMatch));

    expect(result.current.selected).toEqual(pumpMatch.ref);
    expect(result.current.inputValue).toBe(pumpMatch.label);
    expect(harness.hostApi.syncInternalState).toHaveBeenCalled();
  });

  it('seeds the box from host state so a shared link reopens the same search', () => {
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, {
      service,
      initialState: JSON.stringify({ query: '23-HA' }),
    });

    expect(result.current.inputValue).toBe('23-HA');
    expect(result.current.committedQuery).toBe('23-HA');
  });

  it('returns to idle when cleared', async () => {
    const { result } = renderWorkspaceHook(useAssetSearchViewModel, { service });

    act(() => result.current.setInputValue('pump'));
    await advanceDebounce();
    await waitFor(() => expect(result.current.status).toBe('results'));

    act(() => result.current.clear());

    expect(result.current.inputValue).toBe('');
    expect(result.current.status).toBe('idle');
  });
});

async function advanceDebounce(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
  });
}
