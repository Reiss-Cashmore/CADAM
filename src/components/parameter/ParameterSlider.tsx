import React from 'react';
import { Parameter } from '@shared/types';
import { Slider } from '@/components/ui/slider';
import {
  calculateParameterRange,
  calculateParameterStep,
} from '@/utils/parameterUtils';

interface ParameterSliderProps {
  param: Parameter;
  onValueChange: (value: number) => void;
  onValueCommit: (value: number) => void;
  step?: number;
}

function ParameterSliderBase({
  param,
  onValueChange,
  onValueCommit,
  step,
}: ParameterSliderProps) {
  const { min, max } = calculateParameterRange(param);
  const calculatedStep = step ?? calculateParameterStep(param);

  return (
    <Slider
      id={`${param.name}-slider`}
      name={param.name}
      className="w-full"
      defaultMarkerStyle="line"
      onValueChange={([newValue]) => onValueChange(newValue)}
      onValueCommit={([newValue]) => {
        onValueCommit(newValue);
      }}
      min={min}
      max={max}
      value={[Number(param.value)]}
      defaultValue={[Number(param.defaultValue)]}
      step={calculatedStep}
    />
  );
}

export const ParameterSlider = React.memo(ParameterSliderBase);
