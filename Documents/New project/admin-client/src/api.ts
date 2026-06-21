import type {
  AdminAdjustCharacterPayload,
  AdminConfigSection,
  AdminFillResourcesPayload,
  AdminGameConfigResponse,
  AdminGrantItemPayload,
  AdminGrantResourcesPayload,
  CharacterProfile,
  InventoryItem,
  LoginPayload
} from "../../shared/events";

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${apiBase}/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "請求失敗。" }))) as { error?: string };
    throw new Error(payload.error || "請求失敗。");
  }
  return (await response.json()) as T;
}

export function login(payload: LoginPayload) {
  return request<{
    token: string;
    user: { id: string; email: string; displayName: string; role: "player" | "admin" };
  }>("/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function getAdminGameConfig(token: string) {
  return request<AdminGameConfigResponse>("/admin/config", {}, token);
}

export function updateAdminGameConfigSection(token: string, section: AdminConfigSection, payload: unknown) {
  return request<AdminGameConfigResponse>(
    `/admin/config/${section}`,
    { method: "PUT", body: JSON.stringify(payload) },
    token
  );
}

export function resetAdminGameConfigSection(token: string, section: AdminConfigSection) {
  return request<AdminGameConfigResponse>(`/admin/config/${section}/reset`, { method: "POST" }, token);
}

export function adjustAdminCharacter(token: string, payload: AdminAdjustCharacterPayload) {
  return request<CharacterProfile>(
    "/admin/characters/adjust",
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

export function fillAdminResources(token: string, payload: AdminFillResourcesPayload) {
  return request<CharacterProfile>(
    "/admin/actions/fill-resources",
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}

export function grantAdminResources(token: string, payload: AdminGrantResourcesPayload) {
  return request<CharacterProfile>("/admin/resources/grant", { method: "POST", body: JSON.stringify(payload) }, token);
}

export function grantAdminItem(token: string, payload: AdminGrantItemPayload) {
  return request<{ character: CharacterProfile; item: InventoryItem }>(
    "/admin/items/grant",
    { method: "POST", body: JSON.stringify(payload) },
    token
  );
}
