import { Outlet } from 'react-router-dom';
import { MainContent } from '@expertly/ui';
import { Sidebar } from './layout/Sidebar';

export default function Layout() {
  return (
    <>
      <Sidebar />
      <MainContent>
        <Outlet />
      </MainContent>
    </>
  );
}
