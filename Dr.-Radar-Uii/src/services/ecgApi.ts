const ECG_API_URL = import.meta.env.VITE_ECG_API_URL || 'http://127.0.0.1:8000';

export interface ECGRequest {
  ecg: number[];
}

export interface Probabilities {
  N: number;
  S: number;
  V: number;
  F: number;
  Q: number;
}

export interface PredictionResponse {
  predicted_class_id: number;
  predicted_class: string;
  predicted_class_name: string;
  confidence: number;
  probabilities: Probabilities;
}

export interface AnalyzeResponse {
  prediction: PredictionResponse;
  explanation: {
    top_pca_features: Array<{
      pca_feature: number;
      rank: number;
      importance: number;
      score_change: number;
      baseline_score: number;
      perturbed_score: number;
      pca_value: number;
      perturbation_value: number;
    }>;
    waveform_importance: number[];
    method: string;
  };
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model: string;
  input_features: number;
  pca_components: number;
  qubits: number;
  vqc_layers: number;
}

export interface ModelInfoResponse {
  model: string;
  input_features: number;
  pca_components: number;
  qubits: number;
  vqc_layers: number;
  classes: Record<string, string>;
  test_macro_f1: number;
  research_prototype: boolean;
}

export class ECGAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = 'ECGAPIError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail: string;
    try {
      const errorData = await response.json();
      detail = errorData.detail || JSON.stringify(errorData);
    } catch {
      detail = response.statusText;
    }
    throw new ECGAPIError(
      `ECG API error: ${response.status}`,
      response.status,
      detail
    );
  }
  return response.json();
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${ECG_API_URL}/health`);
  return handleResponse<HealthResponse>(response);
}

export async function getModelInfo(): Promise<ModelInfoResponse> {
  const response = await fetch(`${ECG_API_URL}/model-info`);
  return handleResponse<ModelInfoResponse>(response);
}

export async function predictECG(ecg: number[]): Promise<PredictionResponse> {
  const response = await fetch(`${ECG_API_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ecg }),
  });
  return handleResponse<PredictionResponse>(response);
}

export async function analyzeECG(ecg: number[]): Promise<AnalyzeResponse> {
  const response = await fetch(`${ECG_API_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ecg }),
  });
  return handleResponse<AnalyzeResponse>(response);
}