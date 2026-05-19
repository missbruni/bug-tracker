import React from 'react'

const WALK_SPEED = 1.4
const MAX_WIGGLE = 5
const MAX_SMALL_TURN = 10
const MAX_LARGE_TURN = 150
const EDGE_RESISTANCE = 20
const BUG_SIZE = 48

function random(min: number, max: number) {
	return min + Math.random() * (max - min)
}

function deg2rad(deg: number) {
	return deg * (Math.PI / 180)
}

function LoadingDots() {
	const [count, setCount] = React.useState(0)
	React.useEffect(() => {
		const id = setInterval(() => setCount(c => (c + 1) % 4), 500)
		return () => clearInterval(id)
	}, [])
	return <>{'.'.repeat(count)}<span className="invisible">{'.'.repeat(3 - count)}</span></>
}

export default function PageLoader() {
	const canvasRef = React.useRef<HTMLCanvasElement>(null)
	const animRef = React.useRef<number>(0)
	const isDark = document.documentElement.classList.contains('dark')
	const bugColor = isDark ? '#00FFCC' : '#00A38C'

	React.useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const dpr = window.devicePixelRatio || 1
		const parent = canvas.parentElement!
		const cw = parent.offsetWidth
		const ch = parent.offsetHeight
		canvas.width = cw * dpr
		canvas.height = ch * dpr
		canvas.style.width = cw + 'px'
		canvas.style.height = ch + 'px'

		// Build two SVG frames with alternating leg positions for walk cycle
		const body = `<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/>
			<path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/>
			<path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/>
			<path d="M12 20v-9"/>`
		const legsA = `
			<g transform="rotate(6, 6.5, 9)"><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/></g>
			<g transform="rotate(-5, 6, 13)"><path d="M6 13H2"/></g>
			<g transform="rotate(6, 6.8, 17)"><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/></g>
			<g transform="rotate(-6, 17.5, 9)"><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/></g>
			<g transform="rotate(5, 18, 13)"><path d="M22 13h-4"/></g>
			<g transform="rotate(-6, 17.2, 17)"><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></g>`
		const legsB = `
			<g transform="rotate(-6, 6.5, 9)"><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/></g>
			<g transform="rotate(5, 6, 13)"><path d="M6 13H2"/></g>
			<g transform="rotate(-6, 6.8, 17)"><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/></g>
			<g transform="rotate(6, 17.5, 9)"><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/></g>
			<g transform="rotate(-5, 18, 13)"><path d="M22 13h-4"/></g>
			<g transform="rotate(6, 17.2, 17)"><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></g>`

		const makeFrame = (legs: string) =>
			`<svg xmlns="http://www.w3.org/2000/svg" width="${BUG_SIZE}" height="${BUG_SIZE}" viewBox="0 0 24 24" fill="none" stroke="${bugColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}${legs}</svg>`

		const frames: HTMLImageElement[] = []
		const urls: string[] = []
		for (const legs of [legsA, legsB]) {
			const b = new Blob([makeFrame(legs)], { type: 'image/svg+xml' })
			const u = URL.createObjectURL(b)
			urls.push(u)
			const i = new Image()
			i.src = u
			frames.push(i)
		}

		const startAngle = random(0, 360)
		const bug = {
			x: cw / 2,
			y: ch / 2,
			angle: startAngle,
			displayAngle: startAngle,
			displayX: cw / 2,
			displayY: ch / 2,
			smallTurnCounter: Math.round(random(5, 15)),
			largeTurnCounter: Math.round(random(20, 60)),
			largeTurnAngle: 0,
			frameIndex: 0,
			frameTick: 0,
		}

		let lastTime = 0

		const nearEdge = () => {
			let edge = 0
			if (bug.y < EDGE_RESISTANCE) edge |= 1
			if (bug.y > ch - EDGE_RESISTANCE) edge |= 2
			if (bug.x < EDGE_RESISTANCE) edge |= 4
			if (bug.x > cw - EDGE_RESISTANCE) edge |= 8
			return edge
		}

		const EDGE_DIRS: Record<number, number> = {
			1: 270, 2: 90, 4: 0, 8: 180,
			5: 315, 9: 225, 6: 45, 10: 135,
		}

		const animate = (t: number) => {
			animRef.current = requestAnimationFrame(animate)
			if (!frames[0].complete || !frames[1].complete) return

			const delta = t - lastTime
			if (delta < 40) return
			if (lastTime === 0) { lastTime = t; return }
			const dt = Math.min(delta, 200)
			lastTime = t

			const ctx = canvas.getContext('2d')
			if (!ctx) return

			ctx.clearRect(0, 0, canvas.width, canvas.height)
			ctx.save()
			ctx.scale(dpr, dpr)

			// edge avoidance
			const edge = nearEdge()
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

			// small turn + wiggle
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
			bug.x = Math.max(2, Math.min(cw - 2, bug.x))
			bug.y = Math.max(2, Math.min(ch - 2, bug.y))

			// cycle walk frame
			bug.frameTick++
			if (bug.frameTick >= 4) {
				bug.frameTick = 0
				bug.frameIndex = (bug.frameIndex + 1) % frames.length
			}

			// smooth interpolation for display
			const lerp = 0.15
			bug.displayX += (bug.x - bug.displayX) * lerp
			bug.displayY += (bug.y - bug.displayY) * lerp
			let angleDiff = bug.angle - bug.displayAngle
			if (angleDiff > 180) angleDiff -= 360
			if (angleDiff < -180) angleDiff += 360
			bug.displayAngle += angleDiff * lerp

			// draw rotated to face direction of movement
			ctx.save()
			ctx.translate(bug.displayX, bug.displayY)
			ctx.rotate(deg2rad(90 - bug.displayAngle))

			// glow
			ctx.shadowColor = isDark ? 'rgba(0, 255, 204, 0.5)' : 'rgba(0, 163, 140, 0.4)'
			ctx.shadowBlur = 8

			ctx.drawImage(frames[bug.frameIndex], -BUG_SIZE / 2, -BUG_SIZE / 2, BUG_SIZE, BUG_SIZE)
			ctx.restore()

			ctx.restore()
		}

		animRef.current = requestAnimationFrame(animate)
		return () => {
			if (animRef.current) cancelAnimationFrame(animRef.current)
			urls.forEach(u => URL.revokeObjectURL(u))
		}
	}, [isDark, bugColor])

	return (
		<div className="flex items-center justify-center min-h-[40vh]">
			<div className="relative">
				<canvas ref={canvasRef} className="absolute inset-0" />
				<span
					className="relative text-sm text-slate-700 dark:text-gray-300 pointer-events-none select-none block px-8 pt-24 pb-10"
					style={{ fontFamily: "'Press Start 2P', cursive" }}
				>
					Squashing bugs<LoadingDots />
				</span>
			</div>
		</div>
	);
}
