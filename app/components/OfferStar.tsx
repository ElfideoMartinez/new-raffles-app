'use client'
import React, { useEffect, useState } from "react";

interface OfferStarProps {
  text: string;
  size?: number;
  fillColor?: string;
  textColor?: string;
  strokeColor?: string;
  spikes?: number;
  innerRatio?: number;
}

const OfferStar: React.FC<OfferStarProps> = ({
  text,
  size = 45,
  fillColor = "#facc15",
  textColor = "#000000",
  strokeColor = "#000000",
  spikes = 24,
  innerRatio = 0.8, 
}) => {

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  const totalPoints = spikes * 2;

  const points = Array.from({ length: totalPoints }).map((_, i) => {
    const angle = (i * Math.PI * 2) / totalPoints;
    const radius = i % 2 === 0 ? size : size * innerRatio;
    const x = size + radius * Math.cos(angle);
    const y = size + radius * Math.sin(angle);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="relative inline-block">
      <svg width={size * 2} height={size * 2}>
        <polygon
          points={points}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="2"
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={size * 0.5}
          fontWeight="bold"
        >
          ${text}
        </text>
      </svg>
    </div>
  );
};

export default OfferStar;
