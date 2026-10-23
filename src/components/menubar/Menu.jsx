// Renders any menu item list (menu bar dropdowns, the desktop context menu).
// Items are read-only: the separator object is shared between menus.
const Menu = ({ items, onSelect, className = '', style, menuRef }) => (
    <ul ref={menuRef} className={`menu ${className}`} role="menu" style={style}>
        {items.map((item, index) => (item.separator ? (
            <li key={`separator-${index}`} className="menu-separator" role="separator" />
        ) : (
            <li key={`${item.label}-${index}`} role="none">
                <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    disabled={item.disabled}
                    onClick={() => onSelect(item)}
                >
                    <span className="menu-check" aria-hidden="true">{item.checked ? '✓' : ''}</span>
                    <span className="menu-label">{item.label}</span>
                    {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
                </button>
            </li>
        )))}
    </ul>
);

export default Menu;
