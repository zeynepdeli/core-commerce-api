"use client";

import type {
  FieldPath,
  FieldValues,
  UseFormRegister,
  FieldError,
} from "react-hook-form";

import {
  Field,
  FieldDescription,
  FieldError as FieldErrorMessage,
  FieldLabel,
} from "@/components/ui/field";

import { Input } from "@/components/ui/input";

type FormFieldProps<T extends FieldValues> = {
  name: FieldPath<T>;
  label: string;
  register: UseFormRegister<T>;
  error?: FieldError;
  description?: string;
  placeholder?: string;
  type?: React.HTMLInputTypeAttribute;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
};

export function FormField<T extends FieldValues>({
  name,
  label,
  register,
  error,
  description,
  placeholder,
  type = "text",
  disabled = false,
  required = false,
  autoComplete,
}: FormFieldProps<T>) {
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

      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={
          error ? errorId : description ? descriptionId : undefined
        }
        {...register(name)}
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
