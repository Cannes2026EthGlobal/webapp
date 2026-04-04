export const REOWN_AUTH_STORAGE_KEY = "arc-counting/siwx-auth-token";
export const REOWN_NONCE_STORAGE_KEY = "arc-counting/siwx-nonce-token";

export function getStoredReownAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(REOWN_AUTH_STORAGE_KEY);
}

export function clearStoredReownAuthTokens() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(REOWN_AUTH_STORAGE_KEY);
  window.localStorage.removeItem(REOWN_NONCE_STORAGE_KEY);
}
