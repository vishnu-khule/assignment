import { getDb } from "./client.js";
import { organizations } from "./schema.js";

const orgId = process.env.DEV_ORG_ID ?? "dev-org";

async function main() {
  const db = getDb();
  await db
    .insert(organizations)
    .values({
      id: orgId,
      name: process.env.DEFAULT_COMPANY_NAME ?? "Demo Contracting Co",
      currency: "USD",
      branding: { company_name: process.env.DEFAULT_COMPANY_NAME ?? "Demo Contracting Co" },
    })
    .onConflictDoNothing();
  console.log("Seeded org", orgId);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
