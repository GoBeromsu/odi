import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/ui.css'
import { connectLanguage } from './i18n.ts'
import { Showcase } from './ui/Showcase.tsx'

connectLanguage(window.ody)
createRoot(document.getElementById('root')!).render(<Showcase />)
