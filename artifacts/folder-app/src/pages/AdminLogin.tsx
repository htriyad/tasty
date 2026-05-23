import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAdmin } from "@/contexts/AdminContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShieldCheck, LogOut, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

export function AdminLogin() {
  const { isAdmin, login, logout } = useAdmin();
  const [, navigate] = useLocation();
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 300));
    const ok = login(user, pass);
    setLoading(false);
    if (ok) {
      navigate("/");
    } else {
      setError("Invalid username or password.");
      setPass("");
    }
  };

  if (isAdmin) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-background">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </Link>
          <ThemeToggle size="sm" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-sm flex flex-col items-center gap-6 text-center"
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Admin Panel</h2>
              <p className="text-muted-foreground text-sm mt-1">You are logged in as <span className="font-semibold text-foreground">Hosen Toufiq Riyad</span></p>
            </div>

            <div className="w-full rounded-xl border border-border bg-card p-4 text-left space-y-2 text-sm">
              <p className="font-semibold text-foreground">What you can do as admin:</p>
              <ul className="text-muted-foreground space-y-1 text-xs list-disc list-inside">
                <li>Add, edit, delete folders anywhere</li>
                <li>Create, rename, delete question sets</li>
                <li>Add, edit, delete questions</li>
                <li>Reorder folders, sets, and questions</li>
              </ul>
            </div>

            <div className="w-full flex flex-col gap-2">
              <Link href="/" className="w-full">
                <Button className="w-full">Go to Question Bank</Button>
              </Link>
              <Button
                variant="outline"
                className="w-full gap-2 text-red-500 hover:text-red-500 hover:border-red-500/40"
                onClick={() => { logout(); }}
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <Link href="/">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </Link>
        <ThemeToggle size="sm" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm flex flex-col gap-6"
        >
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Admin Login</h2>
            <p className="text-muted-foreground text-sm mt-1">Sign in to manage content</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Username</label>
              <Input
                value={user}
                onChange={e => setUser(e.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full gap-2 mt-1" disabled={loading}>
              <ShieldCheck className="w-4 h-4" />
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
