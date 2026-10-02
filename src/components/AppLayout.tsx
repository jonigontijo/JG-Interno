import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import SocialIntegrationAlert from "./social/SocialIntegrationAlert";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="lg:pl-60 min-h-screen">
        <div className="p-6 max-w-[1600px] mx-auto">
          <SocialIntegrationAlert />
          {children}
        </div>
      </main>
    </div>
  );
}
