
import React, { useEffect, useState } from "react";
import cx from "../lib/cx";

/**
 * Film artwork. Grayscale at rest; full colour when `active`, or when an ancestor
 * with the `group` class is hovered or focused. The colour change is the only colour
 * on the page. If the image is missing or fails, a monochrome title tile is shown,
 * never a broken image.
 */
const Poster = ({ film, src, active = false, eager = false, className, imgClassName }) => {
  const url = src ?? film?.poster ?? null;
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  const ok = Boolean(url) && !failed;

  return (
    <div className={cx("relative overflow-hidden bg-ink-2", className)}>
      {ok ? (
        <img
          src={url}
          alt={film?.title ? `${film.title} poster` : ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          data-colour={active ? "true" : "false"}
          className={cx(
            "h-full w-full object-cover grayscale transition-[filter,transform] duration-700 ease-cine",
            "data-[colour=true]:grayscale-0 group-hover:grayscale-0 group-focus-visible:grayscale-0",
            imgClassName
          )}
        />
      ) : (
        <div className="flex h-full w-full items-end bg-[linear-gradient(160deg,#2a2a2a,#0a0a0a_75%)] p-4">
          <span className="font-display text-lg font-bold leading-tight text-paper/90">{film?.title}</span>
        </div>
      )}
    </div>
  );
};

export default Poster;
