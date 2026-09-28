import { useEffect, useRef, useState } from "react";

/** Reveal assistant text incrementally for a streaming feel. */
export function useStreamingAssistant(
  fullText: string | null,
  onComplete?: () => void,
) {
  const [displayed, setDisplayed] = useState("");
  const [streaming, setStreaming] = useState(false);
  const timerRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!fullText) {
      setDisplayed("");
      setStreaming(false);
      return;
    }

    setDisplayed("");
    setStreaming(true);
    let i = 0;
    const tick = () => {
      i += Math.max(2, Math.floor(fullText.length / 80));
      if (i >= fullText.length) {
        setDisplayed(fullText);
        setStreaming(false);
        onCompleteRef.current?.();
        return;
      }
      setDisplayed(fullText.slice(0, i));
      timerRef.current = window.setTimeout(tick, 16);
    };
    timerRef.current = window.setTimeout(tick, 16);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fullText]);

  return { displayed, streaming };
}
