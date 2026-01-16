import { Navbar, Welcome, Dock } from "@components"
import { Analytics } from "@vercel/analytics/react"

function App() {

  return (
    <main>
      <Navbar />
      <Welcome />
      <Dock />
      <Analytics />
    </main>
  )
}

export default App
