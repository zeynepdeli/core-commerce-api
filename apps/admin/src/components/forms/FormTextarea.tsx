"use client";

import type {
  FieldError,
  FieldPath,
  FieldValues,
  UseFormRegister,
} from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";

import { Textarea } from "@/components/ui/textarea";

type FormTextareaProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  register: UseFormRegister<T>;
  error?: FieldError;
  description?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  required?: boolean;
};

export function FormTextarea<T extends FieldValues>({
  name,
  label,
  register,
  error,
  description,
  placeholder,
  rows = 5,
  disabled = false,
  required = false,
}: FormTextareaProps<T>) {
  const id = String(name).replace(/\./g, "-");
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>
        {label}
        {required && (
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </FieldLabel>

      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={
          error ? errorId : description ? descriptionId : undefined
        }
        {...register(name)}
        className="min-h-28 resize-y"
      />

      {description && !error && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}

      {error?.message && (
        <FieldErrorMessage id={errorId}>{error.message}</FieldErrorMessage>
      )}
    </Field>
  );
}
