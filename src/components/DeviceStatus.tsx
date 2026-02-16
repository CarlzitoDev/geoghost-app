import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDeviceStatus, toggleDeviceConnection, toggleDevMode, type DeviceStatus } from "@/lib/mock-api";
import { RefreshCw, Wifi, WifiOff, ChevronDown, ChevronUp, Cable, Smartphone, ShieldCheck, ShieldAlert } from "lucide-react";

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
    ? "bg-destructive shadow-[0_0_6px_hsl(0,72%,55%)]"
    : !devMode
      ? "bg-yellow-500 shadow-[0_0_6px_hsl(45,100%,50%)]"
      : "bg-primary shadow-[0_0_6px_hsl(142,72%,50%)]";

  return (
    <div className="space-y-1">
      {/* Compact chip */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <span className="text-foreground">{connected ? status?.name : "No Device"}</span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {/* Expanded card */}
      {expanded && (
        <Card className="w-72 border-border bg-card shadow-lg">
          <CardContent className="p-4 space-y-3">
            {connected && status ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Device</span>
                  <span className="text-foreground">{status.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">iOS</span>
                  <span className="text-foreground">{status.ios}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connection</span>
                  <span className="text-foreground">{status.connection}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Developer Mode</span>
                  <span className={devMode ? "text-primary" : "text-yellow-500 flex items-center gap-1"}>
                    {devMode ? "Enabled" : <><ShieldAlert className="h-3.5 w-3.5" /> Disabled</>}
                  </span>
                </div>
                {!devMode && (
                  <p className="text-[10px] text-yellow-500">⚠ Enable Developer Mode on your device for full functionality.</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-destructive">Connect a device to get started:</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Cable className="h-3.5 w-3.5 text-primary" />
                    Connect iPhone via USB
                  </li>
                  <li className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5 text-primary" />
                    Tap "Trust this computer"
                  </li>
                  <li className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Enable Developer Mode
                  </li>
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={onRefresh}
                disabled={loading}
                className="flex-1 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { toggleDeviceConnection(); onRefresh(); }}
                className="text-xs"
              >
                {connected ? "Simulate Disconnect" : "Simulate Connect"}
              </Button>
              {connected && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { toggleDevMode(); onRefresh(); }}
                  className="text-xs"
                >
                  {devMode ? "Disable Dev" : "Enable Dev"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
