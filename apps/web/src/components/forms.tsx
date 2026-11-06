"use client";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import type * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state || (state.ok && !state.message)) return null;
  return (
    <div
      role={state.ok ? "status" : "alert"}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        state.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-[#ff9b9b]",
      )}
    >
      {state.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
      <span>{state.message}</span>
    </div>
  );
}

export function Field({
  label,
  name,
  state,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  state?: ActionState;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const errors = state && !state.ok ? state.fieldErrors?.[name] : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !errors && <p className="text-xs text-muted-foreground">{hint}</p>}
      {errors?.map((e) => (
        <p key={e} className="text-xs text-[#ff9b9b]">
          {e}
        </p>
      ))}
    </div>
  );
}

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Form bound to a server action with inline feedback. Optional confirmation for destructive actions. */
export function ActionForm({
  action,
  children,
  className,
  confirm,
  resetOnSuccess,
}: {
  action: FormAction;
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {typeof children === "function" ? children(state) : children}
      {typeof children !== "function" && <FormMessage state={state} />}
    </form>
  );
}
