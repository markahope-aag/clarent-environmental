export default function GeneratorHomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center">
        <div className="mb-3 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
          Generator portal
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hazardous waste disposal made simple.
        </h1>
        <p className="mt-4 text-zinc-600">
          Welcome to <span className="font-medium text-zinc-900">app.clarentenvironmental.com</span> —
          the portal where Small Quantity Generators book pickups, track jobs, and manage
          compliance.
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          Sign up in the header to create your account. Intake flow, Lane&nbsp;1 instant quoting,
          and job tracking arrive in Phase&nbsp;3.
        </p>
      </div>
    </div>
  );
}
