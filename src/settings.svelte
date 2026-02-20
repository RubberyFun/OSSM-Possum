<script lang="ts" module>
    export type settingType = {
        label: string;
        value: number | string | boolean;
        type?: string;
        min?: number;
        max?: number;
        description?: string;
    };

    export const defaultSettings: Record<string, settingType> = {
        "strokerMode": {
            value: false,
            type: "boolean",
            label: "Stroker Mode",
            description: "When enabled this keeps the OSSM centered within its range to work with a piston for a stroker. Not for use with penetrative toys. See https://github.com/rubberyfun/OSSM-Job for more info."
        },
        "enableIncrementButtons": {
            value: false,
            type: "boolean",
            label: "Enable +/- Buttons for sliders",
            description: "When enabled this allows the use of increment buttons for fine control adjustments."
        },
        "keySpeedDown": {
            value: "-|_",
            label: "Key Speed Down",
            type: "keybinding",
            description: "The keybinding for lowering speed"
        },
        "keySpeedUp": {
            value: "=|+",
            label: "Key Speed Up",
            type: "keybinding",
            description: "The keybinding for increasing speed"
        },
        "keyStrokeDown": {
            value: "[|{",
            label: "Key Stroke Down",
            type: "keybinding",
            description: "The keybinding for lowering stroke"
        },
        "keyStrokeUp": {
            value: "]|}",
            label: "Key Stroke Up",
            type: "keybinding",
            description: "The keybinding for increasing stroke"
        },
        "keyDepthDown": {
            value: ";|:",
            label: "Key Depth Down",
            type: "keybinding",
            description: "The keybinding for lowering stroke depth"
        },
        "keyDepthUp": {
            value: "'|\"",
            label: "Key Depth Up",
            type: "keybinding",
            description: "The keybinding for increasing stroke depth"
        },
        "keySensationDown": {
            value: ",|<",
            label: "Key Sensation Down",
            type: "keybinding",
            description: "The keybinding for lowering sensation"
        },
        "keySensationUp": {
            value: ".|>",
            label: "Key Sensation Up",
            type: "keybinding",
            description: "The keybinding for increasing sensation"
        },
        "keyPatternDown": {
            value: "PageDown|Insert",
            label: "Key Pattern Down",
            type: "keybinding",
            description: "The keybinding for previous pattern"
        },
        "keyPatternUp": {
            value: "PageUp|Delete",
            label: "Key Pattern Up",
            type: "keybinding",
            description: "The keybinding for next pattern"
        },
        "keyPause": {
            value: " |p|P",
            label: "Key Pause",
            type: "keybinding",
            description: "The keybinding for pausing and unpausing motion"
        },
    };
</script>

