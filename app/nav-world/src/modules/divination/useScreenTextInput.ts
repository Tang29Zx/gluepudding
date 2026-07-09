import { useEffect, useRef } from "react";
import {
  fortuneQuestionMaxLength,
  normalizeQuestionText,
} from "./screenInput";

interface UseScreenTextInputOptions {
  active: boolean;
  ariaLabel: string;
  maxLength?: number;
  onCancel: () => void;
  onChange: (value: string) => void;
  onConfirm: () => void;
  value: string;
}

export function useScreenTextInput({
  active,
  ariaLabel,
  maxLength = fortuneQuestionMaxLength,
  onCancel,
  onChange,
  onConfirm,
  value,
}: UseScreenTextInputOptions): void {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef(false);
  const maxLengthRef = useRef(maxLength);
  const onCancelRef = useRef(onCancel);
  const onChangeRef = useRef(onChange);
  const onConfirmRef = useRef(onConfirm);
  const valueRef = useRef(value);

  useEffect(() => {
    maxLengthRef.current = maxLength;
    onCancelRef.current = onCancel;
    onChangeRef.current = onChange;
    onConfirmRef.current = onConfirm;
    valueRef.current = value;
  }, [maxLength, onCancel, onChange, onConfirm, value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!active || !input) {
      return;
    }

    const normalizedValue = normalizeQuestionText(value, maxLength);
    if (input.value === normalizedValue) {
      return;
    }

    input.value = normalizedValue;
    input.setSelectionRange(input.value.length, input.value.length);
  }, [active, maxLength, value]);

  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }

    const input = document.createElement("textarea");
    input.value = normalizeQuestionText(valueRef.current, maxLengthRef.current);
    input.maxLength = maxLengthRef.current;
    input.rows = 1;
    input.setAttribute("aria-label", ariaLabel);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("data-world-screen-input", "true");
    input.spellcheck = false;
    Object.assign(input.style, {
      background: "transparent",
      border: "0",
      caretColor: "transparent",
      color: "transparent",
      fontSize: "16px",
      height: "1px",
      left: "50%",
      opacity: "0",
      outline: "0",
      overflow: "hidden",
      padding: "0",
      pointerEvents: "none",
      position: "fixed",
      resize: "none",
      top: "50%",
      transform: "translate(-50%, -50%)",
      width: "1px",
      zIndex: "2147483647",
    });

    const syncValue = () => {
      const nextValue = normalizeQuestionText(
        input.value,
        maxLengthRef.current,
      );

      if (input.value !== nextValue) {
        input.value = nextValue;
        input.setSelectionRange(input.value.length, input.value.length);
      }

      if (valueRef.current !== nextValue) {
        valueRef.current = nextValue;
        onChangeRef.current(nextValue);
      }
    };

    const focusInput = () => {
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
    };

    const handleInput = () => {
      syncValue();
    };

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;
      window.setTimeout(syncValue, 0);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();

      if (event.code === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      const isEnter = event.code === "Enter" || event.key === "Enter";
      if (
        isEnter &&
        !event.isComposing &&
        !isComposingRef.current
      ) {
        event.preventDefault();
        syncValue();
        onConfirmRef.current();
        return;
      }

      if (event.code === "Tab") {
        event.preventDefault();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      event.stopPropagation();
    };

    const handlePaste = (event: ClipboardEvent) => {
      event.stopPropagation();
    };

    document.body.appendChild(input);
    inputRef.current = input;
    focusInput();
    const immediateFocusTimer = window.setTimeout(focusInput, 0);
    const deferredFocusTimer = window.setTimeout(focusInput, 80);

    input.addEventListener("compositionstart", handleCompositionStart);
    input.addEventListener("compositionend", handleCompositionEnd);
    input.addEventListener("input", handleInput);
    input.addEventListener("keydown", handleKeyDown);
    input.addEventListener("keyup", handleKeyUp);
    input.addEventListener("paste", handlePaste);

    return () => {
      window.clearTimeout(immediateFocusTimer);
      window.clearTimeout(deferredFocusTimer);
      input.removeEventListener("compositionstart", handleCompositionStart);
      input.removeEventListener("compositionend", handleCompositionEnd);
      input.removeEventListener("input", handleInput);
      input.removeEventListener("keydown", handleKeyDown);
      input.removeEventListener("keyup", handleKeyUp);
      input.removeEventListener("paste", handlePaste);
      input.remove();
      if (inputRef.current === input) {
        inputRef.current = null;
      }
      isComposingRef.current = false;
    };
  }, [active, ariaLabel]);
}
