export default function LoadingSkeleton({ rows = 5 }) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-12 animate-pulse rounded-lg bg-slate-200/80" />
      ))}
    </div>
  );
}
