import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary } from './AppErrorBoundary';

function Exploding(): never {
  throw new Error('Kaboom from render');
}

function Working() {
  return <p>Application content</p>;
}

describe(AppErrorBoundary.name, () => {
  beforeEach(() => {
    // React logs every caught render error; silence it so the suite output
    // stays readable without hiding assertions.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <AppErrorBoundary deps={{ reload: vi.fn(), logError: vi.fn() }}>
        <Working />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Application content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the recovery screen when a child throws during render', () => {
    render(
      <AppErrorBoundary deps={{ reload: vi.fn(), logError: vi.fn() }}>
        <Exploding />
      </AppErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('replaces the failed content instead of leaving a blank page', () => {
    render(
      <AppErrorBoundary deps={{ reload: vi.fn(), logError: vi.fn() }}>
        <Working />
        <Exploding />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Application content')).not.toBeInTheDocument();
  });

  it('offers a reload action', () => {
    render(
      <AppErrorBoundary deps={{ reload: vi.fn(), logError: vi.fn() }}>
        <Exploding />
      </AppErrorBoundary>
    );

    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('performs a full page reload when the user activates the reload action', async () => {
    const reload = vi.fn();
    render(
      <AppErrorBoundary deps={{ reload, logError: vi.fn() }}>
        <Exploding />
      </AppErrorBoundary>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('surfaces the underlying error message for diagnosis', () => {
    render(
      <AppErrorBoundary deps={{ reload: vi.fn(), logError: vi.fn() }}>
        <Exploding />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Kaboom from render')).toBeInTheDocument();
  });

  it('reports the caught error to the injected logger', () => {
    const logError = vi.fn();
    render(
      <AppErrorBoundary deps={{ reload: vi.fn(), logError }}>
        <Exploding />
      </AppErrorBoundary>
    );

    expect(logError).toHaveBeenCalledTimes(1);
    const [error] = logError.mock.calls[0] ?? [];
    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ message: 'Kaboom from render' });
  });

  it('falls back to window.location.reload and console.error when no deps are provided', async () => {
    // Arrange
    const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => undefined);

    // Act
    render(
      <AppErrorBoundary>
        <Exploding />
      </AppErrorBoundary>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    // Assert
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      'Unhandled application error:',
      expect.any(Error),
      expect.anything()
    );
  });

  it('does not navigate or write host state from the fallback', async () => {
    const reload = vi.fn();
    const assign = vi.fn();
    vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined);
    vi.spyOn(window.location, 'assign').mockImplementation(assign);

    render(
      <AppErrorBoundary deps={{ reload, logError: vi.fn() }}>
        <Exploding />
      </AppErrorBoundary>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(window.history.pushState).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
