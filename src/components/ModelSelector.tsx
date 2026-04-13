import { ChevronDown, Check, Search } from 'lucide-react';
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Model } from '@shared/types';
import { ModelConfig } from '../types/misc.ts';

interface ModelSelectorProps {
  models: ModelConfig[];
  selectedModel: string;
  onModelChange: (modelId: Model) => void;
  disabled?: boolean;
  className?: string;
  type?: 'parametric' | 'creative';
  focused?: boolean;
}

function isLocalModel(model: ModelConfig): boolean {
  return model.id.startsWith('custom/') || model.id === 'custom';
}

function ProviderPill({ model }: { model: ModelConfig }) {
  const local = isLocalModel(model);
  return (
    <span
      className={cn(
        'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
        local
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-blue-500/15 text-blue-400',
      )}
    >
      {local ? 'Local' : model.provider || 'Cloud'}
    </span>
  );
}

export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  className,
  disabled,
  focused = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const selectedModelConfig = models.find((m) => m.id === selectedModel);

  const localModels = models.filter(isLocalModel);
  const cloudModels = models.filter((m) => !isLocalModel(m));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'flex h-8 w-auto items-center gap-1.5 rounded-lg px-3 text-sm transition-all duration-200 hover:border-[#333333] hover:bg-adam-neutral-800',
            focused
              ? 'text-white hover:text-white'
              : 'text-adam-text-secondary hover:text-adam-text-primary',
            open &&
              (focused
                ? 'bg-adam-neutral-800 text-white'
                : 'bg-adam-neutral-800 text-adam-text-primary'),
            className,
          )}
          disabled={!!disabled}
        >
          <span className="font-normal">
            {selectedModelConfig?.name ?? 'Select model'}
          </span>
          {selectedModelConfig && (
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
                isLocalModel(selectedModelConfig)
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-blue-500/15 text-blue-400',
              )}
            >
              {isLocalModel(selectedModelConfig)
                ? 'Local'
                : selectedModelConfig.provider || 'Cloud'}
            </span>
          )}
          <ChevronDown
            className={cn(
              'ml-0.5 h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0"
        align="end"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          triggerRef.current?.blur();
        }}
      >
        <Command className="bg-adam-neutral-700">
          <div className="flex items-center border-b border-adam-neutral-600 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-adam-text-secondary" />
            <CommandInput
              placeholder="Search models..."
              className="h-9 border-0 bg-transparent text-sm text-white placeholder:text-adam-text-secondary focus:ring-0"
            />
          </div>
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty className="py-4 text-center text-sm text-adam-text-secondary">
              No models found.
            </CommandEmpty>

            {localModels.length > 0 && (
              <CommandGroup
                heading="Local Models"
                className="px-1 py-1.5 text-xs font-medium text-adam-text-secondary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-adam-text-secondary"
              >
                {localModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={`${model.name} ${model.provider || 'local'}`}
                    onSelect={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    disabled={!!model.disabled}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-adam-text-primary aria-selected:bg-adam-neutral-800"
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        selectedModel === model.id
                          ? 'text-emerald-400 opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    <span className="flex-1 truncate font-medium">
                      {model.name}
                    </span>
                    <ProviderPill model={model} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {cloudModels.length > 0 && (
              <CommandGroup
                heading="Cloud Models"
                className="px-1 py-1.5 text-xs font-medium text-adam-text-secondary [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-adam-text-secondary"
              >
                {cloudModels.map((model) => (
                  <CommandItem
                    key={model.id}
                    value={`${model.name} ${model.provider || 'cloud'}`}
                    onSelect={() => {
                      onModelChange(model.id);
                      setOpen(false);
                    }}
                    disabled={!!model.disabled}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-adam-text-primary aria-selected:bg-adam-neutral-800"
                  >
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0',
                        selectedModel === model.id
                          ? 'text-blue-400 opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    <span className="flex-1 truncate font-medium">
                      {model.name}
                    </span>
                    <ProviderPill model={model} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
