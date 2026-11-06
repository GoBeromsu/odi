import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/ui.css'
import { Focus } from './focus/Focus.tsx'
import { connectLanguage } from './i18n.ts'

connectLanguage(window.ody)
createRoot(document.getElementById('root')!).render(<Focus />)
