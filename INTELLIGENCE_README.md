# AI Desktop Agent Architecture & Tool Plan

*Note: This architecture is currently in the planning phase. No implementation code has been added yet.*

## Overview
The design philosophy for the AI Desktop Agent is to **Act like a Human, but Provide System Context for Reliability.** To achieve this, the AI is constrained to a human-like paradigm using Vision (eyes) and Motor functionality (mouse and keyboard). To prevent frequent failure states inherent to pure computer vision operations, the AI is granted select, highly reliable "System Tools" that act as a safety net.

---

## 1. Perception & Vision Tools (The Eyes)
To behave like a user, the AI relies directly on the visual state of the machine.
*   **`capture_screen`**: Takes a screenshot of the monitors for the vision model to observe. Logs these screenshots locally to maintain high transparency of the model's decision-making process.
*   **`analyze_ui_elements`**: Translates the screen visual data and OS accessibility trees into a mapped layout of actionable elements, complete with bounding boxes and coordinates (`X, Y`).
*   **`verify_visual_state`**: A self-check mechanism where the AI assesses if a predicted UI change actually occurred onscreen (e.g., verifying a menu opened after clicking).

## 2. Motor Skills (The Hands / Mouse)
The AI interacts with the UI physically rather than using API hooks to bypass the desktop.
*   **`mouse_move(x, y)`**: Moves the physical cursor to designated coordinates, ensuring hover-states are properly activated.
*   **`mouse_click(button, clicks)`**: Triggers OS-level clicks (Left/Right/Middle, Single/Double) exactly where the cursor rests.
*   **`mouse_drag(start_x, start_y, end_x, end_y)`**: Simulates a click-and-hold movement. Necessary for dragging windows, files, or highlighting onscreen areas.
*   **`mouse_scroll(direction, amount)`**: Emulates the mouse wheel.

## 3. Motor Skills (The Fingers / Keyboard)
Text entry must circumvent errors associated with non-human typing speed.
*   **`keyboard_type(text)`**: Rapidly inputs strings of text with micro-delays mimicking human keystrokes to ensure software dropdowns and search auto-completes process the input properly.
*   **`keyboard_press(keys)`**: Fires distinct OS key codes or modifiers (e.g., `enter`, `ctrl+c`, `win+r`). Essential for UI navigation.

## 4. Hardware & System Tools (The Safety Net)
These bypass the human visual interface slightly to gather ground-truth OS data and interact directly with hardware. Designed to dramatically reduce action failure rates.
*   **`get_active_window`**: Retrieves the title and process of the currently focused window, removing the visual guesswork of "did the app open?".
*   **`list_open_windows`**: Outputs a manifest of running applications so the AI doesn't need to visually scrape the taskbar.
*   **`focus_or_launch_app`**: If an application exists, this forces it to the foreground. If not, it launches it at the system level. Faster and more reliable than navigating the Start Menu.
*   **`get_screen_dimensions`**: Retrieves monitor resolutions, ensuring the AI only targets valid, on-screen `X, Y` coordinates.
*   **`hardware_media_controls`**: Adjusts system media states directly (e.g., `set_system_volume`, `get_system_volume`, `mute`).
*   **`hardware_display_controls`**: Direct adjustment of display metrics (e.g., `set_screen_brightness`, `get_screen_brightness`).
*   **`clipboard_read_write`**: A failsafe for selecting large blocks of text visually. The AI can write text string data directly to the clipboard, moving into position to invoke `keyboard_press("ctrl+v")`.

## 5. Flow Control (The Brain)
State management tools ensuring the loop does not freeze, get stuck in infinite thinking, or hallucinate task completion.
*   **`wait_for_ui(milliseconds)`**: Triggers a deliberate rest sequence to account for long loading times, heavy app startups, or network request delays.
*   **`end_turn(status, message)`**: Yields execution control, successfully denoting that the task objective is considered satisfied (or failed).

---

# Intelligence Edge Function — API Documentation

## Overview
The **intelligence** edge function is a bridge to Google Gemini AI via the Lovable AI Gateway. It accepts prompts, generates AI responses, and logs every request to the database for debugging.

---

## API Endpoint

```
POST https://bevgdqpjzqklpnqzmezu.supabase.co/functions/v1/intelligence
```

---

## Authentication

Every request must include your custom API key in the `x-api-key` header.

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `x-api-key` | Your `INTELLIGENCE_API_KEY` value |

---

## Request Format

