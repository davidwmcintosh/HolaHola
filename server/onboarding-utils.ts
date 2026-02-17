import OpenAI from "openai";

export interface NameExtractionResult {
  name: string | null;
  confidence: "high" | "medium" | "low";
  shouldAskAgain: boolean;
}

export interface LanguageExtractionResult {
  language: string | null;
  confidence: "high" | "medium" | "low";
  shouldAskAgain: boolean;
}

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
  shouldSwitch: boolean;
}

/**
 * Extract user's name from their message using OpenAI structured output
 */
export async function extractNameFromMessage(
  openai: OpenAI,
  userMessage: string
): Promise<NameExtractionResult> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant that extracts a person's name from their message. The user has been asked 'What's your name?'. Accept ANY plausible name, whether it's a single word like 'Alex' or a full sentence like 'My name is Alex'. Be permissive - if it looks like a name at all, extract it with high confidence."
      },
      {
        role: "user",
        content: `Extract the person's name from this message: "${userMessage}"`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "name_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            name: {
              type: ["string", "null"],
              description: "The extracted name, or null if no clear name was provided"
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Confidence level in the extracted name"
            },
            shouldAskAgain: {
              type: "boolean",
              description: "Whether to ask the user for their name again"
            }
          },
          required: ["name", "confidence", "shouldAskAgain"],
          additionalProperties: false
        }
      }
    }
  });

  const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return result as NameExtractionResult;
}

/**
 * Extract user's language preference from their message using OpenAI structured output
 */
export async function extractLanguageFromMessage(
  openai: OpenAI,
  userMessage: string
): Promise<LanguageExtractionResult> {
  const supportedLanguages = [
    "english", "spanish", "french", "german", "italian", 
    "portuguese", "japanese", "mandarin", "korean", "hebrew"
  ];

  console.log('[LANG-EXTRACT] Input message:', userMessage);
  console.log('[LANG-EXTRACT] Supported languages:', supportedLanguages);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that identifies which language a person wants to study from their message. Supported languages are: ${supportedLanguages.join(", ")}. The user has been asked which language they want to study. Accept ANY mention of a supported language, whether it's a single word like 'French' or a full sentence like 'I want to learn French'. Be permissive - if the message mentions a supported language, extract it with high confidence. Always return the language name in lowercase.`
      },
      {
        role: "user",
        content: `Which language does this person want to study: "${userMessage}"`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "language_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            language: {
              type: ["string", "null"],
              description: `The language they want to study (must be one of: ${supportedLanguages.join(", ")}), in lowercase, or null if unclear`
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Confidence level in the extracted language preference"
            },
            shouldAskAgain: {
              type: "boolean",
              description: "Whether to ask the user for their language preference again"
            }
          },
          required: ["language", "confidence", "shouldAskAgain"],
          additionalProperties: false
        }
      }
    }
  });
  
  console.log('[LANG-EXTRACT] Raw AI response:', completion.choices[0]?.message?.content);

  const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
  console.log('[LANG-EXTRACT] Parsed result:', JSON.stringify(result));
  return result as LanguageExtractionResult;
}

/**
 * Extract user's native language from their message using OpenAI structured output
 */
export async function extractNativeLanguageFromMessage(
  openai: OpenAI,
  userMessage: string
): Promise<LanguageExtractionResult> {
  const supportedNativeLanguages = [
    "english", "spanish", "french", "german", "italian", 
    "portuguese", "japanese", "mandarin", "korean", "hebrew", "arabic", "russian", "hindi"
  ];

  console.log('[NATIVE-LANG-EXTRACT] Input message:', userMessage);
  console.log('[NATIVE-LANG-EXTRACT] Supported native languages:', supportedNativeLanguages);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that identifies a person's native language from their message. Supported languages are: ${supportedNativeLanguages.join(", ")}. The user has been asked 'What is your native language?' or 'What language do you speak?'. Accept ANY mention of a supported language, whether it's a single word like 'Spanish' or a full sentence like 'I speak Spanish'. Be permissive - if the message mentions a supported language, extract it with high confidence. Always return the language name in lowercase.`
      },
      {
        role: "user",
        content: `What is this person's native language: "${userMessage}"`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "native_language_extraction",
        strict: true,
        schema: {
          type: "object",
          properties: {
            language: {
              type: ["string", "null"],
              description: `Their native language (must be one of: ${supportedNativeLanguages.join(", ")}), in lowercase, or null if unclear`
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Confidence level in the extracted native language"
            },
            shouldAskAgain: {
              type: "boolean",
              description: "Whether to ask the user for their native language again"
            }
          },
          required: ["language", "confidence", "shouldAskAgain"],
          additionalProperties: false
        }
      }
    }
  });
  
  console.log('[NATIVE-LANG-EXTRACT] Raw AI response:', completion.choices[0]?.message?.content);

  const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
  console.log('[NATIVE-LANG-EXTRACT] Parsed result:', JSON.stringify(result));
  return result as LanguageExtractionResult;
}

/**
 * Detect the language being used in a message
 */
