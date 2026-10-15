
import React, { useEffect, useState } from "react";
import cx from "../lib/cx";

/**
 * A film's artwork, always in colour (callers decide when to show it).
 * Wide banner when the film has one; otherwise its poster, blurred to fill the frame with the sharp
 * poster centred on top; otherwise a plain dark glow. Broken images fall through to the next option.
 */
const FilmArt = ({ film, className, eager = true, posterAt = "center" }) => {
  const banner = film?.banner || film?.backdrop || null;
  const poster = film?.poster || null;
  const [bannerBad, setBannerBad] = useState(false);
  const [posterBad, setPosterBad] = useState(false);
  useEffect(() => {
    setBannerBad(false);
    setPosterBad(false);
  }, [film?._id, banner, poster]);

  if (banner && !bannerBad) {
    return (
      <img
        src={banner}
        alt=""
        draggable={false}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onError={() => setBannerBad(true)}
        className={cx("h-full w-full object-cover", className)}
      />
    );
  }
  if (poster && !posterBad) {
    return (
      <div className={cx("relative h-full w-full overflow-hidden bg-ink", className)}>
        <img
          src={poster}
          alt=""
          draggable={false}
          onError={() => setPosterBad(true)}
          className="absolute inset-0 h-full w-full scale-125 object-cover opacity-80 blur-xl"
        />
        <img
          src={poster}
          alt=""
          draggable={false}
          onError={() => setPosterBad(true)}
          className={cx("absolute -translate-x-1/2 rounded-[3px] object-cover shadow-[0_30px_80px_rgba(0,0,0,.7)]", posterAt === "right" ? "left-[58%] top-[11%] h-[70%]" : "left-1/2 top-[7%] h-[86%]")}
        />
      </div>
    );
  }
  return (
    <div
      className={cx("h-full w-full bg-[radial-gradient(70%_80%_at_50%_35%,#2a2a2a,#050505_75%)]", className)}
      aria-hidden="true"
    />
  );
};

export default FilmArt;
