import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
export type AIStage =
  | "idle"
  | "input"
  | "preprocessing"
  | "network"
  | "output"
  | "complete";
export interface AIWorkingInput {
  label: string;
  value: string;
}
interface Props {
  stage: AIStage;
  inputs: AIWorkingInput[];
  outputs: AIWorkingInput[];
  elapsed?: number;
  title?: string;
}
export default function AIWorkingPanel({
  stage,
  inputs,
  outputs,
  title = "Request",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  if (stage === "idle") return null;
  const pending = stage !== "complete";
  return (
    <section
      className="border border-border rounded-lg my-4 bg-secondary/20"
      aria-label="Request status"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-xs text-muted-foreground"
      >
        <span className="font-medium text-foreground">{title}</span>
        <span className="ml-auto">
          {pending
            ? "Request in progress"
            : "Request finished · inspect result below"}
        </span>
        {pending && <Loader2 size={14} className="animate-spin" />}
        <ChevronDown size={14} />
      </button>
      {expanded && (
        <div className="px-4 pb-4 grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <h4 className="text-muted-foreground mb-2">Provided inputs</h4>
            {inputs.map((item, i) => (
              <p key={i}>
                {item.label}: {item.value}
              </p>
            ))}
          </div>
          <div>
            <h4 className="text-muted-foreground mb-2">Returned output</h4>
            {outputs.length ? (
              outputs.map((item, i) => (
                <p key={i}>
                  {item.label}: {item.value}
                </p>
              ))
            ) : (
              <p>Unavailable</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function useAIStages() {
  const [stage, setStage] = useState<AIStage>("idle");
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    startRef.current = Date.now();
    timerRef.current = setInterval(
      () => setElapsed(Date.now() - startRef.current),
      100,
    );
  }, []);
  const stopTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setElapsed(Date.now() - startRef.current);
  }, []);
  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    setStage("idle");
    setElapsed(0);
  }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);
  const runWithStages = useCallback(
    async <T,>(computeFn: () => T): Promise<T> => {
      reset();
      startTimer();
      setStage("network");
      try {
        return computeFn();
      } finally {
        setStage("complete");
        stopTimer();
      }
    },
    [reset, startTimer, stopTimer],
  );
  return {
    stage,
    setStage,
    elapsed,
    startTimer,
    stopTimer,
    reset,
    runWithStages,
  };
}
