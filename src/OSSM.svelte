<script lang="ts">
  import { BleClient } from '@capacitor-community/bluetooth-le';
  import { Preferences } from '@capacitor/preferences';
  import { onMount } from 'svelte';
  import Settings, { defaultSettings, type settingType } from './settings.svelte';
  import pkg from '../package.json';

  let isWriting = false;

  interface OSSMcontrol {
    value: number;
    default: number;
    min: number;
    max: number;
    mode: string; // "manual", "pleasure", "arousal", "pressure", "denied" corresponding to EOM states
    inverted?: boolean;  // EOM function: invert the control
    limitMin?: number;  // EOM function: limit slider control
    limitMax?: number;  // EOM function: limit slider control
    description?: string;
  }

  interface OSSMPattern {
    name: string;
    idx: number;
    description?: string;
  }


  interface OSSMdevice {
    name: string;
    deviceId: string;
    service: string;
    tx: string;
    tx_knob: string;
    rx_state: string;
    rx_patterns: string;
    rw_pattern_descriptions: string;
    conn_status: string;
    ossm_state: string;
    unpause_speed: number;
    patterns: OSSMPattern[];
    controls: Record<string, OSSMcontrol>;
    isWriting: boolean;
    settings: Record<string, settingType>;
    setControl(name: string, value: number): Promise<void>;
    resetControls(): void;
  }


  class OSSMDevice implements OSSMdevice {
    name = $state("");
    //device = $state<BluetoothDevice | null>(null);
    service = "";
    rx_state = "";
    rx_patterns = "";
    tx = "";
    tx_knob = "";
    ossm_state = "";
    rw_pattern_descriptions = "";
    unpause_speed = 1;
    deviceId = $state<string>("");
    conn_status = $state("Disconnected");
    patterns = $state<OSSMPattern[]>([]);
    controls = $state<Record<string, OSSMcontrol>>({});
    isWriting = $state(false);
    settings = $state<Record<string, settingType>>(structuredClone(defaultSettings));

    getPatternByIdx(patterns: OSSMPattern[], idx: number): OSSMPattern | undefined {
      return patterns.find((pattern) => pattern.idx === idx);
    }

    getPatternIndexByIdx(patterns: OSSMPattern[], idx: number): number {
      return patterns.findIndex((pattern) => pattern.idx === idx);
    }


    constructor() {
      this.service = "522b443a-4f53-534d-0001-420badbabe69";
      this.tx = "522b443a-4f53-534d-1000-420badbabe69";
      this.tx_knob = "522b443a-4f53-534d-1010-420badbabe69";
      this.rx_state = "522b443a-4f53-534d-2000-420badbabe69";
      this.rx_patterns = "522b443a-4f53-534d-3000-420badbabe69";
      this.rw_pattern_descriptions = "522b443a-4f53-534d-3010-420badbabe69";
      this.unpause_speed = 1;
      this.ossm_state = "";
      this.controls = {
        speed: { value: 0, default: 0, min: 0, max: 100, mode: "pleasure", limitMin: 0, limitMax: 100, inverted: false, description: "Adjust how fast it goes back and forth" },
        stroke: { value: 50, default: 50, min: 0, max: 100, mode: "manual", limitMin: 0, limitMax: 100, inverted: false, description: "Adjust the length of each stroke"  },
        depth: { value: 10, default: 10, min: 0, max: 100, mode: "manual", limitMin: 0, limitMax: 100, inverted: false, description: "Adjust how deep the strokes go"  },
        pattern: { value: 0, default: 0, min: 0, max: 6, mode: "manual", limitMin: 0, limitMax: 6, inverted: false, description: "Choose from preset stroke patterns"  },
        sensation: { value: 50, default: 50, min: 0, max: 100, mode: "manual", limitMin: 0, limitMax: 100, inverted: false, description: "Adjust features of the current pattern.  50 = no adjustment"  },
      };
    }

    resetControls(): void {
      this.controls["speed"].value = this.controls["speed"].default;
      this.controls["stroke"].value = this.controls["stroke"].default;
      this.controls["depth"].value = this.controls["depth"].default;
      this.controls["pattern"].value = this.controls["pattern"].default;
      this.controls["sensation"].value = this.controls["sensation"].default;
    }

    async setControl(name: string, value: number, recursiveCommand: boolean = false): Promise<void> {
      console.log(`Setting OSSM control ${name} to value ${value}`);
      if (this.conn_status !== "Connected" || !this.deviceId) {
        disconnectDevice(this);
        console.error("Not connected to Bluetooth device",devices);
        return;
      }
      
      if (this.isWriting) {
        return;
      }
  
      try {
        const encoder = new TextEncoder();
        this.isWriting = true;
        let message = ""
        if (name !== "pattern") {
          message = "set:" + name + ":" + value;
        } else {
          //patterns are a special case where we send the idx but also update the pattern control value to the index of the pattern for better UX
          const pattern = $state.snapshot(this.patterns)[value];
          if (pattern) {
            console.log(`Setting pattern to '${pattern.name}' with idx ${pattern.idx}`);
            message = `set:${name}:${pattern.idx}`;
          } else {
            console.warn(`Pattern with idx ${value} not found, sending raw value`);
            message = `set:${name}:${value}`;
          }
        }
        const dataView = new DataView(encoder.encode(message).buffer);
        if (this.deviceId) await BleClient.write(this.deviceId, this.service, this.tx, dataView);
        if (name === "speed" && value === 0) {
          console.log(`Paused device, storing unpause speed ${this.unpause_speed}`, this.controls["speed"].value);
          this.unpause_speed = this.controls["speed"].value;
        }
        this.controls[name].value = value;
        console.log(`Wrote control ${name} with value ${value}`);
      } catch (error) {
        console.error("Failed writing control value:", error);
      } finally {
        this.isWriting = false;
        if (this.settings.strokerMode.value && !recursiveCommand) {
          //if its in stroker mode automatically adjust the depth to be centered proportionally to stroke changes, and vice versa. 
          if (name === "depth") {
            const derivedStroke = Math.round((value - 50) * 2);
            this.setControl("stroke", derivedStroke, true);
          } else if (name === "stroke") {
            const derivedDepth = Math.round((value / 2) + 50);
            this.setControl("depth", derivedDepth, true);
          }
        }
        if (name === "pattern") {
          this.setControl("sensation", 50, true);
          if (this.patterns[value].description === "") {
            setTimeout(() => {
              fetchPatternDescription(this, this.patterns[value]);
            }, 1000);
          }
        }
      }
    }
  }

