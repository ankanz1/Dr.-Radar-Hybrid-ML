import { ECGAnalysisScreen } from './ECGAnalysisScreen';

interface ScreeningScreenProps {
  onScanComplete?: () => void;
  onOpenPatientProfile?: () => void;
  onOpenNotifications?: () => void;
  onNavigateToCircuit?: () => void;
  onNavigateToQuantumLab?: () => void;
  onNavigateToExplainability?: () => void;
}

export const ScreeningScreen = ({
  onNavigateToCircuit,
  onNavigateToQuantumLab,
  onNavigateToExplainability,
}: ScreeningScreenProps) => {
  return (
    <ECGAnalysisScreen
      onNavigateToQuantumLab={onNavigateToQuantumLab || onNavigateToCircuit}
      onNavigateToExplainability={onNavigateToExplainability}
    />
  );
};
