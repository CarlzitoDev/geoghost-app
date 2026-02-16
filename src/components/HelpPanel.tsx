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
      <SheetContent side="left" className="w-80 border-border/50 bg-card overflow-y-auto">
        <SheetHeader className="mb-8">
          <SheetTitle className="text-foreground text-sm">Help & Setup</SheetTitle>
          <SheetDescription className="text-muted-foreground text-xs">
            Get started with geoghost
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-7">
          {/* Getting Started */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <Smartphone className="h-3.5 w-3.5" />
              Getting Started
            </h3>
            <ol className="space-y-3 text-xs text-muted-foreground">
              {[
                "Connect your iPhone via USB cable",
                <>Tap <strong className="text-foreground">"Trust this computer"</strong> on your iPhone</>,
                <>Enable <strong className="text-foreground">Developer Mode</strong> in Settings → Privacy & Security</>,
                <>Click <strong className="text-foreground">Refresh</strong> in the device status panel</>,
              ].map((text, i) => (
                <li key={i} className="flex gap-2.5 leading-relaxed">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                    {i + 1}
                  </span>
                  {text}
                </li>
              ))}
            </ol>
          </section>

          {/* Troubleshooting */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <AlertTriangle className="h-3.5 w-3.5" />
              Troubleshooting
            </h3>
            <div className="space-y-3">
              {[
                { title: "Device not detected", desc: "Try a different USB cable or port. Make sure iTunes / Finder recognizes the device." },
                { title: "Permission denied", desc: 'Re-tap "Trust this computer" and restart the app. Ensure Developer Mode is enabled.' },
                { title: "Connection drops", desc: "Avoid using a USB hub. Use Apple-certified cables. Keep the device unlocked during setup." },
              ].map(({ title, desc }) => (
                <div key={title} className="rounded-lg bg-secondary/40 p-2.5">
                  <p className="text-xs font-medium text-foreground mb-0.5">{title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Contact */}
          <section>
            <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <HelpCircle className="h-3.5 w-3.5" />
              Contact
            </h3>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-xs text-foreground transition-all hover:bg-secondary"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open an issue on GitHub
            </a>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
