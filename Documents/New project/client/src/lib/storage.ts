const tokenKey = "raid-game-token";

export function getStoredToken() {
  return localStorage.getItem(tokenKey) || "";
}

export function setStoredToken(token: string) {
  if (!token) {
    localStorage.removeItem(tokenKey);
    return;
  }

  localStorage.setItem(tokenKey, token);
}
