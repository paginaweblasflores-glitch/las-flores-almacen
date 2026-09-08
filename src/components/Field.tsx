export default function Field({
  label,
  id,
  action,
  children,
}: {
  label: string;
  id: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-stone-500 uppercase tracking-wide">
        {label}
        {action ? <> {action}</> : null}
      </label>
      {children}
    </div>
  );
}
