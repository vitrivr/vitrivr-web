import {createContext, useContext, useState, type PropsWithChildren} from "react";
import {defaultFrontendSettings, normalizeFrontendSettings, readFrontendSettings, SETTINGS_STORAGE_KEY, type FrontendSettings} from "../config/frontendSettings.ts";

type SettingsContext = {settings: FrontendSettings; saveSettings: (settings: FrontendSettings) => boolean};
const Context = createContext<SettingsContext | null>(null);

export function FrontendSettingsProvider({children}: PropsWithChildren) {
    const [settings, setSettings] = useState<FrontendSettings>(() => {
        try { return readFrontendSettings(localStorage.getItem(SETTINGS_STORAGE_KEY)); }
        catch { return defaultFrontendSettings(); }
    });
    const saveSettings = (value: FrontendSettings) => {
        const next = normalizeFrontendSettings(value);
        setSettings(next);
        try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)); return true; }
        catch { return false; }
    };
    return <Context.Provider value={{settings, saveSettings}}>{children}</Context.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFrontendSettings() {
    const value = useContext(Context);
    if (!value) throw new Error("Frontend settings provider is missing.");
    return value;
}
