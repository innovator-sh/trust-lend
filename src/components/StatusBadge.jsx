export default function StatusBadge({ variant = 'success', children }) {
  return (
    <span className={`badge badge--${variant}`}>
      {children}
    </span>
  );
}
