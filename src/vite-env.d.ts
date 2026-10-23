/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __BUILD_DATE__: string

declare module 'frappe-gantt' {
  export interface FrappeTask {
    id: string
    name: string
    start: string
    end: string
    progress?: number
    dependencies?: string[]
    custom_class?: string
    color?: string
    color_progress?: string
    _start?: Date
    _end?: Date
  }
  export default class Gantt {
    constructor(wrapper: HTMLElement, tasks: FrappeTask[], options: Record<string, unknown>)
    refresh(tasks: FrappeTask[]): void
    change_view_mode(mode?: string, maintainPos?: boolean): void
    update_options(options: Record<string, unknown>): void
    clear(): void
    set_scroll_position(date: string): void
    $container: HTMLElement
  }
}
