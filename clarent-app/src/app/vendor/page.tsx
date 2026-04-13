export default function VendorHomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center">
        <div className="mb-3 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
          Vendor portal
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Curated jobs, transparent payouts.
        </h1>
        <p className="mt-4 text-zinc-600">
          Welcome to{' '}
          <span className="font-medium text-zinc-900">vendors.clarentenvironmental.com</span> —
          the portal where licensed transporters and TSDFs receive RFQs, confirm pickups, and
          track Net&nbsp;30 payouts.
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          Onboarding, RFQ inbox, and work order flow arrive in Phase&nbsp;5.
        </p>
      </div>
    </div>
  );
}