<script lang="ts">
    let showSettings = $state(false);
    let settingsDialog = $state() as HTMLDialogElement;

    let settingsState = $state(structuredClone(defaultSettings));
    let { settings = $bindable(settingsState), onSettingsChanged, onSettingsReset }: { settings?: Record<string, settingType>; onSettingsChanged?: () => void; onSettingsReset?: () => void } = $props();
    const keybindingInputs = $state<Record<string, string>>({});

    export function openSettings() {
        showSettings = true;
        if (settingsDialog && !settingsDialog.open) {
            settingsDialog.showModal?.();
        }
    }

    function handleSettingChange(setting_name: string, value: number | string | boolean) {
        settings[setting_name as keyof typeof settings].value = value;
        onSettingsChanged?.();
    }

    function parseKeybindingValue(value: string): string[] {
        return value
            .split("|")
            .map((part) => part.trim())
            .filter((part) => part.length > 0);
    }

    function getKeySettingIds(): string[] {
        return Object.keys(settings).filter((key) => key.startsWith("key"));
    }

    function getNonKeySettingIds(): string[] {
        return Object.keys(settings).filter((key) => !key.startsWith("key"));
    }

    function updateKeybinding(settingId: string, values: string[]) {
        const cleaned = values
            .map((value) => value.replace(/\|/g, "").trim())
            .filter((value) => value.length > 0);
        handleSettingChange(settingId, cleaned.join("|"));
    }

    function removeKeybindingValue(settingId: string, value: string) {
        const current = parseKeybindingValue(
            String(settings[settingId as keyof typeof settings].value ?? "")
        );
        updateKeybinding(settingId, current.filter((entry) => entry !== value));
    }

    function addKeybindingValue(settingId: string) {
        const raw = keybindingInputs[settingId] ?? "";
        const cleaned = raw.replace(/\|/g, "").trim();
        if (!cleaned) {
            return;
        }
        const current = parseKeybindingValue(
            String(settings[settingId as keyof typeof settings].value ?? "")
        );
        if (current.includes(cleaned)) {
            keybindingInputs[settingId] = "";
            return;
        }
        updateKeybinding(settingId, [...current, cleaned]);
        keybindingInputs[settingId] = "";
    }

    function resetSettings() {
        settings = structuredClone(defaultSettings);
        onSettingsChanged?.();
        onSettingsReset?.();
    }

    function formatDescription(description: string): string {
        const escaped = description
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");

        return escaped.replace(
            /(https?:\/\/[^\s<]+)/g,
            (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
        );
    }


    function getSettingValue(id: string): string {
        const setting = settings[id as keyof typeof settings];
        if (setting.type === "%") {
        return Math.round(((setting.value as number) / (setting.max as number)) * 100).toString() + " %";
        } else if (setting.type === "yes/no") {
        return "" //setting.value === 1 ? "Yes" : "No";
        } else if (setting.type === "boolean") {
        return "" //setting.value === 1 ? "True" : "False";
        } else if (setting.type === "string") {
        return setting.value as string;
        } else if (setting.type === "keybinding") {
        return (setting.value as string).split("|").join(", ");
        } else {
        return `${setting.value} ${setting.type}`;
        }
    }



</script>


{#snippet InputSlider(id: string)}
  <div style="width: 100%;">
    <label for={id} title="{settings[id as keyof typeof settings].description}">
      {settings[id as keyof typeof settings].label} :
      {getSettingValue(id)}
      
    </label>
    <input
      {id}
      title="{settings[id as keyof typeof settings].description}"
      type="range"
      min={settings[id as keyof typeof settings].min}
      max={settings[id as keyof typeof settings].max}
      bind:value={settings[id as keyof typeof settings].value}
      style="width: 100%;"
      onchange={() =>
        handleSettingChange(id, settings[id as keyof typeof settings].value)}
    />
  </div>
{/snippet}

<dialog
    class="settingsDialog"
    style=""
    open={showSettings}
    bind:this={settingsDialog}
    onclose={() => (showSettings = false)}
>
  <!-- <div style="padding: 0; margin-top: 0;"> -->
    <button
      style="color: red; float:right; padding: 0 .1em 0 .1em; font-size: 3em; background: #555; cursor: pointer; line-height: .75em; display: flex; align-items: center; justify-content: center;"
      aria-label="Close settings"
    onclick={() => settingsDialog.close()}
    >
      &times;
    </button>
    <h2>Settings</h2>
    <hr />
     {#each getNonKeySettingIds() as settingId}
         {#if settings[settingId as keyof typeof settings].type === "string"}
            <div style="margin-bottom: 1em;">
            <label for={settingId} title="{settings[settingId as keyof typeof settings].description}">
                {settings[settingId as keyof typeof settings].label} 
                <span class="settingDescription">{@html formatDescription(settings[settingId as keyof typeof settings].description ?? "")}</span>
                {getSettingValue(settingId)}
            </label>
            <input
                id={settingId}
                title="{settings[settingId as keyof typeof settings].description}"
                type="text"
                bind:value={settings[settingId as keyof typeof settings].value}
                style="width: 100%;"
                onchange={() =>
                handleSettingChange(settingId, settings[settingId as keyof typeof settings].value)}
            />
            </div>
        {:else if settings[settingId as keyof typeof settings].type === "boolean"}
            <div style="margin-bottom: 1em;">
            <label for={settingId} title="{settings[settingId as keyof typeof settings].description}">
                {settings[settingId as keyof typeof settings].label} 
                <span class="settingDescription">{@html formatDescription(settings[settingId as keyof typeof settings].description ?? "")}</span>
                {getSettingValue(settingId)}
            </label>
            <input
                id={settingId}
                title="{settings[settingId as keyof typeof settings].description}"
                type="checkbox"
                checked={Boolean(settings[settingId as keyof typeof settings].value)}
                onchange={(event) =>
                handleSettingChange(settingId, (event.currentTarget as HTMLInputElement).checked)}
            />
            </div>
        {:else if settings[settingId as keyof typeof settings].type === "yes/no"}
            <div style="margin-bottom: 1em;">
            <label for={settingId} title="{settings[settingId as keyof typeof settings].description}">
                {settings[settingId as keyof typeof settings].label} 
                <span class="settingDescription">{@html formatDescription(settings[settingId as keyof typeof settings].description ?? "")}</span>
                {getSettingValue(settingId)}
            </label>
            <select
                id={settingId}
                title="{settings[settingId as keyof typeof settings].description}"
                bind:value={settings[settingId as keyof typeof settings].value}
                onchange={() =>
                handleSettingChange(settingId, settings[settingId as keyof typeof settings].value)}
            >
                <option value="1">Yes</option>
                <option value="0">No</option>
            </select>
            </div>
        {:else if settings[settingId as keyof typeof settings].type === "keybinding"}
            <div style="margin-bottom: 1em;">
                <label for={settingId} title="{settings[settingId as keyof typeof settings].description}">
                    {settings[settingId as keyof typeof settings].label} 
                    <span class="settingDescription">{@html formatDescription(settings[settingId as keyof typeof settings].description ?? "")}</span>
                </label>
                <div class="keybinding-values">
                    {#each parseKeybindingValue(String(settings[settingId as keyof typeof settings].value ?? "")) as value}
                        <span class="keybinding-chip">
                            {value}
                            <button
                                type="button"
                                class="keybinding-remove"
                                aria-label={`Remove ${value}`}
                                onclick={() => removeKeybindingValue(settingId, value)}
                            >
                                ×
                            </button>
                        </span>
                    {/each}
                </div>
                <div class="keybinding-input">
                    <input
                        id={settingId}
                        title="{settings[settingId as keyof typeof settings].description}"
                        type="text"
                        width="100px"
                        placeholder="Add key"
                        value={keybindingInputs[settingId] ?? ""}
                        oninput={(event) => {
                            const target = event.currentTarget as HTMLInputElement;
                            keybindingInputs[settingId] = target.value.replace(/\|/g, "");
                        }}
                        onkeydown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                addKeybindingValue(settingId);
                            }
                        }}
                    />
                    <button type="button" onclick={() => addKeybindingValue(settingId)}>Add</button>
                </div>
            </div>
        {:else if settings[settingId as keyof typeof settings].type === "%"}
            {@render InputSlider(settingId)}
        {:else}
            <div style="margin-bottom: 1em;">
            <label for={settingId} title="{settings[settingId as keyof typeof settings].description}">
                {settings[settingId as keyof typeof settings].label} 
                <span class="settingDescription">{@html formatDescription(settings[settingId as keyof typeof settings].description ?? "")}</span>
                {getSettingValue(settingId)}
            </label>
            <input
                id={settingId}
                title="{settings[settingId as keyof typeof settings].description}"
                type="range"
                min={settings[settingId as keyof typeof settings].min}
                max={settings[settingId as keyof typeof settings].max}
                bind:value={settings[settingId as keyof typeof settings].value}
                style="width: 100%;"
                onchange={() =>
                handleSettingChange(settingId, settings[settingId as keyof typeof settings].value)}
            />
            </div>
        {/if}   
    {/each}
    <details class="settings-accordion">
        <summary>Key Bindings</summary>
        {#each getKeySettingIds() as settingId}
            <div style="margin-bottom: 1em;">
                <label for={settingId} title="{settings[settingId as keyof typeof settings].description}">
                    {settings[settingId as keyof typeof settings].label} 
                    <span class="settingDescription">{@html formatDescription(settings[settingId as keyof typeof settings].description ?? "")}</span>
                </label>
                <div class="keybinding-values">
                    {#each parseKeybindingValue(String(settings[settingId as keyof typeof settings].value ?? "")) as value}
                        <span class="keybinding-chip">
                            {value}
                            <button
                                type="button"
                                class="keybinding-remove"
                                aria-label={`Remove ${value}`}
                                onclick={() => removeKeybindingValue(settingId, value)}
                            >
                                ×
                            </button>
                        </span>
                    {/each}
                </div>
                <div class="keybinding-input">
                    <input
                        id={settingId}
                        title="{settings[settingId as keyof typeof settings].description}"
                        type="text"
                        width="100px"
                        placeholder="Add key"
                        value={keybindingInputs[settingId] ?? ""}
                        oninput={(event) => {
                            const target = event.currentTarget as HTMLInputElement;
                            keybindingInputs[settingId] = target.value.replace(/\|/g, "");
                        }}
                        onkeydown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                addKeybindingValue(settingId);
                            }
                        }}
                    />
                    <button type="button" onclick={() => addKeybindingValue(settingId)}>Add</button>
                </div>
            </div>
        {/each}
    </details>

    <button type="button" class="settings-reset" onclick={() => resetSettings()}>
        Reset settings
    </button>

  <!-- </div> -->
</dialog>

<style>
.settingsDialog {
  padding: 1em;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: #333;
  max-width: 1000px;
    max-height: 90vh;
    overflow-y: auto;
  position: absolute; 
  top: 5%; 
  width: 80%; 
  margin: auto; 
  padding: 1em;  
  vertical-align: top;
}

.keybinding-values {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.4rem;
}

.keybinding-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.5rem;
    border: 1px solid #666;
    border-radius: 6px;
    background: #2b2b2b;
    color: #eee;
    font-size: 0.85rem;
}

.keybinding-remove {
    border: none;
    background: transparent;
    color: #ffb3b3;
    cursor: pointer;
    font-size: 0.9rem;
    line-height: 1;
    padding: 0;
}

.keybinding-input {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
}

.keybinding-input input {
    width: 100px;
    max-width: 100px;
}
.settingDescription {
    font-size: x-small;
    font-weight: normal;
    display: block;
    /* margin-top: 0.1em; */
}

.settings-accordion {
    margin-top: 1rem;
    border-top: 1px solid #444;
    padding-top: 0.75rem;
}

.settings-accordion summary {
    cursor: pointer;
    font-weight: 600;
    color: #ddd;
    margin-bottom: 0.5rem;
}

.settings-reset {
    margin: 0.5rem 0 0.75rem;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    border: 1px solid #555;
    background: #4e1e1e;
    color: #ff0000;
    cursor: pointer;
}

</style>