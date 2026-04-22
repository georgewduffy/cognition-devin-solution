import { Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/app-sidebar";
import { AutoResolveProvider } from "@/components/auto-resolve-provider";
import { MainHeader } from "@/components/main-header";
import { AskPage } from "@/pages/ask-page";
import { ReviewPage } from "@/pages/review-page";
import { VulnerabilitiesPage } from "@/pages/vulnerabilities-page";

function App() {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AutoResolveProvider>
          <AppSidebar />
          <SidebarInset>
            <MainHeader />
            <Routes>
              <Route path="/ask" element={<AskPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/vulnerabilities" element={<VulnerabilitiesPage />} />
              <Route path="*" element={<Navigate to="/ask" replace />} />
            </Routes>
          </SidebarInset>
        </AutoResolveProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default App;
