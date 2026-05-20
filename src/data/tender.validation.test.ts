import { describe, expect, it } from "vitest";
import {
  AMBITS,
  CRITERIA,
  DOCUMENT_WARNINGS,
  LOTS,
  PAIRS,
  PUBLIC_SOURCE_NOTES,
  THRESHOLD_OPTIONS,
} from "./tender";
import { maxQtPoints } from "../lib/scoring";

const uniqueValues = <T,>(values: T[]) => new Set(values).size === values.length;
const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;

describe("dati gara", () => {
  it("mantiene lotti e combinatorie coerenti", () => {
    expect(uniqueValues(LOTS.map((lot) => lot.id))).toBe(true);

    for (const lot of LOTS) {
      expect(lot.baseByPhase).toHaveLength(3);
      expect(lot.baseByPhase.every((value) => value > 0), lot.id).toBe(true);
      expect(lot.totalBase, lot.id).toBe(lot.baseByPhase.reduce((sum, value) => sum + value, 0));
      expect(lot.minPassengerChecks, lot.id).toBeGreaterThan(0);
      expect(lot.minProductionYears3to7, lot.id).toBeGreaterThan(0);
    }

    expect(uniqueValues(PAIRS.map((pair) => pair.id))).toBe(true);
    for (const pair of PAIRS) {
      expect(pair.lots, pair.id).toHaveLength(2);
      expect(new Set(pair.lots).size, pair.id).toBe(2);
      for (const lotId of pair.lots) {
        expect(LOTS.some((lot) => lot.id === lotId), pair.id).toBe(true);
      }
    }
  });

  it("mantiene criteri, ambiti e soglie allineati", () => {
    expect(uniqueValues(CRITERIA.map((criterion) => criterion.id))).toBe(true);

    const ambitMax = AMBITS.reduce((sum, ambit) => sum + ambit.maxPoints, 0);
    const criteriaMax = CRITERIA.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
    expect(criteriaMax).toBe(ambitMax);

    for (const ambit of AMBITS) {
      const criteriaForAmbit = CRITERIA.filter((criterion) => criterion.ambit === ambit.id);
      const criteriaForAmbitMax = criteriaForAmbit.reduce((sum, criterion) => sum + criterion.maxPoints, 0);
      expect(criteriaForAmbit.length, ambit.id).toBeGreaterThan(0);
      expect(criteriaForAmbitMax, ambit.id).toBe(ambit.maxPoints);
    }

    for (const criterion of CRITERIA) {
      expect(criterion.maxPoints, criterion.id).toBeGreaterThan(0);
      expect(criterion.label.trim(), criterion.id).not.toBe("");
      expect(criterion.source.trim(), criterion.id).not.toBe("");
      expect(AMBITS.some((ambit) => ambit.id === criterion.ambit), criterion.id).toBe(true);

      if (criterion.quantityInput) {
        expect(criterion.kind, criterion.id).toBe("Q");
        expect(["ratio", "percent"]).toContain(criterion.quantityInput.kind);
      }

      if (criterion.dependency) {
        expect(CRITERIA.some((item) => item.id === criterion.dependency?.criterionId), criterion.id).toBe(true);
      }
    }

    expect(uniqueValues(THRESHOLD_OPTIONS.map((option) => option.id))).toBe(true);
    expect(THRESHOLD_OPTIONS.map((option) => option.value)).toContain(37);
    expect(THRESHOLD_OPTIONS.find((option) => option.id === "qt-70-43-4")?.value).toBeCloseTo(maxQtPoints() * 0.7, 4);
  });

  it("mantiene fonti pubbliche e warning documentali verificabili", () => {
    expect(uniqueValues(PUBLIC_SOURCE_NOTES.map((note) => note.id))).toBe(true);

    for (const note of PUBLIC_SOURCE_NOTES) {
      expect(note.title.trim(), note.id).not.toBe("");
      expect(note.body.trim(), note.id).not.toBe("");
      expect(note.sourceUrl, note.id).toMatch(/^https?:\/\//);
      expect(note.verifiedAt, note.id).toMatch(datePattern);
      expect(["Documento di gara", "Fonte pubblica", "Assunzione simulativa"]).toContain(note.reliability);
    }

    expect(DOCUMENT_WARNINGS.length).toBeGreaterThan(0);
    for (const warning of DOCUMENT_WARNINGS) {
      expect(warning.title.trim()).not.toBe("");
      expect(warning.body.trim()).not.toBe("");
    }
  });

  it("mantiene tracciate le criticità documentali sui criteri coinvolti", () => {
    const warningText = DOCUMENT_WARNINGS.map((warning) => `${warning.title} ${warning.body}`).join("\n");

    for (const expectedFragment of ["Soglia di sbarramento", "C.2.1", "C.2.4", "D.1.2", "G.5.1", "All 131_2.XLS"]) {
      expect(warningText).toContain(expectedFragment);
    }

    for (const criterionId of ["C.2.1", "C.2.4", "D.1.2", "G.5.1"]) {
      const criterion = CRITERIA.find((item) => item.id === criterionId);
      expect(criterion, criterionId).toBeDefined();
      expect(criterion?.source, criterionId).toMatch(/All/i);
      expect(criterion?.note, criterionId).toBeTruthy();
    }
  });
});