```json
{
  "systemPrompt": "You are a helpful assistant.",
  "userPrompt": "Explain quantum computing in simple terms.",
  "model": "google/gemini-2.5-flash",
  "temperature": 0.7
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `systemPrompt` | string | ✅ | — | System instructions for the AI |
| `userPrompt` | string | ✅ | — | The user's message/question |
| `model` | string | ❌ | `google/gemini-2.5-flash` | AI model to use (see Available Models) |
| `temperature` | number | ❌ | `0.7` | Creativity (0 = deterministic, 2 = very creative) |

### Available Models

| Model | Best For |
|---|---|
| `google/gemini-2.5-flash` | **Default.** Balanced speed & quality |
| `google/gemini-2.5-flash-lite` | Fastest, cheapest. Simple tasks |
| `google/gemini-2.5-pro` | Complex reasoning, large contexts |
| `google/gemini-3-flash-preview` | Next-gen balanced model |
| `google/gemini-3-pro-preview` | Next-gen complex reasoning |
| `openai/gpt-5` | High accuracy, multimodal |
| `openai/gpt-5-mini` | Balanced cost/performance |
| `openai/gpt-5-nano` | High-volume, simple tasks |

---

## Response Format

### Success (200)

```json
{
  "success": true,
  "response": "Quantum computing uses quantum bits (qubits) that can exist in multiple states simultaneously...",
  "model": "google/gemini-2.5-flash",
  "usage": {
    "prompt_tokens": 50,
    "completion_tokens": 120,
    "total_tokens": 170
  },
  "duration_ms": 1234,
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### Error (4xx/5xx)

```json
{
  "success": false,
  "error": "Human-readable error message",
  "error_code": "RATE_LIMITED",
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "details": "Additional debug info when available"
}
```

---

## Error Codes

| HTTP Status | Error Code | Meaning |
|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed JSON or bad HTTP method |
| 400 | `MISSING_FIELD` | Required field (systemPrompt/userPrompt) is missing |
| 400 | `INVALID_TEMPERATURE` | Temperature is not a number between 0–2 |
| 401 | `MISSING_API_KEY` | No `x-api-key` header provided |
| 401 | `INVALID_API_KEY` | The API key doesn't match |
| 402 | `PAYMENT_REQUIRED` | AI credits exhausted — add funds in Lovable workspace |
| 429 | `RATE_LIMITED` | Too many requests — wait and retry |
| 502 | `AI_GATEWAY_ERROR` | The AI gateway returned an unexpected error |
| 500 | `INTERNAL_ERROR` | Unexpected server error (check logs) |

---

## Example cURL Commands

### Basic request
```bash
curl -X POST \
  https://bevgdqpjzqklpnqzmezu.supabase.co/functions/v1/intelligence \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -d '{
    "systemPrompt": "You are a helpful assistant.",
    "userPrompt": "What is the capital of France?"
  }'
```

### With custom model and temperature
```bash
curl -X POST \
  https://bevgdqpjzqklpnqzmezu.supabase.co/functions/v1/intelligence \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY_HERE" \
  -d '{
    "systemPrompt": "You are a creative writer.",
    "userPrompt": "Write a haiku about programming.",
    "model": "google/gemini-2.5-pro",
    "temperature": 1.2
  }'
```

### Windows PowerShell
```powershell
Invoke-RestMethod -Uri "https://bevgdqpjzqklpnqzmezu.supabase.co/functions/v1/intelligence" `
  -Method POST `
  -Headers @{ "Content-Type" = "application/json"; "x-api-key" = "YOUR_API_KEY_HERE" } `
  -Body '{ "systemPrompt": "You are a helpful assistant.", "userPrompt": "Hello!" }'
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `MISSING_API_KEY` | Add `x-api-key` header to your request |
| `INVALID_API_KEY` | Check your key matches the `INTELLIGENCE_API_KEY` secret |
| `RATE_LIMITED` (429) | Wait 10–30 seconds, then retry. Consider upgrading your plan |
| `PAYMENT_REQUIRED` (402) | Go to Lovable Settings → Workspace → Usage to add credits |
| `AI_GATEWAY_ERROR` (502) | Temporary issue — retry after a few seconds |
| `INTERNAL_ERROR` (500) | Check the `chat_logs` table for error details. The `request_id` in the response maps to the `id` column |
| CORS errors | The function allows all origins. Ensure you're sending the correct headers |
| Empty response | Check that `systemPrompt` and `userPrompt` are non-empty strings |

### Debugging with chat_logs

Every request (success or failure) is logged in the `chat_logs` table. Query it to debug:

```sql
-- Latest 10 requests
SELECT id, status, error_message, error_code, duration_ms, created_at
FROM chat_logs ORDER BY created_at DESC LIMIT 10;

-- Failed requests only
SELECT * FROM chat_logs WHERE status = 'error' ORDER BY created_at DESC;

-- Requests by API key hash
SELECT * FROM chat_logs WHERE api_key_hash = 'hash_xxxx' ORDER BY created_at DESC;
```
