import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Cable, ExternalLink, HelpCircle, Smartphone, AlertTriangle } from "lucide-react";

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpPanel({ open, onOpenChange }: HelpPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 border-border bg-card overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-foreground">Help & Setup</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Get started with geoghost
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Getting Started */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <Smartphone className="h-4 w-4" />
              Getting Started
            </h3>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                Connect your iPhone via USB cable
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                Tap <strong className="text-foreground">"Trust this computer"</strong> on your iPhone
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                Enable <strong className="text-foreground">Developer Mode</strong> in Settings → Privacy & Security
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
                Click <strong className="text-foreground">Refresh</strong> in the device status panel
              </li>
            </ol>
          </section>

          {/* Troubleshooting */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <AlertTriangle className="h-4 w-4" />
              Troubleshooting
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Device not detected</p>
                <p>Try a different USB cable or port. Make sure iTunes / Finder recognizes the device.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Permission denied</p>
                <p>Re-tap "Trust this computer" and restart the app. Ensure Developer Mode is enabled.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Connection drops</p>
                <p>Avoid using a USB hub. Use Apple-certified cables. Keep the device unlocked during setup.</p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
              <HelpCircle className="h-4 w-4" />
              Contact
            </h3>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary/80"
            >
              <ExternalLink className="h-4 w-4" />
              Open an issue on GitHub
            </a>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
