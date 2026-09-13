"""A small, self-drawn line-icon set used in place of emoji in the sidebar.

Every icon is plain inline SVG (24x24 viewBox, currentColor stroke) so it
recolors with CSS like text does, needs no external icon font or CDN, and
looks the same on every machine. `icon(name, size)` is registered as a
Jinja global in webapp/app.py, so templates just call `{{ icon('grid') }}`.
"""
from markupsafe import Markup

# Each entry is the *inner* SVG markup only (no outer <svg> tag).
ICONS = {
    "message-square": '<path d="M4.5 5.8A1.8 1.8 0 0 1 6.3 4h11.4A1.8 1.8 0 0 1 19.5 5.8v8.4a1.8 1.8 0 0 1-1.8 1.8H9.2l-4 3.3a.5.5 0 0 1-.8-.4v-2.9a1.8 1.8 0 0 1-1.7-1.8Z"/>',
    "grid": '<rect x="3.7" y="3.7" width="7" height="7" rx="1.2"/><rect x="13.3" y="3.7" width="7" height="7" rx="1.2"/><rect x="3.7" y="13.3" width="7" height="7" rx="1.2"/><rect x="13.3" y="13.3" width="7" height="7" rx="1.2"/>',
    "archive": '<rect x="3" y="3.5" width="18" height="5" rx="1.5"/><path d="M4.5 8.5v9.3a1.7 1.7 0 0 0 1.7 1.7h11.6a1.7 1.7 0 0 0 1.7-1.7V8.5"/><path d="M10 12.5h4"/>',
    "cloud": '<path d="M7.2 18.3a3.9 3.9 0 0 1-.5-7.8 5.4 5.4 0 0 1 10.6-1.2A4.1 4.1 0 0 1 16.9 18.3Z"/>',
    "compare": '<path d="M6.3 8h11.4M17.7 8l-3-3.2"/><path d="M17.7 16H6.3M6.3 16l3 3.2"/>',
    "sliders": '<path d="M4 6.5h7.5M15.5 6.5H20M4 12h3.5M11.5 12H20M4 17.5h10.5M18.5 17.5H20"/><circle cx="13.5" cy="6.5" r="2"/><circle cx="9.5" cy="12" r="2"/><circle cx="16.5" cy="17.5" r="2"/>',
}


def icon_svg(name: str, size: int = 16, stroke: float = 1.8, cls: str = "") -> Markup:
    """Renders one icon as an inline <svg>. Unknown names fall back to a
    plain circle rather than raising, so a stray/typo'd icon key degrades
    gracefully instead of crashing a page."""
    inner = ICONS.get(name, '<circle cx="12" cy="12" r="7"/>')
    class_attr = f' class="{cls}"' if cls else ""
    return Markup(
        f'<svg{class_attr} width="{size}" height="{size}" viewBox="0 0 24 24" '
        f'fill="none" stroke="currentColor" stroke-width="{stroke}" '
        f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{inner}</svg>'
    )
