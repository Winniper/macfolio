import { Navbar, Welcome } from "@components"
import { Analytics } from "@vercel/analytics/react"

function App() {

  return (
    <main>
      <Navbar />
      <Welcome />
      <Analytics />
    </main>
  )
}

export default App
