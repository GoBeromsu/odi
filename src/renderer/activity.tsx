import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/ui.css'
import { Activity } from './activity/Activity.tsx'
import { connectLanguage } from './i18n.ts'
import { connectSkin } from './skin.ts'

connectLanguage(window.ody)
connectSkin(window.ody)
createRoot(document.getElementById('root')!).render(<Activity />)
