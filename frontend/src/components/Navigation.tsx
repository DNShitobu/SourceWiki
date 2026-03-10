import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Bell,
  BarChart3,
  Search,
  Upload,
  User,
  LogOut,
  Award,
  Shield,
  LogIn,
} from "lucide-react";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth-context";
import { userApi } from "../lib/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Badge } from "./ui/badge";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "./ui/sheet";


const countries = [
  { name: 'Ghana', slug: 'ghana' },
  { name: 'Nigeria', slug: 'nigeria' },
  { name: 'Kenya', slug: 'kenya' },
];


export const Navigation: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{ _id: string; title: string; message: string; link?: string; readAt?: string | null }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      try {
        const response = await userApi.getNotifications(1, 6);
        setNotifications(response.notifications || []);
        setUnreadCount(response.unreadCount || 0);
      } catch (error) {
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    loadNotifications();
  }, [user]);

  const handleNotificationClick = async (notificationId: string, link?: string) => {
    try {
      await userApi.markNotificationRead(notificationId);
      setNotifications((current) =>
        current.map((notification) =>
          notification._id === notificationId
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      // Ignore notification read failures
    }

    if (link) {
      navigate(link);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await userApi.markAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, readAt: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch (error) {
      // Ignore notification read failures
    }
  };

  return (
    <nav className="border-b bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link
              to="/"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <BookOpen className="h-8 w-8" />
              <div className="flex flex-col items-start">
                <span className="font-semibold">WikiSourceVerifier</span>
                <span className="text-xs text-gray-500">
                  Community Reference Platform
                </span>
              </div>
            </Link>

            <div className="hidden md:flex items-center space-x-1">
              <Button
                variant={isActive("/directory") ? "default" : "ghost"}
                onClick={() => navigate("/directory")}
                className="flex items-center space-x-2"
              >
                <Search className="h-4 w-4" />
                <span>Directory</span>
              </Button>

              {user && (
                <>
                  <Button
                    variant={isActive("/submit") ? "default" : "ghost"}
                    onClick={() => navigate("/submit")}
                    className="flex items-center space-x-2"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Submit</span>
                  </Button>

                  {(user.role === "admin" || user.role === "verifier") && (
                    <>
                      <Button
                        variant={isActive("/admin") ? "default" : "ghost"}
                        onClick={() => navigate("/admin")}
                        className="flex items-center space-x-2"
                      >
                        <Shield className="h-4 w-4" />
                        <span>Admin</span>
                      </Button>
                      <Button
                        variant={isActive("/reports") ? "default" : "ghost"}
                        onClick={() => navigate("/reports")}
                        className="flex items-center space-x-2"
                      >
                        <BarChart3 className="h-4 w-4" />
                        <span>Reports</span>
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden flex items-center space-x-4">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>

              <SheetContent side="left" className="w-64">
                <nav className="flex flex-col gap-4 mt-6">
                  <Button
                    variant={isActive("/directory") ? "default" : "ghost"}
                    className="justify-start h-12"
                    onClick={() => {
                      navigate("/directory");
                      setOpen(false);
                    }}
                  >
                    <Search className="mr-2 h-5 w-5" />
                    Directory
                  </Button>

                  {user && (
                    <>
                      <Button
                        variant={isActive("/submit") ? "default" : "ghost"}
                        className="justify-start h-12"
                        onClick={() => {
                          navigate("/submit");
                          setOpen(false);
                        }}
                      >
                        <Upload className="mr-2 h-5 w-5" />
                        Submit
                      </Button>

                      {(user.role === "admin" || user.role === "verifier") && (
                        <>
                          <Button
                            variant={isActive("/admin") ? "default" : "ghost"}
                            className="justify-start h-12"
                            onClick={() => {
                              navigate("/admin");
                              setOpen(false);
                            }}
                          >
                            <Shield className="mr-2 h-5 w-5" />
                            Admin
                          </Button>
                          <Button
                            variant={isActive("/reports") ? "default" : "ghost"}
                            className="justify-start h-12"
                            onClick={() => {
                              navigate("/reports");
                              setOpen(false);
                            }}
                          >
                            <BarChart3 className="mr-2 h-5 w-5" />
                            Reports
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-4 w-4" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] text-white">
                          {unreadCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <DropdownMenuLabel className="flex items-center justify-between">
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={handleMarkAllNotificationsRead}>
                          Mark all read
                        </Button>
                      )}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {notifications.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-500">No notifications yet.</div>
                    ) : (
                      notifications.map((notification) => (
                        <DropdownMenuItem
                          key={notification._id}
                          onClick={() => handleNotificationClick(notification._id, notification.link)}
                          className="flex flex-col items-start gap-1 py-3"
                        >
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="font-medium">{notification.title}</span>
                            {!notification.readAt && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                          </div>
                          <span className="text-xs text-gray-500">{notification.message}</span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center space-x-2"
                    >
                      <User className="h-4 w-4" />
                      <span className="hidden sm:inline">{user.username}</span>
                      <Badge variant="secondary" className="ml-2">
                        {user.points}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <span>{user.username}</span>
                        <span className="text-xs text-gray-500">
                          {user.email || user.authProvider || 'Account'}
                        </span>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <User className="h-4 w-4 mr-2" />
                      Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/profile")}>
                      <Award className="h-4 w-4 mr-2" />
                      Badges ({user.badges.length})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button
                onClick={() => navigate("/auth")}
                className="flex items-center space-x-2"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Login</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
