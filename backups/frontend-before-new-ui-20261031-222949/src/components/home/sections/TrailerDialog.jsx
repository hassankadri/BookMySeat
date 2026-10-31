
import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import copy from "../copy";
import Button from "../primitives/Button";

// Loaded only when someone presses a play button, so Radix's dialog stays out of the main bundle.
// The video is YouTube's privacy-enhanced embed, and starts when the dialog opens.

const TrailerDialog = ({ film, videoId, onClose }) => (
  <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[96] bg-black/90 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <Dialog.Content
        aria-describedby={undefined}
        className="fixed left-1/2 top-1/2 z-[97] w-[min(94vw,1100px)] -translate-x-1/2 -translate-y-1/2 outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
      >
        <Dialog.Title className="sr-only">{copy.nextOnScreen.trailerTitle(film.title)}</Dialog.Title>
        <div className="aspect-video overflow-hidden rounded-3xl border border-line bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={copy.nextOnScreen.trailerTitle(film.title)}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="font-display text-xl font-semibold tracking-[-0.02em] text-paper">{film.title}</p>
          <div className="flex items-center gap-3">
            <Button to={`/movie/${film._id}`} size="sm" data-testid="trailer-film-link">
              {copy.nextOnScreen.filmPage}
            </Button>
            <Dialog.Close
              aria-label={copy.nextOnScreen.closeTrailer}
              data-testid="trailer-close"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong text-paper outline-none transition-colors hover:border-paper focus-visible:ring-2 focus-visible:ring-paper"
            >
              <X className="h-5 w-5" strokeWidth={1.6} />
            </Dialog.Close>
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

export default TrailerDialog;
