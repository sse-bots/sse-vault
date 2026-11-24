export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="vault-card vault-text-secondary flex items-center gap-2.5 rounded-2xl px-5 py-3 text-xs font-bold">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-amber-500" />
        Unlocking SSE Vault...
      </div>
    </div>
  );
}
