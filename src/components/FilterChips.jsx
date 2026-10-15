export default function FilterChips({ items, active, onSelect }) {
  return (
    <div className="chip-group">
      {items.map((item) => (
        <button
          key={item}
          className={`chip ${active === item ? 'chip--active' : 'chip--inactive'}`}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
