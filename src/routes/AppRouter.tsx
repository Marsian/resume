import { Navigate, Route, Routes } from 'react-router-dom'
import { ResumeView } from '../resume'
import { ClawView } from '../claw'
import { HomeView } from '../home'
import { TankBattle90View } from '../game-center/tank90'
import { GameCenterView } from '../game-center'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomeView />} />
      <Route path="/resume" element={<ResumeView />} />
      <Route path="/claw" element={<ClawView />} />
      <Route path="/games" element={<GameCenterView />} />
      <Route path="/games/tank90" element={<TankBattle90View />} />
      {/* Back-compat: old direct entry */}
      <Route path="/tank90" element={<Navigate to="/games/tank90" replace />} />
    </Routes>
  )
}

