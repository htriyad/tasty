import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderTree, Import, Database } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/manage/folders", label: "Folders", icon: FolderTree },
    { href: "/import", label: "Import Sets", icon: Import },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 border-r border-border bg-sidebar flex-shrink-0 md:h-screen sticky top-0 flex flex-col">
        <div className="p-4 border-b border-sidebar-border flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg text-sidebar-foreground tracking-tight">QuestionBank</span>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
