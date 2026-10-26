import { ParallaxLayer } from "@/components/motion/ParallaxLayer";

const BLOCKS = [0, 1, 2, 3];
const BLOCK_WIDTH = 64;
const GAP = 28;

/** Flat, decorative audit-chain art: four linked blocks drawn with token fills (ANIM-36, ANIM-62). */
export function TrustChainArt({ className }) {
    const width = BLOCKS.length * BLOCK_WIDTH + (BLOCKS.length - 1) * GAP;
    return (
        <ParallaxLayer distance={60} className={className}>
            <svg
                viewBox={`0 0 ${width} 120`}
                className="h-auto w-full"
                focusable="false"
            >
                {BLOCKS.map((index) => {
                    const x = index * (BLOCK_WIDTH + GAP);
                    return (
                        <g key={index}>
                            {index > 0 ? (
                                <rect
                                    x={x - GAP}
                                    y="58"
                                    width={GAP}
                                    height="4"
                                    className="fill-primary"
                                />
                            ) : null}
                            <rect
                                x={x}
                                y="20"
                                width={BLOCK_WIDTH}
                                height="80"
                                rx="6"
                                className="fill-card stroke-border"
                            />
                            <rect
                                x={x + 10}
                                y="34"
                                width={BLOCK_WIDTH - 20}
                                height="6"
                                rx="3"
                                className="fill-muted"
                            />
                            <rect
                                x={x + 10}
                                y="50"
                                width={(BLOCK_WIDTH - 20) * 0.6}
                                height="6"
                                rx="3"
                                className="fill-muted"
                            />
                            <rect
                                x={x + 10}
                                y="78"
                                width={BLOCK_WIDTH - 20}
                                height="8"
                                rx="3"
                                className="fill-accent"
                            />
                        </g>
                    );
                })}
            </svg>
        </ParallaxLayer>
    );
}
