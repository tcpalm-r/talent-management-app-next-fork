'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ITPBehavior, ITPVirtue } from '@/types';
import { VIRTUE_CONFIG, RATING_LABELS } from '@/lib/itpBehaviors';

interface ITPBehaviorSliderProps {
  behavior: ITPBehavior;
  value: number | null;
  onChange: (behaviorKey: string, rating: number) => void;
  disabled?: boolean;
}

/**
 * ITPBehaviorSlider Component
 *
 * A 5-point slider for rating ITP behaviors.
 * Shows all 3 level descriptions (Not Living, Living, Role Modeling) simultaneously.
 * Slider snaps to nearest integer value with smooth animation.
 */
export function ITPBehaviorSlider({
  behavior,
  value,
  onChange,
  disabled = false,
}: ITPBehaviorSliderProps) {
  const [localValue, setLocalValue] = useState<number>(value ?? 3);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Sync with external value
  useEffect(() => {
    if (value !== null && !isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const virtueConfig = VIRTUE_CONFIG[behavior.virtue];

  // Calculate position from value (1-5 maps to 0-100%)
  const getPositionFromValue = (val: number): number => {
    return ((val - 1) / 4) * 100;
  };

  // Calculate value from position (0-100% maps to 1-5)
  const getValueFromPosition = (position: number): number => {
    const rawValue = 1 + (position / 100) * 4;
    return Math.max(1, Math.min(5, rawValue));
  };

  // Snap value to nearest integer
  const snapToNearest = (val: number): number => {
    return Math.round(val);
  };

  // Handle mouse/touch events
  const handleSliderInteraction = useCallback(
    (clientX: number) => {
      if (disabled || !sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const position = ((clientX - rect.left) / rect.width) * 100;
      const clampedPosition = Math.max(0, Math.min(100, position));
      const newValue = getValueFromPosition(clampedPosition);

      setLocalValue(newValue);
    },
    [disabled]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleSliderInteraction(e.clientX);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      handleSliderInteraction(e.clientX);
    },
    [isDragging, handleSliderInteraction]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      const snappedValue = snapToNearest(localValue);
      setLocalValue(snappedValue);
      onChange(behavior.behaviorKey, snappedValue);
      setIsDragging(false);
    }
  }, [isDragging, localValue, behavior.behaviorKey, onChange]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handleSliderInteraction(e.touches[0].clientX);
  };

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      handleSliderInteraction(e.touches[0].clientX);
    },
    [isDragging, handleSliderInteraction]
  );

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      const snappedValue = snapToNearest(localValue);
      setLocalValue(snappedValue);
      onChange(behavior.behaviorKey, snappedValue);
      setIsDragging(false);
    }
  }, [isDragging, localValue, behavior.behaviorKey, onChange]);

  // Add/remove global event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Handle click on marker dot
  const handleMarkerClick = (markerValue: number) => {
    if (disabled) return;
    setLocalValue(markerValue);
    onChange(behavior.behaviorKey, markerValue);
  };

  const displayValue = isDragging ? localValue : (value ?? localValue);
  const thumbPosition = getPositionFromValue(displayValue);

  // Get accent color based on virtue
  const getAccentColor = (virtue: ITPVirtue): string => {
    switch (virtue) {
      case 'humble':
        return 'bg-blue-500';
      case 'hungry':
        return 'bg-orange-500';
      case 'people_smart':
        return 'bg-purple-500';
    }
  };

  const accentColor = getAccentColor(behavior.virtue);

  return (
    <div className={`p-4 rounded-lg border ${virtueConfig.borderColor} ${virtueConfig.bgColor} mb-4`}>
      {/* Behavior Name */}
      <h4 className={`font-semibold text-base mb-3 ${virtueConfig.color}`}>
        {behavior.behaviorName}
      </h4>

      {/* Three-column description layout */}
      <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
        <div className="p-2 bg-white/50 rounded border border-gray-200">
          <div className="font-medium text-red-700 mb-1">Not Living</div>
          <p className="text-gray-600 leading-relaxed">{behavior.descriptionNotLiving}</p>
        </div>
        <div className="p-2 bg-white/50 rounded border border-gray-200">
          <div className="font-medium text-yellow-700 mb-1">Living</div>
          <p className="text-gray-600 leading-relaxed">{behavior.descriptionLiving}</p>
        </div>
        <div className="p-2 bg-white/50 rounded border border-gray-200">
          <div className="font-medium text-green-700 mb-1">Role Modeling</div>
          <p className="text-gray-600 leading-relaxed">{behavior.descriptionRoleModeling}</p>
        </div>
      </div>

      {/* Slider */}
      <div className="px-2">
        <div
          ref={sliderRef}
          className={`relative h-8 select-none ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {/* Track */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-2 bg-gray-200 rounded-full">
            {/* Filled portion */}
            <div
              className={`absolute top-0 left-0 h-full ${accentColor} rounded-full transition-all ${isDragging ? 'duration-0' : 'duration-150'}`}
              style={{ width: `${thumbPosition}%` }}
            />
          </div>

          {/* Marker dots */}
          {[1, 2, 3, 4, 5].map((markerValue) => {
            const markerPosition = getPositionFromValue(markerValue);
            const isActive = displayValue >= markerValue;
            const isSnapped = Math.round(displayValue) === markerValue;

            return (
              <button
                key={markerValue}
                type="button"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkerClick(markerValue);
                }}
                className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 transition-all ${
                  isSnapped
                    ? `${accentColor} border-white scale-125 shadow-md`
                    : isActive
                    ? `${accentColor} border-white`
                    : 'bg-white border-gray-300'
                } ${disabled ? '' : 'hover:scale-110'}`}
                style={{ left: `${markerPosition}%` }}
                aria-label={`Rate ${markerValue}`}
              />
            );
          })}

          {/* Draggable thumb */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full ${accentColor} border-2 border-white shadow-lg transition-all ${
              isDragging ? 'scale-125 duration-0' : 'duration-150'
            }`}
            style={{ left: `${thumbPosition}%` }}
          />
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-1 text-xs text-gray-500">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </div>
        <div className="flex justify-between mt-0.5 text-xs">
          <span className="text-red-600 font-medium">Not Living</span>
          <span className="text-yellow-600 font-medium">Living</span>
          <span className="text-green-600 font-medium">Role Modeling</span>
        </div>
      </div>

      {/* Current selection indicator */}
      {value !== null && (
        <div className="mt-3 text-center">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${virtueConfig.bgColor} ${virtueConfig.color} border ${virtueConfig.borderColor}`}>
            Current: {value} - {RATING_LABELS[value] || `Between ${RATING_LABELS[value - 1] || 'Not Living'} and ${RATING_LABELS[value + 1] || 'Role Modeling'}`}
          </span>
        </div>
      )}
    </div>
  );
}

export default ITPBehaviorSlider;
