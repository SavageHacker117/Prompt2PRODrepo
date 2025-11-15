// src/grammars/pad.ts
/* Gamepad grammar + overlay + movement bridge */

type Dbg = {
  extend: (
    name: string,
    fn: (args: string[]) => string | string[],
    help: string,
  ) => void
}

type Engine = {
  movement?: {
    setDirection?: (dir: {
      forward?: boolean
      back?: boolean
      left?: boolean
      right?: boolean
    }) => void
  }
}

let overlayRoot: HTMLDivElement | null = null
let overlayStateEl: HTMLElement | null = null
let overlayLsEl: HTMLElement | null = null
let overlayRsEl: HTMLElement | null = null
let overlayLeds: NodeListOf<HTMLElement> | null = null

function ensureOverlay() {
  if (overlayRoot) return overlayRoot

  const root = document.createElement('div')
  root.className = 'pad-overlay-root'
  root.innerHTML = `
    <div class="pad-overlay">
      <div class="pad-overlay-pad">
        <div class="pad-led pad-led-ls" data-pad="ls"></div>
        <div class="pad-led pad-led-rs" data-pad="rs"></div>

        <div class="pad-led pad-led-dpad-up" data-pad="dpad-up"></div>
        <div class="pad-led pad-led-dpad-right" data-pad="dpad-right"></div>
        <div class="pad-led pad-led-dpad-down" data-pad="dpad-down"></div>
        <div class="pad-led pad-led-dpad-left" data-pad="dpad-left"></div>

        <div class="pad-led pad-led-face-south" data-pad="face-south"></div>
        <div class="pad-led pad-led-face-east" data-pad="face-east"></div>
        <div class="pad-led pad-led-face-west" data-pad="face-west"></div>
        <div class="pad-led pad-led-face-north" data-pad="face-north"></div>

        <div class="pad-led pad-led-l1" data-pad="l1"></div>
        <div class="pad-led pad-led-r1" data-pad="r1"></div>
        <div class="pad-led pad-led-l2" data-pad="l2"></div>
        <div class="pad-led pad-led-r2" data-pad="r2"></div>
      </div>

      <div class="pad-overlay-meta">
        <span class="pad-label">State:</span>
        <span class="pad-label pad-state">disconnected</span>
        <span class="pad-label">LS:</span>
        <span class="pad-label pad-ls">0, 0</span>
        <span class="pad-label">RS:</span>
        <span class="pad-label pad-rs">0, 0</span>
      </div>

      <div class="pad-hint">
        pad on · pad off · pad show · pad hide · pad map
        <br/>
        DualSense / Xbox using standard Gamepad mapping.
      </div>
    </div>
  `

  document.body.appendChild(root)

  overlayRoot = root
  overlayStateEl = root.querySelector('.pad-state')
  overlayLsEl = root.querySelector('.pad-ls')
  overlayRsEl = root.querySelector('.pad-rs')
  overlayLeds = root.querySelectorAll('[data-pad]') as NodeListOf<HTMLElement>

  return root
}

function destroyOverlay() {
  if (overlayRoot?.parentElement) overlayRoot.parentElement.removeChild(overlayRoot)
  overlayRoot = null
  overlayStateEl = null
  overlayLsEl = null
  overlayRsEl = null
  overlayLeds = null
}

function updateOverlay(pad: Gamepad | null) {
  if (!overlayRoot) return
  if (!overlayStateEl || !overlayLsEl || !overlayRsEl || !overlayLeds) {
    ensureOverlay()
  }
  if (!overlayStateEl || !overlayLsEl || !overlayRsEl || !overlayLeds) return

  if (!pad || !pad.connected) {
    overlayStateEl.textContent = 'disconnected'
    overlayLsEl.textContent = '0, 0'
    overlayRsEl.textContent = '0, 0'
    overlayLeds.forEach((el) => el.classList.remove('active'))
    return
  }

  const axes = pad.axes || []
  const buttons = pad.buttons || []
  const lx = axes[0] || 0
  const ly = axes[1] || 0
  const rx = axes[2] || 0
  const ry = axes[3] || 0

  overlayStateEl.textContent = pad.id || 'gamepad'
  overlayLsEl.textContent = `${lx.toFixed(2)}, ${ly.toFixed(2)}`
  overlayRsEl.textContent = `${rx.toFixed(2)}, ${ry.toFixed(2)}`

  const active: Record<string, boolean> = {}

  // Face buttons (standard mapping: 0-3)
  active['face-south'] = !!buttons[0]?.pressed // A / Cross (X)
  active['face-east'] = !!buttons[1]?.pressed // B / Circle
  active['face-west'] = !!buttons[2]?.pressed // X / Square
  active['face-north'] = !!buttons[3]?.pressed // Y / Triangle

  // Shoulder / trigger
  active['l1'] = !!buttons[4]?.pressed
  active['r1'] = !!buttons[5]?.pressed
  active['l2'] = !!buttons[6]?.pressed || (buttons[6]?.value ?? 0) > 0.3
  active['r2'] = !!buttons[7]?.pressed || (buttons[7]?.value ?? 0) > 0.3

  // D-pad (12-15)
  active['dpad-up'] = !!buttons[12]?.pressed
  active['dpad-down'] = !!buttons[13]?.pressed
  active['dpad-left'] = !!buttons[14]?.pressed
  active['dpad-right'] = !!buttons[15]?.pressed

  // Sticks: treat “moved past deadzone” as active glow
  const dead = 0.25
  if (Math.hypot(lx, ly) > dead) active['ls'] = true
  if (Math.hypot(rx, ry) > dead) active['rs'] = true

  overlayLeds.forEach((el) => {
    const key = el.dataset.pad || ''
    el.classList.toggle('active', !!active[key])
  })
}

