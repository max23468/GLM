import type { Criterion } from "../data/tender";
import { computeQuantityInputValue, type LotOffer, type QuantityInputValue, type TradeoffPlan } from "./scoring";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const defaultTradeoff = (): TradeoffPlan => ({ deltaUnits: 0, unitCost: 0, denominator: 0 });

export const effectiveTradeoffDenominator = (criterion: Criterion, quantityInput: QuantityInputValue | undefined, plan: TradeoffPlan) => {
  if (!criterion.quantityInput) return plan.denominator;
  return plan.denominator > 0 ? plan.denominator : quantityInput?.denominator ?? 0;
};

const quantityInputAfterTradeoff = (
  criterion: Criterion,
  currentValue: number | boolean,
  quantityInput: QuantityInputValue | undefined,
  plan: TradeoffPlan,
): QuantityInputValue | undefined => {
  if (!criterion.quantityInput) return undefined;
  const denominator = effectiveTradeoffDenominator(criterion, quantityInput, plan);
  if (denominator <= 0) return undefined;
  const currentNumeric = Number(currentValue) || 0;
  const currentRatio = criterion.quantityInput.kind === "percent" ? currentNumeric / 100 : currentNumeric;
  const numerator = quantityInput?.denominator === denominator ? quantityInput.numerator : Math.round(clamp01(currentRatio) * denominator);
  return {
    numerator: Math.max(0, numerator + Math.max(0, plan.deltaUnits)),
    denominator,
  };
};

export const computeTradeoffValue = (criterion: Criterion, currentValue: number | boolean, plan: TradeoffPlan, quantityInput?: QuantityInputValue) => {
  if (criterion.kind === "T") return true;
  if (criterion.kind === "D") return currentValue;

  const current = Number(currentValue) || 0;
  if (criterion.quantityInput) {
    const nextInput = quantityInputAfterTradeoff(criterion, currentValue, quantityInput, plan);
    return nextInput ? computeQuantityInputValue(criterion, nextInput) : current;
  }
  if (criterion.input === "ratio") {
    if (plan.denominator <= 0) return current;
    return Math.min(1, Math.max(0, current + plan.deltaUnits / plan.denominator));
  }
  if (criterion.formula === "lower" || criterion.formula === "soil") {
    return Math.max(0, current - plan.deltaUnits);
  }
  return Math.max(0, current + plan.deltaUnits);
};

export const tradeoffCost = (criterion: Criterion, plan: TradeoffPlan) => {
  if (criterion.kind === "D") return 0;
  const quantity = criterion.kind === "T" ? 1 : Math.max(0, plan.deltaUnits);
  return quantity * Math.max(0, plan.unitCost);
};

export const applyTradeoffPlanToOffer = (offer: LotOffer, criterion: Criterion, plan: TradeoffPlan) => {
  const currentValue =
    criterion.kind === "Q" ? computeCurrentQuantitativeValue(offer, criterion) : criterion.kind === "T" ? offer.tValues[criterion.id] : offer.dValues[criterion.id];
  const quantityInput = offer.quantityInputs?.[criterion.id];
  const nextValue = computeTradeoffValue(criterion, currentValue, plan, quantityInput);

  if (criterion.kind === "Q") {
    const nextInput = quantityInputAfterTradeoff(criterion, currentValue, quantityInput, plan);
    if (nextInput) {
      offer.quantityInputs = { ...offer.quantityInputs, [criterion.id]: nextInput };
      offer.qValues[criterion.id] = computeQuantityInputValue(criterion, nextInput);
    } else {
      offer.qValues[criterion.id] = Number(nextValue);
    }
  }
  if (criterion.kind === "T") offer.tValues[criterion.id] = Boolean(nextValue);
};

const computeCurrentQuantitativeValue = (offer: LotOffer, criterion: Criterion) => {
  if (criterion.quantityInput) {
    const input = offer.quantityInputs?.[criterion.id];
    if (input && input.denominator > 0) return computeQuantityInputValue(criterion, input);
  }
  return offer.qValues[criterion.id] ?? 0;
};
