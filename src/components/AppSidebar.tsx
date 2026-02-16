import { Ghost, MapPin, Settings } from "lucide-react";
import { useState } from "react";
import { HelpPanel } from "./HelpPanel";

export function AppSidebar() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <aside className="flex h-screen w-16 flex-col items-center border-r border-border bg-sidebar-background py-4">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Ghost className="h-6 w-6 text-primary" />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-primary">
            geo
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center gap-2">
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors"
            title="App"
          >
            <MapPin className="h-5 w-5" />
          </button>
        </nav>

        {/* Settings at bottom */}
        <button
          onClick={() => setHelpOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Settings & Help"
        >
          <Settings className="h-5 w-5" />
        </button>
      </aside>

      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
