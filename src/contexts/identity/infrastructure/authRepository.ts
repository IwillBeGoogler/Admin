import { type ApiSchemas, http } from "@/shared/api";
import { dataEnvelope } from "@/shared/http";
import { type PermissionSet, permissionsFromRoles, type Role } from "../domain/permissions";
import {
  guardMeSchema,
  type LoginInput,
  type LoginResult,
  loginResultSchema,
  type Session,
  sessionSchema,
  type User,
  userSchema,
} from "../domain/session";

export interface CurrentAdmin {
  user: User;
  roles: Role[];
  permissions: PermissionSet;
}

type S = ApiSchemas["schemas"];

export const authRepository = {
  async login(input: LoginInput): Promise<LoginResult> {
    const body: S["loginInput"] = input;
    const r = await http("/auth/login", {
      method: "POST",
      body,
      schema: dataEnvelope(loginResultSchema),
      noRefresh: true,
    });
    return r.data;
  },

  async loginMfa(mfaToken: string, code: string): Promise<Session> {
    const body: S["mfaLoginInput"] = { mfa_token: mfaToken, code };
    const r = await http("/auth/login/2fa", {
      method: "POST",
      body,
      schema: dataEnvelope(sessionSchema),
      noRefresh: true,
    });
    return r.data;
  },

  async logout(): Promise<void> {
    try {
      await http("/auth/logout", { method: "POST", noRefresh: true });
    } catch {
      /* the token is dropped locally either way */
    }
  },

  async currentAdmin(signal?: AbortSignal): Promise<CurrentAdmin> {
    const [me, guard] = await Promise.all([
      http("/me", { schema: dataEnvelope(userSchema), signal }),
      http("/guard/auth/me", { schema: dataEnvelope(guardMeSchema), signal }),
    ]);
    const roles = guard.data.roles ?? [];
    return { user: me.data, roles, permissions: permissionsFromRoles(roles) };
  },
};
