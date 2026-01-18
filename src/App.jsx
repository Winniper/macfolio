import { Navbar, Welcome, Dock } from "@components"
import DesktopItem from "@components/DesktopItem"
import { Terminal, Resume, Finder, Contact } from "@windows"
import { desktopItems } from "@constants"
import gsap from "gsap"
import { Draggable } from "gsap/all"
import { Analytics } from "@vercel/analytics/react"

gsap.registerPlugin(Draggable)

function App() {

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
      <Dock />
      <Analytics />
    </main>
  )
}

export default App
