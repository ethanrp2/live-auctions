import { headers } from "next/headers";
import { SellerOnboardingForm } from "@/components/seller-onboarding-form";

export default async function SellerOnboardingPage() {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");
  const tenantSlug = headersList.get("x-tenant-slug");
  const tenantName = headersList.get("x-tenant-name");

  if (!tenantId || !tenantSlug) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-neutral-900">Seller onboarding unavailable</h1>
          <p className="mt-3 text-sm text-neutral-600">
            Seller onboarding must be completed from a tenant subdomain like
            <span className="font-medium"> unsoundrags.localhost:3000</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Create seller account</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Tenant: <span className="font-medium text-neutral-900">{tenantName ?? tenantSlug}</span>
        </p>
        <SellerOnboardingForm tenantId={tenantId} tenantSlug={tenantSlug} />
      </div>
    </div>
  );
}
