import { Button } from '@cognite/aura/components/button';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@cognite/aura/components/command';
import { Popover, PopoverContent, PopoverTrigger } from '@cognite/aura/components/popover';
import { IconChevronDown, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';

import { instanceKey } from '../cdm/properties';
import type { AssetMatch } from '../domain/asset360Types';
import { useAssetSearchViewModel } from '../hooks/useAssetSearchViewModel';

type AssetSearchControlProps = {
  /** Label of the currently selected asset, shown on the trigger. */
  selectedLabel: string | undefined;
};

/**
 * Type-ahead asset search.
 *
 * Aura's `Combobox` takes a static `options` array and gives no input-change
 * callback, so it cannot drive a server-side search. `Command` is the Aura
 * primitive for this: it owns keyboard navigation and ARIA roles, and here
 * filtering is turned off because CDF does the matching.
 */
export function AssetSearchControl({ selectedLabel }: AssetSearchControlProps) {
  const [open, setOpen] = useState(false);
  const search = useAssetSearchViewModel();

  const onSelect = (match: AssetMatch) => {
    search.selectAsset(match);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" className="w-full justify-between sm:w-90" aria-label="Search for an asset">
            <span className="flex min-w-0 items-center gap-2">
              <IconSearch aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedLabel ?? 'Search for an asset or tag'}</span>
            </span>
            <IconChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[min(28rem,90vw)] p-0">
        {/*
          CDF ranks and filters, so `shouldFilter` off stops cmdk filtering
          again. `label` is what names the input: cmdk points the input's
          `aria-labelledby` at its own hidden label, which would override an
          `aria-label` placed on the input.
        */}
        <Command label="Asset name or tag" shouldFilter={false}>
          <CommandInput
            value={search.inputValue}
            onValueChange={search.setInputValue}
            placeholder="Type an asset name or tag"
          />
          <CommandList aria-busy={search.status === 'loading'}>
            <SearchResults search={search} onSelect={onSelect} />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type SearchResultsProps = {
  search: ReturnType<typeof useAssetSearchViewModel>;
  onSelect: (match: AssetMatch) => void;
};

function SearchResults({ search, onSelect }: SearchResultsProps) {
  if (search.status === 'idle') {
    return <CommandEmpty>Start typing to find an asset by name or tag.</CommandEmpty>;
  }
  if (search.status === 'loading') {
    return <CommandEmpty>Searching assets…</CommandEmpty>;
  }
  if (search.status === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-2 p-4 text-sm">
        <p className="text-foreground">{search.errorMessage}</p>
        <Button variant="secondary" size="sm" onClick={search.retry}>
          Try again
        </Button>
      </div>
    );
  }
  if (search.status === 'empty') {
    return <CommandEmpty>No assets match “{search.committedQuery}”.</CommandEmpty>;
  }

  return (
    <>
      {search.results.map((match) => (
        <CommandItem
          key={instanceKey(match.ref)}
          value={instanceKey(match.ref)}
          onSelect={() => onSelect(match)}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{match.label}</span>
            {match.description !== undefined && (
              <span className="truncate text-xs text-muted-foreground">{match.description}</span>
            )}
          </span>
        </CommandItem>
      ))}
    </>
  );
}
