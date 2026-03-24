# Sub-Plan 4: LLM Integration for Context-Aware Edits

## Overview

Enhance the Supabase Edge Function to understand click context and generate targeted OpenSCAD code modifications. The LLM should receive:

1. Click position and surface normal
2. Optional annotation data
3. Optional screenshot
4. Current OpenSCAD code

And generate modified OpenSCAD code that addresses the user's request at the specific location.

## Implementation

### Step 1: Add New Tool to Parametric Chat

Modify `supabase/functions/parametric-chat/index.ts`:

```typescript
// Add to tools array (around line 200)
const tools: Anthropic.Messages.ToolUnion[] = [
  // ... existing tools ...

  {
    name: 'edit_at_location',
    description:
      'Make a precise edit to the OpenSCAD model at a specific 3D location. Use this when the user clicks on a specific part of the model and wants changes applied there.',
    input_schema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Current OpenSCAD code',
        },
        edit_request: {
          type: 'string',
          description:
            "User's edit request (e.g., 'add a hole here', 'round this edge', 'make this thicker')",
        },
        click_context: {
          type: 'object',
          properties: {
            position: {
              type: 'array',
              items: { type: 'number' },
              description: '[x, y, z] World coordinates where user clicked',
            },
            normal: {
              type: 'array',
              items: { type: 'number' },
              description: '[nx, ny, nz] Surface normal vector at click point',
            },
            distance_from_origin: {
              type: 'number',
              description: 'Distance from model origin (0,0,0)',
            },
          },
          required: ['position', 'normal'],
        },
        annotations: {
          type: 'object',
          properties: {
            drawings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  points: { type: 'array' },
                  color: { type: 'string' },
                },
              },
            },
            text_labels: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  position: { type: 'array' },
                  content: { type: 'string' },
                },
              },
            },
          },
          description: 'Optional annotations user has drawn on the model',
        },
      },
      required: ['code', 'edit_request', 'click_context'],
    },
  },
];
```

### Step 2: Enhance System Prompt

Add to the system prompt in `parametric-chat/index.ts`:

```typescript
const SYSTEM_PROMPT = `
You are an expert OpenSCAD assistant helping users design 3D models.

## Context-Aware Editing

When a user clicks on the model and requests changes, you receive:

1. **Click Position** [x, y, z]: Where on the model they clicked
2. **Surface Normal** [nx, ny, nz]: The direction the clicked face is pointing
3. **Distance from Origin**: How far the click is from center

Use this spatial context to make precise edits:
- If normal points upward [0,1,0]: The top of a feature
- If normal points sideways [1,0,0]: The side of a feature  
- Position helps you find the right part of the code to modify

## Guidelines for Context-Aware Edits

1. Analyze the click location to identify the relevant part of the model
2. Use translate/rotate transformations to position new features at the click point
3. For holes: Use difference() with cylinder at click position
4. For rounding: Apply minkowski() or offset() near the click location
5. Keep all other parts of the model unchanged

## Annotation Context

If the user has drawn annotations:
- Red drawings highlight areas of concern
- Text labels indicate specific features

Take these into account when generating code.

## OpenSCAD Best Practices

- Use variables for all dimensions (makes changes easier)
- Use modules for repeated features
- Always center models around origin (0,0,0)
- Use proper boolean operations (union, difference, intersection)
`;
```

### Step 3: Handle Tool Execution for Location-Based Edits

In the tool execution section of parametric-chat, add handler:

```typescript
// Around line 400, add case for new tool
switch (toolName) {
  case 'build_parametric_model':
    // ... existing code ...
    break;

  case 'edit_at_location':
    const { code, edit_request, click_context, annotations } = toolInput;

    // Build enhanced prompt for the LLM
    const locationPrompt = buildLocationAwarePrompt(
      code,
      edit_request,
      click_context,
      annotations,
    );

    // Call LLM to generate modified code
    const modifiedCode = await callLLMWithContext(locationPrompt);

    // Validate the generated code
    const validation = await validateOpenSCADCode(modifiedCode);

    if (!validation.valid) {
      return {
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolCall.id,
            content: JSON.stringify({
              success: false,
              error: validation.error,
              code: modifiedCode,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify({
            success: true,
            code: modifiedCode,
            description: `Applied edit at position [${click_context.position.join(', ')}]`,
          }),
        },
      ],
    };

  // ... other cases
}

function buildLocationAwarePrompt(
  code: string,
  editRequest: string,
  clickContext: any,
  annotations: any,
): string {
  let prompt = `
