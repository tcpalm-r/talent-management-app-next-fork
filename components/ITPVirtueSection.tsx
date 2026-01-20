'use client';

import React from 'react';
import { ITPBehavior, ITPVirtue, ITPResponse } from '@/types';
import { VIRTUE_CONFIG } from '@/lib/itpBehaviors';
import { ITPBehaviorSlider } from './ITPBehaviorSlider';
import { CheckCircle } from 'lucide-react';

interface ITPVirtueSectionProps {
  virtue: ITPVirtue;
  behaviors: ITPBehavior[];
  responses: Record<string, number>;
  onResponseChange: (behaviorKey: string, rating: number) => void;
  disabled?: boolean;
}

/**
 * ITPVirtueSection Component
 *
 * A section wrapper for each virtue (Humble, Hungry, People Smart).
 * Contains multiple ITPBehaviorSlider components.
 * Shows completion status for the section.
 */
export function ITPVirtueSection({
  virtue,
  behaviors,
  responses,
  onResponseChange,
  disabled = false,
}: ITPVirtueSectionProps) {
  const config = VIRTUE_CONFIG[virtue];

  // Calculate completion for this section
  const completedCount = behaviors.filter(b => responses[b.behaviorKey] !== undefined).length;
  const totalCount = behaviors.length;
  const isComplete = completedCount === totalCount;

  // Get icon based on virtue
  const getVirtueIcon = (v: ITPVirtue): string => {
    switch (v) {
      case 'humble':
        return '🤝';
      case 'hungry':
        return '🔥';
      case 'people_smart':
        return '🧠';
    }
  };

  return (
    <div className={`mb-8 rounded-xl border-2 ${config.borderColor} overflow-hidden`}>
      {/* Section Header */}
      <div className={`${config.bgColor} px-6 py-4 border-b ${config.borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getVirtueIcon(virtue)}</span>
            <h3 className={`text-xl font-bold ${config.color}`}>
              {config.displayName}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {isComplete && (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            <span className={`text-sm font-medium ${config.color}`}>
              {completedCount}/{totalCount} rated
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-2 bg-white/50 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              virtue === 'humble'
                ? 'bg-blue-500'
                : virtue === 'hungry'
                ? 'bg-orange-500'
                : 'bg-purple-500'
            }`}
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Behaviors */}
      <div className="p-4 bg-white">
        {behaviors.map((behavior) => (
          <ITPBehaviorSlider
            key={behavior.behaviorKey}
            behavior={behavior}
            value={responses[behavior.behaviorKey] ?? null}
            onChange={onResponseChange}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

export default ITPVirtueSection;
