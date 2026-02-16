import { Ghost, MapPin, Settings, HelpCircle } from "lucide-react";
import { useState } from "react";
import { HelpPanel } from "./HelpPanel";
import { SettingsPanel } from "./SettingsPanel";

export function AppSidebar() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <aside className="flex h-screen w-[60px] flex-col items-center border-r border-border/50 bg-sidebar-background py-5">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center gap-1.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 glow-sm">
            <Ghost className="h-5 w-5 text-primary" />
          </div>
          <span className="text-[8px] font-semibold uppercase tracking-[0.2em] text-primary/70 text-glow">
            geo
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col items-center gap-1.5">
          <button
            className="group flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary glow-sm"
            title="App"
          >
            <MapPin className="h-4.5 w-4.5 transition-transform group-hover:scale-110" />
          </button>
        </nav>

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            className="group flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
            title="Help & Setup"
          >
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="group flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
            title="Settings"
          >
            <Settings className="h-4.5 w-4.5 transition-transform group-hover:rotate-45" />
          </button>
        </div>
      </aside>

      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />
      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
