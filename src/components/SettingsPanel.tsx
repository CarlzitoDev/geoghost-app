import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RotateCcw, Map, Route, Bookmark, Hash, Footprints, Bike, Car, ShieldAlert, Wifi } from "lucide-react";
import { useSettings, TRANSPORT_SPEEDS, type AppSettings, type TransportMode, type TunnelMode } from "@/hooks/use-settings";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { settings, update, reset } = useSettings();
  const [pendingTunnel, setPendingTunnel] = useState<TunnelMode | null>(null);

  const TUNNEL_OPTIONS: { value: TunnelMode; label: string; desc: string }[] = [
    { value: "auto", label: "Auto", desc: "Tries QUIC first, then falls back" },
    { value: "quic", label: "QUIC only", desc: "No sudo required, may not work on all setups" },
    { value: "sudo", label: "Sudo tunnel", desc: "Most reliable, requires sudo password" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 border-border/50 bg-card overflow-y-auto">
        <SheetHeader className="mb-8">
          <SheetTitle className="text-foreground text-sm">Settings</SheetTitle>
          <SheetDescription className="text-muted-foreground text-xs">
            Configure geoghost preferences
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Map Style */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <Map className="h-3.5 w-3.5" />
              Map
            </h3>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Map Style</Label>
              <Select
                value={settings.mapStyle}
                onValueChange={(v) => update({ mapStyle: v as AppSettings["mapStyle"] })}
              >
                <SelectTrigger className="w-28 h-7 text-[11px] bg-secondary/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="dark" className="text-xs">Dark</SelectItem>
                  <SelectItem value="satellite" className="text-xs">Satellite</SelectItem>
                  <SelectItem value="streets" className="text-xs">Streets</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator className="bg-border/40" />

          {/* Coordinates */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <Hash className="h-3.5 w-3.5" />
              Coordinates
            </h3>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select
                value={settings.coordinateFormat}
                onValueChange={(v) => update({ coordinateFormat: v as AppSettings["coordinateFormat"] })}
              >
                <SelectTrigger className="w-28 h-7 text-[11px] bg-secondary/50 border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="decimal" className="text-xs">Decimal</SelectItem>
                  <SelectItem value="dms" className="text-xs">DMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator className="bg-border/40" />

          {/* Transport Mode */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <Route className="h-3.5 w-3.5" />
              Route Simulation
            </h3>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Transport mode</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(TRANSPORT_SPEEDS) as TransportMode[]).map((mode) => {
                  const { label, icon, speed } = TRANSPORT_SPEEDS[mode];
                  const active = settings.transportMode === mode;
                  const IconComp = mode === "walk" ? Footprints : mode === "bike" ? Bike : Car;
                  return (
                    <button
                      key={mode}
                      onClick={() => update({ transportMode: mode })}
                      className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-center transition-all ${
                        active
                          ? "bg-primary/15 border border-primary/40 text-primary glow-sm"
                          : "bg-secondary/40 border border-border/40 text-muted-foreground hover:bg-secondary/60"
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                      <span className="text-[10px] font-medium">{label}</span>
                      <span className="text-[9px] text-muted-foreground">{speed} km/h</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                The marker moves at a realistic pace based on the distance between waypoints.
              </p>
            </div>
          </section>

          <Separator className="bg-border/40" />

          {/* History */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <Bookmark className="h-3.5 w-3.5" />
              History
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Auto-save recents</Label>
                <Switch
                  checked={settings.autoSaveRecents}
                  onCheckedChange={(v) => update({ autoSaveRecents: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Max recent locations</Label>
                <Select
                  value={String(settings.maxRecents)}
                  onValueChange={(v) => update({ maxRecents: parseInt(v) })}
                >
                  <SelectTrigger className="w-16 h-7 text-[11px] bg-secondary/50 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {[5, 10, 20, 50].map((n) => (
                      <SelectItem key={n} value={String(n)} className="text-xs">{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator className="bg-border/40" />

          {/* Dangerous Section */}
          <section className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold text-destructive uppercase tracking-wider">
              <ShieldAlert className="h-3.5 w-3.5" />
              Advanced
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Wifi className="h-3 w-3" />
                    Tunnel Mode
                  </Label>
                </div>
                <Select
                  value={settings.tunnelMode}
                  onValueChange={(v) => setPendingTunnel(v as TunnelMode)}
                >
                  <SelectTrigger className="w-28 h-7 text-[11px] bg-secondary/50 border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {TUNNEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                Controls how geoghost connects to your device for location spoofing on iOS 17+.
                Changing this may break the connection to your device.
              </p>
              <p className="text-[10px] text-destructive/70 leading-relaxed">
                Current: <span className="font-medium text-destructive">{TUNNEL_OPTIONS.find(o => o.value === settings.tunnelMode)?.label}</span> — {TUNNEL_OPTIONS.find(o => o.value === settings.tunnelMode)?.desc}
              </p>
            </div>
          </section>

          <Separator className="bg-border/40" />

          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            className="w-full text-xs text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-3 w-3 mr-1.5" />
            Reset to defaults
          </Button>
        </div>

        {/* Tunnel change warning dialog */}
        <AlertDialog open={!!pendingTunnel} onOpenChange={(open) => !open && setPendingTunnel(null)}>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Change Tunnel Mode?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs space-y-2">
                <span className="block">
                  You're switching to <strong>{TUNNEL_OPTIONS.find(o => o.value === pendingTunnel)?.label}</strong>.
                </span>
                <span className="block">
                  The tunnel is how geoghost communicates with your iPhone for location spoofing on iOS 17+.
                  Changing this setting will restart the tunnel connection, which may temporarily disconnect your device.
                </span>
                <span className="block text-destructive">
                  If you're unsure, keep it on "Auto" — it picks the best method automatically.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="text-xs h-8">Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="text-xs h-8 bg-destructive hover:bg-destructive/90"
                onClick={() => {
                  if (pendingTunnel) update({ tunnelMode: pendingTunnel });
                  setPendingTunnel(null);
                }}
              >
                Change Tunnel Mode
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
