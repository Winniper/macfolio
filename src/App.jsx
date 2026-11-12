import { useEffect, useRef } from "react"
import { Navbar, Welcome, Dock } from "@components"
import DesktopItem from "@components/DesktopItem"
import { Terminal, Resume, Finder, Contact, Browser, AboutThisMac, Music } from "@windows"
import { desktopItems } from "@constants"
import gsap from "gsap"
import { Draggable } from "gsap/all"
import { Analytics } from "@vercel/analytics/react"
import useWindowStore from "@store/window"
import MissionControl from "@components/system/MissionControl"
import AppSwitcher from "@components/system/AppSwitcher"
import Spotlight from "@components/system/Spotlight"
import Notifications from "@components/system/Notifications"
import SoundEffects from "@components/system/SoundEffects"
import AudioController from "@components/system/AudioController"
import ControlCenter from "@components/system/ControlCenter"
import DisplayDimmer from "@components/system/DisplayDimmer"
import useSystemStore from "@store/system"
import DesktopContextMenu from "@components/system/DesktopContextMenu"
import BootScreen from "@components/system/BootScreen"
import LockScreen from "@components/system/LockScreen"
import useMediaQuery from "./hooks/useMediaQuery"
import useWelcomeNotifications from "./hooks/useWelcomeNotifications"
import { PHONE_QUERY } from "./lib/boot"
import PhoneShell from "./phone/PhoneShell"
import PhoneLockScreen from "./phone/PhoneLockScreen"

gsap.registerPlugin(Draggable)

function App() {
  const fitToViewport = useWindowStore((state) => state.fitToViewport)
  const resetLayout = useWindowStore((state) => state.resetLayout)
  const bootPhase = useSystemStore((state) => state.bootPhase)
  const phone = useMediaQuery(PHONE_QUERY)
  const wasPhoneRef = useRef(phone)

  useWelcomeNotifications()

  // index.html paints the page black until the boot screen (or the desktop)
  // is on screen; that has happened by the time this first effect runs.
  useEffect(() => {
    document.documentElement.classList.remove("booting")
  }, [])

  useEffect(() => {
    window.addEventListener("resize", fitToViewport)
    return () => window.removeEventListener("resize", fitToViewport)
  }, [fitToViewport])

  // Windows opened on the phone got bounds for a phone-sized viewport; give
  // the desktop its default layout back when it takes over. A phone sheet
  // (Spotlight, Control Center, the switcher) must not come up with it.
  useEffect(() => {
    if (wasPhoneRef.current && !phone) {
      const system = useSystemStore.getState()
      system.closeSpotlight()
      system.closeControlCenter()
      system.closeMissionControl()
      resetLayout()
    }
    wasPhoneRef.current = phone
  }, [phone, resetLayout])

  const showLock = bootPhase === "booting" || bootPhase === "locked"

  return (
    <main>
      {phone ? (
        <PhoneShell />
      ) : (
        <>
          <Navbar />
          <Welcome />

          {/* Desktop Icons */}
          {desktopItems.map((item) => (
            <DesktopItem
              key={item.id}
              item={item}
              style={{ top: item.position.top, left: item.position.left }}
            />
          ))}

          {/* Windows */}
          <Terminal />
          <Resume />
          <Finder />
          <Contact />
          <Browser />
          <AboutThisMac />
          <Music />
          <Dock />
          <MissionControl />
          <AppSwitcher />
          <Spotlight />
          <Notifications />
          <ControlCenter />
          <DesktopContextMenu />
        </>
      )}

      {/* Mounted in both shells: no visuals of their own, or full-screen layers. */}
      <SoundEffects />
      <AudioController />
      <Analytics />
      <DisplayDimmer />
      {/* Lock screen sits under the boot layer so the boot fades into it. */}
      {showLock && (phone ? <PhoneLockScreen /> : <LockScreen />)}
      {bootPhase === "booting" && <BootScreen />}
    </main>
  )
}

export default App
