"use client";

import { useEffect, useState, useMemo } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { setupMockApi } from "@/services/mockApi";
import { Toaster } from "@/components/ui/sonner";
import {
  LayoutDashboard,
  Upload,
  Video,
  LogOut,
  Menu,
  Sparkles,
  Image,
  Download,
  Shield,
} from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ─── Nav Items ───────────────────────────────────────────
const baseNavItems = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/upload", label: "Upload", Icon: Upload },
  { href: "/videos", label: "Videos", Icon: Video },
  { href: "/highlights", label: "Highlights", Icon: Image },
  { href: "/downloads", label: "Downloads", Icon: Download },
];

const adminNavItem = { href: "/admin", label: "Admin", Icon: Shield };

// ─── Auth pages ──────────────────────────────────────────
const authPaths = ["/auth/login", "/auth/register"];
const adminPaths = ["/admin"];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout, loadProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Compute nav items based on user role
  const navItems = useMemo(() => {
    if (user?.role === "admin") {
      return [...baseNavItems, adminNavItem];
    }
    return baseNavItems;
  }, [user?.role]);

  // Setup mock API on client
  useEffect(() => {
    setupMockApi();
    setMounted(true);
  }, []);

  // Load profile on mount if token exists
  useEffect(() => {
    if (token && !user) {
      loadProfile();
    }
  }, [token, user, loadProfile]);

  // Protect routes
  useEffect(() => {
    if (!mounted) return;
    const isAuthPage = authPaths.includes(pathname);
    const isAdminPage = adminPaths.includes(pathname);
    const isLoggedIn = !!token;

    if (!isLoggedIn && !isAuthPage && pathname !== "/") {
      router.push("/auth/login");
    }
    if (isLoggedIn && isAuthPage) {
      router.push("/dashboard");
    }
    // Redirect non-admin users away from admin pages
    if (isAdminPage && isLoggedIn && user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [token, pathname, router, mounted, user]);

  const isAuthPage = authPaths.includes(pathname);
  const isHomePage = pathname === "/";

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  // Don't render layout shell for auth pages or home
  if (isAuthPage || isHomePage) {
    return (
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full bg-zinc-900 text-white font-sans">
          <Toaster />
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-zinc-900 text-white font-sans">
        <Toaster />
        <div className="flex h-screen overflow-hidden">
          {/* ─── Sidebar ─── */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-zinc-800/80 border-r border-zinc-700/50 backdrop-blur-xl transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-700/50">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/25">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-white">
                  ClipHunter <span className="text-violet-400">AI</span>
                </h1>
                <p className="text-xs text-zinc-500">Smart Highlights</p>
              </div>
            </div>

            {/* Nav */}
            <nav className="p-4 space-y-1">
              {navItems.map(({ href, label, Icon }) => {
                const isActive = pathname.startsWith(href);
                const isAdminLink = href === "/admin";
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-zinc-700/50"
                    } ${isAdminLink ? "mt-2 border-t border-zinc-700/30 pt-3" : ""}`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Link>
                );
              })}
            </nav>

            {/* User section */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-700/50">
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-zinc-700/30">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 text-sm font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.name || user?.email || "User"}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg hover:bg-zinc-600/50 text-zinc-400 hover:text-red-400 transition"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </aside>

          {/* ─── Backdrop ─── */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* ─── Main Area ─── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top bar (mobile) */}
            <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-zinc-700/50 bg-zinc-800/50 backdrop-blur-sm">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold">
                  ClipHunter <span className="text-violet-400">AI</span>
                </span>
              </div>
              <div className="w-10" />
            </header>

            {/* Page content */}
            <main className="flex-1 overflow-y-auto p-4 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
