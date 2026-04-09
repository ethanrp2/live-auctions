export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  rootDomain: process.env.ROOT_DOMAIN ?? "localhost",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  bastaManagementUrl:
    process.env.BASTA_MANAGEMENT_API_URL ??
    "https://management.api.basta.app/graphql",
  bastaAccountId: process.env.BASTA_ACCOUNT_ID ?? "",
  bastaApiKey: process.env.BASTA_API_KEY ?? "",
  bastaBidderTokenTtlMinutes: Number(
    process.env.BASTA_BIDDER_TOKEN_TTL_MINUTES ?? 60
  ),
  bastaLotDurationMs: Number(process.env.BASTA_LOT_DURATION_MS ?? 120_000),
  signedUploadExpiresInSeconds: Number(
    process.env.SIGNED_UPLOAD_EXPIRES_IN_SECONDS ?? 1800
  ),
};
