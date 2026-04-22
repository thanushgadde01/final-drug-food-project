import { GoogleGenAI } from "@google/genai";

// Initialize Gemini per AI Studio guidelines
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Map severity levels to descriptions
const SEVERITY_DESCRIPTIONS = {
  0: "NO INTERACTION - Safe to use together",
  1: "MILD INTERACTION - Minor concern, monitor",
  2: "MODERATE INTERACTION - Consider alternative",
  3: "SEVERE INTERACTION - Avoid if possible",
  4: "CRITICAL INTERACTION - Contraindicated"
};

export const geminiService = {
  async generateSafetyReport(drug, food, age, weight, prediction) {
    try {
      const severityDesc = SEVERITY_DESCRIPTIONS[prediction] || "Unknown severity";
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          Analyze the drug-food interaction between:
          Drug: ${drug}
          Food: ${food}
          Patient Profile: ${age} years old, ${weight}kg
          Severity Level (by XGBoost): ${prediction}/4 - ${severityDesc}

          Provide a concise medical reasoning report for this interaction based on the severity classification.
          Focus on molecular mechanisms and clinical impact.
          
          Note: The prediction is from a 5-class XGBoost model (0=Safe, 1=Mild, 2=Moderate, 3=Severe, 4=Critical).
          
          Return your answer as a JSON object with:
          {
            "report": "detailed string markdown explaining the interaction and recommendations",
            "risk_level": "Safe|Mild|Moderate|Severe|Critical",
            "recommendation": "short action recommendation for the patient",
            "confidence": number between 0 and 1
          }
        `,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const jsonStr = response.text.trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error("Gemini Error:", error);
      const severityDesc = SEVERITY_DESCRIPTIONS[prediction] || "Unknown";
      
      return {
        report: `The interaction between ${drug} and ${food} has been classified as **${SEVERITY_DESCRIPTIONS[prediction]}**. Severity Level: ${prediction}/4. Further clinical validation is advised.`,
        risk_level: ["Safe", "Mild", "Moderate", "Severe", "Critical"][prediction] || "Unknown",
        recommendation: prediction >= 3 ? "Avoid this combination" : prediction >= 2 ? "Consider alternatives" : "Monitor standard precautions",
        confidence: 0.75
      };
    }
  }
};
