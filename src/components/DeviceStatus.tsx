import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toggleDeviceConnection, toggleDevMode, type DeviceStatus } from "@/lib/mock-api";
import { RefreshCw, ChevronDown, ChevronUp, Cable, Smartphone, ShieldCheck, ShieldAlert } from "lucide-react";

interface DeviceStatusCardProps {
  status: DeviceStatus | null;
  onRefresh: () => void;
  loading: boolean;
}

export function DeviceStatusCard({ status, onRefresh, loading }: DeviceStatusCardProps) {
  const [expanded, setExpanded] = useState(false);
  const connected = status?.connected ?? false;
  const devMode = status?.developerMode ?? false;

  const dotClass = !connected
    ? "bg-destructive shadow-[0_0_8px_hsl(0,68%,52%)]"
    : !devMode
      ? "bg-[hsl(var(--warning))] shadow-[0_0_8px_hsl(45,93%,47%)]"
      : "bg-primary shadow-[0_0_8px_hsl(145,72%,46%)]";

  return (
    <div className="space-y-1.5">
      {/* Compact chip */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 rounded-xl glass px-3.5 py-2 text-sm transition-all hover:border-border active:scale-[0.98]"
      >
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <span className="text-foreground font-medium text-xs">
          {connected ? status?.name : "No Device"}
        </span>
        {expanded
          ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
          : <ChevronDown className="h-3 w-3 text-muted-foreground" />
        }
      </button>

      {/* Expanded card */}
      {expanded && (
        <Card className="w-72 glass-strong shadow-2xl shadow-black/30 animate-fade-in">
          <CardContent className="p-4 space-y-3">
            {connected && status ? (
              <div className="space-y-2.5 text-xs">
                {[
                  { label: "Device", value: status.name },
                  { label: "iOS", value: status.ios },
                  { label: "Connection", value: status.connection },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-foreground font-medium">{value}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Developer Mode</span>
                  <span className={`flex items-center gap-1 font-medium ${devMode ? "text-primary" : "text-[hsl(var(--warning))]"}`}>
                    {devMode ? "Enabled" : <><ShieldAlert className="h-3 w-3" /> Disabled</>}
                  </span>
                </div>
                {!devMode && (
                  <p className="text-[10px] text-[hsl(var(--warning))] leading-relaxed rounded-md bg-[hsl(var(--warning)/0.08)] px-2 py-1.5">
                    ⚠ Enable Developer Mode on your device for full functionality.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs font-medium text-destructive">Connect a device to get started:</p>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {[
                    { icon: Cable, text: "Connect iPhone via USB" },
                    { icon: Smartphone, text: 'Tap "Trust this computer"' },
                    { icon: ShieldCheck, text: "Enable Developer Mode" },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-center gap-2.5">
                      <Icon className="h-3.5 w-3.5 text-primary/70" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-1.5 pt-0.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={onRefresh}
                disabled={loading}
                className="flex-1 text-[11px] h-8"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { toggleDeviceConnection(); onRefresh(); }}
                className="text-[11px] h-8"
              >
                {connected ? "Disconnect" : "Connect"}
              </Button>
              {connected && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { toggleDevMode(); onRefresh(); }}
                  className="text-[11px] h-8"
                >
                  {devMode ? "Dev Off" : "Dev On"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
