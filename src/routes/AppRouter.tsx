import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ResumeView } from '../resume'
import { ClawView } from '../claw'
import { HomeView } from '../home'
import { GameCenterView } from '../game-center'
import AppLayout from './AppLayout'

const TankBattle90View = lazy(() => import('../game-center/tank90/TankBattle90View'))
const FruitNinjaView = lazy(() => import('../game-center/fruit-ninja/FruitNinjaView'))
const FruitNinjaBladeLabView = lazy(() => import('../game-center/fruit-ninja/FruitNinjaBladeLabView'))
const FruitGalleryView = lazy(() => import('../game-center/fruit-ninja/FruitGalleryView'))
const FruitGallerySlicedView = lazy(() => import('../game-center/fruit-ninja/FruitGallerySlicedView'))

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Loading…
    </div>
  )
}

export default function AppRouter() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/games/fruit-ninja/gallery" element={<FruitGalleryView />} />
        <Route path="/games/fruit-ninja/gallery-sliced" element={<FruitGallerySlicedView />} />
        <Route path="/games/fruit-ninja/blade-lab" element={<FruitNinjaBladeLabView />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomeView />} />
          <Route path="/resume" element={<ResumeView />} />
          <Route path="/claw" element={<ClawView />} />
          <Route path="/games" element={<GameCenterView />} />
          <Route path="/games/tank90" element={<TankBattle90View />} />
          <Route path="/games/fruit-ninja" element={<FruitNinjaView />} />
          {/* Back-compat: old direct entry */}
          <Route path="/tank90" element={<Navigate to="/games/tank90" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
