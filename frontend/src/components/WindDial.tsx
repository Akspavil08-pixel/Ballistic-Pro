interface WindDialProps {
  directionDeg: number;
  speedMps: number;
}

export function WindDial({ directionDeg, speedMps }: WindDialProps) {
  const angle = ((directionDeg % 360) + 360) % 360;
  const speedLabel = Number.isFinite(speedMps) ? speedMps.toFixed(1) : "—";

  const polar = (deg: number, radius: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return {
      x: 100 + Math.cos(rad) * radius,
      y: 100 + Math.sin(rad) * radius
    };
  };

  const wedgePath = (startDeg: number, endDeg: number, innerR: number, outerR: number) => {
    const startOuter = polar(startDeg, outerR);
    const endOuter = polar(endDeg, outerR);
    const startInner = polar(startDeg, innerR);
    const endInner = polar(endDeg, innerR);
    const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
      "Z"
    ].join(" ");
  };

  const wedgeStart = angle - 10;
  const wedgeEnd = angle + 10;

  return (
    <div className="wind-dial">
      <svg viewBox="0 0 200 200" className="wind-dial-svg" aria-label="Направление ветра">
        <circle cx="100" cy="100" r="92" fill="#050607" stroke="#2c2f35" strokeWidth="2" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="#101215" strokeWidth="2" />

        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const outer = 86;
          const inner = deg % 90 === 0 ? 68 : 74;
          const x1 = 100 + Math.sin(rad) * inner;
          const y1 = 100 - Math.cos(rad) * inner;
          const x2 = 100 + Math.sin(rad) * outer;
          const y2 = 100 - Math.cos(rad) * outer;
          return (
            <line
              key={`tick-${deg}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#3a3f46"
              strokeWidth={deg % 90 === 0 ? 2.5 : 1.2}
            />
          );
        })}

        <text x="100" y="38" textAnchor="middle" fontSize="18" fill="#9ca3af">12</text>
        <text x="162" y="106" textAnchor="middle" fontSize="18" fill="#9ca3af">3</text>
        <text x="100" y="176" textAnchor="middle" fontSize="18" fill="#9ca3af">6</text>
        <text x="38" y="106" textAnchor="middle" fontSize="18" fill="#9ca3af">9</text>

        <path d={wedgePath(wedgeStart, wedgeEnd, 38, 88)} fill="#e11d2e" opacity="0.95" />

        <polygon points="100,70 112,110 100,102 88,110" fill="#f8fafc" />
        <circle cx="100" cy="100" r="7" fill="#f8fafc" />

        <text x="100" y="96" textAnchor="middle" fontSize="14" fill="#e11d2e">{angle.toFixed(1)}°</text>
        <text x="100" y="122" textAnchor="middle" fontSize="12" fill="#31ff31">Скорость ветра, м/с</text>
        <text x="100" y="150" textAnchor="middle" fontSize="28" fill="#31ff31">{speedLabel}</text>
      </svg>
      <div className="wind-dial-label">
        Откуда дует: {angle.toFixed(0)}°
      </div>
    </div>
  );
}
