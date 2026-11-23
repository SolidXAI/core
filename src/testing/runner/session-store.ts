import type { StorageState } from "../adapters/ui/playwright-adapter";
import type { SessionStorageByOrigin } from "../contracts/testing-metadata.types";

export interface SessionKey {
  applicationKey: string;
  environmentKey: string;
  setupId: string;
  setupHash: string;
}

export interface SetupState {
  /** ui and mixed setups only. */
  storageState?: StorageState;
  /** ui and mixed setups only. */
  sessionStorage?: SessionStorageByOrigin;
  /** Own exports merged over the parent's. */
  exports: Record<string, unknown>;
}

export interface SessionStore {
  get(key: SessionKey): SetupState | undefined;
  set(key: SessionKey, state: SetupState): void;
  delete(key: SessionKey): void;
}

/** v1: memory only, discarded when the run ends. Nothing is written to disk. */
export class InMemorySessionStore implements SessionStore {
  private readonly states = new Map<string, SetupState>();

  get(key: SessionKey): SetupState | undefined {
    return this.states.get(storeKey(key));
  }

  set(key: SessionKey, state: SetupState): void {
    this.states.set(storeKey(key), state);
  }

  delete(key: SessionKey): void {
    this.states.delete(storeKey(key));
  }
}

function storeKey(key: SessionKey): string {
  const { applicationKey, environmentKey, setupId, setupHash } = key;
  return JSON.stringify([applicationKey, environmentKey, setupId, setupHash]);
}
