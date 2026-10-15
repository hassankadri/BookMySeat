
import React, { useEffect, useRef, useState } from "react";
import { useMotionValueEvent } from "framer-motion";
import { quadToMatrix3d } from "../lib/quad";
import { withRetry } from "../primitives/LazyBoundary";

// This resolution matches the visual size of the projection while avoiding
// the memory cost of an unnecessarily large 4K DOM layer.
const ART_W = 1600;
const ART_H = ART_W / 2.2;
const loadStage = withRetry(() => import("./HallStage"));

function CinemaProjection({ nearScreen, visible }) {
  const video = useRef(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const src = process.env.REACT_APP_HOME_PREVIEW_URL ||
    `${process.env.PUBLIC_URL || ""}/trailers/optimized/godzilla-vs-kong.mp4`;

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    if (nearScreen && visible && !failed) {
      const result = player.play();
      if (result?.catch) result.catch(() => { /* poster remains visible */ });
    } else {
      player.pause();
    }
  }, [nearScreen, visible, failed]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#111116]" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 55% 35%,#3d3845 0%,#202029 45%,#0e0d12 95%)",
        }}
      />

      {!nearScreen && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="mb-8 h-[2px] w-24 bg-[#b27c84]" />
          <span style={{ fontFamily: "Georgia,serif", fontSize: 25, letterSpacing: ".48em", color: "#b7afb8" }}>
            THE HOUSE IS OPEN
          </span>
          <span style={{ fontFamily: "Georgia,serif", fontSize: 98, letterSpacing: ".065em", lineHeight: 1.55, color: "#f7f3f1" }}>
            INTERMISSION
          </span>
          <span style={{ fontFamily: "Georgia,serif", fontSize: 21, letterSpacing: ".35em", color: "#aaa1ab" }}>
            THE STORY CONTINUES
          </span>
        </div>
      )}

      {/* Video is loaded only when the user approaches the projection.
          A real local poster is displayed until decoded frames are ready. */}
      {nearScreen && (
        <div className="absolute inset-0">
          <img
            src={`${process.env.PUBLIC_URL || ""}/trailers/optimized/godzilla-vs-kong.jpg`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {!failed && (
            <video
              ref={video}
              src={src}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ opacity: ready ? 1 : 0, transition: "opacity 800ms ease" }}
              autoPlay={false}
              playsInline
              muted
              loop
              preload="metadata"
              onPlaying={() => setReady(true)}
              onError={() => setFailed(true)}
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-black/[.07]" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_25px_rgba(0,0,0,.3)]" />
    </div>
  );
}

export default function HallScene({ progress, mobile, reduceMotion = false, onFail }) {
  const host = useRef(null);
  const art = useRef(null);
  const stage = useRef(null);
  const onFailRef = useRef(onFail);
  const progressRef = useRef(progress);
  const lastMatrix = useRef("");
  const [nearScreen, setNearScreen] = useState(false);
  const [visible, setVisible] = useState(true);

  onFailRef.current = onFail;
  progressRef.current = progress;

  useMotionValueEvent(progress, "change", (value) => {
    stage.current?.setProgress(value);
    // Hysteresis prevents repeated video mount/unmount during micro-scrolls.
    setNearScreen((old) => (old ? value > 0.46 : value >= 0.61));
  });

  useEffect(() => {
    if (!mobile || reduceMotion) return undefined;
    const timer = window.setTimeout(() => setNearScreen(true), 11000);
    return () => window.clearTimeout(timer);
  }, [mobile, reduceMotion]);

  useEffect(() => {
    let disposed = false;
    let instance;
    let resize;
    let intersection;
    let inView = true;
    let frame = 0;
    const start = async () => {
      try {
        const { default: HallStage } = await loadStage();
        if (disposed || !host.current) return;
        instance = new HallStage(host.current, {
          mobile,
          reduceMotion,
          onLost: () => onFailRef.current?.(),
          onFrame: (quad) => {
            const matrix = quadToMatrix3d(ART_W, ART_H, quad);
            if (matrix && art.current && matrix !== lastMatrix.current) {
              art.current.style.transform = matrix;
              lastMatrix.current = matrix;
            }
          },
        });
        stage.current = instance;
        instance.setProgress(progressRef.current.get());
        resize = new ResizeObserver(() => instance?.setSize());
        resize.observe(host.current);
        const updateVisibility = () => {
          const next = inView && !document.hidden;
          instance?.setActive(next);
          if (!disposed) setVisible(next);
        };
        intersection = new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          updateVisibility();
        });
        intersection.observe(host.current);
        document.addEventListener("visibilitychange", updateVisibility);
        const pointer = (event) => {
          if (event.pointerType === "touch" || !instance) return;
          // Pointer input is cheap and never updates React state.
          instance.setPointer(
            (event.clientX / window.innerWidth) * 2 - 1,
            (event.clientY / window.innerHeight) * 2 - 1
          );
        };
        if (!mobile) window.addEventListener("pointermove", pointer, { passive: true });
        updateVisibility();
        // cleanup registered after the async constructor resolves
        frame = () => {
          document.removeEventListener("visibilitychange", updateVisibility);
          if (!mobile) window.removeEventListener("pointermove", pointer);
        };
      } catch (error) {
        console.error("BookMySeat cinema initialization failed:", error);
        if (!disposed) onFailRef.current?.();
      }
    };
    void start();
    return () => {
      disposed = true;
      if (typeof frame === "function") frame();
      resize?.disconnect();
      intersection?.disconnect();
      instance?.dispose();
      stage.current = null;
    };
  }, [mobile, reduceMotion]);

  return (
    <div ref={host} className="absolute inset-0" data-hall="three">
      <div
        ref={art}
        className="bms-art pointer-events-none absolute left-0 top-0 overflow-hidden"
        style={{
          width: ART_W,
          height: ART_H,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        <CinemaProjection nearScreen={nearScreen} visible={visible} />
      </div>
    </div>
  );
}
