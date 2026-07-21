import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, LogOut, Menu, UserCircle } from "lucide-react";
import { base44 } from "../lib/api";
import { useAuth } from "./AuthGuard";
import { useBasePath, useAdminHref } from "../context/BasePathContext";
import { ADMIN_ROUTES } from "../routes";

/** Match an internal path (no leading slash) against ADMIN_ROUTES patterns. */
function matchRoute(path) {
  const segs = path.split("/").filter(Boolean);
  return ADMIN_ROUTES.find((r) => {
    const pSegs = r.path.split("/").filter(Boolean);
    if (pSegs.length !== segs.length) return false;
    return pSegs.every((p, i) => p.startsWith(":") || p === segs[i]);
  });
}

function useBreadcrumbs() {
  const { pathname } = useLocation();
  const base = useBasePath();
  const rel = pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const segs = rel.split("/").filter(Boolean);
  const crumbs = [{ label: "Dashboard", path: "" }];
  segs.forEach((seg, i) => {
    const prefix = segs.slice(0, i + 1).join("/");
    const route = matchRoute(prefix);
    crumbs.push({
      label: route?.label || decodeURIComponent(seg),
      path: prefix,
      last: i === segs.length - 1,
    });
  });
  return crumbs;
}

/** Top bar: mobile menu button, breadcrumbs, user menu. */
export default function Topbar({ onMenuClick }) {
  const user = useAuth();
  const href = useAdminHref();
  const crumbs = useBreadcrumbs();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>
      <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
            {crumb.last || i === crumbs.length - 1 ? (
              <span className="truncate font-medium">{crumb.label}</span>
            ) : (
              <Link
                to={href(crumb.path)}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <UserCircle className="h-5 w-5" />
            <span className="hidden max-w-40 truncate sm:inline">{user?.email}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="text-sm font-medium">{user?.full_name || "Administrator"}</div>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => base44.auth.logout()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
