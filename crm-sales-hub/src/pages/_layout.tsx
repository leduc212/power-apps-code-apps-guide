import { Outlet, NavLink } from "react-router-dom"
import { useAppContext } from "@/hooks/useAppContext"

type LayoutProps = { showHeader?: boolean }

export default function Layout({ showHeader = true }: LayoutProps) {
  const { data: ctx } = useAppContext()

  return (
    <div className="min-h-dvh flex flex-col">
      {showHeader && (
        <header className="h-14 border-b flex items-center">
          <div className="mx-auto w-full max-w-7xl px-6 flex items-center gap-6">
            <span className="font-semibold text-sm">CRM Sales Hub</span>
            <nav className="flex items-center gap-4">
              <NavLink to="/" end
                className={({ isActive }) =>
                  `text-sm text-muted-foreground hover:text-foreground ${isActive ? "text-foreground font-medium" : ""}`
                }
              >
                Home
              </NavLink>
              <NavLink to="/accounts"
                className={({ isActive }) =>
                  `text-sm text-muted-foreground hover:text-foreground ${isActive ? "text-foreground font-medium" : ""}`
                }
              >
                Accounts
              </NavLink>
              <NavLink to="/dashboard"
                className={({ isActive }) =>
                  `text-sm text-muted-foreground hover:text-foreground ${isActive ? "text-foreground font-medium" : ""}`
                }
              >
                Dashboard
              </NavLink>
            </nav>
            {ctx?.user.fullName && (
              <span className="ml-auto text-sm text-muted-foreground">
                {ctx.user.fullName}
              </span>
            )}
          </div>
        </header>
      )}

      <main className="flex-1 flex">
        <div className="flex-1 mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}