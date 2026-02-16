import { useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { DeviceStatusCard } from "@/components/DeviceStatus";
import { MapPanel } from "@/components/MapPanel";
import { getDeviceStatus, type DeviceStatus } from "@/lib/mock-api";
import { useFavorites, useRecents } from "@/hooks/use-location-storage";

const Index = () => {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const { favorites, addFavorite, removeFavorite } = useFavorites();
  const { recents, addRecent } = useRecents();

  const refreshDevice = useCallback(async () => {
    setDeviceLoading(true);
    const status = await getDeviceStatus();
    setDeviceStatus(status);
    setDeviceLoading(false);
  }, []);

  useEffect(() => {
    refreshDevice();
  }, [refreshDevice]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main className="relative flex flex-1 flex-col overflow-hidden p-3">
        {/* Device status overlay */}
        <div className="absolute left-7 top-7 z-20">
          <DeviceStatusCard
            status={deviceStatus}
            onRefresh={refreshDevice}
            loading={deviceLoading}
          />
        </div>

        {/* Map */}
        <MapPanel
          deviceStatus={deviceStatus}
          favorites={favorites}
          recents={recents}
          onAddFavorite={addFavorite}
          onRemoveFavorite={removeFavorite}
          onAddRecent={addRecent}
        />
      </main>
    </div>
  );
};

export default Index;
