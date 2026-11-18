import { create } from 'zustand'

/** Panels of the settings dialog; any page can open one directly (deep link). */
export type SettingsPanelId = 'appearance' | 'personal' | 'report' | 'phases' | 'areas' | 'statuses' | 'priorities' | 'budget' | 'calendar' | 'health'

export const useSettingsNav = create<{ panel: SettingsPanelId | null }>(() => ({ panel: null }))
export const openSettings = (panel: SettingsPanelId = 'appearance') => useSettingsNav.setState({ panel })
export const closeSettings = () => useSettingsNav.setState({ panel: null })
