import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  Pill,
  BarChart3,
  LayoutGrid,
  Users,
  LogOut,
  Shield,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

// Owner-only system - all routes require authentication
const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', adminOnly: false },
  { icon: ShoppingCart, label: 'Point of Sale', path: '/pos', adminOnly: false },
  { icon: Package, label: 'Products', path: '/products', adminOnly: false },
  { icon: TrendingUp, label: 'Stock Purchases', path: '/purchases', adminOnly: false },
  { icon: BarChart3, label: 'Sales Report', path: '/sales', adminOnly: false },
  { icon: LayoutGrid, label: 'Racks', path: '/racks', adminOnly: false },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const { profile, isOwner, signOut } = useAuth();

  // Owner-only system - show all items if authenticated
  const filteredNavItems = isOwner ? navItems : [];

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const sidebarContent = (
    <>
      <div className="p-4 sm:p-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg flex-shrink-0">
            <Pill className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight truncate">Health Haven Pharmacy</h1>
            <p className="text-xs text-muted-foreground font-medium">Management System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={handleLinkClick}
              className={cn(
                'nav-item',
                isActive && 'nav-item-active'
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/60 space-y-3">
        <div className="p-3 rounded-xl bg-muted/50">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate min-w-0 flex-1">
              {profile?.full_name || 'User'}
            </p>
            <Badge variant="default" className="text-xs capitalize flex-shrink-0">
              <Shield className="w-3 h-3 mr-1" />
              Owner
            </Badge>
          </div>
        </div>
        <Button variant="outline" className="w-full justify-start" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2 flex-shrink-0" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-card border-r border-border/60 flex-col shadow-sm z-40">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose && onClose()}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            {sidebarContent}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
