import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/ui.css'
import { Showcase } from './ui/Showcase.tsx'

createRoot(document.getElementById('root')!).render(<Showcase />)
