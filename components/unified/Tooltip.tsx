'use client';

import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

/**
 * Tooltip component props
 */
export interface TooltipProps {
  /** The content to display in the tooltip */
  content: string;
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** Optional delay before showing tooltip (ms) */
  delayDuration?: number;
  /** Optional side preference (default: 'top') */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Optional alignment (default: 'center') */
  align?: 'start' | 'center' | 'end';
}

/**
 * Reusable Tooltip component using Radix UI primitives
 *
 * Provides accessible, keyboard-friendly tooltips with design system styling.
 * Compact and positioned close to the trigger element.
 *
 * @example
 * ```tsx
 * <Tooltip content="Click to view details">
 *   <button>View</button>
 * </Tooltip>
 * ```
 */
export function Tooltip({
  content,
  children,
  delayDuration = 300,
  side = 'top',
  align = 'center',
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>
        {children}
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={4}
          className="
            z-[100]
            px-2 py-1
            text-xs
            text-white
            text-center
            bg-gray-900
            rounded-md
            shadow-lg
            animate-in
            fade-in-0
            zoom-in-95
            data-[state=closed]:animate-out
            data-[state=closed]:fade-out-0
            data-[state=closed]:zoom-out-95
            data-[side=bottom]:slide-in-from-top-2
            data-[side=left]:slide-in-from-right-2
            data-[side=right]:slide-in-from-left-2
            data-[side=top]:slide-in-from-bottom-2
            max-w-[200px]
          "
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-gray-900" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/**
 * TooltipProvider wrapper - must wrap any component tree using Tooltips
 *
 * @example
 * ```tsx
 * <TooltipProvider>
 *   <YourApp />
 * </TooltipProvider>
 * ```
 */
export const TooltipProvider = TooltipPrimitive.Provider;
