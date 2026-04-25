"use client";

import { motion } from "motion/react";

/**
 * 3D camera-tilt wrapper for the main charts.
 *
 * Animation: chart appears face-on, then over 1.6s the "camera" moves to
 * the upper-right of the scene. The chart tilts away at the top (rotateX
 * negative) and rotates so its right side recedes (rotateY positive).
 * Combined with CSS `perspective`, this gives a real 3D parallax.
 *
 * On hover the tilt softens (so users can read exact values without
 * distortion). Releases back to the camera angle on mouse leave.
 */
export function Chart3DWrapper({
  children,
  intensity = 1,
}: {
  children: React.ReactNode;
  /** 0 = no tilt, 1 = default, 1.5 = stronger. */
  intensity?: number;
}) {
  // Negative rotateX = top of chart tilts AWAY from viewer (camera above).
  // Positive rotateY = right side rotates AWAY (camera to the right).
  const rotX = -13 * intensity;
  const rotY = 8 * intensity;

  return (
    <div
      className="relative"
      style={{
        perspective: "1800px",
        perspectiveOrigin: "75% 25%",
      }}
    >
      {/* Soft floor shadow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 -bottom-2 h-12 rounded-full opacity-60 blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.8) 0%, transparent 70%)",
        }}
      />

      <motion.div
        initial={{ rotateX: 0, rotateY: 0, scale: 0.97 }}
        animate={{ rotateX: rotX, rotateY: rotY, scale: 1 }}
        transition={{
          duration: 1.6,
          delay: 0.3,
          ease: [0.22, 1, 0.36, 1],
        }}
        whileHover={{ rotateX: rotX * 0.35, rotateY: rotY * 0.35 }}
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: "50% 60%",
          willChange: "transform",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
