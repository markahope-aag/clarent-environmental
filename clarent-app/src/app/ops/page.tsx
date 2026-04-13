export default function OpsHomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center">
        <div className="mb-3 text-xs font-semibold tracking-[0.18em] text-zinc-500 uppercase">
          Ops console
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Clarent Operations.</h1>
        <p className="mt-4 text-zinc-600">
          Welcome to <span className="font-medium text-zinc-900">ops.clarentenvironmental.com</span>{' '}
          — the internal console for job pipeline, Lane&nbsp;2 pricing review, vendor selection,
          and the exception queue.
        </p>
        <p className="mt-6 text-sm text-zinc-500">
          Access is restricted to Clarent staff. Full console arrives in Phase&nbsp;4.
        </p>
      </div>
    </div>
  );
}
