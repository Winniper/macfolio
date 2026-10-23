import { useEffect, useRef, useState } from 'react'
import dayjs from 'dayjs'
import { useShallow } from 'zustand/react/shallow'

import { navIcons } from '@constants'
import Menu from './menubar/Menu'
import useClock from '../hooks/useClock'
import { buildMenuBar } from '../lib/menus'
import { runMenuAction } from '../lib/menuActions'
import { getPlatform, isMacPlatform } from '../lib/shortcuts'
import useSystemStore from '../store/system'
import useWindowStore from '../store/window'

const isMac = isMacPlatform(getPlatform())

const Navbar = () => {
  const now = useClock()
  const navRef = useRef(null)
  const [openState, setOpenMenu] = useState(null)
  const [hasSelection, setHasSelection] = useState(false)
  const focusedId = useWindowStore((state) => state.focusedId)
  // Only the open ids: bounds changes during drag/resize must not re-render the bar.
  const openIds = useWindowStore(
    useShallow((state) => Object.keys(state.windows).filter((id) => state.windows[id].isOpen))
  )
  const bootPhase = useSystemStore((state) => state.bootPhase)
  const toggleSpotlight = useSystemStore((state) => state.toggleSpotlight)
  const toggleControlCenter = useSystemStore((state) => state.toggleControlCenter)
  const spotlightOpen = useSystemStore((state) => state.spotlightOpen)
  const onDesktop = bootPhase === 'desktop'
  // Boot/lock overlays own the screen: never show a menu under them.
  // Spotlight takes over too: derive closed, and drop the state so the menu stays closed after.
  const openMenu = onDesktop && !spotlightOpen ? openState : null
  if (spotlightOpen && openState) setOpenMenu(null)

  const menuBar = buildMenuBar({ focusedId, openIds, isMac, hasSelection })

  // Close on a press outside the menu bar, Esc, or leaving the page.
  useEffect(() => {
    if (!openMenu) return undefined

    const close = () => setOpenMenu(null)
    const handlePointerDown = (event) => {
      if (!navRef.current?.contains(event.target)) close()
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', close)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', close)
    }
  }, [openMenu])

  const toggle = (id) => {
    setHasSelection(Boolean(window.getSelection()?.toString()))
    setOpenMenu((current) => (current === id ? null : id))
  }

  // Like macOS: once a menu is open, hovering another title switches to it.
  const hover = (id) => {
    if (openMenu && openMenu !== id) setOpenMenu(id)
  }

  const select = (item) => {
    setOpenMenu(null)
    if (item.action) runMenuAction(item.action)
  }

  const renderMenu = (id, title, items, titleClassName = '') => (
    <li key={id} className="menubar-item">
      <button
        type="button"
        className={`menubar-title ${titleClassName}${openMenu === id ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={openMenu === id}
        onClick={() => toggle(id)}
        onPointerEnter={() => hover(id)}
      >
        {title}
      </button>
      {openMenu === id && <Menu items={items} onSelect={select} />}
    </li>
  )

  return (
    // inert outside the desktop phase: no pointer, focus or keyboard path in.
    <nav ref={navRef} inert={!onDesktop}>
      <div>
        <ul className="menubar">
          {renderMenu('apple', <img src="/images/logo.svg" alt="Apple menu" className="invert size-4" />, menuBar.apple)}
          {menuBar.menus.map((menu) => renderMenu(menu.id, menu.title, menu.items, menu.bold ? 'font-bold' : ''))}
        </ul>
      </div>
      <div>
        <ul>
          {navIcons.map(({ id, img, action, label }) => (
            <li key={id}>
              {action === 'spotlight' ? (
                // Spotlight's outside-press handler skips this, so it toggles cleanly.
                <button type="button" className="flex" data-spotlight-toggle aria-label={label} onClick={toggleSpotlight}>
                  <img className="icon-hover invert" src={img} alt="" />
                </button>
              ) : action === 'controlCenter' ? (
                <button type="button" className="flex" data-control-center-toggle aria-label={label} onClick={toggleControlCenter}>
                  <img className="icon-hover invert" src={img} alt="" />
                </button>
              ) : (
                <img className="icon-hover invert" src={img} alt={`icon-${id}`} />
              )}
            </li>
          ))}
        </ul>
        <time>{dayjs(now).format("ddd MMM D h:mm A")}</time>
      </div>
    </nav>
  )
}

export default Navbar
