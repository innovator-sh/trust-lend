/**
 * Skeleton.jsx
 * Animated pulse skeleton loader matching Aether dark theme.
 * Usage: <Skeleton w="120px" h="28px" /> or <Skeleton w="100%" h="16px" r="8px" />
 */
import React from 'react';

export default function Skeleton({ w = '100%', h = '20px', r = '6px', className = '' }) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'linear-gradient(90deg, #1E2A3A 25%, #2a3a4e 50%, #1E2A3A 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
      }}
    />
  );
}

/* Skeleton row: label + value side by side */
export function SkeletonRow({ labelW = '80px', valueW = '120px' }) {
  return (
    <div className="flex justify-between items-center">
      <Skeleton w={labelW} h="12px" />
      <Skeleton w={valueW} h="18px" />
    </div>
  );
}

/* Skeleton card: full card placeholder */
export function SkeletonCard({ lines = 3, h = 'auto' }) {
  return (
    <div
      className="bg-white dark:bg-[#111827] p-8 rounded-[12px] border border-[#E8E8E8] dark:border-[#1E2A3A] space-y-4"
      style={{ height: h }}
    >
      <Skeleton w="40%" h="12px" />
      <Skeleton w="60%" h="28px" />
      {Array.from({ length: lines - 2 }).map((_, i) => (
        <Skeleton key={i} w={`${60 + Math.random() * 30}%`} h="14px" />
      ))}
    </div>
  );
}
