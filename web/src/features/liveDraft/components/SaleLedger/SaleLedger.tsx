import { useState, type SyntheticEvent } from "react";
import { Button, TextField } from "../../../../shared/ui";
import type { LiveDraftSale } from "../../api/liveDraftSchemas";
import { filterSales, formatDollars } from "../../lib/liveDraftDisplay";
import "./SaleLedger.css";

interface SaleLedgerProps {
  readonly canCorrect: boolean;
  readonly onCorrect: (saleEventId: string, command: string) => boolean;
  readonly sales: readonly LiveDraftSale[];
}

const correctionCommand = (sale: LiveDraftSale): string =>
  `${sale.ownerDisplayName} drafted ${sale.playerName} for ${String(sale.price)}`;

export const SaleLedger = ({ canCorrect, onCorrect, sales }: SaleLedgerProps) => {
  const [search, setSearch] = useState("");
  const [selectedSale, setSelectedSale] = useState<LiveDraftSale>();
  const [command, setCommand] = useState("");
  const visibleSales = filterSales(sales, search);
  const selectSale = (sale: LiveDraftSale) => {
    setSelectedSale(sale);
    setCommand(correctionCommand(sale));
  };
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedSale === undefined || command.trim().length === 0) return;
    const accepted = onCorrect(selectedSale.saleEventId, command.trim());
    if (accepted) setSelectedSale(undefined);
  };

  return (
    <section aria-labelledby="sale-ledger-title" className="live-panel sale-ledger">
      <header className="live-panel__header">
        <h2 id="sale-ledger-title">All sales</h2><span>{sales.length}</span>
      </header>
      <div className="sale-ledger__body">
        <TextField
          aria-label="Search all sales"
          id="live-sales-search"
          label="Search all sales"
          onChange={event => { setSearch(event.currentTarget.value); }}
          placeholder="Player, owner, team, or price"
          role="searchbox"
          value={search}
        />
        {visibleSales.length === 0 && <p className="live-empty">{sales.length === 0
          ? "Sales will appear here for everyone."
          : "No sales match this search."}</p>}
        <ol className="sale-ledger__list">
          {visibleSales.map(sale => <li key={sale.saleEventId}>
            <span><strong>{sale.playerName}</strong><small>{sale.ownerDisplayName} · {sale.teamDisplayName}</small></span>
            <strong>{formatDollars(sale.price)}</strong>
            {canCorrect && <Button
              aria-label={`Correct sale of ${sale.playerName}`}
              onClick={() => { selectSale(sale); }}
              variant="secondary"
            >Correct</Button>}
          </li>)}
        </ol>
        {selectedSale !== undefined && <form
          aria-label="Correct sale"
          className="sale-ledger__correction"
          onSubmit={submit}
        >
          <TextField
            id="live-sale-correction"
            label="Correct sale"
            onChange={event => { setCommand(event.currentTarget.value); }}
            value={command}
          />
          <div><Button disabled={command.trim().length === 0} type="submit">Apply correction</Button>
            <Button onClick={() => { setSelectedSale(undefined); }} variant="secondary">Cancel</Button></div>
        </form>}
      </div>
    </section>
  );
};
