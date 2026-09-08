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
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-stone-500 uppercase tracking-wide">
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}
