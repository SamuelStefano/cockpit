import type { BaseEngine } from '../engine/engine';
import type { RuleOffer as Offer } from '../sim-types';

export function RuleOffer({ offer, engine }: { offer: Offer; engine: BaseEngine }) {
  return (
    <div className="base-rule">
      <b>You picked this twice.</b>
      <span>{offer.title} → {offer.label}</span>
      <button type="button" onClick={() => engine.acceptRule()}>Make it a rule</button>
      <button type="button" onClick={() => engine.dismissRule()}>Keep asking</button>
    </div>
  );
}
