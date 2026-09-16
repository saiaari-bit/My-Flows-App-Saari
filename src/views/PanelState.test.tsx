import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { SectionState } from '../hooks/useAsset360ViewModel';

import { PanelBody } from './PanelState';

describe(PanelBody.name, () => {
  it('shows a loading placeholder while the panel is in flight', () => {
    renderPanel({ isLoading: true, data: undefined, errorMessage: undefined, retry: vi.fn() });

    expect(screen.getByRole('status', { name: 'Loading rows' })).toHaveAttribute('aria-busy', 'true');
  });

  it('prefers the error over the loading placeholder, so a failure is never hidden', () => {
    renderPanel({ isLoading: true, data: undefined, errorMessage: 'Could not load.', retry: vi.fn() });

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load.');
    expect(screen.queryByLabelText('Loading rows')).not.toBeInTheDocument();
  });

  it('retries through the state it was given', async () => {
    const retry = vi.fn();
    renderPanel({ isLoading: false, data: undefined, errorMessage: 'Could not load.', retry });

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledOnce();
  });

  it('explains an empty result instead of rendering an empty table', () => {
    renderPanel({ isLoading: false, data: [], errorMessage: undefined, retry: vi.fn() });

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('No rows came back for this asset.')).toBeInTheDocument();
  });

  it('renders the data once it is there', () => {
    renderPanel({ isLoading: false, data: ['one', 'two'], errorMessage: undefined, retry: vi.fn() });

    expect(screen.getByText('one, two')).toBeInTheDocument();
  });

  it('keeps showing the placeholder when loading finished without data', () => {
    renderPanel({ isLoading: false, data: undefined, errorMessage: undefined, retry: vi.fn() });

    expect(screen.getByLabelText('Loading rows')).toBeInTheDocument();
  });
});

function renderPanel(state: SectionState<string[]>) {
  return render(
    <PanelBody
      state={state}
      skeletonLabel="Loading rows"
      isEmpty={(rows) => rows.length === 0}
      emptyTitle="Nothing here"
      emptyDescription="No rows came back for this asset."
    >
      {(rows) => <p>{rows.join(', ')}</p>}
    </PanelBody>
  );
}
