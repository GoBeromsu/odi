import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/ui.css'
import { Activity } from './activity/Activity.tsx'

createRoot(document.getElementById('root')!).render(<Activity />)