//   let devices: OSSMdevice[] = $state([
//   ]);
  
  interface Props {
    devices: OSSMdevice[];
    EOMembedded?: boolean;
  }
  
  let { devices = $bindable([]), EOMembedded = false }: Props = $props();

  const devicesSnapshot = $derived((): OSSMdevice[] => devices);

  let settingsForDialog = $state<Record<string, any>>(structuredClone(defaultSettings));
  let settingsComponent: any;
  const openSettingsDialog = () => {
    settingsComponent?.openSettings?.();
  };

  $effect(() => {
    const firstDevice = devices[0];
    if (firstDevice?.settings) {
      settingsForDialog = firstDevice.settings;
    } else {
      settingsForDialog = structuredClone(defaultSettings);
    }
  });
  
  let connectionError = $state<string | null>(null);

  const DEVICES_PREFERENCES_KEY = "ossmpossum.devices";

  type StoredOSSMDevice = {
    name: string;
    deviceId: string | null;
    conn_status: string;
    unpause_speed: number;
    patterns: OSSMPattern[];
    controls: Record<string, OSSMcontrol>;
    settings: Record<string, settingType>;
  };

  function serializeDevicesForPreferences(): StoredOSSMDevice[] {
    return devices.map((device) => ({
      name: device.name,
      deviceId: device.deviceId,
      conn_status: device.conn_status,
      unpause_speed: device.unpause_speed,
      patterns: $state.snapshot(device.patterns),
      controls: $state.snapshot(device.controls),
      settings: $state.snapshot(device.settings),
    }));
  }

  async function saveDevicesToPreferences(): Promise<void> {
    try {
      const payload = serializeDevicesForPreferences();
      await Preferences.set({
        key: DEVICES_PREFERENCES_KEY,
        value: JSON.stringify(payload),
      });
    } catch (error) {
      console.warn("Failed to save devices to preferences:", error, logDevicesState("Current devices state:"));
    }
  }

  async function loadDevicesFromPreferences(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: DEVICES_PREFERENCES_KEY });
      if (!value) {
        return;
      }

      const stored = JSON.parse(value) as StoredOSSMDevice[] | null;
      if (!Array.isArray(stored)) {
        return;
      }

      devices = stored.map((entry) => {
        const restored = new OSSMDevice();
        restored.name = entry.name ?? "";
        restored.deviceId = entry.deviceId ?? "";
        restored.conn_status = "Disconnected";
        restored.unpause_speed = entry.unpause_speed ?? restored.unpause_speed;
        restored.patterns = entry.patterns ?? restored.patterns;
        restored.controls = entry.controls ?? restored.controls;
        restored.settings = entry.settings ?? restored.settings;

        const patternControl = restored.controls?.pattern;
        if (patternControl && restored.patterns?.length) {
          patternControl.max = restored.patterns.length - 1;
          patternControl.limitMax = restored.patterns.length - 1;
        }

        return restored;
      });
    } catch (error) {
      console.warn("Failed to load devices from preferences:", error, logDevicesState("Current devices state:"));
    }
  }

  function resetControlLimits(): void {
    devices = devices.map((device) => {
      const updatedControls: Record<string, OSSMcontrol> = {};
      for (const [name, control] of Object.entries(device.controls)) {
        updatedControls[name] = {
          ...control,
          limitMin: control.min,
          limitMax: control.max,
        };
      }
      device.controls = updatedControls;
      return device;
    });
    void saveDevicesToPreferences();
  }

  function logDevicesState(message: string) {
    try {
      const snapshot = devices.map((device) => {
        const controlsSnapshot = $state.snapshot(device.controls);
        const patternsSnapshot = $state.snapshot(device.patterns);
        const settingsSnapshot = $state.snapshot(device.settings);

        return {
          name: device.name,
          deviceId: device.deviceId,
          conn_status: device.conn_status,
          ossm_state: device.ossm_state,
          service: device.service,
          tx: device.tx,
          tx_knob: device.tx_knob,
          rx_state: device.rx_state,
          rx_patterns: device.rx_patterns,
          rw_pattern_descriptions: device.rw_pattern_descriptions,
          unpause_speed: device.unpause_speed,
          isWriting: device.isWriting,
          controls: controlsSnapshot,
          patterns: patternsSnapshot,
          settings: settingsSnapshot,
        };
      });
      console.log(message, snapshot);
    } catch (error) {
      console.warn("Failed to snapshot devices state:", error, logDevicesState("Current devices state:"));
    }
  }

  function upsertDevice(updated: OSSMdevice) {
    const index = devices.findIndex((entry) => entry.deviceId === updated.deviceId);
    if (index >= 0) {
      devices = [...devices.slice(0, index), updated, ...devices.slice(index + 1)];
    } else {
      devices = [...devices, updated];
    }
    void saveDevicesToPreferences();
  }

  function parseKeyBindings(settingsMap: Record<string, settingType>) {
    return Object.entries(settingsMap)
      .filter(([key, setting]) => key.startsWith("key") && typeof setting.value === "string")
      .map(([key, setting]) => {
        const stripped = key.replace(/^key/, "");
        const words = stripped.match(/[A-Z][a-z0-9]*/g) ?? [];
        if (words.length < 2) {
          return null;
        }
        const direction = words[words.length - 1].toLowerCase();
        if (direction !== "up" && direction !== "down") {
          return null;
        }
        const controlName = words.slice(0, -1).join("").toLowerCase();
        const rawValue = setting.value as string;
        const keys = rawValue.split("|").map((part) => {
          if (part === "") {
            return " ";
          }
          if (part.length === 1 && part === " ") {
            return " ";
          }
          return part.trim();
        }).filter((part) => part === " " || part.length > 0);

        return {
          controlName,
          delta: direction === "up" ? 1 : -1,
          keys,
        };
      })
      .filter((binding): binding is { controlName: string; delta: number; keys: string[] } => Boolean(binding));
  }

  function adjustControlValue(ossm: OSSMdevice, controlName: string, delta: number) {
    const control = ossm.controls[controlName];
    if (!control) {
      return;
    }
    const min = control.limitMin ?? control.min;
    const max = control.limitMax ?? control.max;
    const nextValue = Math.max(min, Math.min(max, Math.round(control.value + delta)));
    if (nextValue !== control.value) {
      ossm.setControl(controlName, nextValue);
    }
  }

  function isEditableTarget(target: EventTarget | null): boolean {
    if (!target || !(target instanceof HTMLElement)) {
      return false;
    }
    if (target.closest('.settingsDialog')) {
      return true;
    }
    const tagName = target.tagName.toLowerCase();
    return (tagName === "textarea" || target.isContentEditable);
  }

  onMount(() => {
    void loadDevicesFromPreferences();
    const handleKeydown = (event: KeyboardEvent) => {
      console.log("Keydown event:", event);
      if (isEditableTarget(event.target)) {
        console.log("Keydown event ignored due to editable target:", event.target);
        return;
      }

      const pressedKey = event.key;
      const pressedCode = event.code;

      for (const ossm of devices) {
        const deviceSettings = ossm.settings ?? defaultSettings;
        const bindings = parseKeyBindings(deviceSettings);
        if (!bindings.length) {
          console.log(`No key bindings configured for device '${ossm.name}'`);
          continue;
        }

        for (const binding of bindings) {
          if (!binding.keys.some((key) => key === pressedKey || key === pressedCode)) {
            continue;
          }

          event.preventDefault();
          const control = ossm.controls[binding.controlName];
          if (!control) {
            console.warn(`Control '${binding.controlName}' not found on device '${ossm.name}'`);
            break;
          }

          const min = control.limitMin ?? control.min;
          const max = control.limitMax ?? control.max;
          const nextValue = Math.max(min, Math.min(max, Math.round(control.value + binding.delta)));
          console.log(`Key binding triggered for control '${binding.controlName}' on device '${ossm.name}': current value ${control.value}, next value ${nextValue}`);
          if (nextValue !== control.value) {
            ossm.setControl(binding.controlName, nextValue);
          }

          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  });

  async function fetchPatternDescription(device: OSSMdevice, pattern: OSSMPattern | undefined): Promise<void> {
    if (!device.deviceId || !pattern || pattern.description) {
      return;
    }

    try {
      console.log(`Fetching description for pattern '${pattern.name}' with idx ${pattern.idx}`);
      const encoder = new TextEncoder();
      await BleClient.write(
        device.deviceId,
        device.service,
        device.rw_pattern_descriptions,
        new DataView(encoder.encode(pattern.idx.toString()).buffer)
      );

      const descriptionData = await BleClient.read(
        device.deviceId,
        device.service,
        device.rw_pattern_descriptions
      );

      const decoder = new TextDecoder();
      pattern.description = decoder.decode(descriptionData);
      device.patterns = device.patterns.map(p => p.idx === pattern.idx ? { ...p, description: pattern.description } : p);
      console.log(`Fetched description for pattern '${pattern.name}': ${pattern.description}`, device.patterns);
    } catch (error) {
      console.error("Failed to read pattern description:", error, logDevicesState("Current devices state:"));
    }
  }

  function disconnectDevice(device: OSSMdevice) {
    //devices = devices.filter(d => d.deviceId !== device.deviceId);
    //device.deviceId = null;
    device.conn_status = "Disconnected";
    device.resetControls();
  }

  async function readState(ossm: OSSMdevice) {
    // Read state from rx_state characteristic
    try {
      const stateData = await BleClient.read(ossm.deviceId, ossm.service, ossm.rx_state);
      const decoder = new TextDecoder();
      const stateString = decoder.decode(stateData);
      const stateObject = JSON.parse(stateString);
      
      // Update control values from device state
      if (stateObject.speed !== undefined) {
        ossm.controls.speed.value = stateObject.speed;
      }
      if (stateObject.stroke !== undefined) {
        ossm.controls.stroke.value = stateObject.stroke;
      }
      if (stateObject.depth !== undefined) {
        ossm.controls.depth.value = stateObject.depth;
      }
      if (stateObject.pattern !== undefined) {
        ossm.controls.pattern.value = stateObject.pattern;
      }
      if (stateObject.sensation !== undefined) {
        ossm.controls.sensation.value = stateObject.sensation;
      }
      if (stateObject.state !== undefined) {
        ossm.ossm_state = stateObject.state;
      }
      logDevicesState("State updated:");
    } catch (error) {
      console.error("Failed to read state:", error, logDevicesState("Current devices state:"));
    }

  }

  async function connectBluetooth() {
    let newOSSM = new OSSMDevice();
    connectionError = null;
    
    try {
      // Initialize BLE client
      await BleClient.initialize();
      

      const device = await BleClient.requestDevice({
        namePrefix: "OSSM",
        allowDuplicates: false,
        optionalServices: [newOSSM.service],
      });

      const connectedDevice = devices.find(
        (entry) => entry.deviceId === device.deviceId && entry.conn_status === "Connected"
      );
      if (connectedDevice) {
        alert(`Device '${connectedDevice.name} (${(connectedDevice.deviceId ? connectedDevice.deviceId.slice(-6,-2) : "")})' is already connected! (The list cannot be filtered)`);
        return;
      }

      const existingDevice = devices.find(
        (entry) => entry.deviceId === device.deviceId && entry.conn_status !== "Connected"
      );

      if (existingDevice) {
        newOSSM.settings = existingDevice.settings;
        newOSSM.controls = existingDevice.controls;
        newOSSM.patterns = existingDevice.patterns;
        newOSSM.unpause_speed = existingDevice.unpause_speed;
        newOSSM.conn_status = existingDevice.conn_status;
      }
      
      newOSSM.conn_status = "Connecting...";
      newOSSM.deviceId = device.deviceId;
      newOSSM.name = (device.name || "OSSM") + " (" + device.deviceId.slice(-6,-2) + ")";
      logDevicesState(`Connected to new device: ${newOSSM.name}`);


      
      // Connect to device with disconnect callback
      await BleClient.connect(device.deviceId, (deviceId) => {
        console.log(`Device ${deviceId} disconnected`);
        disconnectDevice(newOSSM);
      });

      
      
      // Read patterns from rx_patterns characteristic
      try {
        const patternsData = await BleClient.read(device.deviceId, newOSSM.service, newOSSM.rx_patterns);
        const decoder = new TextDecoder();
        const patternsString = decoder.decode(patternsData);
        const patternsObject = JSON.parse(patternsString);
        let indexFallback = 0;
        patternsObject.forEach((pattern: any) => {
          console.log("Pattern:", pattern);
          const idx = pattern.idx ?? indexFallback++;
          const existingIndex = newOSSM.patterns.findIndex((existing) => existing.idx === idx);
          const nextPattern: OSSMPattern = {
            name: pattern.name,
            idx,
            description: pattern.description ?? newOSSM.patterns[existingIndex]?.description ?? "",
          };

          if (existingIndex >= 0) {
            newOSSM.patterns[existingIndex] = nextPattern;
          } else {
            newOSSM.patterns.push(nextPattern);
          }
        });
        newOSSM.controls["pattern"].max = newOSSM.patterns.length - 1;
        newOSSM.controls["pattern"].limitMax = newOSSM.patterns.length - 1;
      } catch (error) {
        console.error("Failed to read patterns:", error, logDevicesState("Current devices state:"));
      }

      if (newOSSM.patterns.length > 0 && !newOSSM.patterns[newOSSM.controls.pattern.value].description) {
        await fetchPatternDescription(
          newOSSM,
          $state.snapshot(newOSSM.patterns)[newOSSM.controls.pattern.value]
        );
      }

      await readState(newOSSM);

      // Send startup sequence
      logDevicesState("sending startup sequence");
      const encoder = new TextEncoder();
      try {
        //const goMessage = encoder.encode("go:strokeEngine");
        if (!newOSSM.ossm_state.includes("strokeEngine") && !newOSSM.ossm_state.includes("error")) {
          console.log("Device not in strokeEngine/error mode, sending go command");
          const goDataView = new DataView(encoder.encode("go:strokeEngine").buffer);
          await BleClient.write(device.deviceId, newOSSM.service, newOSSM.tx, goDataView);
        } else {
          console.log("Device already in strokeEngine/error mode, skipping go command");
        }
        
        //set bluetooth to have full control of speed knob
        const falseMessage = encoder.encode("false");
        const falseDataView = new DataView(falseMessage.buffer);
        await BleClient.write(device.deviceId, newOSSM.service, newOSSM.tx_knob, falseDataView);


        console.log("Sent startup sequence");
      } catch (error) {
        console.error("Failed to send startup sequence:", error,logDevicesState("Current devices state:"));
      }


      newOSSM.conn_status = "Connected";

      upsertDevice(newOSSM);
      
      logDevicesState("Finished connecting and initializing device:");


    } catch (error) {
      console.error("Bluetooth connection failed:", error, devices);
      newOSSM.conn_status = "Connection failed";
      connectionError = error instanceof Error ? error.message : String(error);
    }
  }


</script>

<div class="bluetooth-ossm-control" style="--version: '{pkg.version}';">
  {#if devicesSnapshot().filter(device => device.conn_status === "Connected").length}
    {#each devicesSnapshot() as ossm, deviceIndex}
        <!-- <h4 style="position: absolute;left: 85px">{ossm.name}</h4> -->
      <div style="display: flex;flex-direction: row;justify-content: space-between;margin-bottom: 10px; ">

        <div>
          {#if ($state.snapshot(ossm.controls)["speed"].value > 0)} 
            <button class="device-pause" title="Pause" onclick={() => {
                  ossm.setControl("speed", 0);
            }}>
              <div style="line-height: 1.25;">❚❚</div>
            <div style="font-size: xx-small;">Pause</div>
            </button>
          {:else}
            <button class="device-resume" title="Pause" onclick={() => {
                  ossm.setControl("speed", $state.snapshot(ossm.unpause_speed));
            }}>
            ▶
            <div style="font-size: xx-small;">Resume</div>
            </button>
          {/if}
        </div>

        <div>
          <button class="device-settings" title="Settings" aria-label="Open settings" onclick={() => openSettingsDialog?.()}>
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path fill="#555" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.05 7.05 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.58.22-1.12.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.66 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.78 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.33.64.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.58-.22 1.12-.52 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
            </svg>
            <div style="font-size: xx-small;">Settings</div>
          </button>
        </div>

        <div>
          <button class="device-disconnect" title="Disconnect" onclick={async () => {
              if (ossm.deviceId) {
                await BleClient.disconnect(ossm.deviceId);
              }
          }}>
            ✕
          <div style="font-size: xx-small; font-weight: normal;">Disconnect</div>
          </button>
        </div>
      </div>

      {#each Object.entries($state.snapshot(ossm.controls)) as control, controlIndex}
        {#if (!(control[0] === "depth" && ossm.settings.strokerMode.value) && 
              !(control[0] === "sensation" && ossm.patterns[ossm.controls["pattern"].value]?.name === "Simple Stroke"))}

                <div class="slider-label">
                  {#if (control[0] === "pattern")}
                    Pattern: <span style="font-weight: normal;">{$state.snapshot(ossm.patterns)[control[1].value]?.name ?? control[1].value}</span>
                    <div class="minMaxText"  style="font-weight: normal;">{$state.snapshot(ossm.patterns)[control[1].value]?.description ?? ""}&nbsp;</div>
                  {:else}
                    {control[0].charAt(0).toUpperCase() + control[0].slice(1)}: {control[1].value} 
                    <span class="minMaxText">(Min: {control[1].limitMin}, Max: {control[1].limitMax})</span>
                  {/if}
                </div>

                {#if (EOMembedded)}
                <div>
                  <select id={deviceIndex + "-" + control[0] + "-mode"} onchange={async (e) => {
                      const mode = (e.target as HTMLSelectElement).value;
                      console.log(`Setting mode for ${ossm.name} ${control[0]} to ${mode}`);
                      control[1].mode = mode;
                  }}>
                      <option value="manual" selected={control[1].mode === "manual"}>Manual control only</option>
                      <option value="pleasure" selected={control[1].mode === "pleasure"}>Connect to Pleasure</option>
                      <option value="arousal" selected={control[1].mode === "arousal"}>Connect to Arousal</option>
                      <option value="pressure" selected={control[1].mode === "pressure"}>Connect to Pressure</option>
                      <option value="denied" selected={control[1].mode === "denied"}>Connect to Denials</option>
                  </select>
                  </div>
                  <div class="invertedText">
                    Invert:
                      <input type="checkbox" id={deviceIndex + "-" + control[0] + "-invert"} checked={control[1].inverted} onchange={async (e) => {
                          control[1].inverted = (e.target as HTMLInputElement).checked;
                      }}/>
                  </div>
                {/if}
                          <div class="device-sliders" title={control[1].description ?? ""}>

            <div style="display: flex;flex-direction: row;justify-content: space-between" >

            </div>

            <div class="slider-with-buttons">
              {#if ossm.settings?.enableIncrementButtons?.value}
                <button
                  class="slider-step down"
                  type="button"
                  aria-label={`Decrease ${control[0]}`}
                  onclick={() => adjustControlValue(ossm, control[0], -1)}
                >
                  -
                </button>
              {/if}
              <!-- svelte-ignore binding_property_non_reactive -->
              <input 
                  id={`control-${deviceIndex}-${control[0]}-slider`} 
                  class="main-slider"
                  type="range" 
                  min={control[1].limitMin ?? control[1].min}
                  max={control[1].limitMax ?? control[1].max} 
                  value={control[1].value}
                  style="background: hsl({controlIndex * (360 / Object.keys(ossm.controls).length)}, 30%, 50%);"
                  onpointerdown={(e) => {
                    const input = e.target as HTMLInputElement;
                    const rect = input.getBoundingClientRect();
                    const pointerX = e.clientX - rect.left;
                    const percentage = pointerX / rect.width;
                    const min = parseFloat(input.min);
                    const max = parseFloat(input.max);
                    const pointerValue = percentage * (max - min) + min;
                    // Use the stored control value, not the input value which might already be changed
                    const currentValue = control[1].value;
                    
                    // Prevent jump if pointer is far from current thumb position
                    const threshold = (max - min) * 0.1;
                    if (control[0] !== "pattern" && Math.abs(pointerValue - currentValue) > threshold) {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }
                  }}
                  onpointerup={(e) => {
                    const input = e.target as HTMLInputElement;
                    delete input.dataset.dragging;
                  }}
                  ontouchend={(e) => {
                    const input = e.target as HTMLInputElement;
                    delete input.dataset.dragging;
                  }}
                  oninput={(e) => {
                    const input = e.target as HTMLInputElement;
                    const newValue = parseInt(input.value);
                    
                    // For touchscreens: prevent jump if not actively dragging and jump is too large
                    if (control[0] !== "pattern" && !input.dataset.dragging && 
                        Math.abs(newValue - control[1].value) > (control[1].limitMax! - control[1].limitMin!) * 0.1) {
                      input.value = control[1].value.toString();
                      return;
                    }
                    
                    // Mark that we're now dragging after first valid input
                    input.dataset.dragging = "true";
                    
                    ossm.setControl(control[0], newValue);
                  }}/>
              {#if ossm.settings?.enableIncrementButtons?.value}
                <button
                  class="slider-step up"
                  type="button"
                  aria-label={`Increase ${control[0]}`}
                  onclick={() => adjustControlValue(ossm, control[0], 1)}
                >+</button>
              {/if}
            </div>
            {#if control[0] === "pattern"}
              <div class="pattern-numbers" style={`width: calc(100% - ${ossm.settings?.enableIncrementButtons?.value ? 130 : 40}px); margin-left: ${ossm.settings?.enableIncrementButtons?.value ? 65 : 20}px;`}>
                {#each Array.from({ length: control[1].max - control[1].min + 1 }, (_, i) => i + control[1].min) as num}
                  <span class="pattern-number" style="left: {(num - control[1].min) / (control[1].max - control[1].min) * 100}%;">{num + 1}</span>
                {/each}
              </div>
            {:else}
              <div class="slider">
                  <div id={`control-${deviceIndex}-${control[0]}-range-slider`} class="range-slider"></div>
              </div>
              <div class="range-input">
                  <input id={`control-${deviceIndex}-${control[0]}-min`} type="range" class="min-range"  step="1" 
                    min={control[1].min} 
                    max={control[1].max} 
                    value={control[1].limitMin}
                    oninput={(e) => {
                      const originalValue = control[1].limitMin ?? control[1].min;
                      control[1].limitMin = parseInt((e.target as HTMLInputElement)?.value ?? "0");
                      ossm.controls = { ...ossm.controls, [control[0]]: { ...control[1] } };
                      void saveDevicesToPreferences();
                      const rangeInput = document.querySelector(`#control-${deviceIndex}-${control[0]}-range-slider`) as HTMLInputElement;
                      rangeInput.style.left = `${control[1].limitMin / (control[1].max) * 100}%`;
                      const newValue = ((control[1].value - originalValue) / ((control[1].limitMax ?? control[1].max ) - originalValue)) *
                        ((control[1].limitMax ?? control[1].max) - (control[1].limitMin ?? control[1].min)) + (control[1].limitMin ?? control[1].min);
                      ossm.setControl(control[0], Math.round(newValue));
                    }} 
                  />
                  <input id={`control-${deviceIndex}-${control[0]}-max`} type="range" class="max-range"  step="1" 
                  min={control[1].min} 
                  max={control[1].max} 
                  value={control[1].limitMax} 
                  oninput={(e) => {
                      const originalValue = control[1].limitMax ?? control[1].max;
                      control[1].limitMax = parseInt((e.target as HTMLInputElement)?.value ?? control[1].max.toString());
                      ossm.controls = { ...ossm.controls, [control[0]]: { ...control[1] } };
                      void saveDevicesToPreferences();
                      const rangeInput = document.querySelector(`#control-${deviceIndex}-${control[0]}-range-slider`) as HTMLInputElement;
                      if (rangeInput) {
                        rangeInput.style.right = `${(control[1].max - (control[1].limitMax ?? control[1].max)) / control[1].max * 100}%`;
                      }
                      const newValue = ((control[1].value - (control[1].limitMin ?? control[1].min)) / (originalValue - (control[1].limitMin ?? control[1].min))) *
                        ((control[1].limitMax ?? control[1].max) - (control[1].limitMin ?? control[1].min)) + (control[1].limitMin ?? control[1].min);
                      ossm.setControl(control[0], Math.round(newValue));
                      logDevicesState(`devices[${deviceIndex}].controls['${control[0]}'].limitMax set to ${control[1].limitMax}!`);

                    }} 
                  />
              </div>
            {/if}
          </div>
        {/if}
      {/each}

    {/each}
    {:else}
    <div  style="font-size: small;">
      <p>This supports <a target="_blank" href="https://www.researchanddesire.com/pages/ossm">OSSM devices</a> with a stock firmware from 2026 or newer.</p>
      <p>If your OSSM firmware is older or custom you can easily upgrade it using <a href="https://dashboard.researchanddesire.com/app/tools/web-flasher">their web flashing tool</a>.</p>
      {#if (!EOMembedded)}
        <p>Coded with love and hedonism by <a href="http://rubberyfun.com/">Claus Macher</a>.  Main repo <a href="https://github.com/rubberyfun/OSSM-Possum">is posted here</a>.  Have fun!</p>
      {/if}
      <p></p>
    </div>
 {/if}
 {#if (EOMembedded || devices.filter(device => device.conn_status === "Connected").length == 0)}
   <div>
    <button onclick={() => connectBluetooth()}>
      Connect to an{#if devices.filter(device => device.conn_status === "Connected").length}other{:else}{/if} OSSM device
    </button>
    
  </div>
  {/if}
  
  {#if connectionError}
    <div style="color: #c00; font-weight: bold; margin-top: 10px; padding: 10px; background-color: #fee; border: 1px solid #faa; border-radius: 4px;">
      ⚠ Connection error: {connectionError}
      <button style="margin-left: 10px; font-size: small;" onclick={() => {
        connectionError = null;
      }}>Dismiss</button>
    </div>
  {/if}

</div>

<Settings
  bind:this={settingsComponent}
  bind:settings={settingsForDialog}
  onSettingsChanged={() => void saveDevicesToPreferences()}
  onSettingsReset={() => resetControlLimits()}
/>

<style>
  .bluetooth-ossm-control {
    margin: auto;
    width: 90%;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    border: 1px solid #ccc;
    margin-top:37px;
    margin-bottom: 5%;
        position: relative;

      &::before {
      content: var(--version);
      color: #666;
      position: absolute;
      top: -46px;
      left: 20%;
      transform: translateX(-50%);
      width: 30%;
        height: 50px;
        width: min(30%, 300px);
      background-image: url('/possum_head.svg');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      text-indent: 75vw;
    }

      &::after {
      content: '';
      position: absolute;
      left: 55%;
      bottom: -36px;

      transform: translateX(-50%);
        width: min(60%, 300px);
        height: 59px;
      background-image: url('/possum_tail.svg');
      background-size: 100% 60px;
      background-repeat: no-repeat;
      background-position: center;
    }

        /* larger screens */

    .slider-label {
      font-weight: bold;
      margin-bottom: 1px;
      white-space: nowrap;
    }
    .minMaxText {
      font-size: large;
      color: #ccc;
    }
    .invertedText {
      white-space: nowrap;
      font-size: small;
    }

    .device-disconnect {  
      color: #a99;
      background-color: transparent;
      font-weight: bold;
      float: right; 
      width: 4.8rem;
      text-align: center;
    }

    .device-settings {
      color: #666;
      background-color: transparent;
      width: 4.8rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
    }

    .device-pause {
      color: rgb(153, 0, 0);
      background-color: rgb(248, 188, 188);
      width: 4.8rem;
    }

    .device-resume {
      color: rgb(7, 186, 72);
      background-color: rgb(228, 248, 188);
      width: 4.8rem;
    }


    .device-sliders {
        display: flex;
        flex-direction: column;
        margin-bottom: 20px;
        gap: 0.5rem;
        margin-top: -.5rem;

        /* Remove Arrows/Spinners */
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }

        /* Main slider track styling */
        input[type="range"].main-slider {
            -webkit-appearance: none;
            appearance: none;
            background: #3a6dc1;
            cursor: pointer;
            height: 40px;
            border-radius: 20px;
            outline: none;
        }

        input[type="range"].main-slider::-webkit-slider-track {
            background: #3a6dc1;
            height: 40px;
            border-radius: 20px;
            border: none;
        }

        input[type="range"].main-slider::-moz-range-track {
            background: #3a6dc1;
            height: 40px;
            border-radius: 20px;
        }

        input[type="range"].main-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            height: 40px;
            width: 40px;
            border-radius: 20px;
            background: #aaccff;
            cursor: pointer;
            margin-top: 0;
        }

        input[type="range"].main-slider::-moz-range-thumb {
            height: 40px;
            width: 40px;
            border-radius: 20px;
            background: #aaccff;
            cursor: pointer;
            border: none;
        }

        .slider-with-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
        }

        .slider-with-buttons .main-slider {
          flex: 1;
          min-width: 0;
        }

        .slider-step {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          border: 1px solid #555;
          background: #2b2b2b;
          color: #eee;
          cursor: pointer;
          font-weight: bold;
        }
        .slider-step.up {
          padding: 0px;
          margin: auto;
        }

        .slider {
        width: 100%;
        height: 6px;
        position: relative;
        background: #333;
        border-radius: 5px;
        }
        .slider .range-slider {
            height: 100%;
            left: 0%;
            right: 0%;
            position: absolute;
            border-radius: 20px;
            background: #666;
        }    
        .range-input {
        position: relative;
        }

        .range-input input {
            position: absolute;
            width: 100%;
            height: 5px;
            background: none;
            top: -15px;
            pointer-events: none;
            cursor: pointer;
            -webkit-appearance: none;
            appearance: none;
        }


        /* Styles for the range thumb in WebKit browsers */
        input[type="range"]::-webkit-slider-thumb {
            height: 40px;
            width: 40px;
            border-radius: 20px;
            background: #333;
            pointer-events: auto;
            -webkit-appearance: none;
            position: relative;
        }

        /* Firefox thumb */
        input[type="range"]::-moz-range-thumb {
            height: 40px;
            width: 40px;
            border-radius: 20px;
            background: #333;
            pointer-events: auto;
            border: none;
        }

        /* Min range thumb - shows "min" text */
        input[type="range"].min-range::-webkit-slider-thumb {
            height: 18px;
            background: #444 url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="18"><text x="50%" y="13" font-family="Arial" font-size="10" fill="lightgray" text-anchor="middle">min</text></svg>') center/contain no-repeat;
        }

        input[type="range"].min-range::-moz-range-thumb {
            height: 18px;
            background: #444 url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="18"><text x="50%" y="13" font-family="Arial" font-size="10" fill="lightgray" text-anchor="middle">min</text></svg>') center/contain no-repeat;
        }

        /* Max range thumb - shows "max" text */
        input[type="range"].max-range::-webkit-slider-thumb {
            height: 18px;
            background: #444 url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="18"><text x="50%" y="13" font-family="Arial" font-size="10" fill="lightgray" text-anchor="middle">max</text></svg>') center/contain no-repeat;
        }

        input[type="range"].max-range::-moz-range-thumb {
            height: 18px;
            background: #444 url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="18"><text x="50%" y="13" font-family="Arial" font-size="10" fill="lightgray" text-anchor="middle">max</text></svg>') center/contain no-repeat;
        }

        /* Pattern numbers overlay */
        .pattern-numbers {
            position: relative;
            width: calc(100% - 40px);
            height: 20px;
            margin-left: 20px;
            margin-top: -38px;
            margin-bottom: 30px;
            z-index: 10;
            pointer-events: none;
        }

        .pattern-number {
            position: absolute;
            transform: translateX(-50%);
            font-size: 11px;
            color: #aaa;
            font-weight: bold;
            pointer-events: none;
            user-select: none;
        }
    }

    @media screen and (max-width: 800px) {
      .minMaxText {
        font-size: small;
      }
      .slider-label {
        font-weight: bold;
        font-size: small;
        margin-bottom: 0px;
      }

    }

    /* specific styles for mobile and smaller screens */
    @media screen and (max-width: 500px) {
      .slider-label {
        font-size: x-small;
        margin-bottom: 0px;
      }

      .minMaxText {
        font-size: xx-small;
      }
      .invertedText {
        white-space: nowrap;
        font-size: xx-small;
      }

        .device-sliders {
          margin-bottom: 0px;
          gap: 0.5rem;
        }
    }

}
</style>
