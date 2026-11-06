import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/ui.css'
import { Focus } from './focus/Focus.tsx'

createRoot(document.getElementById('root')!).render(<Focus />)