Current OpenSCAD code:
\`\`\`openscad
${code}
\`\`\`

User clicked at:
- Position: [${clickContext.position.join(', ')}]
- Surface Normal: [${clickContext.normal.join(', ')}]
- Distance from origin: ${clickContext.distance_from_origin}

Edit request: "${editRequest}"
`;

  if (annotations?.text_labels?.length > 0) {
    prompt += `\nUser annotations:\n`;
    annotations.text_labels.forEach((label: any) => {
      prompt += `- "${label.content}" at [${label.position.join(', ')}]\n`;
    });
  }

  prompt += `
Please modify the OpenSCAD code to address the edit request at the specified location.
Only modify the relevant parts of the code - keep everything else unchanged.
Return the complete modified code.
`;

  return prompt;
}
```

### Step 4: Frontend Integration for Context-Aware Messages

Modify frontend to send click context with messages:

```typescript
// In ParametricView.tsx or chat service

interface ContextAwareMessage {
  content: string;
  clickContext?: {
    position: [number, number, number];
    normal: [number, number, number];
    distanceFromOrigin: number;
  };
  annotations?: {
    drawings: any[];
    textLabels: any[];
    screenshot?: string;
  };
}

async function sendContextAwareMessage(message: ContextAwareMessage) {
  const payload = {
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildEnhancedPrompt(message),
          },
          // Include screenshot if available
          ...(message.annotations?.screenshot
            ? [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: message.annotations.screenshot.split(',')[1],
                  },
                },
              ]
            : []),
        ],
      },
    ],
    // Pass click context for tool selection
    click_context: message.clickContext,
    annotations: message.annotations,
  };

  // Call the edge function
  const response = await supabase.functions.invoke('parametric-chat', {
    body: payload,
  });

  return response.data;
}

function buildEnhancedPrompt(message: ContextAwareMessage): string {
  let prompt = message.content;

  if (message.clickContext) {
    const { position, normal, distanceFromOrigin } = message.clickContext;
    prompt = `
${prompt}

---
Context: This request relates to a specific location on the model:
- Clicked at position: [${position.join(', ')}]
- Surface normal: [${normal.join(', ')}]
- Distance from origin: ${distanceFromOrigin.toFixed(2)} units
---
`;
  }

  return prompt;
}
```

### Step 5: Update Mini-Chat to Include Annotations

Modify `src/components/chat/MiniChat.tsx`:

```typescript
interface MiniChatProps {
  clickData: ClickData;
  onSubmit: (
    message: string,
    context: ClickData,
    annotations: AnnotationState,
  ) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

// In the submission handler:
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  if (input.trim()) {
    onSubmit(input, clickData, {
      drawings: state.drawings,
      textLabels: state.textLabels,
      screenshot: state.screenshot,
    });
  }
};
```

## Files to Modify

| File                                          | Changes                                   |
| --------------------------------------------- | ----------------------------------------- |
| `supabase/functions/parametric-chat/index.ts` | Add edit_at_location tool, enhance prompt |
| `src/views/ParametricView.tsx`                | Send click context with messages          |
| `src/components/chat/MiniChat.tsx`            | Include annotations in submission         |

## LLM Prompt Strategy

### Example 1: Adding a Hole

**Input:**

- Click at [10, 5, 0]
- Normal: [1, 0, 0] (sideways)
- Request: "add a hole here"

**LLM receives:**

```
At position [10, 5, 0] with normal [1, 0, 0], add a hole through the model.
The normal indicates this is on the side of the model.
```

**Expected output:**

```openscad
difference() {
  // existing model
  translate([10, 5, 0])
  cylinder(h=20, r=2, center=true);
}
```

### Example 2: Rounding an Edge

**Input:**

- Click at [5, 0, 5]
- Normal: [0.7, 0, 0.7]
- Request: "round this sharp edge"

**LLM receives:**

```
At position [5, 0, 5] with normal [0.7, 0, 0.7], round the sharp edge.
```

### Example 3: Scaling a Feature

**Input:**

- Click at [0, 10, 0]
- Normal: [0, 1, 0] (top)
- Request: "make this taller"

**LLM receives:**

```
At position [0, 10, 0] with normal [0, 1, 0] (top surface), increase the height.
```

## Testing Checklist

- [ ] Tool definition accepted by LLM
- [ ] Click context passed correctly to LLM
- [ ] LLM generates valid OpenSCAD code for location-based edits
- [ ] Annotations included when available
- [ ] Screenshot passed to LLM when available
- [ ] Error handling for invalid generated code
- [ ] Falls back gracefully if LLM can't determine location
