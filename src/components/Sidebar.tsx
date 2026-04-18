"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Bookmark, BarChart2, Settings, Target, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const routes = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Saved Niches", icon: Bookmark, href: "/saved" },
  { label: "Compare", icon: BarChart2, href: "/compare" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="md:hidden fixed bottom-6 right-6 z-50 p-3 bg-primary text-primary-foreground rounded-full shadow-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Backdrop for mobile */}
      {open && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col bg-card border-r transition-transform duration-300 md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center px-6 border-b border-border text-primary font-bold text-lg gap-2 shrink-0">
          <Target className="w-5 h-5" />
          NicheHunter
        </div>
        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-2">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
                pathname.startsWith(route.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <route.icon className="w-4 h-4" />
              {route.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
