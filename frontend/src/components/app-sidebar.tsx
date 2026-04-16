import { useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles,
  GitPullRequest,
  Bug,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import devinMark from "@/assets/03_Devin_PrimaryMark_FullColor.png";

const navItems = [
  { label: "Ask", icon: Sparkles, path: "/ask" },
  { label: "Review", icon: GitPullRequest, path: "/review" },
  { label: "Vulnerabilities", icon: Bug, path: "/vulnerabilities" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Sidebar collapsible="icon" className="border-border-secondary">
      <SidebarHeader className="h-[46px] flex-row items-center gap-2 px-4">
        <div className="relative w-4 h-7 shrink-0">
          <img
            src={devinMark}
            alt="Devin"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-7 max-w-none object-contain"
          />
        </div>
        <span className="text-[16px] font-medium text-text-primary group-data-[collapsible=icon]:hidden">
          Devin
        </span>
      </SidebarHeader>

      <div className="mx-4 h-px bg-border-secondary" />

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => {
              const active = location.pathname === item.path;
              return (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={item.label}
                    onClick={() => navigate(item.path)}
                    className="relative text-[13px] font-medium"
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-sm bg-accent-blue" />
                    )}
                    <item.icon className="size-[18px]" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="George's Takehome" className="text-[12px] text-text-secondary [&_svg]:text-text-secondary">
              <User className="size-[18px]" />
              <span>George's Takehome</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
