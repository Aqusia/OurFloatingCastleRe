type EnvironmentSource = Record<string, string | undefined>;

export type SupabaseServerConfig = {
  url: string;
  serviceRoleKey: string;
  schema: string;
};

export function readSupabaseServerConfig(env: EnvironmentSource = process.env): SupabaseServerConfig | null {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const schema = env.SUPABASE_DB_SCHEMA?.trim() || "public";

  if (!url || !serviceRoleKey) {
    return null;
  }

  return {
    url,
    serviceRoleKey,
    schema
  };
}

export function requireSupabaseServerConfig(env: EnvironmentSource = process.env): SupabaseServerConfig {
  const config = readSupabaseServerConfig(env);

  if (!config) {
    throw new Error("Supabase server config is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return config;
}

export function buildSupabaseRestHeaders(config: SupabaseServerConfig): Record<string, string> {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
}

export function buildSupabaseRestUrl(config: SupabaseServerConfig, table: string) {
  const baseUrl = config.url.replace(/\/+$/, "");
  return `${baseUrl}/rest/v1/${table}`;
}
