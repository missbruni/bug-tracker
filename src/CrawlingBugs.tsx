import React from 'react'
import { playSquashSound } from './lib/audio'

const SPRITE_URL = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/191814/fly-sprite.png'
const BUG_WIDTH = 13
const BUG_HEIGHT = 14
const NUM_FRAMES = 5
const MAX_BUGS = 20
const WALK_SPEED = 1.8
const MAX_WIGGLE = 5
const MAX_SMALL_TURN = 10
const MAX_LARGE_TURN = 150
const EDGE_RESISTANCE = 20
const ZOOM_MIN = 1
const ZOOM_MAX = 1.5

interface BugState {
  x: number
  y: number
  angle: number
  walkIndex: number
  frameCounter: number
  smallTurnCounter: number
  largeTurnCounter: number
  largeTurnAngle: number
  stationaryCounter: number
  stationary: boolean
  zoom: number
  wingsOpen: boolean
}

interface SplatDrop {
  angle: number
  dist: number
  size: number
  width: number
  isDot: boolean
}

interface SplatState {
  x: number
  y: number
  zoom: number
  drops: SplatDrop[]
  blobSeed: number
  progress: number
}

function createSplat(x: number, y: number, zoom: number): SplatState {
  const armCount = 4 + Math.floor(Math.random() * 3)
  const dotCount = 1 + Math.floor(Math.random() * 2)
  const arms: SplatDrop[] = Array.from({ length: armCount }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: 7 + Math.random() * 9,
    size: 1.3 + Math.random() * 1.8,
    width: 2 + Math.random() * 2.5,
    isDot: false,
  }))
  const dots: SplatDrop[] = Array.from({ length: dotCount }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: 13 + Math.random() * 6,
    size: 0.6 + Math.random() * 1.2,
    width: 0,
    isDot: true,
  }))
  return { x, y, zoom, drops: [...arms, ...dots], blobSeed: Math.random() * Math.PI * 2, progress: 0 }
}

function random(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180)
}

function createBug(containerW: number, containerH: number): BugState {
  return {
    x: random(EDGE_RESISTANCE, containerW - EDGE_RESISTANCE),
    y: random(EDGE_RESISTANCE, containerH - EDGE_RESISTANCE),
    angle: random(0, 360),
    walkIndex: 0,
    frameCounter: 0,
    smallTurnCounter: Math.round(random(5, 15)),
    largeTurnCounter: Math.round(random(20, 60)),
    largeTurnAngle: 0,
    stationaryCounter: Math.round(random(150, 400)),
    stationary: false,
    zoom: random(ZOOM_MIN, ZOOM_MAX),
    wingsOpen: Math.random() > 0.5,
  }
}

function nearEdge(bug: BugState, w: number, h: number) {
  let edge = 0
  if (bug.y < EDGE_RESISTANCE) edge |= 1 // top
  if (bug.y > h - EDGE_RESISTANCE) edge |= 2 // bottom
  if (bug.x < EDGE_RESISTANCE) edge |= 4 // left
  if (bug.x > w - EDGE_RESISTANCE) edge |= 8 // right
  return edge
}

const EDGE_DIRS: Record<number, number> = {
  1: 270, 2: 90, 4: 0, 8: 180,
  5: 315, 9: 225, 6: 45, 10: 135,
}

interface CrawlingBugsProps {
  count?: number
}

