import { useEffect } from "react"
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
import useSystemStore from "@store/system"
import DesktopContextMenu from "@components/system/DesktopContextMenu"
import BootScreen from "@components/system/BootScreen"
import LockScreen from "@components/system/LockScreen"

gsap.registerPlugin(Draggable)

function App() {
  const fitToViewport = useWindowStore((state) => state.fitToViewport)
  const bootPhase = useSystemStore((state) => state.bootPhase)

  useEffect(() => {
    window.addEventListener("resize", fitToViewport)
    return () => window.removeEventListener("resize", fitToViewport)
  }, [fitToViewport])

  return (
    <main>
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
      <SoundEffects />
      <AudioController />
      <DesktopContextMenu />
      <Analytics />
      {/* Lock screen sits under the boot layer so the boot fades into it. */}
      {(bootPhase === "booting" || bootPhase === "locked") && <LockScreen />}
      {bootPhase === "booting" && <BootScreen />}
    </main>
  )
}

export default App
