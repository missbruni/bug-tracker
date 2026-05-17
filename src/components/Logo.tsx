import { Bug } from "lucide-react";
import { playBugSound } from "../lib/audio";

interface LogoProps {
	showBugs?: boolean;
	onToggleBugs?: () => void;
}

export default function Logo({ showBugs, onToggleBugs }: LogoProps) {
	return (
		<h1
			className="text-lg font-bold flex items-center gap-1"
			style={{ fontFamily: "'Press Start 2P', cursive" }}
		>
			<span
				className="text-[#00C9A7] dark:text-[#00FFCC]"
				style={{
					textShadow:
						"0 0 4px rgba(0,255,204,0.5), 0 0 12px rgba(0,255,204,0.3), 0 0 24px rgba(0,255,204,0.15)",
				}}
			>
				Mushi
			</span>
			<button
				onClick={() => {
					playBugSound();
					onToggleBugs?.();
				}}
				className={`transition-colors cursor-pointer ${
					showBugs
						? "text-[#C944CD] hover:brightness-110"
						: "text-slate-300 dark:text-gray-600 hover:text-slate-500 dark:hover:text-gray-400"
				}`}
				style={
					showBugs
						? { filter: "drop-shadow(0 0 4px rgba(201,68,205,0.5)) drop-shadow(0 0 10px rgba(201,68,205,0.3))" }
						: undefined
				}
				title={`${showBugs ? "Hide" : "Show"} crawling bugs (⌘B)`}
			>
				<Bug size={20} />
			</button>
		</h1>
	);
}
