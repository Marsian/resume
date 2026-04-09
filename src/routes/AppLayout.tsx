import { Outlet } from 'react-router-dom'

import { AppMenu } from '@/components/AppMenu'

export default function AppLayout() {
  return (
    <>
      <AppMenu />
      <Outlet />
    </>
  )
}

