import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Lattice — A laser reflection puzzle game.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          position: "relative",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {/* Grid lines */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexWrap: "wrap",
            opacity: 0.12,
          }}
        >
          {Array.from({ length: 12 }).map((_, row) =>
            Array.from({ length: 20 }).map((_, col) => (
              <div
                key={`${row}-${col}`}
                style={{
                  width: 60,
                  height: 52.5,
                  border: "1px solid #222222",
                  boxSizing: "border-box",
                }}
              />
            ))
          )}
        </div>

        {/* Laser beam accent */}
        <div
          style={{
            position: "absolute",
            top: 290,
            left: 180,
            width: 840,
            height: 8,
            background: "rgba(255,45,45,0.2)",
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 292,
            left: 180,
            width: 840,
            height: 4,
            background: "#FF2D2D",
            borderRadius: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 293,
            left: 180,
            width: 840,
            height: 2,
            background: "#FFFFFF",
            borderRadius: 1,
          }}
        />

        {/* Emitter dot */}
        <div
          style={{
            position: "absolute",
            top: 282,
            left: 160,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(255,45,45,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#FF2D2D",
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 300,
              color: "#FFFFFF",
              letterSpacing: "0.35em",
              marginLeft: "0.35em",
            }}
          >
            LATTICE
          </div>
          <div
            style={{
              fontSize: 32,
              color: "rgba(255,255,255,0.65)",
              letterSpacing: "0.08em",
            }}
          >
            A laser reflection puzzle game.
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