export default function CrawlingBugs({ count = 3 }: CrawlingBugsProps) {
  const numBugs = Math.min(Math.max(count, 0), MAX_BUGS)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const bugsRef = React.useRef<BugState[]>([])
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const animRef = React.useRef<number>(0)
  const lastTimeRef = React.useRef(0)
  const spriteRef = React.useRef<HTMLImageElement | null>(null)
  const spriteLoadedRef = React.useRef(false)
  const splatsRef = React.useRef<SplatState[]>([])

  React.useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = SPRITE_URL
    img.onload = () => {
      spriteRef.current = img
      spriteLoadedRef.current = true
    }
    spriteRef.current = img

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [numBugs])

  React.useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // init bugs
    const rect = container.getBoundingClientRect()
    bugsRef.current = Array.from({ length: numBugs }, () =>
      createBug(rect.width, rect.height)
    )
    splatsRef.current = []

    const handleClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      const cx = e.clientX - r.left
      const cy = e.clientY - r.top
      if (cx < 0 || cy < 0 || cx > r.width || cy > r.height) return
      const HIT_RADIUS = 18
      for (let i = bugsRef.current.length - 1; i >= 0; i--) {
        const bug = bugsRef.current[i]
        const dx = bug.x - cx
        const dy = bug.y - cy
        if (dx * dx + dy * dy < HIT_RADIUS * HIT_RADIUS * bug.zoom) {
          e.stopPropagation()
          e.preventDefault()
          splatsRef.current.push(createSplat(bug.x, bug.y, bug.zoom))
          bugsRef.current.splice(i, 1)
          playSquashSound()
          return
        }
      }
    }
    document.addEventListener('click', handleClick, true)

    const animate = (t: number) => {
      animRef.current = requestAnimationFrame(animate)

      if (!spriteLoadedRef.current) return

      const delta = t - lastTimeRef.current
      if (delta < 40) return
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = t
        return
      }
      const dt = Math.min(delta, 200)
      lastTimeRef.current = t

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const dpr = window.devicePixelRatio
      const w = canvas.width / dpr
      const h = canvas.height / dpr

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = false
      ctx.save()
      ctx.scale(dpr, dpr)

      for (const bug of bugsRef.current) {
        // stationary toggle
        bug.stationaryCounter--
        if (bug.stationaryCounter <= 0) {
          bug.stationary = !bug.stationary
          bug.stationaryCounter = bug.stationary ? Math.round(random(20, 60)) : Math.round(random(150, 400))
        }

        if (!bug.stationary) {
          // edge avoidance
          const edge = nearEdge(bug, w, h)
          if (edge && EDGE_DIRS[edge] !== undefined) {
            const target = EDGE_DIRS[edge]
            let diff = target - ((bug.angle % 360) + 360) % 360
            if (diff > 180) diff -= 360
            if (diff < -180) diff += 360
            if (Math.abs(diff) > 15) {
              bug.largeTurnAngle = diff
              bug.largeTurnCounter = 80
              bug.smallTurnCounter = 20
            }
          }

          // large turn
          bug.largeTurnCounter--
          if (bug.largeTurnCounter <= 0) {
            bug.largeTurnAngle = random(-MAX_LARGE_TURN, MAX_LARGE_TURN)
            bug.largeTurnCounter = Math.round(random(20, 60))
          }

          // small turn
          bug.smallTurnCounter--
          if (bug.smallTurnCounter <= 0) {
            bug.angle += random(-MAX_SMALL_TURN, MAX_SMALL_TURN)
            bug.smallTurnCounter = Math.round(random(5, 15))
          } else {
            let wiggle = random(-MAX_WIGGLE, MAX_WIGGLE)
            if ((bug.largeTurnAngle > 0 && wiggle < 0) || (bug.largeTurnAngle < 0 && wiggle > 0)) {
              wiggle = -wiggle
            }
            bug.largeTurnAngle -= wiggle
            bug.angle += wiggle
          }

          // move
          const rad = deg2rad(bug.angle)
          bug.x += Math.cos(rad) * WALK_SPEED * (dt / 100)
          bug.y -= Math.sin(rad) * WALK_SPEED * (dt / 100)

          // clamp
          bug.x = Math.max(2, Math.min(w - 2, bug.x))
          bug.y = Math.max(2, Math.min(h - 2, bug.y))

          // walk frame
          bug.frameCounter++
          if (bug.frameCounter >= 3) {
            bug.frameCounter = 0
            bug.walkIndex = (bug.walkIndex + 1) % NUM_FRAMES
          }
        }

        // draw
        ctx.save()
        ctx.translate(bug.x, bug.y)
        ctx.rotate(deg2rad(90 - bug.angle))
        ctx.scale(bug.zoom, bug.zoom)

        const sx = bug.stationary ? 0 : bug.walkIndex * BUG_WIDTH
        const sy = bug.wingsOpen ? 0 : BUG_HEIGHT

        if (spriteRef.current) {
          ctx.drawImage(
            spriteRef.current,
            sx, sy, BUG_WIDTH, BUG_HEIGHT,
            -BUG_WIDTH / 2, -BUG_HEIGHT / 2, BUG_WIDTH, BUG_HEIGHT
          )
        }
        ctx.restore()
      }

      // draw splats — organic blob shape
      const SPLAT_MS = 2000
      const FADE_AT = 0.75
      const splatColor = '#C944CD'
      splatsRef.current = splatsRef.current.filter(splat => {
        splat.progress += dt / SPLAT_MS
        if (splat.progress >= 1) return false
        const p = splat.progress
        const alpha = p < FADE_AT ? 0.7 : 0.7 * (1 - (p - FADE_AT) / (1 - FADE_AT))
        if (alpha <= 0) return true

        ctx.save()
        ctx.translate(splat.x, splat.y)
        ctx.fillStyle = splatColor
        ctx.globalAlpha = alpha

        // central wobbly blob
        const cR = 5 * splat.zoom
        ctx.beginPath()
        for (let i = 0; i <= 24; i++) {
          const a = (i / 24) * Math.PI * 2
          const wobble = cR * (0.85 + 0.15 * Math.sin(a * 3 + splat.blobSeed) + 0.1 * Math.sin(a * 5 + splat.blobSeed * 2))
          const bx = Math.cos(a) * wobble
          const by = Math.sin(a) * wobble
          if (i === 0) ctx.moveTo(bx, by)
          else ctx.lineTo(bx, by)
        }
        ctx.closePath()
        ctx.fill()

        // arms and dots
        for (const drop of splat.drops) {
          if (drop.isDot) {
            const dotX = Math.cos(drop.angle) * drop.dist * splat.zoom
            const dotY = Math.sin(drop.angle) * drop.dist * splat.zoom
            ctx.beginPath()
            ctx.arc(dotX, dotY, drop.size * splat.zoom, 0, Math.PI * 2)
            ctx.fill()
            continue
          }
          // tapered arm with rounded tip
          const len = drop.dist * splat.zoom
          const tipR = drop.size * splat.zoom
          const baseW = drop.width * splat.zoom
          const cos = Math.cos(drop.angle)
          const sin = Math.sin(drop.angle)
          const nx = -sin
          const ny = cos

          ctx.beginPath()
          ctx.moveTo(nx * baseW, ny * baseW)
          ctx.quadraticCurveTo(
            cos * len * 0.5 + nx * baseW * 0.4,
            sin * len * 0.5 + ny * baseW * 0.4,
            cos * len, sin * len
          )
          ctx.arc(cos * len, sin * len, tipR, drop.angle - Math.PI / 2, drop.angle + Math.PI / 2)
          ctx.quadraticCurveTo(
            cos * len * 0.5 - nx * baseW * 0.4,
            sin * len * 0.5 - ny * baseW * 0.4,
            -nx * baseW, -ny * baseW
          )
          ctx.closePath()
          ctx.fill()
        }

        ctx.restore()
        return true
      })

      ctx.restore()
    }

    animRef.current = requestAnimationFrame(animate)

    return () => {
      ro.disconnect()
      document.removeEventListener('click', handleClick, true)
      if (animRef.current) cancelAnimationFrame(animRef.current)
      lastTimeRef.current = 0
    }
  }, [numBugs])

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
