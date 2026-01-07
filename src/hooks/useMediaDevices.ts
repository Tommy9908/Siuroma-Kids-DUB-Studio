import { useState, useEffect, useCallback } from "react";

export interface DeviceList {
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
}

export function useMediaDevices() {
  const [devices, setDevices] = useState<DeviceList>({
    videoInputs: [],
    audioInputs: []
  });
  const [isScanning, setIsScanning] = useState(false);

  // Helper to filter and set devices
  const updateDeviceList = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
      const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
      
      // Log for debugging
      console.log("Devices Found:", videoInputs.map(d => d.label));
      
      setDevices({ videoInputs, audioInputs });
    } catch (e) {
      console.error("Enumeration error:", e);
    }
  };

  const refreshDevices = useCallback(async () => {
    setIsScanning(true);
    try {
      // 1. AGGRESSIVE WAKE UP
      // Requesting a stream forces the OS to check for available hardware (like iPhones)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720 }, // Asking for HD often wakes up high-end cams
        audio: true 
      });

      // 2. Wait a moment! 
      // iPhones via Continuity Camera take ~500ms to handshake after the request.
      setTimeout(async () => {
        // Stop the temporary stream (we just needed it to wake the device)
        stream.getTracks().forEach(track => track.stop());
        
        // 3. Now enumerate (The iPhone should be visible now)
        await updateDeviceList();
        setIsScanning(false);
      }, 1000); // 1 second delay ensures OS has time to register the device

    } catch (error) {
      console.warn("Permission/Stream error:", error);
      // Even if stream fails, try to list what we can see
      await updateDeviceList();
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    updateDeviceList();

    // Auto-detect plug/unplug events
    const handleDeviceChange = () => {
      console.log("Hardware change detected...");
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshDevices]);

  return { devices, refreshDevices, isScanning };
}
