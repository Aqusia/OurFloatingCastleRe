import type { Request, Response, NextFunction } from "express";
import type { AuthPayload, AuthUser, CharacterProfile, LoginPayload, RegisterPayload } from "../../shared/events";
import {
  createSession,
  getCharacterByUserId,
  getSession,
  getUserById,
  getFactionState,
  loginUser,
  registerUser
} from "./persistence/localStore";

export async function register(payload: RegisterPayload): Promise<AuthPayload> {
  const result = await registerUser(payload);
  const token = await createSession(result.user.id);
  return {
    token,
    user: result.user,
    character: result.character
  };
}

export async function login(payload: LoginPayload): Promise<AuthPayload> {
  const result = await loginUser(payload.email, payload.password);
  const token = await createSession(result.user.id);
  return {
    token,
    user: result.user,
    character: result.character
  };
}

export async function authenticateToken(token: string) {
  const session = await getSession(token);
  if (!session) {
    return null;
  }

  const [user, character] = await Promise.all([
    getUserById(session.userId),
    getCharacterByUserId(session.userId)
  ]);

  if (!user || !character) {
    return null;
  }

  return {
    user,
    character
  };
}

export type AuthedRequest = Request & {
  auth?: {
    user: AuthUser;
    character: CharacterProfile;
    token: string;
  };
};

export function requireAuth() {
  return async (request: AuthedRequest, response: Response, next: NextFunction) => {
    const header = request.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!token) {
      response.status(401).json({ error: "Missing auth token" });
      return;
    }

    const auth = await authenticateToken(token);
    if (!auth) {
      response.status(401).json({ error: "Invalid session" });
      return;
    }

    request.auth = {
      ...auth,
      token
    };
    next();
  };
}

export function requireRole(role: AuthUser["role"]) {
  return async (request: AuthedRequest, response: Response, next: NextFunction) => {
    const handler = requireAuth();
    await handler(request, response, async () => {
      if (request.auth?.user.role !== role) {
        response.status(403).json({ error: "權限不足。" });
        return;
      }
      next();
    });
  };
}

export function requireFactionLeaderOrAdmin() {
  return async (request: AuthedRequest, response: Response, next: NextFunction) => {
    const handler = requireAuth();
    await handler(request, response, async () => {
      if (!request.auth) {
        response.status(401).json({ error: "Missing auth token" });
        return;
      }
      if (request.auth.user.role === "admin") {
        next();
        return;
      }

      const factionState = await getFactionState(request.auth.user.id);
      if (!factionState.isLeader) {
        response.status(403).json({ error: "只有陣營領袖可以執行這個操作。" });
        return;
      }
      next();
    });
  };
}
