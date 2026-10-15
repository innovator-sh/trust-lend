export default function GlassCard({ children, className = '', onClick, style }) {
  return (
    <div
      className={`glass-card ${className}`}
      onClick={onClick}
      style={style}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}
