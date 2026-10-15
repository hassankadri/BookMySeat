
import React, { useMemo } from "react";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

// =====================================================
// BOOKMYSEAT — CSS 3D AUDITORIUM
// =====================================================
//
// Original cinema seats and camera transforms.
//
// Screen:
// - No trailers
// - No posters
// - No movie titles
// - Subtle silver illumination
// - Dark cinematic vignette
//
// No API requests.
// =====================================================

const PERSPECTIVE = 1400;
const SCREEN_Z = 1300;
const SCREEN_Y = -96;

// =====================================================
// ORIGINAL SEAT COLORS
// =====================================================

const hex = (h) =>
  [1, 3, 5].map((i) =>
    parseInt(h.slice(i, i + 2), 16)
  );

const mix = (a, b, t) => {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);

  const m = (x, y) =>
    Math.round(x + (y - x) * t);

  return `rgb(${m(r1, r2)},${m(g1, g2)},${m(b1, b2)})`;
};

// =====================================================
// ORIGINAL CINEMA SEAT GENERATION
// =====================================================

const buildHall = (mobile) => {
  const cfg = mobile
    ? {
        rows: 4,
        pitch: 58,
        rho: 640,
        step: 120,
        count: 8,
        grow: 2,
        y: 215,
        dy: 56,
        w: 46,
        h: 56,
      }
    : {
        rows: 6,
        pitch: 92,
        rho: 660,
        step: 130,
        count: 10,
        grow: 2,
        y: 235,
        dy: 42,
        w: 72,
        h: 86,
      };

  const seats = [];
  const lights = [];

  for (let k = 0; k < cfg.rows; k += 1) {
    const rho =
      cfg.rho + k * cfg.step;

    const count =
      cfg.count + k * 2;

    const dTheta =
      cfg.pitch / rho;

    const y =
      cfg.y + k * cfg.dy;

    const dim =
      0.12 +
      (k / (cfg.rows - 1)) * 0.7;

    const colors = {
      "--c1": mix(
        "#9a9a9a",
        "#000000",
        dim
      ),

      "--c2": mix(
        "#555555",
        "#000000",
        dim
      ),

      "--c3": mix(
        "#262626",
        "#000000",
        dim * 0.85
      ),
    };

    for (
      let j = 0;
      j < count;
      j += 1
    ) {
      const offset =
        j - (count - 1) / 2;

      const theta =
        offset * dTheta;

      const x =
        rho * Math.sin(theta);

      const z =
        -SCREEN_Z +
        rho * Math.cos(theta);

      const delay =
        600 +
        k * 110 +
        Math.abs(offset) * 16;

      if (Math.abs(offset) < 1) {
        lights.push({
          key: `l${k}-${j}`,
          x,
          y: y + cfg.h / 2 + 8,
          z: z + 6,
          delay,
        });

        continue;
      }

      seats.push({
        key: `s${k}-${j}`,
        x,
        y,
        z,
        theta,
        delay,
        colors,
      });
    }
  }

  return {
    seats,
    lights,
    w: cfg.w,
    h: cfg.h,
  };
};

// =====================================================
// EMPTY CINEMA SCREEN
// =====================================================

const EmptyScreen = () => (
  <div
    className="bms-screen absolute inset-0 overflow-hidden rounded-[6px] bg-[#09090b]"
    aria-hidden="true"
  >
    {/* Soft illumination, not a movie image. */}
    <div
      className="absolute inset-0"
      style={{
        background:
          "radial-gradient(ellipse 75% 85% at 50% 42%, rgba(175,175,185,0.19) 0%, rgba(65,65,73,0.12) 46%, rgba(8,8,11,0.96) 100%)",
      }}
    />

    {/* Screen edge shadow. */}
    <div
      className="absolute inset-0"
      style={{
        boxShadow:
          "inset 0 0 110px 25px rgba(0,0,0,0.6)",
      }}
    />
  </div>
);

// =====================================================
// AUDITORIUM
// =====================================================

const HallFallback = ({
  progress,
  mobile,
  pinned,
}) => {
  const reduce = useReducedMotion();

  const hall = useMemo(
    () => buildHall(mobile),
    [mobile]
  );

  const live =
    pinned && !reduce;

  // ===================================================
  // ORIGINAL POINTER PARALLAX
  // ===================================================

  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const smx = useSpring(mx, {
    stiffness: 60,
    damping: 18,
  });

  const smy = useSpring(my, {
    stiffness: 60,
    damping: 18,
  });

  const baseYaw = mobile
    ? 0
    : 11;

  const rotateY = useTransform(
    smx,
    [-1, 1],
    [
      baseYaw - 2.4,
      baseYaw + 2.4,
    ]
  );

  const rotateX = useTransform(
    smy,
    [-1, 1],
    [3.4, -1]
  );

  const dolly = useTransform(
    progress,
    [0, 1],
    [0, 720]
  );

  const lift = useTransform(
    progress,
    [0, 1],
    [0, 110]
  );

  const onPointerMove = (event) => {
    if (
      !live ||
      event.pointerType === "touch"
    ) {
      return;
    }

    mx.set(
      (event.clientX /
        window.innerWidth) *
        2 -
        1
    );

    my.set(
      (event.clientY /
        window.innerHeight) *
        2 -
        1
    );
  };

  const motionStyle = live
    ? {
        rotateY,
        rotateX,
        x: "11%",
        y: lift,
        z: dolly,
      }
    : {
        rotateY: baseYaw,
        rotateX: mobile ? 0 : 3,
        x: mobile ? 0 : "11%",
      };

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div
      className="absolute inset-0"
      data-hall="css"
      onPointerMove={onPointerMove}
      style={{
        perspective: PERSPECTIVE,

        perspectiveOrigin: mobile
          ? "50% 26%"
          : "50% 38%",
      }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          ...motionStyle,
        }}
      >
        {/* EMPTY CINEMA SCREEN */}
        <div
          className={
            "absolute left-1/2 top-1/2 " +
            (
              mobile
                ? "aspect-[16/10] w-[min(184vw,900px)]"
                : "aspect-[2.2/1] w-[min(122vw,1900px)]"
            )
          }
          style={{
            transform:
              `translate3d(-50%, calc(-50% + ${SCREEN_Y}px), ${-SCREEN_Z}px)`,
          }}
        >
          <EmptyScreen />
        </div>

        {/* ORIGINAL CINEMA SEATS */}
        {hall.seats.map((seat) => (
          <div
            key={seat.key}
            className="absolute left-1/2 top-1/2"
            style={{
              width: hall.w,
              height: hall.h,

              marginLeft:
                -hall.w / 2,

              marginTop:
                -hall.h / 2,

              transform:
                `translate3d(${seat.x}px, ${seat.y}px, ${seat.z}px) rotateY(${seat.theta}rad)`,
            }}
          >
            <span
              className="bms-seat"
              style={{
                ...seat.colors,
                animationDelay:
                  `${seat.delay}ms`,
              }}
            />
          </div>
        ))}

        {/* ORIGINAL AISLE LIGHTS */}
        {hall.lights.map((light) => (
          <div
            key={light.key}
            className="absolute left-1/2 top-1/2"
            style={{
              width: 30,
              height: 4,

              marginLeft: -15,
              marginTop: -2,

              transform:
                `translate3d(${light.x}px, ${light.y}px, ${light.z}px)`,
            }}
          >
            <span
              className="bms-aisle-light"
              style={{
                animationDelay:
                  `${light.delay}ms`,
              }}
            />
          </div>
        ))}
      </motion.div>
    </div>
  );
};

export default HallFallback;
