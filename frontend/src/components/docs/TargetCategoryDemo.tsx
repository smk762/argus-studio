"use client";

import { useState } from "react";
import { DemoCard, DemoFact, DemoFacts, SegmentedButtons } from "@/components/docs/DemoPrimitives";
import {
  CATEGORY_COMPOSITION_TIPS,
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  DATASET_SIZE_GUIDE,
  TARGET_CATEGORIES,
  type TargetCategory,
} from "@/components/curator/types";

/**
 * Live, embeddable widget for the Target Category doc page. It drives the SAME
 * curator constants the Curate tool uses (CATEGORY_* / DATASET_SIZE_GUIDE), so
 * the docs demonstrate real behaviour rather than a copy. Picking a category
 * updates the description, "what good input looks like" tip, and the suggested
 * dataset size — exactly what the Curate scorer optimises for.
 */
export function TargetCategoryDemo() {
  const [category, setCategory] = useState<TargetCategory>("identity");
  const guide = DATASET_SIZE_GUIDE[category];

  return (
    <DemoCard aside="live from the Curate scorer">

      <SegmentedButtons
        label="Target category"
        options={TARGET_CATEGORIES.map((cat) => ({ value: cat, label: CATEGORY_LABELS[cat] }))}
        value={category}
        onChange={setCategory}
      />

      <DemoFacts>
        <DemoFact term="What it trains">{CATEGORY_DESCRIPTIONS[category]}</DemoFact>
        <DemoFact term="What good input looks like">{CATEGORY_COMPOSITION_TIPS[category]}</DemoFact>
        <DemoFact term="Suggested set size">~{guide.ideal} sharp, varied images</DemoFact>
      </DemoFacts>
    </DemoCard>
  );
}
