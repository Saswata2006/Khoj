"use client";

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  OTP_LENGTH,
  applyOtpBackspace,
  applyOtpDigitChange,
  applyOtpPaste,
} from "@/lib/auth-ui";

interface OtpInputProps {
  digits: string[];
  onChange: (nextDigits: string[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({
  digits,
  onChange,
  disabled = false,
  hasError = false,
  autoFocus = true,
}: OtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  const focusIndex = (idx: number) => {
    const target = inputRefs.current[idx];
    if (target) {
      target.focus();
      target.select();
    }
  };

  const handleChange = (index: number, value: string) => {
    const { digits: nextDigits, nextFocusIndex } = applyOtpDigitChange(
      digits,
      index,
      value
    );
    onChange(nextDigits);
    if (value.replace(/\D/g, "").length > 0 && nextFocusIndex !== index) {
      focusIndex(nextFocusIndex);
    }
  };

  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    const { digits: nextDigits, nextFocusIndex } = applyOtpPaste(
      digits,
      pasted,
      index
    );
    onChange(nextDigits);
    focusIndex(nextFocusIndex);
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const { digits: nextDigits, nextFocusIndex } = applyOtpBackspace(
        digits,
        index
      );
      onChange(nextDigits);
      focusIndex(nextFocusIndex);
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }

    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      focusIndex(index + 1);
    }
  };

  return (
    <div
      className="grid grid-cols-6 gap-2 sm:gap-2.5"
      role="group"
      aria-label="6-digit verification code"
    >
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <Input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={OTP_LENGTH}
          value={digits[index] ?? ""}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${OTP_LENGTH}`}
          aria-invalid={hasError || undefined}
          onChange={(e) => handleChange(index, e.target.value)}
          onPaste={(e) => handlePaste(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "h-12 sm:h-13 text-center text-lg sm:text-xl font-mono font-semibold tracking-tight bg-[#18181B] border-[#27272A] text-[#FAFAFA]",
            "hover:border-[#3F3F46] focus-visible:border-[#10B981] focus-visible:ring-[#10B981]/30",
            hasError && "border-[#EF4444] focus-visible:border-[#EF4444] focus-visible:ring-[#EF4444]/25"
          )}
        />
      ))}
    </div>
  );
}
