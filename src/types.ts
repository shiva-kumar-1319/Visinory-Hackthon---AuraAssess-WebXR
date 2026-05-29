/**
 * AuraAssess WebXR - AI Evaluation Response Type Definition
 * Represents the structured JSON payload returned by the Gemini 2.0 Flash VLM.
 */
export interface AIEvaluationResponse {
  /**
   * True if the candidate has completed the current assembly step correctly 
   * according to industrial specifications, false otherwise.
   */
  assembly_step_valid: boolean;

  /**
   * A float value from 0.0 to 1.0 representing the VLM's confidence 
   * in its visual assessment.
   */
  confidence_score: number;

  /**
   * Detailed explanation of the visual validation result, or constructive 
   * feedback detailing what corrections the candidate must make.
   */
  feedback_message: string;

  /**
   * List of specific assembly errors observed (e.g. "rotor casing misaligned", 
   * "missing connector bolts", "drive shaft loose").
   */
  identified_errors: string[];
}
