import { NavLink, Outlet } from 'react-router-dom'
import { FigmaTokenButton } from './FigmaTokenButton'
import './Layout.css'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link nav-link-active' : 'nav-link'

export function Layout() {
  return (
    <div className="app-shell">
      <div className="app-chrome">
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden />
            <div>
              <span className="brand-title">Screen comparison</span>
              <span className="brand-sub">Figma · backlog · coverage</span>
            </div>
          </div>
          <FigmaTokenButton />
        </header>
        <nav className="app-steps-nav app-nav" aria-label="Steps">
          <NavLink to="/" end className={linkClass}>
            1 · Library
          </NavLink>
          <NavLink to="/compare" className={linkClass}>
            2 · Compare
          </NavLink>
          <NavLink to="/score" className={linkClass}>
            3 · Coverage
          </NavLink>
          <NavLink to="/dashboard" className={linkClass}>
            4 · Dashboard
          </NavLink>
        </nav>
      </div>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
