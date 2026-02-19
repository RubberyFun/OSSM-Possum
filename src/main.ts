import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { Buffer } from 'buffer'

// Polyfill Buffer for Buttplug library
(globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer = Buffer

const isNativePlatform = !!(globalThis as typeof globalThis & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

if ('serviceWorker' in navigator && !isNativePlatform) {
  navigator.serviceWorker.register('sw.js')
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
