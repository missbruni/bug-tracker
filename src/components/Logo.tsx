import { Bug } from "lucide-react";
import React from "react";
import { playBugSound } from "../lib/audio";

interface LogoProps {
	showBugs?: boolean;
	onToggleBugs?: () => void;
}

export default function Logo({ showBugs, onToggleBugs }: LogoProps) {
	const bugButtonRef = React.useRef<HTMLButtonElement | null>(null);

	return (
		<h1
			className="text-lg md:text-[1.5em] font-bold flex items-center gap-1"
			style={{ fontFamily: "'Press Start 2P', 'Courier New', monospace" }}
		>
			<span
				className="text-[#00C9A7] dark:text-[#00FFCC]"
				style={{
					textShadow:
						"0 0 4px rgba(0,255,204,0.5), 0 0 12px rgba(0,255,204,0.3), 0 0 24px rgba(0,255,204,0.15)",
					animation: "neon-flicker 8s infinite",
				}}
			>
				Mushi
			</span>
			<button
				ref={bugButtonRef}
				onClick={() => {
					playBugSound();
					if (typeof bugButtonRef.current?.animate === "function") {
						bugButtonRef.current.animate(
							[
								{ transform: "scale(1)" },
								{ transform: "scale(1.18)" },
								{ transform: "scale(1)" },
							],
							{ duration: 220, easing: "ease-out" }
						);
					}
					onToggleBugs?.();
				}}
				className={`transition-colors cursor-pointer ${
					showBugs
						? "text-[#C944CD] hover:brightness-110"
						: "text-slate-300 dark:text-gray-600 hover:text-slate-500 dark:hover:text-gray-400"
				}`}
				style={
					showBugs
						? {
								filter: "drop-shadow(0 0 4px rgba(201,68,205,0.5)) drop-shadow(0 0 10px rgba(201,68,205,0.3))",
								animation: "neon-flicker 11s infinite 2s",
							}
						: undefined
				}
				title={`${showBugs ? "Hide" : "Show"} crawling bugs (⌘B)`}
			>
				<Bug size={26} />
			</button>
		</h1>
	);
}
