import styles from "./pixel-corners.module.css";

// Each four-cell piece starts at the outer corner and grows along its edges.
const shapes = [
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
];

export function PixelCorners({
  variant = "gold",
  seed = variant,
}: {
  variant?: "gold" | "mint" | "coral";
  seed?: string;
}) {
  // Stable variation keeps server rendering and client hydration identical.
  const hash = Array.from(seed).reduce(
    (value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0,
    0,
  );
  const first = hash % shapes.length;
  const second =
    (first + 1 + ((hash >>> 4) % (shapes.length - 1))) % shapes.length;
  return (
    <span className={styles.corners} data-pixel-corners="" aria-hidden="true">
      {[first, second].map((shape, index) => {
        const cells = shapes[shape];
        const width = (Math.max(...cells.map(([x]) => x)) + 1) * 8;
        const height = (Math.max(...cells.map(([, y]) => y)) + 1) * 8;
        return (
          <svg
            key={index}
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            data-shape={shape}
            data-color={
              (hash +
                index +
                (variant === "mint" ? 1 : variant === "coral" ? 2 : 0)) %
              4
            }
            shapeRendering="crispEdges"
          >
            {cells.map(([x, y]) => (
              <rect
                key={`${x}-${y}`}
                x={x * 8}
                y={y * 8}
                width="7"
                height="7"
              />
            ))}
          </svg>
        );
      })}
    </span>
  );
}
