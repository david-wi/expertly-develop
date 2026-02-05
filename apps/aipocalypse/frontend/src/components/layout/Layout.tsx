import { Outlet } from 'react-router-dom'
import { MainContent } from '@expertly/ui'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <>
      <Sidebar />
      <MainContent>
        <Outlet />
      </MainContent>
    </>
  )
}
