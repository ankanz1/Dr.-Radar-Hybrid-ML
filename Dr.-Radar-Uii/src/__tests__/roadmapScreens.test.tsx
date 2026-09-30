// Tests for the Phase 5/6/7 roadmap prototype screens.
// Verifies: tab routing renders the right panel, honest prototype states are
// present, no fabricated predictions appear, and the ECG module stays marked
// as the only available capability.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, fireEvent } from '@testing-library/react';

import { MultidiseaseScreen } from '../components/roadmap/MultidiseaseScreen';
import { MultimodalScreen } from '../components/roadmap/MultimodalScreen';
import { ResearchScreen } from '../components/roadmap/ResearchScreen';
import {
  ALL_ROADMAP_MODULES,
  ECG_ACTIVE_MODULE,
  MULTIDISEASE_MODULES,
  countModulesByStatus,
} from '../data/roadmapModules';

const noop = () => {};

describe('roadmapModules static config', () => {
  it('marks ECG as the only available module', () => {
    expect(ECG_ACTIVE_MODULE.availableNow).toBe(true);
    expect(ECG_ACTIVE_MODULE.status).toBe('available');
    expect(ALL_ROADMAP_MODULES.every((m) => !m.availableNow)).toBe(true);
  });

  it('contains the expected Phase 5/6/7 modules', () => {
    expect(MULTIDISEASE_MODULES.map((m) => m.id)).toEqual([
      'skin-disease',
      'medical-imaging',
      'cardio-models',
      'laboratory-risk',
      'disease-modules',
    ]);
    expect(ALL_ROADMAP_MODULES).toHaveLength(15);
  });

  it('has no fabricated availability statuses', () => {
    for (const m of ALL_ROADMAP_MODULES) {
      expect(['prototype', 'coming-soon', 'research-preview']).toContain(m.status);
    }
  });

  it('counts statuses correctly', () => {
    const counts = countModulesByStatus(ALL_ROADMAP_MODULES);
    expect(counts.available).toBe(0);
    expect(counts.prototype).toBe(6);
    expect(counts['coming-soon']).toBe(7);
    expect(counts['research-preview']).toBe(2);
  });
});

describe('MultidiseaseScreen (Phase 5)', () => {
  it('overview shows module stats and separates the available ECG module', () => {
    const { getByText, getAllByText, queryByText } = render(
      <MultidiseaseScreen initialModule="multidisease" onNavigate={noop} />
    );
    expect(getByText('Multidisease Detection', { selector: 'h1' })).toBeInTheDocument();
    expect(getAllByText('Available Now').length).toBeGreaterThanOrEqual(1);
    expect(getByText('ECG Arrhythmia Classification')).toBeInTheDocument();
    expect(queryByText('Detected cancer')).not.toBeInTheDocument();
  });

  it('skin panel states no clinical diagnosis is provided and CTA is disabled', () => {
    const { getByText, getByLabelText } = render(
      <MultidiseaseScreen initialModule="multidisease-skin" onNavigate={noop} />
    );
    expect(getByText('Analyze Skin Image')).toBeInTheDocument();
    expect(getByText('Disabled in prototype')).toBeInTheDocument();
    expect(getByText(/does not currently provide a clinical diagnosis/i)).toBeInTheDocument();
  });

  it('imaging panel offers all five modalities as toggleable buttons', () => {
    const { getByText } = render(
      <MultidiseaseScreen initialModule="multidisease-imaging" onNavigate={noop} />
    );
    for (const modality of ['X-ray', 'CT', 'MRI', 'Ultrasound', 'Other']) {
      expect(getByText(modality)).toBeInTheDocument();
    }
    expect(getByText(/no fabricated percentages/i)).toBeInTheDocument();
  });

  it('laboratory panel shows structured input rows with reference ranges and disabled analysis', () => {
    const { getByText } = render(
      <MultidiseaseScreen initialModule="multidisease-laboratory" onNavigate={noop} />
    );
    expect(getByText('Hemoglobin')).toBeInTheDocument();
    expect(getByText(/Reference: 13\.0–17\.0 g\/dL/)).toBeInTheDocument();
    expect(getByText('Run Risk Analysis')).toBeInTheDocument();
    expect(getByText(/no risk score, tier, or probability is displayed/i)).toBeInTheDocument();
  });

  it('disease modules grid renders all six categories without predictions', () => {
    const { getByText, getAllByText } = render(
      <MultidiseaseScreen initialModule="multidisease-modules" onNavigate={noop} />
    );
    for (const name of [
      'Cardiovascular',
      'Metabolic',
      'Neurological',
      'Dermatological',
      'Respiratory',
      'Other',
    ]) {
      expect(getByText(name)).toBeInTheDocument();
    }
    expect(getAllByText(/Status: .* No predictions/).length).toBeGreaterThanOrEqual(2);
  });

  it('sub-navigation switches panels via onNavigate', () => {
    const onNavigate = vi.fn();
    const { container } = render(
      <MultidiseaseScreen initialModule="multidisease" onNavigate={onNavigate} />
    );
    const skinButton = container.querySelector('#roadmap-subnav-multidisease-skin');
    expect(skinButton).not.toBeNull();
    fireEvent.click(skinButton!);
    expect(onNavigate).toHaveBeenCalledWith('multidisease-skin');
  });
});

