"use client";

import { useId } from "react";

import {
  Controller,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from "react-hook-form";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";

import { Switch } from "@/components/ui/switch";

type FormSwitchProps<T extends FieldValues> = {
  name: FieldPathByValue<T, boolean>;
  label: string;
  control: Control<T>;
  description?: string;
  disabled?: boolean;
};

export function FormSwitch<T extends FieldValues>({
  name,
  label,
  control,
  description,
  disabled = false,
}: FormSwitchProps<T>) {
  const id = useId();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field
          orientation="horizontal"
          data-invalid={fieldState.invalid}
          className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>

            {description && <FieldDescription>{description}</FieldDescription>}
          </div>

          <Switch
            id={id}
            name={field.name}
            checked={field.value === true}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            ref={field.ref}
          />
        </Field>
      )}
    />
  );
}