export async function detectLanguage(
  openai: OpenAI,
  userMessage: string,
  currentLanguage: string
): Promise<LanguageDetectionResult> {
  const supportedLanguages = [
    "spanish", "french", "german", "italian",
    "portuguese", "japanese", "mandarin", "korean", "english", "hebrew"
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You are a language detection assistant. Identify the primary language used in the user's message. Supported languages: ${supportedLanguages.join(", ")}. The user is currently set to practice "${currentLanguage}". If they're using a different language consistently, we should switch to that language.`
      },
      {
        role: "user",
        content: `Detect the language in this message: "${userMessage}"`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "language_detection",
        strict: true,
        schema: {
          type: "object",
          properties: {
            detectedLanguage: {
              type: "string",
              description: `The detected language (one of: ${supportedLanguages.join(", ")})`
            },
            confidence: {
              type: "number",
              description: "Confidence score from 0 to 1"
            },
            shouldSwitch: {
              type: "boolean",
              description: "Whether to switch to the detected language (true if user is using a different language than current setting and it's not just a single word)"
            }
          },
          required: ["detectedLanguage", "confidence", "shouldSwitch"],
          additionalProperties: false
        }
      }
    }
  });

  const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
  return result as LanguageDetectionResult;
}

export interface NativeLanguageChangeRequest {
  wantsToChange: boolean;
  newNativeLanguage: string | null;
  confidence: "high" | "medium" | "low";
}

export interface TargetLanguageChangeRequest {
  wantsToChange: boolean;
  newTargetLanguage: string | null;
  confidence: "high" | "medium" | "low";
}

/**
 * Detect if user is requesting to change their target learning language
 */
export async function detectTargetLanguageChangeRequest(
  openai: OpenAI,
  userMessage: string,
  currentTargetLanguage: string
): Promise<TargetLanguageChangeRequest> {
  const supportedTargetLanguages = [
    "spanish", "french", "german", "italian", 
    "portuguese", "japanese", "mandarin", "korean", "english", "hebrew"
  ];

  console.log('[TARGET-LANG-CHANGE] Checking message:', userMessage);
  console.log('[TARGET-LANG-CHANGE] Current target language:', currentTargetLanguage);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You detect if a user wants to CHANGE the language they're learning. Their current target language is "${currentTargetLanguage}". 

Look for requests like:
- "Can we switch to Italian?"
- "I want to learn French instead"
- "Let's practice German"
- "Change to Spanish please"

Supported target languages: ${supportedTargetLanguages.join(", ")}

IMPORTANT: Only set wantsToChange=true if they're explicitly requesting to learn a DIFFERENT language than ${currentTargetLanguage}. Don't trigger for general conversation.`
      },
      {
        role: "user",
        content: `Does this message request to change target learning language: "${userMessage}"`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "target_language_change_detection",
        strict: true,
        schema: {
          type: "object",
          properties: {
            wantsToChange: {
              type: "boolean",
              description: "Whether the user is requesting to change their target learning language"
            },
            newTargetLanguage: {
              type: ["string", "null"],
              description: `The new target language they want to learn (one of: ${supportedTargetLanguages.join(", ")}), in lowercase, or null if not requesting change`
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Confidence in the detected change request"
            }
          },
          required: ["wantsToChange", "newTargetLanguage", "confidence"],
          additionalProperties: false
        }
      }
    }
  });
  
  const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
  
  // Normalize language to lowercase for consistent comparison
  if (result.newTargetLanguage) {
    result.newTargetLanguage = result.newTargetLanguage.toLowerCase();
  }
  
  console.log('[TARGET-LANG-CHANGE] Detection result:', JSON.stringify(result));
  return result as TargetLanguageChangeRequest;
}

/**
 * Detect if user is requesting to change their native language
 */
export async function detectNativeLanguageChangeRequest(
  openai: OpenAI,
  userMessage: string,
  currentNativeLanguage: string
): Promise<NativeLanguageChangeRequest> {
  const supportedNativeLanguages = [
    "english", "spanish", "french", "german", "italian", 
    "portuguese", "japanese", "mandarin", "korean", "hebrew", "arabic", "russian", "hindi"
  ];

  console.log('[NATIVE-LANG-CHANGE] Checking message:', userMessage);
  console.log('[NATIVE-LANG-CHANGE] Current native language:', currentNativeLanguage);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-5",
    messages: [
      {
        role: "system",
        content: `You detect if a user wants to CHANGE their native language preference. Their current native language is "${currentNativeLanguage}". 

Look for requests like:
- "Change my native language to English"
- "Can you explain in Spanish instead?"
- "Switch to French explanations"
- "I want instructions in German"

Supported languages: ${supportedNativeLanguages.join(", ")}

IMPORTANT: Only set wantsToChange=true if they're explicitly requesting a CHANGE to a different language. Don't trigger for general conversation about languages.`
      },
      {
        role: "user",
        content: `Does this message request a native language change: "${userMessage}"`
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "native_language_change_detection",
        strict: true,
        schema: {
          type: "object",
          properties: {
            wantsToChange: {
              type: "boolean",
              description: "Whether the user is requesting to change their native language"
            },
            newNativeLanguage: {
              type: ["string", "null"],
              description: `The new native language they want (one of: ${supportedNativeLanguages.join(", ")}), in lowercase, or null if not requesting change`
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
              description: "Confidence in the detected change request"
            }
          },
          required: ["wantsToChange", "newNativeLanguage", "confidence"],
          additionalProperties: false
        }
      }
    }
  });
  
  const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
  
  // Normalize language to lowercase for consistent comparison
  if (result.newNativeLanguage) {
    result.newNativeLanguage = result.newNativeLanguage.toLowerCase();
  }
  
  console.log('[NATIVE-LANG-CHANGE] Detection result:', JSON.stringify(result));
  return result as NativeLanguageChangeRequest;
}