// Small polling loop driven off rAF so it’s cheap and test-friendly
const padLoop = (() => {
  let running = false
  let rafId = 0
  let engineRef: Engine | null = null
  let connectedPad: Gamepad | null = null

  function step() {
    if (!running) return

    const pads = navigator.getGamepads
      ? Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[]
      : []

    const prevId = connectedPad?.id
    connectedPad = pads.find((p) => p && (p.mapping === 'standard' || p.id)) || null

    if (!connectedPad) {
      updateOverlay(null)
      rafId = requestAnimationFrame(step)
      return
    }

    const p = connectedPad
    const axes = p.axes || []
    const lx = axes[0] || 0
    const ly = axes[1] || 0

    const dead = 0.25
    let f = false,
      b = false,
      l = false,
      r = false

    if (Math.abs(ly) > dead) {
      if (ly < 0) f = true
      else b = true
    }
    if (Math.abs(lx) > dead) {
      if (lx < 0) l = true
      else r = true
    }

    if (engineRef?.movement?.setDirection) {
      engineRef.movement.setDirection({
        forward: f,
        back: b,
        left: l,
        right: r,
      })
    }

    // keep overlay in sync with buttons / sticks
    updateOverlay(connectedPad)

    if (prevId !== connectedPad.id) {
      console.log('[pad] using', connectedPad.id)
    }

    rafId = requestAnimationFrame(step)
  }

  return {
    start(engine: Engine) {
      if (running) return
      running = true
      engineRef = engine
      rafId = requestAnimationFrame(step)
    },
    stop() {
      if (!running) return
      running = false
      engineRef = null
      cancelAnimationFrame(rafId)
      updateOverlay(null)
    },
    isRunning() {
      return running
    },
  }
})()

export function registerPadGrammar(
  dbg: Dbg,
  engine: Engine,
  _levels: Record<string, unknown> = {},
  _extras: Record<string, unknown> = {},
) {
  dbg.extend(
    'pad',
    (args) => {
      const sub = (args[0] || '').toLowerCase()

      if (sub === 'help' || !sub) {
        return [
          'pad on        — start polling the first connected gamepad',
          'pad off       — stop polling',
          'pad show      — show overlay',
          'pad hide      — hide overlay',
          'pad map       — print button / axis indices',
          'pad info      — show basic pad info',
        ]
      }

      if (sub === 'on') {
        padLoop.start(engine)
        return 'pad loop started'
      }

      if (sub === 'off') {
        padLoop.stop()
        return 'pad loop stopped'
      }

      if (sub === 'show') {
        ensureOverlay()
        return 'overlay shown'
      }

      if (sub === 'hide') {
        destroyOverlay()
        return 'overlay hidden'
      }

      if (sub === 'map') {
        const pads = navigator.getGamepads
          ? Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[]
          : []
        if (!pads.length) return 'no gamepads connected'

        const p = pads[0]
        const lines: string[] = []
        lines.push(`id: ${p.id}`)
        lines.push(`buttons: ${p.buttons.length}`)
        p.buttons.forEach((b, i) => {
          lines.push(`  [${i}] pressed=${b.pressed} value=${b.value}`)
        })
        lines.push(`axes: ${p.axes.length}`)
        p.axes.forEach((a, i) => {
          lines.push(`  [${i}] ${a.toFixed(3)}`)
        })
        return lines
      }

      if (sub === 'info') {
        const pads = navigator.getGamepads
          ? Array.from(navigator.getGamepads()).filter(Boolean) as Gamepad[]
          : []
        if (!pads.length) return 'no gamepads connected'
        const p = pads[0]
        return [
          `id: ${p.id}`,
          `mapping: ${p.mapping}`,
          `buttons: ${p.buttons.length}`,
          `axes: ${p.axes.length}`,
        ]
      }

      return `Unknown pad subcommand: ${sub}`
    },
    'Gamepad controls (pad help)',
  )
}
