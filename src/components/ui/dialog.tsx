import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: DialogPrimitive.DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-slate-950/45 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <DialogPrimitive.Content
          className={cn(
            "pointer-events-auto w-[min(92vw,720px)] rounded-lg border border-border bg-white p-6 shadow-xl data-[state=open]:animate-scale-in-center data-[state=closed]:animate-scale-out-center",
            className,
          )}
          {...props}
        >
          {children}
          <DialogPrimitive.Close asChild>
            <Button aria-label="Fermer" className="absolute right-3 top-3 transition-smooth hover:bg-muted" size="icon" variant="ghost">
              <X className="h-4 w-4" />
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-5 space-y-1", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
}
