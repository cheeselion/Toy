import React from 'react';
import { HorrorLevel, SCARE_METER_LEVELS } from '../types/horror';

interface ScareMeterDisplayProps {
  mode: 'display';
  value?: HorrorLevel;
  compact?: boolean;
}

interface ScareMeterInputProps {
  mode: 'input';
  value?: HorrorLevel;
  onChange: (value: HorrorLevel | undefined) => void;
}

type ScareMeterProps = ScareMeterDisplayProps | ScareMeterInputProps;

const SEGMENT_COLORS: Record<HorrorLevel, string> = {
  1: 'bg-[#7A756E]',
  2: 'bg-[#B5924C]',
  3: 'bg-[#D27A3A]',
  4: 'bg-[#C9303A]',
  5: 'bg-[#E24B55]',
};

export const ScareMeter: React.FC<ScareMeterProps> = (props) => {
  const activeLevel = props.value;
  const activeMeta = SCARE_METER_LEVELS.find((l) => l.level === activeLevel);

  if (props.mode === 'display') {
    const compact = props.compact ?? false;
    return (
      <div className="space-y-2">
        <div
          className="flex items-center gap-1.5"
          role="img"
          aria-label={
            activeMeta
              ? `Scare Meter ${activeMeta.level} of 5: ${activeMeta.zh} (${activeMeta.en})`
              : 'Scare Meter: 未评估'
          }
        >
          {SCARE_METER_LEVELS.map((item) => {
            const filled = activeLevel !== undefined && item.level <= activeLevel;
            return (
              <span
                key={item.level}
                className={`${compact ? 'h-1.5' : 'h-2'} flex-1 rounded-full transition-colors ${
                  filled && activeLevel
                    ? SEGMENT_COLORS[activeLevel]
                    : 'bg-white/[0.08]'
                }`}
              />
            );
          })}
        </div>

        {activeMeta ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <span className="text-xs font-medium text-[#F2EFE9]">
              <span className="font-mono-num text-[#E24B55] font-semibold mr-1.5">
                {activeMeta.level} / 5
              </span>
              {activeMeta.zh}
            </span>
            {!compact && (
              <span className="text-[11px] text-[#8C8881]">{activeMeta.en}</span>
            )}
          </div>
        ) : (
          <div className="text-xs text-[#6F6C66]">未评估恐怖指数</div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-medium text-[#8C8881]">
            Scare Meter · 恐怖指数（1–5 级）
          </span>
          {activeMeta && (
            <span className="text-xs text-[#E24B55] font-medium">
              {activeMeta.level}/5 · {activeMeta.zh} ({activeMeta.en})
            </span>
          )}
        </div>

        {activeLevel !== undefined && (
          <button
            type="button"
            onClick={() => props.onChange(undefined)}
            className="text-[11px] text-[#8C8881] hover:text-white cursor-pointer"
          >
            清除
          </button>
        )}
      </div>

      {/* Graduated 5-Segment Gauge Preview */}
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {SCARE_METER_LEVELS.map((item) => {
          const filled = activeLevel !== undefined && item.level <= activeLevel;
          return (
            <div
              key={item.level}
              className={`h-2 flex-1 rounded-full transition-all duration-150 ${
                filled && activeLevel
                  ? SEGMENT_COLORS[activeLevel]
                  : 'bg-white/[0.08]'
              }`}
            />
          );
        })}
      </div>

      {/* Interactive 1–5 Selectors */}
      <div
        className="grid grid-cols-1 sm:grid-cols-5 gap-2"
        role="radiogroup"
        aria-label="Scare Meter 恐怖指数等级选择"
      >
        {SCARE_METER_LEVELS.map((item) => {
          const isSelected = activeLevel === item.level;
          return (
            <button
              key={item.level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() =>
                props.onChange(isSelected ? undefined : item.level)
              }
              className={`py-2.5 px-3 text-left sm:text-center rounded-xl border min-h-[52px] transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#A31C24] border-[#C9303A] text-white'
                  : 'bg-[#141417] border-white/[0.08] text-[#8C8881] hover:text-white hover:bg-[#1C1C22]'
              }`}
            >
              <div className="flex sm:flex-col items-baseline sm:items-center justify-between sm:justify-center gap-1">
                <span className="font-mono-num text-sm font-semibold">
                  {item.level}
                </span>
                <span className="text-xs font-medium">{item.zh}</span>
              </div>
              <div
                className={`mt-0.5 text-[10px] truncate ${
                  isSelected ? 'text-white/85' : 'text-[#6F6C66]'
                }`}
              >
                {item.en}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
