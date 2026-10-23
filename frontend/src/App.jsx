import { useEffect, useState } from 'react'

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [status, setStatus] = useState('Checking...')

  useEffect(() => {
    fetch(`${apiUrl}/api/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Backend unavailable')
        }
        return response.json()
      })
      .then((data) => setStatus(data.message))
      .catch(() => setStatus('Unavailable'))
  }, [])

  return (
    <main>
      <h1>Samarth AI</h1>
      <p>Backend status: {status}</p>
    </main>
  )
}

export default App
