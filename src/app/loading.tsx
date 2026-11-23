export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-3 text-xs font-semibold text-slate-300">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
        Unlocking SSE Vault...
      </div>
    </div>
  );
}
