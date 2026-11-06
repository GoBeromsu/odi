import { createRoot } from 'react-dom/client'
import './ui/tokens.css'
import './ui/ui.css'
import { connectLanguage } from './i18n.ts'
import { Onboarding } from './onboarding/Onboarding.tsx'
import { connectSkin } from './skin.ts'

connectLanguage(window.ody)
connectSkin(window.ody)
createRoot(document.getElementById('root')!).render(<Onboarding />)
