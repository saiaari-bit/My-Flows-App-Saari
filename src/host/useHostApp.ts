import { useContext } from 'react';

import type { HostAppContextValue } from './HostAppContext';
import { HostAppContext } from './HostAppContext';

/**
 * Access to the Fusion host connection.
 *
 * Components and view models depend on this rather than importing
 * `connectToHostApp` directly, so the host is injectable in tests
 * (AGENTS.md §3).
 */
export function useHostApp(): HostAppContextValue {
  return useContext(HostAppContext);
}
