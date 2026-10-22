/**
 * Scene — placeholder for the generated realistic illustration.
 *
 * In production this is replaced by the author's generated/uploaded raster asset served from
 * R2. It exists as SVG here so the authoring and runtime surfaces can be built and reviewed
 * before the image pipeline lands.
 *
 * Gradient ids are namespaced with useId() so several instances (canvas, node thumbnails,
 * learner runtime) can coexist on one page without clobbering each other's defs.
 */
"use client";

import * as React from "react";

export function Scene({ className }: { className?: string }) {
  const raw = React.useId();
  const p = raw.replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg
      viewBox="0 0 1000 700"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id={`${p}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2E3A5C" />
          <stop offset="55%" stopColor="#54486B" />
          <stop offset="100%" stopColor="#8A6A63" />
        </linearGradient>
        <radialGradient id={`${p}mag`} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor="#FFE9A8" />
          <stop offset="34%" stopColor="#FFB07A" />
          <stop offset="72%" stopColor="#E5551F" />
          <stop offset="100%" stopColor="#8A2412" />
        </radialGradient>
        <linearGradient id={`${p}rock`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A5266" />
          <stop offset="100%" stopColor="#332C3D" />
        </linearGradient>
        <linearGradient id={`${p}lav`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FF8A3D" />
          <stop offset="100%" stopColor="#FFD854" />
        </linearGradient>
        <filter id={`${p}gl`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="15" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`${p}sf`}>
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <clipPath id={`${p}cn`}>
          <path d="M250 560 L485 215 L500 232 L515 215 L750 560 Z" />
        </clipPath>
      </defs>

      <rect width="1000" height="700" fill={`url(#${p}sky)`} />

      {/* ash & gas plume */}
      <g filter={`url(#${p}sf)`} fill="#D8D2DE">
        <ellipse cx="500" cy="150" rx="50" ry="42" opacity=".6" />
        <ellipse cx="460" cy="116" rx="39" ry="33" opacity=".54" />
        <ellipse cx="542" cy="120" rx="35" ry="31" opacity=".54" />
        <ellipse cx="500" cy="84" rx="35" ry="31" opacity=".45" />
        <ellipse cx="472" cy="58" rx="25" ry="23" opacity=".36" />
        <ellipse cx="526" cy="62" rx="23" ry="21" opacity=".34" />
      </g>

      {/* strata */}
      <rect x="0" y="560" width="1000" height="40" fill="#8A6849" />
      <rect x="0" y="600" width="1000" height="34" fill="#71533C" />
      <rect x="0" y="634" width="1000" height="34" fill="#5C4331" />
      <rect x="0" y="668" width="1000" height="40" fill="#49352A" />

      {/* magma chamber */}
      <ellipse cx="500" cy="612" rx="174" ry="60" fill={`url(#${p}mag)`} filter={`url(#${p}gl)`} />
      <ellipse cx="500" cy="612" rx="174" ry="60" fill={`url(#${p}mag)`} />

      {/* conduit */}
      <path
        d="M488 232 C486 330 496 430 486 500 L514 500 C504 430 514 330 512 232 Z"
        fill={`url(#${p}lav)`}
        filter={`url(#${p}gl)`}
      />

      {/* cone + internal layering */}
      <path d="M250 560 L485 215 L500 232 L515 215 L750 560 Z" fill={`url(#${p}rock)`} />
      <g clipPath={`url(#${p}cn)`} stroke="#6B6178" strokeWidth="4" fill="none" opacity=".5">
        <path d="M250 470 L750 470" />
        <path d="M290 400 L710 400" />
        <path d="M330 330 L670 330" />
      </g>

      {/* lava flow */}
      <path
        d="M512 236 L520 236 C600 340 650 450 726 558 L690 558 C628 456 580 356 512 260 Z"
        fill={`url(#${p}lav)`}
        opacity=".95"
      />
      <path
        d="M485 215 L500 232 L515 215"
        fill="none"
        stroke="#FFB07A"
        strokeWidth="3"
        opacity=".85"
      />
    </svg>
  );
}
