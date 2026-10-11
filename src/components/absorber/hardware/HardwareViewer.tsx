import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Viewer } from "./viewer";

export default function HardwareViewer() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [requested, setRequested] = useState(false);
  const [portable, setPortable] = useState(false);
  const [status, setStatus] = useState<
    "standby" | "loading" | "ready" | "error"
  >("standby");
  const [attempt, setAttempt] = useState(0);
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!requested || !host.current) return;
    const controller = new AbortController();
    const target = host.current;
    let instance: Viewer | null = null;
    setStatus("loading");
    setOpened(false);
    const fail = () => {
      if (!controller.signal.aborted) {
        setStatus("error");
        instance?.dispose();
        viewer.current = null;
      }
    };
    import("./viewer")
      .then(({ createViewer }) =>
        createViewer(
          target,
          controller.signal,
          () => {},
          () => {},
          fail,
          portable,
        ),
      )
      .then((result) => {
        if (!result) return;
        if (controller.signal.aborted) {
          result.dispose();
          return;
        }
        instance = result;
        viewer.current = result;
        setStatus("ready");
      })
      .catch(fail);
    return () => {
      controller.abort();
      instance?.dispose();
      viewer.current = null;
    };
  }, [requested, portable, attempt]);
  return (
    <section
      aria-label="mma-test research hardware"
      className="rounded-xl border border-border bg-secondary/10 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {portable
              ? "Portable Nitrate Sensing Prototype"
              : "mma-test · Interactive Research Hardware Prototype"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {portable
              ? "Food & beverage sensing research"
              : "Metamaterial sensing · RF measurement · AI-assisted analysis"}
          </p>
        </div>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Hardware model"
        >
          <Button
            size="sm"
            variant={portable ? "outline" : "secondary"}
            aria-pressed={!portable}
            onClick={() => setPortable(false)}
          >
            Main mma-test
          </Button>
          <Button
            size="sm"
            variant={portable ? "secondary" : "outline"}
            aria-pressed={portable}
            onClick={() => setPortable(true)}
          >
            Portable nitrate sensor
          </Button>
        </div>
      </div>
      <div
        ref={host}
        data-testid="hardware-viewport"
        className="relative w-full h-[280px] sm:h-[320px] overflow-hidden rounded-lg mt-3 [&>canvas]:block [&>canvas]:max-w-full"
      >
        {!requested && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button onClick={() => setRequested(true)}>Explore 3D</Button>
          </div>
        )}
        {status === "loading" && (
          <p
            role="status"
            className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground pointer-events-none"
          >
            Loading exact R04 hardware model…
          </p>
        )}
        {status === "error" && (
          <div
            role="alert"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm"
          >
            <p>3D unavailable. Check WebGL support and the model download.</p>
            <Button onClick={() => setAttempt((n) => n + 1)}>Retry 3D</Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs">
        <span className="text-muted-foreground">
          Drag to orbit · Scroll / pinch to zoom
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={status !== "ready"}
          onClick={() => {
            viewer.current?.reset();
            setOpened(false);
          }}
        >
          Reset view
        </Button>
        {!portable && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={opened}
              disabled={status !== "ready"}
              onChange={(e) => {
                setOpened(e.target.checked);
                viewer.current?.open(e.target.checked);
              }}
            />
            Open enclosure
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Existing R04 hardware visualization. Display artwork is illustrative,
        not measured results or diagnostic evidence. Experimental validation
        pending; not clinically validated.
      </p>
    </section>
  );
}
