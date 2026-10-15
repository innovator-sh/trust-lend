import { Link } from 'react-router-dom';

export default function PrimaryButton({ children, to, onClick, icon, large, id, className = '' }) {
  const classes = `btn-primary ${large ? 'btn-primary--lg' : ''} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes} id={id}>
        {children}
        {icon && <iconify-icon icon={icon} width="20" height="20"></iconify-icon>}
      </Link>
    );
  }

  return (
    <button className={classes} onClick={onClick} id={id}>
      {children}
      {icon && <iconify-icon icon={icon} width="20" height="20"></iconify-icon>}
    </button>
  );
}
