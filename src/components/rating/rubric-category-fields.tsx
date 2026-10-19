"use client";

import { useId } from "react";
import { CinematicSlider } from "@/components/cinematic-slider";

interface RubricCategoryFieldsProps {
  name: string;
  weight: number;
  onNameChange: (name: string) => void;
  onWeightChange: (weight: number) => void;
}

export function RubricCategoryFields({ name, weight, onNameChange, onWeightChange }: RubricCategoryFieldsProps) {
  const id = useId();

  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-name`} className="block text-xs font-semibold text-muted-foreground">Name</label>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="w-full min-w-0 h-9 px-3 text-xs font-semibold rounded-input bg-background border border-border-input text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label htmlFor={`${id}-weight`} className="block text-xs font-semibold text-muted-foreground">Weight</label>
        <CinematicSlider
          id={`${id}-weight`}
          min={0}
          max={10}
          step={0.5}
          value={weight}
          onChange={(value) => onWeightChange(value ?? weight)}
          allowUnset={false}
          showValue
          valueSuffix="×"
          valuePrecision={1}
          size="sm"
          ariaLabel={`Weight for ${name}`}
        />
      </div>
    </div>
  );
}