describe('MultimodalScreen (Phase 6)', () => {
  it('overview renders the four multimodal concept cards', () => {
    const { getByText } = render(<MultimodalScreen initialModule="multimodal" onNavigate={noop} />);
    expect(getByText('Clinical History + Laboratory Data')).toBeInTheDocument();
    expect(getByText('Imaging + Clinical Information')).toBeInTheDocument();
    expect(getByText('Multimodal Patient Risk Profile')).toBeInTheDocument();
    expect(getByText('Longitudinal Health Tracking')).toBeInTheDocument();
  });

  it('history-labs combine interaction toggles demo layout only', () => {
    const { getByText, queryByText } = render(
      <MultimodalScreen initialModule="multimodal-history-labs" onNavigate={noop} />
    );
    expect(queryByText(/Combined Context View/i)).not.toBeInTheDocument();
    expect(getByText(/No multimodal model is involved/i)).toBeInTheDocument();
    fireEvent.click(getByText('Combine Data'));
    expect(getByText(/Combined Context View \(Prototype Layout\)/i)).toBeInTheDocument();
    expect(getByText(/no model runs/i)).toBeInTheDocument();
  });

  it('risk profile shows awaiting-model placeholders and no numeric scores', () => {
    const { getAllByText, getByText, container } = render(
      <MultimodalScreen initialModule="multimodal-risk-profile" />
    );
    expect(getAllByText('Awaiting supported model').length).toBeGreaterThanOrEqual(4);
    expect(getByText(/risk domains/i)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d+% risk/i);
    expect(container.textContent).not.toMatch(/probability of disease/i);
  });

  it('longitudinal timeline renders placeholders and range filters', () => {
    const { getByText, container } = render(
      <MultimodalScreen initialModule="multimodal-longitudinal" />
    );
    expect(getByText('Laboratory trends')).toBeInTheDocument();
    const range6m = container.querySelector('#longitudinal-range-6m');
    expect(range6m).not.toBeNull();
    fireEvent.click(range6m!);
    expect(getByText('Trend chart placeholder')).toBeInTheDocument();
  });
});

describe('ResearchScreen (Phase 7)', () => {
  it('overview renders all six research areas', () => {
    const { getAllByText } = render(
      <ResearchScreen initialModule="research-overview" onNavigate={noop} />
    );
    for (const name of [
      'External Validation',
      'Prospective Evaluation',
      'Explainability',
      'Calibration',
      'Bias / Fairness Analysis',
      'Workflow Evaluation',
    ]) {
      expect(getAllByText(name).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('validation shows placeholder metrics without fabricated values', () => {
    const { getAllByText, getByText } = render(
      <ResearchScreen initialModule="research-validation" onNavigate={noop} />
    );
    expect(getByText('AUROC')).toBeInTheDocument();
    expect(getAllByText('Awaiting dataset').length).toBeGreaterThanOrEqual(4);
    expect(getByText('Not enrolled')).toBeInTheDocument();
  });

  it('explainability references the real ECG capability and blocks the rest', () => {
    const { getByText, container } = render(
      <ResearchScreen initialModule="research-explainability" onNavigate={noop} />
    );
    expect(getByText(/deployed ECG pipeline provides saliency attribution/i)).toBeInTheDocument();
    const futureBtn = container.querySelector('#explain-model-future');
    expect(futureBtn).not.toBeNull();
    fireEvent.click(futureBtn!);
    expect(
      getByText(/explanations cannot be generated for models that do not exist/i)
    ).toBeInTheDocument();
  });

  it('fairness table shows em-dash placeholders and research-only warning', () => {
    const { getByText } = render(
      <ResearchScreen initialModule="research-fairness" onNavigate={noop} />
    );
    expect(getByText('Group A')).toBeInTheDocument();
    expect(getByText(/research-only/i)).toBeInTheDocument();
  });

  it('workflow shows the four clinician-in-the-loop steps', () => {
    const { getByText } = render(
      <ResearchScreen initialModule="research-workflow" onNavigate={noop} />
    );
    expect(getByText('Clinical Review')).toBeInTheDocument();
    expect(getByText('Model Output Review')).toBeInTheDocument();
    expect(getByText('Feedback')).toBeInTheDocument();
    expect(getByText('Documentation & Audit')).toBeInTheDocument();
  });
});
