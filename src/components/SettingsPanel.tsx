import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RotateCcw, Map, Timer, Bookmark, Hash } from "lucide-react";
import { useSettings, type AppSettings } from "@/hooks/use-settings";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { settings, update, reset } = useSettings();

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
            <div className="space-y-3">
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

          {/* Simulation */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
              <Timer className="h-3.5 w-3.5" />
              Simulation
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Speed</Label>
                <span className="text-[11px] font-mono text-primary">{settings.simulationSpeed}s</span>
              </div>
              <Slider
                value={[settings.simulationSpeed]}
                onValueChange={([v]) => update({ simulationSpeed: v })}
                min={0.5}
                max={5}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/60">
                <span>Fast</span>
                <span>Slow</span>
              </div>
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

          {/* Reset */}
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
      </SheetContent>
    </Sheet>
  );
}
