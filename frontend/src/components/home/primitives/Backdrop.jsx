
import React from "react";
import FilmArt from "./FilmArt";
import cx from "../lib/cx";

/**
 * Full-bleed film artwork with the black vignette used by the Programme. The Opening shows an identical
 * copy at the end of its camera move, so the scroll into the Programme has no visible seam.
 */
const Backdrop = ({ film, className }) => (
  <div className={cx("absolute inset-0 overflow-hidden bg-ink", className)}>
    <FilmArt film={film} posterAt="right" />
    <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_70%_30%,transparent_30%,rgba(0,0,0,.82)_88%)]" />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/10 to-transparent" />
  </div>
);

export default Backdrop;
